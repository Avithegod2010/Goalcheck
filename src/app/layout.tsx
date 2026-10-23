import type { Metadata, Viewport } from "next";
/* v4.2 — self-hosted fonts (geist npm package, OFL). Replaces next/font/google
   so builds are fully offline/reproducible — a hard requirement for F-Droid
   (no build-time fetching of Google-hosted resources). Same CSS variables
   (--font-geist-sans / --font-geist-mono) are emitted, so globals.css is
   untouched. */
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Toaster } from "sonner";
import { APP_NAME, IS_PRO } from "@/lib/goalcheck/editions";
import { PwaBootstrap } from "@/components/goalcheck/Pwa";

export const metadata: Metadata = {
  title: IS_PRO
    ? "GoalCheck Advance — Multi-Goal Checklists, Focus Timer & Analytics"
    : "GoalCheck — Multi-Goal Checklists & Focus Timer",
  description: IS_PRO
    ? "Local-first goal tracker: boards → categories → tasks, Pomodoro focus timer, 11 themes, particle atmospheres, RPG gamification, Kanban/Matrix/Mind-map/Analytics views. No account, no network — your data stays on your device."
    : "Local-first goal tracker: boards → categories → tasks, priorities, notes, Pomodoro focus timer, light & dark themes. No account, no network — your data stays on your device.",
  keywords: ["goal tracker", "checklist", "pomodoro", "productivity", "offline first", "FOSS"],
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: APP_NAME,
  },
  /* NOTE: icon links come from the file convention (src/app/icon.svg,
     icon.png, apple-icon.png) so Next.js prefixes them with the basePath.
     Hand-written "/icons/..." URLs are emitted WITHOUT the basePath and
     404 on the GitHub Pages deploy. */
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#060913",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-FOUC: apply persisted theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var raw=localStorage.getItem("goalcheck_pro_state");var t=null;if(raw){var p=JSON.parse(raw);t=(p.state&&p.state.theme)||p.theme;}if(!t){t="nebula";}document.documentElement.setAttribute("data-gc-theme",t);var L={nordic:1,sakura:1,zen:1};document.documentElement.setAttribute("data-gc-light",L[t]?"1":"0");}catch(e){document.documentElement.setAttribute("data-gc-theme","nebula");}})();`,
          }}
        />
      </head>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {children}
        <Toaster position="bottom-right" visibleToasts={3} gap={8} />
        <PwaBootstrap />
      </body>
    </html>
  );
}
