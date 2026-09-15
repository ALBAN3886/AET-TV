package com.albaneloh.iptv.vpn

import org.json.JSONObject

/**
 * Représentation d'un serveur AET VPN, telle que publiée dans Firestore
 * (collection `vpnServers`). Ce modèle ne contient QUE des informations
 * publiques d'un serveur WireGuard : sa clé publique, son adresse, son port.
 *
 * IMPORTANT SÉCURITÉ :
 * - Aucune clé privée serveur ne doit jamais transiter par ce modèle.
 * - `publicKey` est la clé PUBLIQUE du serveur : elle est sans danger à exposer,
 *   au même titre qu'une adresse IP.
 */
data class VpnServer(
    val id: String,
    val name: String,
    val country: String,
    val countryCode: String,
    val flag: String,
    val host: String,
    val port: Int,
    val publicKey: String,
    val dns: List<String> = listOf("1.1.1.1", "1.0.0.1"),
    val allowedIps: List<String> = listOf("0.0.0.0/0", "::/0"),
    val active: Boolean = true,
    val serverLoad: Int = 0,
    val latencyMs: Int? = null,
    val protocol: String = "wireguard",
    val description: String = ""
) {
    val endpoint: String get() = "$host:$port"

    companion object {
        fun fromFirestore(id: String, data: Map<String, Any?>): VpnServer? {
            val host = data["host"] as? String ?: return null
            val publicKey = data["publicKey"] as? String ?: return null
            val port = (data["port"] as? Number)?.toInt() ?: 51820

            @Suppress("UNCHECKED_CAST")
            val dns = (data["dns"] as? List<String>)?.takeIf { it.isNotEmpty() }
                ?: listOf("1.1.1.1", "1.0.0.1")

            @Suppress("UNCHECKED_CAST")
            val allowedIps = (data["allowedIps"] as? List<String>)?.takeIf { it.isNotEmpty() }
                ?: listOf("0.0.0.0/0", "::/0")

            return VpnServer(
                id = id,
                name = data["name"] as? String ?: id,
                country = data["country"] as? String ?: "",
                countryCode = (data["countryCode"] as? String ?: "").uppercase(),
                flag = data["flag"] as? String ?: "",
                host = host,
                port = port,
                publicKey = publicKey,
                dns = dns,
                allowedIps = allowedIps,
                active = data["active"] as? Boolean ?: true,
                serverLoad = (data["serverLoad"] as? Number)?.toInt() ?: 0,
                latencyMs = (data["latencyMs"] as? Number)?.toInt(),
                protocol = data["protocol"] as? String ?: "wireguard",
                description = data["description"] as? String ?: ""
            )
        }
    }

    /** Sérialisation utilisée uniquement pour renvoyer la liste des serveurs au JavaScript. */
    fun toPublicJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("name", name)
        put("country", country)
        put("countryCode", countryCode)
        put("flag", flag)
        put("active", active)
        put("serverLoad", serverLoad)
        put("latencyMs", latencyMs)
        put("protocol", protocol)
        put("description", description)
        // Volontairement absent du JSON exposé à la WebView : host, port, publicKey, dns, allowedIps.
        // La WebView n'a besoin que d'afficher la liste ; la connexion réelle est pilotée
        // côté natif via connectVpn(serverId).
    }
}
