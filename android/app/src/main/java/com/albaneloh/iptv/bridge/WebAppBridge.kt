package com.albaneloh.iptv.bridge

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import com.albaneloh.iptv.model.PlayerRequest

class WebAppBridge(
    private val onPlayRequested: (PlayerRequest) -> Unit
) {

    private val mainHandler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun openPlayer(payloadJson: String) {
        runCatching {
            PlayerRequest.fromJson(payloadJson)
        }.onSuccess { request ->
            mainHandler.post { onPlayRequested(request) }
        }.onFailure { error ->
            Log.e(TAG, "Bridge JS -> Android invalide", error)
        }
    }

    companion object {
        private const val TAG = "WebAppBridge"
    }
}
