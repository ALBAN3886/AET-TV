package com.albaneloh.iptv.vpn

import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.wireguard.android.backend.Backend
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import com.wireguard.config.InetEndpoint
import com.wireguard.config.InetNetwork
import com.wireguard.config.Interface
import com.wireguard.config.Peer
import com.wireguard.crypto.Key
import com.wireguard.crypto.KeyPair
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext

/**
 * Couche responsable de WireGuard. C'est la SEULE classe qui parle directement
 * à la bibliothèque `com.wireguard.android:tunnel` (GoBackend). Elle n'implémente
 * elle-même aucune primitive cryptographique ni aucune partie du protocole
 * WireGuard : tout est délégué à la bibliothèque officielle.
 *
 * Architecture voulue :
 *   UI (JS) -> AetVpnBridge -> AetVpnService -> WireGuardManager -> GoBackend (WireGuard officiel)
 */
class WireGuardManager(private val context: Context) {

    private val backend: Backend by lazy { GoBackend(context) }
    private val repository = VpnRepository()
    private val prefs by lazy { encryptedPrefs() }

    private val tunnel = SimpleTunnel(NAME_TUNNEL) { newState ->
        val mapped = when (newState) {
            Tunnel.State.UP -> VpnConnectionState.CONNECTED
            Tunnel.State.DOWN -> VpnConnectionState.DISCONNECTED
            else -> _status.value.state
        }
        updateState(mapped)
    }

    private val _status = MutableStateFlow(VpnStatus(state = VpnConnectionState.DISCONNECTED))
    val status: StateFlow<VpnStatus> = _status

    /** À appeler avant connect() : renvoie un Intent non-null si l'autorisation VPN Android est requise. */
    fun prepareIntentOrNull(): Intent? = VpnService.prepare(context)

    suspend fun servers(): List<VpnServer> = repository.fetchServers()

    suspend fun connect(server: VpnServer): Boolean = withContext(Dispatchers.IO) {
        try {
            updateState(VpnConnectionState.CONNECTING, server = server)
            Log.i(TAG, "Connecting to ${server.id}")

            if (VpnService.prepare(context) != null) {
                updateState(VpnConnectionState.ERROR, error = VpnError.PERMISSION_DENIED)
                return@withContext false
            }

            val clientKeyPair = localKeyPair()
            val provision = repository.requestClientProvision(
                server,
                clientKeyPair.publicKey.toBase64()
            )

            if (provision == null) {
                Log.e(TAG, "Aucune configuration client disponible (backend non configuré ou erreur).")
                updateState(VpnConnectionState.ERROR, error = VpnError.INVALID_CONFIG)
                return@withContext false
            }

            val config = buildConfig(server, clientKeyPair, provision)
            backend.setState(tunnel, Tunnel.State.UP, config)

            updateState(
                VpnConnectionState.CONNECTED,
                server = server,
                connectedSinceMillis = System.currentTimeMillis(),
                vpnIp = provision.clientAddress
            )
            repository.markUserSession(server, connected = true)
            Log.i(TAG, "Tunnel established")
            true
        } catch (error: Exception) {
            Log.e(TAG, "connect() a échoué", error)
            updateState(
                VpnConnectionState.ERROR,
                error = classifyError(error)
            )
            false
        }
    }

    suspend fun disconnect(): Boolean = withContext(Dispatchers.IO) {
        try {
            updateState(VpnConnectionState.DISCONNECTING)
            Log.i(TAG, "Disconnecting")
            val previousServer = _status.value.server
            backend.setState(tunnel, Tunnel.State.DOWN, null)
            updateState(VpnConnectionState.DISCONNECTED)
            repository.markUserSession(null, connected = false)
            previousServer?.let { repository.revokeClientProvision(it) }
            Log.i(TAG, "Tunnel stopped")
            true
        } catch (error: Exception) {
            Log.e(TAG, "disconnect() a échoué", error)
            updateState(VpnConnectionState.ERROR, error = VpnError.UNKNOWN)
            false
        }
    }

    fun isConnected(): Boolean = _status.value.state == VpnConnectionState.CONNECTED

    fun currentStatus(): VpnStatus = _status.value

    private fun buildConfig(
        server: VpnServer,
        clientKeyPair: KeyPair,
        provision: VpnRepository.ClientProvision
    ): Config {
        val iface = Interface.Builder()
            .setKeyPair(clientKeyPair)
            .addAddress(InetNetwork.parse(provision.clientAddress))
            .apply { server.dns.forEach { addDnsServer(java.net.InetAddress.getByName(it)) } }
            .build()

        val peerBuilder = Peer.Builder()
            .setPublicKey(Key.fromBase64(server.publicKey))
            .setEndpoint(InetEndpoint.parse(server.endpoint))
            .apply { server.allowedIps.forEach { addAllowedIp(InetNetwork.parse(it)) } }

        provision.presharedKeyBase64?.let { peerBuilder.setPreSharedKey(Key.fromBase64(it)) }

        return Config.Builder()
            .setInterface(iface)
            .addPeer(peerBuilder.build())
            .build()
    }

    /**
     * Clé privée du DEVICE, générée une seule fois localement et jamais transmise
     * (seule la clé publique correspondante part vers le backend). Stockée en
     * SharedPreferences chiffrées (Android Keystore), jamais en clair, jamais loguée.
     */
    private fun localKeyPair(): KeyPair {
        val stored = prefs.getString(PREF_PRIVATE_KEY, null)
        if (stored != null) {
            return KeyPair(Key.fromBase64(stored))
        }
        val generated = KeyPair()
        prefs.edit().putString(PREF_PRIVATE_KEY, generated.privateKey.toBase64()).apply()
        return generated
    }

    private fun encryptedPrefs(): android.content.SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    private fun updateState(
        state: VpnConnectionState,
        server: VpnServer? = _status.value.server,
        connectedSinceMillis: Long? = if (state == VpnConnectionState.CONNECTED) _status.value.connectedSinceMillis else null,
        vpnIp: String? = if (state == VpnConnectionState.CONNECTED) _status.value.vpnIp else null,
        error: VpnError? = null
    ) {
        _status.value = VpnStatus(
            state = state,
            server = server,
            connectedSinceMillis = connectedSinceMillis,
            vpnIp = vpnIp,
            lastError = error
        )
    }

    private fun classifyError(error: Exception): VpnError = when {
        error is java.net.UnknownHostException || error is java.net.SocketTimeoutException ->
            VpnError.SERVER_UNREACHABLE
        error.message?.contains("permission", ignoreCase = true) == true ->
            VpnError.PERMISSION_DENIED
        else -> VpnError.UNKNOWN
    }

    /** Implémentation minimale de Tunnel requise par GoBackend. */
    private class SimpleTunnel(
        private val name: String,
        private val onStateChange: (Tunnel.State) -> Unit
    ) : Tunnel {
        override fun getName(): String = name
        override fun onStateChange(newState: Tunnel.State) = onStateChange.invoke(newState)
    }

    companion object {
        private const val TAG = "AETVPN"
        private const val NAME_TUNNEL = "aet-vpn"
        private const val PREFS_NAME = "aet_vpn_secure_prefs"
        private const val PREF_PRIVATE_KEY = "device_private_key"
    }
}
