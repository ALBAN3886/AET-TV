package com.albaneloh.iptv.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.albaneloh.iptv.MainActivity
import com.albaneloh.iptv.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch

/**
 * Service Android au premier plan, responsable UNIQUEMENT de :
 *  - afficher/mettre à jour la notification persistante "AET VPN" pendant que
 *    le tunnel est actif ;
 *  - garder le processus vivant en arrière-plan tant que le VPN est connecté.
 *
 * L'établissement réel du tunnel WireGuard (chiffrement, routage, etc.) est
 * entièrement délégué à WireGuardManager -> GoBackend (bibliothèque officielle) :
 * ce service ne manipule aucun paquet réseau lui-même et ne réimplémente aucune
 * partie du protocole WireGuard.
 */
class AetVpnService : Service() {

    private val scope = CoroutineScope(Dispatchers.Default + Job())
    private lateinit var wireGuardManager: WireGuardManager

    override fun onCreate() {
        super.onCreate()
        wireGuardManager = WireGuardManager(applicationContext)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_CONNECT -> {
                val server = intent.getStringExtra(EXTRA_SERVER_NAME).orEmpty()
                startForeground(NOTIFICATION_ID, buildNotification(connecting = true, serverLabel = server))
            }
            ACTION_DISCONNECT -> {
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_UPDATE_NOTIFICATION -> {
                val server = intent.getStringExtra(EXTRA_SERVER_NAME).orEmpty()
                startForeground(NOTIFICATION_ID, buildNotification(connecting = false, serverLabel = server))
            }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun buildNotification(connecting: Boolean, serverLabel: String): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val disconnectIntent = PendingIntent.getService(
            this,
            0,
            Intent(this, AetVpnService::class.java).setAction(ACTION_DISCONNECT),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val statusText = if (connecting) {
            "Connexion en cours…"
        } else {
            "Connecté${if (serverLabel.isNotBlank()) " — $serverLabel" else ""}"
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("AET VPN")
            .setContentText(if (connecting) statusText else "🟢 $statusText")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(contentIntent)
            .addAction(0, "Déconnecter", disconnectIntent)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "AET VPN",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "État de la connexion AET VPN"
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "aet_vpn_status"
        private const val NOTIFICATION_ID = 4271

        const val ACTION_CONNECT = "com.albaneloh.iptv.vpn.action.CONNECT"
        const val ACTION_DISCONNECT = "com.albaneloh.iptv.vpn.action.DISCONNECT"
        const val ACTION_UPDATE_NOTIFICATION = "com.albaneloh.iptv.vpn.action.UPDATE"
        private const val EXTRA_SERVER_NAME = "extra_server_name"

        fun start(context: Context, serverLabel: String) {
            val intent = Intent(context, AetVpnService::class.java)
                .setAction(ACTION_CONNECT)
                .putExtra(EXTRA_SERVER_NAME, serverLabel)
            context.startForegroundService(intent)
        }

        fun updateConnected(context: Context, serverLabel: String) {
            val intent = Intent(context, AetVpnService::class.java)
                .setAction(ACTION_UPDATE_NOTIFICATION)
                .putExtra(EXTRA_SERVER_NAME, serverLabel)
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.startService(Intent(context, AetVpnService::class.java).setAction(ACTION_DISCONNECT))
        }
    }
}

private fun CoroutineScope.cancel() {
    (coroutineContext[Job])?.cancel()
}
