/* =========================================================
   GoalCheck — Natural-language quick-add parser (v5, Task 17-b)

   Turns a single plain-text line like
       "milk #errands tomorrow !high ~2 every week"
   into a ParsedQuickAdd: the remaining clean text plus the
   structured fields the quick-add bar should apply.

   COMPOSABILITY (important): the pre-existing multi-task quick
   syntax ("To do in laptop • errands; milk; gym • /f") keeps
   working — any input containing "•" is returned untouched so
   the Quick Paste preview keeps owning it.

   EDITIONS: pass extractDates:false in the base edition — date
   phrases then stay in the text verbatim while priority /
   category / estimate / recurrence still parse.

   TIME TOKENS: verified against the app — Task.dueDate is a
   DATE-ONLY string ("YYYY-MM-DD"; the edit modal uses a
   type="date" input and every consumer slices (0,10)). Clock
   times ("5pm", "17:00", "noon", "at 5") are therefore NOT
   extracted and stay in the clean text; the `time` field is
   reserved and always undefined today. Date phrases with an
   implied time ("tonight", "eod") still map to today's date.

   PRIORITY: verified against types.ts — Priority is
   "normal" | "high" | "urgent" (no "low"). So !high/!! → high,
   !urgent/!!! → urgent, and !med/!low just strip to the app
   default (normal → left undefined here).
   ========================================================= */

import type { Priority, Task } from "./types";
import { isValidRecurrence, localDateKey, shiftDays } from "./logic";

export interface ParsedQuickAdd {
  /** remaining task text (whitespace-collapsed, trimmed) */
  clean: string;
  /** "YYYY-MM-DD" — parsed due date, if any */
  dueDate?: string;
  /** reserved for future time-of-day support; always undefined (date-only app) */
  time?: string;
  /** parsed priority (undefined = app default "normal") */
  priority?: Priority;
  /** category name from "#tag" (no "#"); find-or-create on add */
  categoryTitle?: string;
  /** pomodoro estimate from "~N" (1-12) */
  estimate?: number;
  /** parsed recurrence spec (validated with isValidRecurrence) */
  recurrence?: Task["recurrence"];
}

export interface QuickAddParseOpts {
  /** false (base edition) leaves date phrases in the text; default true */
  extractDates?: boolean;
  /** reference "now" for relative dates (tests); default new Date() */
  now?: Date;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

const DDMM_RE = /^(\d{1,2})\/(\d{1,2})$/;
const DAYNUM_RE = /^(\d{1,2})$/;
const ESTIMATE_RE = /^~(\d{1,2})$/;
const NUMBER_RE = /^(\d+)$/;

/**
 * Parse a plain quick-add line into structured fields + clean text.
 * Pure apart from the optional `now` — fully unit-testable.
 */
export function parseQuickAdd(input: string, opts: QuickAddParseOpts = {}): ParsedQuickAdd {
  const text = (input ?? "").trim();
  if (!text) return { clean: "" };

  /* existing • multi-task quick-paste syntax wins — never NL-parse it */
  if (text.includes("•")) return { clean: input };

  const extractDates = opts.extractDates !== false;
  const now = opts.now ?? new Date();
  const tokens = text.split(/\s+/);

  let dueDate: string | undefined;
  let priority: Priority | undefined;
  let categoryTitle: string | undefined;
  let estimate: number | undefined;
  let recurrence: Task["recurrence"] | undefined;
  const kept: string[] = [];

  /* first parsed date wins — later date phrases stay as literal text */
  const setDue = (key: string) => {
    if (!dueDate) dueDate = key;
  };

  /* "25/12" / "dec 25" → this year, or next year once the date has passed */
  const mdKey = (month: number, day: number): boolean => {
    const year = localDateKey(new Date(now.getFullYear(), month, day)) < localDateKey(now)
      ? now.getFullYear() + 1
      : now.getFullYear();
    const dt = new Date(year, month, day);
    if (dt.getMonth() !== month || dt.getDate() !== day) return false; /* Feb 30 etc. */
    setDue(localDateKey(dt));
    return true;
  };

  /* next occurrence of a weekday; `followingWeek` pushes into the next
     ISO week (Mon-based) so "next friday" != this coming friday */
  const nextWeekday = (target: number, followingWeek: boolean): string => {
    const dow = now.getDay();
    let ahead = (target - dow + 7) % 7;
    if (ahead === 0) ahead = 7; /* strictly future */
    if (followingWeek && ahead <= 6 - ((dow + 6) % 7)) ahead += 7;
    return localDateKey(shiftDays(now, ahead));
  };

  const coreAt = (idx: number): string => {
    if (idx < 0 || idx >= tokens.length) return "";
    return tokens[idx]
      .toLowerCase()
      .replace(/^[("'“”']+/, "")
      /* no "!" here — "!!"/"!!!" are priority tokens, trailing "!" must survive */
      .replace(/[)"'“”,.;:]+$/, "");
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const core = coreAt(i);

    /* ---------- priority: !high / !h / !! → high, !urgent / !u / !!! → urgent,
       !med / !low / !normal → strip (app default is already "normal";
       verified: this app's Priority union has no "low") ---------- */
    if (core.startsWith("!") && core.length > 1) {
      if (core === "!!") { priority = "high"; continue; }
      if (core === "!!!" || core === "!!!!") { priority = "urgent"; continue; }
      const word = core.slice(1);
      if (word === "high" || word === "h") { priority = "high"; continue; }
      if (word === "urgent" || word === "u") { priority = "urgent"; continue; }
      if (word === "med" || word === "m" || word === "normal" || word === "n" || word === "low" || word === "l") {
        priority = undefined;
        continue;
      }
      kept.push(tok); /* unknown !word — plain text, not a token */
      continue;
    }

    /* ---------- category: "#tag" (last one wins) ---------- */
    if (tok.startsWith("#") && tok.length > 1) {
      const tag = tok.slice(1).replace(/[.,;:!?]+$/, "").trim();
      if (tag) { categoryTitle = tag; continue; }
      kept.push(tok);
      continue;
    }

    /* ---------- estimate: "~N" (1-12 pomodoro units) ---------- */
    const est = ESTIMATE_RE.exec(core);
    if (est) {
      const n = parseInt(est[1], 10);
      if (n >= 1 && n <= 12) { estimate = n; continue; }
      kept.push(tok);
      continue;
    }

    /* ---------- recurrence: "every day/week/month", "every N days" ----------
       (not date extraction — parses in both editions) ---------- */
    if (core === "everyday") { recurrence = "daily"; continue; }
    if (core === "every") {
      const nxt = coreAt(i + 1);
      if (nxt === "day") { recurrence = "daily"; i += 1; continue; }
      if (nxt === "week") { recurrence = "weekly"; i += 1; continue; }
      if (nxt === "month" && isValidRecurrence("monthly:1:1")) { recurrence = "monthly:1:1"; i += 1; continue; }
      const n = NUMBER_RE.exec(nxt);
      const after = coreAt(i + 2);
      if (n && (after === "day" || after === "days")) {
        const rec = `every:${n[1]}` as Task["recurrence"];
        if (isValidRecurrence(rec)) { recurrence = rec; i += 2; continue; }
      }
      kept.push(tok); /* not a recurrence phrase — keep "every" as text */
      continue;
    }

    if (!extractDates) { kept.push(tok); continue; }
    /* first date wins — later date phrases stay as literal text */
    if (dueDate) { kept.push(tok); continue; }

    /* ---------- date phrases (Advance edition / extractDates) ---------- */
    if (core === "today" || core === "tonight" || core === "eod") {
      setDue(localDateKey(now)); /* tonight/eod times dropped — date-only app */
      continue;
    }
    if (core === "tomorrow" || core === "tmr") {
      setDue(localDateKey(shiftDays(now, 1)));
      continue;
    }
    if (core === "next") {
      const nxt = coreAt(i + 1);
      if (nxt === "week") { setDue(localDateKey(shiftDays(now, 7))); i += 1; continue; }
      const wd = nxt ? WEEKDAYS[nxt] : undefined;
      if (wd !== undefined) { setDue(nextWeekday(wd, true)); i += 1; continue; }
      kept.push(tok);
      continue;
    }
    if (WEEKDAYS[core] !== undefined) {
      setDue(nextWeekday(WEEKDAYS[core], false));
      continue;
    }
    if (core === "in") {
      const numTok = coreAt(i + 1);
      const n = NUMBER_RE.exec(numTok);
      const unit = coreAt(i + 2);
      if (n && numTok === String(parseInt(n[1], 10)) && parseInt(n[1], 10) >= 1 && parseInt(n[1], 10) <= 365) {
        if (unit === "day" || unit === "days") {
          setDue(localDateKey(shiftDays(now, parseInt(n[1], 10))));
          i += 2;
          continue;
        }
        if (unit === "week" || unit === "weeks") {
          setDue(localDateKey(shiftDays(now, parseInt(n[1], 10) * 7)));
          i += 2;
          continue;
        }
      }
      kept.push(tok);
      continue;
    }
    /* "on" is dropped only when it introduces a date ("on 25/12", "on fri") */
    if (core === "on") {
      const nxt = coreAt(i + 1);
      if (nxt && (DDMM_RE.test(nxt) || MONTHS[nxt] !== undefined || WEEKDAYS[nxt] !== undefined)) continue;
      kept.push(tok);
      continue;
    }
    const ddmm = DDMM_RE.exec(core); /* "25/12" — day/month */
    if (ddmm && mdKey(parseInt(ddmm[2], 10) - 1, parseInt(ddmm[1], 10))) continue;
    const dayNum = DAYNUM_RE.exec(core);
    const nxtCore = coreAt(i + 1);
    if (dayNum && nxtCore && MONTHS[nxtCore] !== undefined && mdKey(MONTHS[nxtCore], parseInt(dayNum[1], 10))) {
      i += 1;
      continue;
    }
    const monthHere = MONTHS[core];
    if (monthHere !== undefined && nxtCore && DAYNUM_RE.test(nxtCore) && mdKey(monthHere, parseInt(nxtCore, 10))) {
      i += 1;
      continue;
    }

    kept.push(tok);
  }

  const clean = kept.join(" ").trim();
  /* input was tokens-only (e.g. "!high #tag ~2") — keep the whole line as
     text instead of creating an untitled task */
  if (!clean) return { clean: text };

  return { clean, dueDate, priority, categoryTitle, estimate, recurrence };
}
