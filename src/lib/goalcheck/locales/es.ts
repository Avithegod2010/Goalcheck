/* =========================================================
   es — Español (Spanish) community-preview catalog.
   - MUST stay key-complete with en.ts (typed `Catalog`: a missing or
     extra key is a compile error).
   - Register: natural, concise Latin-American-neutral UI Spanish.
   - Placeholders {name} / {count} / {percent} MUST be preserved verbatim.
   - Values are best-effort community previews, not vendor-localized copy.
   ========================================================= */

import type { Catalog } from "./en";

const es: Catalog = {
  /* ---- Header ---- */
  "nav.newBoard": "Nuevo tablero",
  "nav.more": "Más acciones",
  "nav.themes": "Temas y ambiente",
  "nav.settings": "Ajustes",
  "nav.export": "Exportar / Copia de seguridad",
  "nav.quickPaste": "Pegado rápido de texto",
  "nav.commandBar": "Barra de comandos (Ctrl+K)",
  "nav.zen": "HUD de enfoque Zen",
  "nav.reportCard": "Tarjeta de resumen",
  "nav.rpg": "Progresión RPG",
  "nav.toggleTheme": "Cambiar tema claro / oscuro",

  /* ---- Views ---- */
  "views.checklist": "Lista",
  "views.kanban": "Kanban",
  "views.matrix": "Matriz",
  "views.graph": "Mapa mental",
  "views.analytics": "Analíticas",
  "views.week": "Semana",
  "views.calendar": "Calendario",
  "views.timeline": "Hoja de ruta",
  "views.deepFocus": "Enfoque profundo",

  /* ---- Filters ---- */
  "filters.all": "Todos los elementos",
  "filters.active": "Pendientes",
  "filters.completed": "Completados",
  "filters.priority": "★ Prioridad",
  "filters.week": "Esta semana",

  /* ---- Sidebar ---- */
  "side.pomodoro": "Enfoque Pomodoro",
  "side.focus": "Enfoque",
  "side.short5": "Corto 5 min",
  "side.long15": "Largo 15 min",
  "side.startFocus": "Iniciar enfoque",
  "side.resetTimer": "Reiniciar temporizador",
  "side.attachTask": "Tarea adjunta",
  "side.noTask": "-- Sin tarea adjunta --",
  "side.boards": "Mis tableros de metas",
  "side.createBoard": "Crear nuevo tablero",
  "side.habits": "Hábitos y rachas",
  "side.newHabitPlaceholder": "Nuevo hábito…",
  "side.daily": "Diario",
  "side.weekly": "Semanal",
  "side.addHabit": "Añadir hábito",
  "side.templates": "Plantillas de 1 clic",
  "side.load": "＋ Cargar",
  "side.audioStudio": "Estudio audio-reactivo",
  "side.gain": "Ganancia",
  "side.bass": "Graves",
  "side.mid": "Medios",
  "side.treble": "Agudos",
  "side.chimes": "Pack de campanillas",

  /* ---- Common ---- */
  "common.done": "Hecho",
  "common.todo": "Por hacer",
  "common.doing": "En curso",
  "common.save": "Guardar",
  "common.cancel": "Cancelar",
  "common.delete": "Eliminar",
  "common.close": "Cerrar",
  "common.add": "Añadir",
  "common.create": "Crear",
  "common.edit": "Editar",
  "common.progress": "Progreso",
  "common.completed": "Completados",
  "common.search": "Buscar tareas, notas, categorías…",
  "common.empty": "Nada por aquí todavía",
  "common.tasks": "Tareas",
  "common.categories": "Categorías",
  "common.notes": "Notas",
  "common.subtasks": "Micropasos",

  /* ---- Settings ---- */
  "settings.title": "Módulos y preferencias del espacio de trabajo",
  "settings.gamification": "Gamificación RPG, XP y niveles",
  "settings.heatmap": "Mapa de actividad de 365 días",
  "settings.autoParent": "Completar la tarea padre al terminar todas las subtareas",
  "settings.reduceEffects": "Reducir efectos (ahorro de batería)",
  "settings.followSystem": "Tema según el sistema",
  "settings.language": "Idioma",
  "settings.fontScale": "Escala de fuente",
  "settings.edition": "Edición — {name}",
  "settings.switchToNormal": "Cambiar a {name}…",
  "settings.switchConfirm": "Sí, cambiar a {name}",
  "settings.dataDoctor": "Doctor de datos",
  "settings.runScan": "Ejecutar análisis de integridad",
  "settings.storage": "Almacenamiento y sincronización",
  "settings.lastBackup": "Última copia de seguridad",

  /* ---- Habits ---- */
  "habits.streak": "Racha de {count} periodos",
  "habits.freeze": "Congelar",
  "habits.frozen": "Congelado",
  "habits.mark": "Marcar",
  "habits.best": "Mejor",
};

export default es;
