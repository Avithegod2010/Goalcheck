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

## Next steps (immediate — the GitHub launch path)
1. **Polish pass on v4 surfaces** — mobile widths for the Habits widget & onboarding, empty-state art for achievements, sound-design pass on the new chime variants.
2. **Test suite** — Vitest for schema migrations (v1→v4!), `evaluateAchievements`, habit streak math, recurring-respawn logic; Playwright golden path per edition.
3. **i18n** — now that features are frozen for release: extract UI strings to `next-intl` catalogs (en-US first, community translations after the repo is public).
4. **Monorepo migration** (1 day, recipe in `REPO-STRATEGY.md` §4) → Apache-2.0 LICENSE → README with screenshots of both editions.
5. **GitHub Actions** — lint + typecheck + both edition builds; tag `base/vX` / `advance/vX` → auto-attach static-export zips to Releases.
6. **GitHub Pages demo** for both editions + PWA manifest/service worker (Phase 2).

**Next micro-steps (pick up any time):**
- [ ] Vitest unit tests for `store.ts` migrations, `logic.ts` (quick-paste parser, streaks, XP curve), and **edition clamps**
- [ ] Playwright smoke suite for the golden path in BOTH editions
- [ ] License: **Apache-2.0** (recommended — F-Droid-friendly, patent grant) or MIT/GPL-3.0
- [ ] Privacy policy: *"No data collected. No analytics. No network. Everything stays on your device."*

---

## Phase 1 — GitHub launch 🎯 (status: ~90% done 2026-10-18)
**Goal: a public repo + real releases + a live demo URL. No stores involved.**

**✅ Already shipped (2026-10-18):**
- Public repo **`Avithegod2010/Goalcheck`** — single codebase at root, editions switched by
  `NEXT_PUBLIC_GC_EDITION` (the `apps/`+`packages/` split below is deferred; see REPO-STRATEGY §5 note)
- `LICENSE` = **MIT**, README with screenshots of both editions + comparison table
- CI green on every push: `verify (advance)` + `verify (base)` — lint, strict typecheck, both builds
- **Releases published:** [`advance/v0.4.0`](https://github.com/Avithegod2010/Goalcheck/releases/tag/advance/v0.4.0)
  + [`base/v0.4.0`](https://github.com/Avithegod2010/Goalcheck/releases/tag/base/v0.4.0) with full notes
- Pages pipeline: static export (`BUILD_TARGET=pages`, basePath `/Goalcheck`) verified locally + builds
  green on CI (`build ✅`); deploy pending one-time "Settings → Pages → Source: GitHub Actions" click

**Remaining Phase 1 items:**
1. **Enable Pages** — Settings → Pages → Build and deployment → Source: **GitHub Actions**,
   then re-run the failed *Deploy to GitHub Pages* workflow (Actions tab → Re-run failed jobs)
2. **Repo About box** — paste description + homepage `https://avithegod2010.github.io/Goalcheck/`
   (or re-issue the PAT with `Administration: RW` and the bot sets both + enables Pages via API)
3. Branch protection on `main` (require the `verify` checks to pass)
4. Optional: CODE_OF_CONDUCT + issue templates; attach zipped static builds to future releases
5. **Announce** once, publicly: r/fossdroid, r/selfhosted, X/Mastodon, Product Hunt (optional)

**Deliverable:** `github.com/Avithegod2010/Goalcheck` — two green CI jobs ✅, two tagged releases ✅, live demo link ⏳ (one click away).

---

## Phase 2 — PWA (installable, offline-first)
**Goal: "Install app" on Android Chrome before any native wrapper.**

1. **Web App Manifest** (`app/manifest.ts`): per-edition name/short_name, `display: standalone`,
   192/512 + maskable icons, `theme_color` synced to the theme engine
2. **Service worker**: precache the app shell; fully client-side → offline-first is trivial
3. **Install UX**: custom "Add to Home Screen" prompt (`beforeinstallprompt`)
4. **Storage resilience**: `QuotaExceededError` → auto-prune old images, warn, suggest backup;
   consider IndexedDB for image blobs
5. **Tests** from Phase 0 green in CI

**Deliverable:** installable PWA, Lighthouse PWA ✓, fully offline.

---

## Phase 3 — Android via Capacitor
**Goal: ship APKs with ZERO internet permission — a genuine "local-only" app.**

1. **Scaffold per edition**: `io.github.<username>.goalcheck` and `io.github.<username>.goalcheckadvance`
   — two packages from the shared core (this is why the monorepo matters)
2. **Export path**: Next.js `output: "export"` (static) served by Capacitor's local webserver
3. **Permissions — target ZERO**: strip `INTERNET` from `AndroidManifest.xml` (Capacitor adds it by default);
   v1 recommendation: drop the mic source on Android (keep the synthesized streams)
4. **Local notifications** (`@capacitor/local-notifications`, no Play Services):
   pomodoro completion when backgrounded; recurring-category reset reminders
5. **Back button** → close modal → exit (Capacitor `App.addListener('backButton')`)
6. **Adaptive icon**: foreground = mono rocket SVG, background = theme gradient
7. **Dark/light**: Android system setting → `colorMode: "system"` (already built)

**Deliverable:** signed debug APKs for both editions, no internet permission, tested on mid-range Android.

---

## Phase 4 — Release engineering
**Goal: reproducible, CI-built artifacts + store metadata.**

1. **CI on tag**: pin Bun/Node/JDK 17/Android SDK/NDK/Gradle → **reproducible builds** (F-Droid prerequisite)
2. **Versioning**: single source in `package.json` → synced into `build.gradle`
3. **Fastlane metadata** for both apps:
   ```
   fastlane/metadata/android/en-US/      (and a second dir for the base package)
     title.txt  short_description.txt  full_description.txt
     changelogs/<versionCode>.txt
     images/icon.png  images/phoneScreenshots/  images/featureGraphic.png
   ```
4. **Reproducibility check**: build twice on different machines, compare APK hashes

**Deliverable:** tag → CI publishes signed reproducible APKs + complete fastlane metadata.

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
