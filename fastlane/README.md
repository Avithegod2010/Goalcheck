# Fastlane metadata — two editions, one repo

Store/listing metadata consumed by IzzyOnDroid and F-Droid (fastlane supply structure).

| Directory | Application ID | Product |
|---|---|---|
| `metadata/android/` | `io.github.avithegod2010.goalcheckadvance` | GoalCheck Advance (full edition) |
| `metadata/android-base/` | `io.github.avithegod2010.goalcheck` | GoalCheck (Normal edition) |

- `changelogs/<versionCode>.txt` — versionCode = `major*10000 + minor*100 + patch` of the root
  `package.json` (0.4.1 → 401). Bump with every release train.
- Store screenshots live in `docs/screenshots/` — copy the best into
  `images/phoneScreenshots/` (min 2, 16:9 or 9:16) before F-Droid submission.
- Both apps share the MIT license, the privacy policy (`public/privacy.html` on the live
  site) and the zero-INTERNET Android guarantee.
