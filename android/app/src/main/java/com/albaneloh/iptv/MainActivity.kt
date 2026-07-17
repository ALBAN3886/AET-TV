package com.albaneloh.iptv

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import com.albaneloh.iptv.bridge.WebAppBridge
import com.albaneloh.iptv.databinding.ActivityMainBinding
import com.albaneloh.iptv.model.PlayerRequest
import com.albaneloh.iptv.player.PlayerActivity

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding

    /**
     * Remplacez cette URL si votre interface est hébergée à distance.
     * Si vous gardez le fichier local, placez index-204.html dans app/src/main/assets/web/
     */
    private val startUrl = "https://alban3886.github.io/AET-TV/?"

    /**
     * URL de secours locale, utilisée si le chargement en ligne échoue (pas de réseau).
     */
    private val fallbackUrl = "file:///android_asset/web/index-204.html"

    /**
     * N'injectez le bridge que sur vos pages de confiance.
     */
    private val trustedHosts = setOf(
        "alban3886.github.io"
    )

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        CrashLogger.install(this)
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        showLastCrashIfAny()

        setupWebView()

        if (savedInstanceState == null) {
            val bustCache = "${startUrl}?v=${System.currentTimeMillis()}"
            binding.webView.loadUrl(bustCache)
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (binding.webView.canGoBack()) {
                    binding.webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() = with(binding.webView) {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.loadsImagesAutomatically = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true
        settings.userAgentString = settings.userAgentString + " AlbanElohIPTV/$APP_BUILD_VERSION"
        settings.cacheMode = WebSettings.LOAD_NO_CACHE

        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

        addJavascriptInterface(
            WebAppBridge(::openNativePlayer),
            JS_BRIDGE_NAME
        )

        webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                return super.onConsoleMessage(consoleMessage)
            }
        }

        webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url ?: return false
                return handleSpecialSchemes(url)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: android.webkit.WebResourceError?
            ) {
                super.onReceivedError(view, request, error)
                if (request?.isForMainFrame == true && view?.url != fallbackUrl) {
                    view?.loadUrl(fallbackUrl)
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (shouldInjectBridge(url)) {
                    injectBridgeJavascript()
                }
            }
        }
    }

    private fun showLastCrashIfAny() {
        val trace = CrashLogger.readLastCrashAndClear(this) ?: return
        AlertDialog.Builder(this)
            .setTitle("Dernier crash détecté")
            .setMessage(trace)
            .setPositiveButton("Copier") { _, _ ->
                val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("crash", trace))
            }
            .setNegativeButton("Fermer", null)
            .show()
    }

    private fun handleSpecialSchemes(uri: Uri): Boolean {
        return when (uri.scheme?.lowercase()) {
            "http", "https", "file" -> false
            else -> {
                runCatching {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                }.getOrElse {
                    if (it !is ActivityNotFoundException) throw it
                }
                true
            }
        }
    }

    private fun shouldInjectBridge(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        if (url.startsWith("file:///android_asset/web/")) return true
        val host = runCatching { Uri.parse(url).host.orEmpty() }.getOrDefault("")
        return host in trustedHosts
    }

    private fun injectBridgeJavascript() {
        val bridgeScript = assets.open("web/player_bridge.js")
            .bufferedReader()
            .use { it.readText() }

        binding.webView.evaluateJavascript(bridgeScript, null)
    }

    private fun openNativePlayer(request: PlayerRequest) {
        val cookieManager = CookieManager.getInstance()
        val cookiesFromWebView = cookieManager.getCookie(request.url)

        val finalHeaders = request.headers.toMutableMap().apply {
            if (!cookiesFromWebView.isNullOrBlank() && !containsKey("Cookie")) {
                put("Cookie", cookiesFromWebView)
            }
        }

        val finalRequest = request.copy(
            headers = finalHeaders,
            cookie = request.cookie ?: cookiesFromWebView
        )

        startActivity(PlayerActivity.newIntent(this, finalRequest))
    }

    override fun onResume() {
        super.onResume()
        binding.webView.onResume()
    }

    override fun onPause() {
        binding.webView.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        binding.webView.removeJavascriptInterface(JS_BRIDGE_NAME)
        binding.webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val JS_BRIDGE_NAME = "NativePlayer"

        /**
         * Incrémentez ce nombre à chaque nouvelle build native (APK) qui doit être
         * réinstallée par les utilisateurs. Comparé côté web à settings/appUpdate
         * dans Firestore pour afficher (ou non) la bannière de mise à jour.
         */
        private const val APP_BUILD_VERSION = 3
    }
}
