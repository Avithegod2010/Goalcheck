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
import { hasFeature, IS_PRO, APP_NAME } from "@/lib/goalcheck/editions";
import { syncFileSupported, linkSyncFile, isSyncLinked, unlinkSyncFile, writeNow } from "@/lib/goalcheck/syncfile";
import { isImageUrl, isMonoIcon } from "@/lib/goalcheck/presets";
import { RPG_AURAS, RPG_SKILLS, ACHIEVEMENTS, buildMarkdownExport, buildPlainExport, localDateKey, rankForLevel, totalXpForLevel, xpForLevel } from "@/lib/goalcheck/logic";
import { parseQuickPaste } from "@/lib/goalcheck/logic";
import { playChime } from "@/lib/goalcheck/audio";
import type { ChimePack } from "@/lib/goalcheck/types";
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
              style={tab === id ? { background: "var(--gc-surface)", color: "var(--gc-accent)" } : { color: "var(--gc-text2)" }}>
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
  const [confirmReset, setConfirmReset] = useState(false);

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

          {hasFeature("data-doctor") && <DataDoctorPanel />}
          {!IS_PRO && <UpgradeCard />}
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

function SettingRow({ title, desc, icon, checked, onCheckedChange }: { title: string; desc: string; icon: string; checked: boolean; onCheckedChange: () => void }) {
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

/* =========================================================
   EXPORT / BACKUP (+ IMPORT)
   ========================================================= */

function ExportModal() {
  const open = useUi((s) => s.exportModal);
  const goal = useActiveGoal();
  const exportWorkspace = useStore((st) => st.exportWorkspace);
  const importWorkspace = useStore((st) => st.importWorkspace);
  const [format, setFormat] = useState<"plain" | "markdown" | "json">("plain");
  const fileRef = useRef<HTMLInputElement>(null);

  const text = useMemo(() => {
    if (!open) return "";
    if (format === "json") return exportWorkspace();
    if (goal && format === "markdown") return buildMarkdownExport(goal);
    if (goal) return buildPlainExport(goal);
    return "";
  }, [open, format, goal, exportWorkspace]);

  const download = () => {
    const ext = format === "json" ? "json" : format === "markdown" ? "md" : "txt";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "json" ? "goalcheck-backup.json" : `goalcheck-export.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          {([["plain", "Plain Text"], ["markdown", "Markdown (.md)"], ["json", "JSON Backup"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={format === id} onClick={() => setFormat(id)}
              className="rounded-lg px-3 py-1.5 text-xs font-bold"
              style={format === id ? { background: "var(--gc-surface)", color: "var(--gc-accent)" } : { color: "var(--gc-text2)" }}>
              {label}
            </button>
          ))}
        </div>

        <Textarea value={text} readOnly className="gc-input h-52 resize-none font-mono text-xs" aria-label="Export content" />

        <div className="flex flex-wrap justify-between gap-2">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="gc-btn" onClick={download}><Download className="mr-1 h-4 w-4" /> Download</Button>
            <Button type="button" className="gc-btn-primary" onClick={copy}><Copy className="mr-1 h-4 w-4" /> Copy</Button>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" aria-label="Import backup file"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                try {
                  const json = await f.text();
                  const ok = importWorkspace(json);
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
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");

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

  const submit = (patch: { text: string; priority: string; pomos: number; dep: string; due: string; recurrence: string }) => {
    if (!target || !item) return;
    setTaskAdvanced(target.catId, target.taskId, {
      text: patch.text.trim() || item.text,
      priority: patch.priority as "normal" | "high" | "urgent",
      pomosEstimate: Math.max(1, Math.min(20, patch.pomos)),
      dependsOn: patch.dep,
      dueDate: patch.due,
      recurrence: patch.recurrence as "none" | "daily" | "weekly",
    });
    toast("Task updated (priority, estimate, lock, due date & recurrence saved).");
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

function TaskEditForm({ initialText, initialPriority, initialPomos, initialDep, initialDue, initialRecurrence, excludeTaskId, goal, onSubmit, onCancel }: {
  initialText: string; initialPriority: string; initialPomos: number; initialDep: string; initialDue: string; initialRecurrence: string; excludeTaskId: string;
  goal: ReturnType<typeof useActiveGoal>;
  onSubmit: (patch: { text: string; priority: string; pomos: number; dep: string; due: string; recurrence: string }) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [priority, setPriority] = useState(initialPriority);
  const [pomos, setPomos] = useState(initialPomos);
  const [dep, setDep] = useState(initialDep);
  const [due, setDue] = useState(initialDue);
  const [recurrence, setRecurrence] = useState(initialRecurrence);

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ text, priority, pomos, dep, due, recurrence }); }} className="flex flex-col gap-3">
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
            <Select value={recurrence} onValueChange={setRecurrence} disabled={!hasFeature("recurring-tasks")}>
              <SelectTrigger className="gc-input"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Never</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
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
  const [linked, setLinked] = useState(isSyncLinked());
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
            <Button type="button" size="sm" variant="ghost" className="gc-btn" onClick={() => { unlinkSyncFile(); setLinked(false); setSyncFileEnabled(false); toast("Sync file unlinked."); }}>
              Unlink
            </Button>
            <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "var(--gc-text2)" }}>
              <Switch checked={syncFileEnabled} onCheckedChange={setSyncFileEnabled} aria-label="Toggle auto-save" /> auto-save
            </span>
          </>
        )}
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
function DataDoctorPanel() {
  const runDoctor = useStore((s) => s.runDoctor);
  const [report, setReport] = useState<{ issues: string[]; fixed: number } | null>(null);

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)" }}>
      <p className="mb-1 flex items-center gap-2 text-sm font-extrabold"><GcIcon name="tools-wrench" size={15} /> Data Doctor</p>
      <p className="mb-2 text-xs" style={{ color: "var(--gc-text2)" }}>
        Scans for broken dependency locks, duplicate task ids, stale pomodoro bindings and oversized media — and repairs what is safe to repair.
      </p>
      <Button
        type="button" size="sm" variant="outline" className="gc-btn"
        onClick={() => { const r = runDoctor(); setReport(r); if (r.fixed > 0) toast.success(`Data doctor fixed ${r.fixed} issue${r.fixed > 1 ? "s" : ""}.`); }}
      >
        <GcIcon name="broom-sweep" size={13} /> Run integrity scan
      </Button>
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
