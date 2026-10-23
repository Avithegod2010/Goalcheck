# GoalCheck & GoalCheck Advance — Development Roadmap
### GitHub-first release → PWA → Android → (later) IzzyOnDroid & F-Droid

> Current state (Phase 0 ✅): the app is rebuilt as a Next.js 16 + TypeScript + Tailwind 4
> single-page workspace in **two editions** — GoalCheck (base) and GoalCheck Advance —
> switched by `NEXT_PUBLIC_GC_EDITION` (`bun run dev` / `bun run dev:base`).
> All data stays in `localStorage` (schema-versioned with migration hooks), there is no
> backend, no account, and zero network calls for core functionality.
> Both editions share the same storage schema, so switching between them never loses data.
>
> **F-Droid is intentionally deferred** — it's the most demanding store (reproducible
> builds, dependency-tree purity audit, months of review). We ship to GitHub first,
> gather users, then walk up the ladder. See `REPO-STRATEGY.md` for the repo split
> decision (answer: one monorepo, two edition apps, shared core).

---

## Phase 0 — Stabilize the web app ✅ (done)
- [x] Typed state store (Zustand) persisted to localStorage **with schema version + migration hook**
  - `goalcheck_pro_state` v3; auto-imports the legacy v1 key from the old HTML app
- [x] XSS class eliminated (all user text rendered through React escaping)
- [x] Pomodoro rebuilt on timestamps (`endsAt`), drift-free under tab throttling, survives reload
- [x] One shared `AudioContext`; 4 chime packs; 7 generative ambient streams (all local WebAudio)
- [x] `prefers-reduced-motion` support + "Reduce effects" battery-saver toggle
- [x] Image uploads canvas-downscaled + JPEG-aware compression; quota errors surfaced as toasts
- [x] Ripple transition fixed on light themes; no nested scroll; 44px+ touch targets
- [x] Full JSON backup + restore; delete confirmations; accessible focus rings; aria labels
- [x] 62-icon custom mono animated SVG set replacing stock emoji
- [x] Systemic motion design (stagger entrances, spring pills, count-ups) that degrades gracefully
- [x] Two-edition split (`editions.ts` feature registry + store clamps + UI gating)
- [x] **v4 milestone (Advance)** — the ideas backlog, now shipped:
  - [x] First-run onboarding tour (3 animated steps, edition-aware, replayable from Settings)
  - [x] Habits & streaks widget (daily/weekly cadence, streak flames, 7-period history dots)
  - [x] Achievements (13 badges, live unlock toasts, grid in RPG panel)
  - [x] Task due dates (date picker, Overdue/Today/This-week badges) + **This Week** filter
  - [x] Recurring tasks (daily/weekly auto-respawn with due-date carry-over, un-check rolls back)
  - [x] Priority-shaped completion chimes (urgent = bright arpeggio, high = 3-note lift)
  - [x] Per-goal focus-time analytics (Pomodoro sessions attributed to the bound task's board)
  - [x] Command palette expansion (`/done N`, `/goal <name>`, `/clear`, `/help`)
  - [x] Theme JSON sharing (export/import validated color-token files, live custom theme)
  - [x] Data Doctor (integrity scan: broken locks, dup ids, stale bindings + safe repairs)
  - [x] Sync-file writer (File System Access API — auto-save workspace JSON into a Syncthing/WebDAV folder)
  - [x] Auto-backup nudge card (7-day cadence, dismissible)
  - [x] Base edition "Discover GoalCheck Advance" card (same-schema upgrade promise)

## Next steps (immediate — the GitHub launch path) — status 2026-10-18
1. ~~Polish pass on v4 surfaces~~ ✅ shipped in the v4 milestone.
2. ~~Test suite~~ ✅ **done 2026-10-18** — Vitest suite (4 files, **57 tests**) covers schema migrations v1→v4 via real rehydration, `evaluateAchievements`, habit streak math (daily + weekly), heatmap streaks, recurring respawn + category resets, dependency locks, RPG XP curve, quick-paste parser, edition clamps and the quota-safe storage wrapper. **It immediately caught a real bug** (`dueStatus` returned `"week"` for every future date — fixed). CI gate = lint + typecheck + tests + both edition builds. *Playwright golden-path automation still open (browser E2E is currently manual).*
3. **i18n** — extract UI strings to `next-intl` catalogs (en-US first, community translations after the repo is public). *Still open → post-PWA.*
4. ~~Monorepo migration~~ → deferred (single codebase at root, `NEXT_PUBLIC_GC_EDITION` switch; see REPO-STRATEGY §5).
5. ~~GitHub Actions~~ ✅ CI matrix green (lint + strict typecheck + both edition builds).
6. ~~GitHub Pages demo~~ ✅ **LIVE** — https://avithegod2010.github.io/Goalcheck/ (Advance edition).

**Next micro-steps (pick up any time):**
- [x] Vitest unit tests for `store.ts` migrations, `logic.ts` (quick-paste parser, streaks, XP curve), and **edition clamps** — ✅ 57 tests green (2026-10-18)
- [ ] Playwright smoke suite for the golden path in BOTH editions
- [x] License: **MIT** (chosen 2026-10-18 — simpler, no patent-grant needs for a small app)
- [x] Privacy policy: *"No data collected. No analytics. No network. Everything stays on your device."* (in README + About)

---

## Phase 1 — GitHub launch 🎯 (status: 98% done 2026-10-18 — LIVE 🎉)
**Goal: a public repo + real releases + a live demo URL. No stores involved.**

**✅ Shipped (2026-10-18):**
- Public repo **`Avithegod2010/Goalcheck`** — single codebase at root, editions switched by
  `NEXT_PUBLIC_GC_EDITION` (the `apps/`+`packages/` split is deferred; see REPO-STRATEGY §5 note)
- `LICENSE` = **MIT**, README with screenshots of both editions + comparison table + live-demo CTA
- CI green on every push: `verify (advance)` + `verify (base)` — lint, strict typecheck, both builds
- **Releases published:** [`advance/v0.4.0`](https://github.com/Avithegod2010/Goalcheck/releases/tag/advance/v0.4.0)
  + [`base/v0.4.0`](https://github.com/Avithegod2010/Goalcheck/releases/tag/base/v0.4.0) with full notes
- **Repo About box set:** description + website link `https://avithegod2010.github.io/Goalcheck/`
- **GitHub Pages LIVE:** https://avithegod2010.github.io/Goalcheck/ — Advance edition, static export
  (`BUILD_TARGET=pages`, basePath `/Goalcheck`), deployed from `main` via Actions
- **Live-site E2E verified (2026-10-18):** boots clean, 0 console errors, onboarding tour fires,
  task add→toggle→persist survives reload (schema v4), no horizontal scroll at 390px, footer intact

**Remaining Phase 1 items:**
1. Branch protection on `main` (require the `verify` checks to pass) — Settings → Branches →
   Add branch protection rule → `main` → require status check `verify` *(needs admin UI or PAT)
2. Optional: topics for discoverability (gamification, pomodoro, habit-tracker, local-first,
   offline-first, productivity, task-manager, privacy, nextjs); CODE_OF_CONDUCT + issue templates;
   attach zipped static builds to future releases
3. **Announce** once, publicly: r/fossdroid, r/selfhosted, X/Mastodon, Product Hunt (optional)

**Deliverable:** `github.com/Avithegod2010/Goalcheck` — two green CI jobs ✅, two tagged releases ✅, live demo ✅.

---

## Phase 2 — PWA (installable, offline-first) ✅ (code complete 2026-10-18, offline verified)
**Goal: "Install app" on Android Chrome before any native wrapper.**

1. **Web App Manifest** (`src/app/manifest.ts`) ✅ — per-edition name/short_name/description,
   `display: standalone`, 192/512 + maskable icons (brand rocket on the header gradient),
   `theme_color`/`background_color` synced to the app shell; start_url/scope honour the
   Pages basePath via `NEXT_PUBLIC_GC_BASE_PATH`
2. **Service worker** (`public/sw.js`) ✅ — offline-first app shell: navigations =
   stale-while-revalidate, assets = cache-first; strictly same-origin (privacy), scope-aware
   (works on localhost, standalone server and GitHub Pages). **Verified live: with the network
   fully cut the app reboots from cache and tasks still save.**
3. **Install UX** (`src/components/goalcheck/Pwa.tsx`) ✅ — captures `beforeinstallprompt`,
   dismissible **Install** card in the main column (14-day cooldown), `appinstalled` toast
4. **Storage resilience** ✅ — quota-safe persist layer: on QuotaExceededError the largest
   embedded images are pruned (largest-first, tasks/notes/streaks never touched), user gets a
   toast + backup nudge; hard-full case gets its own warning
5. **Tests in CI** ✅ — `bun run test` (Vitest + jsdom, 57 tests) added to the `verify` matrix between typecheck and build (2026-10-18)

**Deliverable:** installable PWA, offline-capable — ✅ shipped.

**Lighthouse audit (2026-10-19, live site, mobile emulation):** Performance 49 · Accessibility 80 → **post-fix sweep: axe reports ZERO WCAG 2.0/2.1 AA violations on desktop AND mobile**. Fixed in the same session:
- **basePath bug** — hand-written `/icon.svg` + `/icons/icon-192.png` metadata links are emitted WITHOUT the `/Goalcheck` prefix on Pages (404s, broken favicon + console errors) → replaced with Next file-convention icons (`src/app/icon.svg|icon.png|apple-icon.png`) which get the basePath automatically.
- **a11y**: slider thumbs had no accessible name (label hoisted from Root to Thumb); goal + category progressbars unnamed; view-switcher `role=tablist` on the wrong wrapper; "New Board" button icon-only on mobile with no name; home-button label/name mismatch.
- **contrast**: tiny accent/warning/danger text on soft backgrounds (3.8–4.4:1) → `color-mix(in srgb, var(--gc-X) 55–62%, var(--gc-text))` (adapts correctly in BOTH light and dark themes); nebula/nordic `--gc-muted` lifted to AA.
- Remaining (perf lane): TBT 2.7 s / LCP 4.7 s on throttled mobile — heavy client bundle (framer-motion + all views in the initial chunk). Next lever: `next/dynamic` code-split of the four Advance views + deferred particle engine boot.

**Bonus fix from the new suite (2026-10-18):** `dueStatus()` in `logic.ts` had an always-true ISO-week clause that made the `"later"` due-date badge unreachable — every future date rendered as `"week"`. Fixed; the This Week filter (`inCurrentWeek`) was already correct and is unchanged.

---

## Phase 3 — Android via Capacitor
**Goal: ship APKs with ZERO internet permission — a genuine "local-only" app.**

> 📱 User-facing build/install/sideload guide: [`download/ANDROID.md`](./ANDROID.md)

1. ✅ **Scaffold per edition**: `io.github.<username>.goalcheck` and `io.github.<username>.goalcheckadvance`
   — two packages from the shared core (this is why the monorepo matters)
   — done: `capacitor/` shell scaffolded, edition picked by `GC_EDITION`; `cap add android` regenerates the native project on edition switch; APKs built via CI on `android/v*` tags (`gradlew assembleDebug`, debug-signed — release signing deferred)
2. ✅ **Export path**: Next.js `output: "export"` (static) served by Capacitor's local webserver
   — done: `bun run build:capacitor:advance|:base` → static `out/` → `capacitor/www/` → `cap sync`; verified end-to-end
3. ✅ **Permissions — target ZERO**: strip `INTERNET` from `AndroidManifest.xml` (Capacitor adds it by default);
   v1 recommendation: drop the mic source on Android (keep the synthesized streams)
   — done: INTERNET removed (idempotent patch re-applied by `scripts/sync-capacitor.mjs`; CI `aapt2 dump permissions` gate fails if it reappears); no `RECORD_AUDIO` in the native shell
4. ✅ **Local notifications** (`@capacitor/local-notifications`, no Play Services):
   pomodoro completion when backgrounded; recurring-category reset reminders
   — done v4.1: `src/lib/goalcheck/native.ts` fires both (only when the WebView is
   hidden); the POST_NOTIFICATIONS grant is asked lazily at the first timer start
5. ✅ **Back button** → close modal → exit (Capacitor `App.addListener('backButton')`)
   — done v4.1: topmost Radix dialog closes via synthetic Escape, otherwise the app exits
6. ✅ **Adaptive icon**: foreground = brand glyph (mono white), background = brand gradient
   — done v4.1: composed by `scripts/gen-brand-assets.mjs` (sharp) → `@capacitor/assets`;
   splash = dark canvas + violet glow + centered glyph. Regenerate after any brand change.
7. **Dark/light**: Android system setting → `colorMode: "system"` (already built)

**Deliverable:** signed debug APKs for both editions, no internet permission, tested on mid-range Android.

---

## Phase 4 — Release engineering (mostly done v4.1)
**Goal: reproducible, CI-built artifacts + store metadata.**

1. **CI on tag**: ✅ JDK 21 pinned, Bun pinned via setup-bun; remaining: pin Android SDK/NDK/Gradle
   → **reproducible builds** (F-Droid prerequisite)
2. ✅ **Versioning**: single source in `package.json` → synced into `build.gradle`
   (`versionCode = major*10000 + minor*100 + patch`, 0.4.1 → 401)
3. ✅ **Fastlane metadata** for both apps: `fastlane/metadata/android{,-base}/en-US/`
   (title, short/full descriptions, changelogs/401.txt, icon, feature graphic;
   phoneScreenshots still to add from `docs/screenshots/`)
4. ✅ **Signed release pipeline**: `android/v*` tags build release APK + AAB when the
   keystore secret is configured (`ANDROID_KEYSTORE_BASE64` + 3 more — see ANDROID.md §4);
   debug builds ship regardless so the pipeline never hard-blocks
5. ⬜ **Reproducibility check**: build twice on different machines, compare APK hashes

**Deliverable:** tag → CI publishes signed APKs + AAB + complete fastlane metadata. ✅ (modulo reproducibility pinning)

---

## Phase 5 — Publish (deferred — only when Phases 1–4 are boring-stable)
**Order: IzzyOnDroid first, F-Droid second. GitHub stays the primary home either way.**

1. **IzzyOnDroid (fast, usually days)**
   - tracks **signed GitHub releases** automatically — submit repo URL at
     https://gitlab.com/IzzyOnDroid/repo
   - requirements: FOSS license, no proprietary deps, fastlane metadata, signed releases
2. **F-Droid (weeks–months, ambitious goal — keep it parked until the rest is done)**
   - metadata MR to https://gitlab.com/fdroid/fdroiddata (`metadata/io.github.<username>.goalcheck{,pro}.yml`,
     with `subdir: apps/base` / `apps/pro` for the monorepo)
   - F-Droid builds from source and audits the **entire dependency tree** for FOSS purity:
     - fonts must be bundled locally — the current `next/font/google` dependency must go
       (self-host Geist or system font stack) — *most common first-MR rejection*
     - pin every toolchain; no `latest` anything
     - react/next/tailwind are MIT — fine
3. **Announce**: F-Droid forum thread, IzzyOnDroid Telegram, r/fossdroid, README badges

---

## Timeline estimate (solo, part-time)
| Phase | Duration | Gate |
|---|---|---|
| 0 wrap-up (tests + license) | 1–2 weeks | CI green |
| 1 GitHub launch | 1 week | repo live + 2 tagged releases + demo URL |
| 2 PWA | 1 week | Lighthouse PWA pass |
| 3 Capacitor | 2–3 weeks | signed APKs, 0 permissions |
| 4 Release eng. | 1–2 weeks | reproducible tag builds |
| 5a IzzyOnDroid | days | live listing |
| 5b F-Droid | 2–8 weeks (review) | live listing |

---

## Feature backlog — status after v4
✅ **Shipped in the v4 milestone:** habits & streaks · recurring tasks · due dates + This Week filter · per-goal focus analytics · file-based sync (sync-file writer) · offline achievements · command palette expansion (/done, /goal, /clear, /help) · theme JSON marketplace · base→Advance upgrade card · data doctor · priority-specific chimes · onboarding tour · auto-backup nudges.
✅ **Shipped in v4.1:** in-app edition switch (Normal⇄Advance, Advance builds) · Android back-button + background notifications · custom adaptive icon + splash · signed release pipeline + AAB · privacy policy page · fastlane metadata · SECURITY/CONTRIBUTING/CHANGELOG/CoC/issue templates.

⏭ **Still open (next up):**
1. **Full week view** — calendar-style board layout beyond the This Week filter (needs a date-grid design pass).
2. **Local reminders for due dates** — Web Notifications now, real local notifications in the Capacitor phase.
3. **i18n** — extract strings to `next-intl` catalogs; en-US first, community translations after going public.
4. **Android home-screen widget** — Glance AppWidget (today's tasks + start-pomodoro shortcut); Capacitor phase.
5. **Streak freezes** — spend XP to protect a streak; extends the RPG skill tree.
6. **Encrypted export** — passphrase-based WebCrypto encryption on backup JSON before cloud/sync usage.
7. **Theme gallery** — a README/website page collecting community theme JSON files.

---

## Honest risks & notes
- **localStorage on Android WebView** can be cleared more aggressively than a native DB. Phase 3 should add auto-export-on-exit or move to SQLite via `@capacitor-community/sqlite` (keep JSON import/export as the universal escape hatch).
- **F-Droid build purity**: the Google-Fonts dependency (`next/font/google`) must be removed before any F-Droid MR — bundle fonts locally.
- **Mic feature**: dropping `RECORD_AUDIO` keeps the "zero permissions" story clean; the synthesized streams already carry the audio-reactive experience.
- **Two products, one maintainer**: keep every shared change in `packages/core` and let the edition shells stay thin — the moment edition logic forks, the data-schema guarantee dies.

## v4.2 — the 17-feature drop ✅ (2026-10-23)

All 17 community ideas shipped (some with honest scoping):

| # | Feature | Status |
|---|---------|--------|
| 1 | Code-split Advance views (`next/dynamic` + skeletons) | ✅ |
| 2 | Week view (7-day planner over due/recurrence engine) | ✅ |
| 3 | Streak freezes (earn every 7 periods, max 2, settings toggle) | ✅ |
| 4 | Encrypted export — AES-256-GCM `.gcenc` vault (WebCrypto/PBKDF2) | ✅ |
| 5 | NL/external intake everywhere (PWA share_target + native share sheet + Quick Tile → Quick Paste) | ✅ |
| 6 | Report card — shareable canvas (week/month/all) | ✅ |
| 7 | Community packs — URL/paste import, sanitized, sidebar-integrated | ✅ (QR display dropped: no scan path in a zero-network app) |
| 8 | i18n foundation — typed catalogs en/hi/es/de + picker (`gc_locale`) | ✅ (shell strings; per-screen extraction ongoing) |
| 9 | Android home-screen widget (board, next task, progress, pomo) | ✅ CI-compiled |
| 10 | Quick Settings tile + share-sheet intent | ✅ CI-compiled |
| 11 | WebDAV vault sync (client-side, optional) | ✅ (CORS depends on the server) |
| 12 | Self-hosted fonts (`geist` pkg) — F-Droid no-fetch rule met | ✅ |
| 13 | Browser companion extension (MV3, context menu + popup) | ✅ loadable source |
| 14 | Playwright golden-path E2E (9 tests) + CI gate | ✅ |
| 15 | High-contrast theme (both editions) + text-size 90–130% | ✅ |
| 16 | Data Doctor: storage meter + 30-day scheduled scan + auto-repair | ✅ |
| 17 | Seasonal challenges (monthly XP/streak/percent) in RPG modal | ✅ |

New gates: `E2E` workflow (chromium) on every push/PR; Android collect step fixed
for debug-only builds (no signing secrets → no .aab → `ls` glob guard).

**Releases for this drop:** [`advance/v0.5.1`](https://github.com/Avithegod2010/Goalcheck/releases/tag/advance/v0.5.1)
+ [`base/v0.5.1`](https://github.com/Avithegod2010/Goalcheck/releases/tag/base/v0.5.1)
(2026-10-23, tagged at `812f2e1`). Android APKs ride the `android/*` tag pipeline.

---

## v4.3 — the 18-item community batch ✅ (2026-10-23)

The second full-ideas-list drop. All 18 shipped (web, PWA, Android, stores):

| # | Feature | Status |
|---|---------|--------|
| 1 | Calendar month view — drag chips to reschedule, unschedule pool | ✅ |
| 2 | Roadmap timeline — 8-week mini-Gantt across boards + dependency locks | ✅ |
| 3 | Deep-Focus mode — fullscreen one-task overlay bound to the pomodoro (`/focus N`) | ✅ |
| 4 | Weekly Review ritual — celebrate → reschedule → focus, saved journal | ✅ |
| 5 | Global fuzzy search — live results in the Ctrl+K palette across all boards | ✅ |
| 6 | Drag-and-drop everywhere — reorder categories/tasks, cross-category, kanban within columns | ✅ (HTML5 in checklist; kanban via dnd-kit card droppables) |
| 7 | Importers — Todoist JSON / Google Tasks Takeout / TickTick CSV, on-device | ✅ |
| 8 | Auto-snapshot rotation — picked folder, daily/weekly cadence, keep-N | ✅ |
| 9 | Time tracking — per-task stopwatch, banked seconds, shown in editor | ✅ |
| 10 | Markdown notes — safe renderer, interactive `[ ]` checkboxes in preview | ✅ |
| 11 | Smart recurrence editor — weekdays / every-N / monthly-on-the-Nth-<weekday> | ✅ |
| 12 | Local due-date reminders — Notification API + native path, once/day dedupe, opt-in | ✅ |
| 13 | Android widgets — resizable 3×1 + new compact 2×1, lock-screen (`keyguard`) ready | ✅ (gradle-verified) |
| 14 | PWA app shortcuts (?view=) + update-available toast (waiting SW + Reload) | ✅ |
| 15 | Year-in-Review Wrapped — shareable 900×560 PNG card | ✅ |
| 16 | i18n — new-surface keys (en/hi/es/de) + view tabs translated; full per-screen extraction ongoing | ✅ (scoped honestly) |
| 17 | Demo-data generator — onboarding "Try demo data" + Settings + /demo | ✅ |
| 18 | F-Droid/Izzy metadata — both editions' fastlane catalogs + FDROID-CHECKLIST.md | ✅ (code side) |

Also fixed en route: v4.2 community-pack bug (board object compared against id — packs
never applied); `z-ai-web-dev-sdk` moved out of production dependencies (store review).
New tests: 21 (recurrence math, fuzzy scorer, recap aggregation, checkbox toggling,
demo workspace invariants) — suite at **92 green**. Browser-verified: calendar/roadmap/
deep-focus/review/wrapped/import/demo/settings all exercised end-to-end at 390px & 1280px,
zero console errors.
