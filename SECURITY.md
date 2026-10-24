# Security Policy

## Supported versions

GoalCheck ships a rolling single-line: only the **latest release** (see
[Releases](https://github.com/Avithegod2010/Goalcheck/releases) — web trains
`advance/vX.Y.Z` + `base/vX.Y.Z`, Android `android/vX.Y.Z`) receives security fixes.
Older releases are unsupported — please update before reporting.

| Version | Supported |
| --- | --- |
| Latest release (see Releases) | ✅ |
| Anything older | ❌ — update first |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

1. Use GitHub's **Private vulnerability reporting** (repo → Security → Report a vulnerability,
   which creates a confidential GitHub Security Advisory), or
2. Contact the maintainer via a GitHub issue asking for a private channel.

You'll get an acknowledgment within **72 hours** and a fix-or-status update within **14 days**.
Credit is given in the release notes unless you prefer otherwise.

## Scope

In scope:
- XSS / injection through user-controlled data (task text, notes, imported JSON, theme files, image URLs)
- Storage-schema bugs that could corrupt or silently lose user data
- Any code path that sends user data off the device (there should be none — that's the product promise)
- Supply-chain issues in the dependency tree

Out of scope:
- The GitHub Pages hosting infrastructure itself (report to GitHub)
- Bugs requiring a malicious user to attack their own device's localStorage

## The zero-network guarantee

GoalCheck's core security property is **local-first, zero-telemetry**: no analytics, no
telemetry, no remote calls — your data never leaves the device (browser storage on the web,
IndexedDB in the Android shell).
For the Android shell this is enforced, not promised — `android.permission.INTERNET` is removed
from the merged manifest and CI (`android.yml`) fails any build whose APK declares it.
Changes that weaken this property are treated as security regressions.

## Audits

- 2026-10-18: full manual audit (XSS class, secret/credential leak scan, dependency audit — 0 vulnerabilities) before the first public push. See [`download/SECURITY-AUDIT.md`](download/SECURITY-AUDIT.md).
