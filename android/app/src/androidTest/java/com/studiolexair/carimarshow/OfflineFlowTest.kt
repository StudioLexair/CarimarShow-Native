package com.studiolexair.carimarshow

import android.app.Activity
import android.app.Instrumentation.ActivityResult
import android.content.Intent
import android.net.Uri
import android.net.ConnectivityManager
import android.content.Context
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.intent.Intents
import androidx.test.espresso.intent.Intents.intended
import androidx.test.espresso.intent.Intents.intending
import androidx.test.espresso.intent.matcher.IntentMatchers.hasAction
import androidx.test.espresso.intent.matcher.IntentMatchers.hasData
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.Until
import org.hamcrest.Matchers.allOf
import org.json.JSONTokener
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Real APK assets/WebView on an emulator. External intents are intercepted; no video playback claimed. */
@RunWith(AndroidJUnit4::class)
class OfflineFlowTest {
    @Test fun bundledOfflineOrderAndExternalTrailer() {
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        // Radio state propagates asynchronously; disabling Wi-Fi alone can leave
        // cellular connected for a moment on freshly booted CI emulators.
        device.executeShellCommand("cmd connectivity airplane-mode enable")
        device.executeShellCommand("svc wifi disable")
        device.executeShellCommand("svc data disable")
        val connectivity = InstrumentationRegistry.getInstrumentation().targetContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val offlineDeadline = System.currentTimeMillis() + 30000
        while (connectivity.activeNetwork != null && System.currentTimeMillis() < offlineDeadline) Thread.sleep(200)
        assertNull("Emulator still has an active network; don't call this an offline test", connectivity.activeNetwork)
        Intents.init()
        intending(hasAction(Intent.ACTION_VIEW)).respondWith(ActivityResult(Activity.RESULT_OK, null))
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        lateinit var web: WebView
        scenario.onActivity { activity ->
            val root = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as FrameLayout
            web = root.getChildAt(0) as WebView
        }
        fun js(script: String): String {
            var value = "null"
            val done = CountDownLatch(1)
            InstrumentationRegistry.getInstrumentation().runOnMainSync { web.evaluateJavascript(script) { value = it; done.countDown() } }
            assertTrue("JavaScript callback timed out", done.await(10, TimeUnit.SECONDS))
            return value
        }
        fun waitFor(script: String) {
            val deadline = System.currentTimeMillis() + 30000
            while (System.currentTimeMillis() < deadline) { if (js(script) == "true") return; Thread.sleep(150) }
            fail("WebView condition timed out: $script; page=" + js("document.body.innerText"))
        }
        try {
            waitFor("!!document.querySelector('.hero h1') && document.querySelector('#splash').hidden")
            waitFor("navigator.onLine===false")
            assertTrue(js("document.querySelector('.hero h1').textContent").contains("John Wick"))
            assertEquals("\"https://carimarshow.vercel.app\"", js("window.CARIMAR_CONFIG.apiOrigin"))
            js("location.hash='#detail/movie/693134'")
            waitFor("!!document.querySelector('.detail-actions a[href*=youtube]')")
            val href = JSONTokener(js("document.querySelector('.detail-actions a[href*=youtube]').href")).nextValue().toString()
            assertTrue(href.startsWith("https://www.youtube.com/watch?v="))
            // Actual touch is required for target=_blank; JS .click() isn't a user gesture.
            val trailer = device.wait(Until.findObject(By.text("Ver tráiler")), 10000)
            assertNotNull("Trailer link not exposed in WebView accessibility", trailer)
            trailer.click()
            Thread.sleep(800)
            intended(allOf(hasAction(Intent.ACTION_VIEW), hasData(Uri.parse(href))))
            assertTrue(js("location.hostname").contains("appassets.androidplatform.net"))
            js("document.querySelector('.detail-actions [data-save]').click(); location.hash='#list'")
            waitFor("!!document.querySelector('#shareOrder')")
            js("document.querySelector('#shareOrder').click()")
            waitFor("document.querySelectorAll('[data-order-contact]').length===2")
            assertTrue(js("document.querySelector('[data-order-contact=\"1\"]').href").contains("wa.me/5353324928?text="))
            assertTrue(js("document.querySelector('[data-order-contact=\"2\"]').href").contains("wa.me/5378660658?text="))
            assertTrue(js("document.querySelector('#orderMessage').value").contains("Total de títulos: 1"))
            assertEquals("1", js("JSON.parse(localStorage.getItem('cs_list_v1')).length"))
            assertEquals("false", js("document.documentElement.scrollWidth>innerWidth"))
        } finally {
            scenario.close()
            Intents.release()
            device.executeShellCommand("cmd connectivity airplane-mode disable")
            device.executeShellCommand("svc wifi enable")
        }
    }
    @Test fun systemBarInsetsKeepNativeContentInsideSafeArea() {
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        try {
            var checked = false
            val deadline = System.currentTimeMillis() + 15000
            while (!checked && System.currentTimeMillis() < deadline) {
                scenario.onActivity { activity ->
                    val root = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as FrameLayout
                    val insets = ViewCompat.getRootWindowInsets(root)
                    if (root.width > 0 && root.height > 0 && insets != null) {
                        val bars = insets.getInsets(
                            WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout(),
                        )
                        val web = root.getChildAt(0) as WebView
                        assertTrue("WebView begins below the status-bar/cutout inset", web.top >= root.paddingTop)
                        assertTrue("WebView ends above the navigation-bar inset", web.bottom <= root.height - root.paddingBottom)
                        assertTrue("Top system-bar inset is applied to the root", root.paddingTop >= bars.top)
                        assertTrue("Bottom system-bar inset is applied to the root", root.paddingBottom >= bars.bottom)
                        checked = true
                    }
                }
                if (!checked) Thread.sleep(150)
            }
            assertTrue("Window-insets callback must be delivered", checked)
        } finally {
            scenario.close()
        }
    }

    @Test fun shortDomainProxyWorksInNativeWebView() {
        val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
        device.executeShellCommand("cmd connectivity airplane-mode disable")
        device.executeShellCommand("svc wifi enable")
        device.executeShellCommand("svc data enable")
        val connectivity = InstrumentationRegistry.getInstrumentation().targetContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val networkDeadline = System.currentTimeMillis() + 60000
        while (connectivity.activeNetwork == null && System.currentTimeMillis() < networkDeadline) Thread.sleep(200)
        assertNotNull("Online test requires a real network", connectivity.activeNetwork)
        val scenario = ActivityScenario.launch(MainActivity::class.java)
        lateinit var web: WebView
        scenario.onActivity { activity ->
            val root = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as FrameLayout
            web = root.getChildAt(0) as WebView
        }
        fun js(script: String): String {
            var value = "null"
            val done = CountDownLatch(1)
            InstrumentationRegistry.getInstrumentation().runOnMainSync { web.evaluateJavascript(script) { value = it; done.countDown() } }
            assertTrue(done.await(10, TimeUnit.SECONDS))
            return value
        }
        try {
            val readyDeadline = System.currentTimeMillis() + 60000
            while (js("!!window.CARIMAR_CONFIG") != "true" && System.currentTimeMillis() < readyDeadline) Thread.sleep(200)
            assertEquals("\"https://carimarshow.vercel.app\"", js("window.CARIMAR_CONFIG.apiOrigin"))
            js("window.__proxyCheck=null; fetch(window.CARIMAR_CONFIG.apiOrigin+'/api/tmdb?path=genre/tv/list').then(async r=>{const d=await r.json();window.__proxyCheck={status:r.status,count:d.genres?.length};}).catch(e=>window.__proxyCheck={error:String(e)})")
            val responseDeadline = System.currentTimeMillis() + 60000
            while (js("!!window.__proxyCheck") != "true" && System.currentTimeMillis() < responseDeadline) Thread.sleep(200)
            assertEquals("Real native WebView -> short domain -> TMDB", "200", js("window.__proxyCheck?.status"))
            assertEquals("16", js("window.__proxyCheck?.count"))
        } finally { scenario.close() }
    }

}
