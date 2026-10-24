# Changelog

All notable changes to GoalCheck & GoalCheck Advance.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versions follow [SemVer](https://semver.org/).

## [0.7.0] — 2026-10-24

The 19-item "real-life workflows" drop (v4.4).

### Added
- **IndexedDB storage engine (schema v5)** — the workspace moved off localStorage:
  virtually unlimited quota, one-time automatic migration with a retained
  localStorage backup, quota-prune loop preserved. New per-task fields:
  `estimate` (focus units) and `attachments`; boards gained `archived`.
- **Calendar interop (`.ics`, Advance)** — RFC 5545 export (all-day events,
  folding, escaping) + tolerant `.ics`/VTODO import into a new board.
- **Natural-language quick add** — dates ("tomorrow", "next monday", "in 3 days"),
  `#category`, `!urgent`, `~2` focus estimate and "every week" recurrence parsed
  live into preview chips (dates stay plain text in the base edition).
- **Voice quick add** — Web Speech mic button in the quick-add bar, localized to
  the active UI language; hidden where unsupported.
- **Smart week planner (Advance)** — greedy capacity-aware rebalancing of
  overdue, overloaded and undated-urgent tasks across 7 days, preview +
  one-tap apply; per-day load bars in every Week view header.
- **Task attachments (Advance)** — up to 5 MB per file, bytes in the IndexedDB
  blob store, metadata in the workspace, inline image thumbnails, one-click open.
- **Archive** — boards retire instead of getting deleted; collapsible Archived
  section in the sidebar with restore/open.
- **Share links** — gzip-compressed board token in the URL hash (`#share=…`),
  server-free import dialog on open.
- **Print / PDF week plan (Advance)** — A4-landscape B/W week table via the
  print stylesheet.
- **4 new languages** — Français, Português (BR), 日本語, Русский (783-key
  catalogs each; hi/es/de caught up on the new keys).
- **Repo infrastructure** — optional-secrets Android signing (KEYSTORE_*),
  Lighthouse CI lane (perf/a11y/bp/seo budgets) + 2.6 MiB JS bundle budget,
  WebKit E2E project, visual-regression baselines (`GC_VISUAL=1`), Play Store
  listing kit + feature graphic, social share banner + OpenGraph tags,
  F-Droid/IzzyOnDroid prep sheet, PR template, FUNDING.

### Fixed
- Legacy v1 importer now preserves timer preferences and settings-object
  values that previously fell back to defaults on re-migration.

## [0.6.2] — 2026-10-23

### Added
- **Visible edition switcher in the header** (v4.3.2): a segmented
  `Normal | Advance` pill now sits in the header on every screen — the running
  edition is filled, one tap on the other opens a confirm dialog, and the
  workspace reloads as the other edition. No more digging through Settings.
  The switcher stays visible in *both* editions, so Normal is never a
  one-way door. (Advance builds only — base builds stay base by design.)
- Shared `switchEdition()` helper — the Settings card and the header
  switcher use the same persistence + post-reload welcome-toast flow.
- New golden-path E2E: full header-switcher round-trip
  (Advance → Normal → Advance, data + storage override asserted).
  Suite now **15 E2E** tests.

### Fixed
- Header layout at phone widths: the brand degrades to its icon below
  `md` so the switcher always fits with zero horizontal overflow
  (320 → 1280px verified); the full wordmark + Advance badge return on
  tablets and desktop.

## [0.6.1] — 2026-10-23

### Added
- **Full i18n extraction**: every screen's strings are now catalog-driven — 630 new keys,
  en/hi/es/de each key-complete at 721 keys (compile-enforced; onboarding paragraph
  bodies included). Content data stays English by design.
- **Drag-and-drop E2E suite** (`tests/e2e/dnd.spec.ts`, 5 tests): kanban column moves
  (@dnd-kit pointer path), calendar chip reschedule / schedule / unschedule, checklist
  row reorder — with reload-persistence assertions. Full suite: 92 unit + 14 E2E.
- README: v4.3 feature tour, Calendar + Deep Focus screenshots, Languages section.

### Fixed
- Playwright artifact folder (`test-results/`) gitignored.

## [0.6.0] — 2026-10-23

The 18-item community batch (v4.3) — see ROADMAP §v4.3 for the full matrix. Highlights:
calendar month view with drag-to-reschedule; roadmap/timeline view; Deep Focus overlay;
guided Weekly Review ritual; Year-in-Review Wrapped (shareable PNG); importers for
Todoist / TickTick / Google Tasks; local due-date reminders (service worker, opt-in);
auto-snapshot rotation for the sync file; per-task time tracking (logs + stopwatch);
Markdown notes with inline checklists; smart recurrence ("every 2nd Tuesday",
weekdays-only); drag-and-drop everywhere; global fuzzy search in the palette; PWA app
shortcuts + update toast; demo-data generator; resizable + compact Android widgets and
lock-screen readiness; F-Droid/Izzy fastlane metadata for both editions. 21 new unit
tests (suite 92). Android tag pipeline: `android/v*`.

## [0.5.1] — 2026-10-23

Web releases for the v4.2 17-feature drop (matrix in ROADMAP §v4.2); docs recording.

## [0.5.0] — 2026-10-20

E2E golden-path suite (9 Playwright tests) + CI quality lane; Android tag pipeline
hardening.


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
