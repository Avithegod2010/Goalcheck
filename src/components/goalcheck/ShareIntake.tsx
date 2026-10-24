"use client";

/* =========================================================
   ShareIntake (Task 17-e) — local-first share-link receiver.
   Rendered exactly once by page.tsx. On mount it looks for
   "#share=<token>" in the URL hash, decodes it via sharelink.ts
   and — when the token holds a structurally valid board — opens a
   small dialog offering a one-tap Import. store.importSharedBoard()
   normalizes, dedupes the id, activates the board and notifies.

   The hash is ALWAYS stripped (import, dismiss, and decode-failure
   paths) via history.replaceState so reloads stay clean. A ref guard
   makes the intake run once per mount (StrictMode-safe; the hash is
   gone after the first pass anyway).
   ========================================================= */

import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GcIcon } from "@/lib/goalcheck/icons";
import { useT } from "@/lib/goalcheck/i18n";
import { useStore } from "@/lib/goalcheck/goalcheck-exports";
import { decodeBoardShare } from "@/lib/goalcheck/sharelink";
import type { GoalBoard } from "@/lib/goalcheck/types";

export default function ShareIntake() {
  const t = useT();
  const [board, setBoard] = useState<GoalBoard | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return; // run-once guard (StrictMode double-effect safe)
    ranRef.current = true;

    /* strip the share hash in EVERY path — reloads must never re-prompt */
    const stripHash = () => {
      try {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } catch {
        /* ignore */
      }
    };

    try {
      /* decodeBoardShare accepts a full URL and never throws */
      const decoded = decodeBoardShare(window.location.href);
      /* deferred one tick — avoids sync-setState-in-effect cascading renders */
      if (decoded) queueMicrotask(() => setBoard(decoded));
    } catch {
      /* defensive — stay silent on any intake failure */
    }
    stripHash();
  }, []);

  const close = () => setBoard(null);

  const importBoard = () => {
    if (board) useStore.getState().importSharedBoard(board); // store notifies on success/failure
    close();
  };

  const categories = board?.categories.length ?? 0;
  const tasks = board ? board.categories.reduce((n, c) => n + (c.items?.length ?? 0), 0) : 0;

  return (
    <Dialog open={board !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="gc-modal max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GcIcon name="link-combo" size={17} /> {t("share.receivedTitle")}
          </DialogTitle>
          <DialogDescription>{t("share.receivedBody")}</DialogDescription>
        </DialogHeader>
        {board && (
          <div className="rounded-xl border p-3" style={{ borderColor: "var(--gc-border)", background: "var(--gc-surface-2)" }}>
            <p className="truncate text-sm font-bold">{board.title}</p>
            <p className="mt-0.5 text-xs" style={{ color: "var(--gc-text2)" }}>
              {t("share.counts", { categories, tasks })}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" className="gc-btn" onClick={close}>
            {t("share.dismiss")}
          </Button>
          <Button type="button" className="gc-btn-primary" onClick={importBoard}>
            {t("share.import")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
