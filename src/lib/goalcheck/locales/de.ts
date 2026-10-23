/* =========================================================
   de — Deutsch (German) community-preview catalog.
   - MUST stay key-complete with en.ts (typed `Catalog`: a missing or
     extra key is a compile error).
   - Register: natural, concise UI German; common tech loanwords kept
     (Board, Kanban, HUD, Streak, Backup, Ctrl+K…).
   - Placeholders {name} / {count} / {percent} MUST be preserved verbatim.
   - Values are best-effort community previews, not vendor-localized copy.
   ========================================================= */

import type { Catalog } from "./en";

const de: Catalog = {
  /* ---- Header ---- */
  "nav.newBoard": "Neues Board",
  "nav.more": "Mehr Aktionen",
  "nav.themes": "Themen & Atmosphäre",
  "nav.settings": "Einstellungen",
  "nav.export": "Export / Backup",
  "nav.quickPaste": "Schnelltext einfügen",
  "nav.commandBar": "Befehlsleiste (Ctrl+K)",
  "nav.zen": "Zen-Fokus-HUD",
  "nav.reportCard": "Berichtskarte",
  "nav.rpg": "RPG-Fortschritt",
  "nav.toggleTheme": "Hell-/Dunkeltheme wechseln",

  /* ---- Views ---- */
  "views.checklist": "Checkliste",
  "views.kanban": "Kanban",
  "views.matrix": "Matrix",
  "views.graph": "Mindmap",
  "views.analytics": "Analysen",
  "views.week": "Woche",
  "views.calendar": "Kalender",
  "views.timeline": "Roadmap",
  "views.deepFocus": "Tiefenfokus",

  /* ---- Filters ---- */
  "filters.all": "Alle Einträge",
  "filters.active": "Offen",
  "filters.completed": "Erledigt",
  "filters.priority": "★ Priorität",
  "filters.week": "Diese Woche",

  /* ---- Sidebar ---- */
  "side.pomodoro": "Pomodoro-Fokus",
  "side.focus": "Fokus",
  "side.short5": "Kurz 5 Min",
  "side.long15": "Lang 15 Min",
  "side.startFocus": "Fokus starten",
  "side.resetTimer": "Timer zurücksetzen",
  "side.attachTask": "Angehängte Aufgabe",
  "side.noTask": "-- Keine Aufgabe angehängt --",
  "side.boards": "Meine Ziel-Boards",
  "side.createBoard": "Neues Board erstellen",
  "side.habits": "Gewohnheiten & Streaks",
  "side.newHabitPlaceholder": "Neue Gewohnheit…",
  "side.daily": "Täglich",
  "side.weekly": "Wöchentlich",
  "side.addHabit": "Gewohnheit hinzufügen",
  "side.templates": "1-Klick-Vorlagen",
  "side.load": "＋ Laden",
  "side.audioStudio": "Audio-reaktives Studio",
  "side.gain": "Gain",
  "side.bass": "Bass",
  "side.mid": "Mitten",
  "side.treble": "Höhen",
  "side.chimes": "Chime-Soundpaket",

  /* ---- Common ---- */
  "common.done": "Erledigt",
  "common.todo": "Zu erledigen",
  "common.doing": "In Arbeit",
  "common.save": "Speichern",
  "common.cancel": "Abbrechen",
  "common.delete": "Löschen",
  "common.close": "Schließen",
  "common.add": "Hinzufügen",
  "common.create": "Erstellen",
  "common.edit": "Bearbeiten",
  "common.progress": "Fortschritt",
  "common.completed": "Erledigt",
  "common.search": "Aufgaben, Notizen, Kategorien suchen…",
  "common.empty": "Hier ist noch nichts",
  "common.tasks": "Aufgaben",
  "common.categories": "Kategorien",
  "common.notes": "Notizen",
  "common.subtasks": "Mikroschritte",

  /* ---- Settings ---- */
  "settings.title": "Arbeitsbereich-Module & Präferenzen",
  "settings.gamification": "RPG-Gamifizierung, XP & Level",
  "settings.heatmap": "365-Tage-Aktivitätskarte",
  "settings.autoParent": "Überaufgabe automatisch abschließen, wenn alle Teilaufgaben fertig sind",
  "settings.reduceEffects": "Effekte reduzieren (Akkusparer)",
  "settings.followSystem": "Theme folgt dem System",
  "settings.language": "Sprache",
  "settings.fontScale": "Schriftgröße",
  "settings.edition": "Edition — {name}",
  "settings.switchToNormal": "Zu {name} wechseln…",
  "settings.switchConfirm": "Ja, zu {name} wechseln",
  "settings.dataDoctor": "Daten-Doktor",
  "settings.runScan": "Integritätsscan ausführen",
  "settings.storage": "Speicher & Sync",
  "settings.lastBackup": "Letztes Backup",

  /* ---- Habits ---- */
  "habits.streak": "{count}-Perioden-Streak",
  "habits.freeze": "Einfrieren",
  "habits.frozen": "Eingefroren",
  "habits.mark": "Markieren",
  "habits.best": "Bestwert",
};

export default de;
