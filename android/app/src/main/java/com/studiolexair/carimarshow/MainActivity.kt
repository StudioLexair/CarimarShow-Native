package com.studiolexair.carimarshow

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.*
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/** Interfaz empaquetada localmente. Sin puentes JavaScript hacia código nativo. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private val localHost = "appassets.androidplatform.net"
    private val remoteHosts = setOf("carimarshow-native.vercel.app", "image.tmdb.org")

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        web = WebView(this)
        web.setBackgroundColor(Color.rgb(16, 21, 29))
        setContentView(web)
        // Android 15 fuerza edge-to-edge: aplicar los insets a la superficie nativa.
        web.setOnApplyWindowInsetsListener { v, insets ->
            v.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop,
                insets.systemWindowInsetRight, insets.systemWindowInsetBottom)
            insets
        }
        web.requestApplyInsets()
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(true)
            cacheMode = WebSettings.LOAD_DEFAULT
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, req: WebResourceRequest): WebResourceResponse? {
                val uri = req.url
                if (uri.scheme == "https" && uri.host == localHost) return loader.shouldInterceptRequest(uri)
                if (uri.scheme == "https" && uri.host in remoteHosts) return null
                if (uri.scheme in setOf("data", "blob", "about")) return null
                return WebResourceResponse("text/plain", "UTF-8", 403, "Blocked", emptyMap(), ByteArrayInputStream(ByteArray(0)))
            }
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val uri = req.url
                if (uri.scheme == "https" && uri.host == localHost) return false
                if (req.isForMainFrame) external(uri)
                return true
            }
            override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: android.net.http.SslError) { handler.cancel() }
        }
        web.webChromeClient = object : WebChromeClient() {
            // target=_blank: abrir enlaces externos en el navegador, nunca reemplazar el shell local.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message): Boolean {
                if (!isUserGesture) return false
                val popup = WebView(this@MainActivity)
                popup.webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(v: WebView, req: WebResourceRequest): Boolean {
                        external(req.url); popup.destroy(); return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = popup
                resultMsg.sendToTarget()
                return true
            }
            override fun onJsConfirm(view: WebView, url: String, message: String, result: JsResult): Boolean {
                android.app.AlertDialog.Builder(this@MainActivity).setMessage(message)
                    .setPositiveButton("Aceptar") { _, _ -> result.confirm() }
                    .setNegativeButton("Cancelar") { _, _ -> result.cancel() }
                    .setOnCancelListener { result.cancel() }.show()
                return true
            }
        }
        if (state == null || web.restoreState(state) == null) web.loadUrl("https://$localHost/index.html#home")
    }
    private fun external(uri: Uri) {
        if (uri.scheme !in setOf("https", "http", "tel", "mailto")) return
        try { startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)) }
        catch (_: Exception) { android.widget.Toast.makeText(this, "No hay una aplicación para abrir este enlace", android.widget.Toast.LENGTH_SHORT).show() }
    }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else super.onBackPressed() }
    override fun onSaveInstanceState(out: Bundle) { web.saveState(out); super.onSaveInstanceState(out) }
    override fun onDestroy() { web.destroy(); super.onDestroy() }
}
