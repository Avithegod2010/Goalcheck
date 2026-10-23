# GoalCheck — Capacitor Android shell

Native Android wrapper for **GoalCheck** (base) and **GoalCheck Advance** (pro).
One shared web core, two installable apps.

**The killer privacy feature: the APK declares ZERO `INTERNET` permission.**
GoalCheck is local-only — no network stack, no analytics, no telemetry, no
remote config. With `android.permission.INTERNET` removed, "the app cannot
phone home" is enforced by the OS, not a policy page.

- Local notifications (pomodoro completion while backgrounded) come from
  `@capacitor/local-notifications` — a local device API, no Play Services.
  It is already wired in `capacitor.config.ts`
  (`plugins.LocalNotifications.smallIcon: "ic_launcher"`, `iconColor: "#a855f7"`).
- Native glue features — **home-screen widget**, **"Quick add" quick-settings
  tile** and **share-into-app intake** — live in a local Capacitor plugin named
  `GoalCheckNative` (see "Native glue" below). All three are permission-free
  and contribute zero network surface.
- `server.androidScheme: "https"` is set explicitly so the WebView origin is
  `https://localhost` and **localStorage persists** across app restarts.
- `android.allowMixedContent: false` — no cleartext content, ever.

---

## Layout

```
capacitor/
├── capacitor.config.ts     # edition-aware config (GC_EDITION=pro|base, default pro)
├── package.json            # independent project — root web app has NO Capacitor deps
├── www/                    # REPLACED at build time by the Next.js static export
├── assets/                 # brand sources for @capacitor/assets
│   ├── logo.png            #   ← docs/brand/logo-1024.png
│   ├── splash.png          #   ← docs/brand/splash-2732.png
│   └── splash.dark.png     #   ← docs/brand/splash-2732.png
└── android/                # native project (generated; see "Editions" below)
```

| Edition | `GC_EDITION` | appId | appName |
|---|---|---|---|
| GoalCheck Advance | `pro` (default) | `io.github.avithegod2010.goalcheckadvance` | GoalCheck Advance |
| GoalCheck | `base` | `io.github.avithegod2010.goalcheck` | GoalCheck |

---

## Prerequisites

- **Android Studio** (easiest — bundles JDK 21 + Android SDK), *or*
  manually: **JDK 21** + **Android SDK** (platform 36 / build-tools per
  `android/variables.gradle`) with `ANDROID_HOME` set.
- **Bun** (or Node 20+) for the build/sync tooling.

## Local build

From the **repo root**:

```bash
bun install                        # web app deps
bun run build:capacitor:advance    # → static export (pro) + sync into shell
# or
bun run build:capacitor:base       # → static export (base) + sync into shell
```

Each script runs `NEXT_PUBLIC_GC_EDITION=<pro|base> BUILD_TARGET=capacitor
next build` (pure static export into `out/`) and then
`scripts/sync-capacitor.mjs`, which copies `out/` → `capacitor/www/` and runs
`cap sync android`. If the native project was last baked for the *other*
edition, the script regenerates it automatically (`cap add android` +
manifest patch + icon/splash generation) — see "Editions" below.

Then build the APK:

```bash
cd capacitor/android
./gradlew assembleDebug            # first run downloads gradle + deps
# → app/build/outputs/apk/debug/app-debug.apk
```

Rename for distribution:

```bash
cp app/build/outputs/apk/debug/app-debug.apk \
   ../../download/GoalCheckAdvance-v0.4.0-debug.apk
```

Open in Android Studio for emulator/device runs:
`cd capacitor && bun run open` (or `npx cap open android`).

## Editions — how the native project switches

`appId` / `appName` are baked into the native project by `cap add android`
(`build.gradle` `applicationId`/`namespace`, `MainActivity` package path,
`res/values/strings.xml`). Only **one** `android/` project lives here, so the
committed one is baked for whichever edition was built last (currently
**advance/pro**).

`scripts/sync-capacitor.mjs <edition>` detects a mismatch via `applicationId`
and regenerates `android/` for the requested edition, then re-applies:

1. the **zero-INTERNET manifest patch** (`scripts/sync-capacitor.mjs` holds
   the canonical comment — keep future native tweaks in that script so they
   survive regeneration),
2. the **native glue re-injection** (`scripts/native-glue.mjs` — see below),
   and
3. icon/splash generation from `capacitor/assets/` (edition-independent).

`cap sync` alone never touches `AndroidManifest.xml`, so the patch also
survives plain syncs of the same edition.

## Native glue — home-screen widget, quick-settings tile, share-to-app

Three native Android features are wired through a **local Capacitor plugin
named `GoalCheckNative`**. Because `cap add android` wipes every custom native
file on each edition switch, all of it is (re-)injected by
**`scripts/native-glue.mjs`** on every `sync-capacitor` run (and after every
regeneration). The module parses `applicationId` from `android/app/build.gradle`
and templates the Java/Kotlin package to match, so the same injection works for
both editions.

Injected native pieces (all under the app package):

| Piece | Kind | What it does |
|---|---|---|
| `GoalCheckNativePlugin.kt` | Capacitor plugin | JS ⇄ native bridge (methods + events below); persists widget/tile state in SharedPreferences `gc_widget` |
| `GoalCheckWidgetProvider.kt` | `AppWidgetProvider` | Home-screen widget rendering `res/layout/widget_goalcheck.xml` (dark rounded card, bold title, subtitle, progress bar) from those prefs |
| `GoalCheckTileService.kt` | `TileService` | "Quick add" QS tile: `onStartListening` mirrors stored state; tap flips it and launches the app with extra `gc_tile=quickadd` |
| `MainActivity.java` patch | idempotent | `registerPlugin(GoalCheckNativePlugin.class)` in `onCreate` + `onNewIntent → GoalCheckNativePlugin.emitIntent(...)` |
| `AndroidManifest.xml` patch | idempotent | `<receiver>` (APPWIDGET_UPDATE/ENABLED/DISABLED + `@xml/goalcheck_widget_info`), `<service>` (`BIND_QUICK_SETTINGS_TILE`, `QS_TILE` intent-filter, `@mipmap/ic_launcher`), and an `ACTION_SEND text/plain` intent-filter merged into the MAIN activity |

Resources injected alongside: `res/layout/widget_goalcheck.xml`,
`res/xml/goalcheck_widget_info.xml` (minWidth 180dp, resizeMode horizontal,
`updatePeriodMillis` 0 — push-only updates) and `res/drawable/widget_bg.xml`
(rounded 16dp `#060913` card background).

The glue also patches the Gradle build idempotently (marked `GC-NATIVE-GLUE`):
`org.jetbrains.kotlin:kotlin-gradle-plugin` classpath in `android/build.gradle`
and the `org.jetbrains.kotlin.android` plugin + `jvmTarget 21` in
`app/build.gradle` — the Capacitor template app module is Java-only, so the
Kotlin sources need this wiring to compile.

### JS contract (what the web layer codes against)

```js
// methods (plugin name: "GoalCheckNative")
GoalCheckNative.updateWidget({ title: string, subtitle: string,
                               progress: number /* 0-100, clamped */,
                               running: boolean });   // push widget + persist
GoalCheckNative.setTileActive({ active: boolean });   // store QS tile state
GoalCheckNative.getPendingShare();                    // → { text: string | null }

// listener events
GoalCheckNative.addListener("shareText", ({ text }) => {}); // ACTION_SEND text/plain received
GoalCheckNative.addListener("quickAdd", () => {});          // QS tile tapped
```

Notes:

- `updateWidget` updates **all placed widget instances** via `AppWidgetManager`
  (RemoteViews are rebuilt by `GoalCheckWidgetProvider.buildRemoteViews`).
- `running: true` renders the widget's progress bar indeterminate (pomodoro in
  flight); `progress` is clamped to 0–100 natively.
- `shareText` is only delivered while a web listener exists; anything received
  earlier (app cold-started by a share) stays retrievable via
  `getPendingShare()` — call it once after startup.
- The manifest additions add **no permissions**: `BIND_QUICK_SETTINGS_TILE` is
  a permission the *system* holds to bind the tile service, not one the app
  requests. The zero-INTERNET guarantee is untouched (and `native-glue.mjs`
  re-asserts it after patching).

### Status — honesty box

The glue has been **applied to the committed `android/` tree and verified
idempotent** (re-runs are byte-identical) and the injected XML is checked
well-formed — but it has **not yet been compiled locally** (no Android SDK in
this environment). The first `android/v*` tag build in GitHub Actions is the
compile gate; expect any Kotlin/AGP fix-ups to land in `native-glue.mjs` so
they survive regeneration.

## Zero-INTERNET guarantee — verify after every dependency change

`android/app/src/main/AndroidManifest.xml` deliberately omits
`android.permission.INTERNET` (Capacitor's template adds it; we removed it and
left an explanatory comment in the file). **Any future Capacitor/Cordova
plugin that requires INTERNET in its merged manifest must be rejected** — a
local-only app has no use for a network stack.

Check the **merged** manifest of the built APK (plugins can inject permissions
at merge time, which the source manifest can't show):

```bash
cd capacitor/android
./gradlew assembleDebug

# either aapt2 (Android SDK build-tools):
$ANDROID_HOME/build-tools/<version>/aapt2 dump permissions \
  app/build/outputs/apk/debug/app-debug.apk

# or Android Studio → Build → Analyze APK → AndroidManifest.xml
```

Expected: **notification permissions only** (`POST_NOTIFICATIONS`,
`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`, `RECEIVE_BOOT_COMPLETED`,
`VIBRATE` — all merged in from `@capacitor/local-notifications`, all local
device features). **`android.permission.INTERNET` must NOT appear.** The CI
workflow (`.github/workflows/android.yml`) enforces this check on every APK.

## CI

`.github/workflows/android.yml` builds debug APKs for both editions on
`workflow_dispatch` and on `android/v*` tags, uploads them as artifacts and —
on tag pushes — attaches them to the matching release.

## APK signing (release) — intentionally deferred

Only **debug-keystore** builds are wired for now (Phase 4 / release
engineering will add a reproducible signed release pipeline: keystore
handling, versioning from `package.json`, and hash comparison). Do not
distribute the debug APK beyond testing.
