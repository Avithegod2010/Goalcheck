package io.github.avithegod2010.goalcheckadvance

import android.content.Context
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * GoalCheckNative — local Capacitor plugin: home-screen widget, quick-settings
 * tile state and share-to-app intake.
 *
 * JS contract (documented in capacitor/README.md):
 *   GoalCheckNative.updateWidget({ title, subtitle, progress, running })
 *   GoalCheckNative.setTileActive({ active: boolean })
 *   GoalCheckNative.getPendingShare()                -> { text: string | null }
 *   listeners: "shareText" {text} | "quickAdd" {}
 *
 * Re-injected after every 'cap add android' regeneration by scripts/native-glue.mjs.
 * ZERO-INTERNET: performs no network I/O and requires no permissions.
 */
@CapacitorPlugin(name = "GoalCheckNative")
class GoalCheckNativePlugin : Plugin() {

    companion object {
        const val PREFS = "gc_widget"
        const val EXTRA_GC_TILE = "gc_tile"
        const val EXTRA_VALUE_QUICK_ADD = "quickadd"

        /** Captured in load() so the static emitIntent bridge can reach notifyListeners(). */
        @Volatile
        private var instance: GoalCheckNativePlugin? = null

        /** Latest ACTION_SEND text seen by emitIntent; pulled back via getPendingShare(). */
        @Volatile
        var latestShareText: String? = null
            private set

        /**
         * Static bridge called from MainActivity.onNewIntent (Java) — must stay @JvmStatic.
         * Inspects the incoming intent for ACTION_SEND text/plain content and for the
         * quick-settings tile extra, then notifies any listening web view.
         */
        @JvmStatic
        fun emitIntent(context: Context?, intent: Intent?) {
            if (intent == null) return

            if (Intent.ACTION_SEND == intent.action) {
                val text = intent.getStringExtra(Intent.EXTRA_TEXT)
                if (!text.isNullOrEmpty()) {
                    latestShareText = text
                    instance?.notifyShare(text)
                }
            }

            if (EXTRA_VALUE_QUICK_ADD == intent.getStringExtra(EXTRA_GC_TILE)) {
                instance?.notifyQuickAdd()
            }
        }
    }

    override fun load() {
        super.load()
        instance = this
    }

    private fun notifyShare(text: String) {
        val data = JSObject()
        data.put("text", text)
        notifyListeners("shareText", data)
    }

    private fun notifyQuickAdd() {
        notifyListeners("quickAdd", JSObject())
    }

    /**
     * Persist the widget payload in SharedPreferences("gc_widget") and push a
     * RemoteViews update to every placed instance of BOTH widget variants
     * (full + compact "GoalCheck Quick" — one payload, two renderers).
     */
    @PluginMethod
    fun updateWidget(call: PluginCall) {
        val title = call.getString("title") ?: ""
        val subtitle = call.getString("subtitle") ?: ""
        val progress = (call.getInt("progress") ?: 0).coerceIn(0, 100)
        val running = call.getBoolean("running") ?: false

        val ctx: Context = context
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(GoalCheckWidgetProvider.KEY_TITLE, title)
            .putString(GoalCheckWidgetProvider.KEY_SUBTITLE, subtitle)
            .putInt(GoalCheckWidgetProvider.KEY_PROGRESS, progress)
            .putBoolean(GoalCheckWidgetProvider.KEY_RUNNING, running)
            .apply()

        GoalCheckWidgetProvider.pushAll(ctx)
        GoalCheckQuickWidgetProvider.pushAll(ctx)
        call.resolve()
    }

    /** Store the quick-settings tile active state (rendered by GoalCheckTileService). */
    @PluginMethod
    fun setTileActive(call: PluginCall) {
        val active = call.getBoolean("active") ?: false
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(GoalCheckTileService.KEY_TILE_ACTIVE, active)
            .apply()
        call.resolve()
    }

    /** Pull the latest share text received while the web view was away or not listening. */
    @PluginMethod
    fun getPendingShare(call: PluginCall) {
        val data = JSObject()
        data.put("text", latestShareText)
        call.resolve(data)
    }
}
