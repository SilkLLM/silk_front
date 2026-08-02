/**
 * PublicChrome.tsx
 * The navigation and footer shared by the landing page and the docs.
 *
 * The public pages used to be hardcoded dark with their own bespoke nav. They
 * now use the same theme tokens as the dashboard, so someone who set light mode
 * inside the app does not get thrown back into a dark marketing site when they
 * click the logo.
 */

// File: silkllm-frontend/src/components/public/PublicChrome.tsx

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BookOpen, Github, Menu, Monitor, Moon, Sun, X } from "lucide-react";
import clsx from "clsx";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { IconButton, Menu as DropMenu, MenuItem } from "@/components/ui";

const LINKS = [
  { label: "Models", href: "/#providers" },
  { label: "Marketplace", href: "/#marketplace" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Docs", href: "/docs" },
];

function ThemeSwitch() {
  const { mode, resolved, setMode } = useTheme();
  const Icon = mode === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  return (
    <DropMenu
      width={160}
      trigger={({ toggle }) => (
        <IconButton label="Theme" onClick={toggle}><Icon size={17} /></IconButton>
      )}
    >
      {(close) => (
        <>
          {([["light", "Light", <Sun size={15} key="l" />],
             ["dark", "Dark", <Moon size={15} key="d" />],
             ["system", "System", <Monitor size={15} key="s" />]] as const).map(([v, label, icon]) => (
            <MenuItem
              key={v}
              icon={icon}
              onClick={() => { setMode(v); close(); }}
              className={mode === v ? "!text-accent-ink !bg-accent/10" : undefined}
            >
              {label}
            </MenuItem>
          ))}
        </>
      )}
    </DropMenu>
  );
}

export function PublicNav() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setOpen(false); }, [pathname]);

  // The drawer owns the viewport while it is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <header
        className={clsx(
          "fixed top-0 inset-x-0 z-50 transition-all duration-200 pt-safe",
          scrolled
            ? "bg-page/85 backdrop-blur-xl border-b border-line"
            : "bg-transparent border-b border-transparent",
        )}
      >
        <nav className="mx-auto max-w-[1180px] h-16 flex items-center gap-3 gutter">
          <Link to="/" className="shrink-0" aria-label="SilkLLM home">
            <Logo size={30} wordClassName="text-[17px]" />
          </Link>

          <div className="hidden md:flex items-center gap-1 ml-6">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 h-9 inline-flex items-center rounded-lg text-sm text-ink-2 hover:text-ink hover:bg-ink/[0.05] transition-colors"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex-1" />

          <div className="hidden sm:flex items-center gap-1.5">
            <ThemeSwitch />
            {user ? (
              <Link to="/dashboard" className="btn-primary h-9 px-4 text-sm">Dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost h-9 px-3 text-sm">Sign in</Link>
                <Link to="/login" className="btn-primary h-9 px-4 text-sm">Get started</Link>
              </>
            )}
          </div>

          <div className="flex sm:hidden items-center gap-1">
            <ThemeSwitch />
            <IconButton label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
              {open ? <X size={19} /> : <Menu size={19} />}
            </IconButton>
          </div>
        </nav>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 top-0 pt-[calc(4rem+env(safe-area-inset-top))] bg-page border-b border-line shadow-overlay animate-slide-up">
            <div className="px-4 pb-5 pt-2 space-y-1">
              {LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center h-11 px-3 rounded-lg text-sm font-medium text-ink-2 hover:text-ink hover:bg-ink/[0.05]"
                >
                  {l.label}
                </a>
              ))}
              <div className="pt-3 grid gap-2">
                {user ? (
                  <Link to="/dashboard" className="btn-primary w-full">Open dashboard</Link>
                ) : (
                  <>
                    <Link to="/login" className="btn-secondary w-full">Sign in</Link>
                    <Link to="/login" className="btn-primary w-full">Get started free</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Models", href: "/#providers" },
      { label: "Marketplace", href: "/#marketplace" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Quickstart", href: "/docs#quickstart" },
      { label: "API reference", href: "/docs#generate" },
      { label: "Examples", href: "/docs#examples" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Sign in", href: "/login" },
      { label: "Billing", href: "/dashboard/billing" },
      { label: "API keys", href: "/dashboard/keys" },
      { label: "Usage", href: "/dashboard/usage" },
    ],
  },
];

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-sunken">
      <div className="mx-auto max-w-[1180px] gutter py-12 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo size={30} wordClassName="text-[17px]" />
            <p className="text-sm text-ink-2 mt-3 leading-relaxed">
              One key for every AI model. Text, image, audio and video from every major provider,
              billed from a single balance.
            </p>
            <div className="flex items-center gap-1.5 mt-4">
              <a
                href="https://github.com/SilkLLM"
                target="_blank"
                rel="noreferrer noopener"
                className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-ink-2 hover:text-ink hover:border-line-strong transition-colors"
                aria-label="SilkLLM on GitHub"
              >
                <Github size={16} />
              </a>
              <Link
                to="/docs"
                className="w-9 h-9 rounded-lg border border-line flex items-center justify-center text-ink-2 hover:text-ink hover:border-line-strong transition-colors"
                aria-label="Documentation"
              >
                <BookOpen size={16} />
              </Link>
            </div>
          </div>

          {FOOTER_GROUPS.map((g) => (
            <div key={g.title}>
              <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3">{g.title}</p>
              <ul className="mt-3 space-y-0.5">
                {g.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="inline-flex items-center min-h-[34px] text-sm text-ink-2 hover:text-ink transition-colors">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 pt-6 border-t border-line flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-3">(c) {year} SilkLLM. All rights reserved.</p>
          <p className="text-xs text-ink-3">
            Provider cost plus a flat 10% markup. No subscription, no expiry.
          </p>
        </div>
      </div>
    </footer>
  );
}

// EOF silkllm-frontend/src/components/public/PublicChrome.tsx
