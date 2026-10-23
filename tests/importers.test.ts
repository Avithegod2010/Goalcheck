import { describe, expect, it } from "vitest";
import {
  detectAndParse,
  normalizeDueDate,
  parseGoogleTakeout,
  parseTickTickCsv,
  parseTodoistExport,
} from "@/lib/goalcheck/importers";
import type { ImportedGoal, ImportedTask } from "@/lib/goalcheck/importers";

/* ---------- fixtures ---------- */

function flatTasks(goals: ImportedGoal[]): ImportedTask[] {
  return goals.flatMap((g) => g.categories.flatMap((c) => c.items));
}

// combined backup: flattened items + project_id refs + sections
const TODOIST_FULL = JSON.stringify({
  projects: [{ id: "p1", name: "Launch Plan" }],
  sections: [{ id: "s1", name: "Design", project_id: "p1" }],
  items: [
    {
      content: "Wireframe hero",
      checked: false,
      priority: "P2",
      due: { date: "2024-03-01" },
      description: "use brand palette",
      section_id: "s1",
      project_id: "p1",
    },
    { content: "Ship landing page", checked: true, priority: "P1", project_id: "p1" },
  ],
});

// nested variant: tasks live on the project, no sections
const TODOIST_NESTED = JSON.stringify({
  projects: [
    { id: "p1", name: "Home", tasks: [{ content: "Fix sink", checked: false, priority: "P3" }] },
    { id: "p2", name: "Work", tasks: [{ content: "Send report", checked: true, priority: "P4" }] },
  ],
});

const GOOGLE_TAKEOUT = JSON.stringify([
  {
    kind: "tasks#taskList",
    id: "L1",
    title: "Errands",
    items: [
      { kind: "tasks#task", id: "t1", title: "Buy milk", notes: "2 liters", status: "needsAction", due: "2024-01-05T00:00:00.000Z" },
      { kind: "tasks#task", id: "t2", title: "Call dentist", status: "completed" },
    ],
  },
  { kind: "tasks#taskList", id: "L2", title: "Work", items: [] },
]);

// quoted commas, a newline inside a field, escaped quotes, ISO + local dates
const TICKTICK_CSV =
  "projectId,projectName,taskId,title,content,dueDate,completed,completedTime\n" +
  'p1,Errands,t1,"Buy milk, eggs","2 liters\nand bread",2024-01-05 15:30,false,\n' +
  'p1,Errands,t2,Call dentist,"He said ""go""",2024-01-06T08:00:00.000Z,true,2024-01-06 09:00\n' +
  "p2,Work,t3,Send report,,2024-01-07,false,";

/* ---------- todoist ---------- */

describe("parseTodoistExport", () => {
  it("parses the combined {projects, items} backup shape with sections", () => {
    const goals = parseTodoistExport(TODOIST_FULL);
    expect(goals).toHaveLength(1);
    const goal = goals[0];
    expect(goal.title).toBe("Launch Plan");
    expect(goal.subtitle).toBe("Imported from Todoist");
    expect(goal.categories.map((c) => c.title)).toEqual(["Design", "Launch Plan"]);

    const [design, rest] = goal.categories;
    expect(design.items[0]).toEqual({
      text: "Wireframe hero",
      completed: false,
      priority: "high",
      notes: "use brand palette",
      dueDate: "2024-03-01",
    });
    expect(rest.items[0]).toEqual({
      text: "Ship landing page",
      completed: true,
      priority: "urgent",
      notes: "",
      dueDate: "",
    });
  });

  it("parses the nested {projects[].tasks} shape as one category per project", () => {
    const goals = parseTodoistExport(TODOIST_NESTED);
    expect(goals).toHaveLength(2);
    expect(goals[0].title).toBe("Home");
    expect(goals[0].categories).toHaveLength(1);
    expect(goals[0].categories[0].title).toBe("Home");
    expect(goals[0].categories[0].items[0]).toMatchObject({ text: "Fix sink", completed: false, priority: "normal" });
    expect(goals[1].title).toBe("Work");
    expect(goals[1].categories[0].items[0]).toMatchObject({ text: "Send report", completed: true, priority: "normal" });
  });

  it("falls back to a catch-all goal when only orphan items exist", () => {
    const goals = parseTodoistExport(JSON.stringify({ items: [{ content: "Solo", checked: true, project_id: "ghost" }] }));
    expect(goals).toHaveLength(1);
    expect(goals[0].title).toBe("Todoist Import");
    expect(goals[0].categories[0].title).toBe("Tasks");
    expect(goals[0].categories[0].items[0]).toMatchObject({ text: "Solo", completed: true });
  });

  it("returns empty arrays on malformed JSON and never throws", () => {
    expect(parseTodoistExport("{oops")).toEqual([]);
    expect(parseTodoistExport("")).toEqual([]);
    expect(parseTodoistExport("null")).toEqual([]);
    expect(parseTodoistExport("42")).toEqual([]);
  });

  it("keeps a project with no items as one empty category", () => {
    const goals = parseTodoistExport(JSON.stringify({ projects: [{ id: "p", name: "Empty" }] }));
    expect(goals).toHaveLength(1);
    expect(goals[0].categories).toEqual([{ title: "Empty", items: [] }]);
  });
});

/* ---------- google takeout ---------- */

describe("parseGoogleTakeout", () => {
  it("converts each list into a goal with a single Tasks category", () => {
    const goals = parseGoogleTakeout(GOOGLE_TAKEOUT);
    expect(goals).toHaveLength(2);
    expect(goals[0].title).toBe("Errands");
    expect(goals[0].subtitle).toBe("Imported from Google Tasks");
    expect(goals[0].categories.map((c) => c.title)).toEqual(["Tasks"]);

    const items = goals[0].categories[0].items;
    expect(items[0]).toEqual({
      text: "Buy milk",
      completed: false,
      priority: "normal",
      notes: "2 liters",
      dueDate: "2024-01-05", // ISO timestamp truncated
    });
    expect(items[1]).toEqual({
      text: "Call dentist",
      completed: true,
      priority: "normal",
      notes: "",
      dueDate: "",
    });
    expect(goals[1].title).toBe("Work");
    expect(goals[1].categories[0].items).toEqual([]);
  });

  it("is tolerant of missing notes, due dates and status; malformed input yields []", () => {
    const goals = parseGoogleTakeout(JSON.stringify([{ id: "L", title: "Bare", items: [{ id: "t", title: "Bare task" }] }]));
    expect(goals).toHaveLength(1);
    expect(goals[0].categories[0].items[0]).toEqual({
      text: "Bare task",
      completed: false,
      priority: "normal",
      notes: "",
      dueDate: "",
    });

    expect(parseGoogleTakeout("nope")).toEqual([]);
    expect(parseGoogleTakeout("")).toEqual([]);
    expect(parseGoogleTakeout(JSON.stringify({ kind: "tasks#taskList", title: "Solo list", items: [] }))).toHaveLength(1);
  });
});

/* ---------- ticktick csv ---------- */

describe("parseTickTickCsv", () => {
  it("handles quoted commas, embedded newlines and escaped quotes", () => {
    const goals = parseTickTickCsv(TICKTICK_CSV);
    expect(goals.map((g) => g.title)).toEqual(["Errands", "Work"]);
    expect(goals[0].categories[0].title).toBe("Tasks");

    const items = goals[0].categories[0].items;
    expect(items[0].text).toBe("Buy milk, eggs");
    expect(items[0].notes).toBe("2 liters\nand bread");
    expect(items[0].dueDate).toBe("2024-01-05"); // "2024-01-05 15:30" truncated
    expect(items[0].completed).toBe(false);

    expect(items[1].notes).toBe('He said "go"');
    expect(items[1].dueDate).toBe("2024-01-06"); // ISO truncated
    expect(items[1].completed).toBe(true);

    expect(goals[1].categories[0].items[0]).toMatchObject({ text: "Send report", dueDate: "2024-01-07", completed: false });
  });

  it("matches columns case-insensitively and requires a title column", () => {
    const alt = "ProjectID,ProjectName,Title,Content,DueDate,Completed\np1,Alfa,Do it,check the garage,2024-02-02,TRUE\n";
    const goals = parseTickTickCsv(alt);
    expect(goals).toHaveLength(1);
    expect(goals[0].title).toBe("Alfa");
    expect(goals[0].categories[0].items[0]).toMatchObject({ text: "Do it", notes: "check the garage", completed: true, dueDate: "2024-02-02" });

    expect(parseTickTickCsv("a,b,c\n1,2,3")).toEqual([]); // no title column
    expect(parseTickTickCsv("")).toEqual([]);
  });
});

/* ---------- detection ---------- */

describe("detectAndParse", () => {
  it("routes todoist, google and ticktick payloads", () => {
    expect(detectAndParse(TODOIST_FULL)).toMatchObject({ format: "todoist" });
    expect(detectAndParse(TODOIST_FULL).goals).toHaveLength(1);

    expect(detectAndParse(GOOGLE_TAKEOUT)).toMatchObject({ format: "google" });
    expect(detectAndParse(GOOGLE_TAKEOUT).goals).toHaveLength(2);

    expect(detectAndParse(TICKTICK_CSV)).toMatchObject({ format: "ticktick" });
    expect(detectAndParse(TICKTICK_CSV).goals).toHaveLength(2);
  });

  it("returns unknown with no goals for anything else", () => {
    expect(detectAndParse("hello world")).toEqual({ format: "unknown", goals: [] });
    expect(detectAndParse("")).toEqual({ format: "unknown", goals: [] });
    expect(detectAndParse("{broken json")).toEqual({ format: "unknown", goals: [] });
    expect(detectAndParse('{"unrelated":[1,2,3]}')).toEqual({ format: "unknown", goals: [] });
    expect(detectAndParse("a,b,c\n1,2,3")).toEqual({ format: "unknown", goals: [] });
  });
});

/* ---------- priority + date normalization ---------- */

describe("priority mapping", () => {
  it("maps the todoist P-scale and the inverted numeric scale", () => {
    const goals = parseTodoistExport(
      JSON.stringify({
        projects: [
          {
            id: "p",
            name: "P",
            items: [
              { content: "a", priority: "P1" },
              { content: "b", priority: "P2" },
              { content: "c", priority: "P3" },
              { content: "d", priority: "P4" },
              { content: "e", priority: 4 },
              { content: "f", priority: 3 },
              { content: "g", priority: 2 },
              { content: "h", priority: 1 },
              { content: "i", priority: "banana" },
              { content: "j" },
            ],
          },
        ],
      })
    );
    expect(flatTasks(goals).map((t) => t.priority)).toEqual([
      "urgent", "high", "normal", "normal", // P1..P4
      "urgent", "high", "normal", "normal", // ints 4,3,2,1
      "normal", "normal", // junk + missing
    ]);
  });
});

describe("normalizeDueDate", () => {
  it("truncates ISO and local datetimes to YYYY-MM-DD without timezone drift", () => {
    expect(normalizeDueDate("2024-01-05")).toBe("2024-01-05");
    expect(normalizeDueDate("2024-01-05T23:59:59.000Z")).toBe("2024-01-05");
    expect(normalizeDueDate("2024-01-05 15:30")).toBe("2024-01-05");
    expect(normalizeDueDate("2024-01-05T00:00:00+05:30")).toBe("2024-01-05");
    expect(normalizeDueDate("2024-1-5")).toBe("2024-01-05"); // zero-padding
  });

  it("unwraps {date} objects and yields \"\" for junk", () => {
    expect(normalizeDueDate({ date: "2024-02-03" })).toBe("2024-02-03");
    expect(normalizeDueDate("")).toBe("");
    expect(normalizeDueDate("not a date")).toBe("");
    expect(normalizeDueDate(undefined)).toBe("");
  });
});
