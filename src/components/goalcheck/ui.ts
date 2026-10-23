"use client";

/* Transient UI state: which modal/overlay is open, media picker target, etc. */

import { create } from "zustand";

export type MediaTarget =
  | { type: "quick" }
  | { type: "goal" }
  | { type: "category"; catId: string }
  | null;

export interface TaskEditTarget { catId: string; taskId: string }

interface UiState {
  boardModal: "create" | "edit" | null;
  mediaModal: MediaTarget;
  themeModal: boolean;
  settingsModal: boolean;
  exportModal: boolean;
  pasteModal: boolean;
  taskEditModal: TaskEditTarget | null;
  rpgModal: boolean;
  zenOpen: boolean;
  paletteOpen: boolean;
  /* v4.2 — report/share card + community pack importer + paste prefill */
  reportCard: boolean;
  packModal: boolean;
  pasteText: string;
  openBoardModal: (m: "create" | "edit") => void;
  openMediaModal: (t: MediaTarget) => void;
  openTaskEditModal: (t: TaskEditTarget) => void;
  open: (k: "themeModal" | "settingsModal" | "exportModal" | "pasteModal" | "rpgModal" | "zenOpen" | "paletteOpen" | "reportCard" | "packModal") => void;
  closeAll: () => void;
}

export const useUi = create<UiState>((set) => ({
  boardModal: null,
  mediaModal: null,
  themeModal: false,
  settingsModal: false,
  exportModal: false,
  pasteModal: false,
  taskEditModal: null,
  rpgModal: false,
  zenOpen: false,
  paletteOpen: false,
  reportCard: false,
  packModal: false,
  pasteText: "",
  openBoardModal: (m) => set({ boardModal: m }),
  openMediaModal: (t) => set({ mediaModal: t }),
  openTaskEditModal: (t) => set({ taskEditModal: t }),
  open: (k) => set({ [k]: true } as Partial<UiState>),
  closeAll: () => set({
    boardModal: null, mediaModal: null, themeModal: false, settingsModal: false,
    exportModal: false, pasteModal: false, taskEditModal: null, rpgModal: false,
    zenOpen: false, paletteOpen: false, reportCard: false, packModal: false,
  }),
}));

/** Global listeners: Ctrl+K palette, "gc-open-rpg" custom event */
export function useGlobalShortcuts() {
  return () => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        useUi.getState().open("paletteOpen");
      }
    };
    const onRpg = () => useUi.getState().open("rpgModal");
    document.addEventListener("keydown", onKey);
    window.addEventListener("gc-open-rpg", onRpg);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("gc-open-rpg", onRpg);
    };
  };
}
