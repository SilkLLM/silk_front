/**
 * Markdown.tsx
 * A tiny, dependency-free markdown renderer for chat messages. Handles fenced
 * code blocks (with a copy button), inline code, bold, italic, headings, lists,
 * links, and media attachments (images, audio, video, and generic files) with a
 * download button on each. Renders React elements only (no dangerouslySetInnerHTML),
 * so it is safe.
 */

// File: silkllm-frontend/src/components/Markdown.tsx

import React, { useState } from "react";
import { Copy, Check, Download, FileDown, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";

// ── Download helpers ─────────────────────────────────────────────────────────

async function downloadUrl(url: string, filename: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(obj);
    toast.success("Download started");
  } catch {
    // Cross-origin or opaque response: fall back to opening in a new tab.
    window.open(url, "_blank", "noopener");
  }
}

function filenameFor(url: string, kind: string): string {
  if (url.startsWith("data:")) {
    const ext = (url.slice(5).split(";")[0].split("/")[1] || "bin").split("+")[0];
    return `silkllm-${kind}.${ext}`;
  }
  try {
    const clean = url.split("?")[0].split("#")[0];
    const base = clean.substring(clean.lastIndexOf("/") + 1);
    return base || `silkllm-${kind}`;
  } catch {
    return `silkllm-${kind}`;
  }
}

type MediaKind = "image" | "audio" | "video" | "file";

function mediaKind(url: string): MediaKind | null {
  const u = url.split("?")[0].split("#")[0].toLowerCase();
  if (u.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/.test(u)) return "image";
  if (u.startsWith("data:audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/.test(u)) return "audio";
  if (u.startsWith("data:video/") || /\.(mp4|webm|mov|mkv|m4v)$/.test(u)) return "video";
  if (/\.(pdf|zip|csv|json|txt|docx?|xlsx?|pptx?|md|tar|gz)$/.test(u)) return "file";
  return null;
}

// ── Media attachment (image / audio / video / generic file) ──────────────────

function MediaAttachment({ url, kind, alt }: { url: string; kind: MediaKind; alt?: string }) {
  const name = filenameFor(url, kind);
  const DownloadBtn = (
    <button
      onClick={() => downloadUrl(url, name)}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-black/30 text-cloud-grey hover:bg-black/50 hover:text-silk-gold transition-colors"
      title="Download"
    >
      <Download size={13} /> Download
    </button>
  );

  if (kind === "image") {
    return (
      <div className="my-2 group/media relative inline-block max-w-full">
        <img src={url} alt={alt || "attachment"} loading="lazy"
          className="rounded-xl max-w-full max-h-96 object-contain border border-muted-metal/30" />
        <div className="absolute top-2 right-2 opacity-0 group-hover/media:opacity-100 transition-opacity">
          {DownloadBtn}
        </div>
      </div>
    );
  }
  if (kind === "audio") {
    return (
      <div className="my-2 flex items-center gap-2 flex-wrap">
        <audio controls src={url} className="max-w-full h-10" />
        {DownloadBtn}
      </div>
    );
  }
  if (kind === "video") {
    return (
      <div className="my-2">
        <video controls src={url} className="rounded-xl max-w-full max-h-96 border border-muted-metal/30" />
        <div className="mt-1.5">{DownloadBtn}</div>
      </div>
    );
  }
  // Generic downloadable file
  return (
    <div className="my-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-cloud-grey dark:bg-deep-charcoal border border-muted-metal/30 max-w-full">
      <FileDown size={16} className="text-silk-gold shrink-0" />
      <span className="text-xs font-mono truncate flex-1 min-w-0">{name}</span>
      <button onClick={() => downloadUrl(url, name)}
        className="text-warm-grey hover:text-silk-gold shrink-0" title="Download">
        <Download size={15} />
      </button>
    </div>
  );
}

// ── Inline formatting: code, bold, italic, links ─────────────────────────────

function renderInline(text: string, keyBase: string): React.ReactNode[] {
  // Split on `code`, [text](url), **bold**, *italic* while keeping delimiters.
  const tokens = text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g);
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
    const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const label = link[1];
      const href = link[2];
      return (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer"
          className="text-silk-gold hover:underline inline-flex items-center gap-0.5 break-all">
          {label}<ExternalLink size={11} className="shrink-0" />
        </a>
      );
    }
    if (tok.startsWith("**") && tok.endsWith("**")) return <strong key={k}>{tok.slice(2, -2)}</strong>;
    if (tok.startsWith("*") && tok.endsWith("*")) return <em key={k}>{tok.slice(1, -1)}</em>;
    return <React.Fragment key={k}>{tok}</React.Fragment>;
  });
}

// ── Fenced code block with copy ──────────────────────────────────────────────

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="my-2 rounded-lg overflow-hidden" style={{ border: "1px solid #1E2022" }}>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ background: "#111314" }}>
        <span className="text-[11px] font-mono text-warm-grey">{lang || "code"}</span>
        <button onClick={copy} className="text-warm-grey hover:text-silk-gold inline-flex items-center gap-1 text-[11px]">
          {copied ? <><Check size={12} /> Copied</> : <><Copy size={13} /> Copy</>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-xs font-mono leading-relaxed" style={{ background: "#0D0E0F", color: "#C2C9CC", margin: 0 }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// A line that is nothing but a media/file reference, so it can be lifted out of
// the text flow and rendered as a real attachment.
function lineAsMedia(line: string, key: string): React.ReactNode | null {
  const t = line.trim();
  // Markdown image: ![alt](url)
  const img = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (img) return <MediaAttachment key={key} url={img[2]} kind="image" alt={img[1]} />;
  // Bare link to a media/file: [text](url) or a naked URL
  const link = t.match(/^\[[^\]]*\]\(([^)]+)\)$/);
  const bare = /^(https?:\/\/\S+|data:[^ ]+)$/.test(t) ? t : null;
  const url = link ? link[1] : bare;
  if (url) {
    const kind = mediaKind(url);
    if (kind) return <MediaAttachment key={key} url={url} kind={kind} />;
  }
  return null;
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
          // Standalone media / downloadable file on its own line.
          const media = lineAsMedia(line, `${key}-media`);
          if (media) { flushList(`${key}-ul`); out.push(media); return; }
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
        return <div key={si} className="whitespace-pre-wrap break-words">{out}</div>;
      })}
    </div>
  );
}

// EOF silkllm-frontend/src/components/Markdown.tsx
