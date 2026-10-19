# Changelog

All notable changes to GoalCheck & GoalCheck Advance.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added
- **In-app edition switch** (Advance builds): Settings → Edition toggles between
  Normal (GoalCheck) and Advance at runtime — persisted per device, applied on reload;
  data is shared losslessly. Base builds intentionally don't offer the switch.
- **Android shell glue**: hardware back button closes dialogs (then exits);
  local notifications when a focus session or recurring reset fires while the app is
  backgrounded (permission asked lazily at first timer start).
- **Custom Android adaptive icon + splash** generated from the brand mark
  (`scripts/gen-brand-assets.mjs` → `@capacitor/assets`).
- **Signed release pipeline** (`android/v*` tags): release APK + Play AAB when the
  keystore secret is configured; versioning derived from root `package.json`
  (`versionCode = major*10000 + minor*100 + patch`).
- Privacy policy page (`/privacy.html`), fastlane store metadata for both editions,
  SECURITY / CONTRIBUTING / CoC / issue templates.

## [0.4.1] — 2026-10-19

### Added
- **Phase 2 — PWA**: installable offline-first app (web app manifest per edition,
  scope-aware service worker, install card, storage-quota resilience with
  largest-image pruning); verified live with the network fully cut.
- **Phase 3 — Android (Capacitor)**: independent `capacitor/` shell, per-edition appIds,
  static-export bridge (`scripts/sync-capacitor.mjs`), **zero-INTERNET guarantee**
  (manifest patch + CI `aapt2` gate), debug APKs for both editions on `android/v*` tags.
- **Phase 2 — test suite**: 57 Vitest tests (schema migrations v1→v4, achievements,
  habit streaks, recurring respawn, quick-paste parser, XP curve, edition clamps)
  wired into the CI gate.

### Fixed
- `dueStatus()`: the `"later"` badge was unreachable (always-true ISO-week clause) —
  every future date rendered as "This week".
- Root typecheck excluded the independent `capacitor/` project (fresh checkouts failed).

## [0.4.0] — 2026-10-18

### Added
- First public release: GoalCheck (base) + GoalCheck Advance (pro), one codebase,
  two editions (`NEXT_PUBLIC_GC_EDITION`), shared storage schema v4 with migrations.
- v4 milestone (Advance): onboarding tour, habits & streaks, 13 achievements, due dates
  + This Week filter, recurring tasks, per-goal focus analytics, command palette,
  theme JSON sharing, Data Doctor, sync-file writer, auto-backup nudges.
- GitHub Pages live demo (static export, basePath-aware), CI matrix
  (lint + typecheck + both builds), MIT license, full security audit before publishing.

[Unreleased]: https://github.com/Avithegod2010/Goalcheck/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/Avithegod2010/Goalcheck/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/Avithegod2010/Goalcheck/releases/tag/advance/v0.4.0
