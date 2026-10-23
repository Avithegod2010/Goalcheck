/**
 * GoalCheck Quick Add — MV3 background service worker.
 *
 * Responsibilities:
 *  1. Register a context-menu entry ("Add selection to GoalCheck") shown when
 *     the user selects text. Clicking it opens the user-configured GoalCheck
 *     site in a new tab with the selection passed as `?add=<urlencoded text>`.
 *  2. Handle the keyboard shortcut command ("quick-add-open") which opens the
 *     configured GoalCheck site in a new tab.
 *
 * Privacy: this worker performs NO network requests. It only reads/writes
 * chrome.storage.sync (the saved site URL) and opens tabs the user asked for.
 * chrome.tabs.create() requires no "tabs" permission.
 */

const DEFAULT_SITE_URL = "https://avithegod2010.github.io/Goalcheck/";
const MENU_ID = "goalcheck-quick-add-selection";
const COMMAND_ID = "quick-add-open";

/** Return a usable http(s) URL string from a possibly-messy user setting. */
function normalizeSiteUrl(raw) {
  let url = (raw || "").trim();
  if (!url) return DEFAULT_SITE_URL;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

/** Append the `?add=` contract param, respecting existing query strings. */
function appendQuickAddParam(baseUrl, text) {
  const sep = baseUrl.includes("?") ? "&" : "?";
  return baseUrl + sep + "add=" + encodeURIComponent(text);
}

/** Read the configured site URL from chrome.storage.sync (async, promise). */
async function getSiteUrl() {
  try {
    const { siteUrl } = await chrome.storage.sync.get({ siteUrl: DEFAULT_SITE_URL });
    return normalizeSiteUrl(siteUrl);
  } catch (e) {
    console.debug("[GoalCheck] storage.read failed, using default:", e);
    return DEFAULT_SITE_URL;
  }
}

/** Open a URL in a new foreground tab (no "tabs" permission needed). */
async function openInNewTab(url) {
  try {
    await chrome.tabs.create({ url });
  } catch (e) {
    console.error("[GoalCheck] failed to open tab:", e);
  }
}

/** Context menu click → open site with the selection as ?add=... */
chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID) return;
  const text = (info.selectionText || "").trim();
  if (!text) return; // nothing selected; nothing to send
  const url = appendQuickAddParam(await getSiteUrl(), text);
  await openInNewTab(url);
});

/** Keyboard shortcut → open the configured site (no text payload). */
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND_ID) return;
  await openInNewTab(await getSiteUrl());
});

/** Create the context menu on install/update (and SW first run). */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create(
    {
      id: MENU_ID,
      title: "Add selection to GoalCheck",
      contexts: ["selection"],
    },
    () => {
      // Ignore "duplicate id" errors that occur when the SW is reinstalled.
      if (chrome.runtime.lastError) {
        console.debug("[GoalCheck] context menu:", chrome.runtime.lastError.message);
      }
    }
  );
});
