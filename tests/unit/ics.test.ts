import { describe, expect, it } from "vitest";
import { buildIcs, parseIcs } from "@/lib/goalcheck/ics";
import type { Category, GoalBoard, Task } from "@/lib/goalcheck/types";

/* ---------- fixtures ---------- */

let seq = 0;

function task(partial: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `task_${seq}`,
    text: "Task",
    completed: false,
    priority: "normal",
    notes: "",
    status: "todo",
    subtasks: [],
    pomosEstimate: 1,
    pomoCount: 0,
    dependsOn: "",
    dueDate: "",
    timeSpent: 0,
    recurrence: "none",
    respawnedFrom: "",
    completedAt: 0,
    estimate: 0,
    attachments: [],
    createdAt: 0,
    ...partial,
  };
}

function cat(title: string, items: Task[]): Category {
  seq += 1;
  return {
    id: `cat_${seq}`,
    title,
    media: "mono:clipboard-check",
    recurrence: "none",
    lastResetDate: "2025-01-01",
    lastWeekKey: "2025-W01",
    items,
  };
}

function board(title: string, categories: Category[]): GoalBoard {
  seq += 1;
  return {
    id: `goal_${seq}`,
    title,
    subtitle: "",
    media: "mono:target-radar",
    categories,
    createdAt: 0,
    archived: false,
  };
}

const OCTETS = new TextEncoder();

function oneEventIcs(dtstartLine: string): string {
  return [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:probe@goalcheck.app",
    dtstartLine,
    "SUMMARY:probe",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/* ---------- export: calendar shape ---------- */

describe("buildIcs", () => {
  it("wraps output in a valid VCALENDAR with CRLF line endings throughout", () => {
    const ics = buildIcs([board("Launch", [cat("Plan", [task({ text: "Ship", dueDate: "2025-03-01" })])])]);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//GoalCheck//GoalCheck Advance//EN");
    expect(ics).toContain("CALSCALE:GREGORIAN");
    expect(ics).toContain("X-WR-CALNAME:Launch");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // every newline is a CRLF — no bare LF anywhere
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("emits one all-day VEVENT per open dated task (DTSTART, exclusive DTEND, UID, DTSTAMP)", () => {
    const ics = buildIcs([
      board("B", [cat("C", [task({ id: "t42", text: "Ship it", dueDate: "2025-03-01", notes: "final pass" })])]),
    ]);
    expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(1);
    expect(ics).toContain("UID:t42@goalcheck.app");
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toContain("DTSTART;VALUE=DATE:20250301");
    expect(ics).toContain("DTEND;VALUE=DATE:20250302"); // all-day end is exclusive: due + 1 day
    expect(ics).toContain("SUMMARY:Ship it");
    expect(ics).toContain("DESCRIPTION:C — final pass");
    expect(ics).toContain("STATUS:CONFIRMED");
  });

  it("skips completed tasks, undated tasks and invalid dates — empty calendar when nothing remains", () => {
    const ics = buildIcs([
      board("B", [
        cat("C", [
          task({ text: "completed-flag", dueDate: "2025-03-01", completed: true }),
          task({ text: "completed-status", dueDate: "2025-03-01", status: "done" }),
          task({ text: "never-dated" }),
          task({ text: "impossible-date", dueDate: "2025-02-30" }),
        ]),
      ]),
    ]);
    expect(ics).not.toContain("completed-flag");
    expect(ics).not.toContain("completed-status");
    expect(ics).not.toContain("never-dated");
    expect(ics).not.toContain("impossible-date");
    expect(ics).not.toContain("BEGIN:VEVENT"); // nothing dated+open → bare calendar
    expect(ics).toContain("BEGIN:VCALENDAR");
  });

  it("escapes TEXT values per RFC 5545 §3.3.11 (backslash, semicolon, comma, newlines)", () => {
    const ics = buildIcs([
      board("B", [cat("C", [task({ text: "A;B,C\\D\nE", dueDate: "2025-03-01" })])]),
    ]);
    expect(ics).toContain("SUMMARY:A\\;B\\,C\\\\D\\nE");
  });

  it("folds lines longer than 73 octets with CRLF + single space, round-tripping a 200-char unicode summary", () => {
    const longTitle = "默认词汇表".repeat(40); // 200 chars, 600 UTF-8 octets
    const ics = buildIcs([board("B", [cat("C", [task({ text: longTitle, dueDate: "2025-03-01" })])])]);
    expect(ics).toContain("\r\n "); // actually folded
    for (const line of ics.split("\r\n")) {
      if (line === "") continue;
      expect(OCTETS.encode(line).length).toBeLessThanOrEqual(74); // 73 content octets + fold space
    }
    const parsed = parseIcs(ics);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].title).toBe(longTitle); // no multi-byte character cut in half
  });

  it("folds emoji (surrogate pair) summaries without splitting code points", () => {
    const emojiTitle = "🚀🎯".repeat(60); // 120 code points, 240 octets
    const ics = buildIcs([board("B", [cat("C", [task({ text: emojiTitle, dueDate: "2025-03-01" })])])]);
    const parsed = parseIcs(ics);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0].title).toBe(emojiTitle);
  });

  it("round-trip build → parse preserves title, date and the category — notes description", () => {
    const parsed = parseIcs(
      buildIcs([
        board("Launch Plan", [
          cat("Launch", [
            task({ id: "t1", text: "Design review", dueDate: "2025-03-10", notes: "bring mockups" }),
            task({ id: "t2", text: "Second; task", dueDate: "2025-03-11" }),
          ]),
        ]),
      ])
    );
    expect(parsed.calendarName).toBe("Launch Plan");
    expect(parsed.events).toHaveLength(2);
    expect(parsed.events[0].uid).toBe("t1@goalcheck.app");
    expect(parsed.events[0].title).toBe("Design review");
    expect(parsed.events[0].date).toBe("2025-03-10");
    expect(parsed.events[0].notes).toBe("Launch — bring mockups"); // DESCRIPTION = "<category> — <notes>"
    expect(parsed.events[1].title).toBe("Second; task"); // escaped ; survives the round-trip
    expect(parsed.events[1].date).toBe("2025-03-11");
    expect(parsed.events[1].notes).toBe("Launch");
  });

  it("merges multiple boards into ONE calendar named after the first", () => {
    const ics = buildIcs([
      board("First", [cat("C1", [task({ text: "alpha", dueDate: "2025-03-01" })])]),
      board("Second", [cat("C2", [task({ text: "beta", dueDate: "2025-03-02" })])]),
    ]);
    expect((ics.match(/BEGIN:VCALENDAR/g) || []).length).toBe(1);
    expect(ics).toContain("X-WR-CALNAME:First");
    expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
    expect(ics).toContain("SUMMARY:alpha");
    expect(ics).toContain("SUMMARY:beta");
  });
});

/* ---------- import: tolerant RFC reader ---------- */

describe("parseIcs", () => {
  it("unfolds continuation lines folded with a space or a tab", () => {
    /* RFC 5545 §3.1 unfolding removes the CRLF + the ONE fold whitespace char,
     * so a content-leading space must be doubled in the source file. */
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:u1",
      "DTSTART;VALUE=DATE:20250301",
      "SUMMARY:hello",
      "  world",
      "DESCRIPTION:a",
      "\tb",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const res = parseIcs(raw);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].title).toBe("hello world");
    expect(res.events[0].notes).toBe("ab");
  });

  it("reads VALUE=DATE, Z, floating and TZID datetime DTSTARTs as their own frame's date", () => {
    expect(parseIcs(oneEventIcs("DTSTART;VALUE=DATE:20250301")).events[0].date).toBe("2025-03-01");
    expect(parseIcs(oneEventIcs("DTSTART:20250301T223000Z")).events[0].date).toBe("2025-03-01"); // UTC date
    expect(parseIcs(oneEventIcs("DTSTART:20250301T223000")).events[0].date).toBe("2025-03-01"); // floating → as written
    expect(parseIcs(oneEventIcs("DTSTART;TZID=America/New_York:20250301T223000")).events[0].date).toBe("2025-03-01");
    expect(parseIcs(oneEventIcs("DTSTART:2025-03-01T22:30:00.000Z")).events[0].date).toBe("2025-03-01"); // extended + fractional
  });

  it("imports VTODO blocks via DUE", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTODO",
      "UID:v1",
      "DUE;VALUE=DATE:20250401",
      "SUMMARY:Tax filing",
      "END:VTODO",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const res = parseIcs(raw);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].uid).toBe("v1");
    expect(res.events[0].title).toBe("Tax filing");
    expect(res.events[0].date).toBe("2025-04-01");
  });

  it("skips VALARM blocks cleanly — alarm properties never leak into the event", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:u1",
      "DTSTART;VALUE=DATE:20250301",
      "SUMMARY:Real event",
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      "DESCRIPTION:alarm noise",
      "END:VALARM",
      "DESCRIPTION:real notes",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const res = parseIcs(raw);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].title).toBe("Real event");
    expect(res.events[0].notes).toBe("real notes"); // not the alarm's DESCRIPTION
  });

  it("ignores RRULE — imports the first occurrence only", () => {
    const raw = oneEventIcs("DTSTART;VALUE=DATE:20250301").replace(
      "SUMMARY:probe",
      "RRULE:FREQ=DAILY;COUNT=10\r\nSUMMARY:probe"
    );
    const res = parseIcs(raw);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].date).toBe("2025-03-01");
  });

  it("ignores VTIMEZONE blocks — their DTSTART must not leak into events", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VTIMEZONE",
      "TZID:America/New_York",
      "BEGIN:DAYLIGHT",
      "DTSTART:19700308T020000",
      "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU",
      "END:DAYLIGHT",
      "END:VTIMEZONE",
      "BEGIN:VEVENT",
      "UID:u1",
      "DTSTART;VALUE=DATE:20250301",
      "SUMMARY:After tz",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    const res = parseIcs(raw);
    expect(res.events).toHaveLength(1);
    expect(res.events[0].date).toBe("2025-03-01");
    expect(res.events[0].title).toBe("After tz");
  });

  it("unescapes TEXT sequences (\\; \\, \\\\ \\n)", () => {
    const raw = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:u1",
      "DTSTART;VALUE=DATE:20250301",
      "SUMMARY:a\\;b\\,c\\\\d\\nsecond line",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    expect(parseIcs(raw).events[0].title).toBe("a;b,c\\d\nsecond line");
  });

  it("reads X-WR-CALNAME as the calendar name (quoted or plain)", () => {
    expect(parseIcs("BEGIN:VCALENDAR\r\nX-WR-CALNAME:My Calendar\r\nEND:VCALENDAR").calendarName).toBe("My Calendar");
    expect(parseIcs('BEGIN:VCALENDAR\r\nX-WR-CALNAME:"Quoted; name"\r\nEND:VCALENDAR').calendarName).toBe("Quoted; name");
  });

  it("returns an empty result for malformed input and never throws", () => {
    expect(parseIcs("")).toEqual({ calendarName: "", events: [] });
    expect(parseIcs("!!!not an ics at all!!!")).toEqual({ calendarName: "", events: [] });
    // unclosed VEVENT without a date → dropped, no throw
    expect(parseIcs("BEGIN:VEVENT\r\nSUMMARY:unclosed")).toEqual({ calendarName: "", events: [] });
    // a valid name with zero events still surfaces the name
    expect(parseIcs("BEGIN:VCALENDAR\r\nX-WR-CALNAME:Only name\r\nEND:VCALENDAR")).toEqual({
      calendarName: "Only name",
      events: [],
    });
    // dateless events are dropped
    expect(parseIcs(oneEventIcs("SUMMARY:no date here")).events).toEqual([]);
  });
});
