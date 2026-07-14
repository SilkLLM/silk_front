/**
 * ui.tsx
 * A small set of shared UI primitives so pages stay consistent and mobile-safe.
 * These sit on top of the globals.css `.card` / `.btn-*` / `.badge-*` classes.
 */

// File: silkllm-frontend/src/components/ui.tsx

import React from "react";

export function PageHeader({ title, subtitle, icon, actions }: {
  title: string; subtitle?: string; icon?: React.ReactNode; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey flex items-center gap-2">
          {icon}{title}
        </h1>
        {subtitle && <p className="text-warm-grey mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatTile({ label, value, icon, accent }: {
  label: string; value: React.ReactNode; icon?: React.ReactNode; accent?: boolean;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-xs text-warm-grey uppercase tracking-wide">{icon}{label}</div>
      <p className={`text-2xl font-bold mt-1 ${accent ? "text-silk-gold" : "text-deep-charcoal dark:text-cloud-grey"}`}>{value}</p>
    </div>
  );
}

export function Badge({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "success" | "warning" | "error" }) {
  return <span className={`badge-${tone}`}>{children}</span>;
}

export function EmptyState({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="text-center py-10">
      {icon && <div className="text-muted-metal flex justify-center mb-3">{icon}</div>}
      <p className="text-warm-grey text-sm">{title}</p>
      {hint && <p className="text-xs text-muted-metal mt-1">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-cloud-grey dark:bg-deep-charcoal ${className}`} />;
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div
      className="border-2 border-silk-gold border-t-transparent rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
  );
}

// EOF silkllm-frontend/src/components/ui.tsx
