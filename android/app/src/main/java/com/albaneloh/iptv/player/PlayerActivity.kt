package com.albaneloh.iptv.player

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.os.Bundle
import android.view.View
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.isVisible
import androidx.media3.common.util.UnstableApi
import com.albaneloh.iptv.databinding.ActivityPlayerBinding
import com.albaneloh.iptv.model.PlayerRequest

@UnstableApi
class PlayerActivity : AppCompatActivity(), IptvPlayerManager.Callback {

    private lateinit var binding: ActivityPlayerBinding
    private lateinit var request: PlayerRequest
    private lateinit var playerManager: IptvPlayerManager
    private lateinit var connectivityManager: ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var immersiveEnabled = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityPlayerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        @Suppress("DEPRECATION")
        request = requireNotNull(intent.getParcelableExtra(EXTRA_REQUEST)) {
            "PlayerRequest manquant"
        }

        connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        playerManager = IptvPlayerManager(this, this)
        playerManager.attach(binding.playerView)

        applyChannelInfo(request)
        bindUi()
        toggleImmersiveMode(true)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                finish()
            }
        })
    }

    override fun onStart() {
        super.onStart()
        registerNetworkCallback()
        playerManager.startIfNeeded(request)
    }

    override fun onResume() {
        super.onResume()
        toggleImmersiveMode(immersiveEnabled)
    }

    override fun onPause() {
        playerManager.pauseKeepingPosition()
        super.onPause()
    }

    override fun onStop() {
        unregisterNetworkCallback()
        super.onStop()
    }

    override fun onDestroy() {
        playerManager.release()
        super.onDestroy()
    }

    private fun bindUi() = with(binding) {
        buttonBack.setOnClickListener { finish() }

        buttonPlayPause.setOnClickListener {
            playerManager.togglePlayback()
            syncPlayPauseIcon(playerManager.isPlaying())
        }

        buttonRetry.setOnClickListener {
            playerManager.retry()
        }

        buttonQuality.setOnClickListener {
            showQualityDialog()
        }

        buttonFullscreen.setOnClickListener {
            immersiveEnabled = !immersiveEnabled
            toggleImmersiveMode(immersiveEnabled)
        }

        playerOverlay.setOnClickListener {
            controlsContainer.visibility =
                if (controlsContainer.isVisible) View.GONE else View.VISIBLE
        }
    }

    private fun applyChannelInfo(request: PlayerRequest) = with(binding) {
        textChannelTitle.text = request.channelName
        textChannelGroup.text = buildString {
            append(request.channelGroup.ifBlank { "Live" })
            if (request.streamType.isNotBlank()) {
                append(" • ")
                append(request.streamType.uppercase())
            }
        }
    }

    private fun showQualityDialog() {
        val options = playerManager.getQualityOptions()
        val labels = options.map { it.label }.toTypedArray()

        AlertDialog.Builder(this)
            .setTitle("Choisir la qualité")
            .setItems(labels) { _, which ->
                playerManager.selectQuality(options[which])
            }
            .show()
    }

    private fun registerNetworkCallback() {
        if (networkCallback != null) return

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                playerManager.onNetworkAvailable()
            }

            override fun onLost(network: Network) {
                playerManager.onNetworkLost()
            }
        }

        connectivityManager.registerDefaultNetworkCallback(requireNotNull(networkCallback))
    }

    private fun unregisterNetworkCallback() {
        networkCallback?.let { callback ->
            runCatching { connectivityManager.unregisterNetworkCallback(callback) }
            networkCallback = null
        }
    }

    private fun toggleImmersiveMode(enabled: Boolean) {
        immersiveEnabled = enabled
        window.decorView.systemUiVisibility = if (enabled) {
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        } else {
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        }
    }

    private fun syncPlayPauseIcon(isPlaying: Boolean) {
        binding.buttonPlayPause.setImageResource(
            if (isPlaying) android.R.drawable.ic_media_pause
            else android.R.drawable.ic_media_play
        )
    }

    override fun onBuffering(isBuffering: Boolean) {
        binding.progressBar.isVisible = isBuffering
    }

    override fun onPlayStateChanged(isPlaying: Boolean) {
        syncPlayPauseIcon(isPlaying)
    }

    override fun onStatusChanged(status: String) {
        binding.textStatus.text = status
    }

    override fun onPlayerError(message: String) {
        binding.textStatus.text = message
    }

    companion object {
        private const val EXTRA_REQUEST = "extra_request"

        fun newIntent(context: Context, request: PlayerRequest): Intent {
            return Intent(context, PlayerActivity::class.java)
                .putExtra(EXTRA_REQUEST, request)
        }
    }
}
