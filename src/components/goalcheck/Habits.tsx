"use client";

/* =========================================================
   v4 — Advance: Habits & streaks (sidebar widget)
   Daily/weekly habit cards with per-period check, streak
   flames and a 7-period mini history. Feeds the activity
   heatmap via habit completions and unlocks achievements.
   ========================================================= */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/goalcheck/goalcheck-exports";
import { Panel, PanelTitle } from "./atoms";
import { GcIcon } from "@/lib/goalcheck/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { habitPeriodKey, habitRecentKeys, habitStreak, habitStreakWithFreezes } from "@/lib/goalcheck/logic";
import { useT } from "@/lib/goalcheck/i18n";
import type { HabitCadence } from "@/lib/goalcheck/types";

export function HabitsWidget() {
  const habits = useStore((s) => s.habits);
  const addHabit = useStore((s) => s.addHabit);
  const removeHabit = useStore((s) => s.removeHabit);
  const toggleHabitPeriod = useStore((s) => s.toggleHabitPeriod);
  const freezesOn = useStore((s) => s.settings.streakFreezes);
  const t = useT();

  const [title, setTitle] = useState("");
  const [cadence, setCadence] = useState<HabitCadence>("daily");
  const now = new Date();

  const submit = () => {
    if (!title.trim()) return;
    addHabit(title, cadence);
    setTitle("");
  };

  return (
    <Panel className="flex flex-col gap-3">
      <PanelTitle icon={<GcIcon name="repeat-cycle" size={15} />}>{t("side.habits")}</PanelTitle>

      {habits.length === 0 && (
        <p className="flex items-center gap-1.5 rounded-xl p-2.5 text-xs" style={{ background: "var(--gc-surface-2)", color: "var(--gc-text2)" }}>
          <GcIcon name="bulb-glow" size={13} />
          {t("habits.empty")}
        </p>
      )}

      <ul className="flex flex-col gap-2" aria-label={t("habits.listLabel")}>
        <AnimatePresence initial={false}>
          {habits.map((h, i) => {
            const key = habitPeriodKey(h.cadence, now);
            const doneNow = !!h.marks[key];
            /* v4.2 — with freezes ON the shown streak bridges missed periods
               using earned tokens; the raw flame keeps the exact count. */
            const streak = freezesOn
              ? habitStreakWithFreezes(h.marks, h.cadence, h.freezes ?? 0, now)
              : habitStreak(h.marks, h.cadence, now);
            const keys = habitRecentKeys(h.cadence, 7, now);
            return (
              <motion.li
                key={h.id}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: -16, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 360, damping: 26, delay: i * 0.04 }}
                className="flex flex-col gap-1.5 rounded-xl border p-2.5"
                style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}
              >
                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => toggleHabitPeriod(h.id)}
                    whileTap={{ scale: 0.82 }}
                    whileHover={{ scale: 1.08 }}
                    aria-pressed={doneNow}
                    aria-label={t("habits.markAria", {
                      action: doneNow ? t("habits.unmark") : t("habits.mark"),
                      name: h.title,
                      period: h.cadence === "daily" ? t("habits.day") : t("habits.week"),
                    })}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                    style={{
                      borderColor: doneNow ? "var(--gc-accent)" : "var(--gc-border-strong)",
                      background: doneNow ? "var(--gc-accent)" : "transparent",
                      color: doneNow ? "#fff" : "var(--gc-text2)",
                    }}
                  >
                    <GcIcon name={doneNow ? "check-circle" : "repeat-cycle"} size={14} />
                  </motion.button>
                  <span className="min-w-0 flex-1 truncate text-xs font-extrabold" style={doneNow ? { textDecoration: "line-through", opacity: 0.75 } : undefined}>
                    {h.title}
                  </span>
                  {streak > 0 && (
                    <motion.span
                      key={`s-${streak}`}
                      initial={{ scale: 1.4 }}
                      animate={{ scale: 1 }}
                      className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-extrabold"
                      style={{ background: "var(--gc-soft)", color: "var(--gc-accent)" }}
                      title={t("habits.streak", { count: streak })}
                    >
                      <GcIcon name="flame-ember" size={11} /> {streak}
                    </motion.span>
                  )}
                  {(h.freezes ?? 0) > 0 && (
                    <span
                      className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-extrabold"
                      style={{ background: "var(--gc-surface)", color: "color-mix(in srgb, var(--gc-accent) 55%, var(--gc-text))", border: "1px solid var(--gc-border)" }}
                      title={h.freezes > 1
                        ? t("habits.freezeTokensMany", { count: h.freezes, period: h.cadence === "daily" ? t("habits.days") : t("habits.weeks") })
                        : t("habits.freezeTokensOne", { count: h.freezes, period: h.cadence === "daily" ? t("habits.days") : t("habits.weeks") })}
                    >
                      <GcIcon name="lock-shield" size={11} /> {h.freezes}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeHabit(h.id)}
                    className="rounded-md p-1 transition-colors hover:text-[var(--gc-danger)] focus-visible:outline-2"
                    style={{ color: "var(--gc-muted)", outlineColor: "var(--gc-danger)" }}
                    aria-label={t("habits.deleteAria", { name: h.title })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center justify-between pl-9">
                  <div className="flex items-center gap-1" aria-label={t("habits.recentLabel")}>
                    {keys.map((k) => (
                      <span
                        key={k}
                        title={k}
                        className="h-1.5 w-4 rounded-full"
                        style={{ background: h.marks[k] ? "var(--gc-accent)" : "var(--gc-border)" }}
                      />
                    ))}
                  </div>
                  <span className="text-[0.6rem] font-bold uppercase tracking-wide" style={{ color: "var(--gc-muted)" }}>
                    {h.cadence}
                  </span>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      <div className="flex items-center gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={t("side.newHabitPlaceholder")}
          className="gc-input h-8 text-xs"
          aria-label={t("habits.nameAria")}
          maxLength={60}
        />
        <Select value={cadence} onValueChange={(v) => setCadence(v as HabitCadence)}>
          <SelectTrigger className="gc-input h-8 w-[92px] shrink-0 text-xs" aria-label={t("habits.cadenceAria")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t("side.daily")}</SelectItem>
            <SelectItem value="weekly">{t("side.weekly")}</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" size="icon" className="size-8 shrink-0 gc-btn-primary" onClick={submit} aria-label={t("side.addHabit")}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </Panel>
  );
}
