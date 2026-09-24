package com.albaneloh.iptv.vpn

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.tasks.await
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.TimeUnit

/**
 * Accès aux données AET VPN.
 *
 * - La liste des serveurs vient de Firestore (`vpnServers`), lisible par tout
 *   utilisateur authentifié, mais jamais modifiable depuis l'app (règles Firestore
 *   côté serveur : voir docs/VPN_INTEGRATION.md).
 * - La génération de la configuration client (adresse tunnel attribuée, clé
 *   publique du serveur, éventuelle preshared key) est déléguée à un backend
 *   AET sécurisé : l'app ne calcule ni ne devine jamais ces valeurs elle-même.
 *   Elle envoie uniquement sa clé PUBLIQUE, jamais sa clé privée.
 */
class VpnRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    /**
     * Endpoint HTTPS du backend AET responsable de l'attribution d'IP tunnel
     * (Cloud Function `provisionVpnClient`, voir /functions/index.js).
     * Fonction HTTPS 1ère génération => URL prévisible ; si vous migrez vers
     * la 2ème génération, remplacez par l'URL réelle affichée après déploiement.
     */
    private val provisionEndpoint: String = "https://us-central1-aet-tv-5d58c.cloudfunctions.net/provisionVpnClient",
    private val revokeEndpoint: String = "https://us-central1-aet-tv-5d58c.cloudfunctions.net/revokeVpnClient"
) {

    /**
     * Firestore refuse la lecture de vpnServers sans utilisateur Firebase.
     * La session anonyme native est distincte de la session du site WebView.
     */
    private suspend fun ensureAuthenticated(): Boolean {
        if (auth.currentUser != null) return true

        return try {
            auth.signInAnonymously().await()
            auth.currentUser != null
        } catch (error: Exception) {
            Log.e(TAG, "Authentification Firebase anonyme impossible", error)
            false
        }
    }

    suspend fun fetchServers(): List<VpnServer> {
        if (!ensureAuthenticated()) {
            Log.e(TAG, "fetchServers annulé : utilisateur non authentifié")
            return emptyList()
        }

        return try {
            val snapshot = firestore.collection("vpnServers")
                .whereEqualTo("active", true)
                .get()
                .await()

            snapshot.documents.mapNotNull { doc ->
                VpnServer.fromFirestore(doc.id, doc.data ?: emptyMap())
            }
        } catch (error: Exception) {
            Log.e(TAG, "fetchServers a échoué", error)
            emptyList()
        }
    }

    /**
     * Demande au backend AET les paramètres tunnel spécifiques à ce client pour
     * le serveur choisi (adresse IP interne, éventuelle preshared key).
     * Ne renvoie jamais la clé privée serveur ; ne transmet jamais la clé privée client.
     */
    suspend fun requestClientProvision(server: VpnServer, clientPublicKeyBase64: String): ClientProvision? {
        if (provisionEndpoint.isBlank()) {
            Log.w(TAG, "provisionEndpoint non configuré : impossible de provisionner un tunnel réel.")
            return null
        }

        val idToken = try {
            auth.currentUser?.getIdToken(false)?.await()?.token
        } catch (error: Exception) {
            Log.e(TAG, "Impossible de récupérer le token Firebase Auth", error)
            null
        } ?: return null

        return try {
            val body = JSONObject().apply {
                put("serverId", server.id)
                put("clientPublicKey", clientPublicKeyBase64)
            }

            val url = URL(provisionEndpoint)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = TimeUnit.SECONDS.toMillis(10).toInt()
                readTimeout = TimeUnit.SECONDS.toMillis(10).toInt()
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Authorization", "Bearer $idToken")
            }

            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }

            if (connection.responseCode !in 200..299) {
                Log.e(TAG, "Provision backend HTTP ${connection.responseCode}")
                return null
            }

            val response = BufferedReader(InputStreamReader(connection.inputStream, Charsets.UTF_8))
                .use { it.readText() }
            val json = JSONObject(response)

            ClientProvision(
                clientAddress = json.getString("clientAddress"),
                presharedKeyBase64 = json.optString("presharedKey").ifBlank { null }
            )
        } catch (error: Exception) {
            // Ne jamais logger le corps de la réponse (pourrait contenir des infos sensibles).
            Log.e(TAG, "requestClientProvision a échoué", error)
            null
        }
    }

    /**
     * Signale au backend qu'un client se déconnecte : l'agent serveur retirera
     * alors le peer correspondant. Best-effort : un échec ici n'empêche jamais
     * la déconnexion locale du tunnel (WireGuardManager s'en charge dans tous
     * les cas via GoBackend, indépendamment de ce signal réseau).
     */
    suspend fun revokeClientProvision(server: VpnServer) {
        if (revokeEndpoint.isBlank()) return
        val idToken = try {
            auth.currentUser?.getIdToken(false)?.await()?.token
        } catch (error: Exception) {
            null
        } ?: return

        try {
            val body = JSONObject().apply { put("serverId", server.id) }
            val connection = (URL(revokeEndpoint).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                connectTimeout = TimeUnit.SECONDS.toMillis(6).toInt()
                readTimeout = TimeUnit.SECONDS.toMillis(6).toInt()
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
                setRequestProperty("Authorization", "Bearer $idToken")
            }
            OutputStreamWriter(connection.outputStream, Charsets.UTF_8).use { it.write(body.toString()) }
            connection.responseCode // force l'exécution de la requête
        } catch (error: Exception) {
            Log.w(TAG, "revokeClientProvision a échoué (non bloquant)", error)
        }
    }

    suspend fun markUserSession(server: VpnServer?, connected: Boolean) {
        val uid = auth.currentUser?.uid ?: return
        try {
            val data = mutableMapOf<String, Any?>(
                "vpnEnabled" to connected,
                "lastConnection" to System.currentTimeMillis()
            )
            if (connected && server != null) {
                data["currentServer"] = server.id
            }
            firestore.collection("vpnUsers").document(uid)
                .set(data, com.google.firebase.firestore.SetOptions.merge())
                .await()
        } catch (error: Exception) {
            Log.e(TAG, "markUserSession a échoué", error)
        }
    }

    data class ClientProvision(
        val clientAddress: String,
        val presharedKeyBase64: String?
    )

    companion object {
        private const val TAG = "AETVPN"
    }
}
