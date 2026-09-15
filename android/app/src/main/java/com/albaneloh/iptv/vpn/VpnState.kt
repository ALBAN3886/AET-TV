package com.albaneloh.iptv.vpn

/**
 * Machine d'état du tunnel AET VPN. L'UI (JavaScript) ne doit jamais afficher
 * "Connecté" avant que l'état réel ne soit CONNECTED.
 */
enum class VpnConnectionState {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    DISCONNECTING,
    RECONNECTING,
    ERROR
}

/**
 * Erreurs utilisateur (jamais de stack trace ou de détail technique exposé au JS).
 * Le détail technique reste dans les logs développeur (Log.e / Log.w, tag "AETVPN").
 */
enum class VpnError(val messageForUser: String) {
    PERMISSION_DENIED("Autorisation VPN refusée."),
    SERVER_UNREACHABLE("Le serveur est temporairement indisponible."),
    NO_INTERNET("Connexion Internet indisponible."),
    INVALID_CONFIG("Configuration VPN invalide."),
    CONNECTION_LOST("Connexion interrompue."),
    UNKNOWN("Impossible de se connecter au serveur.")
}

data class VpnStatus(
    val state: VpnConnectionState,
    val server: VpnServer? = null,
    val connectedSinceMillis: Long? = null,
    val vpnIp: String? = null,
    val lastError: VpnError? = null
) {
    val connectionDurationSeconds: Long
        get() {
            val since = connectedSinceMillis ?: return 0L
            if (state != VpnConnectionState.CONNECTED) return 0L
            return ((System.currentTimeMillis() - since) / 1000L).coerceAtLeast(0L)
        }
}
