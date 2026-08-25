/**
 * Prose.tsx
 * Shared long-form content primitives for the public marketing/docs pages -
 * code blocks, callouts, inline code pills, tables and paragraph rhythm.
 *
 * Extracted out of Docs.tsx, which used to define these locally: every new
 * public page (marketplace, api-key-controls, multimodal, alternatives,
 * guides) needed the exact same building blocks, and copy-pasting them per
 * page would have meant five places to fix the next time one needed a tweak.
 */

// File: silkllm-frontend/src/components/public/Prose.tsx

import React, { useState } from "react";
import clsx from "clsx";
import { Copy, CheckCircle } from "lucide-react";

// ── Lightweight syntax colorizer ─────────────────────────────────────────────
// Only comments are distinguished, which is the one thing that genuinely helps
// scanning. Colours come from tokens so it reads in both themes.
function colorize(line: string): React.ReactNode {
  const hash = line.indexOf("#");
  const slashes = line.indexOf("//");
  const idx = hash >= 0 ? hash : slashes;
  if (idx >= 0 && !line.slice(0, idx).includes('"')) {
    return (
      <>
        <span className="text-ink">{line.slice(0, idx)}</span>
        <span className="text-ink-3 italic">{line.slice(idx)}</span>
      </>
    );
  }
  return <span className="text-ink">{line}</span>;
}

export function CodeBlock({ code, lang = "python" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const label: Record<string, string> = { python: "Python", javascript: "JavaScript", bash: "Shell", http: "HTTP" };
  return (
    <div className="rounded-xl overflow-hidden border border-line bg-sunken my-3">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <span className="text-2xs font-mono text-ink-3">{label[lang] || lang}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 h-8 px-2 -mr-2 rounded text-2xs text-ink-3 hover:text-ink hover:bg-ink/[0.05] transition-colors"
        >
          {copied ? <><CheckCircle size={11} className="text-success" /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre className="p-4 sm:p-5 overflow-x-auto text-[13px] font-mono leading-7 m-0 text-ink">
        {code.split("\n").map((line, i) => (
          <div key={i}>{line ? colorize(line) : " "}</div>
        ))}
      </pre>
    </div>
  );
}

/** Python / JavaScript toggle over a pair of snippets. */
export function LangTabs({ python, javascript }: { python: string; javascript: string }) {
  const [lang, setLang] = useState<"python" | "javascript">("python");
  return (
    <div className="my-3">
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-sunken border border-line mb-2">
        {(["python", "javascript"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={clsx(
              "px-3 h-7 rounded-[7px] text-xs font-medium transition-all",
              lang === l ? "bg-surface text-ink shadow-xs" : "text-ink-2 hover:text-ink",
            )}
          >
            {l === "python" ? "Python" : "JavaScript"}
          </button>
        ))}
      </div>
      <CodeBlock code={lang === "python" ? python : javascript} lang={lang} />
    </div>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-[0.85em] font-mono px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink border border-line">
      {children}
    </code>
  );
}

export function Para({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-ink-2">{children}</p>;
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-2xs font-semibold uppercase tracking-wider mt-7 mb-3 text-ink-3">{children}</h3>;
}

export function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-line overflow-hidden my-4">
      <div className="scroll-x">
        <table className="table-shell">
          <thead>
            <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={j === 0 ? "font-mono text-xs text-accent-ink whitespace-nowrap" : "text-sm text-ink-2"}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3.5 my-4 text-sm leading-relaxed bg-accent/[0.07] border border-accent/25 text-ink-2">
      {children}
    </div>
  );
}

/** Centered hero for standalone marketing pages (marketplace, api-key-controls,
 *  multimodal, alternatives, guides). Landing.tsx's own Hero is bespoke and
 *  two-column; these pages are single-topic, so a simpler centered block reads
 *  better and keeps every one of them visually consistent with each other. */
export function PageHero({
  eyebrow, title, subtitle, cta,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  cta?: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl mx-auto text-center mb-14">
      {eyebrow && (
        <span className="inline-flex items-center h-8 px-3.5 rounded-full glass text-2xs font-medium text-accent-ink mb-6">
          {eyebrow}
        </span>
      )}
      <h1 className="font-display font-bold tracking-tight text-[2.25rem] sm:text-[3rem] leading-[1.08] text-ink">
        {title}
      </h1>
      {subtitle && <p className="text-base sm:text-lg text-ink-2 mt-5 leading-relaxed max-w-2xl mx-auto">{subtitle}</p>}
      {cta && <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">{cta}</div>}
    </div>
  );
}

/** Section heading used inside these pages' bodies - a real <h2>, since the
 *  Docs.tsx H3 helper above is an uppercase eyebrow label, not a heading. */
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-2xl sm:text-[1.75rem] font-bold tracking-tight text-ink mt-14 mb-4">
      {children}
    </h2>
  );
}

/** A single question/answer pair. Render a list of these, then pass the same
 *  data into an FAQPage JSON-LD block so markup and visible content always
 *  match - never emit FAQ structured data for text a visitor cannot see. */
export function FAQItem({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="py-5 border-b border-line last:border-0">
      <h3 className="text-sm sm:text-base font-semibold text-ink mb-2">{q}</h3>
      <p className="text-sm text-ink-2 leading-relaxed">{a}</p>
    </div>
  );
}
