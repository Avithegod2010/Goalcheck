"use client";

/* =========================================================
   v4.3 — Tiny safe Markdown renderer for task notes.
   ---------------------------------------------------------
   Design constraints:
   - Renders REACT NODES only — never dangerouslySetInnerHTML,
     so user content can never inject markup/JS.
   - Zero dependencies (~130 lines). Supports the subset that
     matters for notes: #/##/### headings, **bold**, *italic*,
     `code`, https links, > quotes, - / 1. lists, - [ ] / - [x]
     interactive checkboxes, and paragraphs.
   - Checkbox toggles rewrite the SOURCE line via the onToggle
     callback (the editor owns the text).
   ========================================================= */

import type { ReactNode } from "react";

/** Regexes are pre-compiled once; all user text is emitted as text nodes. */
const INLINE_RULES: { re: RegExp; render: (m: RegExpExecArray, key: string) => ReactNode }[] = [
  { re: /\*\*([^*]+)\*\*/, render: (m, k) => <strong key={k}>{m[1]}</strong> },
  { re: /(^|[^*])\*([^*\s][^*]*)\*/, render: (m, k) => <em key={k}>{m[2]}</em> },
  {
    re: /`([^`]+)`/,
    render: (m, k) => (
      <code key={k} className="rounded px-1 py-0.5 text-[0.85em]" style={{ background: "var(--gc-surface-2)" }}>
        {m[1]}
      </code>
    ),
  },
  {
    re: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/,
    render: (m, k) => (
      <a key={k} href={m[2]} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2"
        style={{ color: "color-mix(in srgb, var(--gc-accent) 60%, var(--gc-text))" }}>
        {m[1]}
      </a>
    ),
  },
];

/** Parse **bold** / *italic* / `code` / [text](https://url) into nodes. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let i = 0;
  while (rest.length > 0) {
    let bestIdx = -1;
    let bestRule = -1;
    let bestMatch: RegExpExecArray | null = null;
    for (let r = 0; r < INLINE_RULES.length; r++) {
      const m = INLINE_RULES[r].re.exec(rest);
      if (m && (bestIdx === -1 || m.index < bestIdx)) {
        bestIdx = m.index;
        bestRule = r;
        bestMatch = m;
      }
    }
    if (!bestMatch || bestRule === -1) {
      nodes.push(rest);
      break;
    }
    if (bestIdx > 0) nodes.push(rest.slice(0, bestIdx));
    nodes.push(INLINE_RULES[bestRule].render(bestMatch, `${keyBase}-${i++}`));
    rest = rest.slice(bestIdx + bestMatch[0].length);
  }
  return nodes;
}

const TASK_RE = /^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/;
const BULLET_RE = /^(\s*)[-*]\s+(.*)$/;
const NUM_RE = /^(\s*)\d+[.)]\s+(.*)$/;
const HEAD_RE = /^(#{1,3})\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;

export interface MarkdownProps {
  source: string;
  /** Called with the 0-based SOURCE line index when a [ ] checkbox is clicked. */
  onToggleLine?: (lineIndex: number) => void;
}

export function Markdown({ source, onToggleLine }: MarkdownProps) {
  const lines = (source || "").split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: ReactNode[] } | null = null;

  const flushList = () => {
    if (list) {
      const L = list;
      blocks.push(
        L.ordered ? (
          <ol key={`l${blocks.length}`} className="ml-4 list-decimal space-y-0.5">{L.items}</ol>
        ) : (
          <ul key={`l${blocks.length}`} className="ml-4 list-disc space-y-0.5">{L.items}</ul>
        )
      );
      list = null;
    }
  };

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li];
    const line = raw.trimEnd();

    if (!line.trim()) { flushList(); continue; }

    const task = TASK_RE.exec(line);
    if (task) {
      if (list && list.ordered) flushList();
      if (!list) list = { ordered: false, items: [] };
      const done = task[2].toLowerCase() === "x";
      const cb = (
        <li key={`t${li}`} className="flex list-none items-start gap-1.5 -ml-4">
          <button
            type="button"
            role="checkbox"
            aria-checked={done}
            aria-label={`Toggle: ${task[3].slice(0, 40)}`}
            disabled={!onToggleLine}
            onClick={() => onToggleLine?.(li)}
            className="mt-[2px] flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] font-black leading-none"
            style={{
              borderColor: done ? "var(--gc-accent)" : "var(--gc-border-strong)",
              background: done ? "var(--gc-accent)" : "transparent",
              color: "#fff",
              cursor: onToggleLine ? "pointer" : "default",
            }}
          >
            {done ? "\u2713" : ""}
          </button>
          <span style={{ textDecoration: done ? "line-through" : undefined, opacity: done ? 0.6 : 1 }}>
            {renderInline(task[3], `ti${li}`)}
          </span>
        </li>
      );
      list.items.push(cb);
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet && !HEAD_RE.test(line)) {
      if (list && list.ordered) flushList();
      if (!list) list = { ordered: false, items: [] };
      list.items.push(<li key={`b${li}`}>{renderInline(bullet[2], `bi${li}`)}</li>);
      continue;
    }

    const num = NUM_RE.exec(line);
    if (num) {
      if (list && !list.ordered) flushList();
      if (!list) list = { ordered: true, items: [] };
      list.items.push(<li key={`n${li}`}>{renderInline(num[2], `ni${li}`)}</li>);
      continue;
    }

    flushList();
    const head = HEAD_RE.exec(line);
    if (head) {
      const lvl = head[1].length;
      const cls = lvl === 1 ? "text-base font-extrabold" : lvl === 2 ? "text-sm font-extrabold" : "text-xs font-extrabold uppercase tracking-wide";
      blocks.push(
        <p key={`h${li}`} className={`${cls} mb-1 mt-2 first:mt-0`} style={{ color: "var(--gc-text)" }}>
          {renderInline(head[2], `hi${li}`)}
        </p>
      );
      continue;
    }

    const quote = QUOTE_RE.exec(line);
    if (quote) {
      blocks.push(
        <blockquote key={`q${li}`} className="mb-1 border-l-2 pl-2 text-[0.8rem] italic" style={{ borderColor: "var(--gc-accent)", color: "var(--gc-text2)" }}>
          {renderInline(quote[1], `qi${li}`)}
        </blockquote>
      );
      continue;
    }

    blocks.push(
      <p key={`p${li}`} className="mb-1 whitespace-pre-wrap">{renderInline(line, `pi${li}`)}</p>
    );
  }
  flushList();

  return <div className="gc-md text-xs leading-relaxed">{blocks}</div>;
}

/** Toggle the `[ ]` / `[x]` marker on a given source line, returning the new text. */
export function toggleMarkdownCheckbox(source: string, lineIndex: number): string {
  const lines = (source || "").split(/\r?\n/);
  if (lineIndex < 0 || lineIndex >= lines.length) return source;
  const line = lines[lineIndex];
  if (/^(\s*)[-*]\s+\[ \]/.test(line)) lines[lineIndex] = line.replace(/\[ \]/, "[x]");
  else if (/^(\s*)[-*]\s+\[[xX]\]/.test(line)) lines[lineIndex] = line.replace(/\[[xX]\]/, "[ ]");
  return lines.join("\n");
}
