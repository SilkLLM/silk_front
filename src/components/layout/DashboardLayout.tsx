/**
 * DashboardLayout.tsx
 * Shared sidebar layout for both user and admin dashboards.
 * Responsive: sidebar collapses to a sheet on mobile. Includes a theme toggle
 * and a notifications bell with an unread badge.
 */

// File: silkllm-frontend/src/components/layout/DashboardLayout.tsx

import React, { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { notificationsApi, trialApi } from "@/services/api";
import PaymentReminderModal from "@/components/PaymentReminderModal";
import {
  LayoutDashboard, Key, CreditCard, BarChart2, MessageSquare, Coins,
  Settings, Bell, Users, Zap, PlusCircle, LogOut, Menu, Store,
  SlidersHorizontal, ShieldCheck, Sun, Moon, Gift,
} from "lucide-react";
import clsx from "clsx";

interface NavItem { label: string; href: string; icon: React.ReactNode; }

const USER_NAV: NavItem[] = [
  { label: "Overview",     href: "/dashboard",              icon: <LayoutDashboard size={18} /> },
  { label: "Chat",         href: "/dashboard/chat",         icon: <MessageSquare size={18} /> },
  { label: "Provider Hub", href: "/dashboard/provider-hub", icon: <Coins size={18} /> },
  { label: "API Keys",     href: "/dashboard/keys",         icon: <Key size={18} /> },
  { label: "Billing",      href: "/dashboard/billing",      icon: <CreditCard size={18} /> },
  { label: "Usage",        href: "/dashboard/usage",        icon: <BarChart2 size={18} /> },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Providers",    href: "/admin/providers",   icon: <Zap size={18} /> },
  { label: "Models",       href: "/admin/models",      icon: <Settings size={18} /> },
  { label: "Marketplace",  href: "/admin/marketplace", icon: <Store size={18} /> },
  { label: "Top-Ups",      href: "/admin/topups",      icon: <PlusCircle size={18} /> },
  { label: "Alerts",       href: "/admin/alerts",      icon: <Bell size={18} /> },
  { label: "Credits",      href: "/admin/credits",     icon: <Users size={18} /> },
  { label: "Settings",     href: "/admin/settings",    icon: <SlidersHorizontal size={18} /> },
];

function NavList({ items }: { items: NavItem[] }) {
  return (
    <>
      {items.map((item) => (
        <NavLink key={item.href} to={item.href} end={item.href === "/dashboard"}
          className={({ isActive }) => clsx(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            isActive ? "bg-silk-gold/10 text-silk-gold" : "text-warm-grey hover:text-cloud-grey hover:bg-slate-dark"
          )}
        >
          {item.icon}{item.label}
        </NavLink>
      ))}
    </>
  );
}

function TrialPill() {
  const { data: trial } = useQuery({
    queryKey: ["trial-status"],
    queryFn: () => trialApi.status().then((r) => r.data),
  });
  if (!trial?.active) return null;
  return (
    <NavLink to="/dashboard"
      className="flex items-center gap-2 mx-1 mb-2 px-3 py-2 rounded-lg text-xs font-medium"
      style={{ background: "rgba(210,154,45,0.12)", border: "1px solid rgba(210,154,45,0.3)", color: "#D29A2D" }}>
      <Gift size={14} />
      <span>Free trial</span>
      <span className="ml-auto text-warm-grey">{trial.days_remaining}d left</span>
    </NavLink>
  );
}

function NotificationBell() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => notificationsApi.unreadCount().then((r) => r.data.unread as number),
    refetchInterval: 30_000,
  });
  const unread = data || 0;
  return (
    <button
      onClick={() => navigate("/dashboard/notifications")}
      className="relative text-warm-grey hover:text-silk-gold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      title="Notifications"
    >
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-silk-gold text-white text-[10px] font-bold flex items-center justify-center">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="text-warm-grey hover:text-silk-gold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
    >
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-muted-metal">
        <Link to="/" className="font-display font-bold text-xl text-silk-gold">SilkLLM</Link>
        {isAdmin && (
          <div className="flex items-center gap-1 mt-1 text-xs text-warm-grey">
            <ShieldCheck size={12} className="text-silk-gold" /> Admin
          </div>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        <p className="text-xs text-muted-metal uppercase tracking-wider px-3 mb-2">Account</p>
        <NavList items={USER_NAV} />
        {isAdmin && (
          <>
            <p className="text-xs text-muted-metal uppercase tracking-wider px-3 mt-6 mb-2">Admin</p>
            <NavList items={ADMIN_NAV} />
          </>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-muted-metal">
        <TrialPill />
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-silk-gold flex items-center justify-center text-white text-sm font-bold">
            {user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cloud-grey truncate">{user?.name}</p>
            <p className="text-xs text-warm-grey truncate">${user?.balance?.toFixed(2)} credits</p>
          </div>
          <button onClick={logout} className="text-warm-grey hover:text-silk-gold transition-colors" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-cloud-grey dark:bg-deep-charcoal">
      <aside className="hidden lg:flex w-64 flex-col bg-slate-dark border-r border-muted-metal shrink-0">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-64 h-full bg-slate-dark flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 px-4 py-3 bg-slate-dark border-b border-muted-metal">
          <button onClick={() => setOpen(true)} className="lg:hidden text-warm-grey min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Menu size={20} />
          </button>
          <span className="lg:hidden font-display font-bold text-silk-gold">SilkLLM</span>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <PaymentReminderModal />
    </div>
  );
}

// EOF silkllm-frontend/src/components/layout/DashboardLayout.tsx
