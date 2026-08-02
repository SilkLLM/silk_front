/**
 * ui.tsx
 * The shared primitive kit. Every dashboard page is assembled from these, which
 * is what keeps spacing, density, focus rings and theming identical across the
 * user and admin sides instead of each page re-inventing them.
 *
 * Everything here is painted from the semantic tokens in globals.css, so no
 * component needs `dark:` variants to work in both themes.
 */

// File: silkllm-frontend/src/components/ui.tsx

import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Check, ChevronLeft, ChevronRight, Copy, Minus, Search, X } from "lucide-react";
import clsx from "clsx";

// ── Page scaffolding ────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, actions, meta }: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  /** Small badges/pills that sit under the title (counts, status). */
  meta?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="text-[1.375rem] sm:text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2 mt-1 max-w-2xl leading-relaxed">{subtitle}</p>}
        {meta && <div className="flex flex-wrap items-center gap-2 mt-3">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/** A titled panel. `flush` drops the padding for tables that bleed to the edge. */
export function Card({ title, description, icon, actions, footer, flush, className, children }: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  flush?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const hasHeader = title || description || actions;
  return (
    <section className={clsx("card overflow-hidden", className)}>
      {hasHeader && (
        <header className={clsx(
          "flex items-start justify-between gap-3 flex-wrap px-5 sm:px-6 pt-5",
          flush ? "pb-4 border-b border-line" : "pb-0",
        )}>
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                {icon && <span className="text-accent-ink">{icon}</span>}
                {title}
              </h2>
            )}
            {description && <p className="text-xs text-ink-2 mt-1 leading-relaxed">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={clsx(!flush && "px-5 sm:px-6 pb-5 sm:pb-6", !flush && hasHeader && "pt-4", !flush && !hasHeader && "pt-5 sm:pt-6")}>
        {children}
      </div>
      {footer && <div className="px-5 sm:px-6 py-3 border-t border-line bg-sunken">{footer}</div>}
    </section>
  );
}

/** Like Card but the body is edge-to-edge - for tables and lists. */
export function Panel({ title, description, icon, actions, footer, className, children }: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className={clsx("card overflow-hidden", className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 flex-wrap px-5 sm:px-6 py-4 border-b border-line">
          <div className="min-w-0">
            {title && (
              <h2 className="text-sm font-semibold text-ink flex items-center gap-2">
                {icon && <span className="text-accent-ink">{icon}</span>}
                {title}
              </h2>
            )}
            {description && <p className="text-xs text-ink-2 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      {children}
      {footer && <div className="px-5 sm:px-6 py-3 border-t border-line bg-sunken">{footer}</div>}
    </section>
  );
}

// ── Buttons ────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

// Tailwind only emits component classes it can see literally in the source, so
// variant/tone lookups are spelled out rather than built with a template string.
// Interpolating (`btn-${variant}`) silently ships a button with no styles.
const BUTTON_CLASS: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export const Button = React.forwardRef<HTMLButtonElement, {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { variant = "secondary", size = "md", icon, loading, className, children, disabled, ...rest }, ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        BUTTON_CLASS[variant],
        size === "sm" && "h-8 px-3 text-xs gap-1.5",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner size={size === "sm" ? 13 : 15} /> : icon}
      {children}
    </button>
  );
});

/** Square icon-only button with an accessible name. */
export function IconButton({ label, size = 36, active, tone = "default", className, children, ...rest }: {
  label: string;
  size?: number;
  active?: boolean;
  tone?: "default" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      title={label}
      aria-label={label}
      className={clsx(
        "inline-flex items-center justify-center rounded-lg transition-colors shrink-0",
        "disabled:opacity-40 disabled:pointer-events-none",
        tone === "danger"
          ? "text-ink-3 hover:text-danger hover:bg-danger/10"
          : active
            ? "text-accent-ink bg-accent/10"
            : "text-ink-2 hover:text-ink hover:bg-ink/[0.06]",
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function CopyButton({ value, label = "Copy", size = 36 }: { value: string; label?: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      label={copied ? "Copied" : label}
      size={size}
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />}
    </IconButton>
  );
}

// ── Form controls ──────────────────────────────────────────────────────────

export function Field({ label, hint, error, required, htmlFor, children, className }: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx("min-w-0", className)}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-medium text-ink-2 mb-1.5">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error
        ? <p className="text-xs text-danger mt-1.5">{error}</p>
        : hint && <p className="text-xs text-ink-3 mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={clsx("input", className)} {...rest} />;
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return <select ref={ref} className={clsx("input", className)} {...rest}>{children}</select>;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={clsx("input", className)} {...rest} />;
  },
);

export function SearchInput({ value, onChange, placeholder = "Search", className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={clsx("relative", className)}>
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
      <input
        type="search"
        className="input pl-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

/**
 * A switch that says what it is and what it is doing.
 *
 * The bare track used previously gave no clue what it controlled or which side
 * meant "on", and it did not move until the server answered, so a click read as
 * "nothing happened". This renders the state as words next to the track and
 * shows a pending tick while a request is in flight.
 */
export function Switch({
  checked, onChange, label, stateLabels, disabled, pending, tone = "accent", size = "md",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Accessible name. Also the visible text when `stateLabels` is not used. */
  label?: string;
  /** Words shown beside the track, e.g. ["Enabled", "Disabled"]. */
  stateLabels?: [string, string];
  disabled?: boolean;
  pending?: boolean;
  tone?: "accent" | "danger" | "success";
  size?: "sm" | "md";
}) {
  // Geometry is computed from three numbers rather than written out as utility
  // classes, so the travel distance cannot disagree with the track width. The
  // knob is inset by GAP on both ends, so its travel is width - knob - 2*GAP.
  const GAP = 3;
  const { w, h } = size === "sm" ? { w: 34, h: 20 } : { w: 40, h: 24 };
  const knobSize = h - GAP * 2;
  const travel = w - knobSize - GAP * 2;

  const onColour = { accent: "bg-accent", danger: "bg-danger", success: "bg-success" }[tone];

  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      onClick={() => onChange(!checked)}
      style={{ width: w, height: h }}
      className={clsx(
        // p-0 and border-0 matter: a button carries default padding and border,
        // and the knob is positioned against the padding box, so without them
        // the "on" position pushed the knob clear of the track.
        "relative rounded-full shrink-0 p-0 border-0 overflow-hidden",
        "transition-colors duration-150 disabled:cursor-not-allowed",
        pending && "opacity-70",
        (disabled && !pending) && "opacity-40",
        checked ? onColour : "bg-line-strong hover:bg-ink-3/60",
      )}
    >
      <span
        className="absolute rounded-full bg-white shadow-xs transition-transform duration-150 ease-out"
        style={{
          width: knobSize,
          height: knobSize,
          top: GAP,
          left: GAP,
          transform: `translateX(${checked ? travel : 0}px)`,
        }}
      />
    </button>
  );

  if (!stateLabels) return control;

  return (
    <span className="inline-flex items-center gap-2.5">
      {control}
      <span
        className={clsx(
          "text-xs font-medium tabular-nums whitespace-nowrap",
          pending ? "text-ink-3" : checked ? "text-ink" : "text-ink-3",
        )}
      >
        {pending ? "Saving" : checked ? stateLabels[0] : stateLabels[1]}
      </span>
    </span>
  );
}

/**
 * A switch presented as a labelled row: name, one line of explanation, control.
 * Use this anywhere the switch is not already sitting under a column header.
 */
export function ToggleField({
  checked, onChange, title, description, stateLabels, pending, disabled, tone = "accent",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  description?: React.ReactNode;
  stateLabels?: [string, string];
  pending?: boolean;
  disabled?: boolean;
  tone?: "accent" | "danger" | "success";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        label={title}
        stateLabels={stateLabels}
        pending={pending}
        disabled={disabled}
        tone={tone}
      />
    </div>
  );
}

export function Checkbox({ checked, onChange, label, hint, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: React.ReactNode; hint?: React.ReactNode; disabled?: boolean;
}) {
  const id = useId();
  return (
    <label htmlFor={id} className={clsx("flex items-start gap-2.5 cursor-pointer group", disabled && "opacity-50 cursor-not-allowed")}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-line-strong shrink-0 cursor-pointer"
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink leading-snug">{label}</span>
        {hint && <span className="block text-xs text-ink-3 mt-0.5 leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

// ── Navigation & filtering ─────────────────────────────────────────────────

/** Pill-group filter. One row above the content it filters. */
export function SegmentedControl<T extends string>({ options, value, onChange, size = "md" }: {
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-sunken border border-line">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-[7px] font-medium transition-all whitespace-nowrap",
            size === "sm" ? "px-2.5 h-7 text-xs" : "px-3 h-8 text-sm",
            value === o.value
              ? "bg-surface text-ink shadow-xs"
              : "text-ink-2 hover:text-ink",
          )}
        >
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

/** Underlined tabs, for switching between views of a page. */
export function Tabs<T extends string>({ tabs, value, onChange }: {
  tabs: { value: T; label: React.ReactNode; icon?: React.ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-line overflow-x-auto scroll-x">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            "inline-flex items-center gap-2 px-3 pb-2.5 pt-1 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
            value === t.value
              ? "border-accent text-ink"
              : "border-transparent text-ink-2 hover:text-ink hover:border-line-strong",
          )}
        >
          {t.icon}{t.label}
          {t.count !== undefined && (
            <span className={clsx(
              "px-1.5 py-0.5 rounded text-2xs num",
              value === t.value ? "bg-accent/12 text-accent-ink" : "bg-ink/[0.06] text-ink-3",
            )}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** A one-row toolbar for the filters that sit above a table or chart. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}

export function Pagination({ page, totalPages, total, onPage, unit = "records" }: {
  page: number; totalPages?: number; total?: number; onPage: (p: number) => void; unit?: string;
}) {
  const atEnd = totalPages !== undefined && page >= totalPages;
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-xs text-ink-3 num">
        Page {page}{totalPages ? ` of ${totalPages}` : ""}
        {total !== undefined && ` · ${total.toLocaleString()} ${unit}`}
      </p>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} icon={<ChevronLeft size={14} />}>
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={atEnd} onClick={() => onPage(page + 1)}>
          Next <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

// ── Display ────────────────────────────────────────────────────────────────

export type BadgeTone = "neutral" | "info" | "brand" | "success" | "warning" | "error";

// Spelled out for the same reason as BUTTON_CLASS - a template string here would
// be purged from the stylesheet and render an unstyled badge.
const BADGE_CLASS: Record<BadgeTone, string> = {
  neutral: "badge-neutral",
  info: "badge-info",
  brand: "badge-brand",
  success: "badge-success",
  warning: "badge-warning",
  error: "badge-error",
};

export function Badge({ children, tone = "neutral", icon }: {
  children: React.ReactNode; tone?: BadgeTone; icon?: React.ReactNode;
}) {
  return <span className={BADGE_CLASS[tone]}>{icon}{children}</span>;
}

/** Status dot + label. Meaning never rides on colour alone. */
export function StatusDot({ tone, label }: { tone: "success" | "warning" | "error" | "neutral"; label: string }) {
  const colour = {
    success: "bg-success", warning: "bg-warn", error: "bg-danger", neutral: "bg-ink-3",
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", colour)} />
      {label}
    </span>
  );
}

/**
 * Stat tile: label, value, optional signed delta and sparkline.
 * The value uses proportional figures - tabular-nums makes large standalone
 * numbers look loose, so it is reserved for table columns.
 */
export function StatTile({ label, value, icon, delta, deltaLabel, deltaGood = "up", hint, accent, to, spark }: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  delta?: number;
  deltaLabel?: string;
  deltaGood?: "up" | "down";
  hint?: React.ReactNode;
  accent?: boolean;
  to?: React.ReactNode;
  spark?: number[];
}) {
  const positive = (delta ?? 0) > 0;
  const good = delta === undefined || delta === 0 ? null : (positive === (deltaGood === "up"));

  return (
    <div className="card card-pad flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-2">
        {icon && <span className="text-ink-3">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <p className={clsx("text-[1.75rem] leading-none font-semibold tracking-tight", accent ? "text-accent-ink" : "text-ink")}>
        {value}
      </p>
      {spark && spark.length > 1 && <Sparkline values={spark} />}
      {(delta !== undefined || hint) && (
        <div className="flex items-center gap-2 flex-wrap">
          {delta !== undefined && (
            <span className={clsx(
              "inline-flex items-center gap-1 text-xs font-medium num",
              good === null ? "text-ink-3" : good ? "text-success" : "text-danger",
            )}>
              {positive ? <ArrowUp size={12} /> : delta < 0 ? <ArrowDown size={12} /> : <Minus size={12} />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
          {(deltaLabel || hint) && <span className="text-xs text-ink-3">{deltaLabel || hint}</span>}
        </div>
      )}
      {to}
    </div>
  );
}

/** 12-point sparkline in the de-emphasis hue. Decorative support for the value. */
export function Sparkline({ values, height = 28 }: { values: number[]; height?: number }) {
  const pts = values.slice(-12);
  if (pts.length < 2) return null;
  const max = Math.max(...pts), min = Math.min(...pts);
  const span = max - min || 1;
  const w = 100;
  const step = w / (pts.length - 1);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(2)}`).join(" ");
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden="true" className="text-accent">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={0.85} />
    </svg>
  );
}

/**
 * Meter: the fill carries severity, the track is a lighter step of the same
 * ramp so the state reads across the whole bar.
 */
export function Meter({ value, max = 100, tone = "accent", size = "md" }: {
  value: number; max?: number; tone?: "accent" | "success" | "warn" | "danger"; size?: "sm" | "md";
}) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const fill = { accent: "bg-accent", success: "bg-success", warn: "bg-warn", danger: "bg-danger" }[tone];
  const track = { accent: "bg-accent/15", success: "bg-success/15", warn: "bg-warn/15", danger: "bg-danger/15" }[tone];
  return (
    <div className={clsx("w-full rounded-full overflow-hidden", track, size === "sm" ? "h-1.5" : "h-2")}>
      <div className={clsx("h-full rounded-full transition-all duration-500", fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: {
  icon?: React.ReactNode; title: string; hint?: string; action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      {icon && (
        <div className="w-11 h-11 rounded-xl bg-ink/[0.04] border border-line flex items-center justify-center mx-auto mb-3 text-ink-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="text-xs text-ink-3 mt-1.5 max-w-sm mx-auto leading-relaxed">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={clsx("animate-shimmer rounded-lg bg-ink/[0.07]", className)} />;
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      className={clsx("inline-block border-2 border-current border-t-transparent rounded-full animate-spin shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

/** Full-panel loading state that matches the shape of what is coming. */
export function LoadingRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx("space-y-2.5 p-5", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11" />
      ))}
    </div>
  );
}

/** An inline explanatory note. Tone is carried by an icon + text, not colour alone. */
export function Callout({ tone = "info", icon, title, children }: {
  tone?: "info" | "brand" | "warning" | "danger";
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const styles = {
    info:    "bg-ink/[0.03] border-line",
    brand:   "bg-accent/[0.07] border-accent/25",
    warning: "bg-warn/[0.08] border-warn/25",
    danger:  "bg-danger/[0.07] border-danger/25",
  }[tone];
  const iconColour = {
    info: "text-ink-3", brand: "text-accent-ink", warning: "text-warn", danger: "text-danger",
  }[tone];
  return (
    <div className={clsx("rounded-xl border px-4 py-3.5 flex items-start gap-3", styles)}>
      {icon && <span className={clsx("shrink-0 mt-0.5", iconColour)}>{icon}</span>}
      <div className="min-w-0 text-sm">
        {title && <p className="font-medium text-ink mb-1">{title}</p>}
        <div className="text-ink-2 leading-relaxed space-y-1.5 text-xs sm:text-sm">{children}</div>
      </div>
    </div>
  );
}

// ── Overlays ───────────────────────────────────────────────────────────────

/** Modal dialog: portalled, esc-to-close, scroll-locked, focus moved inside. */
export function Modal({ open, onClose, title, description, icon, footer, size = "md", children }: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  children?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const width = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" }[size];

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={clsx(
          "relative w-full bg-raised border border-line shadow-overlay outline-none animate-slide-up",
          "rounded-t-2xl sm:rounded-2xl max-h-[92vh] flex flex-col",
          width,
        )}
      >
        <header className="flex items-start gap-3 px-5 sm:px-6 pt-5 pb-4">
          {icon && (
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 text-accent-ink">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="text-xs text-ink-2 mt-1 leading-relaxed">{description}</p>}
          </div>
          <IconButton label="Close" size={32} onClick={onClose}><X size={16} /></IconButton>
        </header>
        <div className="px-5 sm:px-6 pb-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 px-5 sm:px-6 py-4 border-t border-line bg-sunken sm:rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Destructive-action confirm. Replaces window.confirm so it matches the theme. */
export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel = "Delete", pending }: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  pending?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={pending} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2 leading-relaxed">{body}</p>
    </Modal>
  );
}

/** Dropdown anchored to a trigger, closing on outside click or escape. */
export function Menu({ trigger, children, align = "right", width = 220 }: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={clsx(
            "absolute top-[calc(100%+6px)] z-50 rounded-xl border border-line bg-raised shadow-overlay p-1.5 animate-scale-in origin-top",
            align === "right" ? "right-0" : "left-0",
          )}
          style={{ width }}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, children, tone = "default", className, ...rest }: {
  icon?: React.ReactNode;
  tone?: "default" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-left transition-colors",
        tone === "danger" ? "text-danger hover:bg-danger/10" : "text-ink-2 hover:text-ink hover:bg-ink/[0.06]",
        className,
      )}
      {...rest}
    >
      {icon && <span className="shrink-0 opacity-80">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 pt-1.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-ink-3">{children}</p>;
}

export function MenuSeparator() {
  return <div className="my-1.5 h-px bg-line" />;
}

/** Keyboard hint, e.g. Cmd K. */
export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-line bg-sunken text-[10px] font-medium text-ink-3 font-sans">
      {children}
    </kbd>
  );
}

// EOF silkllm-frontend/src/components/ui.tsx
