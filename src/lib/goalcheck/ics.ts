/* =========================================================
   GoalCheck Advance — RFC 5545 (.ics) calendar interop
   =========================================================

   buildIcs(goals)
     Renders ONE VCALENDAR containing an all-day VEVENT for every
     OPEN task that carries a due date (Task.dueDate "YYYY-MM-DD")
     across the given boards. COMPLETED TASKS ARE DELIBERATELY
     SKIPPED (completed === true or status === "done") — a calendar
     full of past checkmarks is noise; un-complete a task and
     re-export to bring it back. Multiple boards merge into the one
     calendar; X-WR-CALNAME is the FIRST board's title (or
     "GoalCheck"), per-board VEVENTs are unaffected. DESCRIPTION is
     "<category title> — <task notes>" (notes omitted when empty).

   parseIcs(text)
     Tolerant reader for files from Google Calendar, Apple Calendar,
     Outlook, Todoist etc. VEVENT (DTSTART) and VTODO (DUE) blocks
     both become IcsEvents. RRULE is ignored — the first occurrence
     imports as a single event. VALARM / VTIMEZONE blocks are skipped
     cleanly (their DTSTART/DESCRIPTION never leak into events).
     Date handling — GoalCheck due dates are DATE-only, so a datetime
     keeps the date part of its own frame: Z-forms use the UTC date,
     TZID / floating forms keep the date as written (no tz shifting).
     Malformed input yields { calendarName: "", events: [] } — the
     parser never throws. Events without a parsable date are dropped;
     an empty SUMMARY is surfaced as "" (the importer UI substitutes
     a localized "Untitled event").

   RFC bits implemented
     - §3.1 line folding: content lines longer than 73 octets fold
       with CRLF + a single space (UTF-8 safe — a fold never splits
       a multi-byte character); unfolding accepts space OR tab.
     - §3.3.11 TEXT escaping: backslash, semicolon, comma, newlines.
     - All-day VEVENTs: DTSTART;VALUE=DATE + exclusive DTEND (+1 day).
   ========================================================= */

import type { GoalBoard } from "./types";

/* ---------- public shapes ---------- */

/** One dated entry worth importing (a VEVENT or a VTODO). */
export interface IcsEvent {
  uid: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  notes?: string;
}

export interface IcsParseResult {
  calendarName: string;
  events: IcsEvent[];
}

const CRLF = "\r\n";
const FOLD_AT = 73; // octets per physical line (continuation lines add one space)

/* ---------- low-level helpers ---------- */

/** UTF-8 byte length of one code point (for octet-safe folding). */
function utf8Octets(cp: number): number {
  if (cp < 0x80) return 1;
  if (cp < 0x800) return 2;
  if (cp < 0x10000) return 3;
  return 4;
}

function octetLength(s: string): number {
  let n = 0;
  for (const ch of s) n += utf8Octets(ch.codePointAt(0) ?? 0);
  return n;
}

/**
 * RFC 5545 §3.1 — fold content lines longer than 73 octets with
 * CRLF + a single space. Iterates code points, so multi-byte
 * characters (and surrogate pairs) are never cut in half.
 */
function foldLine(line: string): string {
  if (octetLength(line) <= FOLD_AT) return line;
  const parts: string[] = [];
  let current = "";
  let currentOctets = 0;
  for (const ch of line) {
    const o = utf8Octets(ch.codePointAt(0) ?? 0);
    if (currentOctets + o > FOLD_AT && current !== "") {
      parts.push(current);
      current = "";
      currentOctets = 0;
    }
    current += ch;
    currentOctets += o;
  }
  parts.push(current);
  return parts.join(CRLF + " ");
}

/** RFC 5545 §3.3.11 — escape a TEXT value. */
function escapeText(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * RFC 5545 §3.3.11 — unescape a TEXT value. Written as a scanner so
 * sequences like "\\n" (escaped backslash + n) decode correctly to
 * backslash + n instead of a newline.
 */
function unescapeText(v: string): string {
  let out = "";
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (c === "\\" && i + 1 < v.length) {
      const n = v[i + 1];
      if (n === "n" || n === "N") { out += "\n"; i++; continue; }
      if (n === "\\" || n === ";" || n === ",") { out += n; i++; continue; }
    }
    out += c;
  }
  return out;
}

/** Index of the first ":" outside double quotes (param values may be quoted). */
function lineColon(line: string): number {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ":" && !quoted) return i;
  }
  return -1;
}

function unquote(v: string): string {
  const t = v.trim();
  return t.length >= 2 && t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

/** "YYYY-MM-DD" → "YYYYMMDD" (input already validated). */
function compactDate(key: string): string {
  return key.replace(/-/g, "");
}

/**
 * ICS date/date-time value → "YYYY-MM-DD" (date part as written), or ""
 * when unparsable. Accepts VALUE=DATE (20250301), basic date-time
 * (20250301T223000Z) and tolerant extended forms (2025-03-01T22:30:00,
 * fractional seconds). Z / TZID / floating all keep their own frame's
 * date — see the header comment.
 */
function icsValueToDate(raw: string): string {
  const v = raw.trim();
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{4})-?(\d{2})-?(\d{2})[Tt ]\d{2}:?\d{2}:?\d{2}(?:\.\d+)?/.exec(v);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return "";
}

/** True when "YYYY-MM-DD" is a real calendar date (rejects e.g. 02-30). */
function isValidDateKey(key: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** "YYYY-MM-DD" + 1 day → "YYYY-MM-DD" (all-day DTEND is exclusive). */
function nextDay(key: string): string {
  const [y, mo, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d + 1));
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`;
}

/** Now as an RFC 5545 UTC DATE-TIME in basic format (20250101T120000Z). */
function dtStampNow(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? "0" + n : "" + n);
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/* =========================================================
   EXPORT
   ========================================================= */

/**
 * GoalBoard[] → RFC 5545 calendar text (CRLF line endings, folded
 * per §3.1). One VEVENT per OPEN, dated task — completed tasks are
 * skipped by design (see header comment).
 */
export function buildIcs(goals: GoalBoard[]): string {
  const lines: string[] = [];
  const calendarTitle = (goals[0]?.title || "").trim() || "GoalCheck";

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//GoalCheck//GoalCheck Advance//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push(`X-WR-CALNAME:${escapeText(calendarTitle)}`);

  for (const goal of goals) {
    for (const cat of goal.categories) {
      for (const task of cat.items) {
        /* open tasks only — see header comment */
        if (task.completed || task.status === "done") continue;
        if (!isValidDateKey(task.dueDate)) continue;
        const description = task.notes.trim() ? `${cat.title} — ${task.notes}` : cat.title;
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${task.id}@goalcheck.app`);
        lines.push(`DTSTAMP:${dtStampNow()}`);
        lines.push(`DTSTART;VALUE=DATE:${compactDate(task.dueDate)}`);
        lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay(task.dueDate))}`);
        lines.push(`SUMMARY:${escapeText(task.text)}`);
        lines.push(`DESCRIPTION:${escapeText(description)}`);
        lines.push("STATUS:CONFIRMED");
        lines.push("END:VEVENT");
      }
    }
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/* =========================================================
   IMPORT
   ========================================================= */

interface DraftEvent {
  kind: "VEVENT" | "VTODO";
  uid: string;
  title: string;
  date: string;
  notes: string;
}

/**
 * ICS text → { calendarName, events }. Defensive by contract: any
 * malformed input yields { calendarName: "", events: [] }, never a
 * throw. VEVENT (DTSTART) and VTODO (DUE) both become events; nested
 * VALARM/VTIMEZONE content is ignored; RRULE is ignored (first
 * occurrence only); events without a parsable date are dropped.
 */
export function parseIcs(text: string): IcsParseResult {
  try {
    /* §3.1 unfolding — remove CRLF (or bare LF/CR, tolerated) + one space/tab */
    const unfolded = (text || "")
      .replace(/\r\n[ \t]/g, "")
      .replace(/\n[ \t]/g, "")
      .replace(/\r[ \t]/g, "");
    const lines = unfolded.split(/\r\n|\r|\n/);

    const stack: string[] = [];
    let calendarName = "";
    let current: DraftEvent | null = null;
    const events: IcsEvent[] = [];

    const settle = () => {
      if (current && current.date) {
        events.push({
          uid: current.uid,
          title: current.title,
          date: current.date,
          ...(current.notes ? { notes: current.notes } : {}),
        });
      }
      current = null;
    };

    for (const line of lines) {
      if (!line) continue;
      const colon = lineColon(line);
      if (colon === -1) continue;
      /* name may carry params (VALUE=DATE, TZID=…) — tolerated but never
       * needed: the date part of the value itself decides the imported day */
      const name = line.slice(0, colon).split(";")[0].trim().toUpperCase();
      const value = line.slice(colon + 1);

      if (name === "BEGIN") {
        const kind = value.trim().toUpperCase();
        stack.push(kind);
        if (kind === "VEVENT" || kind === "VTODO") {
          current = { kind, uid: "", title: "", date: "", notes: "" };
        }
        continue;
      }
      if (name === "END") {
        const kind = value.trim().toUpperCase();
        if (stack[stack.length - 1] === kind) stack.pop();
        if ((kind === "VEVENT" || kind === "VTODO") && current) settle();
        continue;
      }

      /* only properties of the component itself; VALARM & friends are skipped */
      if (!current || stack[stack.length - 1] !== current.kind) {
        /* X-WR-CALNAME sits directly inside (or before) VCALENDAR */
        if (
          name === "X-WR-CALNAME" && !current && !calendarName &&
          (stack.length === 0 || stack[stack.length - 1] === "VCALENDAR")
        ) {
          calendarName = unescapeText(unquote(value));
        }
        continue;
      }

      switch (name) {
        case "UID":
          if (!current.uid) current.uid = value.trim();
          break;
        case "SUMMARY":
          if (!current.title) current.title = unescapeText(value);
          break;
        case "DESCRIPTION":
          if (!current.notes) current.notes = unescapeText(value);
          break;
        case "DTSTART":
          if (current.kind === "VEVENT" && !current.date) current.date = icsValueToDate(value);
          break;
        case "DUE":
          if (current.kind === "VTODO" && !current.date) current.date = icsValueToDate(value);
          break;
        default:
          /* RRULE, LAST-MODIFIED, SEQUENCE, … — first occurrence only */
          break;
      }
    }

    return { calendarName, events };
  } catch {
    return { calendarName: "", events: [] };
  }
}
