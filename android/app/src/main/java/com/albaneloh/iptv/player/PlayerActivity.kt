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
import androidx.recyclerview.widget.LinearLayoutManager
import com.albaneloh.iptv.model.PlayerRequest

@UnstableApi
class PlayerActivity : AppCompatActivity(), IptvPlayerManager.Callback {

    private lateinit var binding: ActivityPlayerBinding
    private var request: PlayerRequest = PlayerRequest("", "", "")
    private lateinit var playerManager: IptvPlayerManager
    private lateinit var connectivityManager: ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var immersiveEnabled = true
    private var channelAdapter: ChannelAdapter? = null
    private var channelIndex: Int = 0

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

        channelIndex = request.channelIndex
        applyChannelInfo(request)
        bindUi()
        setupChannelPanel()
        toggleImmersiveMode(true)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.channelPanel.visibility == android.view.View.VISIBLE) {
                    toggleChannelPanel(false)
                } else {
                    finish()
                }
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

        buttonChannels.setOnClickListener {
            toggleChannelPanel(channelPanel.visibility != android.view.View.VISIBLE)
        }

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

    private fun setupChannelPanel() {
        val list = request.channels
        if (list.isEmpty()) return
        val adapter = ChannelAdapter(list) { position -> playChannelAt(position) }
        adapter.updateCurrent(channelIndex)
        binding.channelRecycler.layoutManager = LinearLayoutManager(this)
        binding.channelRecycler.adapter = adapter
        binding.channelRecycler.scrollToPosition(channelIndex)
        channelAdapter = adapter
        binding.textPanelTitle.text = "Chaines (" + list.size + ")"
    }

    private fun toggleChannelPanel(show: Boolean) {
        if (request.channels.isEmpty()) return
        binding.channelPanel.visibility =
            if (show) android.view.View.VISIBLE else android.view.View.GONE
        if (show) binding.channelRecycler.scrollToPosition(channelIndex)
    }

    private fun playChannelAt(position: Int) {
        val list = request.channels
        if (position !in list.indices) return
        val channel = list[position]
        val headers = linkedMapOf<String, String>()
        if (channel.userAgent.isNotBlank()) headers["User-Agent"] = channel.userAgent
        if (channel.referer.isNotBlank()) headers["Referer"] = channel.referer
        channelIndex = position
        request = request.copy(
            url = channel.url,
            title = channel.name,
            channelName = channel.name,
            channelGroup = channel.group,
            headers = if (headers.isEmpty()) request.headers else headers,
            channelIndex = position
        )
        channelAdapter?.updateCurrent(position)
        applyChannelInfo(request)
        playerManager.play(request)
        toggleChannelPanel(false)
    }

    private fun changeChannel(delta: Int) {
        val list = request.channels
        if (list.isEmpty()) return
        var next = channelIndex + delta
        if (next < 0) next = list.size - 1
        if (next >= list.size) next = 0
        playChannelAt(next)
    }


    override fun onKeyDown(keyCode: Int, event: android.view.KeyEvent?): Boolean {
        if (request.channels.isEmpty()) return super.onKeyDown(keyCode, event)
        val panelOpen = binding.channelPanel.visibility == android.view.View.VISIBLE
        return when (keyCode) {
            android.view.KeyEvent.KEYCODE_CHANNEL_UP -> {
                changeChannel(-1); true
            }
            android.view.KeyEvent.KEYCODE_CHANNEL_DOWN -> {
                changeChannel(1); true
            }
            android.view.KeyEvent.KEYCODE_DPAD_LEFT -> {
                if (!panelOpen) { toggleChannelPanel(true); true }
                else super.onKeyDown(keyCode, event)
            }
            android.view.KeyEvent.KEYCODE_MENU -> {
                toggleChannelPanel(!panelOpen); true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }

}
