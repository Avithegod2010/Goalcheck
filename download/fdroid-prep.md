# F-Droid / IzzyOnDroid prep — snapshot (task 17-g)

> **Prep only.** Nothing here is a submission decision — submitting GoalCheck to
> F-Droid or IzzyOnDroid is a **maintainer decision**, taken when the blockers
> below are cleared. The long-form working document lives in
> [`FDROID-CHECKLIST.md`](FDROID-CHECKLIST.md); this file is the short, honest
> status sheet that links the pipeline work to the store requirements.

## App identity

| Field | Value |
|---|---|
| applicationId (Advance shell) | `io.github.avithegod2010.goalcheckadvance` (`capacitor/android/app/build.gradle`) |
| License | MIT (repo root `LICENSE`) — F-Droid-compatible ✅ |
| Anti-features | **None.** No ads, no tracking, no network permission, no non-free deps |
| versionName / versionCode | derived from root `package.json` (`major*10000 + minor*100 + patch`; 0.6.2 → 602) |
| Zero-permission build | ✅ INTERNET stripped; `android.yml` fails any APK that declares it (aapt2 gate) |
| Fastlane metadata | ✅ `fastlane/metadata/android{,-base}/en-US/` (title, descriptions, changelogs, icon, featureGraphic) |

## Signed-release prerequisite — and the current blocker

**Blocker: published Android artifacts are unsigned (debug-signed) until the
keystore secrets are configured on the repo.** F-Droid and IzzyOnDroid both
require APKs signed with a developer-held key — debug-signed artifacts cannot
be accepted (and cannot be updated-over on devices).

The pipeline (`.github/workflows/android.yml`) already supports signing via the
optional-secrets pattern; nothing in the repo holds key material:

1. Generate a keystore locally (`keytool`, see [`ANDROID.md`](ANDROID.md)).
2. Set **all four** repo secrets — `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`,
   `KEY_ALIAS`, `KEY_PASSWORD` (legacy `ANDROID_`-prefixed names are honoured
   as a fallback). Partial sets are ignored with a notice; the build never
   hard-fails without them.
3. Push an `android/vX.Y.Z` tag — CI decodes the keystore into `$RUNNER_TEMP`
   and passes `-PgcKeystoreFile/-PgcKeystorePassword/-PgcKeyAlias/-PgcKeyPassword`
   to Gradle (`capacitor/android/app/build.gradle` activates the release
   signing config only when all four properties arrive). Signed APK + AAB are
   attached to the tag's release.

Until step 2 happens, `android/v*` releases ship debug APKs only — that is the
single outstanding gate for store submission.

## IzzyOnDroid requirements — summary

IzzyOnDroid (the usual first stop; reads metadata straight from the app repo):

- ✅ **Signed release APKs on GitHub Releases** — pipeline ready, blocked on the
  keystore secrets above (tags must point at signed builds).
- ✅ **License + source** — MIT, public repo, issue tracker linked.
- ✅ **Fastlane metadata structure** — `fastlane/metadata/android/en-US/` with
  `title.txt`, `short_description.txt`, `full_description.txt`, changelogs per
  versionCode, icon + featureGraphic. Base edition mirrors under
  `android-base/`. (IzzyOnDroid consumes this for the store listing.)
- ✅ **fdroid metadata yaml draft** — `FDROID-CHECKLIST.md` §1 sketches the
  `fdroiddata` Build entries (`subdir: capacitor/android/app`, prebuild runs
  the web export + `scripts/sync-capacitor.mjs`).
- ⬜ **Phone screenshots** in `fastlane/metadata/*/en-US/images/phoneScreenshots/`
  — still empty at snapshot time.
- ⬜ **Reproducibility proof** — build-twice-compare-hashes not yet recorded.

## F-Droid (after IzzyOnDroid)

Full `fdroiddata` metadata MR + srclib/prebuild recipe iteration with the
F-Droid reviewers — see [`FDROID-CHECKLIST.md`](FDROID-CHECKLIST.md) §1/§4.
Prerequisite chain: signed tags (above) → pinned SDK/NDK/Gradle in CI →
reproducible-build evidence → metadata MR.

## Status snapshot (2026, task 17-g)

| Item | Status |
|---|---|
| FOSS license / anti-features | ✅ / none |
| Zero-INTERNET CI gate | ✅ |
| Fastlane metadata (both editions) | ✅ |
| Signing pipeline (optional secrets → `-P` gradle props) | ✅ wired |
| **Signed published APKs** | ⬜ **blocked on the 4 keystore secrets** |
| Phone screenshots | ⬜ |
| Reproducible-build proof | ⬜ |
| Submission decision | ⬜ maintainer's call — not requested yet |
