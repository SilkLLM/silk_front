/**
 * CommandPalette.tsx
 * Cmd/Ctrl+K launcher. Every destination and quick action in one searchable
 * list, so navigating never depends on finding the right sidebar item.
 *
 * Opened globally by the shell; also reachable from the topbar search affordance.
 */

// File: silkllm-frontend/src/components/CommandPalette.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  BarChart2, Bell, BookOpen, CreditCard, Coins, Key, LayoutDashboard, LogOut,
  MessageSquare, Monitor, Moon, PlusCircle, Search, Settings, ShieldCheck,
  SlidersHorizontal, Store, Sun, Users, Zap, CornerDownLeft, Wallet,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { Kbd } from "@/components/ui";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: React.ReactNode;
  keywords?: string;
  run: () => void;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { isAdmin, logout } = useAuth();
  const { setMode } = useTheme();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo<Command[]>(() => {
    const go = (to: string) => () => { navigate(to); onClose(); };
    const theme = (m: ThemeMode) => () => { setMode(m); onClose(); };

    const items: Command[] = [
      { id: "overview",  group: "Go to", label: "Overview",      icon: <LayoutDashboard size={16} />, keywords: "home dashboard", run: go("/dashboard") },
      { id: "chat",      group: "Go to", label: "Chat",          icon: <MessageSquare size={16} />,   keywords: "playground prompt", run: go("/dashboard/chat") },
      { id: "hub",       group: "Go to", label: "Provider Hub",  icon: <Coins size={16} />,           keywords: "byok earn deposit key", run: go("/dashboard/provider-hub") },
      { id: "keys",      group: "Go to", label: "API Keys",      icon: <Key size={16} />,             keywords: "token secret", run: go("/dashboard/keys") },
      { id: "billing",   group: "Go to", label: "Billing",       icon: <CreditCard size={16} />,      keywords: "credits payment paystack dodo flutterwave", run: go("/dashboard/billing") },
      { id: "usage",     group: "Go to", label: "Usage",         icon: <BarChart2 size={16} />,       keywords: "logs spend history", run: go("/dashboard/usage") },
      { id: "notifs",    group: "Go to", label: "Notifications", icon: <Bell size={16} />,            keywords: "inbox alerts", run: go("/dashboard/notifications") },

      { id: "add-credits", group: "Actions", label: "Add credits",     icon: <PlusCircle size={16} />, keywords: "top up buy", run: go("/dashboard/billing") },
      { id: "new-key",     group: "Actions", label: "Create API key",  icon: <Key size={16} />,        keywords: "generate", run: go("/dashboard/keys") },
      { id: "docs",        group: "Actions", label: "Open documentation", icon: <BookOpen size={16} />, keywords: "api reference guide", run: () => { window.open("/docs", "_blank"); onClose(); } },

      { id: "theme-light",  group: "Theme", label: "Light theme",   icon: <Sun size={16} />,     run: theme("light") },
      { id: "theme-dark",   group: "Theme", label: "Dark theme",    icon: <Moon size={16} />,    run: theme("dark") },
      { id: "theme-system", group: "Theme", label: "Match system",  icon: <Monitor size={16} />, run: theme("system") },

      { id: "logout", group: "Account", label: "Sign out", icon: <LogOut size={16} />, run: () => { onClose(); logout(); } },
    ];

    if (isAdmin) {
      items.splice(7, 0,
        { id: "a-providers",   group: "Admin", label: "Providers",         icon: <Zap size={16} />,              run: go("/admin/providers") },
        { id: "a-payment-providers", group: "Admin", label: "Payment Providers", icon: <Wallet size={16} />,     keywords: "paystack dodo flutterwave checkout rails", run: go("/admin/payment-providers") },
        { id: "a-models",      group: "Admin", label: "Model Control",     icon: <Settings size={16} />,         keywords: "pricing routing fallback", run: go("/admin/models") },
        { id: "a-marketplace", group: "Admin", label: "Marketplace",       icon: <Store size={16} />,            run: go("/admin/marketplace") },
        { id: "a-topups",      group: "Admin", label: "Top-Ups",           icon: <PlusCircle size={16} />,       run: go("/admin/topups") },
        { id: "a-alerts",      group: "Admin", label: "Alerts",            icon: <ShieldCheck size={16} />,      run: go("/admin/alerts") },
        { id: "a-credits",     group: "Admin", label: "Credits & Users",   icon: <Users size={16} />,            keywords: "ledger refund", run: go("/admin/credits") },
        { id: "a-settings",    group: "Admin", label: "Platform Settings", icon: <SlidersHorizontal size={16} />, keywords: "markup trial killswitch", run: go("/admin/settings") },
      );
    }
    return items;
  }, [isAdmin, navigate, onClose, setMode, logout]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => `${c.label} ${c.group} ${c.keywords || ""}`.toLowerCase().includes(q));
  }, [commands, query]);

  // Reset each time the palette is opened.
  useEffect(() => {
    if (open) { setQuery(""); setCursor(0); setTimeout(() => inputRef.current?.focus(), 20); }
  }, [open]);

  useEffect(() => { setCursor(0); }, [query]);

  // Keep the highlighted row in view as the cursor moves.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
      if (e.key === "Enter")     { e.preventDefault(); results[cursor]?.run(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, results, cursor, onClose]);

  if (!open || typeof document === "undefined") return null;

  // Group headings are emitted inline while walking the flat result list, so the
  // keyboard cursor indexes stay aligned with what is rendered.
  let lastGroup = "";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl rounded-2xl border border-line bg-raised shadow-overlay overflow-hidden animate-slide-up"
      >
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Search size={17} className="text-ink-3 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages and actions..."
            className="flex-1 bg-transparent h-14 text-sm text-ink placeholder:text-ink-3 outline-none"
          />
          <Kbd>esc</Kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="text-sm text-ink-3 text-center py-10">No matches for "{query}".</p>
          ) : (
            results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <React.Fragment key={c.id}>
                  {header && (
                    <p className="px-2.5 pt-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-3">{header}</p>
                  )}
                  <button
                    data-idx={i}
                    onMouseEnter={() => setCursor(i)}
                    onClick={c.run}
                    className={clsx(
                      "w-full flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm text-left transition-colors",
                      i === cursor ? "bg-accent/10 text-ink" : "text-ink-2",
                    )}
                  >
                    <span className={clsx("shrink-0", i === cursor ? "text-accent-ink" : "text-ink-3")}>{c.icon}</span>
                    <span className="flex-1 truncate">{c.label}</span>
                    {i === cursor && <CornerDownLeft size={14} className="text-ink-3 shrink-0" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-line bg-sunken text-2xs text-ink-3">
          <span className="inline-flex items-center gap-1.5"><Kbd>Up</Kbd><Kbd>Down</Kbd> navigate</span>
          <span className="inline-flex items-center gap-1.5"><Kbd>Enter</Kbd> open</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// EOF silkllm-frontend/src/components/CommandPalette.tsx
