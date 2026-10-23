"use client";

/* =========================================================
   All modals: Media picker (mono-animated-first), Themes &
   Atmosphere, Settings (+ sound studio), Export/Backup,
   Quick Paste, Goal Board, Task Edit, RPG.
   ========================================================= */

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useStore, useActiveGoal, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { MediaBadge } from "./atoms";
import { GcIcon, GC_ICON_GROUPS } from "@/lib/goalcheck/icons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { THEMES, ENGINES, ATMOSPHERE_PRESETS, availableThemes, availableEngines } from "@/lib/goalcheck/themes";
import { hasFeature, IS_PRO, APP_NAME, BUILD_EDITION, setEditionOverride, type Edition } from "@/lib/goalcheck/editions";
import { syncFileSupported, linkSyncFile, isSyncLinked, unlinkSyncFile, writeNow, setVaultPassphrase, pullFromSyncFile, linkSnapshotFolder, unlinkSnapshotFolder, snapshotFolderLinked } from "@/lib/goalcheck/syncfile";
import { isImageUrl, isMonoIcon } from "@/lib/goalcheck/presets";
import { RPG_AURAS, RPG_SKILLS, ACHIEVEMENTS, buildMarkdownExport, buildPlainExport, localDateKey, rankForLevel, totalXpForLevel, xpForLevel, parseQuickPaste, calculateStats, habitStreak, levelFromXp, isValidRecurrence, isoWeekKey, collectYearRecap, shiftDays } from "@/lib/goalcheck/logic";
import { Markdown, toggleMarkdownCheckbox } from "@/lib/goalcheck/markdown";
import { detectAndParse, type ImportedGoal } from "@/lib/goalcheck/importers";
import { encryptString, decryptString, isEncryptedPayload } from "@/lib/goalcheck/crypto";
import { useT, getLocale, setLocale } from "@/lib/goalcheck/i18n";
import { SUPPORTED_LOCALES, LOCALE_LABELS, type Locale } from "@/lib/goalcheck/locales";
import { playChime } from "@/lib/goalcheck/audio";
import type { ChimePack, Task } from "@/lib/goalcheck/types";
import { Download, Upload, Copy } from "lucide-react";

/* =========================================================
   MODAL HOST — mounts every modal, driven by useUi
   ========================================================= */

export function ModalHost() {
  const ui = useUi();
  return (
    <>
      <MediaPickerModal />
      <ThemeModal />
      <SettingsModal />
      <ExportModal />
      <QuickPasteModal />
      <GoalBoardModal />
      <TaskEditModal />
      <RpgModal />
      {/* v4.2 — share card + community pack importer */}
      <ReportCardModal />
      <PackModal />
      {/* v4.3 — weekly review ritual, year wrapped, other-app importer */}
      <WeeklyReviewModal />
      <WrappedModal />
      <ImportModal />
      {/* Escape closes everything */}
      {ui.boardModal !== null && <EscapeHandler />}
    </>
  );
}

function EscapeHandler() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") useUi.getState().closeAll(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

/* =========================================================
   MEDIA PICKER — custom mono animated icons first
   ========================================================= */

const ENGINE_ICONS: Record<string, string> = {
  fire: "flame-ember", stardust: "star-shine", matrix: "laptop-code", bubbles: "drop-care",
  snow: "gem-spark", rain: "cloud-rain", fireworks: "party-pop", galaxy: "globe-orbit",
  vortex: "bike-wheel", constellation: "network-nodes", embers: "zap-star", petals: "seed-grow", off: "lock-shield",
};

function MediaPickerModal() {
  const target = useUi((s) => s.mediaModal);
  const close = () => useUi.setState({ mediaModal: null });
  const quickCatMedia = useStore((s) => s.quickCatMedia);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const setQuickCatMedia = useStore((s) => s.setQuickCatMedia);
  const setBoardMedia = useStore((s) => s.setBoardMedia);
  const setCategoryMedia = useStore((s) => s.setCategoryMedia);

  const current = useMemo(() => {
    if (!target) return "mono:laptop-code";
    if (target.type === "quick") return quickCatMedia;
    if (target.type === "goal") return goals.find((g) => g.id === activeGoalId)?.media ?? "mono:laptop-code";
    if (target.type === "category") {
      for (const g of goals) {
        if (g.id !== activeGoalId) continue;
        for (const c of g.categories) if (c.id === target.catId) return c.media;
      }
    }
    return "mono:clipboard-check";
  }, [target, quickCatMedia, goals, activeGoalId]);

  const apply = (chosen: string) => {
    if (!target) return close();
    if (target.type === "quick") { setQuickCatMedia(chosen); toast("Updated quick category icon!"); }
    else if (target.type === "goal") { setBoardMedia(chosen); }
    else if (target.type === "category") { setCategoryMedia(target.catId, chosen); }
    close();
  };

  const targetKey = target ? `${target.type}:${target.type === "category" ? target.catId : ""}:${current}` : "closed";

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="gc-modal max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="image-pic" size={17} /> Customize Icon & Media</DialogTitle>
          <DialogDescription>
            {hasFeature("media-rich")
              ? "Hand-crafted animated icons, an image URL, or an upload — auto-compressed."
              : "Hand-crafted animated icons. Image URLs & uploads are part of GoalCheck Advance."}
          </DialogDescription>
        </DialogHeader>
        {target && <MediaPickerBody key={targetKey} initial={current} onApply={apply} onCancel={close} />}
      </DialogContent>
    </Dialog>
  );
}

function MediaPickerBody({ initial, onApply, onCancel }: { initial: string; onApply: (chosen: string) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [tab, setTab] = useState<"animated" | "url" | "upload">("animated");

  return (
    <>
      <div className="flex items-center justify-center gap-4 rounded-2xl border p-4" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-2" style={{ borderColor: "var(--gc-border-strong)" }}>
          <MediaBadge value={draft} fallback="mono:laptop-code" iconSize={34} />
        </span>
        <div>
          <p className="text-sm font-extrabold">Badge Live Preview</p>
          <p className="text-xs" style={{ color: "var(--gc-text2)" }}>Animated icons inherit your theme colour automatically</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl p-1" style={{ background: "var(--gc-surface-2)" }} role="tablist">
        {(["animated", ...(hasFeature("media-rich") ? (["url", "upload"] as const) : [])] as const).map((id) => {
          const label = id === "animated" ? "Animated Icons" : id === "url" ? "Image URL" : "Upload";
          return (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold"
              style={tab === id ? { background: "var(--gc-surface)", color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))" } : { color: "var(--gc-text2)" }}>
              {label}
            </button>
          );
        })}
      </div>

      {tab === "animated" && (
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto p-1 gc-scroll" role="listbox" aria-label="Animated icon gallery">
          {GC_ICON_GROUPS.map((grp) => (
            <div key={grp.id}>
              <p className="sticky top-0 z-10 mb-1 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider" style={{ color: "var(--gc-muted)", background: "var(--gc-background)" }}>
                {grp.label}
              </p>
              <div className="grid grid-cols-8 gap-1.5">
                {grp.icons.map((key) => (
                  <motion.button
                    key={key}
                    type="button"
                    title={key.replace(/-/g, " ")}
                    aria-label={key.replace(/-/g, " ")}
                    className="flex items-center justify-center rounded-lg p-1.5"
                    style={{ background: draft === `mono:${key}` ? "var(--gc-soft)" : "transparent", color: draft === `mono:${key}` ? "var(--gc-accent)" : "var(--gc-text)" }}
                    onClick={() => setDraft(`mono:${key}`)}
                    whileHover={{ scale: 1.18, rotate: -6 }}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 420, damping: 16 }}
                  >
                    <GcIcon name={key} size={21} />
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "url" && (
        <div className="flex flex-col gap-2">
          <Input value={/^https?:\/\//i.test(draft) ? draft : ""} onChange={(e) => setDraft(e.target.value.trim())} className="gc-input" placeholder="https://media.giphy.com/media/… or https://i.imgur.com/…" aria-label="Image or GIF URL" type="url" />
          <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--gc-text2)" }}>
            <GcIcon name="bulb-glow" size={13} /> Paste direct links from Giphy, Tenor, Imgur, or Unsplash.
          </p>
        </div>
      )}

      {tab === "upload" && (
        <label
          className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed p-6 text-center transition-colors hover:border-[var(--gc-accent)]"
          style={{ borderColor: "var(--gc-border-strong)" }}
        >
          <GcIcon name="cloud-rain" size={30} />
          <span className="text-sm font-bold">Click to choose a file from your device</span>
          <span className="text-xs" style={{ color: "var(--gc-text2)" }}>PNG, JPG, GIF, WebP — auto-compressed before saving (quota-safe)</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload image"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file, setDraft);
              e.target.value = "";
            }}
          />
        </label>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" className="gc-btn" onClick={onCancel}>Cancel</Button>
        <Button type="button" className="gc-btn-primary" onClick={() => onApply((draft || "mono:laptop-code").trim())}>
          <GcIcon name="check-circle" size={14} /> Apply Media
        </Button>
      </DialogFooter>
    </>
  );
}

/** FIX vs original: canvas-downscale + JPEG for photos (much smaller than PNG), user-visible errors. */
async function handleImageUpload(file: File, onReady: (dataUrl: string) => void) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const max = 120;
        let w = img.width, h = img.height;
        if (w > h && w > max) { h = Math.round((h * max) / w); w = max; }
        else if (h > max) { w = Math.round((w * max) / h); h = max; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(img, 0, 0, w, h);
        const isPhoto = /\.(jpe?g|webp)$/i.test(file.type) || file.type.startsWith("image/jpeg") || file.type.startsWith("image/webp");
        const dataUrl = canvas.toDataURL(isPhoto ? "image/jpeg" : "image/png", 0.85);
        onReady(dataUrl);
        toast.success("Image ready! Click Apply Media to save.");
      } catch {
        toast.error("Could not process that image.");
      }
    };
    img.onerror = () => toast.error("Could not read that image file.");
    img.src = String(reader.result);
  };
  reader.onerror = () => toast.error("Could not read that file.");
  reader.readAsDataURL(file);
}

/* =========================================================
   THEMES & ATMOSPHERE
   ========================================================= */

function ThemeModal() {
  const open = useUi((s) => s.themeModal);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const particles = useStore((s) => s.particles);
  const setParticles = useStore((s) => s.setParticles);
  const physics = useStore((s) => s.settings.cursorPhysics);
  const setPhysics = useStore((s) => s.setPhysics);
  const simSpeed = useStore((s) => s.settings.simSpeed);
  const simDensity = useStore((s) => s.settings.simDensity);
  const setSim = useStore((s) => s.setSim);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) useUi.setState({ themeModal: false }); }}>
      <DialogContent className="gc-modal max-h-[85vh] max-w-2xl overflow-y-auto gc-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="palette-dab" size={17} /> Themes{IS_PRO ? " & Ambient Particles" : ""}</DialogTitle>
          <DialogDescription>
            {IS_PRO
              ? "11 palettes with radial ripple wipe • 13 particle engines • cursor physics."
              : "Two curated palettes with auto light/dark. Particles, presets & 9 extra themes are part of GoalCheck Advance."}
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>Color palette theme</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {availableThemes().map((t) => (
            <motion.button
              key={t.id}
              type="button"
              onClick={(e) => setTheme(t.id, { x: e.clientX, y: e.clientY })}
              className="flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left"
              style={{ borderColor: theme === t.id ? "var(--gc-accent)" : "var(--gc-border)", background: "var(--gc-surface-2)" }}
              whileHover={{ y: -2, borderColor: "var(--gc-accent)" }}
              whileTap={{ scale: 0.97 }}
            >
              <motion.span className="h-8 w-8 shrink-0 rounded-lg border" style={{ background: t.swatch, borderColor: "var(--gc-border)" }} whileHover={{ scale: 1.12, rotate: 6 }} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold">{t.label}</span>
                <span className="block text-[0.62rem]" style={{ color: "var(--gc-text2)" }}>{t.light ? "Light" : "Dark"} theme</span>
              </span>
            </motion.button>
          ))}
        </div>

        {hasFeature("theme-share") && <ThemeShareSection />}

        {hasFeature("atmosphere-presets") && (
          <>
            <p className="mt-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>Coordinated presets</p>
            <div className="grid grid-cols-2 gap-2">
              {ATMOSPHERE_PRESETS.map((p) => (
            <motion.button
              key={p.id}
              type="button"
              className="flex items-center gap-2.5 rounded-xl border-2 p-2.5 text-left"
              style={{ borderColor: theme === p.theme && particles === p.engine ? "var(--gc-accent)" : "var(--gc-border)", background: "var(--gc-surface-2)" }}
              onClick={(e) => { setTheme(p.theme, { x: e.clientX, y: e.clientY }); setParticles(p.engine as never); setPhysics(p.physics as never); }}
              whileHover={{ y: -2, borderColor: "var(--gc-accent)" }}
              whileTap={{ scale: 0.97 }}
            >
              <span style={{ color: "var(--gc-accent)" }}><GcIcon name={ENGINE_ICONS[p.engine] ?? "star-shine"} size={17} /></span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-extrabold">{p.label}</span>
                <span className="block truncate text-[0.62rem]" style={{ color: "var(--gc-text2)" }}>{p.theme} • {p.engine} • {p.physics}</span>
              </span>
            </motion.button>
              ))}
            </div>
          </>
        )}

        {hasFeature("particles") && (
          <>
            <p className="mt-2 text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>Particle engine</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {availableEngines().map((e) => (
                <motion.button
                  key={e.id}
                  type="button"
                  onClick={() => setParticles(e.id as never)}
                  className="flex items-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-[0.68rem] font-bold"
                  style={{ borderColor: particles === e.id ? "var(--gc-accent)" : "var(--gc-border)", background: "var(--gc-surface-2)", color: particles === e.id ? "var(--gc-accent)" : "var(--gc-text2)" }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <GcIcon name={ENGINE_ICONS[e.id] ?? "star-shine"} size={13} />
                  {e.label}
                </motion.button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold">Cursor:</span>
                {(["attract", "repel", "orbit", "none"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPhysics(m)}
                    className="rounded-md border px-2 py-1 text-[0.68rem] font-bold capitalize"
                    style={{ borderColor: physics === m ? "var(--gc-accent)" : "var(--gc-border)", color: physics === m ? "var(--gc-accent)" : "var(--gc-text2)" }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs font-bold">
                  Speed
                  <Slider value={[simSpeed]} min={0.2} max={2.5} step={0.1} onValueChange={([v]) => setSim({ simSpeed: v })} className="w-20" aria-label="Simulation speed" />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold">
                  Density
                  <Slider value={[simDensity]} min={25} max={140} step={5} onValueChange={([v]) => setSim({ simDensity: v })} className="w-20" aria-label="Particle density" />
                </label>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button type="button" className="gc-btn-primary" onClick={() => useUi.setState({ themeModal: false })}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   SETTINGS (+ Sound Studio)
   ========================================================= */

const CHIME_PACKS: { id: ChimePack; label: string }[] = [
  { id: "glass", label: "Glass — pure & airy" },
  { id: "marimba", label: "Marimba — warm & wooden" },
  { id: "bell", label: "Bell — FM metallic" },
  { id: "chip", label: "Chip — 8-bit retro" },
];

function SettingsModal() {
  const open = useUi((s) => s.settingsModal);
  const s = useStore((st) => st.settings);
  const setAudio = useStore((st) => st.setAudio);
  const toggleRpg = useStore((st) => st.toggleRpg);
  const toggleHeatmap = useStore((st) => st.toggleHeatmap);
  const toggleAutoParent = useStore((st) => st.toggleAutoParent);
  const toggleReduceEffects = useStore((st) => st.toggleReduceEffects);
  const setColorMode = useStore((st) => st.setColorMode);
  const resetWorkspace = useStore((st) => st.resetWorkspace);
  const setFontScale = useStore((st) => st.setFontScale);
  const setStreakFreezes = useStore((st) => st.setStreakFreezes);
  const [confirmReset, setConfirmReset] = useState(false);
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) useUi.setState({ settingsModal: false }); }}>
      <DialogContent className="gc-modal max-h-[85vh] max-w-lg overflow-y-auto gc-scroll">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="gear-wheel" size={17} /> Workspace Modules & Preferences</DialogTitle>
          <DialogDescription>Toggle feature modules, sound design and performance options.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2.5">
          {hasFeature("rpg") && <SettingRow title="RPG Gamification, XP & Levels" icon="bolt-boost" desc="Level badge, XP rewards, combo gauge, floating popups." checked={s.rpgEnabled} onCheckedChange={toggleRpg} />}
          {hasFeature("heatmap") && <SettingRow title="365-Day Activity Heatmap" icon="flame-ember" desc="Daily contribution intensity and streak counters." checked={s.heatmapEnabled} onCheckedChange={toggleHeatmap} />}
          <SettingRow title="Auto-Complete Parent on All Subtasks Done" icon="puzzle-piece" desc="Mark main task completed when micro-steps a, b, c are finished." checked={s.autoParent} onCheckedChange={toggleAutoParent} />
          <SettingRow title="Reduce Effects (battery saver)" icon="lotus-zen" desc="Disables particles, ripple & confetti. Also respects your system reduce-motion setting." checked={s.reduceEffects} onCheckedChange={toggleReduceEffects} />
          {hasFeature("habits") && (
            <SettingRow title="Streak freezes" icon="lock-shield" desc="Earn a freeze token every 7-period streak (hold up to 2). Missed days consume a token instead of breaking the streak." checked={s.streakFreezes} onCheckedChange={setStreakFreezes} />
          )}

          {/* v4.2 — language + display scale */}
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold"><GcIcon name="globe-orbit" size={15} /> Language &amp; Display</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>Language</label>
                <Select value={getLocale()} onValueChange={(v) => setLocale(v as Locale)}>
                  <SelectTrigger className="gc-input text-xs" aria-label="Interface language"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_LOCALES.map((l) => <SelectItem key={l} value={l}>{LOCALE_LABELS[l]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>
                  Applies instantly. Community translations welcome — English is the source of truth.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-bold">Text size</span>
                <Slider value={[Math.round(s.fontScale * 100)]} min={90} max={130} step={5} onValueChange={([v]) => setFontScale(v / 100)} className="flex-1" aria-label="Text size" />
                <span className="w-10 text-right font-mono text-xs" style={{ color: "var(--gc-text2)" }}>{Math.round(s.fontScale * 100)}%</span>
              </div>
            </div>
          </div>

          {hasFeature("data-doctor") && <DataDoctorPanel />}

          {/* v4.3 — rituals, reminders, snapshots, demo data */}
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold"><GcIcon name="seed-grow" size={15} /> Rituals &amp; Imports</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-extrabold gc-btn" style={{ borderColor: "var(--gc-border)" }}
                onClick={() => { useUi.setState({ settingsModal: false, reviewModal: true }); }}>
                <GcIcon name="book-flutter" size={13} /> Weekly Review
              </button>
              <button type="button" className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-extrabold gc-btn" style={{ borderColor: "var(--gc-border)" }}
                onClick={() => { useUi.setState({ settingsModal: false, wrappedModal: true }); }}>
                <GcIcon name="trophy-star" size={13} /> Year Wrapped
              </button>
              <button type="button" className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-extrabold gc-btn" style={{ borderColor: "var(--gc-border)" }}
                onClick={() => { useUi.setState({ settingsModal: false, importModal: true }); }}>
                <GcIcon name="luggage-trip" size={13} /> Import from apps
              </button>
              <button type="button" className="flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-extrabold gc-btn" style={{ borderColor: "var(--gc-border)" }}
                onClick={() => { if (window.confirm("Replace the current workspace with the sample demo data?")) useStore.getState().loadDemoData(); }}>
                <GcIcon name="sparkle-star" size={13} /> Load demo data
              </button>
            </div>
            <p className="mt-1.5 text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>
              Review ritual: /review in the command bar · Wrapped: shareable PNG · Demo: try the app with a full sample workspace.
            </p>
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold"><GcIcon name="chat-bell" size={15} /> Reminders &amp; Snapshots</p>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold">Due-date reminders</p>
                  <p className="text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>Local device notifications for today/overdue tasks while the app is open. Opt-in, no server.</p>
                </div>
                <Switch checked={s.remindersEnabled} onCheckedChange={async (on) => {
                  if (on && typeof Notification !== "undefined" && Notification.permission !== "granted") {
                    try { const p = await Notification.requestPermission(); if (p !== "granted") { toast.error("Notification permission denied."); return; } } catch { /* ignore */ }
                  }
                  useStore.getState().setReminders(on);
                }} aria-label="Toggle due-date reminders" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold">Auto-snapshots</p>
                  <p className="text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>Dated workspace snapshots into a folder you pick. Older ones rotate out automatically.</p>
                </div>
                <Select value={s.snapshotCadence} onValueChange={(v) => useStore.getState().setSnapshotConfig({ snapshotCadence: v as "off" | "daily" | "weekly" })}>
                  <SelectTrigger className="gc-input h-8 w-24 text-xs" aria-label="Snapshot cadence"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Off</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {s.snapshotCadence !== "off" && (
                <SnapshotFolderRow keep={s.snapshotsToKeep} />
              )}
            </div>
          </div>

          {!IS_PRO && <UpgradeCard />}
          {BUILD_EDITION === "pro" && <EditionSwitchCard />}
          <button
            type="button"
            className="self-start rounded-lg px-2 py-1 text-xs font-bold underline-offset-2 transition-colors hover:underline"
            style={{ color: "var(--gc-text2)" }}
            onClick={() => {
              useStore.setState({ settings: { ...s, onboardingDone: false } });
              useUi.setState({ settingsModal: false });
            }}
          >
            Replay the intro tour
          </button>

          {/* Sound studio */}
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
            <p className="mb-2 flex items-center gap-2 text-sm font-extrabold"><GcIcon name="wave-sound" size={15} /> Sound Design</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-[0.68rem] font-bold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>Chime voice pack</label>
                {hasFeature("chime-packs") ? (
                  <Select value={s.chimePack} onValueChange={(v) => setAudio({ chimePack: v as ChimePack })}>
                    <SelectTrigger className="gc-input text-xs" aria-label="Chime voice pack"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CHIME_PACKS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="rounded-lg border px-3 py-2 text-xs font-bold" style={{ borderColor: "var(--gc-border)", color: "var(--gc-text2)" }}>
                    Classic glass chime — 3 more voice packs are part of GoalCheck Advance.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs font-bold">Chime volume</span>
                <Slider value={[Math.round(s.chimeVolume * 100)]} min={0} max={100} step={5} onValueChange={([v]) => setAudio({ chimeVolume: v / 100 })} className="flex-1" aria-label="Chime volume" />
                <span className="w-9 text-right font-mono text-xs" style={{ color: "var(--gc-text2)" }}>{Math.round(s.chimeVolume * 100)}%</span>
                <Button
                  type="button" size="sm" variant="outline" className="gc-btn shrink-0"
                  title="Preview chime" aria-label="Preview chime"
                  onClick={() => playChime("pomo-done", s.chimePack, s.chimeVolume)}
                >
                  <GcIcon name="tomato-timer" size={13} /> Test
                </Button>
              </div>
              <p className="text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>
                Used for task completion, board celebrations and Pomodoro sessions. Music volume lives in the sidebar studio.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "var(--gc-surface-2)" }}>
            <div>
              <p className="flex items-center gap-2 text-sm font-extrabold"><GcIcon name="contrast-half" size={15} /> Theme follows system</p>
              <p className="text-xs" style={{ color: "var(--gc-text2)" }}>Auto light/dark based on your device preference (light = Nordic, dark = Nebula).</p>
            </div>
            <Switch checked={s.colorMode === "system"} onCheckedChange={(v) => setColorMode(v ? "system" : "manual")} aria-label="Follow system theme" />
          </div>

          <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-danger-soft)" }}>
            <p className="flex items-center gap-2 text-sm font-extrabold"><GcIcon name="trash-flame" size={15} /> Danger zone</p>
            <p className="mb-2 text-xs" style={{ color: "var(--gc-text2)" }}>Reset the entire workspace to factory demo data. Export a backup first!</p>
            {confirmReset ? (
              <div className="flex gap-2">
                <Button type="button" size="sm" className="bg-[var(--gc-danger)] text-white gc-btn" onClick={() => { resetWorkspace(); setConfirmReset(false); useUi.setState({ settingsModal: false }); }}>
                  Yes, wipe everything
                </Button>
                <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={() => setConfirmReset(false)}>Cancel</Button>
              </div>
            ) : (
              <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={() => setConfirmReset(true)}>Reset workspace…</Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" className="gc-btn-primary" onClick={() => useUi.setState({ settingsModal: false })}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingRow({ title, desc, icon, checked, onCheckedChange }: { title: string; desc: string; icon: string; checked: boolean; onCheckedChange: (on: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ background: "var(--gc-surface-2)" }}>
      <div>
        <p className="flex items-center gap-2 text-sm font-extrabold"><GcIcon name={icon} size={15} /> {title}</p>
        <p className="text-xs" style={{ color: "var(--gc-text2)" }}>{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}

/* v4.1 — in-app edition switch (Advance builds only): flip between the
   Normal planner and the full Advance workspace. Persisted as a runtime
   override (see editions.ts) and applied by a page reload. Data is shared
   between editions by design — nothing is ever lost or migrated. */
function EditionSwitchCard() {
  const [confirming, setConfirming] = useState(false);
  const target: Edition = IS_PRO ? "base" : "pro";
  const targetName = IS_PRO ? "GoalCheck (Normal)" : "GoalCheck Advance";

  const doSwitch = () => {
    setEditionOverride(target);
    try {
      sessionStorage.setItem("gc_edition_switched", "1");
    } catch {
      /* ignore — welcome toast after reload is cosmetic */
    }
    window.location.reload();
  };

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
      <p className="flex items-center gap-2 text-sm font-extrabold"><GcIcon name="puzzle-piece" size={15} /> Edition — {APP_NAME}</p>
      <p className="mb-2 text-xs" style={{ color: "var(--gc-text2)" }}>
        {IS_PRO
          ? "You are running GoalCheck Advance (everything unlocked). Switch to Normal for the minimal planner experience."
          : "You are running GoalCheck (Normal). Switch to Advance to unlock Kanban, habits, themes, audio and more."}{" "}
        Your data is shared between editions — nothing is lost; Advance-only settings quietly pause while you are in Normal mode.
      </p>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" className="gc-btn-primary text-white" onClick={doSwitch}>
            Yes, switch to {targetName}
          </Button>
          <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={() => setConfirming(true)}>
          Switch to {targetName}…
        </Button>
      )}
    </div>
  );
}

/* =========================================================
   EXPORT / BACKUP (+ IMPORT)
   ========================================================= */

function ExportModal() {
  const open = useUi((s) => s.exportModal);
  const goal = useActiveGoal();
  const exportWorkspace = useStore((st) => st.exportWorkspace);
  const importWorkspace = useStore((st) => st.importWorkspace);
  const [format, setFormat] = useState<"plain" | "markdown" | "json" | "enc">("plain");
  const [pass, setPass] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const text = useMemo(() => {
    if (!open) return "";
    if (format === "enc") return "";
    if (format === "json") return exportWorkspace();
    if (goal && format === "markdown") return buildMarkdownExport(goal);
    if (goal) return buildPlainExport(goal);
    return "";
  }, [open, format, goal, exportWorkspace]);

  const saveBlob = (content: string, name: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const download = async () => {
    if (format === "enc") {
      if (pass.trim().length < 4) { toast.error("Enter a passphrase (4+ characters) first."); return; }
      try {
        const enc = await encryptString(exportWorkspace(), pass.trim());
        saveBlob(enc, "goalcheck-vault.gcenc");
        toast.success("Encrypted vault downloaded — keep the passphrase safe!");
      } catch {
        toast.error("Encryption is not available in this browser.");
      }
      return;
    }
    const ext = format === "json" ? "json" : format === "markdown" ? "md" : "txt";
    saveBlob(text, format === "json" ? "goalcheck-backup.json" : `goalcheck-export.${ext}`);
    toast.success("Downloaded file!");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard!");
    } catch {
      toast.error("Clipboard unavailable — select the text and copy manually.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) useUi.setState({ exportModal: false }); }}>
      <DialogContent className="gc-modal max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="doc-lines" size={17} /> Export, Backup & Restore</DialogTitle>
          <DialogDescription>Export the active board, or a full workspace JSON backup you can re-import.</DialogDescription>
        </DialogHeader>

        {hasFeature("sync-file") && <SyncFileSection />}

        <div className="flex flex-wrap gap-1 rounded-xl p-1" style={{ background: "var(--gc-surface-2)" }} role="tablist">
          {([["plain", "Plain Text"], ["markdown", "Markdown (.md)"], ["json", "JSON Backup"], ["enc", "Encrypted (.gcenc)"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={format === id} onClick={() => setFormat(id)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold"
              style={format === id ? { background: "var(--gc-surface)", color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))" } : { color: "var(--gc-text2)" }}>
              {label}
            </button>
          ))}
        </div>

        {format === "enc" ? (
          <div className="flex flex-col gap-2">
            <p className="text-xs" style={{ color: "var(--gc-text2)" }}>
              AES-256-GCM vault of the WHOLE workspace. The passphrase never leaves this device — there is no recovery, so keep it safe.
            </p>
            <Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="gc-input"
              placeholder="Vault passphrase (min 4 characters)" aria-label="Vault passphrase" autoComplete="new-password" />
            <Textarea value={"\u2713 Ready to encrypt on download.\n\u2713 Import it back from any device with the same passphrase.\n\u2713 File stays opaque even inside cloud folders."} readOnly className="gc-input h-24 resize-none font-mono text-xs" aria-label="Encrypted export notes" />
          </div>
        ) : (
          <Textarea value={text} readOnly className="gc-input h-52 resize-none font-mono text-xs" aria-label="Export content" />
        )}

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="gc-btn" onClick={download}><Download className="mr-1 h-4 w-4" /> Download</Button>
            <Button type="button" className="gc-btn-primary" onClick={copy}><Copy className="mr-1 h-4 w-4" /> Copy</Button>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json,.gcenc" className="hidden" aria-label="Import backup file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const raw = await f.text();
                  if (isEncryptedPayload(raw)) {
                    const pass = window.prompt("This vault is encrypted. Enter the passphrase:");
                    if (!pass) return;
                    try {
                      const json = await decryptString(raw, pass);
                      if (importWorkspace(json)) useUi.setState({ exportModal: false });
                    } catch {
                      toast.error("Wrong passphrase or corrupted vault.");
                    }
                    return;
                  }
                  const ok = importWorkspace(raw);
                  if (ok) useUi.setState({ exportModal: false });
                } catch {
                  toast.error("Could not read that file.");
                }
              }}
            />
            <Button type="button" variant="outline" className="gc-btn" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" /> Import Backup
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   QUICK PASTE
   ========================================================= */

function QuickPasteModal() {
  const open = useUi((s) => s.pasteModal);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const pasteText = useUi((s) => s.pasteText);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [seenPaste, setSeenPaste] = useState("");

  /* v4.2 — external intake prefill (extension handoff / share-sheet / NL bar).
     Adjust-state-during-render pattern (React-sanctioned) — keeps the
     react-hooks/set-state-in-effect rule happy. */
  if (open && pasteText && pasteText !== seenPaste) {
    setSeenPaste(pasteText);
    setText(pasteText);
    useUi.setState({ pasteText: "" });
  }

  const parsed = useMemo(() => parseQuickPaste(text), [text]);
  const taskCount = parsed.reduce((n, c) => n + c.items.length, 0);

  const apply = () => {
    if (parsed.length === 0) { toast.error("Please enter at least one category or task."); return; }
    const gs = goals.map((g) => {
      if (g.id !== activeGoalId) return g;
      const cats = parsed.map((c) => ({
        id: `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        title: c.title,
        media: c.media,
        recurrence: "none" as const,
        lastResetDate: localDateKey(new Date()),
        lastWeekKey: "",
        items: c.items,
      }));
      return { ...g, categories: mode === "replace" ? cats : [...g.categories, ...cats] };
    });
    useStore.setState({ goals: gs });
    useUi.setState({ pasteModal: false });
    toast.success(`Converted ${parsed.length} categories!`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) useUi.setState({ pasteModal: false }); }}>
      <DialogContent className="gc-modal max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="note-pen" size={17} /> Quick Paste Text to Checklist</DialogTitle>
          <DialogDescription>
            Sections ending with <code>-</code> become categories; numbered/dash lines become tasks.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="gc-input h-44 resize-none font-mono text-xs"
          placeholder={"to do in laptop -\n1. Xyz\n2. Pyq\n\nTodo in phone -\n1. Call family\n2. Check flight tickets"}
          aria-label="Text to convert"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold" style={{ color: "var(--gc-text2)" }}>{parsed.length} categories, {taskCount} tasks detected</span>
          <Button type="button" variant="outline" size="sm" className="gc-btn" onClick={() => setText("to do in laptop -\n1. Xyz\n2. Pyq\n3. Setup development environment\n\nTodo in phone -\n1. Call family & sync photos\n2. Clear offline cache\n3. Check flight tickets")}>
            Load Sample
          </Button>
        </div>
        <div className="flex gap-4 text-xs">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="gc-paste-mode" checked={mode === "append"} onChange={() => setMode("append")} />
            Append to current board
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="radio" name="gc-paste-mode" checked={mode === "replace"} onChange={() => setMode("replace")} />
            Replace existing categories
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="gc-btn" onClick={() => useUi.setState({ pasteModal: false })}>Cancel</Button>
          <Button type="button" className="gc-btn-primary" onClick={apply}>
            <GcIcon name="clipboard-check" size={14} /> Convert to Checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   GOAL BOARD CREATE/EDIT
   ========================================================= */

function GoalBoardModal() {
  const mode = useUi((s) => s.boardModal);
  const goal = useActiveGoal();
  const addBoard = useStore((s) => s.addBoard);
  const updateBoard = useStore((s) => s.updateBoard);

  const submit = (title: string, sub: string) => {
    if (mode === "edit") updateBoard(title, sub);
    else addBoard(title, sub);
    useUi.setState({ boardModal: null });
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(o) => { if (!o) useUi.setState({ boardModal: null }); }}>
      <DialogContent className="gc-modal max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="target-radar" size={17} /> {mode === "edit" ? "Edit Goal Board" : "Create New Goal Board"}</DialogTitle>
        </DialogHeader>
        <GoalBoardForm
          key={mode === "edit" ? `edit:${goal?.id}:${goal?.title}` : "create"}
          initialTitle={mode === "edit" ? goal?.title ?? "" : ""}
          initialSub={mode === "edit" ? goal?.subtitle ?? "" : ""}
          onSubmit={submit}
          onCancel={() => useUi.setState({ boardModal: null })}
        />
      </DialogContent>
    </Dialog>
  );
}

function GoalBoardForm({ initialTitle, initialSub, onSubmit, onCancel }: { initialTitle: string; initialSub: string; onSubmit: (title: string, sub: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(initialTitle);
  const [sub, setSub] = useState(initialSub);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(title, sub); }} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-bold" style={{ color: "var(--gc-text2)" }}>BOARD TITLE</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="gc-input" placeholder="e.g. Device & Daily Tasks, Vacation Packing" required autoFocus />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold" style={{ color: "var(--gc-text2)" }}>SUBTITLE / GOAL DESCRIPTION</label>
        <Input value={sub} onChange={(e) => setSub(e.target.value)} className="gc-input" placeholder="Short description of this checklist board…" />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className="gc-btn" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="gc-btn-primary">Save Goal Board</Button>
      </DialogFooter>
    </form>
  );
}

/* =========================================================
   TASK ADVANCED EDIT (priority / pomodoros / dependency lock)
   ========================================================= */

function TaskEditModal() {
  const target = useUi((s) => s.taskEditModal);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const setTaskAdvanced = useStore((s) => s.setTaskAdvanced);
  const goal = goals.find((g) => g.id === activeGoalId);

  const cat = target ? goal?.categories.find((c) => c.id === target.catId) : null;
  const item = cat?.items.find((it) => it.id === target?.taskId) ?? null;

  const close = () => useUi.setState({ taskEditModal: null });

  const submit = (patch: { text: string; priority: string; pomos: number; dep: string; due: string; recurrence: string; notes: string }) => {
    if (!target || !item) return;
    setTaskAdvanced(target.catId, target.taskId, {
      text: patch.text.trim() || item.text,
      priority: patch.priority as "normal" | "high" | "urgent",
      pomosEstimate: Math.max(1, Math.min(20, patch.pomos)),
      dependsOn: patch.dep,
      dueDate: patch.due,
      recurrence: (isValidRecurrence(patch.recurrence) ? patch.recurrence : "none") as Task["recurrence"],
      notes: patch.notes,
    });
    toast("Task updated (priority, estimate, lock, due date, notes & recurrence saved).");
    close();
  };

  return (
    <Dialog open={target !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="gc-modal max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="pencil-line" size={17} /> Edit Task, Priority & Prerequisite Lock</DialogTitle>
        </DialogHeader>
        {item && (
          <TaskEditForm
            key={item.id + item.text}
            initialText={item.text}
            initialPriority={item.priority}
            initialPomos={item.pomosEstimate}
            initialDep={item.dependsOn || ""}
            initialDue={item.dueDate || ""}
            initialRecurrence={item.recurrence || "none"}
            initialNotes={item.notes || ""}
            timeSpent={item.timeSpent || 0}
            excludeTaskId={item.id}
            goal={goal ?? null}
            onSubmit={submit}
            onCancel={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TaskEditForm({ initialText, initialPriority, initialPomos, initialDep, initialDue, initialRecurrence, initialNotes, timeSpent, excludeTaskId, goal, onSubmit, onCancel }: {
  initialText: string; initialPriority: string; initialPomos: number; initialDep: string; initialDue: string; initialRecurrence: string; initialNotes: string; timeSpent: number; excludeTaskId: string;
  goal: ReturnType<typeof useActiveGoal>;
  onSubmit: (patch: { text: string; priority: string; pomos: number; dep: string; due: string; recurrence: string; notes: string }) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [priority, setPriority] = useState(initialPriority);
  const [pomos, setPomos] = useState(initialPomos);
  const [dep, setDep] = useState(initialDep);
  const [due, setDue] = useState(initialDue);
  const [notes, setNotes] = useState(initialNotes);
  const [notesPreview, setNotesPreview] = useState(false);

  /* v4.3 — smart recurrence: split the stored spec into select + params.
     Supported: none | daily | weekly | weekdays | every:N | monthly:o:w */
  const recKind = initialRecurrence.startsWith("every:") ? "every"
    : initialRecurrence.startsWith("monthly:") ? "monthly"
    : initialRecurrence;
  const [recSel, setRecSel] = useState(recKind);
  const [recEvery, setRecEvery] = useState(Math.max(2, parseInt(/^every:(\d+)$/.exec(initialRecurrence)?.[1] ?? "3", 10) || 3));
  const [recOrd, setRecOrd] = useState(Math.min(4, Math.max(0, parseInt(/^monthly:(\d+):/.exec(initialRecurrence)?.[1] ?? "2", 10) - 1)));
  const [recWd, setRecWd] = useState(Math.min(6, Math.max(0, parseInt(/^monthly:\d+:(\d+)$/.exec(initialRecurrence)?.[1] ?? "1", 10))));

  const recValue = (): string => {
    if (recSel === "every") return `every:${Math.max(2, Math.min(365, recEvery || 3))}`;
    if (recSel === "monthly") return `monthly:${recOrd + 1}:${recWd}`;
    return recSel;
  };

  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const ORD = ["first", "second", "third", "fourth", "last possible"];
  const logged = timeSpent >= 3600 ? `${Math.floor(timeSpent / 3600)}h ${Math.round((timeSpent % 3600) / 60)}m` : `${Math.round(timeSpent / 60)}m`;

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ text, priority, pomos, dep, due, recurrence: recValue(), notes }); }} className="flex flex-col gap-3">
      <div>
        <label className="mb-1 block text-xs font-bold">Task Title</label>
        <Input value={text} onChange={(e) => setText(e.target.value)} className="gc-input" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-bold">Priority</label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="gc-input"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="normal"><span className="flex items-center gap-2"><GcIcon name="sliders-tune" size={13} /> Normal (+10 XP)</span></SelectItem>
              <SelectItem value="high"><span className="flex items-center gap-2"><GcIcon name="star-shine" size={13} /> High (+25 XP)</span></SelectItem>
              <SelectItem value="urgent"><span className="flex items-center gap-2"><GcIcon name="flame-ember" size={13} /> Urgent (+50 XP)</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1.5 text-xs font-bold"><GcIcon name="tomato-timer" size={13} /> Estimated Pomodoros</label>
          <Input type="number" min={1} max={20} value={pomos} onChange={(e) => setPomos(parseInt(e.target.value, 10) || 1)} className="gc-input" />
        </div>
      </div>
      <div>
        <label className="mb-1 flex items-center gap-1.5 text-xs font-bold"><GcIcon name="lock-shield" size={13} /> Lock until prerequisite is completed</label>
        <Select value={dep || "__none"} onValueChange={(v) => setDep(v === "__none" ? "" : v)}>
          <SelectTrigger className="gc-input"><SelectValue /></SelectTrigger>
          <SelectContent className="max-h-56">
            <SelectItem value="__none">No lock (independent task)</SelectItem>
            {goal?.categories.flatMap((c) =>
              c.items
                .filter((it) => it.id !== excludeTaskId)
                .map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    {c.title.replace(/[-:]$/, "").trim()} → {it.text}{it.completed ? " ✓" : ""}
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>
      {hasFeature("due-dates") && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-bold"><GcIcon name="calendar-tick" size={13} /> Due date</label>
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="gc-input" aria-label="Task due date" />
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-bold"><GcIcon name="repeat-cycle" size={13} /> Repeats</label>
            <Select value={recSel} onValueChange={setRecSel} disabled={!hasFeature("recurring-tasks")}>
              <SelectTrigger className="gc-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="weekdays">Weekdays (Mon–Fri)</SelectItem>
                <SelectItem value="every">Every N days…</SelectItem>
                <SelectItem value="monthly">Monthly on…</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {hasFeature("recurring-tasks") && recSel === "every" && (
        <div className="flex items-center gap-2 rounded-lg border p-2" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
          <span className="text-xs font-bold">Repeat every</span>
          <Input type="number" min={2} max={365} value={recEvery} onChange={(e) => setRecEvery(parseInt(e.target.value, 10) || 2)} className="gc-input h-8 w-16" aria-label="Repeat interval in days" />
          <span className="text-xs font-bold">days</span>
        </div>
      )}
      {hasFeature("recurring-tasks") && recSel === "monthly" && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border p-2" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
          <span className="text-xs font-bold">Monthly on the</span>
          <Select value={String(recOrd)} onValueChange={(v) => setRecOrd(parseInt(v, 10))}>
            <SelectTrigger className="gc-input h-8 w-28 text-xs" aria-label="Monthly ordinal"><SelectValue /></SelectTrigger>
            <SelectContent>{ORD.map((o, i) => <SelectItem key={o} value={String(i)}>{o}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(recWd)} onValueChange={(v) => setRecWd(parseInt(v, 10))}>
            <SelectTrigger className="gc-input h-8 w-28 text-xs" aria-label="Weekday"><SelectValue /></SelectTrigger>
            <SelectContent>{WD.map((w, i) => <SelectItem key={w} value={String(i)}>{w}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {/* v4.3 — markdown notes with live preview + interactive checklist lines */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-bold"><GcIcon name="note-pen" size={13} /> Notes (Markdown, checklists work)</label>
          <button type="button" className="rounded px-1.5 py-0.5 text-[0.65rem] font-extrabold uppercase tracking-wide underline-offset-2 hover:underline"
            style={{ color: "var(--gc-text2)" }} aria-pressed={notesPreview}
            onClick={() => setNotesPreview((p) => !p)}>
            {notesPreview ? "Write" : "Preview"}
          </button>
        </div>
        {notesPreview ? (
          <div className="min-h-[70px] rounded-lg border p-2.5" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }} aria-label="Notes preview">
            {notes.trim()
              ? <Markdown source={notes} onToggleLine={(i) => setNotes((n) => toggleMarkdownCheckbox(n, i))} />
              : <p className="text-xs" style={{ color: "var(--gc-muted)" }}>Nothing to preview — write some notes first.</p>}
          </div>
        ) : (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="gc-input min-h-[70px] w-full rounded-lg border p-2.5 text-xs"
            style={{ borderColor: "var(--gc-border)", background: "var(--gc-input)" }}
            placeholder={"- [x] researched options\n- [ ] call vendor Tuesday\n\n**Budget:** `~40k`"}
            aria-label="Task notes (Markdown supported)"
          />
        )}
      </div>

      {timeSpent > 0 && (
        <p className="flex items-center gap-1.5 text-[0.7rem] font-bold" style={{ color: "var(--gc-text2)" }}>
          <GcIcon name="clock-hand" size={13} /> {logged} tracked on this task
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" className="gc-btn" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="gc-btn-primary">Save Changes</Button>
      </DialogFooter>
    </form>
  );
}

/* =========================================================
   RPG PROGRESSION
   ========================================================= */

function RpgModal() {
  const open = useUi((s) => s.rpgModal);
  const rpg = useStore((s) => s.rpg);
  const unlockSkill = useStore((s) => s.unlockSkill);
  const equipAura = useStore((s) => s.equipAura);
  const testBoost = useStore((s) => s.testBoostXp);
  const cur = rpg.xp - totalXpForLevel(rpg.level);
  const need = xpForLevel(rpg.level);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) useUi.setState({ rpgModal: false }); }}>
      <DialogContent className="gc-modal max-h-[85vh] max-w-xl overflow-y-auto gc-scroll" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="bolt-boost" size={17} /> RPG Progression, Skill Trees & Aura Frames</DialogTitle>
        </DialogHeader>
        {hasFeature("achievements") && <AchievementsGrid />}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4" style={{ borderColor: "var(--gc-border-strong)", background: "var(--gc-surface-2)" }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-2 py-0.5 text-xs font-extrabold text-white" style={{ background: "var(--gc-grad)" }}>LV.{rpg.level}</span>
              <span className="text-base font-extrabold">{rankForLevel(rpg.level)}</span>
            </div>
            <p className="mt-1 text-xs" style={{ color: "var(--gc-text2)" }}>
              {cur} / {need} XP • {rpg.skillPoints} Skill Point{rpg.skillPoints === 1 ? "" : "s"} Available
            </p>
          </div>
          <Button type="button" className="gc-btn-primary" onClick={testBoost}>
            <GcIcon name="bolt-boost" size={14} /> +150 XP Boost (Test Level-Up)
          </Button>
        </div>

        <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>Skill tree perks</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {RPG_SKILLS.map((sk) => {
            const owned = !!rpg.skills[sk.id];
            const canBuy = !owned && rpg.skillPoints > 0 && rpg.enabled;
            return (
              <motion.button
                key={sk.id}
                type="button"
                disabled={!canBuy}
                onClick={() => unlockSkill(sk.id)}
                className="flex flex-col gap-1 rounded-2xl border p-3 text-left"
                style={{ borderColor: owned ? "var(--gc-success)" : "var(--gc-border)", background: "var(--gc-surface-2)", opacity: owned ? 1 : canBuy ? 0.95 : 0.55 }}
                whileHover={canBuy ? { y: -3, borderColor: "var(--gc-warning)" } : undefined}
                whileTap={canBuy ? { scale: 0.96 } : undefined}
              >
                <span style={{ color: owned ? "var(--gc-success)" : "var(--gc-accent)" }}>
                  <MediaBadge value={sk.icon} fallback="mono:bolt-boost" iconSize={22} />
                </span>
                <span className="text-xs font-extrabold">{sk.name}</span>
                <span className="text-[0.62rem]" style={{ color: "var(--gc-text2)" }}>{sk.desc}</span>
                <span className="flex items-center gap-1 text-[0.62rem] font-extrabold" style={{ color: owned ? "var(--gc-success)" : "var(--gc-warning)" }}>
                  {owned ? "OWNED" : <><GcIcon name="key-point" size={11} /> 1 Skill Point</>}
                </span>
              </motion.button>
            );
          })}
        </div>

        <SeasonalChallenges />

        <p className="text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>Equippable aura frames</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RPG_AURAS.map((au) => (
            <motion.button
              key={au.id || "none"}
              type="button"
              onClick={() => equipAura(au.id)}
              className="flex items-center justify-center gap-1.5 rounded-xl border-2 p-2.5 text-xs font-extrabold"
              style={{
                borderColor: rpg.aura === au.id ? "var(--gc-accent)" : "var(--gc-border)",
                background: "var(--gc-surface-2)",
                boxShadow: au.id === "neon" ? "0 0 10px rgba(236,72,153,0.5)" : au.id === "solar" ? "0 0 10px rgba(245,158,11,0.5)" : au.id === "quantum" ? "0 0 10px rgba(168,85,247,0.5)" : undefined,
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <GcIcon name={au.id ? "gem-spark" : "lock-shield"} size={13} />
              {au.label}{rpg.aura === au.id ? " ✓" : ""}
            </motion.button>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" className="gc-btn-primary" onClick={() => useUi.setState({ rpgModal: false })}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* v4 — Advance: sync-file writer (File System Access API) */
function SyncFileSection() {
  const syncFileEnabled = useStore((s) => s.settings.syncFileEnabled);
  const setSyncFileEnabled = useStore((s) => s.setSyncFileEnabled);
  const syncFileEncrypted = useStore((s) => s.settings.syncFileEncrypted);
  const setSyncFileEncrypted = useStore((s) => s.setSyncFileEncrypted);
  const [linked, setLinked] = useState(isSyncLinked());
  const [vaultPass, setVaultPass] = useState("");
  const [pulling, setPulling] = useState(false);
  const supported = syncFileSupported();

  if (!supported) {
    return (
      <div className="rounded-xl border p-3 text-xs" style={{ borderColor: "var(--gc-border)", color: "var(--gc-text2)" }}>
        <GcIcon name="link-combo" size={13} />{" "}
        <b>Sync file</b> — your browser doesn&apos;t support the File System Access API (Chromium browsers do). JSON export above works everywhere.
      </div>
    );
  }

  const link = async () => {
    const ok = await linkSyncFile();
    setLinked(isSyncLinked());
    if (ok) {
      setSyncFileEnabled(true);
      toast.success("Sync file linked — every change auto-saves to it.");
    } else {
      toast.error("Could not link the file (cancelled or permission denied).");
    }
  };

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
      <p className="mb-1 flex items-center gap-1.5 text-sm font-extrabold"><GcIcon name="link-combo" size={14} /> Sync file (Syncthing / WebDAV friendly)</p>
      <p className="mb-2 text-xs" style={{ color: "var(--gc-text2)" }}>
        Link a .json file — ideally inside a synced folder. Every workspace change is auto-written to it (2.5s debounce), zero servers.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" className="gc-btn-primary" onClick={link}>
          {linked ? "Re-link file" : "Link sync file"}
        </Button>
        {linked && (
          <>
            <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={() => { void writeNow(); toast.success("Written to sync file."); }}>
              Write now
            </Button>
            <Button type="button" size="sm" variant="outline" className="gc-btn" disabled={pulling}
              onClick={async () => {
                setPulling(true);
                const err = await pullFromSyncFile(vaultPass.trim() || undefined);
                setPulling(false);
                if (err) toast.error(err);
                else toast.success("Workspace restored from sync file.");
              }}>
              {pulling ? "Restoring…" : "Pull from sync file"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="gc-btn" onClick={() => { unlinkSyncFile(); setLinked(false); setSyncFileEnabled(false); toast("Sync file unlinked."); }}>
              Unlink
            </Button>
            <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--gc-text2)" }}>
              <Switch checked={syncFileEnabled} onCheckedChange={setSyncFileEnabled} aria-label="Toggle auto-save" /> auto-save
            </span>
          </>
        )}
      </div>

      {/* v4.2 — vault mode: E2E-encrypt the sync file */}
      <div className="mt-2 flex flex-col gap-2 rounded-lg p-2.5" style={{ background: "var(--gc-surface-2)" }}>
        <span className="flex items-center gap-1.5 text-xs font-bold">
          <Switch checked={syncFileEncrypted} onCheckedChange={(on) => {
            setSyncFileEncrypted(on);
            if (!on) setVaultPassphrase(null);
            toast(on ? "Vault mode ON — new link writes a .gcenc file." : "Vault mode off — sync file will be plain JSON.");
          }} aria-label="Encrypt sync file" />
          Encrypt sync file (AES-256 vault)
        </span>
        {syncFileEncrypted && (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="password" value={vaultPass} onChange={(e) => setVaultPass(e.target.value)}
              className="gc-input h-8 w-56 text-xs" placeholder="Vault passphrase" aria-label="Vault passphrase" autoComplete="new-password" />
            <Button type="button" size="sm" variant="outline" className="gc-btn"
              onClick={() => {
                if (vaultPass.trim().length < 4) { toast.error("Passphrase needs 4+ characters."); return; }
                setVaultPassphrase(vaultPass.trim());
                toast.success("Passphrase set for this session — re-link to write the encrypted file.");
              }}>
              Apply passphrase
            </Button>
          </div>
        )}
        <p className="text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>
          Vault files stay opaque even inside Dropbox/Drive/Nextcloud folders — the passphrase never leaves this device.
        </p>
      </div>
      <p className="mt-2 text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>
        The file link lasts for this browser session (a browser security rule) — re-link once when you reopen {APP_NAME}.
      </p>
    </div>
  );
}

/* v4 — Advance: achievements badge collection */
function AchievementsGrid() {
  const achievements = useStore((s) => s.achievements);
  const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]);
  const pct = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--gc-border)" }}>
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-extrabold"><GcIcon name="gem-spark" size={15} /> Achievements</p>
        <span className="text-xs font-bold" style={{ color: "var(--gc-text2)" }}>{unlocked.length}/{ACHIEVEMENTS.length} • {pct}%</span>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--gc-surface-2)" }}>
        <motion.div className="h-full rounded-full" style={{ background: "var(--gc-grad)" }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {ACHIEVEMENTS.map((a, i) => {
          const got = !!achievements[a.id];
          return (
            <motion.div
              key={a.id}
              title={`${a.label} — ${a.desc}`}
              className="flex flex-col items-center gap-1 rounded-xl border p-2 text-center"
              style={{
                borderColor: got ? "var(--gc-accent)" : "var(--gc-border)",
                background: got ? "var(--gc-soft)" : "var(--gc-surface-2)",
                opacity: got ? 1 : 0.55,
              }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: got ? 1 : 0.55, scale: 1 }}
              transition={{ delay: i * 0.025 }}
              whileHover={{ y: -2, scale: 1.04 }}
              role="img"
              aria-label={`${a.label}: ${got ? "unlocked" : "locked"}`}
            >
              <span style={{ color: got ? "var(--gc-accent)" : "var(--gc-muted)" }}>
                <GcIcon name={a.icon} size={18} />
              </span>
              <span className="text-[0.58rem] font-extrabold leading-tight">{a.label}</span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* v4 — Advance: data doctor panel (settings) */
/* v4.3 — snapshot-folder link row (directory handles are session-scoped) */
function SnapshotFolderRow({ keep }: { keep: number }) {
  /* module-level handle state: safe to read once at mount */
  const [linked, setLinked] = useState(() => snapshotFolderLinked());
  if (!syncFileSupported()) {
    return <p className="text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>Your browser doesn&apos;t support folder access (Chrome/Edge desktop required for snapshots).</p>;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2" style={{ borderColor: "var(--gc-border)" }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">{linked ? "Snapshot folder linked ✓" : "No folder linked this session"}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[0.65rem] font-bold" htmlFor="gc-snap-keep">Keep</label>
        <select
          id="gc-snap-keep"
          className="gc-input h-7 rounded-md px-1.5 text-xs"
          value={keep}
          onChange={(e) => useStore.getState().setSnapshotConfig({ snapshotsToKeep: parseInt(e.target.value, 10) || 5 })}
        >
          {[3, 5, 7, 10, 14].map((n) => <option key={n} value={n}>{n} files</option>)}
        </select>
        <Button type="button" size="sm" variant="outline" className="h-7 gc-btn"
          onClick={async () => { const ok = await linkSnapshotFolder(); setLinked(ok); if (ok) toast.success("Snapshot folder linked — first snapshot writes on the next check."); }}>
          {linked ? "Re-pick" : "Pick folder"}
        </Button>
        {linked && (
          <Button type="button" size="sm" variant="outline" className="h-7 gc-btn"
            onClick={() => { unlinkSnapshotFolder(); setLinked(false); }}>
            Unlink
          </Button>
        )}
      </div>
    </div>
  );
}

function DataDoctorPanel() {
  const runDoctor = useStore((s) => s.runDoctor);
  const lastScanAt = useStore((s) => s.settings.lastDoctorScanAt);
  const touchDoctorScan = useStore((s) => s.touchDoctorScan);
  const [report, setReport] = useState<{ issues: string[]; fixed: number } | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const t = useT();

  const run = () => {
    const r = runDoctor();
    setReport(r);
    touchDoctorScan();
    if (r.fixed > 0) toast.success(`Data doctor fixed ${r.fixed} issue${r.fixed > 1 ? "s" : ""}.`);
  };

  /* v4.2 — storage meter + scheduled scan: silently runs (and repairs) once
     when the panel opens if the last scan is older than 30 days. The scan is
     deferred to a macrotask so the effect body stays setState-free. */
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage.estimate().then((e) => setStorage({ usage: e.usage || 0, quota: e.quota || 0 })).catch(() => {});
    }
    let timer: number | undefined;
    if (!lastScanAt || Date.now() - lastScanAt > 30 * 86_400_000) {
      timer = window.setTimeout(() => {
        const r = runDoctor();
        touchDoctorScan();
        if (r.fixed > 0) toast.success(`Data doctor auto-fixed ${r.fixed} issue${r.fixed > 1 ? "s" : ""}.`);
        setReport(r);
      }, 0);
    }
    return () => window.clearTimeout(timer);
  }, []);

  const pct = storage && storage.quota > 0 ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;
  const mb = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
      <p className="mb-1 flex items-center gap-2 text-sm font-extrabold"><GcIcon name="tools-wrench" size={15} /> Data Doctor</p>
      <p className="mb-2 text-xs" style={{ color: "var(--gc-text2)" }}>
        Scans for broken dependency locks, duplicate task ids, stale pomodoro bindings and oversized media — and repairs what is safe to repair. Runs automatically every 30 days.
      </p>
      {storage && (
        <div className="mb-2.5">
          <div className="mb-1 flex items-center justify-between text-[0.68rem] font-bold" style={{ color: "var(--gc-text2)" }}>
            <span>Device storage used by this app</span>
            <span className="font-mono">{mb(storage.usage)} / {mb(storage.quota)} ({pct.toFixed(1)}%)</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full" role="progressbar" aria-label={`Storage: ${pct.toFixed(1)} percent used`} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} style={{ background: "var(--gc-surface-2)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: pct > 85 ? "var(--gc-danger)" : "var(--gc-grad)" }} />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={run}>
          <GcIcon name="broom-sweep" size={13} /> {t("settings.runScan")}
        </Button>
        {lastScanAt > 0 && (
          <span className="text-[0.65rem]" style={{ color: "var(--gc-muted)" }}>
            Last scan: {new Date(lastScanAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {report && (
        <motion.ul initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 flex list-disc flex-col gap-0.5 pl-4 text-xs" style={{ color: "var(--gc-text2)" }} aria-live="polite">
          {report.issues.map((msg, i) => <li key={i}>{msg}</li>)}
        </motion.ul>
      )}
    </div>
  );
}

/* base edition: tasteful upgrade discoverability */
function UpgradeCard() {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
      <p className="flex items-center gap-2 text-sm font-extrabold"><GcIcon name="rocket-launch" size={15} /> GoalCheck Advance</p>
      <p className="mb-2 text-xs" style={{ color: "var(--gc-text2)" }}>
        Kanban, Matrix, Mind-map &amp; Analytics views • habits &amp; achievements • 11 themes with particle atmospheres • audio studio • templates • command bar • due dates &amp; recurring tasks • theme sharing • sync file. Same storage schema — upgrade keeps every byte of your data.
      </p>
      <p className="text-[0.65rem] font-bold" style={{ color: "var(--gc-muted)" }}>
        Available on the project&apos;s GitHub releases page.
      </p>
    </div>
  );
}

/* v4 — Advance: share themes as validated JSON files */
function ThemeShareSection() {
  const exportThemeJson = useStore((s) => s.exportThemeJson);
  const importThemeJson = useStore((s) => s.importThemeJson);
  const customTheme = useStore((s) => s.customTheme);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState(false);

  const download = () => {
    const blob = new Blob([exportThemeJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `goalcheck-theme-${useStore.getState().theme}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Theme file downloaded — share it with anyone!");
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importThemeJson(String(reader.result || ""));
      setImported(ok);
    };
    reader.onerror = () => toast.error("Could not read that file.");
    reader.readAsText(file);
  };

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
      <p className="mb-1 flex items-center gap-2 text-sm font-extrabold"><GcIcon name="palette-dab" size={14} /> Share themes as files</p>
      <p className="mb-2 text-xs" style={{ color: "var(--gc-text2)" }}>
        Export the current palette as a small JSON file — or import one from a friend. Validated against the app&apos;s color-token schema.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={download}>
          <Download className="mr-1 h-3.5 w-3.5" /> Export theme JSON
        </Button>
        <Button type="button" size="sm" variant="outline" className="gc-btn" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-1 h-3.5 w-3.5" /> Import theme JSON
        </Button>
        <input
          ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Import theme JSON file"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
        {Object.keys(customTheme).length > 0 && (
          <>
            <span className="flex items-center gap-1 text-xs font-extrabold" style={{ color: imported ? "var(--gc-success)" : "var(--gc-accent)" }}>
              <GcIcon name="check-circle" size={12} /> Custom theme active
            </span>
            <button
              type="button"
              className="text-xs font-bold underline-offset-2 hover:underline"
              style={{ color: "var(--gc-text2)" }}
              onClick={() => { useStore.setState({ customTheme: {} }); setImported(false); toast("Custom theme cleared."); }}
            >
              Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   v4.2 — Report / Share card: an offline-rendered canvas card
   (weekly report or achievement showcase) that can be
   downloaded as PNG. Zero network — the share loop is a file.
   ========================================================= */

const CARD_W = 1000;
const CARD_H = 1250;

type CardMode = "week" | "badges";

function drawCard(canvas: HTMLCanvasElement, mode: CardMode, data: {
  appName: string; boardTitle: string; percent: number; completed: number; total: number;
  level: number; xp: number; focusMinutes: number; sessions: number; bestStreak: number;
  badges: { label: string; got: boolean }[]; unlocked: number; badgeTotal: number;
}): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => css.getPropertyValue(name).trim() || fb;

  // background
  const grad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  grad.addColorStop(0, v("--gc-bg", "#060913"));
  grad.addColorStop(1, "#0b1024");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // glow blobs
  const glow = ctx.createRadialGradient(820, 180, 40, 820, 180, 420);
  glow.addColorStop(0, "rgba(99,102,241,0.35)");
  glow.addColorStop(1, "rgba(99,102,241,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow2 = ctx.createRadialGradient(160, 1050, 40, 160, 1050, 380);
  glow2.addColorStop(0, "rgba(6,182,212,0.28)");
  glow2.addColorStop(1, "rgba(6,182,212,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // frame
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, CARD_W - 56, CARD_H - 56);

  ctx.textBaseline = "top";
  // app name
  ctx.fillStyle = v("--gc-text", "#f8fafc");
  ctx.font = "800 44px system-ui, sans-serif";
  ctx.fillText(data.appName, 72, 84);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText(mode === "week" ? "Weekly report card" : "Achievement showcase", 72, 142);

  // level chip
  const accent = v("--gc-accent", "#6366f1");
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(CARD_W - 330, 84, 258, 74, 37);
  ctx.fill();
  ctx.fillStyle = "#0b0b16";
  ctx.font = "800 30px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`LVL ${data.level}`, CARD_W - 201, 104);
  ctx.textAlign = "left";

  // board title
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "800 34px system-ui, sans-serif";
  ctx.fillText(data.boardTitle.slice(0, 38), 72, 210);

  // stat blocks (2x2)
  const stats: [string, string][] = mode === "week"
    ? [
        ["Completion", `${data.percent}%`],
        ["Tasks done", `${data.completed}/${data.total}`],
        ["Focus time", `${Math.round(data.focusMinutes / 60)}h ${data.focusMinutes % 60}m`],
        ["Best habit streak", `${data.bestStreak}`],
      ]
    : [
        ["Level", `${data.level}`],
        ["Total XP", `${data.xp}`],
        ["Focus sessions", `${data.sessions}`],
        ["Best habit streak", `${data.bestStreak}`],
      ];
  const bw = (CARD_W - 72 * 2 - 24) / 2;
  const bh = 190;
  stats.forEach(([label, value], i) => {
    const x = 72 + (i % 2) * (bw + 24);
    const y = 290 + Math.floor(i / 2) * (bh + 24);
    ctx.fillStyle = "rgba(255,255,255,0.055)";
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 22);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), x + 28, y + 26);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 64px system-ui, sans-serif";
    ctx.fillText(value, x + 28, y + 64);
  });

  // progress ring or badges grid
  if (mode === "week") {
    const cx = CARD_W / 2, cy = 935, r = 150;
    ctx.lineWidth = 26;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    const ring = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
    ring.addColorStop(0, v("--gc-accent", "#6366f1"));
    ring.addColorStop(1, "#06b6d4");
    ctx.strokeStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.max(1, data.percent) / 100) * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 66px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${data.percent}%`, cx, cy - 40);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "600 24px system-ui, sans-serif";
    ctx.fillText("board completion", cx, cy + 34);
    ctx.textAlign = "left";
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText(`ACHIEVEMENTS ${data.unlocked}/${data.badgeTotal}`, 72, 740);
    const cell = (CARD_W - 72 * 2 - 5 * 16) / 6;
    data.badges.slice(0, 18).forEach((b, i) => {
      const x = 72 + (i % 6) * (cell + 16);
      const y = 786 + Math.floor(i / 6) * (cell + 16);
      ctx.fillStyle = b.got ? accent : "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.roundRect(x, y, cell, cell, 16);
      ctx.fill();
      ctx.fillStyle = b.got ? "#0b0b16" : "rgba(255,255,255,0.4)";
      ctx.font = "800 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(b.label.slice(0, 8), x + cell / 2, y + cell / 2 - 10);
      ctx.textAlign = "left";
    });
  }

  // footer
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText("local-first & FOSS — made with GoalCheck", 72, CARD_H - 88);
}

function ReportCardModal() {
  const open = useUi((s) => s.reportCard);
  const goals = useStore((s) => s.goals);
  const activeGoalId = useStore((s) => s.activeGoalId);
  const rpg = useStore((s) => s.rpg);
  const analytics = useStore((s) => s.analytics);
  const habits = useStore((s) => s.habits);
  const achievements = useStore((s) => s.achievements);
  const [mode, setMode] = useState<CardMode>("week");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const goal = goals.find((g) => g.id === activeGoalId);
  const stats = goal ? calculateStats(goal) : { percent: 0, completed: 0, total: 0 };
  const sessions = Object.values(analytics.hourCounts ?? {}).reduce<number>((a, b) => a + (Number(b) || 0), 0);
  const bestStreak = habits.reduce((mx, h) => Math.max(mx, habitStreak(h.marks, h.cadence)), 0);
  const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]);

  useEffect(() => {
    if (!open) return;
    const draw = () => {
      const c = canvasRef.current;
      if (!c) return;
      drawCard(c, mode, {
        appName: APP_NAME,
        boardTitle: goal?.title ?? "My goals",
        percent: stats.percent,
        completed: stats.completed,
        total: stats.total,
        level: levelFromXp(rpg.xp),
        xp: rpg.xp,
        focusMinutes: Math.round((analytics.focusSeconds ?? 0) / 60),
        sessions,
        bestStreak,
        badges: ACHIEVEMENTS.map((a) => ({ label: a.label, got: !!achievements[a.id] })),
        unlocked: unlocked.length,
        badgeTotal: ACHIEVEMENTS.length,
      });
    };
    draw();
  }, [open, mode, goal, stats.percent, stats.completed, stats.total, rpg.xp, analytics.focusSeconds, sessions, bestStreak, achievements, unlocked.length]);

  const download = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `goalcheck-card-${mode}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Card downloaded — share it anywhere!");
    }, "image/png");
  };

  const copy = async () => {
    const c = canvasRef.current;
    if (!c) return;
    try {
      const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
      if (!blob) throw new Error();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("Card copied to clipboard!");
    } catch {
      toast.error("Clipboard image copy not supported here — use Download.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) useUi.setState({ reportCard: false }); }}>
      <DialogContent className="gc-modal max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="camera-flash" size={17} /> Report card</DialogTitle>
          <DialogDescription>An offline-rendered share card — nothing leaves this device.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1 rounded-xl p-1" style={{ background: "var(--gc-surface-2)" }} role="tablist" aria-label="Card mode">
          {([["week", "Weekly report"], ["badges", "Achievements"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold"
              style={mode === id ? { background: "var(--gc-surface)", color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))" } : { color: "var(--gc-text2)" }}>
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[46vh] overflow-y-auto rounded-xl gc-scroll" style={{ border: "1px solid var(--gc-border)" }}>
          <canvas ref={canvasRef} width={CARD_W} height={CARD_H} className="h-auto w-full" aria-label={`${APP_NAME} share card preview`} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" className="gc-btn" onClick={copy}><Copy className="mr-1 h-4 w-4" /> Copy</Button>
          <Button type="button" className="gc-btn-primary" onClick={download}><Download className="mr-1 h-4 w-4" /> Download PNG</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   v4.2 — Community pack importer (marketplace): goal-template
   packs as JSON, pasted inline or fetched from a user-provided
   URL. Packs live in localStorage (gc_custom_packs) and merge
   into the Templates sidebar panel.
   ========================================================= */

export interface PackTemplate {
  key: string;
  title: string;
  icon?: string;
  blurb?: string;
  categories: { title: string; media?: string; items: { text: string; priority?: string; notes?: string }[] }[];
}
interface Pack { name: string; templates: PackTemplate[] }

const PACK_KEY = "gc_custom_packs";

export function readPacks(): Pack[] {
  try {
    const raw = localStorage.getItem(PACK_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writePacks(packs: Pack[]): void {
  try { localStorage.setItem(PACK_KEY, JSON.stringify(packs)); } catch { /* quota — ignore */ }
}

function PackModal() {
  const open = useUi((s) => s.packModal);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [packs, setPacks] = useState<Pack[]>([]);
  const [packsLoaded, setPacksLoaded] = useState(false);

  /* refresh the installed-pack list each time the modal opens (render-adjust) */
  if (open && !packsLoaded) {
    setPacksLoaded(true);
    setPacks(readPacks());
  }
  if (!open && packsLoaded) {
    setPacksLoaded(false);
  }

  const install = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Pack;
      if (!parsed || !Array.isArray(parsed.templates) || parsed.templates.length === 0) {
        toast.error("Not a valid pack — expected { name, templates: [...] }.");
        return;
      }
      const clean: Pack = {
        name: String(parsed.name || "Community pack").slice(0, 60),
        templates: parsed.templates.slice(0, 24).map((tp, i) => ({
          key: `pack_${Date.now().toString(36)}_${i}`,
          title: String(tp.title || "Imported template").slice(0, 60),
          icon: typeof tp.icon === "string" ? tp.icon : "mono:rocket-launch",
          blurb: String(tp.blurb || `${tp.categories?.length ?? 0} categories`).slice(0, 90),
          categories: (tp.categories || []).slice(0, 12).map((c) => ({
            title: String(c.title || "Category").slice(0, 60),
            media: typeof c.media === "string" ? c.media : "mono:clipboard-check",
            items: (c.items || []).slice(0, 40).map((it) => ({
              text: String(it.text || "").slice(0, 200),
              priority: it.priority === "high" || it.priority === "urgent" ? it.priority : "normal",
              notes: typeof it.notes === "string" ? it.notes.slice(0, 300) : undefined,
            })).filter((it) => it.text),
          })).filter((c) => c.items.length > 0),
        })).filter((tp) => tp.categories.length > 0),
      };
      if (clean.templates.length === 0) { toast.error("Pack has no usable templates."); return; }
      const next = [...readPacks().filter((p) => p.name !== clean.name), clean];
      writePacks(next);
      setPacks(next);
      setText("");
      toast.success(`Installed "${clean.name}" — ${clean.templates.length} template(s) added to the sidebar.`);
    } catch {
      toast.error("That JSON could not be parsed.");
    }
  };

  const fetchUrl = async () => {
    const u = url.trim();
    if (!/^https:\/\//i.test(u)) { toast.error("Enter an https:// URL to the pack JSON."); return; }
    try {
      const res = await fetch(u, { mode: "cors" });
      const raw = await res.text();
      install(raw);
    } catch {
      toast.error("Fetch failed (CORS or offline) — paste the JSON instead.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) useUi.setState({ packModal: false }); }}>
      <DialogContent className="gc-modal max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="globe-orbit" size={17} /> Community packs</DialogTitle>
          <DialogDescription>Import template packs as JSON — from a URL or pasted inline. Installed packs appear in the sidebar.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} className="gc-input flex-1"
            placeholder="https://example.com/goalcheck-pack.json" aria-label="Pack JSON URL" />
          <Button type="button" variant="outline" className="gc-btn shrink-0" onClick={() => void fetchUrl()}>Fetch</Button>
        </div>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} className="gc-input h-32 resize-none font-mono text-xs"
          placeholder={'{\n  "name": "Exam season",\n  "templates": [{ "title": "Exam prep", "categories": [{ "title": "Revision", "items": [{ "text": "Past papers" }] }] }]\n}'}
          aria-label="Pack JSON" />
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="outline" className="gc-btn" disabled={!text.trim()} onClick={() => install(text)}>Install pack</Button>
          {packs.length > 0 && (
            <button type="button" className="text-xs font-bold underline-offset-2 hover:underline" style={{ color: "var(--gc-text2)" }}
              onClick={() => { writePacks([]); setPacks([]); toast("All community packs removed."); }}>
              Remove all ({packs.length} pack{packs.length > 1 ? "s" : ""})
            </button>
          )}
        </div>
        {packs.map((p) => (
          <div key={p.name} className="rounded-lg border p-2 text-xs" style={{ borderColor: "var(--gc-border)", color: "var(--gc-text2)" }}>
            <b style={{ color: "var(--gc-text)" }}>{p.name}</b> — {p.templates.length} template(s)
          </div>
        ))}
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   v4.2 — Seasonal challenges: three deterministic, month-scoped
   goals derived purely from existing data (monthly XP from the
   RPG history, best habit streak, average board completion).
   No servers, no new persistence — the calendar is the season.
   ========================================================= */

function SeasonalChallenges() {
  const rpg = useStore((s) => s.rpg);
  const habits = useStore((s) => s.habits);
  const goals = useStore((s) => s.goals);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const seed = now.getFullYear() * 12 + now.getMonth();

  const monthXp = Object.entries(rpg.history ?? {}).reduce<number>((sum, [k, v]) => (k.startsWith(monthKey) ? sum + (Number(v) || 0) : sum), 0);
  const bestStreak = habits.reduce((mx, h) => Math.max(mx, habitStreak(h.marks, h.cadence)), 0);
  const avgPercent = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + calculateStats(g).percent, 0) / goals.length)
    : 0;

  const xpTarget = 300 + (seed % 5) * 150;
  const streakTarget = 5 + (seed % 4);
  const percentTarget = 60 + (seed % 5) * 5;

  const challenges = [
    { label: `Earn ${xpTarget} XP this month`, value: monthXp, target: xpTarget, icon: "bolt-boost" },
    { label: `Hold a ${streakTarget}-period habit streak`, value: bestStreak, target: streakTarget, icon: "flame-ember" },
    { label: `Keep boards at ${percentTarget}% average completion`, value: avgPercent, target: percentTarget, icon: "check-circle" },
  ];

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
      <p className="mb-0.5 flex items-center gap-2 text-sm font-extrabold"><GcIcon name="trophy-star" size={15} /> Seasonal challenges</p>
      <p className="mb-2 text-[0.68rem]" style={{ color: "var(--gc-muted)" }}>
        {now.toLocaleString("en", { month: "long" })} {now.getFullYear()} — resets automatically each month, derived from your real activity.
      </p>
      <div className="flex flex-col gap-2">
        {challenges.map((c) => {
          const done = c.value >= c.target;
          const pct = Math.min(100, Math.round((c.value / c.target) * 100));
          return (
            <div key={c.label} className="rounded-lg p-2" style={{ background: "var(--gc-surface-2)" }}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold">
                <span className="flex min-w-0 items-center gap-1.5">
                  <GcIcon name={c.icon} size={12} /> {c.label}
                </span>
                <span className="shrink-0 font-mono" style={{ color: done ? "var(--gc-success)" : "var(--gc-text2)" }}>
                  {done ? "DONE" : `${Math.min(c.value, c.target)}/${c.target}`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--gc-input)" }} role="progressbar" aria-label={`${c.label}: ${pct}%`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: done ? "var(--gc-success)" : "var(--gc-grad)" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================================
   v4.3 — WEEKLY REVIEW RITUAL
   Three guided steps: celebrate → carry over → next-week focus.
   Saves a ReviewEntry into the journal (reviews[]).
   ========================================================= */

function WeeklyReviewModal() {
  const open = useUi((s) => s.reviewModal);
  const close = () => useUi.setState({ reviewModal: false });
  const goals = useStore((s) => s.goals);
  const reviews = useStore((s) => s.reviews);
  const saveReview = useStore((s) => s.saveReview);
  const setTaskAdvanced = useStore((s) => s.setTaskAdvanced);
  const [step, setStep] = useState(0);
  const [carried, setCarried] = useState<string[]>([]);
  const [focus, setFocus] = useState<string[]>([]);
  const [note, setNote] = useState("");

  /* recompute fresh every open */
  const weekAgo = shiftDays(new Date(), -7).getTime();
  const data = useMemo(() => {
    const completedNow: { goalId: string; catId: string; id: string; text: string }[] = [];
    const overdue: { goalId: string; catId: string; id: string; text: string }[] = [];
    const openTasks: { goalId: string; catId: string; id: string; text: string }[] = [];
    const todayKey = localDateKey(new Date());
    for (const g of goals) {
      for (const c of g.categories) {
        for (const it of c.items) {
          if (it.completed && it.completedAt >= weekAgo) completedNow.push({ goalId: g.id, catId: c.id, id: it.id, text: it.text });
          if (!it.completed && it.dueDate && it.dueDate.slice(0, 10) < todayKey) overdue.push({ goalId: g.id, catId: c.id, id: it.id, text: it.text });
          if (!it.completed) openTasks.push({ goalId: g.id, catId: c.id, id: it.id, text: it.text });
        }
      }
    }
    return { completedNow, overdue, openTasks };
  }, [goals, open, weekAgo]);

  const reset = () => { setStep(0); setCarried([]); setFocus([]); setNote(""); };
  const toggleIn = (arr: string[], setArr: (v: string[]) => void, text: string) =>
    setArr(arr.includes(text) ? arr.filter((x) => x !== text) : [...arr, text]);

  const save = () => {
    saveReview({ weekKey: isoWeekKey(new Date()), completedCount: data.completedNow.length, carriedOver: carried, focus, note: note.trim() });
    reset();
    close();
  };

  const StepDots = (
    <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === step ? 18 : 6, background: i <= step ? "var(--gc-accent)" : "var(--gc-border-strong)" }} />
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); close(); } }}>
      <DialogContent className="gc-modal max-h-[85vh] max-w-lg overflow-y-auto gc-scroll" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="book-flutter" size={17} /> Weekly Review</DialogTitle>
          <DialogDescription>A 3-step reflection ritual — celebrate, reschedule, focus.</DialogDescription>
        </DialogHeader>

        {step === 0 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold">1 · What you shipped this week 🎉</p>
            {data.completedNow.length === 0 ? (
              <p className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--gc-border)", color: "var(--gc-text2)" }}>
                No completed tasks in the last 7 days. That&apos;s okay — the review is about looking forward too.
              </p>
            ) : (
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto gc-scroll">
                {data.completedNow.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-bold" style={{ background: "var(--gc-success-soft)" }}>
                    <GcIcon name="check-circle" size={13} /> <span className="min-w-0 flex-1 truncate">{t.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[0.68rem]" style={{ color: "var(--gc-muted)" }}>{data.completedNow.length} completed · {data.overdue.length} overdue · {data.openTasks.length} open overall</p>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold">2 · Overdue — reschedule to next week or let go?</p>
            {data.overdue.length === 0 ? (
              <p className="rounded-lg border p-3 text-xs" style={{ borderColor: "var(--gc-border)", color: "var(--gc-text2)" }}>Nothing overdue. Clean slate! ✨</p>
            ) : (
              <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto gc-scroll">
                {data.overdue.map((t) => (
                  <li key={t.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs" style={{ background: "var(--gc-surface-2)" }}>
                    <span className="min-w-0 flex-1 truncate font-bold">{t.text}</span>
                    <Button type="button" size="sm" className="h-6 px-2 text-[0.62rem] gc-btn-primary"
                      onClick={() => {
                        const next = localDateKey(shiftDays(new Date(), 7));
                        setTaskAdvanced(t.catId, t.id, { dueDate: next });
                        setCarried((c) => (c.includes(t.text) ? c : [...c, t.text]));
                        toast("Rescheduled to next week.");
                      }}>
                      +7d
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-[0.62rem] gc-btn"
                      onClick={() => setCarried((c) => (c.includes(t.text) ? c : [...c, t.text]))}>
                      Keep
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {carried.length > 0 && <p className="text-[0.68rem]" style={{ color: "var(--gc-muted)" }}>Carried over: {carried.length}</p>}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-bold">3 · Pick next week&apos;s focus (up to 3)</p>
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto gc-scroll">
              {data.openTasks.slice(0, 40).map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => toggleIn(focus, setFocus, t.text)}
                    aria-pressed={focus.includes(t.text)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-xs font-bold hover:bg-[var(--gc-surface-2)]">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px]"
                      style={{ borderColor: focus.includes(t.text) ? "var(--gc-accent)" : "var(--gc-border-strong)", background: focus.includes(t.text) ? "var(--gc-accent)" : "transparent", color: "#fff" }}>
                      {focus.includes(t.text) ? "\u2713" : ""}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{t.text}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="gc-input min-h-[60px] text-xs"
              placeholder="One line of reflection (optional)…" aria-label="Reflection note" />
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          {step > 0 ? (
            <Button type="button" variant="outline" className="gc-btn" onClick={() => setStep((s) => s - 1)}>Back</Button>
          ) : <span />}
          {StepDots}
          {step < 2 ? (
            <Button type="button" className="gc-btn-primary" onClick={() => setStep((s) => s + 1)}>Next</Button>
          ) : (
            <Button type="button" className="gc-btn-primary" onClick={save} disabled={focus.length > 3}>Save review</Button>
          )}
        </div>

        {reviews.length > 0 && (
          <div className="border-t pt-2" style={{ borderColor: "var(--gc-border)" }}>
            <p className="mb-1 text-[0.65rem] font-extrabold uppercase tracking-wide" style={{ color: "var(--gc-text2)" }}>Journal</p>
            <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto gc-scroll">
              {[...reviews].reverse().slice(0, 8).map((r) => (
                <li key={r.id} className="rounded-lg px-2 py-1 text-[0.68rem]" style={{ background: "var(--gc-surface-2)" }}>
                  <span className="font-bold">{r.weekKey}</span> — {r.completedCount} shipped · {r.focus.length} focus · {r.carriedOver.length} carried
                  {r.note && <span className="block truncate" style={{ color: "var(--gc-text2)" }}>“{r.note}”</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   v4.3 — YEAR IN REVIEW ("Wrapped") — shareable recap card
   ========================================================= */

function WrappedModal() {
  const open = useUi((s) => s.wrappedModal);
  const close = () => useUi.setState({ wrappedModal: false });
  const goals = useStore((s) => s.goals);
  const rpg = useStore((s) => s.rpg);
  const analytics = useStore((s) => s.analytics);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const recap = useMemo(() => collectYearRecap(goals, rpg, analytics), [goals, rpg, analytics]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 900, H = 560;
    canvas.width = W; canvas.height = H;
    const styles = getComputedStyle(document.documentElement);
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0b1020");
    grad.addColorStop(1, "#1a1140");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    const accent = styles.getPropertyValue("--gc-accent").trim() || "#a78bfa";
    const white = "#f4f4fb";
    ctx.textBaseline = "top";
    ctx.fillStyle = accent;
    ctx.font = "800 22px system-ui, sans-serif";
    ctx.fillText(`${APP_NAME.toUpperCase()} — YEAR IN REVIEW`, 48, 44);
    ctx.fillStyle = white;
    ctx.font = "900 64px system-ui, sans-serif";
    ctx.fillText(String(recap.year), 48, 84);
    const stats: [string, string][] = [
      ["tasks completed", String(recap.completed)],
      ["active days", String(recap.activeDays)],
      ["longest streak", `${recap.longestStreak}d`],
      ["focus hours", String(recap.focusHours)],
      ["boards", String(recap.boards)],
      ["level", String(recap.level)],
    ];
    stats.forEach(([label, value], i) => {
      const x = 48 + (i % 3) * 270;
      const y = 210 + Math.floor(i / 3) * 120;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.roundRect(x, y, 240, 96, 16);
      ctx.fill();
      ctx.fillStyle = white;
      ctx.font = "900 40px system-ui, sans-serif";
      ctx.fillText(value, x + 20, y + 14);
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.font = "700 15px system-ui, sans-serif";
      ctx.fillText(label.toUpperCase(), x + 20, y + 62);
    });
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "700 17px system-ui, sans-serif";
    ctx.fillText(`Peak month: ${recap.topMonth.label} · ${recap.xpTotal.toLocaleString()} XP total`, 48, 486);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "600 13px system-ui, sans-serif";
    ctx.fillText("made with GoalCheck — local-first, no account, no analytics", 48, 518);
  };

  useEffect(() => { if (open) requestAnimationFrame(draw); }, [open]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `goalcheck-wrapped-${recap.year}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="gc-modal max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="trophy-star" size={17} /> Year in Review — {recap.year}</DialogTitle>
          <DialogDescription>Your year, distilled. Download the card and share it anywhere.</DialogDescription>
        </DialogHeader>
        <canvas ref={canvasRef} className="w-full rounded-xl border" style={{ borderColor: "var(--gc-border)" }} aria-label={`Year in review card for ${recap.year}`} />
        <DialogFooter>
          <Button type="button" variant="outline" className="gc-btn" onClick={draw}>Redraw</Button>
          <Button type="button" className="gc-btn-primary" onClick={download}><Download className="h-4 w-4" /> Download PNG</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================================================
   v4.3 — IMPORT FROM OTHER APPS (Todoist / Google Tasks / TickTick)
   Paste an export → detect format → preview → import as boards.
   ========================================================= */

function ImportModal() {
  const open = useUi((s) => s.importModal);
  const close = () => useUi.setState({ importModal: false });
  const [raw, setRaw] = useState("");
  const [detected, setDetected] = useState<{ format: string; goals: ImportedGoal[] } | null>(null);

  const runDetect = () => {
    const res = detectAndParse(raw);
    setDetected(res);
    if (res.format === "unknown") toast.error("Could not detect the format — paste a Todoist / Google Tasks / TickTick export.");
  };

  const commit = () => {
    if (!detected || detected.goals.length === 0) return;
    const now = localDateKey(new Date());
    const weekKey = isoWeekKey(new Date());
    const boards = detected.goals.map((g) => ({
      id: `goal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      title: g.title.slice(0, 80) || "Imported Goal",
      subtitle: g.subtitle || "Imported workspace",
      media: "mono:briefcase-check",
      createdAt: Date.now(),
      categories: g.categories.map((c) => ({
        id: `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        title: `${c.title.slice(0, 60)} -`,
        media: "mono:clipboard-check",
        recurrence: "none" as const,
        lastResetDate: now,
        lastWeekKey: weekKey,
        items: c.items.map((t) => ({
          id: `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
          text: t.text.slice(0, 200),
          completed: !!t.completed,
          priority: t.priority,
          notes: (t.notes || "").slice(0, 2000),
          status: (t.completed ? "done" : "todo") as "done" | "todo",
          subtasks: [],
          pomosEstimate: 1,
          pomoCount: 0,
          dependsOn: "",
          dueDate: t.dueDate || "",
          timeSpent: 0,
          recurrence: "none" as const,
          respawnedFrom: "",
          completedAt: t.completed ? Date.now() : 0,
          createdAt: Date.now(),
        })),
      })),
    }));
    if (boards.length > 0) {
      useStore.setState((s) => ({ goals: [...boards, ...s.goals], activeGoalId: boards[0].id }));
      toast.success(`Imported ${boards.length} board${boards.length > 1 ? "s" : ""} from ${detected.format}.`);
      setRaw(""); setDetected(null);
      close();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setDetected(null); close(); } }}>
      <DialogContent className="gc-modal max-h-[85vh] max-w-lg overflow-y-auto gc-scroll" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><GcIcon name="luggage-trip" size={17} /> Import from other apps</DialogTitle>
          <DialogDescription>
            Paste a <b>Todoist</b> backup JSON, <b>Google Tasks</b> Takeout JSON or <b>TickTick</b> backup CSV. Everything is parsed on-device — nothing is uploaded.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="gc-input min-h-[140px] font-mono text-[0.68rem]"
          placeholder='{"projects":[{"name":"Work","items":[{"content":"Ship it","checked":false}]}]}   ← or CSV with projectName,title,…'
          aria-label="Paste export content"
        />
        {detected && detected.format !== "unknown" && (
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
            <p className="mb-1.5 text-xs font-extrabold">
              Detected: <span style={{ color: "var(--gc-accent)" }}>{detected.format}</span> — {detected.goals.length} board{detected.goals.length > 1 ? "s" : ""},{" "}
              {detected.goals.reduce((n, g) => n + g.categories.reduce((m, c) => m + c.items.length, 0), 0)} tasks
            </p>
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto gc-scroll">
              {detected.goals.map((g, gi) => (
                <li key={gi} className="text-[0.7rem] font-bold" style={{ color: "var(--gc-text2)" }}>
                  📋 {g.title} <span className="font-normal">({g.categories.reduce((m, c) => m + c.items.length, 0)} tasks)</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="gc-btn" onClick={() => { setRaw(""); setDetected(null); }}>Clear</Button>
          <Button type="button" variant="outline" className="gc-btn" onClick={runDetect} disabled={!raw.trim()}>Detect format</Button>
          <Button type="button" className="gc-btn-primary" onClick={commit} disabled={!detected || detected.goals.length === 0}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
