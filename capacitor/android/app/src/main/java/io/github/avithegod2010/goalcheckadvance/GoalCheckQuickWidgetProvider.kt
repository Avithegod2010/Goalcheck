package io.github.avithegod2010.goalcheckadvance

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * "GoalCheck Quick" — compact 2x1 glanceable widget: board title, next open
 * task, progress percentage. Reads the SAME SharedPreferences("gc_widget")
 * payload written by GoalCheckNative.updateWidget(...) as the full widget —
 * one shared update path, two RemoteViews renderers.
 *
 * Pure RemoteViews rendering: no network, no permissions, no background work
 * (updatePeriodMillis is 0; updates are push-only from the app process).
 * Re-injected after every 'cap add android' regeneration by scripts/native-glue.mjs.
 */
class GoalCheckQuickWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        appWidgetManager.updateAppWidget(appWidgetIds, buildRemoteViews(context))
    }

    // Same action string as the full widget: any launcher/system APPWIDGET_UPDATE
    // broadcast refreshes this variant straight from the shared prefs payload.
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (AppWidgetManager.ACTION_APPWIDGET_UPDATE == intent.action) {
            pushAll(context)
        }
    }

    companion object {
        /**
         * Builds the compact widget RemoteViews from SharedPreferences. Static + @JvmStatic
         * so both this provider and GoalCheckNativePlugin.updateWidget share one rendering path.
         */
        @JvmStatic
        fun buildRemoteViews(context: Context): RemoteViews {
            val prefs = context.getSharedPreferences(GoalCheckWidgetProvider.PREFS, Context.MODE_PRIVATE)
            val title = prefs.getString(GoalCheckWidgetProvider.KEY_TITLE, "GoalCheck") ?: "GoalCheck"
            val nextTask = prefs.getString(GoalCheckWidgetProvider.KEY_SUBTITLE, "") ?: ""
            val progress = prefs.getInt(GoalCheckWidgetProvider.KEY_PROGRESS, 0).coerceIn(0, 100)
            val running = prefs.getBoolean(GoalCheckWidgetProvider.KEY_RUNNING, false)

            val views = RemoteViews(context.packageName, R.layout.widget_goalcheck_quick)
            views.setTextViewText(R.id.gc_quick_title, title)
            views.setTextViewText(R.id.gc_quick_next, nextTask)
            views.setTextViewText(
                R.id.gc_quick_percent,
                context.getString(R.string.gc_widget_percent, progress)
            )
            // running == true renders the bar indeterminate (pomodoro in flight).
            views.setProgressBar(R.id.gc_quick_progress, 100, progress, running)
            return views
        }

        /**
         * Pushes the persisted payload to every placed instance of this variant.
         * Called by GoalCheckNativePlugin.updateWidget (which calls pushAll on both
         * widget providers) and by this receiver's APPWIDGET_UPDATE handling.
         */
        @JvmStatic
        fun pushAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, GoalCheckQuickWidgetProvider::class.java))
            if (ids != null && ids.isNotEmpty()) {
                manager.updateAppWidget(ids, buildRemoteViews(context))
            }
        }
    }
}
