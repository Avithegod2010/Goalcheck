package io.github.avithegod2010.goalcheckadvance

import android.annotation.TargetApi
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * "Quick add" quick-settings tile. Tapping flips the stored tile state and launches
 * GoalCheck with the gc_tile=quickadd extra; MainActivity feeds that into the
 * GoalCheckNative "quickAdd" event for the web layer.
 *
 * TileService is API 24+; the manifest <service> declaration is simply inert on
 * API 23 devices (the system never resolves QS tiles there). No permissions are
 * requested by the app: BIND_QUICK_SETTINGS_TILE is held by the system, not us.
 * Re-injected after every 'cap add android' regeneration by scripts/native-glue.mjs.
 */
@TargetApi(24)
class GoalCheckTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        renderTile()
    }

    @Suppress("DEPRECATION")
    override fun onClick() {
        super.onClick()

        val prefs = applicationContext.getSharedPreferences(GoalCheckNativePlugin.PREFS, Context.MODE_PRIVATE)
        val nowActive = !prefs.getBoolean(KEY_TILE_ACTIVE, false)
        prefs.edit().putBoolean(KEY_TILE_ACTIVE, nowActive).apply()
        renderTile()

        val launch = packageManager.getLaunchIntentForPackage(applicationContext.packageName) ?: return
        launch.putExtra(GoalCheckNativePlugin.EXTRA_GC_TILE, GoalCheckNativePlugin.EXTRA_VALUE_QUICK_ADD)
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val pi = PendingIntent.getActivity(
                this,
                0,
                launch,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            startActivityAndCollapse(pi)
        } else {
            startActivityAndCollapse(launch)
        }
    }

    private fun renderTile() {
        val tile = qsTile ?: return
        val active = getSharedPreferences(GoalCheckNativePlugin.PREFS, Context.MODE_PRIVATE)
            .getBoolean(KEY_TILE_ACTIVE, false)
        tile.state = if (active) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.updateTile()
    }

    companion object {
        const val KEY_TILE_ACTIVE = "gc_tile_active"
    }
}
