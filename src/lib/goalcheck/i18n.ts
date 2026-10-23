/* =========================================================
   i18n — GoalCheck runtime translation layer.

   SYSTEM OVERVIEW
   - Catalogs: src/lib/goalcheck/locales/{en,hi,es,de}.ts. `en` is the
     source of truth and defines the `Catalog` shape; every other locale
     is typed `Record<keyof typeof en, string>`, so a missing key is a
     COMPILE error — translations can never silently fall back.
   - Keys are flat dotted strings grouped by surface (nav.*, views.*,
     filters.*, side.*, common.*, settings.*, habits.*). Lookup order:
     current locale → "en" → the key itself (so a not-yet-migrated call
     site degrades to readable English instead of crashing).
   - Interpolation: `{name}` / `{count}` / `{percent}` — single curly
     braces, lowercase identifiers, replaced via
     `t(key, { name: "GoalCheck Advance", count: 3 })` (string | number).
     Unknown placeholders are left verbatim.

   RUNTIME BEHAVIOUR
   - `getLocale()` resolves once per session, in order: localStorage
     "gc_locale" → navigator.languages prefix match (e.g. "hi-IN" → "hi")
     → "en". SSR-safe: on the server it always returns "en" and never
     touches storage.
   - `setLocale(l)` persists to localStorage, updates <html lang>, and
     notifies subscribers. NO page reload is needed.
   - `useT()` subscribes with React's useSyncExternalStore:
       subscribe      = locale-change listener set
       getSnapshot    = current locale string
       getServerSnapshot = "en" (guarantees SSR/hydration match; after
       hydration React re-checks getSnapshot and re-renders once if the
       user's stored/detected locale differs — no hydration error).
     It returns a stable-per-locale translate function, so any component
     using `useT()` re-renders automatically on locale switch.
   - `t()` is exported for non-React contexts (toasts, store messages);
     it reads the same current locale.

   CLIENT/SERVER NOTES
   - This is a plain module: NO "use client" directive is required and it
     is safe to import anywhere. The `useT` hook must be CALLED inside
     client components (as with any React hook).
   - Edition-agnostic: catalogs contain zero edition-specific copy — base
     and pro resolve identical keys; edition gating stays in hasFeature().

   ADDING A COMMUNITY LOCALE (e.g. "fr")
   1. Create src/lib/goalcheck/locales/fr.ts: `const fr: Catalog = {...}`
      with ALL keys (missing/extra keys fail `tsc`).
   2. In locales/index.ts add "fr" to the `Locale` union, `CATALOGS`,
      `SUPPORTED_LOCALES`, and `LOCALE_LABELS` (endonym, e.g. "Français").
   3. Nothing else — detection, persistence, fallback and `useT` pick it
      up automatically.

   SCOPE (v1)
   - Long-form copy (onboarding paragraph bodies, legal text, full toast
     sentences) intentionally stays English in v1; catalogs cover
     short/medium UI strings only.
   ========================================================= */

import { useCallback, useSyncExternalStore } from "react";
import { CATALOGS, SUPPORTED_LOCALES, type Locale } from "./locales";

export type { Catalog, CatalogKey, Locale } from "./locales";

/** localStorage key persisted across sessions. */
const LOCALE_KEY = "gc_locale";

const DEFAULT_LOCALE: Locale = "en";

/** Interpolation variables: `{name}` etc. Values render via String(). */
export type TVars = Record<string, string | number>;

/** Translate function shape returned by useT(). */
export type TFn = (key: string, vars?: TVars) => string;

const ALL_LOCALES = Object.keys(CATALOGS) as readonly Locale[];

/* ------------------------------------------------------------------ */
/* Locale state                                                       */
/* ------------------------------------------------------------------ */

let cachedLocale: Locale | null = null;
const listeners = new Set<() => void>();

/** BCP-47 tag → supported Locale base prefix ("hi-IN" → "hi"), else null. */
function localeFromTag(tag: string): Locale | null {
  const base = tag.toLowerCase().split("-")[0];
  return (ALL_LOCALES as readonly string[]).includes(base) ? (base as Locale) : null;
}

function detectLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const stored = window.localStorage.getItem(LOCALE_KEY);
    if (stored && localeFromTag(stored)) return localeFromTag(stored) as Locale;
  } catch {
    /* storage blocked (private mode etc.) — fall through to detection */
  }
  if (typeof navigator !== "undefined") {
    const candidates =
      navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : navigator.language
          ? [navigator.language]
          : [];
    for (const tag of candidates) {
      const hit = localeFromTag(tag);
      if (hit) return hit;
    }
  }
  return DEFAULT_LOCALE;
}

/** Current locale. Resolves lazily (storage → navigator → "en"); on the
 *  server this is always "en". */
export function getLocale(): Locale {
  if (cachedLocale) return cachedLocale;
  cachedLocale = detectLocale();
  return cachedLocale;
}

/** Persist the locale and notify subscribers (no reload needed). */
export function setLocale(locale: Locale): void {
  if (locale === getLocale()) return;
  cachedLocale = locale;
  try {
    window.localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    /* storage blocked — in-session switch still works */
  }
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
  }
  for (const notify of listeners) notify();
}

/** Subscribe to locale changes. Returns an unsubscribe function.
 *  Used by useSyncExternalStore; also usable outside React. */
export function subscribeLocale(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/* ------------------------------------------------------------------ */
/* Translation                                                        */
/* ------------------------------------------------------------------ */

const VAR_RE = /\{(\w+)\}/g;

function interpolate(template: string, vars: TVars): string {
  return template.replace(VAR_RE, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : match
  );
}

/** Pure lookup against an explicit locale (current → en → key). */
function translate(locale: Locale, key: string, vars?: TVars): string {
  const raw = CATALOGS[locale][key] ?? CATALOGS.en[key] ?? key;
  return vars ? interpolate(raw, vars) : raw;
}

/** Translate using the CURRENT locale. For non-React contexts (toasts,
 *  store code); React components should prefer useT(). */
export const t: TFn = (key, vars) => translate(getLocale(), key, vars);

/* ------------------------------------------------------------------ */
/* React binding                                                      */
/* ------------------------------------------------------------------ */

/** Server snapshot — keeps SSR output deterministic ("en"). */
function getServerLocale(): Locale {
  return DEFAULT_LOCALE;
}

/**
 * `const t = useT();` → `t("nav.settings")`, `t("habits.streak", { count: 3 })`.
 * Re-renders the host component when the locale changes (no reload).
 * Must be called inside client components. SSR-safe via getServerSnapshot.
 */
export function useT(): TFn {
  const locale = useSyncExternalStore(subscribeLocale, getLocale, getServerLocale);
  return useCallback<TFn>((key, vars) => translate(locale, key, vars), [locale]);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * True when a BCP-47 tag (or, without an argument, the user's browser
 * languages) maps to a supported locale prefix. SSR-safe (no navigator
 * on the server → false when called without a tag).
 */
export function isI18nSupported(tag?: string): boolean {
  if (tag) return localeFromTag(tag) !== null;
  if (typeof navigator === "undefined") return false;
  const candidates =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : navigator.language
        ? [navigator.language]
        : [];
  return candidates.some((candidate) => localeFromTag(candidate) !== null);
}

/** Supported locales (re-exported for convenience/pickers). */
export const SUPPORTED = SUPPORTED_LOCALES;
