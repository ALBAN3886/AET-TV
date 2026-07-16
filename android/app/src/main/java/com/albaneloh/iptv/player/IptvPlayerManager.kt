package com.albaneloh.iptv.player

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.util.UnstableApi
import androidx.media3.database.StandaloneDatabaseProvider
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.cache.CacheDataSource
import androidx.media3.datasource.cache.LeastRecentlyUsedCacheEvictor
import androidx.media3.datasource.cache.SimpleCache
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.exoplayer.upstream.LoadErrorHandlingPolicy.LoadErrorInfo
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.PlayerView
import com.albaneloh.iptv.model.PlayerRequest
import java.io.File
import java.util.Locale
import kotlin.math.min

@UnstableApi
class IptvPlayerManager(
    context: Context,
    private val callback: Callback
) {

    interface Callback {
        fun onBuffering(isBuffering: Boolean)
        fun onPlayStateChanged(isPlaying: Boolean)
        fun onStatusChanged(status: String)
        fun onPlayerError(message: String)
    }

    data class QualityOption(
        val label: String,
        val trackGroup: TrackGroup? = null,
        val trackIndex: Int? = null,
        val height: Int = 0
    )

    private val appContext = context.applicationContext
    private val trackSelector = DefaultTrackSelector(appContext)
    private var playerView: PlayerView? = null
    private var player: ExoPlayer? = null
    private var lastRequest: PlayerRequest? = null
    private var lastPositionMs: Long = 0L
    private var shouldResumeAfterReconnect = false

    fun attach(playerView: PlayerView) {
        this.playerView = playerView
        this.playerView?.player = player
    }

    fun startIfNeeded(request: PlayerRequest) {
        if (player == null) {
            player = buildPlayer().also { playerView?.player = it }
        }

        if (lastRequest?.url != request.url) {
            play(request)
        } else {
            player?.playWhenReady = true
            callback.onPlayStateChanged(true)
        }
    }

    fun play(request: PlayerRequest, seekToMs: Long = 0L) {
        val exoPlayer = player ?: buildPlayer().also {
            player = it
            playerView?.player = it
        }

        lastRequest = request
        lastPositionMs = seekToMs
        shouldResumeAfterReconnect = false

        val mediaSourceFactory = DefaultMediaSourceFactory(buildDataSourceFactory(request))
            .setLoadErrorHandlingPolicy(object : DefaultLoadErrorHandlingPolicy() {
                override fun getRetryDelayMsFor(loadErrorInfo: LoadErrorInfo): Long {
                    return if (loadErrorInfo.errorCount < 5) {
                        min(loadErrorInfo.errorCount * 2_000L, 10_000L)
                    } else {
                        C.TIME_UNSET
                    }
                }

                override fun getMinimumLoadableRetryCount(dataType: Int): Int = 5
            })

        val mediaItem = buildMediaItem(request)
        val mediaSource = mediaSourceFactory.createMediaSource(mediaItem)

        exoPlayer.setMediaSource(mediaSource)
        exoPlayer.prepare()
        if (seekToMs > 0L) {
            exoPlayer.seekTo(seekToMs)
        }
        exoPlayer.playWhenReady = true
        callback.onStatusChanged("Connexion au flux…")
    }

    fun togglePlayback() {
        player?.let {
            it.playWhenReady = !it.isPlaying
            callback.onPlayStateChanged(it.playWhenReady)
        }
    }

    fun retry() {
        val request = lastRequest ?: return
        play(request, lastPositionMs)
    }

    fun pauseKeepingPosition() {
        player?.let {
            lastPositionMs = it.currentPosition
            it.pause()
        }
    }

    fun onNetworkLost() {
        val exoPlayer = player ?: return
        if (exoPlayer.isPlaying || exoPlayer.playbackState == Player.STATE_BUFFERING) {
            shouldResumeAfterReconnect = true
            lastPositionMs = exoPlayer.currentPosition
            callback.onStatusChanged("Réseau perdu — reprise automatique en attente…")
        }
    }

    fun onNetworkAvailable() {
        if (shouldResumeAfterReconnect) {
            shouldResumeAfterReconnect = false
            callback.onStatusChanged("Réseau rétabli — reprise…")
            retry()
        }
    }

    fun getQualityOptions(): List<QualityOption> {
        val exoPlayer = player ?: return listOf(QualityOption("Auto"))
        val options = mutableListOf(QualityOption("Auto"))

        exoPlayer.currentTracks.groups.forEach { group ->
            if (group.type != C.TRACK_TYPE_VIDEO) return@forEach
            val trackGroup = group.mediaTrackGroup
            for (index in 0 until trackGroup.length) {
                val format = trackGroup.getFormat(index)
                val height = format.height.takeIf { it > 0 } ?: 0
                val bitrate = format.bitrate.takeIf { it > 0 } ?: 0
                val label = buildString {
                    append(if (height > 0) "${height}p" else "Vidéo")
                    if (bitrate > 0) append(" • ${bitrate / 1000} kbps")
                }
                options += QualityOption(
                    label = label,
                    trackGroup = trackGroup,
                    trackIndex = index,
                    height = height
                )
            }
        }

        return options
            .distinctBy { it.label }
            .sortedWith(compareByDescending<QualityOption> { it.height }.thenBy { it.label })
            .let { listOf(QualityOption("Auto")) + it.filterNot { item -> item.label == "Auto" } }
    }

    fun selectQuality(option: QualityOption) {
        val builder = trackSelector.parameters.buildUpon()
        builder.clearOverridesOfType(C.TRACK_TYPE_VIDEO)

        if (option.trackGroup != null && option.trackIndex != null) {
            builder.setOverrideForType(
                TrackSelectionOverride(option.trackGroup, listOf(option.trackIndex))
            )
        }

        trackSelector.parameters = builder.build()
        callback.onStatusChanged("Qualité: ${option.label}")
    }

    fun isPlaying(): Boolean = player?.isPlaying == true

    fun release() {
        playerView?.player = null
        player?.release()
        player = null
    }

    private fun buildPlayer(): ExoPlayer {
        return ExoPlayer.Builder(appContext)
            .setTrackSelector(trackSelector)
            .setSeekBackIncrementMs(15_000)
            .setSeekForwardIncrementMs(30_000)
            .build()
            .also { exoPlayer ->
                exoPlayer.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        when (playbackState) {
                            Player.STATE_IDLE -> callback.onStatusChanged("En attente")
                            Player.STATE_BUFFERING -> {
                                callback.onBuffering(true)
                                callback.onStatusChanged("Mise en mémoire tampon…")
                            }
                            Player.STATE_READY -> {
                                callback.onBuffering(false)
                                callback.onStatusChanged("Lecture en direct")
                            }
                            Player.STATE_ENDED -> callback.onStatusChanged("Flux terminé")
                        }
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        callback.onPlayStateChanged(isPlaying)
                        if (isPlaying) {
                            callback.onBuffering(false)
                            callback.onStatusChanged("Lecture en direct")
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        callback.onBuffering(false)
                        lastPositionMs = player?.currentPosition ?: 0L
                        val isNetworkError = error.errorCode in setOf(
                            PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
                            PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
                            PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
                            PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,
                            PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE
                        )

                        if (isNetworkError) {
                            shouldResumeAfterReconnect = true
                            callback.onStatusChanged("Erreur réseau — nouvelle tentative automatique…")
                        } else {
                            callback.onStatusChanged("Erreur de lecture")
                        }

                        callback.onPlayerError(errorMessage(error))
                    }
                })
            }
    }

    private fun buildMediaItem(request: PlayerRequest): MediaItem {
        val url = request.url.lowercase(Locale.US)
        val mimeType = when {
            ".m3u8" in url -> MimeTypes.APPLICATION_M3U8
            url.contains(".ts") -> MimeTypes.VIDEO_MP2T
            url.contains(".mp4") -> MimeTypes.VIDEO_MP4
            else -> null
        }

        val metadata = MediaMetadata.Builder()
            .setTitle(request.channelName)
            .setDisplayTitle(request.title)
            .setGenre(request.channelGroup)
            .build()

        return MediaItem.Builder()
            .setUri(request.url)
            .setMediaMetadata(metadata)
            .apply {
                if (mimeType != null) setMimeType(mimeType)
            }
            .build()
    }

    private fun buildDataSourceFactory(request: PlayerRequest): DataSource.Factory {
        val headers = linkedMapOf<String, String>()
        headers.putAll(request.headers)

        if (!request.cookie.isNullOrBlank() && !headers.containsKey("Cookie")) {
            headers["Cookie"] = request.cookie
        }

        val userAgent = headers["User-Agent"] ?: "AlbanElohIPTV/1.0 (Media3)"

        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent(userAgent)
            .setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(30_000)
            .setKeepPostFor302Redirects(true)
            .setDefaultRequestProperties(headers)

        val upstream = DefaultDataSource.Factory(appContext, httpFactory)
        val resolvingFactory = ResolvingDataSource.Factory(upstream) { dataSpec ->
            dataSpec.withRequestHeaders(headers)
        }

        return CacheDataSource.Factory()
            .setCache(getCache(appContext))
            .setUpstreamDataSourceFactory(resolvingFactory)
            .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR)
    }

    private fun errorMessage(error: PlaybackException): String {
        return when (error.errorCode) {
            PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED -> "Connexion réseau impossible"
            PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT -> "Le flux ne répond pas à temps"
            PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS -> "Le serveur du flux a refusé la requête"
            PlaybackException.ERROR_CODE_IO_INVALID_HTTP_CONTENT_TYPE -> "Type de contenu non pris en charge"
            PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED -> "Flux vidéo mal formé"
            else -> error.localizedMessage ?: "Erreur inconnue du lecteur"
        }
    }

    companion object {
        @Volatile
        private var cache: SimpleCache? = null

        private fun getCache(context: Context): SimpleCache {
            return cache ?: synchronized(this) {
                cache ?: SimpleCache(
                    File(context.cacheDir, "media3_stream_cache"),
                    LeastRecentlyUsedCacheEvictor(256L * 1024L * 1024L),
                    StandaloneDatabaseProvider(context)
                ).also { cache = it }
            }
        }
    }
}
