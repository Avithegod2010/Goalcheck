package io.github.avithegod2010.goalcheckadvance

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * GoalCheck home-screen widget. Mirrors whatever the web layer last pushed via
 * GoalCheckNative.updateWidget(...) — persisted in SharedPreferences("gc_widget").
 *
 * Pure RemoteViews rendering: no network, no permissions, no background work
 * (updatePeriodMillis is 0; updates are push-only from the app).
 * Re-injected after every 'cap add android' regeneration by scripts/native-glue.mjs.
 */
class GoalCheckWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        appWidgetManager.updateAppWidget(appWidgetIds, buildRemoteViews(context))
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE == intent.action) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, GoalCheckWidgetProvider::class.java))
            if (ids != null && ids.isNotEmpty()) {
                manager.updateAppWidget(ids, buildRemoteViews(context))
            }
        }
    }

    companion object {
        const val PREFS = "gc_widget"
        const val KEY_TITLE = "gc_title"
        const val KEY_SUBTITLE = "gc_subtitle"
        const val KEY_PROGRESS = "gc_progress"
        const val KEY_RUNNING = "gc_running"

        /**
         * Builds the widget RemoteViews from SharedPreferences. Static + @JvmStatic so both
         * this provider and GoalCheckNativePlugin.updateWidget share one rendering path.
         */
        @JvmStatic
        fun buildRemoteViews(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val title = prefs.getString(KEY_TITLE, "GoalCheck") ?: "GoalCheck"
            val subtitle = prefs.getString(KEY_SUBTITLE, "") ?: ""
            val progress = prefs.getInt(KEY_PROGRESS, 0).coerceIn(0, 100)
            val running = prefs.getBoolean(KEY_RUNNING, false)

            val views = RemoteViews(context.packageName, R.layout.widget_goalcheck)
            views.setTextViewText(R.id.gc_widget_title, title)
            views.setTextViewText(R.id.gc_widget_subtitle, subtitle)
            // running == true renders the bar indeterminate (pomodoro in flight).
            views.setProgressBar(R.id.gc_widget_progress, 100, progress, running)
            return views
        }
    }
}
