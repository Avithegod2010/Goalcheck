/* =========================================================
   locales — catalog registry for GoalCheck i18n.

   - `CATALOGS` maps every supported `Locale` to its key-complete catalog
     (see en.ts for shape + sourcing rules).
   - `Locale` lives HERE and is re-exported by ../i18n.ts — import it from
     either place; do not redeclare it.
   - `LOCALE_LABELS` gives each locale's endonym for language pickers
     (settings.language) — always render these in their own language.
   - Adding a community locale (e.g. "fr"):
       1. create src/lib/goalcheck/locales/fr.ts typed as `Catalog`
          (key-complete — missing keys fail `tsc` by design);
       2. add "fr" to the `Locale` union, `CATALOGS`, `SUPPORTED_LOCALES`
          and `LOCALE_LABELS` below;
       3. done — detection, persistence and the `useT` hook pick it up
          automatically. See ../i18n.ts for the full system doc.
   ========================================================= */

import en from "./en";
import hi from "./hi";
import es from "./es";
import de from "./de";
import fr from "./fr";
import ptBR from "./pt-BR";
import ja from "./ja";
import ru from "./ru";
import type { Catalog } from "./en";

export type { Catalog, CatalogKey } from "./en";

export type Locale = "en" | "hi" | "es" | "de" | "fr" | "pt-BR" | "ja" | "ru";

export const CATALOGS: Record<Locale, Catalog> = { en, hi, es, de, fr, "pt-BR": ptBR, ja, ru };

export const SUPPORTED_LOCALES: readonly Locale[] = ["en", "hi", "es", "de", "fr", "pt-BR", "ja", "ru"];

/** Endonym per locale — for the settings language picker. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  "pt-BR": "Português (BR)",
  ja: "日本語",
  ru: "Русский",
};
