import { describe, expect, it } from "vitest";
import { parseQuickAdd } from "@/lib/goalcheck/nlp";
import { isValidRecurrence } from "@/lib/goalcheck/logic";

/*
 * Task 17-b — natural-language quick-add parser.
 * Reference "now": Wednesday 2025-06-04 (local) so relative dates are
 * deterministic regardless of the machine clock / timezone.
 */

const NOW = new Date(2025, 5, 4); /* Wed 2025-06-04 */
const parse = (input: string, extractDates = true) =>
  parseQuickAdd(input, { extractDates, now: NOW });

describe("parseQuickAdd — date phrases", () => {
  it("keeps plain text untouched when nothing parses", () => {
    expect(parse("Buy oat milk")).toEqual({ clean: "Buy oat milk" });
  });

  it("parses today / tonight / eod to today's date", () => {
    expect(parse("water plants today")).toEqual({ clean: "water plants", dueDate: "2025-06-04" });
    expect(parse("call mum tonight")).toEqual({ clean: "call mum", dueDate: "2025-06-04" });
    expect(parse("send invoice eod")).toEqual({ clean: "send invoice", dueDate: "2025-06-04" });
  });

  it("parses tomorrow / tmr", () => {
    expect(parse("gym tomorrow")).toEqual({ clean: "gym", dueDate: "2025-06-05" });
    expect(parse("tmr call mum")).toEqual({ clean: "call mum", dueDate: "2025-06-05" });
  });

  it("parses a bare weekday to its next occurrence", () => {
    /* Wed → coming Friday */
    expect(parse("submit report friday")).toEqual({ clean: "submit report", dueDate: "2025-06-06" });
  });

  it("parses 'next <weekday>' to the following week's occurrence", () => {
    expect(parse("submit report next friday")).toEqual({ clean: "submit report", dueDate: "2025-06-13" });
    expect(parse("next monday standup")).toEqual({ clean: "standup", dueDate: "2025-06-09" });
  });

  it("parses 'next week' to today+7", () => {
    expect(parse("start course next week")).toEqual({ clean: "start course", dueDate: "2025-06-11" });
  });

  it("parses 'in N days' and 'in N weeks'", () => {
    expect(parse("demo in 3 days")).toEqual({ clean: "demo", dueDate: "2025-06-07" });
    expect(parse("review in 2 weeks")).toEqual({ clean: "review", dueDate: "2025-06-18" });
  });

  it("parses 'on 25/12' (day/month) in the current or next year", () => {
    expect(parse("flight on 25/12")).toEqual({ clean: "flight", dueDate: "2025-12-25" });
    const NYE = new Date(2025, 11, 30);
    expect(parseQuickAdd("party on 2/1", { now: NYE })).toEqual({ clean: "party", dueDate: "2026-01-02" });
  });

  it("parses '25 dec' and 'dec 25'", () => {
    expect(parse("taxes 25 dec")).toEqual({ clean: "taxes", dueDate: "2025-12-25" });
    expect(parse("dec 25 party")).toEqual({ clean: "party", dueDate: "2025-12-25" });
  });

  it("keeps clock times in the text (app dueDate is date-only)", () => {
    expect(parse("standup 5pm")).toEqual({ clean: "standup 5pm" });
    expect(parse("sync 17:00")).toEqual({ clean: "sync 17:00" });
    expect(parse("meet at 5 noon")).toEqual({ clean: "meet at 5 noon" });
  });

  it("first date wins — later date phrases stay as text", () => {
    expect(parse("milk today tomorrow")).toEqual({ clean: "milk tomorrow", dueDate: "2025-06-04" });
  });
});

describe("parseQuickAdd — priority / category / estimate / recurrence", () => {
  it("parses !high / !! → high", () => {
    expect(parse("milk !high")).toEqual({ clean: "milk", priority: "high" });
    expect(parse("milk !!")).toEqual({ clean: "milk", priority: "high" });
  });

  it("parses !urgent / !u / !!! → urgent", () => {
    expect(parse("fix bug !urgent")).toEqual({ clean: "fix bug", priority: "urgent" });
    expect(parse("fix bug !u")).toEqual({ clean: "fix bug", priority: "urgent" });
    expect(parse("fix bug !!!")).toEqual({ clean: "fix bug", priority: "urgent" });
  });

  it("strips !med / !m / !low / !l to the default (no low tier in this app)", () => {
    expect(parse("sort socks !med")).toEqual({ clean: "sort socks" });
    expect(parse("sort socks !m")).toEqual({ clean: "sort socks" });
    expect(parse("sort socks !low")).toEqual({ clean: "sort socks" });
    expect(parse("sort socks !l")).toEqual({ clean: "sort socks" });
  });

  it("keeps unknown !words as plain text", () => {
    expect(parse("ask bob !soon")).toEqual({ clean: "ask bob !soon" });
  });

  it("parses #tag into categoryTitle (last tag wins)", () => {
    expect(parse("milk #errands")).toEqual({ clean: "milk", categoryTitle: "errands" });
    expect(parse("milk #a #b")).toEqual({ clean: "milk", categoryTitle: "b" });
  });

  it("parses ~N estimate (1-12) and leaves out-of-range tokens as text", () => {
    expect(parse("essay ~3")).toEqual({ clean: "essay", estimate: 3 });
    expect(parse("deep work ~12")).toEqual({ clean: "deep work", estimate: 12 });
    expect(parse("essay ~13")).toEqual({ clean: "essay ~13" });
    expect(parse("essay ~0")).toEqual({ clean: "essay ~0" });
  });

  it("parses recurrence phrases (validated with isValidRecurrence)", () => {
    expect(parse("water plants every day")).toEqual({ clean: "water plants", recurrence: "daily" });
    expect(parse("water plants everyday")).toEqual({ clean: "water plants", recurrence: "daily" });
    expect(parse("gym every week")).toEqual({ clean: "gym", recurrence: "weekly" });
    expect(parse("pay rent every month")).toEqual({ clean: "pay rent", recurrence: "monthly:1:1" });
    expect(parse("rest every 3 days")).toEqual({ clean: "rest", recurrence: "every:3" });
    expect(isValidRecurrence("every:3")).toBe(true);
  });

  it("keeps 'every 1 days' as text (every:1 is not a valid recurrence)", () => {
    expect(parse("rest every 1 days")).toEqual({ clean: "rest every 1 days" });
  });
});

describe("parseQuickAdd — composition & modes", () => {
  it("extractDates:false keeps date phrases in the text but still parses the rest", () => {
    expect(parse("gym tomorrow !high", false)).toEqual({ clean: "gym tomorrow", priority: "high" });
    expect(parse("demo in 3 days #ops", false)).toEqual({ clean: "demo in 3 days", categoryTitle: "ops" });
    expect(parse("gym every week", false)).toEqual({ clean: "gym", recurrence: "weekly" });
  });

  it("never NL-parses the • multi-task syntax (passthrough)", () => {
    const line = "To do in laptop • errands; milk; gym • /f";
    expect(parse(line)).toEqual({ clean: line });
    expect(parse("milk !high • gym")).toEqual({ clean: "milk !high • gym" });
  });

  it("falls back to the original text when the line is tokens-only", () => {
    expect(parse("!high #tag ~2 today")).toEqual({ clean: "!high #tag ~2 today" });
  });

  it("preserves unicode text and collapses whitespace", () => {
    expect(parse("買牛奶   tomorrow 🌟")).toEqual({ clean: "買牛奶 🌟", dueDate: "2025-06-05" });
    expect(parse("buy   milk    tomorrow")).toEqual({ clean: "buy milk", dueDate: "2025-06-05" });
  });

  it("composes every token family in one line", () => {
    expect(parse("milk #errands tomorrow !high ~2 every week")).toEqual({
      clean: "milk",
      dueDate: "2025-06-05",
      priority: "high",
      categoryTitle: "errands",
      estimate: 2,
      recurrence: "weekly",
    });
  });

  it("handles empty input", () => {
    expect(parse("")).toEqual({ clean: "" });
  });
});
