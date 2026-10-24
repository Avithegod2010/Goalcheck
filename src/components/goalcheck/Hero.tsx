"use client";

/* =========================================================
   Hero progress card + Quick add + Filter bar + View switcher
   Fluidity: spring progress bar, count-up stats, layoutId
   sliding pills on tabs, mono animated icons everywhere.
   ========================================================= */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, useActiveGoal, useUi } from "@/lib/goalcheck/goalcheck-exports";
import { MediaBadge, AnimatedNumber } from "./atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { calculateStats, describeRecurrence, localDateKey, makeTask, shiftDays } from "@/lib/goalcheck/logic";
import { parseQuickAdd, type ParsedQuickAdd } from "@/lib/goalcheck/nlp";
import { notifyError } from "@/lib/goalcheck/notify";
import { runCommand } from "@/components/goalcheck/Overlays";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Check, RotateCcw, Trash2, Pencil, Search, LayoutGrid, Rows3, Plus, Mic, MicOff } from "lucide-react";
import type { WorkspaceView, FilterId, Task } from "@/lib/goalcheck/types";
import { hasFeature } from "@/lib/goalcheck/editions";
import { getLocale, useT } from "@/lib/goalcheck/i18n";

const springy = { type: "spring", stiffness: 320, damping: 24 } as const;

/* ---------------- Hero card ---------------- */

export function HeroCard() {
  const goal = useActiveGoal();
  const openMediaModal = useUi((s) => s.openMediaModal);
  const openBoardModal = useUi((s) => s.openBoardModal);
  const checkAll = useStore((s) => s.checkAll);
  const resetAll = useStore((s) => s.resetAll);
  const clearDone = useStore((s) => s.clearDone);
  const deleteBoard = useStore((s) => s.deleteBoard);
  const pomoCount = useStore((s) => s.goals);
  const t = useT();
  if (!goal) return null;
  const stats = calculateStats(goal);

  const pomos = (() => {
    let est = 0, done = 0;
    for (const g of pomoCount) {
      if (g.id !== goal.id) continue;
      for (const c of g.categories) for (const it of c.items) { est += it.pomosEstimate || 0; done += it.pomoCount || 0; }
    }
    return { est, done };
  })();

  return (
    <motion.section
      className="gc-panel gc-blur relative overflow-hidden rounded-3xl p-5 sm:p-6"
      aria-label={t("hero.boardProgress")}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: "var(--gc-grad)" }} aria-hidden="true" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[240px] flex-1 items-center gap-4">
          <motion.button
            type="button"
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 text-2xl"
            style={{ borderColor: "var(--gc-border-strong)", background: "var(--gc-surface-2)", boxShadow: "0 4px 14px var(--gc-glow)" }}
            onClick={() => openMediaModal({ type: "goal" })}
            title={t("hero.customizeBoardIcon")}
            aria-label={t("hero.customizeBoardIcon")}
            whileHover={{ scale: 1.07, rotate: -4 }}
            whileTap={{ scale: 0.93 }}
            transition={springy}
          >
            <MediaBadge value={goal.media} fallback="mono:target-radar" iconSize={28} />
          </motion.button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{goal.title}</h1>
              <Button type="button" variant="ghost" size="icon" className="size-7 gc-btn" onClick={() => openBoardModal("edit")} title={t("hero.editBoardTitle")} aria-label={t("hero.editBoardTitle")}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="truncate text-sm" style={{ color: "var(--gc-text2)" }}>{goal.subtitle || t("hero.defaultSubtitle")}</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="gc-grad-text font-mono text-4xl font-black leading-none">
            <AnimatedNumber value={stats.percent} format={(n) => `${Math.round(n)}%`} />
          </span>
          <span className="mt-1 text-xs font-bold" style={{ color: "var(--gc-text2)" }}>
            <AnimatedNumber value={stats.completed} /> {t("hero.completedOf", { total: stats.total })}
          </span>
        </div>
      </div>

      <div className="mt-5 h-[18px] overflow-hidden rounded-full border p-0.5" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }} role="progressbar" aria-label={t("hero.goalProgressAria", { percent: stats.percent })} aria-valuenow={stats.percent} aria-valuemin={0} aria-valuemax={100}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--gc-grad)", boxShadow: "0 0 14px var(--gc-glow)" }}
          initial={false}
          animate={{ width: `${stats.percent}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip icon="folder-open">{t("hero.chipCategories", { count: stats.catCount })}</Chip>
          <Chip icon="hourglass-flow" tone="pending">{t("hero.chipRemaining", { count: stats.remaining })}</Chip>
          <Chip icon="check-circle" tone="done">{t("hero.chipCompleted", { count: stats.completed })}</Chip>
          <Chip icon="tomato-timer">{t("hero.chipPomodoros", { completed: pomos.done, total: pomos.est })}</Chip>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gc-btn" onClick={checkAll}><Check className="h-3.5 w-3.5" /> {t("hero.checkAll")}</Button>
          <Button type="button" variant="outline" size="sm" className="gc-btn" onClick={resetAll}><RotateCcw className="h-3.5 w-3.5" /> {t("hero.resetAll")}</Button>
          <Button type="button" variant="outline" size="sm" className="gc-btn" onClick={clearDone}>
            <GcIcon name="broom-sweep" size={14} /> {t("hero.clearDone")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="size-8 border-[var(--gc-danger-soft)] text-[var(--gc-danger)] gc-btn" title={t("hero.deleteBoard")} aria-label={t("hero.deleteBoard")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="gc-modal">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("hero.deleteBoardConfirm", { name: goal.title })}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("hero.deleteBoardWarning")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="gc-btn">{t("common.cancel")}</AlertDialogCancel>
                <AlertDialogAction className="bg-[var(--gc-danger)] text-white hover:bg-[var(--gc-danger)]/90" onClick={() => deleteBoard(goal.id)}>
                  {t("hero.deletePermanently")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </motion.section>
  );
}

function Chip({ children, icon, tone }: { children: React.ReactNode; icon: string; tone?: "done" | "pending" }) {
  const style = tone === "done"
    ? { background: "var(--gc-success-soft)", color: "var(--gc-success)", borderColor: "var(--gc-success-soft)" }
    : tone === "pending"
      ? { background: "var(--gc-warning-soft)", color: "var(--gc-warning)", borderColor: "var(--gc-warning-soft)" }
      : { background: "var(--gc-surface-2)", color: "var(--gc-text2)", borderColor: "var(--gc-border)" };
  return (
    <motion.span
      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[0.72rem] font-bold"
      style={style}
      whileHover={{ scale: 1.05, y: -1 }}
      transition={springy}
    >
      <GcIcon name={icon} size={13} />
      {children}
    </motion.span>
  );
}

/* ---------------- Quick add bar ---------------- */

/* Task 17-b — minimal Web Speech typings (Chrome ships it behind the
   webkit prefix; the DOM lib may not declare SpeechRecognition at all,
   so they are declared locally — no @types dependency). */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/* BCP-47 tag per supported locale (bare codes work, regional hints help) */
const SR_LANGS: Record<string, string> = { en: "en-US", hi: "hi-IN", es: "es-ES", de: "de-DE", fr: "fr-FR", "pt-BR": "pt-BR", ja: "ja-JP", ru: "ru-RU" };

/* never-fire subscribe — the speech API set is fixed for a page session */
const subscribeNoop = () => () => {};
const srAvailable = () => getSpeechRecognition() !== undefined;

/* compact preview pill — same language as Checklist's DueBadge */
function NlChip({ children, icon }: { children: React.ReactNode; icon: string }) {
  return (
    <motion.span
      className="flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.65rem] font-extrabold"
      style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)", borderColor: "var(--gc-border)" }}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springy}
    >
      <GcIcon name={icon} size={11} />
      {children}
    </motion.span>
  );
}

export function QuickAddBar() {
  const addCategory = useStore((s) => s.addCategory);
  const quickCatMedia = useStore((s) => s.quickCatMedia);
  const openMediaModal = useUi((s) => s.openMediaModal);
  const t = useT();
  const [title, setTitle] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const inputRef = useRef<HTMLInputElement>(null);

  /* Task 17-b — live natural-language preview (cheap parser, per keystroke).
     Base edition keeps date phrases in the text (extractDates:false). */
  const parsed = useMemo(
    () => parseQuickAdd(title, { extractDates: hasFeature("due-dates") }),
    [title]
  );
  const hasParsed =
    parsed.dueDate !== undefined ||
    parsed.priority !== undefined ||
    parsed.categoryTitle !== undefined ||
    parsed.estimate !== undefined ||
    parsed.recurrence !== undefined;

  const dueLabel = useMemo(() => {
    if (!parsed.dueDate) return "";
    const today = localDateKey(new Date());
    if (parsed.dueDate === today) return t("task.today");
    if (parsed.dueDate === localDateKey(shiftDays(new Date(), 1))) return t("hero.nlDueTomorrow");
    const due = new Date(`${parsed.dueDate}T00:00:00`);
    const days = Math.round((due.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    if (days >= 0 && days < 7) return due.toLocaleDateString(getLocale(), { weekday: "long" });
    return parsed.dueDate.slice(5); /* "MM-DD" — DueBadge convention */
  }, [parsed.dueDate, t]);

  /* Task 17-b — voice dictation (Web Speech API). useSyncExternalStore keeps
     SSR/hydration honest (server: hidden) without setState-in-effect. */
  const [listening, setListening] = useState(false);
  const voiceReady = useSyncExternalStore(subscribeNoop, srAvailable, () => false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseRef = useRef("");

  useEffect(() => () => recRef.current?.stop(), []);

  const toggleVoice = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const rec = new Ctor();
    recRef.current = rec;
    voiceBaseRef.current = title.trim(); /* text typed before dictation is kept */
    rec.lang = SR_LANGS[getLocale()] ?? getLocale();
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const chunk = res[0]?.transcript ?? "";
        if (res.isFinal) finalText += chunk;
        else interim += chunk;
      }
      const base = voiceBaseRef.current;
      const prefix = base ? `${base} ` : "";
      /* interim streams into the input live; the final result replaces
         the dictated segment (base text + final transcript) */
      setTitle(finalText ? `${prefix}${finalText.trim()}` : `${prefix}${interim.trim()}`);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") notifyError(t("hero.voiceDenied"));
      else if (e.error === "no-speech") notifyError(t("hero.voiceNoSpeech"));
      else notifyError(t("hero.voiceError"));
    };
    rec.onend = () => setListening(false);
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  /* v4.2 — external intake: extension handoff / share-sheet prefill+focus */
  useEffect(() => {
    const onPrefill = (e: Event) => {
      const text = (e as CustomEvent<string>).detail ?? "";
      if (!text) return;
      setTitle(text);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    const onFocus = () => requestAnimationFrame(() => inputRef.current?.focus());
    window.addEventListener("gc-quick-add", onPrefill);
    window.addEventListener("gc-quick-add-focus", onFocus);
    return () => {
      window.removeEventListener("gc-quick-add", onPrefill);
      window.removeEventListener("gc-quick-add-focus", onFocus);
    };
  }, []);

  /* Task 17-b — apply parsed quick-add values: "#tag" resolves to an existing
     category (case-insensitive, " -" suffix tolerated) or is created; without
     a tag the task lands in the first category (creating a "Tasks" category
     on an empty board). Task fields ride makeTask opts — the same factory
     the store itself uses. */
  const addParsedTask = (line: ParsedQuickAdd) => {
    const text = line.clean;
    const opts: Partial<Task> = {};
    if (line.priority) opts.priority = line.priority;
    if (line.dueDate) opts.dueDate = line.dueDate;
    if (line.recurrence) opts.recurrence = line.recurrence;
    if (line.estimate) opts.estimate = line.estimate;

    const goalOf = () => {
      const s = useStore.getState();
      return s.goals.find((g) => g.id === s.activeGoalId);
    };
    const lastCatId = () => {
      const cats = goalOf()?.categories;
      return cats && cats.length > 0 ? cats[cats.length - 1].id : null;
    };

    let catId: string | null = null;
    if (line.categoryTitle) {
      const needle = line.categoryTitle.toLowerCase();
      const existing = goalOf()?.categories.find(
        (c) => c.title.replace(/\s*[-:]$/, "").trim().toLowerCase() === needle
      );
      if (existing) catId = existing.id;
      else {
        addCategory(line.categoryTitle, quickCatMedia, "none");
        catId = lastCatId();
      }
    } else {
      const cats = goalOf()?.categories;
      if (cats && cats.length > 0) catId = cats[0].id;
      else {
        addCategory(t("hero.nlDefaultCategory"), quickCatMedia, "none");
        catId = lastCatId();
      }
    }
    if (!catId || !text) return;

    useStore.setState((s) => ({
      goals: s.goals.map((g) => g.id === s.activeGoalId
        ? { ...g, categories: g.categories.map((c) => c.id === catId
          ? { ...c, items: [...c.items, makeTask(text, opts)] }
          : c) }
        : g),
    }));
  };

  /* v4.2 — natural-language routing: /commands run inline; the • / ;-list
     multi-task syntax opens the Quick Paste preview; 17-b adds single-task
     NL parsing (dates / !priority / #category / ~estimate / every-week) as
     a task-add path; plain text stays a category. */
  const submitQuickAdd = () => {
    const raw = title.trim();
    if (!raw) return;
    if (listening) recRef.current?.stop();
    if (raw.startsWith("/")) {
      const msg = runCommand(raw);
      if (msg) toast(msg);
      else toast(t("hero.unknownCommand"));
      setTitle("");
      return;
    }
    if (raw.includes("•") || raw.includes(";") || /\n/.test(raw) || /^\s*(\d+[.)]|[-*]|\[\s?[xX]?\s?\])\s+/.test(raw)) {
      useUi.setState({ pasteText: raw, pasteModal: true });
      setTitle("");
      return;
    }
    const parsedLine = parseQuickAdd(raw, { extractDates: hasFeature("due-dates") });
    const hasExtras =
      parsedLine.dueDate !== undefined ||
      parsedLine.priority !== undefined ||
      parsedLine.categoryTitle !== undefined ||
      parsedLine.estimate !== undefined ||
      parsedLine.recurrence !== undefined;
    if (hasExtras && parsedLine.clean) {
      addParsedTask(parsedLine);
      setTitle("");
      return;
    }
    addCategory(raw, quickCatMedia, recurrence);
    setTitle("");
  };

  return (
    <motion.section
      className="gc-panel gc-blur flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed p-3.5 sm:px-5"
      style={{ borderColor: "var(--gc-border-strong)" }}
      aria-label={t("hero.addCategory")}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ borderColor: "var(--gc-accent)" }}
    >
      <span className="flex items-center gap-2 text-sm font-bold"><GcIcon name="plus-round" size={17} /> {t("hero.addCategorySection")}</span>
      <form
        className="flex min-w-[260px] flex-1 items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); submitQuickAdd(); }}
      >
        <motion.button
          type="button"
          className="flex h-10 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
          style={{ borderColor: "var(--gc-border-strong)", background: "var(--gc-input)" }}
          onClick={() => openMediaModal({ type: "quick" })}
          title={t("hero.chooseCategoryIcon")}
          aria-label={t("hero.chooseCategoryIcon")}
          whileHover={{ scale: 1.07, rotate: 4 }}
          whileTap={{ scale: 0.92 }}
          transition={springy}
        >
          <MediaBadge value={quickCatMedia} fallback="mono:laptop-code" iconSize={22} />
        </motion.button>
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="gc-input flex-1"
          placeholder={t("hero.placeholder")}
          aria-label={t("hero.inputAria")}
          required
        />
        {voiceReady && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={`size-10 shrink-0 gc-btn ${listening ? "animate-pulse" : ""}`}
            onClick={toggleVoice}
            aria-pressed={listening}
            aria-label={t("hero.voiceInput")}
            title={t("hero.voiceInput")}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        )}
        <div className="w-[10.5rem] shrink-0">
          <Select value={recurrence} onValueChange={setRecurrence}>
            <SelectTrigger className="gc-input text-xs" aria-label={t("hero.recurrence")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("hero.oneTimeCategory")}</SelectItem>
              <SelectItem value="daily"><span className="flex items-center gap-2"><GcIcon name="repeat-cycle" size={13} /> {t("hero.dailyAutoReset")}</span></SelectItem>
              <SelectItem value="weekly"><span className="flex items-center gap-2"><GcIcon name="calendar-tick" size={13} /> {t("hero.weeklyAutoReset")}</span></SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="shrink-0 gc-btn-primary"><Plus className="h-4 w-4" /> {t("common.add")}</Button>
      </form>
      {hasParsed && (
        <motion.div
          className="flex w-full flex-wrap items-center gap-1.5"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-label={t("hero.nlPreviewAria")}
        >
          {parsed.dueDate && <NlChip icon="calendar-tick">{dueLabel}</NlChip>}
          {parsed.priority && (
            <NlChip icon={parsed.priority === "urgent" ? "flame-ember" : "star-shine"}>
              !{parsed.priority}
            </NlChip>
          )}
          {parsed.categoryTitle && <NlChip icon="folder-open">#{parsed.categoryTitle}</NlChip>}
          {parsed.estimate ? (
            <NlChip icon="tomato-timer">{t("hero.nlChipEstimate", { count: parsed.estimate })}</NlChip>
          ) : null}
          {parsed.recurrence && <NlChip icon="repeat-cycle">{describeRecurrence(parsed.recurrence)}</NlChip>}
        </motion.div>
      )}
    </motion.section>
  );
}

/* ---------------- View switcher + filter bar ---------------- */

const VIEWS: [WorkspaceView, string, string][] = [
  ["checklist", "Checklist", "clipboard-check"],
  ["week", "Week", "hourglass-flow"],
  ["calendar", "Calendar", "calendar-tick"],
  ["timeline", "Roadmap", "seed-grow"],
  ["kanban", "Kanban", "kanban-cols"],
  ["matrix", "Matrix", "compass-needle"],
  ["graph", "Mind Map", "network-nodes"],
  ["analytics", "Analytics", "chart-bars"],
];

/* edition-aware view list (base = checklist; week/calendar ride the due-dates
   feature; the other Advance views ride views.advanced) */
const VIEWS_AVAILABLE: [WorkspaceView, string, string][] = VIEWS.filter(
  ([id]) =>
    id === "checklist" ||
    (id === "week" || id === "calendar" ? hasFeature("due-dates") : hasFeature("views.advanced"))
);

const FILTERS: [FilterId, string][] = [
  ["all", "filters.all"],
  ["active", "filters.active"],
  ["completed", "filters.completed"],
  ["priority", "filters.priority"],
  ...(hasFeature("due-dates") ? [["week", "filters.week"] as [FilterId, string]] : []),
];

export function FilterBar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const search = useStore((s) => s.searchQuery);
  const setSearch = useStore((s) => s.setSearch);
  const layout = useStore((s) => s.layoutMode);
  const setLayout = useStore((s) => s.setLayout);
  const t = useT();

  return (
    <>
      <motion.div
        className="gc-panel gc-blur flex flex-wrap items-center justify-between gap-3 rounded-2xl p-2.5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {VIEWS_AVAILABLE.length > 1 && (
          <div className="flex flex-wrap items-center gap-1" role="tablist" aria-label={t("hero.workspaceViews")}>
            {VIEWS_AVAILABLE.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2 ${view === id ? "text-white" : ""}`}
              style={view === id ? undefined : { color: "var(--gc-text2)" }}
            >
              {view === id && (
                <motion.span layoutId="gcViewPill" className="tab-pill" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
              )}
              <span className="tab-label flex items-center gap-1.5">
                <GcIcon name={icon} size={14} />
                {t(`views.${id}`) || label}
              </span>
            </button>
            ))}
          </div>
        )}
        <div className="relative min-w-[180px] flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--gc-muted)" }} aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="gc-input pl-9 text-xs"
            placeholder={t("common.search")}
            aria-label={t("hero.searchTasks")}
          />
        </div>
      </motion.div>

      <motion.div
        className="gc-panel gc-blur flex flex-wrap items-center justify-between gap-3 rounded-2xl p-2.5"
        aria-label={t("hero.taskFilters")}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex flex-wrap items-center gap-1 rounded-xl p-1" style={{ background: "var(--gc-surface-2)" }}>
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className="relative rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-2"
              style={filter === id ? { color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))" } : { color: "var(--gc-text2)" }}
            >
              {filter === id && (
                <motion.span layoutId="gcFilterPill" className="tab-pill-soft" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
              )}
              <span className="tab-label">{t(label)}</span>
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9 gc-btn"
          onClick={() => setLayout(layout === "grid" ? "single" : "grid")}
          title={layout === "grid" ? t("hero.singleColumn") : t("hero.twoColumns")}
          aria-label={t("hero.toggleLayout")}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={layout}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.22 }}
              className="flex"
            >
              {layout === "grid" ? <Rows3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </motion.span>
          </AnimatePresence>
        </Button>
      </motion.div>
    </>
  );
}
