# GoalCheck for Android — build & install guide

GoalCheck ships as a **real Android app** built with Capacitor: the exact same
local-first web app wrapped in a native shell. The headline feature:

> **ZERO permissions — not even `INTERNET`.**
> The APK's merged manifest contains no permission requests at all. The app
> physically cannot phone home: no analytics, no telemetry, no network stack.
> Your data lives in the app's local storage and nowhere else.

This is enforced in three places:

1. `INTERNET` is stripped from `capacitor/android/app/src/main/AndroidManifest.xml`
   (with an explanatory comment in the file itself),
2. `scripts/sync-capacitor.mjs` re-applies the patch on every sync and **hard-fails**
   if the permission reappears,
3. CI runs `aapt2 dump permissions` on the built APK and **fails the build** if
   `INTERNET` (or any unexpected permission) shows up in the merged manifest.

---

## 1. Which app do I get?

| Edition | App name | Package (`applicationId`) | Source |
|---|---|---|---|
| GoalCheck Advance | GoalCheck Advance | `io.github.avithegod2010.goalcheckadvance` | `NEXT_PUBLIC_GC_EDITION=pro` |
| GoalCheck (base) | GoalCheck | `io.github.avithegod2010.goalcheck` | `NEXT_PUBLIC_GC_EDITION=base` |

Both editions read the **same storage schema**, so you can install Advance,
later switch to base (or vice-versa) without losing data via JSON backup/restore.

## 2. Getting an APK (no Android Studio needed)

### Option A — let GitHub build it (recommended)

The `android.yml` workflow builds both editions automatically:

- **Automatic:** push (or ask your agent to push) a tag matching `android/v*`
  — e.g. `android/v0.4.0`. The workflow builds debug-signed APKs and attaches
  them to the matching GitHub release.
- **Manual:** repo → **Actions → android → Run workflow** → pick an edition
  → download the APK from the run's **Artifacts** section.

Artifacts: `GoalCheckAdvance-debug.apk` / `GoalCheck-debug.apk`.

### Option B — sideload the artifact

1. Download the APK on your phone (or transfer it).
2. Tap it → Android will warn about unknown apps → allow **Install unknown
   apps** for your browser/file manager (Settings → Apps → Special access).
3. Install. Open the app. That's it — no account, no network, ever.
4. To migrate from the web app: open the PWA/web version → **Export backup**
   (JSON) → in the Android app use **Import**.

## 3. Building locally (optional)

Prereqs: JDK 17 + Android SDK (Android Studio), Bun or Node.

```bash
# Advance edition
bun run build:capacitor:advance        # static export -> capacitor/www -> cap sync
cd capacitor/android && ./gradlew assembleDebug
# APK: capacitor/android/app/build/outputs/apk/debug/app-debug.apk

# Base edition (regenerates the native project with the base appId)
cd ../.. && bun run build:capacitor:base
```

Switching editions regenerates the native project (`cap add android` bakes the
appId/appName in) — expect git churn under `capacitor/android/` when you flip.

## 4. Signing

Current CI builds are **debug-signed** — fine for sideloading and IzzyOnDroid
testing, not for Play Store. For a release keystore:

```bash
keytool -genkeypair -v -keystore goalcheck.keystore -alias goalcheck \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then either build locally (`assembleRelease` with signing config) or add these
GitHub secrets and extend `android.yml`:
`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

> Keep the keystore + passwords safe and offline — losing them means you can
> never update the same app entry on Play Store (GitHub/Izzy releases are
> unaffected; each APK can be installed fresh).

## 5. Verifying the zero-INTERNET guarantee yourself

```bash
# after any build
aapt2 dump permissions app.apk          # expect: (empty)
# or
apkanalyzer manifest permissions app.apk
```

If you ever see `android.permission.INTERNET` in the merged manifest, stop —
a dependency added it. That is an explicit reject per the comment in the
AndroidManifest.

## 6. Store listing path (IzzyOnDroid → F-Droid)

- ✅ FOSS license (MIT), ✅ no proprietary dependencies, ✅ signed releases,
  ✅ zero permissions, ✅ no trackers.
- **IzzyOnDroid**: submit the repo URL at <https://gitlab.com/IzzyOnDroid/repo>
  — it tracks signed GitHub releases automatically. Fastest route.
- **F-Droid**: needs fully reproducible source builds — parked until Phase 4
  (pinned toolchains + removing the Google-Fonts dependency, see ROADMAP §5b).

## 7. Known Android-shell TODOs

- Pomodoro local notifications: plugin wired in `capacitor.config.ts`,
  runtime scheduling not yet implemented.
- Back-button handling (close modal → exit) not yet wired.
- Splash/adaptive icon uses the brand-generated set; the custom rocket
  design is still on the backlog.

Details for maintainers live in `capacitor/README.md`.
