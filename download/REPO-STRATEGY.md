# GoalCheck & GoalCheck Advance — Repository Strategy

> Your question: *"How can we separate these two? Should we make 2 different repositories?"*
> Short answer: **Start with ONE monorepo. Don't split into two repos yet.** Here's why, and how to do it.

---

## 1. The two products

| | **GoalCheck** (base) | **GoalCheck Advance** |
|---|---|---|
| Identity | The clean, focused planner | The power-user toolkit + atmosphere studio |
| Core | Goals → categories → tasks, progress, priorities, notes, subtasks, dependency locks, recurring categories, rapid add, search + filters, Pomodoro + floating pill, JSON export/import | Everything in base |
| Themes | 2 (Nebula dark + Nordic light), system auto light/dark | 11 themes |
| Extras | Custom mono animated icons, completion confetti, toasts, reduce-effects | Kanban / Matrix / Mind Map / Analytics, 365-day heatmap, RPG (XP/levels/combo/skills/auras), 13 particle engines, cursor physics, atmosphere presets, ripple, audio studio (7 streams), 4 chime packs, templates, command palette, Zen HUD, image URL/upload media |

Both editions already exist in this codebase, gated by a single env var:

```bash
bun run dev          # GoalCheck Advance (default)
bun run dev:base     # GoalCheck (base)
bun run build:pro    # production bundle of Pro
bun run build:base   # production bundle of base
```

The single source of truth is `src/lib/goalcheck/editions.ts` (feature registry + branding).
Both editions share the **same storage key and schema version**, so a user who moves
from base to Pro keeps 100% of their data — this is deliberate and non-negotiable.

---

## 2. The three options, honestly compared

### Option A — Two separate repositories (`goalcheck`, `goalcheck-advance`)
- ✅ Simplest F-Droid metadata later (one repo per package; fdroiddata expects this shape)
- ✅ Independent issue trackers, release cadence, stars
- ❌ The **storage core must stay in lockstep** (schema version + migrations). Two repos = two copies = guaranteed drift = users losing data when switching editions
- ❌ Every bug fix in shared logic (task engine, pomodoro, export format) must be mirrored twice
- ❌ More CI, more releases, more overhead for a solo maintainer

### Option B — One monorepo (recommended)
```
goalcheck/                    ← the single GitHub repo
├─ apps/
│  ├─ base/                   ← GoalCheck      (thin Next.js shell)
│  └─ pro/                    ← GoalCheck Advance  (thin Next.js shell)
├─ packages/
│  ├─ core/                   ← types, storage + migrations, task engine, pomodoro
│  ├─ icons/                  ← mono animated icon set (also usable by others)
│  └─ audio/                  ← WebAudio chime packs + ambient streams
├─ .github/workflows/         ← one CI matrix builds BOTH editions
└─ fastlane/                  ← store metadata for both apps (later)
```
- ✅ Shared core is literally the same code — schema migrations can never drift
- ✅ One CI pipeline, matrix job → two artifacts (`goalcheck-vX.Y.Z`, `goalcheck-pro-vX.Y.Z`)
- ✅ Fix once, ship to both editions
- ✅ F-Droid supports monorepos: the build recipe sets `subdir: apps/pro` — solved problem
- ✅ IzzyOnDroid doesn't care — it just watches your GitHub Releases
- ✅ You can still split later with `git filter-repo` if it ever hurts
- ❗ Mitigate the "one issue tracker" con with labels: `app/base`, `app/pro`

### Option C — One app with an in-app "Pro" unlock flag
- ❌ Rejected. FOSS communities (F-Droid especially) dislike freemium flags; reviewers
   will ask what code is gated; it also muddies reproducible builds. Two clean builds
   from one source is the honest, FOSS-native way.

**Verdict:** Option B. The decisive argument is data integrity — both editions must read
and write the *same* schema, so the migration code must be shared code. A monorepo is the
cheapest way to guarantee that. Two repos is a *later* optimization, not a starting point.

---

## 3. GitHub-first release plan (F-Droid deferred)

Phase 1 — **Repo hygiene (day 1) — ✅ DONE 2026-10-18**
- Repo: `Avithegod2010/Goalcheck` (single codebase at root, editions switched by `NEXT_PUBLIC_GC_EDITION`)
- `LICENSE` = **MIT** (chosen over Apache-2.0 — see §6)
- README with "base vs Advance" comparison table, privacy statement, run instructions
- CI: GitHub Actions matrix — lint + typecheck + build **both** editions on every push
- Versioned tags `advance/vX.Y.Z` + `base/vX.Y.Z` starting at `v0.4.0`

Phase 2 — **Releases via GitHub Releases**
- Tags like `base/vX.Y.Z` and `advance/vX.Y.Z` (two products, one repo, distinct tag prefixes)
- CI (GitHub Actions) on tag push: `bun install && bun run build:base` / `build:pro`,
  zip the static export → attach to the Release
- GitHub Pages: deploy Pro to `https://<user>.github.io/goalcheck/` (or base at `/goalcheck/base/`)
  — both apps are 100% client-side, so static hosting is free and offline-friendly

Phase 3 — **Web polish**
- PWA manifest + service worker → "Install app" on Android Chrome
- Changelog via Releases; GitHub Issues as the public tracker

Phase 4 — **Android (Capacitor) → stores** — only after the web app has real users
- IzzyOnDroid first: it ingests signed APKs straight from your GitHub Releases
- F-Droid last: reproducible-build recipe, `fastlane/metadata/android/en-US/`,
  application IDs `io.github.<username>.goalcheck` and `io.github.<username>.goalcheckadvance`

---

## 4. Concrete migration steps (when you're ready, ~1 day of work)

1. `git init` the monorepo; move this project's `src/lib/goalcheck/*` shared logic into
   `packages/core/src` (it's already cleanly separated: `types`, `logic`, `store`, `themes`,
   `presets`, `audio`, `particles`, `icons`).
2. Create `apps/pro/` and `apps/base/` — thin Next.js apps that import `@goalcheck/core`
   and differ only in `NEXT_PUBLIC_GC_EDITION`, branding, and which components they render.
3. Bun workspaces: `"workspaces": ["apps/*", "packages/*"]` in the root `package.json`.
4. CI matrix: one workflow, two jobs (`edition: base` / `edition: pro`), each builds and
   uploads its artifact on tag.
5. Tag `pro/v1.0.0` → first GitHub Release. Ship it. Iterate.

---

## 5. What's already in place (this codebase today)

- `src/lib/goalcheck/editions.ts` — feature registry (20 feature ids), branding, env-var switch
- Store-level clamps: base silently falls back to its 2 themes, particles off,
  checklist view only, templates locked with a friendly toast
- UI-level gating: sidebar widgets, view switcher, theme modal, settings rows,
  media picker tabs, header buttons/menu, Zen & palette & heatmap & RPG hidden in base
- `package.json` scripts: `dev`, `dev:base`, `dev:pro`, `build`, `build:base`, `build:pro`
- Same storage key + **schema v4** in both editions → lossless base ↔ Advance switching

> **v1 layout note:** the published repo keeps the single Next.js app at the root and
> switches editions via the env var — the `apps/` + `packages/` split in §4 remains a
> *later* refactor (worth doing before Phase 4 Android packaging, not before).

---

## 6. License decision: MIT (why not Apache-2.0)

| | MIT | Apache-2.0 |
|---|---|---|
| Length | ~170 words, one page | ~10x longer |
| Grant | use/copy/modify/sell, keep notice | same + explicit **patent grant** |
| Change notices | not required | must state significant changes |
| Trademark clause | no | yes |
| F-Droid / IzzyOnDroid | accepted | accepted |

**Decision:** MIT. For a local-first checklist app the Apache patent-grant advantage is
negligible; MIT maximizes adoption friction-free. Revisit only if the project ever ships
something patent-sensitive.
