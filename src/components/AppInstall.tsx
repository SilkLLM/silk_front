/**
 * AppInstall.tsx
 * The three pieces of installed-app chrome: an install invitation, an update
 * bar, and an offline indicator.
 *
 * All three are deliberately quiet. An install prompt that appears on first
 * paint gets dismissed reflexively, so this one waits until the visit has some
 * substance behind it and does not come back for a month once refused.
 */

// File: silkllm-frontend/src/components/AppInstall.tsx

import React, { useEffect, useState } from "react";
import { Download, RefreshCw, Share, SquarePlus, WifiOff, X } from "lucide-react";
import clsx from "clsx";
import {
  applyUpdate, canInstallManually, isStandalone, promptInstall, useInstallAvailable, useOnline,
} from "@/lib/pwa";
import { LogoMark } from "@/components/Logo";
import { Button, IconButton, Modal } from "@/components/ui";

const DISMISS_KEY = "silk_install_dismissed_at";
const DISMISS_DAYS = 30;
/** Wait this long into a visit before suggesting installation. */
const INVITE_DELAY_MS = 25_000;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function dismiss() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* private mode */ }
}

/** Offline strip. Pinned under the topbar so it never covers content. */
export function OfflineBar() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 px-4 py-1.5 bg-warn/12 border-b border-warn/25 text-warn text-xs font-medium"
    >
      <WifiOff size={13} className="shrink-0" />
      You are offline. Saved chats still work; new requests will fail.
    </div>
  );
}

/** Update bar, shown when a newer build is cached and waiting. */
export function UpdateBar({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex items-center justify-center gap-3 px-4 py-1.5 bg-accent/12 border-b border-accent/25 text-xs">
      <span className="text-accent-ink font-medium">A new version of SilkLLM is ready.</span>
      <button onClick={applyUpdate} className="inline-flex items-center gap-1 text-accent-ink underline underline-offset-2">
        <RefreshCw size={12} /> Reload
      </button>
    </div>
  );
}

/**
 * Install invitation. Renders as a bottom sheet on phones and a small card at
 * the bottom-right on wider screens, which is where each platform's own install
 * affordances live.
 */
export default function InstallInvite() {
  const promptAvailable = useInstallAvailable();
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  const manual = canInstallManually();

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    if (!promptAvailable && !manual) return;
    const t = setTimeout(() => setVisible(true), INVITE_DELAY_MS);
    return () => clearTimeout(t);
  }, [promptAvailable, manual]);

  const close = () => { setVisible(false); dismiss(); };

  const install = async () => {
    if (manual) { setIosHelp(true); return; }
    const accepted = await promptInstall();
    setVisible(false);
    if (!accepted) dismiss();
  };

  return (
    <>
      {visible && (
        <div
          className={clsx(
            "fixed z-[85] animate-slide-up",
            "left-3 right-3 bottom-3",
            "sm:left-auto sm:right-5 sm:bottom-5 sm:w-[22rem]",
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="rounded-2xl border border-line bg-raised shadow-overlay p-4">
            <div className="flex items-start gap-3">
              <LogoMark size={40} rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">Install SilkLLM</p>
                <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                  Add it to your {manual ? "home screen" : "device"} for a full-screen app, faster
                  launches, and access to your chats offline.
                </p>
              </div>
              <IconButton label="Not now" size={28} onClick={close}><X size={15} /></IconButton>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="ghost" size="sm" className="flex-1" onClick={close}>Not now</Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                icon={manual ? <Share size={14} /> : <Download size={14} />}
                onClick={install}
              >
                {manual ? "How to add" : "Install"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* iOS cannot be prompted, so it gets instructions instead. */}
      <Modal
        open={iosHelp}
        onClose={() => { setIosHelp(false); close(); }}
        title="Add SilkLLM to your home screen"
        description="Safari installs apps from the share sheet."
        icon={<Share size={17} />}
        size="sm"
        footer={<Button variant="primary" onClick={() => { setIosHelp(false); close(); }}>Got it</Button>}
      >
        <ol className="space-y-3">
          {[
            { icon: <Share size={15} />, text: "Tap the Share button in the Safari toolbar." },
            { icon: <SquarePlus size={15} />, text: 'Choose "Add to Home Screen" from the list.' },
            { icon: <Download size={15} />, text: 'Tap "Add". SilkLLM appears alongside your other apps.' },
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-lg bg-accent/10 text-accent-ink flex items-center justify-center shrink-0 text-2xs font-semibold">
                {i + 1}
              </span>
              <span className="flex items-center gap-2 text-sm text-ink-2 leading-relaxed pt-1">
                <span className="text-ink-3 shrink-0">{step.icon}</span>
                {step.text}
              </span>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  );
}

// EOF silkllm-frontend/src/components/AppInstall.tsx
