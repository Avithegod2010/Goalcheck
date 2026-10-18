/* =========================================================
   GoalCheck Pro — Static data: templates + media helpers
   All built-in imagery uses the custom MONO ANIMATED icon set
   (see icons.tsx) — zero stock emoji ships with the app.
   ========================================================= */

import { isGcIconName } from "./icons";

interface TemplateTask {
  text: string;
  completed?: boolean;
  priority?: string;
  notes?: string;
}
interface TemplateCat {
  title: string;
  media: string;
  items: TemplateTask[];
}
export interface Template {
  title: string;
  subtitle: string;
  media: string;
  categories: TemplateCat[];
}

export const TEMPLATES: Record<string, Template & { key: string; icon: string; blurb: string }> = {
  devices: {
    key: "devices",
    icon: "mono:laptop-code",
    blurb: "To do in laptop + Todo in phone",
    title: "Device & Daily Tasks",
    subtitle: "Track laptop workflows, phone tasks, and daily priorities.",
    media: "mono:laptop-code",
    categories: [
      {
        title: "To do in laptop -", media: "mono:laptop-code", items: [
          { text: "Xyz", priority: "high" },
          { text: "Pyq", priority: "high", notes: "Review mock solutions" },
          { text: "Setup development environment", completed: true },
        ],
      },
      {
        title: "Todo in phone -", media: "mono:phone-pulse", items: [
          { text: "Call family & sync photos", completed: true },
          { text: "Clear offline cache" },
          { text: "Check flight tickets", priority: "urgent", notes: "Gate closes 45m before departure" },
        ],
      },
    ],
  },
  vacation: {
    key: "vacation",
    icon: "mono:luggage-trip",
    blurb: "Documents, Tech, Clothes & Health",
    title: "Vacation Packing Checklist",
    subtitle: "Interactive travel checklist with category bars so nothing is forgotten.",
    media: "mono:luggage-trip",
    categories: [
      {
        title: "Travel Documents & Money -", media: "mono:doc-lines", items: [
          { text: "Passport, Visa & Government IDs", completed: true, priority: "urgent" },
          { text: "Hotel confirmation & Boarding passes", completed: true, priority: "high" },
          { text: "Emergency cash & International debit cards", priority: "high" },
        ],
      },
      {
        title: "Tech & Gadgets -", media: "mono:laptop-code", items: [
          { text: "Laptop, Phone & Heavy Duty Powerbank", priority: "high" },
          { text: "Universal travel adapter & extra cables" },
          { text: "Noise canceling headphones", completed: true },
        ],
      },
      {
        title: "Clothing & Footwear -", media: "mono:shirt-fold", items: [
          { text: "5x Breathable T-shirts & 3x Pants" },
          { text: "Light evening jacket & swimwear" },
          { text: "Comfortable walking sneakers" },
        ],
      },
      {
        title: "Toiletries & Health -", media: "mono:drop-care", items: [
          { text: "Prescription medication & First aid kit", priority: "urgent" },
          { text: "Sunscreen SPF 50 & Face wash" },
          { text: "Toothbrush & travel paste" },
        ],
      },
    ],
  },
  exam: {
    key: "exam",
    icon: "mono:book-flutter",
    blurb: "PYQs, Revision & Formula sheets",
    title: "Exam & Study Tracker",
    subtitle: "PYQ problem sets, video lectures, and active recall checkpoints.",
    media: "mono:book-flutter",
    categories: [
      {
        title: "PYQ Papers & Mocks (Laptop) -", media: "mono:laptop-code", items: [
          { text: "Complete PYQ 2024 Question paper in timed exam mode", priority: "urgent" },
          { text: "Analyze tricky questions and formulas from Mock 2", completed: true, priority: "high" },
          { text: "Organize solution PDFs into subject folders", completed: true },
        ],
      },
      {
        title: "Quick Revision & Flashcards (Phone) -", media: "mono:phone-pulse", items: [
          { text: "Review active recall flashcards before bed", priority: "high" },
          { text: "Listen to chapter summary podcast" },
        ],
      },
    ],
  },
  launch: {
    key: "launch",
    icon: "mono:rocket-launch",
    blurb: "Code QA, Deploy & Socials",
    title: "Product Launch",
    subtitle: "End-to-end engineering, QA, and launch marketing verification.",
    media: "mono:rocket-launch",
    categories: [
      {
        title: "Engineering QA & Build -", media: "mono:tools-wrench", items: [
          { text: "Verify mobile responsiveness & touch gestures", completed: true, priority: "urgent" },
          { text: "Audit local storage limits and fallback caching", completed: true, priority: "high" },
          { text: "Test Pomodoro Web Audio synthesized chime", completed: true, priority: "high" },
        ],
      },
      {
        title: "Deployment & Marketing -", media: "mono:globe-orbit", items: [
          { text: "Publish release announcement and docs", priority: "high" },
          { text: "Gather community feedback and log ideas" },
        ],
      },
    ],
  },
};

/* ---------- media value helpers ---------- */

export function isMonoIcon(val: string): boolean {
  return typeof val === "string" && val.startsWith("mono:") && isGcIconName(val.slice(5));
}

export function isImageUrl(val: string): boolean {
  if (!val) return false;
  const t = val.trim();
  return /^data:image\//i.test(t) || /^https?:\/\/.+/i.test(t);
}

/** Legacy stored emoji values still render as text (user data), but the
 *  app itself only ever offers mono icons, image URLs, or uploads. */
export function sanitizeMedia(val: string | undefined, fallback: string): string {
  const v = (val || "").trim();
  if (!v) return fallback;
  return v;
}
