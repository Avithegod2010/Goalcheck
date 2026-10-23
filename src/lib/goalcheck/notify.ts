"use client";

/* =========================================================
   notify — sonner toasts with our custom mono animated icons.
   store.ts imports this so celebration toasts carry the app's
   own icon language instead of stock emoji characters.
   ========================================================= */

import { createElement, type ReactNode } from "react";
import { toast } from "sonner";
import { GcIcon } from "./icons";

export interface NotifyOpts {
  description?: string;
  /** v4.3 — sonner passthrough (update-available toast uses an action button) */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export function notify(message: string, iconName?: string, opts?: NotifyOpts): string | number {
  if (!iconName) return toast(message, opts);
  const body = createElement(
    "span",
    { className: "flex items-center gap-2" },
    createElement(GcIcon, { name: iconName, size: 16, className: "shrink-0" }),
    createElement("span", null, message)
  ) as ReactNode;
  return toast(body, opts);
}

export function notifySuccess(message: string, iconName?: string): string | number {
  if (!iconName) return toast.success(message);
  return toast.success(createElement(
    "span",
    { className: "flex items-center gap-2" },
    createElement(GcIcon, { name: iconName, size: 16, className: "shrink-0" }),
    createElement("span", null, message)
  ) as ReactNode);
}

export function notifyError(message: string): string | number {
  return toast.error(message);
}
