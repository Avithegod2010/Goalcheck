import type { CapacitorConfig } from "@capacitor/cli";

/**
 * GoalCheck Android shell — one config, two editions.
 *
 * Edition is chosen at sync/build time via the GC_EDITION env var:
 *   GC_EDITION=pro   → GoalCheck Advance (io.github.avithegod2010.goalcheckadvance)
 *   GC_EDITION=base  → GoalCheck        (io.github.avithegod2010.goalcheck)
 *
 * Because appId differs per edition, `cap sync android` copies the generated
 * web assets into whichever android/ project exists here — the native template
 * is regenerated per edition via `bunx cap add android` (see README.md).
 * The repo-root scripts `build:capacitor:advance` / `build:capacitor:base`
 * set GC_EDITION before invoking the sync helper.
 */
const edition: "pro" | "base" =
  (process.env.GC_EDITION as "pro" | "base" | undefined) ?? "pro";

const isPro = edition === "pro";

const config: CapacitorConfig = {
  appId: isPro
    ? "io.github.avithegod2010.goalcheckadvance"
    : "io.github.avithegod2010.goalcheck",
  appName: isPro ? "GoalCheck Advance" : "GoalCheck",
  webDir: "www",
  // Persist localStorage in the WebView (survives app restarts).
  server: {
    androidScheme: "https",
  },
  android: {
    // The app is local-only; never allow mixed (cleartext http) content.
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      // smallIcon must be a drawable in android/app/src/main/res — the
      // generated launcher icon set provides ic_launcher.
      smallIcon: "ic_launcher",
      iconColor: "#a855f7",
    },
  },
};

export default config;
