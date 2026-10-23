# F-Droid / IzzyOnDroid Submission Checklist — GoalCheck

> Status marker for this file's creation: repo version **0.5.1** (package.json),
> versionCode **501** (`major*10000 + minor*100 + patch` — same rule as
> `capacitor/android/app/build.gradle:32` and `fastlane/README.md`).
> Roadmap context: ROADMAP.md Phase 5 — *IzzyOnDroid first, F-Droid second.*

---

## 0. Current status snapshot

| Requirement | Status |
|---|---|
| FOSS license (MIT) | ✅ `LICENSE` |
| Fastlane metadata, both editions | ✅ `fastlane/metadata/android{,-base}/en-US/` (title, short/full descriptions, changelogs 401 + 501, icon, featureGraphic) |
| No build-time font fetching | ✅ v4.2 — fonts self-hosted via the `geist` npm package (see §2) |
| Zero-permission Android build | ✅ INTERNET stripped + CI `aapt2` gate (`download/ANDROID.md`) |
| Signed release APKs | ✅ pipeline wired (`android/v*` tags + 4 keystore secrets) |
| **Phone screenshots** | ⬜ `images/phoneScreenshots/` still empty (see §6) |
| **Pinned Android SDK/NDK/Gradle** | ⬜ JDK 21 + Bun are pinned in CI; SDK/NDK/Gradle not yet (see §4) |
| **Reproducibility proof** | ⬜ build-twice-compare-hashes not yet done (see §4) |
| F-Droid `fdroiddata` metadata MR | ⬜ draft in §1 — submit only after the two ⬜ above |

---

## 1. Build metadata — what F-Droid expects (`fdroiddata`)

F-Droid does **not** consume your repo's fastlane tree for building; it builds from a
metadata file in the [fdroiddata](https://gitlab.com/fdroid/fdroiddata) repo. Fastlane
metadata is consumed for the *store listing* once the app is in (and IzzyOnDroid reads
it from your repo directly). Draft MR files:

`metadata/io.github.avithegod2010.goalcheckadvance.yml` (Advance):

```yaml
Categories:
  - Productivity
  - Time
License: MIT
AuthorName: Avithegod2010
SourceCode: https://github.com/Avithegod2010/Goalcheck
IssueTracker: https://github.com/Avithegod2010/Goalcheck/issues
WebSite: https://avithegod2010.github.io/Goalcheck/
Changelog: https://github.com/Avithegod2010/Goalcheck/releases

RepoType: git
Repo: https://github.com/Avithegod2010/Goalcheck.git

Builds:
  - versionName: 0.5.1
    versionCode: 501
    commit: advance/v0.5.1
    subdir: capacitor/android/app
    gradle:
      - yes
    # prebuild step must run the web build first:
    #   bun install && bun run build:capacitor:advance
    # (see §4 — the exact srclib/prebuild recipe is what the reviewer iterates on)
```

`metadata/io.github.avithegod2010.goalcheck.yml` (base): identical, but
`commit: base/v0.5.1` and `bun run build:capacitor:base`.

Notes for the MR:
- `versionCode` mapping must match the app exactly: **501 for 0.5.1**. Never invent
  placeholder codes (502/520 etc.) — F-Droid checks update chains and will reject a
  code that doesn't correspond to a real build/tag.
- Each edition is a **separate package** (`io.github.avithegod2010.goalcheck{,advance}`)
  → two metadata files, two reviews. Both share the same changelog train (401, 501).
- The tag format is `advance/vX.Y.Z` and `base/vX.Y.Z` (see ROADMAP/CHANGELOG), hence
  `commit: advance/v0.5.1`.
- Add `UpdateCheckMode: HTTP`/tags config once the naming convention is confirmed stable
  (`UpdateCheckData` against the GitHub releases API).

## 2. The no-fetch rule — status: ✅ MET (verify per release)

F-Droid's hard rule: **the build must not download anything at build time**
(most common first-MR rejection — `next/font/google` fetching fonts.googleapis.com).

Verified in this repo (grep, 2026-10-24, v0.5.1 tree):

- `src/app/layout.tsx:7-8` — `import { GeistSans } from "geist/font/sans"` +
  `GeistMono` from the **`geist` npm package** (v1.8.2, OFL). The comment block at the
  top documents the v4.2 switch away from `next/font/google`.
- Grep for `fonts.googleapis|fonts.gstatic|next/font/google` → **zero hits in code**
  (only historical mentions in `download/ROADMAP.md` and the explanatory comment in
  `layout.tsx`).
- `src/app/globals.css` → no `@import url(...)` / remote `url()` at all.
- Static export bakes the `.woff2` files into the APK
  (`capacitor/android/app/src/main/assets/public/_next/static/media/*.woff2`).

**Remaining *runtime* fetches (all user-initiated, none automatic):**
- `src/components/goalcheck/modals.tsx:1757` — community-pack import can `fetch(u, {mode:"cors"})` a URL the user pasted.
- `src/components/goalcheck/modals.tsx:189` — image/GIF URL field (loads a user-supplied image).
- Optional WebDAV vault sync — only talks to the server **the user** configures.

These do **not** violate the no-fetch build rule (nothing is fetched during build) and
are inert in the Android APK because the build has no INTERNET permission (the WebView
physically cannot fetch). Declare them in the MR description anyway — reviewers accept
"optional, user-directed sync" far more readily when you point at it first.

**Dependency-tree purity TODO (user-side):**
- `package.json:66` declares `z-ai-web-dev-sdk` in **dependencies** but it is never
  imported anywhere in `src/` (verified by grep). Move it to `devDependencies` or delete
  it before the MR — reviewers audit the whole install tree and an unused unknown-SDK
  dependency invites a query round-trip.
- Everything else is MIT/ISC/Apache-class (react, next, radix, framer-motion, capacitor
  core are fine); `@capacitor/local-notifications` adds only local-device permissions.

## 3. Permissions — the zero-permission story

- `capacitor/android/app/src/main/AndroidManifest.xml` contains **no
  `uses-permission` at all** — the `INTERNET` permission is deliberately removed
  (long comment in the file) and `scripts/sync-capacitor.mjs` re-applies/verifies the
  patch; CI fails if `aapt2 dump permissions` shows `INTERNET`.
- Merged-in from `@capacitor/local-notifications` (local device features, documented as
  acceptable in the manifest comment): `POST_NOTIFICATIONS`, `SCHEDULE_EXACT_ALARM`,
  `RECEIVE_BOOT_COMPLETED`, `VIBRATE`. Expect F-Droid's package scanner to list these;
  they are fine — reply that they serve local reminders only.
- Widget + Quick-Settings tile (v0.5.1) added **no** permissions
  (`BIND_QUICK_SETTINGS_TILE` is held by the system, not requested).
- ⚠ Cosmetic bug found while auditing: line 71 of the manifest is a stray `&gt;`
  (leftover from the patch script). Valid XML, builds fine — tidy it up before the MR
  so the reviewer doesn't ask.

## 4. Reproducible-build notes

F-Droid builds on their server with `fdroidserver` and publishes their build, so your
job is to make a clean-room build trivially reproducible:

1. **Pin everything**: JDK 21 ✅ (CI), Bun ✅ (CI), `next` is exact-pinned ✅. Remaining:
   pin the Android SDK components (build-tools/platform) and the **Gradle wrapper +
   NDK** versions in `capacitor/android/gradle/wrapper/gradle-wrapper.properties` and
   CI — no `latest`, ever.
2. Bun's `bun.lock` is committed ✅ — keep it that way; mention it in the MR.
3. The web build must be hermetic: `next build` with the fonts rule satisfied (§2) and
   no telemetry (Next.js telemetry off / `NEXT_TELEMETRY_DISABLED=1` — add to the
   build recipe; it's on by default in CI sandboxes but be explicit).
4. Add a **build-twice test** to the pre-MR checklist: same tag, two machines (or two
   CI runs with `--refresh-dependencies`), compare `sha256sum` of the APKs. Differences
   typically come from Gradle build-cache paths — use `-Dorg.gradle.caching=false` or
   align fixed timestamps if needed.
5. Expect the reviewer to ask for `subdir` + prebuild details: `bun install` →
   `bun run build:capacitor:advance|:base` → `gradle assembleRelease` with their signing.
   Keep `scripts/sync-capacitor.mjs` deterministic (it re-applies the manifest patch —
   good, but confirm no timestamp/log output lands in the APK).

## 5. Signing notes

- **IzzyOnDroid**: consumes **your signed** release APKs from GitHub releases — the
  existing pipeline (`ANDROID_KEYSTORE_BASE64` + password/alias secrets, see
  `download/ANDROID.md` §4) is exactly what's needed. Keep the keystore offline and
  backed up; losing it breaks the update chain on Izzy/Play (not on F-Droid proper).
- **F-Droid**: signs with **their** key after their own build — you only need the
  build to succeed; do *not* send them your keystore. versionCode/versionName must
  match the tag; they reject mismatches.
- Debug-signed APKs are fine for sideloading/testing but not for either store — make
  sure the `android/v*` release job has the 4 secrets set before submitting.

## 6. Graphics — still needed (TODO, images not generated by this task)

Fastlane expects these under both `fastlane/metadata/android{,-base}/en-US/images/`:

| Asset | Size | Status |
|---|---|---|
| `icon.png` | 512×512 | ✅ present (both editions) |
| `featureGraphic.png` | 1024×500 | ✅ present (both editions) |
| `phoneScreenshots/*.png` | 9:16, e.g. 1080×1920 (min 2, up to 8) | ⬜ **TODO** — dirs created with `.gitkeep` |
| `tenInchScreenshots/` (optional) | 16:9 landscape | ⬜ optional |
| `tvBanner.png` (optional) | 1280×720 | ⬜ optional — skip unless listing TV |

Screenshot capture TODO (no images generated here):
1. Source material in `docs/screenshots/` is **1440×900 desktop** — wrong aspect for
   phone listings; re-capture from a ~390×844 (or 1080×1920) viewport instead.
2. Advance: checklist, Kanban, Matrix, Analytics, Week view, RPG/heatmap panel.
3. Base: checklist, Pomodoro focus, JSON/encrypted-backup export sheet.
4. F-Droid ignores phoneScreenshots unless present; Izzy shows them — worth doing
   before the Izzy submission.

## 7. Recommended submission order

1. **IzzyOnDroid first** (review in days): sign a release, tag `android/v0.5.1`, attach
   the signed APKs, then open a ticket at <https://gitlab.com/IzzyOnDroid/repo> with the
   repo URL. It tracks signed GitHub releases automatically and reads this repo's
   fastlane metadata. Add the two screenshots sets first (§6) so the listing lands nice.
2. **F-Droid second** (weeks–months): finish §4 reproducibility pins, move
   `z-ai-web-dev-sdk` out of `dependencies` (§2), then file the two `fdroiddata` MRs
   from §1. Reference the Izzy listing + zero-permission `aapt2` output in the MR text.
3. After acceptance: keep `changelogs/<versionCode>.txt` in sync every release train —
   it feeds both stores' "What's new".
