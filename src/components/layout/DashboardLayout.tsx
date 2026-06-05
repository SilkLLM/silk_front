/**
 * DashboardLayout.tsx
 * Shared sidebar layout for both user and admin dashboards.
 * Responsive: sidebar collapses to hamburger on mobile.
 */

// File: silkllm-frontend/src/components/layout/DashboardLayout.tsx

import React, { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Key, CreditCard, BarChart2,
  Settings, Bell, Users, Zap, PlusCircle, LogOut, Menu, X,
  ShieldCheck
} from "lucide-react";
import clsx from "clsx";

interface NavItem { label: string; href: string; icon: React.ReactNode; }

const USER_NAV: NavItem[] = [
  { label: "Overview",     href: "/dashboard",         icon: <LayoutDashboard size={18} /> },
  { label: "API Keys",     href: "/dashboard/keys",    icon: <Key size={18} /> },
  { label: "Billing",      href: "/dashboard/billing", icon: <CreditCard size={18} /> },
  { label: "Usage",        href: "/dashboard/usage",   icon: <BarChart2 size={18} /> },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Providers",    href: "/admin/providers", icon: <Zap size={18} /> },
  { label: "Models",       href: "/admin/models",    icon: <Settings size={18} /> },
  { label: "Top-Ups",      href: "/admin/topups",    icon: <PlusCircle size={18} /> },
  { label: "Alerts",       href: "/admin/alerts",    icon: <Bell size={18} /> },
  { label: "Credits",      href: "/admin/credits",   icon: <Users size={18} /> },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = isAdmin ? ADMIN_NAV : USER_NAV;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-muted-metal">
        <Link to="/" className="font-display font-bold text-xl text-silk-gold">SilkLLM</Link>
        {isAdmin && (
          <div className="flex items-center gap-1 mt-1 text-xs text-warm-grey">
            <ShieldCheck size={12} className="text-silk-gold" /> Admin
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {/* User nav always visible */}
        <p className="text-xs text-muted-metal uppercase tracking-wider px-3 mb-2">Account</p>
        {USER_NAV.map((item) => (
          <NavLink key={item.href} to={item.href} end
            className={({ isActive }) => clsx(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              isActive ? "bg-silk-gold/10 text-silk-gold" : "text-warm-grey hover:text-cloud-grey hover:bg-slate-dark"
            )}
          >
            {item.icon}{item.label}
          </NavLink>
        ))}

        {/* Admin nav */}
        {isAdmin && (
          <>
            <p className="text-xs text-muted-metal uppercase tracking-wider px-3 mt-6 mb-2">Admin</p>
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.href} to={item.href}
                className={({ isActive }) => clsx(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive ? "bg-silk-gold/10 text-silk-gold" : "text-warm-grey hover:text-cloud-grey hover:bg-slate-dark"
                )}
              >
                {item.icon}{item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div className="px-4 py-4 border-t border-muted-metal">
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
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-slate-dark border-r border-muted-metal shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="relative w-64 h-full bg-slate-dark flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile topbar */}
        <header className="lg:hidden flex items-center gap-4 px-4 py-3 bg-slate-dark border-b border-muted-metal">
          <button onClick={() => setOpen(true)} className="text-warm-grey min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Menu size={20} />
          </button>
          <span className="font-display font-bold text-silk-gold">SilkLLM</span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

// EOF silkllm-frontend/src/components/layout/DashboardLayout.tsx
