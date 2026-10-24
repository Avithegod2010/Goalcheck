# Contributing to GoalCheck

Thanks for helping! GoalCheck is a two-edition, local-first productivity app:
**GoalCheck** (base) and **GoalCheck Advance** (pro) — one codebase, switched by
`NEXT_PUBLIC_GC_EDITION`.

## Quick start

```bash
bun install
bun run dev            # Advance edition (default)
bun run dev:base       # GoalCheck (base) edition
bun run test           # Vitest suite (CI gate)
bun run lint           # ESLint
bun run typecheck      # tsc --noEmit (strict)
bunx playwright test   # E2E: chromium + webkit (boots the dev server itself)
```

## The gates

CI runs lint + typecheck + tests + **both edition builds** on every PR and push to `main`
(plus a Playwright E2E lane and a Lighthouse/bundle-budget lane). Run locally first:

| Gate | Command |
|---|---|
| Types | `bunx tsc --noEmit` |
| Lint | `bun run lint` |
| Unit tests | `bunx vitest run` |
| E2E (chromium + webkit) | `bunx playwright test` |
| Both edition builds | `NEXT_PUBLIC_GC_EDITION=pro bunx next build` and `NEXT_PUBLIC_GC_EDITION=base bunx next build` |

## Two editions, one codebase

`NEXT_PUBLIC_GC_EDITION` is the switch: `pro` → **GoalCheck Advance**, `base` → **GoalCheck**.
Everything UI-visible must work in BOTH — Advance-only features are gated through
`hasFeature()` (`src/lib/goalcheck/editions.ts`), and base builds must never render pro views.

## i18n catalog rule (non-negotiable)

Every user-visible string lives in the catalogs in `src/lib/goalcheck/locales/` —
`en.ts`, `hi.ts`, `es.ts`, `de.ts`. **A new UI string must be added to ALL four catalogs
in the same PR**; the catalog parity check makes a missing key a compile-time build
error, and English hardcoded in a component will be caught in review.

## Architecture in 60 seconds

- `src/lib/goalcheck/store.ts` — the entire app state (Zustand, persisted to IndexedDB via a
  localStorage backup, schema-versioned with migration hooks). **Schema changes MUST** bump
  `STORAGE_VERSION` and add a migration; both editions share the same schema.
- `src/lib/goalcheck/editions.ts` — the feature registry. Pro-only features are listed there;
  `hasFeature()` gates UI, and the store clamps edition-specific settings.
  Advance builds additionally offer a runtime Normal⇄Advance switch — keep both paths safe.
- `src/lib/goalcheck/logic.ts` — pure functions (streaks, XP, quick-paste parser, achievements).
  New logic goes here, with Vitest tests in `tests/`.
- `capacitor/` — an **independent** Android shell project. The web app must never import from it;
  `scripts/sync-capacitor.mjs` bridges the static export into the shell.

## Ground rules

1. **Zero network.** No API calls, no analytics, no remote fonts/CDNs. The Android shell forbids
   `android.permission.INTERNET` (CI enforces it via `aapt2`). If your feature needs network,
   it doesn't belong in GoalCheck core.
2. **Local-first data.** Anything the user creates stays on-device. New persisted fields must
   survive base⇄Advance switching losslessly.
3. **No new runtime deps** without a strong reason — the dependency tree is audited for
   FOSS purity (F-Droid requirement).
4. Mobile-first + keyboard-accessible: 44px touch targets, focus rings, aria labels.
5. All user text renders through React escaping — never `dangerouslySetInnerHTML` on user input.

## Android builds

See [`download/ANDROID.md`](download/ANDROID.md) for the Capacitor shell, signing and the
zero-INTERNET pipeline.

## Releases

Maintainer-cut: version bumps live in the root `package.json` (single source of truth —
the Android shells derive `versionName`/`versionCode` from it). Tag trains:
`advance/vX.Y.Z`, `base/vX.Y.Z` (web), `android/vX.Y.Z` (APK/AAB CI builds).

## Commit style

Short imperative subject, blank line, motivation + notes. Conventional-ish prefixes
(`feat:`, `fix:`, `test:`, `docs:`, `chore:`) keep the changelog honest.

## PR flow

1. Fork / branch from `main`, keep the diff focused (one feature or fix per PR).
2. Run the gates above — including **both editions** and `bunx playwright test`.
3. Open the PR using the template checklist; link the issue it closes.
4. CI must be green (lint, typecheck, Vitest, both builds, E2E, Lighthouse/bundle budget).
   The visual-regression job is advisory (`continue-on-error`) until baselines stabilize —
   see `tests/e2e/visual.spec.ts` for how baselines are generated.
5. Maintainer squash-merges; release trains are maintainer-cut (see below).
