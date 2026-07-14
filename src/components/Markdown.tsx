/**
 * Markdown.tsx
 * A tiny, dependency-free markdown renderer for chat messages. Handles fenced
 * code blocks (with a copy button), inline code, bold, italic, headings, and
 * lists. Renders React elements only (no dangerouslySetInnerHTML), so it is safe.
 */

// File: silkllm-frontend/src/components/Markdown.tsx

import React from "react";
import { Copy } from "lucide-react";
import toast from "react-hot-toast";

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on `code`, **bold**, *italic* while keeping delimiters.
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.filter(Boolean).map((tok, i) => {
    const k = `${keyBase}-${i}`;
    if (tok.startsWith("`") && tok.endsWith("`")) {
      return (
        <code key={k} className="px-1 py-0.5 rounded font-mono text-[0.85em]"
          style={{ background: "#00000022", color: "#D29A2D" }}>
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith("**") && tok.endsWith("**")) return <strong key={k}>{tok.slice(2, -2)}</strong>;
    if (tok.startsWith("*") && tok.endsWith("*")) return <em key={k}>{tok.slice(1, -1)}</em>;
    return <React.Fragment key={k}>{tok}</React.Fragment>;
  });
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  return (
    <div className="my-2 rounded-lg overflow-hidden" style={{ border: "1px solid #1E2022" }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#111314" }}>
        <span className="text-[11px] font-mono text-warm-grey">{lang || "code"}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); toast.success("Copied"); }}
          className="text-warm-grey hover:text-silk-gold"
        >
          <Copy size={13} />
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed" style={{ background: "#0D0E0F", color: "#C2C9CC", margin: 0 }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function Markdown({ text }: { text: string }) {
  // Split into code and non-code segments.
  const segments = text.split(/(```[\s\S]*?```)/g).filter((s) => s !== "");
  return (
    <div className="space-y-1">
      {segments.map((seg, si) => {
        if (seg.startsWith("```")) {
          const m = seg.match(/^```(\w*)\n?([\s\S]*?)```$/);
          const lang = m?.[1] || "";
          const code = (m?.[2] || "").replace(/\n$/, "");
          return <CodeBlock key={si} code={code} lang={lang} />;
        }
        const lines = seg.split("\n");
        const out: React.ReactNode[] = [];
        let list: React.ReactNode[] = [];
        const flushList = (key: string) => {
          if (list.length) {
            out.push(<ul key={key} className="list-disc pl-5 space-y-0.5">{list}</ul>);
            list = [];
          }
        };
        lines.forEach((line, li) => {
          const key = `${si}-${li}`;
          if (/^\s*[-*]\s+/.test(line)) {
            list.push(<li key={key}>{renderInline(line.replace(/^\s*[-*]\s+/, ""), key)}</li>);
            return;
          }
          flushList(`${key}-ul`);
          if (/^#{1,3}\s+/.test(line)) {
            out.push(<p key={key} className="font-semibold">{renderInline(line.replace(/^#{1,3}\s+/, ""), key)}</p>);
          } else if (line.trim() === "") {
            // skip empty lines (spacing handled by container)
          } else {
            out.push(<p key={key}>{renderInline(line, key)}</p>);
          }
        });
        flushList(`${si}-ul-end`);
        return <div key={si} className="whitespace-pre-wrap">{out}</div>;
      })}
    </div>
  );
}

// EOF silkllm-frontend/src/components/Markdown.tsx
