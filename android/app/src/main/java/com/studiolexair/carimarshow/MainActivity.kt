package com.studiolexair.carimarshow

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.ViewGroup
import android.widget.FrameLayout
import android.webkit.*
import androidx.core.graphics.Insets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import java.io.ByteArrayInputStream

/** Interfaz empaquetada localmente. Sin puentes JavaScript hacia código nativo. */
class MainActivity : Activity() {
    private lateinit var web: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val localHost = "appassets.androidplatform.net"
    private val remoteHosts = setOf("carimarshow.vercel.app", "image.tmdb.org")

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(state: Bundle?) {
        super.onCreate(state)
        // Usar el mismo modelo edge-to-edge en Android 10-16; después aplicamos
        // cada inset una sola vez al contenedor raíz, también con navegación de 3 botones.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        // Mantener el WebView dentro del área segura. Android 15 aplica edge-to-edge
        // y las barras del sistema podían cubrir el botón Volver o la navegación inferior.
        val root = FrameLayout(this).apply { setBackgroundColor(Color.rgb(3, 21, 34)) }
        web = WebView(this).apply { setBackgroundColor(Color.rgb(3, 21, 34)) }
        root.addView(web, FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT,
        ))
        setContentView(root)
        val safeTypes = WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val safe = insets.getInsets(safeTypes)
            view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
            // Ya aplicamos las barras y el recorte al root: no volver a pasarlos al
            // WebView. Los insets del teclado (IME) se conservan para los campos.
            WindowInsetsCompat.Builder(insets)
                .setInsets(safeTypes, Insets.NONE)
                .setInsetsIgnoringVisibility(safeTypes, Insets.NONE)
                .build()
        }
        ViewCompat.requestApplyInsets(root)
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
                if (uri.scheme == "https" && uri.host == localHost) {
                    val response = loader.shouldInterceptRequest(uri)
                    // Android's MIME registry can omit .mjs: ES modules require a JavaScript MIME.
                    if (uri.path?.endsWith(".mjs") == true) response?.mimeType = "text/javascript"
                    return response
                }
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
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: WebChromeClient.FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    startActivityForResult(params.createIntent().addCategory(Intent.CATEGORY_OPENABLE), 110)
                    true
                } catch (_: Exception) {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = null
                    false
                }
            }
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
        if (state == null || web.restoreState(state) == null) web.loadUrl("https://$localHost/app/index.html#home")
    }
    private fun external(uri: Uri) {
        if (uri.scheme !in setOf("https", "http", "tel", "mailto")) return
        try { startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)) }
        catch (_: Exception) { android.widget.Toast.makeText(this, "No hay una aplicación para abrir este enlace", android.widget.Toast.LENGTH_SHORT).show() }
    }
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() { if (web.canGoBack()) web.goBack() else super.onBackPressed() }
    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 110) {
            fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data))
            fileCallback = null
        }
    }
    override fun onSaveInstanceState(out: Bundle) { web.saveState(out); super.onSaveInstanceState(out) }
    override fun onDestroy() { fileCallback?.onReceiveValue(null); fileCallback = null; web.destroy(); super.onDestroy() }
}
