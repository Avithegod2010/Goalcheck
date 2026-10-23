#!/usr/bin/env node
/**
 * native-glue.mjs — GoalCheck native Android glue: home-screen widget,
 * quick-settings tile, share-to-app intake.
 *
 * WHY THIS EXISTS
 *   `cap add android` (re)generates the native project per edition — appId
 *   io.github.avithegod2010.goalcheck | io.github.avithegod2010.goalcheckadvance —
 *   and WIPES every custom native file in the process. All custom native code
 *   must therefore be re-injected deterministically after every regeneration.
 *   scripts/sync-capacitor.mjs calls applyNativeGlue(ANDROID) right after its
 *   zero-INTERNET manifest patch; this module is fully idempotent, so it is
 *   also safe to run standalone against an existing tree:
 *
 *     node -e "import('./scripts/native-glue.mjs').then(m => m.applyNativeGlue('capacitor/android'))"
 *
 * WHAT IT INJECTS (package parsed from android/app/build.gradle applicationId;
 *   the Java/Kotlin package mirrors the appId exactly like the `cap add` template):
 *   - app/src/main/java/<pkg>/GoalCheckNativePlugin.kt    local Capacitor plugin "GoalCheckNative"
 *   - app/src/main/java/<pkg>/GoalCheckWidgetProvider.kt  home-screen widget (RemoteViews)
 *   - app/src/main/java/<pkg>/GoalCheckTileService.kt     "Quick add" quick-settings tile
 *   - MainActivity.java patch (idempotent, marker `// GC-NATIVE-GLUE`):
 *       registerPlugin(GoalCheckNativePlugin.class) in onCreate + onNewIntent → emitIntent
 *   - AndroidManifest.xml patch (idempotent, marker `<!-- GC-NATIVE-GLUE -->`):
 *       widget receiver + tile service + ACTION_SEND text/plain filter on the MAIN activity
 *   - res/layout/widget_goalcheck.xml, res/xml/goalcheck_widget_info.xml, res/drawable/widget_bg.xml
 *   - Kotlin build wiring (idempotent): kotlin-gradle-plugin classpath in android/build.gradle,
 *     `org.jetbrains.kotlin.android` plugin + jvmTarget 21 in app/build.gradle
 *     (the Capacitor template app module compiles Java only — Kotlin sources need this).
 *
 * ZERO-INTERNET GUARANTEE
 *   Nothing injected here adds a <uses-permission>. Widget, tile and ACTION_SEND intake
 *   are permission-free platform features (android:permission="BIND_QUICK_SETTINGS_TILE"
 *   on the <service> is a permission the SYSTEM holds to bind us, not one we request).
 *   As a belt-and-braces check, this module hard-fails if the patched manifest ends up
 *   declaring INTERNET.
 *
 * Node builtins only (fs / path). No external dependencies.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ─── markers (idempotency) ──────────────────────────────────────────────

const MANIFEST_MARKER = "<!-- GC-NATIVE-GLUE -->";
const MANIFEST_WIDGET_TILE_MARKER = "GC-NATIVE-GLUE:WIDGET-TILE";
const MANIFEST_SEND_MARKER = "GC-NATIVE-GLUE:SEND-FILTER";
const JAVA_MARKER = "// GC-NATIVE-GLUE";
const GRADLE_MARKER = "GC-NATIVE-GLUE";

/** Kotlin version pinned to match Capacitor 7.x's own kotlin-bom (7.6.9 → 1.9.25). */
const KOTLIN_VERSION = "1.9.25";

// ─── generated source templates (package = applicationId) ───────────────
// NOTE: templates intentionally avoid `$` (Kotlin string templates / JS template
// substitution collisions) — no `${...}` appears in any injected source.

const PLUGIN_KT = `package {{PKG}}

import android.appwidget.AppWidgetManager
import android.content.ComponentName
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
     * RemoteViews update to every placed instance of GoalCheckWidgetProvider.
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

        val manager = AppWidgetManager.getInstance(ctx)
        val ids = manager.getAppWidgetIds(ComponentName(ctx, GoalCheckWidgetProvider::class.java))
        if (ids != null && ids.isNotEmpty()) {
            manager.updateAppWidget(ids, GoalCheckWidgetProvider.buildRemoteViews(ctx))
        }
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
`;

const WIDGET_PROVIDER_KT = `package {{PKG}}

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
`;

const TILE_SERVICE_KT = `package {{PKG}}

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
`;

const MAIN_ACTIVITY_BODY = `public class MainActivity extends BridgeActivity {

    // GC-NATIVE-GLUE — local plugin registration (re-injected by scripts/native-glue.mjs).
    // registerPlugin must run BEFORE super.onCreate so the bridge loads GoalCheckNative.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GoalCheckNativePlugin.class);
        super.onCreate(savedInstanceState);
    }

    // GC-NATIVE-GLUE — ACTION_SEND shares and quick-settings tile launches are bridged
    // to the web layer as GoalCheckNative events ("shareText" {text} / "quickAdd" {}).
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        GoalCheckNativePlugin.emitIntent(this, intent);
    }
}
`;

// ─── resource templates ─────────────────────────────────────────────────

const WIDGET_LAYOUT_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- GC-NATIVE-GLUE — home-screen widget layout (re-injected by scripts/native-glue.mjs).
     Root stretches to fill the widget frame; the initial cell footprint is declared in
     res/xml/goalcheck_widget_info.xml (minWidth 180dp). -->
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/gc_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="@drawable/widget_bg"
    android:gravity="center_vertical"
    android:paddingStart="12dp"
    android:paddingTop="10dp"
    android:paddingEnd="12dp"
    android:paddingBottom="10dp">

    <TextView
        android:id="@+id/gc_widget_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="GoalCheck"
        android:textColor="#FFFFFF"
        android:textSize="14sp"
        android:textStyle="bold"
        android:maxLines="1"
        android:ellipsize="end" />

    <TextView
        android:id="@+id/gc_widget_subtitle"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text=""
        android:textColor="#9AA0B4"
        android:textSize="11sp"
        android:maxLines="1"
        android:ellipsize="end" />

    <ProgressBar
        android:id="@+id/gc_widget_progress"
        style="?android:attr/progressBarStyleHorizontal"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:max="100"
        android:progress="0" />
</LinearLayout>
`;

const WIDGET_INFO_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- GC-NATIVE-GLUE — widget metadata (re-injected by scripts/native-glue.mjs) -->
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="40dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/widget_goalcheck"
    android:resizeMode="horizontal"
    android:widgetCategory="home_screen" />
`;

const WIDGET_BG_XML = `<?xml version="1.0" encoding="utf-8"?>
<!-- GC-NATIVE-GLUE — widget background (re-injected by scripts/native-glue.mjs) -->
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#060913" />
    <corners android:radius="16dp" />
</shape>
`;

// ─── manifest + gradle patch snippets ───────────────────────────────────

const MANIFEST_COMPONENTS_BLOCK = `        <!-- GC-NATIVE-GLUE:WIDGET-TILE — home-screen widget + quick-settings tile
             (re-injected idempotently by scripts/native-glue.mjs; adds NO permissions —
             BIND_QUICK_SETTINGS_TILE is held by the system, not requested by the app) -->
        <receiver
            android:name=".GoalCheckWidgetProvider"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="android.appwidget.action.APPWIDGET_ENABLED" />
                <action android:name="android.appwidget.action.APPWIDGET_DISABLED" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/goalcheck_widget_info" />
        </receiver>

        <service
            android:name=".GoalCheckTileService"
            android:exported="true"
            android:icon="@mipmap/ic_launcher"
            android:label="Quick add"
            android:permission="android.permission.BIND_QUICK_SETTINGS_TILE">
            <intent-filter>
                <action android:name="android.service.quicksettings.action.QS_TILE" />
            </intent-filter>
        </service>
`;

const MANIFEST_SEND_FILTER_BLOCK = `            <!-- GC-NATIVE-GLUE:SEND-FILTER — accept ACTION_SEND text/plain shares
                 (re-injected idempotently by scripts/native-glue.mjs) -->
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="text/plain" />
            </intent-filter>
`;

const ROOT_GRADLE_SNIPPET = `
        // GC-NATIVE-GLUE — Kotlin compiler for the app module's native glue sources
        // (GoalCheckNativePlugin / GoalCheckWidgetProvider / GoalCheckTileService).
        // Version pinned to match Capacitor 7.x's own kotlin-bom (re-injected by
        // scripts/native-glue.mjs).
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:${KOTLIN_VERSION}'`;

const APP_GRADLE_GLUE = `
// ═══ GC-NATIVE-GLUE (appended by scripts/native-glue.mjs — idempotent) ═══
// Kotlin support for GoalCheckNativePlugin / GoalCheckWidgetProvider /
// GoalCheckTileService, whose sources are re-injected by scripts/native-glue.mjs
// after every 'cap add android' regeneration. jvmTarget must match the Java 21
// compileOptions configured in capacitor.build.gradle.
apply plugin: 'org.jetbrains.kotlin.android'

android {
    kotlinOptions {
        jvmTarget = "21"
    }
}
`;

// ─── helpers ────────────────────────────────────────────────────────────

function fail(msg) {
  throw new Error(`native-glue: ${msg}`);
}

function writeFileEnsuringDir(path, content) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
}

function replaceOnce(str, pattern, buildReplacement) {
  const match = str.match(pattern);
  if (!match) fail(`expected pattern not found: ${pattern}`);
  // function replacer → injected text is never interpreted for `$&`-style sequences
  return str.replace(match[0], () => buildReplacement(match));
}

/** applicationId from android/app/build.gradle — the Java/Kotlin package mirrors it. */
function parsePackage(ANDROID_DIR) {
  const gradlePath = join(ANDROID_DIR, "app", "build.gradle");
  if (!existsSync(gradlePath)) fail(`app/build.gradle not found at ${gradlePath}`);
  const gradle = readFileSync(gradlePath, "utf8");
  const m = gradle.match(/applicationId\s+"([^"]+)"/);
  if (!m) fail(`could not parse applicationId from ${gradlePath}`);
  return m[1];
}

// ─── full Kotlin sources (overwritten wholesale on every run) ───────────

function writeKotlinSources(ANDROID_DIR, PKG) {
  const javaDir = join(ANDROID_DIR, "app", "src", "main", "java", ...PKG.split("."));
  const files = [
    ["GoalCheckNativePlugin.kt", PLUGIN_KT],
    ["GoalCheckWidgetProvider.kt", WIDGET_PROVIDER_KT],
    ["GoalCheckTileService.kt", TILE_SERVICE_KT],
  ];
  for (const [name, template] of files) {
    writeFileEnsuringDir(join(javaDir, name), template.replaceAll("{{PKG}}", PKG));
  }
  return files.map(([name]) => name);
}

// ─── resources (overwritten wholesale on every run) ─────────────────────

function writeResSources(ANDROID_DIR) {
  const resDir = join(ANDROID_DIR, "app", "src", "main", "res");
  const files = [
    ["layout/widget_goalcheck.xml", WIDGET_LAYOUT_XML],
    ["xml/goalcheck_widget_info.xml", WIDGET_INFO_XML],
    ["drawable/widget_bg.xml", WIDGET_BG_XML],
  ];
  for (const [rel, content] of files) {
    writeFileEnsuringDir(join(resDir, ...rel.split("/")), content);
  }
  return files.map(([rel]) => `res/${rel}`);
}

// ─── MainActivity.java (idempotent regex patch) ─────────────────────────

function patchMainActivity(ANDROID_DIR, PKG) {
  const p = join(ANDROID_DIR, "app", "src", "main", "java", ...PKG.split("."), "MainActivity.java");
  if (!existsSync(p)) fail(`MainActivity.java not found at ${p} — cannot apply glue patch`);
  let src = readFileSync(p, "utf8");

  const hasGlue = src.includes(JAVA_MARKER);
  const hasRegister = /registerPlugin\(\s*GoalCheckNativePlugin\.class\s*\)/.test(src);
  const hasEmit = /GoalCheckNativePlugin\.emitIntent\(/.test(src);
  const hasIntentImport = /^\s*import\s+android\.content\.Intent;/m.test(src);
  const hasBundleImport = /^\s*import\s+android\.os\.Bundle;/m.test(src);

  if (hasGlue && hasRegister && hasEmit && hasIntentImport && hasBundleImport) {
    return "MainActivity.java: already patched (marker present, no changes)";
  }

  // 1. Imports (idempotent — added right after the package statement).
  const missingImports = [];
  if (!hasIntentImport) missingImports.push("import android.content.Intent;");
  if (!hasBundleImport) missingImports.push("import android.os.Bundle;");
  if (missingImports.length > 0) {
    src = src.replace(
      /^(package\s+[^;]+;)/m,
      (m0) => `${m0}\n\n${missingImports.join("\n")}`
    );
  }

  // 2. Class body — rewrite everything from the MainActivity declaration to EOF with the
  //    canonical glue body (handles both the template's empty body `{}` and any prior body).
  if (!(hasGlue && hasRegister && hasEmit)) {
    const classStart = src.search(/public\s+(final\s+)?class\s+MainActivity\b/);
    if (classStart === -1) fail("could not locate 'public class MainActivity' declaration");
    src = src.slice(0, classStart) + MAIN_ACTIVITY_BODY;
  }

  writeFileSync(p, src);
  return "MainActivity.java: patched (registerPlugin + onNewIntent → emitIntent)";
}

// ─── AndroidManifest.xml (idempotent patch) ─────────────────────────────

function patchManifest(ANDROID_DIR) {
  const p = join(ANDROID_DIR, "app", "src", "main", "AndroidManifest.xml");
  if (!existsSync(p)) fail(`AndroidManifest.xml not found at ${p}`);
  let xml = readFileSync(p, "utf8");
  const notes = [];

  // 1. Widget receiver + tile service + bare marker — rebuilt deterministically.
  //    Step A: strip any previous injection (block and/or marker line) wherever it is.
  //    Step B: re-emit the canonical block right before </application>, collapsing all
  //    blank lines between the last real element and </application>. This makes the
  //    patched manifest a byte-stable fixed point across repeated runs.
  const hadComponents = /GC-NATIVE-GLUE:WIDGET-TILE/.test(xml) && xml.includes(".GoalCheckWidgetProvider");
  xml = xml.replace(
    new RegExp(`[ \\t]*<!-- ${MANIFEST_WIDGET_TILE_MARKER}[\\s\\S]*?</service>[ \\t]*\\r?\\n?`, "g"),
    ""
  );
  xml = xml.replace(
    new RegExp(`[ \\t]*${MANIFEST_MARKER}[ \\t]*\\r?\\n?`, "g"),
    ""
  );

  const closeIdx = xml.lastIndexOf("</application>");
  if (closeIdx === -1) fail("AndroidManifest.xml has no </application> closing tag");

  const indentMatch = xml.slice(0, closeIdx).match(/[ \t]*$/);
  const indent = indentMatch && indentMatch[0] ? indentMatch[0] : "    "; // indent of the </application> line

  let head = xml.slice(0, closeIdx);
  const tail = xml.slice(closeIdx); // "</application>…" — reattached verbatim
  head = head.replace(/\s+$/, ""); // collapse blank lines / old remnants back to the last real element
  if (!head.trim()) fail("AndroidManifest.xml has an empty <application> block");

  xml =
    head +
    "\n\n" +
    MANIFEST_COMPONENTS_BLOCK +
    indent +
    MANIFEST_MARKER +
    "\n" +
    indent +
    tail;
  notes.push(hadComponents ? "widget receiver + tile service (rebuilt)" : "widget receiver + tile service");

  // 2. ACTION_SEND text/plain intent-filter merged into the MAIN (launcher) activity block.
  const activities = [...xml.matchAll(/<activity\b[\s\S]*?<\/activity>/g)].map((m) => m[0]);
  const mainActivity = activities.find((a) => /android\.intent\.action\.MAIN/.test(a));
  if (!mainActivity) fail("could not locate the MAIN launcher <activity> block in AndroidManifest.xml");
  if (!/android\.intent\.action\.SEND/.test(mainActivity)) {
    // NOTE: String.replace callback signature is (fullMatch, p1, ...) — p1 is the
    // captured indent (m[1] would be the 2nd CHARACTER of the full match).
    const patched = mainActivity.replace(
      /([ \t]*)<\/activity>/,
      (fullMatch, p1) => `\n${MANIFEST_SEND_FILTER_BLOCK}${p1 || ""}</activity>`
    );
    xml = xml.replace(mainActivity, () => patched);
    notes.push("ACTION_SEND text/plain intent-filter on MAIN activity");
  }

  writeFileSync(p, xml);

  // 3. Belt-and-braces: the glue must never be the reason INTERNET appears.
  if (/<uses-permission[^>]*INTERNET/.test(xml)) {
    fail("patched manifest declares android.permission.INTERNET — zero-INTERNET guarantee violated");
  }

  return notes.length > 0
    ? `AndroidManifest.xml: added ${notes.join(", ")}`
    : "AndroidManifest.xml: already patched (no changes)";
}

// ─── Kotlin build wiring (idempotent gradle patches) ────────────────────

function patchGradleForKotlin(ANDROID_DIR) {
  const notes = [];

  // 1. Root build.gradle — kotlin-gradle-plugin classpath (the Capacitor template ships
  //    Java-only app modules; the plugin must be on the root buildscript classpath).
  const rootGradlePath = join(ANDROID_DIR, "build.gradle");
  let rootGradle = readFileSync(rootGradlePath, "utf8");
  if (!/kotlin-gradle-plugin/.test(rootGradle)) {
    const anchor = /(buildscript\s*\{[\s\S]*?\bdependencies\s*\{)/;
    if (!anchor.test(rootGradle)) {
      fail("could not locate buildscript.dependencies in android/build.gradle");
    }
    rootGradle = rootGradle.replace(anchor, (m0) => m0 + ROOT_GRADLE_SNIPPET);
    writeFileSync(rootGradlePath, rootGradle);
    notes.push("android/build.gradle: kotlin-gradle-plugin classpath added");
  }

  // 2. App build.gradle — apply kotlin-android + jvmTarget 21 (matches the Java 21
  //    compileOptions from capacitor.build.gradle; mismatch breaks the build).
  const appGradlePath = join(ANDROID_DIR, "app", "build.gradle");
  let appGradle = readFileSync(appGradlePath, "utf8");
  if (!appGradle.includes(GRADLE_MARKER) && !/org\.jetbrains\.kotlin\.android/.test(appGradle)) {
    appGradle = appGradle.trimEnd() + "\n" + APP_GRADLE_GLUE;
    writeFileSync(appGradlePath, appGradle);
    notes.push("app/build.gradle: org.jetbrains.kotlin.android + jvmTarget 21 applied");
  }

  return notes.length > 0 ? notes.join("; ") : "gradle: Kotlin wiring already present (no changes)";
}

// ─── entry point ────────────────────────────────────────────────────────

/**
 * Re-injects all custom native glue into the given Capacitor android project.
 * Safe to run repeatedly (overwrites generated sources wholesale; patches
 * MainActivity / AndroidManifest / gradle idempotently via markers).
 *
 * @param {string} ANDROID_DIR absolute path to capacitor/android
 */
export function applyNativeGlue(ANDROID_DIR) {
  if (!existsSync(join(ANDROID_DIR, "app", "src", "main"))) {
    fail(`not a Capacitor android project: ${ANDROID_DIR}`);
  }

  const PKG = parsePackage(ANDROID_DIR);
  console.log(`native-glue: package=${PKG}`);

  const ktFiles = writeKotlinSources(ANDROID_DIR, PKG);
  console.log(`native-glue: kotlin sources written → ${ktFiles.join(", ")}`);

  const resFiles = writeResSources(ANDROID_DIR);
  console.log(`native-glue: resources written → ${resFiles.join(", ")}`);

  console.log(`native-glue: ${patchMainActivity(ANDROID_DIR, PKG)}`);
  console.log(`native-glue: ${patchManifest(ANDROID_DIR)}`);
  console.log(`native-glue: ${patchGradleForKotlin(ANDROID_DIR)}`);
  console.log("native-glue: zero-internet verified (no INTERNET uses-permission added)");

  return { package: PKG, kotlin: ktFiles, resources: resFiles };
}

export default applyNativeGlue;
