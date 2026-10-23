/* =========================================================
   en — GoalCheck base English catalog (source of truth).

   SHAPE
   - One FLAT Record<string, string>. Keys are dotted strings grouped by
     UI surface:
       nav.*      header brand actions + overflow menu (Header.tsx)
       views.*    workspace view tabs (Hero.tsx)
       filters.*  filter bar pills (Hero.tsx)
       side.*     sidebar widgets: pomodoro, boards, habits, templates,
                  audio studio (Sidebar.tsx / Habits.tsx)
       common.*   task/board strings shared across views (Checklist.tsx,
                  Views.tsx kanban columns, atoms)
       settings.* settings modal — modules/preferences/edition/data
                  doctor/storage (modals.tsx)
       habits.*   habit streak/marking labels (Habits.tsx / Views.tsx)

   PLACEHOLDER CONVENTION
   - `{name}` / `{count}` / `{percent}` — single curly braces around a
     lowercase identifier. Substituted at runtime via
     `t(key, { name: "GoalCheck (Normal)", count: 3 })` where values may
     be string | number. Unknown placeholders are left verbatim so a
     missing var never mangles copy. Translators MUST keep placeholders
     intact (word order may change freely).

   VERBATIM SOURCING
   - Values were copied verbatim (minus JSX) from the current UI where a
     source string exists: Header.tsx, Hero.tsx, Sidebar.tsx, Habits.tsx,
     modals.tsx (Settings / Export / Data Doctor sections), Checklist.tsx,
     Onboarding.tsx slide titles, Views.tsx (kanban columns "To Do" /
     "In Progress" / "Done", "Best:"). Keys without a live source (e.g.
     settings.language, settings.fontScale, habits.freeze, common.save)
     are new v1 strings written in the same concise UI register.
   - `side.bass` / `side.mid` / `side.treble` render uppercase via CSS in
     the source; catalogs carry natural-case values.
   - `common.subtasks` maps to the UI's "Micro-steps" wording (deliberate).
   - `side.noTask` uses the SelectValue placeholder "-- No task attached --".

   NOTES
   - Long-form copy (onboarding paragraph bodies, legal text, full toast
     sentences) intentionally stays English in v1.
   - Edition-agnostic: no edition-specific copy lives in catalogs. Surfaces
     gated by `hasFeature(...)` simply resolve the same keys in base and pro
     builds; the i18n layer never branches on edition.
   ========================================================= */

const en = {
  /* ---- Header: actions & overflow menu (Header.tsx) ---- */
  "nav.newBoard": "New Board",
  "nav.more": "More actions",
  "nav.themes": "Themes & Atmosphere",
  "nav.settings": "Settings",
  "nav.export": "Export / Backup",
  "nav.quickPaste": "Quick Paste Text",
  "nav.commandBar": "Command Bar (Ctrl+K)",
  "nav.zen": "Zen Focus HUD",
  "nav.reportCard": "Report card",
  "nav.rpg": "RPG Progression",
  "nav.toggleTheme": "Toggle light / dark theme",

  /* ---- View switcher tabs (Hero.tsx) ---- */
  "views.checklist": "Checklist",
  "views.kanban": "Kanban",
  "views.matrix": "Matrix",
  "views.graph": "Mind Map",
  "views.analytics": "Analytics",
  "views.week": "Week",
  "views.calendar": "Calendar",
  "views.timeline": "Roadmap",
  "views.deepFocus": "Deep Focus",

  /* ---- Filter bar pills (Hero.tsx) ---- */
  "filters.all": "All Items",
  "filters.active": "Remaining",
  "filters.completed": "Completed",
  "filters.priority": "★ Priority",
  "filters.week": "This Week",

  /* ---- Sidebar widgets (Sidebar.tsx / Habits.tsx) ---- */
  "side.pomodoro": "Pomodoro Focus",
  "side.focus": "Focus",
  "side.short5": "Short 5m",
  "side.long15": "Long 15m",
  "side.startFocus": "Start Focus",
  "side.resetTimer": "Reset timer",
  "side.attachTask": "Attached Task",
  "side.noTask": "-- No task attached --",
  "side.boards": "My Goal Boards",
  "side.createBoard": "Create new board",
  "side.habits": "Habits & Streaks",
  "side.newHabitPlaceholder": "New habit…",
  "side.daily": "Daily",
  "side.weekly": "Weekly",
  "side.addHabit": "Add habit",
  "side.templates": "1-Click Templates",
  "side.load": "＋ Load",
  "side.audioStudio": "Audio-Reactive Studio",
  "side.gain": "Gain",
  "side.bass": "Bass",
  "side.mid": "Mid",
  "side.treble": "Treble",
  "side.chimes": "Chime voice pack",

  /* ---- Shared task/board strings (Checklist.tsx / Views.tsx) ---- */
  "common.done": "Done",
  "common.todo": "To Do",
  "common.doing": "In Progress",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.close": "Close",
  "common.add": "Add",
  "common.create": "Create",
  "common.edit": "Edit",
  "common.progress": "Progress",
  "common.completed": "Completed",
  "common.search": "Search tasks, notes, categories…",
  "common.empty": "Nothing here yet",
  "common.tasks": "Tasks",
  "common.categories": "Categories",
  "common.notes": "Notes",
  "common.subtasks": "Micro-steps",

  /* ---- Settings modal: modules, preferences, edition, data doctor (modals.tsx) ---- */
  "settings.title": "Workspace Modules & Preferences",
  "settings.gamification": "RPG Gamification, XP & Levels",
  "settings.heatmap": "365-Day Activity Heatmap",
  "settings.autoParent": "Auto-Complete Parent on All Subtasks Done",
  "settings.reduceEffects": "Reduce Effects (battery saver)",
  "settings.followSystem": "Theme follows system",
  "settings.language": "Language",
  "settings.fontScale": "Font scale",
  "settings.edition": "Edition — {name}",
  "settings.switchToNormal": "Switch to {name}…",
  "settings.switchConfirm": "Yes, switch to {name}",
  "settings.dataDoctor": "Data Doctor",
  "settings.runScan": "Run integrity scan",
  "settings.storage": "Storage & sync",
  "settings.lastBackup": "Last backup",

  /* ---- Habits widget (Habits.tsx / Views.tsx) ---- */
  "habits.streak": "{count}-period streak",
  "habits.freeze": "Freeze",
  "habits.frozen": "Frozen",
  "habits.mark": "Mark",
  "habits.best": "Best",
} satisfies Record<string, string>;

/** Every valid catalog key. `Catalog` is the contract all locales must
 *  satisfy — a missing key in hi/es/de is a compile error by design. */
export type CatalogKey = keyof typeof en;
export type Catalog = Record<CatalogKey, string>;

export default en;
