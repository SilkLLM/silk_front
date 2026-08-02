/**
 * DashboardLayout.tsx
 * The application shell: sidebar, topbar, and the global command palette.
 *
 * Two things changed structurally from the previous shell. The sidebar and
 * header are now painted from theme tokens rather than being permanently dark,
 * which is what made light mode read as broken. And the sidebar collapses to an
 * icon rail (persisted), so dense pages such as Model Control get their width
 * back.
 *
 * `fullBleed` hands the main area over to the page - the chat view manages its
 * own scrolling and needs the height.
 */

// File: silkllm-frontend/src/components/layout/DashboardLayout.tsx

import React, { useEffect, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { notificationsApi, trialApi } from "@/services/api";
import { prefetchPath } from "@/lib/prefetch";
import PaymentReminderModal from "@/components/PaymentReminderModal";
import CommandPalette from "@/components/CommandPalette";
import Logo from "@/components/Logo";
import InstallInvite, { OfflineBar, UpdateBar } from "@/components/AppInstall";
import { IconButton, Kbd, Menu, MenuItem, MenuLabel, MenuSeparator, Meter } from "@/components/ui";
import {
  LayoutDashboard, Key, CreditCard, BarChart2, MessageSquare, Coins,
  Settings, Bell, Users, Zap, PlusCircle, LogOut, Menu as MenuIcon, Store,
  SlidersHorizontal, ShieldCheck, Sun, Moon, Monitor, Gift, Search,
  PanelLeftClose, PanelLeftOpen, X, ChevronsUpDown, Wallet, BookOpen,
} from "lucide-react";
import clsx from "clsx";

interface NavItem { label: string; href: string; icon: React.ReactNode; end?: boolean }

const USER_NAV: NavItem[] = [
  { label: "Overview",     href: "/dashboard",              icon: <LayoutDashboard size={17} />, end: true },
  { label: "Chat",         href: "/dashboard/chat",         icon: <MessageSquare size={17} /> },
  { label: "Provider Hub", href: "/dashboard/provider-hub", icon: <Coins size={17} /> },
  { label: "API Keys",     href: "/dashboard/keys",         icon: <Key size={17} /> },
  { label: "Budgets",      href: "/dashboard/budgets",      icon: <Users size={17} /> },
  { label: "Promotions",   href: "/dashboard/promotions",   icon: <Gift size={17} /> },
  { label: "Billing",      href: "/dashboard/billing",      icon: <CreditCard size={17} /> },
  { label: "Usage",        href: "/dashboard/usage",        icon: <BarChart2 size={17} /> },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Providers",   href: "/admin/providers",   icon: <Zap size={17} /> },
  { label: "Models",      href: "/admin/models",      icon: <Settings size={17} /> },
  { label: "Marketplace", href: "/admin/marketplace", icon: <Store size={17} /> },
  { label: "Top-Ups",     href: "/admin/topups",      icon: <PlusCircle size={17} /> },
  { label: "Alerts",      href: "/admin/alerts",      icon: <ShieldCheck size={17} /> },
  { label: "Credits",     href: "/admin/credits",     icon: <Users size={17} /> },
  { label: "Promotions",  href: "/admin/promotions",  icon: <Gift size={17} /> },
  { label: "Settings",    href: "/admin/settings",    icon: <SlidersHorizontal size={17} /> },
];

/** Route to page title, used by the topbar so every page names itself the same way. */
const TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/dashboard/chat": "Chat",
  "/dashboard/provider-hub": "Provider Hub",
  "/dashboard/keys": "API Keys",
  "/dashboard/budgets": "Budgets & Webhooks",
  "/dashboard/promotions": "Promotions",
  "/dashboard/billing": "Billing",
  "/dashboard/usage": "Usage",
  "/dashboard/notifications": "Notifications",
  "/admin/providers": "Providers",
  "/admin/models": "Model Control",
  "/admin/marketplace": "Marketplace",
  "/admin/topups": "Top-Ups",
  "/admin/alerts": "Alerts",
  "/admin/credits": "Credits & Users",
  "/admin/promotions": "Promotions & Discounts",
  "/admin/settings": "Platform Settings",
};

const COLLAPSE_KEY = "silk_sidebar_collapsed";

/** Shortcut modifier as the platform names it, so the hint matches the keyboard. */
const SHORTCUT_KEY =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
    ? "Cmd"
    : "Ctrl";

// ── Sidebar pieces ──────────────────────────────────────────────────────────

function NavList({ items, collapsed, onNavigate }: {
  items: NavItem[]; collapsed: boolean; onNavigate?: () => void;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end={item.end}
          onClick={onNavigate}
          // Start fetching the page the moment a pointer lands on the link.
          // There is usually a few hundred milliseconds between hovering and
          // clicking, which is enough to have the bundle in hand by the time it
          // is needed. onFocus covers keyboard navigation, which otherwise gets
          // none of the benefit.
          onPointerEnter={() => prefetchPath(item.href)}
          onFocus={() => prefetchPath(item.href)}
          title={collapsed ? item.label : undefined}
          className={({ isActive }) => clsx(
            "relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
            collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 h-9",
            isActive
              ? "bg-accent/10 text-accent-ink"
              : "text-ink-2 hover:text-ink hover:bg-ink/[0.05]",
          )}
        >
          {({ isActive }) => (
            <>
              {isActive && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-accent" />
              )}
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="h-px bg-line mx-3 my-3" />;
  return (
    <p className="px-3 pt-5 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-3">
      {children}
    </p>
  );
}

/** Trial allowance, shown only while a trial is live. */
function TrialCard({ collapsed }: { collapsed: boolean }) {
  const { data: trial } = useQuery({
    queryKey: ["trial-status"],
    queryFn: () => trialApi.status().then((r) => r.data),
  });
  if (!trial?.active) return null;

  const remaining = trial.daily_remaining_usd ?? 0;
  const limit = trial.daily_limit_usd ?? 0;
  const pct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;
  const tone = pct <= 15 ? "danger" : pct <= 40 ? "warn" : "accent";

  if (collapsed) {
    return (
      <Link
        to="/dashboard/billing"
        title={`Free trial · ${trial.days_remaining}d left`}
        className="flex items-center justify-center h-10 w-10 mx-auto rounded-lg bg-accent/10 text-accent-ink hover:bg-accent/15 transition-colors"
      >
        <Gift size={17} />
      </Link>
    );
  }

  return (
    <Link
      to="/dashboard/billing"
      className="block rounded-xl border border-accent/25 bg-accent/[0.07] p-3 hover:bg-accent/10 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <Gift size={14} className="text-accent-ink shrink-0" />
        <span className="text-xs font-medium text-ink">Free trial</span>
        <span className="ml-auto text-2xs text-ink-3 num">{trial.days_remaining}d left</span>
      </div>
      <Meter value={pct} tone={tone as any} size="sm" />
      <p className="text-2xs text-ink-3 mt-1.5 num">
        ${remaining.toFixed(4)} of ${limit.toFixed(2)} left today
      </p>
    </Link>
  );
}

function UserCard({ collapsed }: { collapsed: boolean }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const initial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <Menu
      align="left"
      width={228}
      placement="top"
      trigger={({ toggle }) => (
        <button
          onClick={toggle}
          title={collapsed ? user?.name : undefined}
          className={clsx(
            "w-full flex items-center gap-2.5 rounded-lg transition-colors hover:bg-ink/[0.05]",
            collapsed ? "justify-center h-10" : "px-2 py-2",
          )}
        >
          <span className="w-7 h-7 rounded-full bg-accent text-on-accent text-xs font-semibold flex items-center justify-center shrink-0">
            {initial}
          </span>
          {!collapsed && (
            <>
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-xs font-medium text-ink truncate">{user?.name}</span>
                <span className="block text-2xs text-ink-3 truncate num">${(user?.balance ?? 0).toFixed(4)}</span>
              </span>
              <ChevronsUpDown size={14} className="text-ink-3 shrink-0" />
            </>
          )}
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuLabel>{user?.email}</MenuLabel>
          {isAdmin && (
            <div className="px-2.5 pb-1.5">
              <span className="badge-brand"><ShieldCheck size={10} /> Admin</span>
            </div>
          )}
          <MenuSeparator />
          <MenuItem icon={<Wallet size={15} />} onClick={() => { close(); navigate("/dashboard/billing"); }}>
            Billing & credits
          </MenuItem>
          <MenuItem icon={<Key size={15} />} onClick={() => { close(); navigate("/dashboard/keys"); }}>
            API keys
          </MenuItem>
          <MenuItem icon={<BookOpen size={15} />} onClick={() => { close(); window.open("/docs", "_blank"); }}>
            Documentation
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<LogOut size={15} />} tone="danger" onClick={() => { close(); logout(); }}>
            Sign out
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

// ── Topbar pieces ───────────────────────────────────────────────────────────

function NotificationBell() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => notificationsApi.unreadCount().then((r) => r.data.unread as number),
    refetchInterval: 30_000,
  });
  const unread = data || 0;
  return (
    <IconButton
      label={unread > 0 ? `${unread} unread notifications` : "Notifications"}
      onClick={() => navigate("/dashboard/notifications")}
      className="relative"
    >
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center num">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </IconButton>
  );
}

function ThemeMenu() {
  const { mode, resolved, setMode } = useTheme();
  const Icon = mode === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  return (
    <Menu
      width={170}
      trigger={({ toggle }) => (
        <IconButton label="Theme" onClick={toggle}><Icon size={18} /></IconButton>
      )}
    >
      {(close) => (
        <>
          {([
            ["light", "Light", <Sun size={15} key="l" />],
            ["dark", "Dark", <Moon size={15} key="d" />],
            ["system", "System", <Monitor size={15} key="s" />],
          ] as const).map(([value, label, icon]) => (
            <MenuItem
              key={value}
              icon={icon}
              onClick={() => { setMode(value); close(); }}
              className={mode === value ? "!text-accent-ink !bg-accent/10" : undefined}
            >
              {label}
            </MenuItem>
          ))}
        </>
      )}
    </Menu>
  );
}

/** Balance, always one click from topping up. */
function BalancePill() {
  const { user } = useAuth();
  const low = (user?.balance ?? 0) < 1;
  return (
    <Link
      to="/dashboard/billing"
      title="Credit balance"
      className={clsx(
        "hidden sm:inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-lg border text-xs font-medium transition-colors",
        low
          ? "border-warn/30 bg-warn/10 text-warn hover:bg-warn/15"
          : "border-line bg-surface text-ink-2 hover:text-ink hover:border-line-strong",
      )}
    >
      <Wallet size={14} className="shrink-0" />
      <span className="num">${(user?.balance ?? 0).toFixed(4)}</span>
      <span className="w-px h-4 bg-current opacity-20" />
      <PlusCircle size={14} className="shrink-0" />
    </Link>
  );
}

// ── Shell ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children, fullBleed }: {
  children: React.ReactNode;
  fullBleed?: boolean;
}) {
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });
  // Set when a newer build has been cached and is waiting to take over.
  const [updateWaiting, setUpdateWaiting] = useState(false);

  useEffect(() => {
    const onUpdate = () => setUpdateWaiting(true);
    window.addEventListener("silk:update-ready", onUpdate);
    return () => window.removeEventListener("silk:update-ready", onUpdate);
  }, []);

  const title = TITLES[pathname] || "Dashboard";

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* private mode */ }
  }, [collapsed]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawer(false); }, [pathname]);

  // Global shortcuts: Cmd/Ctrl+K opens the palette, Cmd/Ctrl+B toggles the rail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = (mobile = false) => {
    const isCollapsed = collapsed && !mobile;
    return (
      <div className="flex flex-col h-full">
        <div className={clsx("flex items-center h-14 shrink-0 border-b border-line", isCollapsed ? "justify-center px-2" : "px-4 gap-2")}>
          <Link to="/" className="flex items-center min-w-0" title="SilkLLM">
            <Logo size={28} showWord={!isCollapsed} wordClassName="text-[15px]" />
          </Link>
          {mobile && (
            <IconButton label="Close menu" size={32} className="ml-auto" onClick={() => setDrawer(false)}>
              <X size={17} />
            </IconButton>
          )}
        </div>

        <nav className={clsx("flex-1 overflow-y-auto py-3", isCollapsed ? "px-2" : "px-3")}>
          <NavList items={USER_NAV} collapsed={isCollapsed} onNavigate={mobile ? () => setDrawer(false) : undefined} />
          {isAdmin && (
            <>
              <SectionLabel collapsed={isCollapsed}>Admin</SectionLabel>
              <NavList items={ADMIN_NAV} collapsed={isCollapsed} onNavigate={mobile ? () => setDrawer(false) : undefined} />
            </>
          )}
        </nav>

        <div className={clsx("shrink-0 border-t border-line py-3 space-y-2", isCollapsed ? "px-2" : "px-3")}>
          <TrialCard collapsed={isCollapsed} />
          <UserCard collapsed={isCollapsed} />
        </div>
      </div>
    );
  };

  return (
    // app-shell tells globals.css to lock body scrolling: this is a fixed
    // height app whose panes scroll individually, not a scrolling document.
    // app-chrome stops the frame behaving like selectable text on touch.
    <div className="app-shell app-chrome flex h-[100dvh] bg-page text-ink overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          "hidden lg:flex flex-col shrink-0 bg-surface border-r border-line transition-[width] duration-200 pl-safe",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        {sidebar()}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={() => setDrawer(false)} />
          <aside className="relative w-[272px] max-w-[85%] h-full bg-surface border-r border-line shadow-overlay animate-slide-in-left pl-safe">
            {sidebar(true)}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Status bar inset. Installed on a notched phone the app draws under
            the system clock, so the topbar is pushed clear of it. */}
        <div className="h-safe-top shrink-0 bg-surface" />

        <OfflineBar />
        <UpdateBar visible={updateWaiting} />

        {/* Topbar */}
        <header className="h-14 shrink-0 flex items-center gap-2 px-3 sm:px-5 pr-safe bg-surface/85 backdrop-blur-md border-b border-line">
          <IconButton label="Open menu" className="lg:hidden" onClick={() => setDrawer(true)}>
            <MenuIcon size={19} />
          </IconButton>
          <IconButton
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </IconButton>

          <h1 className="text-sm font-semibold text-ink truncate">{title}</h1>

          <div className="flex-1" />

          {/* Command palette affordance - discoverable, not just a shortcut. */}
          <button
            onClick={() => setPalette(true)}
            className="hidden md:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-lg border border-line bg-sunken text-xs text-ink-3 hover:text-ink-2 hover:border-line-strong transition-colors w-[184px]"
          >
            <Search size={14} className="shrink-0" />
            <span className="flex-1 text-left">Search...</span>
            <Kbd>{SHORTCUT_KEY} K</Kbd>
          </button>
          <IconButton label="Search" className="md:hidden" onClick={() => setPalette(true)}>
            <Search size={18} />
          </IconButton>

          <BalancePill />
          <NotificationBell />
          <ThemeMenu />
        </header>

        {/* selectable puts text selection back for actual content, since the
            shell as a whole opts out of it. */}
        <main className={clsx("flex-1 min-h-0 selectable", fullBleed ? "overflow-hidden" : "overflow-y-auto")}>
          {fullBleed ? children : (
            <div className="gutter py-6 lg:py-8 pb-safe">
              <div className="mx-auto w-full max-w-[1180px] space-y-6">{children}</div>
            </div>
          )}
        </main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <PaymentReminderModal />
      <InstallInvite />
    </div>
  );
}

// EOF silkllm-frontend/src/components/layout/DashboardLayout.tsx
