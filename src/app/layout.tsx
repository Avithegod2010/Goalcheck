import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { APP_NAME, IS_PRO } from "@/lib/goalcheck/editions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: IS_PRO
    ? "GoalCheck Advance — Multi-Goal Checklists, Focus Timer & Analytics"
    : "GoalCheck — Multi-Goal Checklists & Focus Timer",
  description: IS_PRO
    ? "Local-first goal tracker: boards → categories → tasks, Pomodoro focus timer, 11 themes, particle atmospheres, RPG gamification, Kanban/Matrix/Mind-map/Analytics views. No account, no network — your data stays on your device."
    : "Local-first goal tracker: boards → categories → tasks, priorities, notes, Pomodoro focus timer, light & dark themes. No account, no network — your data stays on your device.",
  keywords: ["goal tracker", "checklist", "pomodoro", "productivity", "offline first", "FOSS"],
  applicationName: APP_NAME,
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster position="bottom-right" visibleToasts={3} gap={8} />
      </body>
    </html>
  );
}
