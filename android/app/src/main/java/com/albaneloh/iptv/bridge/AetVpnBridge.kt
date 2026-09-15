package com.albaneloh.iptv.bridge

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import com.albaneloh.iptv.vpn.AetVpnService
import com.albaneloh.iptv.vpn.VpnConnectionState
import com.albaneloh.iptv.vpn.VpnServer
import com.albaneloh.iptv.vpn.VpnStatus
import com.albaneloh.iptv.vpn.WireGuardManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

/**
 * Pont exposé à la WebView sous le nom JavaScript "AetVpnAndroid".
 *
 * Surface volontairement restreinte (principe du moindre privilège) :
 * aucune méthode ne permet d'accéder à un shell, un fichier arbitraire, une
 * clé privée ou une commande système. Chaque méthode ne fait qu'orchestrer
 * WireGuardManager et renvoyer un état simple au JavaScript.
 *
 * Toute erreur est renvoyée sous forme de message utilisateur (jamais de
 * stack trace) ; les détails techniques restent dans Logcat (tag AETVPN).
 */
class AetVpnBridge(
    private val context: Context,
    private val onPermissionRequired: (Intent, String) -> Unit,
    private val onStatusChanged: ((JSONObject) -> Unit)? = null
) {
    private val manager = WireGuardManager(context)
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun connectVpn(serverId: String) {
        scope.launch {
            val servers = manager.servers()
            val server = servers.firstOrNull { it.id == serverId }
            if (server == null) {
                Log.e(TAG, "connectVpn: serveur inconnu $serverId")
                notifyStatus(manager.currentStatus())
                return@launch
            }

            val prepareIntent = manager.prepareIntentOrNull()
            if (prepareIntent != null) {
                Log.i(TAG, "Requesting VPN permission")
                mainHandler.post { onPermissionRequired(prepareIntent, serverId) }
                return@launch
            }

            AetVpnService.start(context, server.name)
            val success = manager.connect(server)
            if (success) {
                AetVpnService.updateConnected(context, server.name)
            } else {
                AetVpnService.stop(context)
            }
            notifyStatus(manager.currentStatus())
        }
    }

    /** À appeler par MainActivity une fois l'utilisateur revenu du dialogue d'autorisation VPN Android. */
    fun onVpnPermissionResult(granted: Boolean, serverId: String) {
        if (!granted) {
            Log.w(TAG, "Autorisation VPN refusée par l'utilisateur")
            notifyStatus(manager.currentStatus())
            return
        }
        connectVpn(serverId)
    }

    @JavascriptInterface
    fun disconnectVpn() {
        scope.launch {
            manager.disconnect()
            AetVpnService.stop(context)
            notifyStatus(manager.currentStatus())
        }
    }

    @JavascriptInterface
    fun isVpnConnected(): Boolean = manager.isConnected()

    @JavascriptInterface
    fun getVpnStatus(): String = statusToJson(manager.currentStatus()).toString()

    @JavascriptInterface
    fun getCurrentServer(): String {
        val server = manager.currentStatus().server ?: return "null"
        return server.toPublicJson().toString()
    }

    @JavascriptInterface
    fun getVpnIp(): String = manager.currentStatus().vpnIp ?: ""

    @JavascriptInterface
    fun getConnectionDuration(): Long = manager.currentStatus().connectionDurationSeconds

    @JavascriptInterface
    fun getServers(): String {
        // Renvoie un cache immédiat vide si rien n'est encore chargé ; le JS doit
        // écouter l'évènement de statut ou rappeler après un court délai.
        // On lance aussi un rafraîchissement asynchrone pour les appels suivants.
        scope.launch {
            val servers = manager.servers()
            mainHandler.post {
                onStatusChanged?.invoke(JSONObject().apply {
                    put("type", "servers")
                    put("servers", JSONArray(servers.map { it.toPublicJson() }))
                })
            }
        }
        return "[]"
    }

    private fun notifyStatus(status: VpnStatus) {
        mainHandler.post { onStatusChanged?.invoke(statusToJson(status)) }
    }

    private fun statusToJson(status: VpnStatus): JSONObject = JSONObject().apply {
        put("type", "status")
        put("state", status.state.name)
        put("server", status.server?.toPublicJson())
        put("vpnIp", status.vpnIp)
        put("durationSeconds", status.connectionDurationSeconds)
        put("error", status.lastError?.messageForUser)
    }

    companion object {
        private const val TAG = "AETVPN"
    }
}
