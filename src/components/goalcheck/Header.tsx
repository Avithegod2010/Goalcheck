"use client";

/* =========================================================
   Header — brand + actions.
   Mobile-first: primary actions inline, the rest in an overflow menu.
   All icons are the app's custom mono animated set.
   ========================================================= */

import { useStore, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { MediaBadge } from "./atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Palette, Settings, Download, ClipboardPaste, Plus } from "lucide-react";
import { APP_NAME, APP_TAGLINE, IS_PRO, hasFeature } from "@/lib/goalcheck/editions";

export function Header() {
  const brandMedia = useStore((s) => s.brandMedia);
  const quickLightDark = useStore((s) => s.quickLightDark);
  const rpgEnabled = useStore((s) => s.settings.rpgEnabled);
  const level = useStore((s) => s.rpg.level);
  const combo = useStore((s) => s.rpg.combo);
  const comboMult = 1 + Math.min(4, Math.floor((combo || 0) / 5)) * 0.25;
  const ui = useUi();

  return (
    <header
      className="gc-blur sticky top-0 z-50 border-b"
      style={{ backgroundColor: "var(--gc-surface)", borderColor: "var(--gc-border)" }}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: "var(--gc-accent)" }}
          aria-label={`${APP_NAME} — back to top`}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <motion.span
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-lg font-extrabold"
            style={{ background: "var(--gc-grad)", boxShadow: "0 4px 16px var(--gc-glow)", color: "#fff" }}
            whileHover={{ rotate: -6, scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
          >
            <MediaBadge value={brandMedia} fallback="mono:rocket-launch" iconSize={22} />
          </motion.span>
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-2 text-lg font-extrabold leading-tight tracking-tight">
              GoalCheck
              {IS_PRO && (
                <span className="rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wider text-white" style={{ background: "var(--gc-grad)" }}>
                  Advance
                </span>
              )}
            </span>
            <span className="hidden text-xs sm:block" style={{ color: "var(--gc-text2)" }}>
              {APP_TAGLINE}
            </span>
          </span>
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {rpgEnabled && hasFeature("rpg") && (
            <motion.button
              type="button"
              className="hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold md:flex"
              style={{ borderColor: "var(--gc-border-strong)", background: "var(--gc-surface-2)" }}
              title="Open RPG Progression"
              aria-label={`Open RPG Progression — Level ${level}`}
              onClick={() => ui.open("rpgModal")}
              key={`lv-${level}`}
              initial={{ scale: 1.18 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 16 }}
              whileHover={{ scale: 1.05 }}
            >
              <span className="rounded-full px-1.5 py-0.5 text-[0.6rem] font-extrabold text-white" style={{ background: "var(--gc-grad)" }}>
                LV.{level}
              </span>
              <span style={{ color: "var(--gc-warning)", fontFamily: "monospace" }}>{comboMult.toFixed(2).replace(/\.?0+$/, "")}x</span>
            </motion.button>
          )}

          {hasFeature("command-palette") && (
            <Button type="button" variant="outline" size="sm" className="hidden lg:inline-flex gc-btn" onClick={() => ui.open("paletteOpen")} title="Natural language command bar (Ctrl+K)" aria-label="Open command bar (Ctrl+K)">
              <GcIcon name="command-key" size={15} /> ⌘K
            </Button>
          )}
          {hasFeature("zen") && (
            <Button type="button" variant="outline" size="sm" className="hidden lg:inline-flex gc-btn" onClick={() => ui.open("zenOpen")} title="Distraction-free focus HUD" aria-label="Open Zen focus HUD">
              <GcIcon name="lotus-zen" size={16} /> <span>Zen</span>
            </Button>
          )}
          <Button type="button" variant="outline" size="icon" className="size-9 gc-btn" onClick={(e) => quickLightDark({ x: e.clientX, y: e.clientY })} title="Toggle light / dark theme" aria-label="Toggle light or dark theme">
            <GcIcon name="contrast-half" size={17} />
          </Button>

          <Button type="button" size="sm" className="gc-btn-primary" onClick={() => ui.openBoardModal("create")} aria-label="Create new board">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New Board</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="size-9 gc-btn" title="More actions" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => ui.open("themeModal")}><Palette className="mr-2 h-4 w-4" /> Themes & Atmosphere</DropdownMenuItem>
              <DropdownMenuItem onClick={() => ui.open("settingsModal")}><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => ui.open("exportModal")}><Download className="mr-2 h-4 w-4" /> Export / Backup</DropdownMenuItem>
              <DropdownMenuItem onClick={() => ui.open("pasteModal")}><ClipboardPaste className="mr-2 h-4 w-4" /> Quick Paste Text</DropdownMenuItem>
              <DropdownMenuSeparator />
              {hasFeature("command-palette") && (
                <DropdownMenuItem onClick={() => ui.open("paletteOpen")}><GcIcon name="command-key" size={14} /><span className="ml-2">Command Bar (Ctrl+K)</span></DropdownMenuItem>
              )}
              {hasFeature("zen") && (
                <DropdownMenuItem onClick={() => ui.open("zenOpen")}><GcIcon name="lotus-zen" size={14} /><span className="ml-2">Zen Focus HUD</span></DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {hasFeature("rpg") && (
                <DropdownMenuItem onClick={() => ui.open("rpgModal")}><GcIcon name="bolt-boost" size={14} /><span className="ml-2">RPG Progression</span></DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
