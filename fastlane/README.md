# Fastlane metadata — two editions, one repo

Store/listing metadata consumed by IzzyOnDroid and F-Droid (fastlane supply structure).

| Directory | Application ID | Product |
|---|---|---|
| `metadata/android/` | `io.github.avithegod2010.goalcheckadvance` | GoalCheck Advance (full edition) |
| `metadata/android-base/` | `io.github.avithegod2010.goalcheck` | GoalCheck (Normal edition) |

- `title.txt` — "GoalCheck Advance" (17 chars) / "GoalCheck" (9 chars), both under the 30-char limit.
  The two titles are deliberately different: both apps are listed side by side on the same
  stores, so the Advance app must keep its own brand. A plain "GoalCheck" title for the
  Advance listing would collide with the base listing (and with its applicationId).
- `changelogs/<versionCode>.txt` — versionCode = `major*10000 + minor*100 + patch` of the root
  `package.json` (0.4.1 → 401, 0.5.1 → 501). Bump with every release train. Present:
  `401.txt`, `501.txt`.
- `short_description.txt` ≤ 80 chars, `full_description.txt` ≤ 4000 chars — both verified.
- **Still missing (TODO, see `download/FDROID-CHECKLIST.md`):**
  - `images/phoneScreenshots/` — empty placeholder dirs (`.gitkeep`) in both editions;
    source material in `docs/screenshots/` is 1440×900 desktop — re-capture at 1080×1920
    (9:16) from a phone-shaped viewport, min 2 per app.
  - `images/tvBanner.png` only if a TV listing is ever wanted (optional).
- Both apps share the MIT license, the privacy policy (`public/privacy.html` on the live
  site) and the zero-INTERNET Android guarantee. F-Droid submission guide:
  `download/FDROID-CHECKLIST.md`.
