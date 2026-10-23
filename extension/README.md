# GoalCheck Quick Add (Chrome MV3)

A tiny, dependency-free Chrome extension companion for [GoalCheck](https://avithegod2010.github.io/Goalcheck/) — a **local-first, no-account goal tracker**. Capture goals from anywhere in your browser and send them straight to your GoalCheck quick-add bar.

No accounts. No servers. No tracking. Your goal text goes **only** into a tab you open.

## What it does

- **Popup** — click the toolbar icon, type a goal, hit **Add to GoalCheck** (or `Ctrl/Cmd+Enter`). Opens your configured GoalCheck site in a new tab with the text pre-filled via the `?add=` contract (below).
- **Context menu** — select any text on a page → right-click → **“Add selection to GoalCheck”**. The selection is sent the same way.
- **Keyboard shortcut** — `Ctrl+Shift+Y` (`Cmd+Shift+Y` on macOS) opens your configured GoalCheck site in a new tab. Customize it at `chrome://extensions/shortcuts`.
- **Settings** — the popup’s **Site URL** field controls where goals are sent. It is saved in `chrome.storage.sync` and defaults to `https://avithegod2010.github.io/Goalcheck/`.

## Install (unpacked, developer mode)

1. Download/clone this repo and locate the `extension/` folder.
2. Open `chrome://extensions` in Chrome, Edge, Brave, or any Chromium browser.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and select the `extension/` folder.
5. Pin “GoalCheck Quick Add” from the puzzle-piece menu and go.

## Privacy

- The extension performs **zero network requests**. There are no analytics, no telemetry, no remote code, and no background fetches.
- It only opens tabs to **the site you configured** (default: the official GoalCheck GitHub Pages site) when *you* trigger an add.
- The selected/typed goal text is placed in the tab URL as a query parameter — it goes to your configured GoalCheck instance and nowhere else.
- The only stored data is your Site URL, kept in `chrome.storage.sync` (synced by your browser profile, not by us).
- Full permissions used: `contextMenus` (the right-click entry) and `storage` (your Site URL). `chrome.tabs.create()` intentionally requires no `tabs` permission.

## The `?add=` contract (web app side)

When the extension opens GoalCheck, the URL looks like:

```
<site URL>?add=<urlencoded goal text>
```

Example: `https://avithegod2010.github.io/Goalcheck/?add=Ship%20the%20v2%20changelog%20by%20Friday`

The web app is expected to, on load:

1. Read the `add` query parameter.
2. Pre-fill **and focus** its quick-add bar with the decoded text (optionally showing a toast like “Goal drafted from extension”).
3. Strip the `add` param from the URL (e.g. `history.replaceState`) so it doesn’t linger on refresh or get re-submitted.

Notes:

- Text is encoded with `encodeURIComponent`, so `&`, `=`, `%`, newlines etc. are safe.
- If the configured site URL already contains a query string, the extension appends `&add=...` instead of `?add=...` — the app should parse with `URLSearchParams`, not raw string matching.
- The keyboard shortcut opens the plain site URL (no `add` param), so no toast should appear in that case.

## Firefox port (not yet shipped)

The code is portable; the manifest needs small tweaks:

- Replace `"background": { "service_worker": "background.js" }` with `"background": { "scripts": ["background.js"] }` (Firefox MV3 uses event pages; the JS itself already works with promises and top-level event listeners).
- Add a Firefox add-on ID, e.g. `"browser_specific_settings": { "gecko": { "id": "goalcheck-quick-add@example.com" } }` so `storage.sync` behaves predictably.
- `chrome.*` APIs referenced here (`contextMenus`, `storage`, `tabs.create`, `commands`) all exist as `browser.*` equivalents; you can optionally add the WebExtension polyfill or a `const api = globalThis.browser ?? globalThis.chrome;` shim.

## Files

```
extension/
├── manifest.json     # MV3 manifest (contextMenus + storage only)
├── background.js     # service worker: context menu + keyboard command
├── popup.html        # popup UI
├── popup.js          # popup logic (vanilla, dependency-free)
├── popup.css         # dark GoalCheck brand styles
└── icons/
    └── icon-192.png  # shared icon referenced for all sizes in the manifest
```
