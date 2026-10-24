# GoalCheck Advance — Google Play listing kit

Everything needed to create the Play Console entry once signed releases are
flowing (see `../fdroid-prep.md` for the signing prerequisite and
`.github/workflows/android.yml` for the four `KEYSTORE_*` secrets).

## App details

| Field | Value |
|---|---|
| App name (≤30 chars) | `GoalCheck Advance: Goals` |
| Package / applicationId | `io.github.avithegod2010.goalcheckadvance` |
| Category | Productivity |
| Tags | goal tracker, checklist, habit, pomodoro, planner |
| Content rating | Everyone |
| Data safety | **No data collected, no sharing** — all storage on-device (IndexedDB); no account; works offline. |
| Privacy policy URL | https://avithegod2010.github.io/Goalcheck/privacy.html |

## Short description (≤80 chars)

> Goals, habits & focus timer — private, offline, no account. Free & open source.

## Full description

> GoalCheck Advance is a local-first goal tracker: break big goals into
> categories and tasks, then actually finish them — with a Pomodoro focus
> timer, Kanban, calendar, mind map and analytics views, habit streaks and
> light RPG motivation (XP, levels, combos).
>
> WHY YOU'LL STICK WITH IT
> • Multi-goal boards — one workspace for every goal
> • Smart week planner rebalances overdue tasks into your real capacity
> • Natural-language quick add: "gym #health tomorrow !high ~2 every week"
> • .ics calendar import/export — your dates live in Google Calendar too
> • Attach files to tasks; everything stays on your device
> • Voice quick add — just say it (works in 8 languages)
> • 365-day heatmap, weekly review ritual, Year Wrapped recap
> • 11 themes, particle atmospheres, audio studio, Zen mode
> • Archive finished boards — nothing is ever lost
>
> PRIVACY BY DESIGN
> • No account, no sign-up, no analytics, no network permission
> • Your data lives in IndexedDB on your phone — export a JSON backup anytime
> • 100% free & open source (MIT) — https://github.com/Avithegod2010/Goalcheck
>
> The core planner (GoalCheck, base edition) is also available as its own
> minimal app and free web build.

## Graphics in this folder

| File | Purpose |
|---|---|
| `feature-graphic-1024x500.png` | Play feature graphic (exact spec) — AI-drafted; replace with a branded render when possible |
| `feature-graphic-raw.png` | 1344×768 source render |
| Phone screenshots | capture 1080×2400 (or 1080×1920) from a device/emulator: 1) Checklist board, 2) Smart week plan + capacity bars, 3) Kanban, 4) Calendar, 5) Analytics/heatmap. Full set lives in `../branding/` as they are captured. |

## Release notes template (per version)

> v{X.Y.Z}: {top 2-3 user-facing changes}. Full changelog:
> https://github.com/Avithegod2010/Goalcheck/blob/main/CHANGELOG.md
