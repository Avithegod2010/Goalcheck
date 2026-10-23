/* GoalCheck Quick Add — popup logic. Dependency-free vanilla JS (MV3). */

const DEFAULT_SITE_URL = "https://avithegod2010.github.io/Goalcheck/";

const els = {
  textarea: document.getElementById("goal-text"),
  addBtn: document.getElementById("add-btn"),
  status: document.getElementById("status"),
  siteUrl: document.getElementById("site-url"),
  targetHost: document.getElementById("target-host"),
};

/** Return a usable http(s) URL string from a possibly-messy user setting. */
function normalizeSiteUrl(raw) {
  let url = (raw || "").trim();
  if (!url) return DEFAULT_SITE_URL;
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return url;
}

/** Append the `?add=` contract param, respecting existing query strings. */
function buildQuickAddUrl(baseUrl, text) {
  const sep = baseUrl.includes("?") ? "&" : "?";
  return baseUrl + sep + "add=" + encodeURIComponent(text);
}

/** Friendly host label for the settings row, "" when unusable. */
function hostLabel(url) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function setStatus(message) {
  els.status.textContent = message || "";
}

function updateTargetHost() {
  const host = hostLabel(normalizeSiteUrl(els.siteUrl.value));
  els.targetHost.textContent = host ? "Opens: " + host : "";
}

/** Save the Site URL setting to chrome.storage.sync. */
async function saveSiteUrl() {
  const normalized = normalizeSiteUrl(els.siteUrl.value);
  els.siteUrl.value = normalized; // echo the normalized value back
  try {
    await chrome.storage.sync.set({ siteUrl: normalized });
    setStatus("Site URL saved.");
    updateTargetHost();
  } catch (e) {
    console.error("[GoalCheck] storage write failed:", e);
    setStatus("Could not save settings.");
  }
}

/** Build the ?add= URL from current UI state and open it in a new tab. */
async function addGoal() {
  const text = els.textarea.value.trim();
  if (!text) {
    setStatus("Type a goal first.");
    els.textarea.focus();
    return;
  }
  const url = buildQuickAddUrl(normalizeSiteUrl(els.siteUrl.value), text);
  try {
    await chrome.tabs.create({ url });
    window.close(); // close the popup once the tab is open
  } catch (e) {
    console.error("[GoalCheck] failed to open tab:", e);
    setStatus("Could not open a tab.");
  }
}

/* --- init ------------------------------------------------------------- */

async function init() {
  try {
    const { siteUrl } = await chrome.storage.sync.get({ siteUrl: DEFAULT_SITE_URL });
    els.siteUrl.value = normalizeSiteUrl(siteUrl);
  } catch (e) {
    console.error("[GoalCheck] storage read failed:", e);
    els.siteUrl.value = DEFAULT_SITE_URL;
  }

  updateTargetHost();
  els.textarea.focus();
}

/* --- events ------------------------------------------------------------ */

els.textarea.addEventListener("input", () => {
  const hasText = els.textarea.value.trim().length > 0;
  els.addBtn.disabled = !hasText;
  if (hasText && els.status.textContent === "Type a goal first.") setStatus("");
});

els.textarea.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    addGoal();
  }
});

els.addBtn.addEventListener("click", addGoal);

els.siteUrl.addEventListener("change", saveSiteUrl); // fires on blur/Enter
els.siteUrl.addEventListener("input", updateTargetHost);

init();
