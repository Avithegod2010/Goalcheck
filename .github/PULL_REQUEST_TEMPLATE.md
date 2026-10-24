# Pull request checklist

> GoalCheck is local-first and FOSS. PRs that add network calls, telemetry,
> or accounts will be rejected — see `CONTRIBUTING.md` ground rules.

## Gates (all must pass locally before opening the PR)

- [ ] `bunx tsc --noEmit` — clean
- [ ] `bun run lint` — clean
- [ ] `bunx vitest run` — green
- [ ] `bunx playwright test` — green (chromium + webkit)
- [ ] `bun run dev` + `bun run dev:base` — both editions boot and the changed flows work in each

## Editions & i18n

- [ ] If I added UI strings: **every** new key lands in ALL catalogs in
      `src/lib/goalcheck/locales/` (en, hi, es, de) — a missing key is a build error
- [ ] Advance-only features are gated through `hasFeature()` / `editions.ts`
      (base edition must not regress)
- [ ] Persisted-data changes bump `STORAGE_VERSION` with a migration
      (`src/lib/goalcheck/store.ts`)

## Hygiene

- [ ] No new runtime dependency without a stated reason (FOSS audit)
- [ ] No secrets, keys or personal data in the diff
- [ ] Commit messages follow the repo style (`feat:`, `fix:`, `docs:`, `ci:`, `chore:` — short imperative subject)
