import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * GoalCheck test suite (Phase 2 — quality gate folded into CI).
 *
 * jsdom environment so the zustand store + quota-safe localStorage
 * wrapper can be exercised exactly like in a real browser.
 * Coverage focus:
 *   - schema migrations (legacy v1 flat HTML shape -> v4)
 *   - RPG math (XP curve, levels, combo multiplier, heatmap streaks)
 *   - habit streak math (daily + weekly cadence)
 *   - recurring task respawn + recurring category resets
 *   - achievement evaluation
 *   - edition clamps (base must never leak pro-only state)
 */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    // store tests import the real zustand store; keep isolation per file
    isolate: true,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
