# GoalCheck — Security Audit Report

**Date:** 2026-10-18 · **Scope:** entire project (src/, public/, config, docs, legacy file, git history) · **Method:** manual review + automated scans (ripgrep pattern matching, `npm audit`, `tsc --noEmit`, ESLint) + interactive browser testing.

**Verdict: ✅ CLEAN — safe to publish.**

---

## 1. Q&A Audit

| # | Question | Answer | Evidence |
|---|----------|--------|----------|
| 1 | Does the app send any data over the network? | **No.** Zero runtime network calls exist. | `rg 'fetch\(|XMLHttpRequest\|sendBeacon\|new WebSocket\|EventSource'` over `src/` → **0 matches**. The only `https://` strings are input-field *placeholders* for user-pasted media URLs (rendered as `<img src>` at user's own request). |
| 2 | Is any telemetry/analytics embedded? | **No.** No third-party scripts, no beacons, no fonts fetched at runtime (Google Fonts are self-hosted at build time by `next/font`). | `src/` review; `layout.tsx` imports only local CSS + `next/font`. |
| 3 | Where does user data live, and does it ever leave the device? | 100% `localStorage` under one key (`goalcheck_pro_state`). The optional "sync file" feature writes **only** to a local file the user explicitly picks via the File System Access API. Nothing is uploaded anywhere. | `rg 'localStorage\.' src/` → all hits are the one key; no `indexedDB`/`sessionStorage` misuse. |
| 4 | Any XSS vectors (user content injected as HTML)? | **No.** All user text renders through React escaping. The 2 `dangerouslySetInnerHTML` uses are (a) a static, hardcoded anti-FOUC theme script in `layout.tsx` (no user input, string literal), (b) shadcn's stock chart CSS injector (code-defined color strings only). Zero `eval` / `new Function` / `document.write` / `innerHTML` in app code. | Pattern scans + manual review of both call sites. |
| 5 | Are image uploads safe? | Yes — uploads are canvas-downscaled + JPEG-aware compressed client-side, stored as data URLs in localStorage; quota errors surfaced as toasts. No server upload exists. | `modals.tsx` canvas pipeline. |
| 6 | Are there hardcoded secrets, API keys, or credentials? | **None.** Scanned for `github_pat_`, `ghp_/gho_/ghs_`, AWS `AKIA…`, Slack `xox…`, `sk-…`, `PRIVATE KEY` blocks, and generic `secret|password|api_key|credential = "…"` assignments — **0 matches** in code, config, docs, logs, and the legacy single-file HTML. | ripgrep scans (incl. `--no-ignore` sweep of untracked files) + targeted scans of `.env`, `dev.log`, `worklog.md`, `upload/*.html`, `download/*.md`. |
| 7 | Is `.env` committed? | **No — and it was deleted entirely.** It contained only a local SQLite path (`DATABASE_URL=file:…`) used by unused template scaffolding (Prisma), which was removed with Prisma itself. `".env*"` remains in `.gitignore` as a guard. | Pre-push git index review; the fresh public history is built from scratch. |
| 8 | Is any database file committed? | **No.** `db/custom.db` (template sandbox) was untracked-removed together with Prisma. The app never touches a server DB. | File list review. |
| 9 | Is the git history clean? | **The published repo starts from one fresh commit.** The old sandbox history (which had `.env` + `db/custom.db` tracked) was **never pushed anywhere** and is destroyed before publishing — no secret could leak via history. | `git log` inspected (local-only); re-init performed. |
| 10 | Can dependency supply-chain attacks reach users? | Risk minimized: `npm audit --omit=dev` went from **24 vulnerabilities (2 critical, 14 high)** to **0** after remediation (see §3). | `npm audit` before/after. |
| 11 | What does the app expose if hosted publicly (e.g. GitHub Pages)? | One static page. No server actions, no middleware, no API routes (template hello-world route removed), no `next/image` endpoints, no cookies with personal data. | Route audit: only `/` remains. |
| 12 | Is the GitHub token used for the push safe? | It lives only in a `chmod 600` temp file **outside the repo** (`/tmp/gcsec/gh.token`), is used once via a credential helper (never stored in `.git/config` or remotes), and is deleted after the push. **The user must revoke it afterwards** because it transited chat. | Handling log in worklog. |

## 2. Secret-leak scan matrix (all clean)

| Pattern family | Files scanned | Hits |
|---|---|---|
| GitHub tokens (`github_pat_`, `ghp_`, `gho_`, `ghs_`) | whole tree incl. untracked | 0 |
| Cloud keys (AWS `AKIA`, Slack `xox`, `sk-`) | whole tree | 0 |
| Private key blocks (`BEGIN … PRIVATE KEY`) | whole tree | 0 |
| Generic `password/secret/api_key/credential = "…"` | `src/`, config, docs | 0 |
| The push token itself | every repo file + legacy HTML | 0 |
| `.env*` files | none present (deleted, gitignored) | 0 |
| Logs (`dev.log`, `server.log`) | scanned; also gitignored | 0 |

## 3. Dependency remediation (24 → 0 vulnerabilities)

Removed unused template dependencies (all verified 0 imports in `src/`): `next-auth` (critical advisories), `prisma` + `@prisma/client`, `uuid`, `@mdxeditor/editor`, `recharts`, `react-markdown`, `react-syntax-highlighter`, `@tanstack/react-query`, `@tanstack/react-table`, `@reactuses/core` (carried vulnerable `js-cookie` + `lodash-es`), `sharp`, `date-fns`, `react-day-picker`, `react-hook-form`, `@hookform/resolvers`, `zod`, `embla-carousel-react`, `input-otp`, `vaul`, `react-resizable-panels`, `next-themes`, `next-intl`, `@radix-ui/react-toast` — plus their dead template components (`ui/chart|calendar|form|carousel|input-otp|drawer|resizable|sonner|toast|toaster|sidebar`, hooks, hello-world API route, Prisma scaffolding).

Upgraded `next` 16.1.1 → **16.4.2** (clears the critical Next.js advisory cluster). Added override `source-map-js@^1.2.2`. Result: `npm audit --omit=dev` → **found 0 vulnerabilities**.

## 4. Bug hunt (same session)

- `eslint .` → clean.
- `tsc --noEmit` → **12 pre-existing type errors found & fixed** (undefined `ChimePack` type, missing `Habit` imports, missing `respawnedFrom` field in `makeTask`, zustand null-narrowing annotations, `hourCounts` cast, analytics peak comparator). App code now 100% type-clean; `npm run typecheck` added and enforced in CI.
- Browser E2E: app boots with zero console errors; onboarding tour runs & persists; task toggle persists (`completed:true, status:"done"`) to schema v4; Data Doctor scan returns "All clear".

## 5. Residual risks & recommendations

1. **Build-time-only advisories** in `postcss`/`picomatch`/`nanoid` chains may reappear with future `npm audit` runs of dev dependencies — they do not ship to users; review periodically.
2. Add **CodeQL / Dependabot** on GitHub (one-click) for continuous scanning.
3. Keep the "no network" guarantee: any future feature that would add an outbound call (e.g. optional update checker) must be opt-in and documented in the privacy policy.
4. CSP headers are worth adding if the app is ever hosted with server middleware (not applicable to static Pages hosting).

*Report generated as part of the pre-publication audit on 2026-10-18. All findings re-verified immediately before the first public push.*
