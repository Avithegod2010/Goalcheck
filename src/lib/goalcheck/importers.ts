/* =========================================================
   GoalCheck Pro — Import migrators (other apps -> GoalCheck)
   =========================================================
   Pure, DOM-free converters that turn third-party task exports
   into GoalCheck-shaped plain data (ImportedGoal). Zero new
   dependencies — even the CSV reader is hand-rolled.

   Supported sources:
   - Todoist JSON backup: the combined `{projects, items}` shape,
     the nested `{projects[].items | .tasks}` shape, and the
     flattened `{items:[...] + project_id}` variant. A top-level
     `sections` array maps `section_id` -> category titles; when
     absent, each project gets one category named after it.
   - Google Tasks Takeout (Tasks.json): one goal per list,
     one "Tasks" category per list.
   - TickTick CSV backup: rows grouped by projectName, single
     "Tasks" category per project.

   Conventions:
   - dueDate normalized to "YYYY-MM-DD" ("" when absent/invalid)
   - priorities collapse into normal | high | urgent
     (Todoist "P1"->urgent, "P2"->high, "P3"/"P4"->normal;
      numeric Todoist ints are inverted: 4->urgent, 3->high;
      TickTick "high"/5+ -> high, "urgent" -> urgent)
   - every parser is defensive: malformed input yields an empty
     result, never throws
   ========================================================= */

/* ---------- shared import shapes ---------- */

export interface ImportedTask {
  text: string;
  completed: boolean;
  priority: "normal" | "high" | "urgent";
  notes: string;
  /** "" | YYYY-MM-DD */
  dueDate: string;
}

export interface ImportedCategory {
  title: string;
  items: ImportedTask[];
}

export interface ImportedGoal {
  title: string;
  subtitle: string;
  categories: ImportedCategory[];
}

export type ImportFormat = "todoist" | "google" | "ticktick" | "unknown";

export interface ImportDetection {
  format: ImportFormat;
  goals: ImportedGoal[];
}

/* ---------- tiny defensive helpers ---------- */

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** tolerant truthiness for flag-ish values (true / 1 / "1" / "true") */
function flag(v: unknown): boolean {
  return v === true || v === 1 || v === "1" || v === "true";
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function makeImportedTask(text: string, opts: Partial<ImportedTask> = {}): ImportedTask {
  return { text: text.trim(), completed: false, priority: "normal", notes: "", dueDate: "", ...opts };
}

function utcDateKey(d: Date): string {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${d.getUTCFullYear()}-${m < 10 ? "0" + m : m}-${day < 10 ? "0" + day : day}`;
}

/**
 * Normalize any date-ish value into YYYY-MM-DD ("" when unparsable).
 * Prefers a literal YYYY-MM-DD prefix — "2024-01-05T09:00:00Z" and
 * "2024-01-05 15:30" are truncated with no timezone drift; exotic
 * formats (and epoch numbers) fall back to Date parsing via UTC parts.
 */
export function normalizeDueDate(input: unknown): string {
  const raw = isObj(input) ? input.date : input;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? "" : utcDateKey(d);
  }
  const s = asString(raw).trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : utcDateKey(new Date(t));
}

/* ---------- priority scales ---------- */

/**
 * Todoist writes priorities as "P1..P4" strings (P1 = most important)
 * or raw ints 1..4 (4 = most important, i.e. UI "P1"). Both collapse
 * into GoalCheck's normal | high | urgent.
 */
function mapTodoistPriority(v: unknown): ImportedTask["priority"] {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.round(v);
    if (n >= 4) return "urgent";
    if (n === 3) return "high";
    return "normal";
  }
  const s = asString(v).trim();
  const p = /^p\s*([1-4])$/i.exec(s);
  if (p) {
    const d = Number(p[1]);
    if (d === 1) return "urgent";
    if (d === 2) return "high";
    return "normal";
  }
  if (/^[1-4]$/.test(s)) return mapTodoistPriority(Number(s));
  return "normal";
}

/**
 * TickTick CSV priority column ("High"/"Medium"/"Low"/"None" or the
 * API ints 0/1/3/5). Only clear escalations leave the default.
 */
function mapTickTickPriority(v: unknown): ImportedTask["priority"] {
  const s = asString(v).trim().toLowerCase();
  if (!s) return "normal";
  if (s.includes("urgent") || s.includes("critical")) return "urgent";
  if (s.includes("high")) return "high";
  const n = Number(s);
  if (Number.isFinite(n) && n >= 5) return "high";
  return "normal";
}

/* ---------- Todoist ---------- */

function todoistItemToTask(it: Record<string, unknown>): ImportedTask | null {
  if (flag(it.is_deleted) || flag(it.deleted)) return null;
  const text = asString(it.content) || asString(it.title);
  if (!text.trim()) return null;
  return makeImportedTask(text, {
    completed: flag(it.checked) || flag(it.is_completed),
    priority: mapTodoistPriority(it.priority),
    notes: asString(it.description) || asString(it.note),
    dueDate: normalizeDueDate(it.due ?? it.due_date),
  });
}

/**
 * Todoist backup JSON -> ImportedGoal per project.
 * Handles: `{projects:[{name, items|tasks:[...]}]}` (nested),
 * `{projects:[...], items:[...]}` (flattened, `project_id` refs),
 * a bare top-level array of projects, and orphan items with no
 * projects list (one catch-all goal). Sections (`sections` array +
 * `section_id` on items) become category titles; when absent, one
 * category per project named after the project.
 */
export function parseTodoistExport(json: string): ImportedGoal[] {
  const data = safeJsonParse(json);
  const projects: Record<string, unknown>[] = [];
  const flatItems: Record<string, unknown>[] = [];
  const sectionNames = new Map<string, string>();

  if (Array.isArray(data)) {
    // bare array of projects (some exporters emit this)
    for (const p of data) if (isObj(p)) projects.push(p);
  } else if (isObj(data)) {
    if (Array.isArray(data.projects)) {
      for (const p of data.projects) if (isObj(p)) projects.push(p);
    }
    const flat = [...(Array.isArray(data.items) ? data.items : []), ...(Array.isArray(data.tasks) ? data.tasks : [])];
    for (const it of flat) if (isObj(it)) flatItems.push(it);
    if (Array.isArray(data.sections)) {
      for (const s of data.sections) {
        if (!isObj(s)) continue;
        const id = asString(s.id);
        if (id) sectionNames.set(id, asString(s.name) || "Section");
      }
    }
  } else {
    return [];
  }

  const goals: ImportedGoal[] = [];

  for (const p of projects) {
    const pid = asString(p.id);
    const name = asString(p.name) || "Untitled project";

    const records: Record<string, unknown>[] = [];
    const nested = [...(Array.isArray(p.items) ? p.items : []), ...(Array.isArray(p.tasks) ? p.tasks : [])];
    for (const it of nested) if (isObj(it)) records.push(it);
    if (pid) {
      for (const it of flatItems) if (asString(it.project_id) === pid) records.push(it);
    }

    const groups = new Map<string, ImportedTask[]>();
    let usesSections = false;

    for (const it of records) {
      const task = todoistItemToTask(it);
      if (!task) continue;
      const sectionTitle = sectionNames.get(asString(it.section_id)) ?? "";
      if (sectionTitle) usesSections = true;
      const key = sectionTitle || name;
      const bucket = groups.get(key);
      if (bucket) bucket.push(task);
      else groups.set(key, [task]);
    }

    const categories: ImportedCategory[] = usesSections
      ? Array.from(groups.entries()).map(([title, items]) => ({ title, items }))
      : [{ title: name, items: Array.from(groups.values()).flat() }];

    goals.push({
      title: name,
      subtitle: "Imported from Todoist",
      categories: categories.length > 0 ? categories : [{ title: name, items: [] }],
    });
  }

  // items referencing projects that are missing entirely -> catch-all goal
  if (projects.length === 0 && flatItems.length > 0) {
    const items: ImportedTask[] = [];
    for (const it of flatItems) {
      const task = todoistItemToTask(it);
      if (task) items.push(task);
    }
    if (items.length > 0) {
      goals.push({ title: "Todoist Import", subtitle: "Imported from Todoist", categories: [{ title: "Tasks", items }] });
    }
  }

  return goals;
}

/* ---------- Google Tasks Takeout ---------- */

/**
 * Google Tasks Takeout (Tasks.json) -> one ImportedGoal per list,
 * one "Tasks" category per list. Google Tasks has no priorities, so
 * every task imports as "normal". Missing notes/due/status fields
 * are tolerated.
 */
export function parseGoogleTakeout(json: string): ImportedGoal[] {
  const data = safeJsonParse(json);
  const lists = Array.isArray(data) ? data : isObj(data) ? [data] : [];

  const goals: ImportedGoal[] = [];
  for (const list of lists) {
    if (!isObj(list)) continue;
    const items = Array.isArray(list.items) ? list.items : [];
    const tasks: ImportedTask[] = [];
    for (const raw of items) {
      if (!isObj(raw) || flag(raw.deleted)) continue;
      const text = asString(raw.title);
      if (!text.trim()) continue;
      tasks.push(
        makeImportedTask(text, {
          completed: asString(raw.status) === "completed",
          notes: asString(raw.notes),
          dueDate: normalizeDueDate(raw.due),
        })
      );
    }
    goals.push({
      title: asString(list.title) || "Untitled list",
      subtitle: "Imported from Google Tasks",
      categories: [{ title: "Tasks", items: tasks }],
    });
  }
  return goals;
}

/* ---------- TickTick CSV ---------- */

/**
 * RFC-4180-ish CSV reader (no dependencies): quoted fields may span
 * commas/newlines and double-quotes are escaped by doubling ("").
 * Returns a grid of raw cell strings.
 */
function parseCsv(input: string): string[][] {
  const s = (input || "").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      if (s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * TickTick backup CSV -> one ImportedGoal per projectName (single
 * "Tasks" category). Columns are located case-insensitively and only
 * `title` is required. Blank rows are ignored; malformed input (no
 * recognizable header) yields [].
 */
export function parseTickTickCsv(csv: string): ImportedGoal[] {
  const rows = parseCsv(csv).filter((r) => r.some((f) => f.trim() !== ""));
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const findCol = (names: string[]): number => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const findColPrefix = (prefix: string): number => header.findIndex((h) => h.startsWith(prefix));

  const iTitle = findCol(["title", "taskname", "task name", "task_title", "name"]);
  if (iTitle === -1) return []; // title column is required

  const iProject = findCol(["projectname", "project name", "project_name", "listname", "list name"]);
  const iProjectId = findCol(["projectid", "project id"]);
  const iNotes = findCol(["content", "notes", "note", "description", "desc"]);
  let iDue = findCol(["duedate", "due date", "due_date"]);
  if (iDue === -1) iDue = findColPrefix("duedate");
  const iCompleted = findCol(["completed", "iscompleted", "is completed"]);
  const iCompletedTime = findCol(["completedtime", "completed time"]);
  const iPriority = findCol(["priority"]);

  const groups = new Map<string, ImportedTask[]>();

  for (const row of rows.slice(1)) {
    const get = (i: number): string => (i >= 0 && i < row.length ? row[i] : "").trim();
    const text = get(iTitle);
    if (!text) continue;

    const completedRaw = get(iCompleted).toLowerCase();
    const completed = completedRaw
      ? ["true", "1", "yes", "y", "x", "done"].includes(completedRaw)
      : iCompletedTime >= 0 && get(iCompletedTime) !== "";

    const task = makeImportedTask(text, {
      completed,
      priority: iPriority >= 0 ? mapTickTickPriority(get(iPriority)) : "normal",
      notes: get(iNotes),
      dueDate: normalizeDueDate(get(iDue)),
    });

    const projectName = get(iProject) || get(iProjectId) || "TickTick Import";
    const bucket = groups.get(projectName);
    if (bucket) bucket.push(task);
    else groups.set(projectName, [task]);
  }

  return Array.from(groups.entries()).map(([title, items]) => ({
    title,
    subtitle: "Imported from TickTick",
    categories: [{ title: "Tasks", items }],
  }));
}

/* ---------- format sniffing ---------- */

function looksLikeTodoistDoc(o: Record<string, unknown>): boolean {
  if (!Array.isArray(o.projects)) return false;
  if (Array.isArray(o.items) || Array.isArray(o.tasks)) return true;
  return o.projects.some((p) => isObj(p) && (Array.isArray(p.items) || Array.isArray(p.tasks)));
}

function looksLikeGoogleList(o: Record<string, unknown>): boolean {
  if (o.kind === "tasks#taskList") return true;
  return asString(o.kind) !== "" && asString(o.title) !== "" && Array.isArray(o.items);
}

/**
 * Sniff the payload format and parse in one step. JSON payloads are
 * checked structurally (todoist: projects+items; google: kind
 * "tasks#taskList" or kind+title+items); anything else that isn't a
 * TickTick-style CSV header falls back to "unknown". Never throws.
 */
export function detectAndParse(text: string): ImportDetection {
  const t = (text || "").trim();
  if (!t) return { format: "unknown", goals: [] };

  if (t.startsWith("{") || t.startsWith("[")) {
    const data = safeJsonParse(t);
    if (data === null) return { format: "unknown", goals: [] };
    const records = Array.isArray(data) ? data : [data];
    const objs: Record<string, unknown>[] = [];
    for (const r of records) if (isObj(r)) objs.push(r);

    if (objs.some(looksLikeTodoistDoc)) return { format: "todoist", goals: parseTodoistExport(t) };
    if (objs.some(looksLikeGoogleList)) return { format: "google", goals: parseGoogleTakeout(t) };
    return { format: "unknown", goals: [] };
  }

  // CSV sniff: normalize the first non-blank line and look for TickTick columns
  const header = (t.split(/\r?\n/, 1)[0] || "").toLowerCase().replace(/[\s_-]/g, "");
  if (header.includes("projectname") || (header.includes("projectid") && header.includes("title"))) {
    return { format: "ticktick", goals: parseTickTickCsv(t) };
  }

  return { format: "unknown", goals: [] };
}
