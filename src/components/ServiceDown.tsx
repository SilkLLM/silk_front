/**
 * ServiceDown.tsx
 * What people see when the backend cannot be reached.
 *
 * Previously they saw a raw error, or a page that had loaded but silently did
 * nothing, which reads as "this product is broken" rather than "this will be
 * back shortly". The difference matters most during a deploy, when the outage
 * is measured in seconds and the panic is not.
 *
 * Deliberately narrow about when it appears. Only a request that never reached
 * the server, or one the server answered with 502/503/504, counts as the
 * service being down. A 400 or a 404 means the service is up and answered, and
 * covering the whole app for those would hide real errors behind a reassuring
 * screen.
 *
 * It also recovers by itself: while it is showing, it quietly polls /health and
 * disappears the moment the backend answers, so nobody has to know to refresh.
 */

// File: silkllm-frontend/src/components/ServiceDown.tsx

import React, { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { API_BASE_URL } from "@/lib/endpoint";
import { Button } from "@/components/ui";

/** How often to check whether the backend has come back. */
const POLL_MS = 5000;

export default function ServiceDown({ onRecovered }: { onRecovered: () => void }) {
  const [checking, setChecking] = useState(false);
  const [offline, setOffline] = useState(!navigator.onLine);
  const [waitedFor, setWaitedFor] = useState(0);

  const check = React.useCallback(async () => {
    setChecking(true);
    try {
      // The health endpoint sits outside /api and needs no token, so it answers
      // during a deploy even before the app has finished starting.
      const base = API_BASE_URL.replace(/\/api\/?$/, "");
      const resp = await fetch(`${base}/health`, { cache: "no-store" });
      if (resp.ok) onRecovered();
    } catch {
      /* still down; the poll will try again */
    } finally {
      setChecking(false);
    }
  }, [onRecovered]);

  useEffect(() => {
    const poll = setInterval(check, POLL_MS);
    const tick = setInterval(() => setWaitedFor((s) => s + 1), 1000);
    const online = () => { setOffline(false); check(); };
    const gone = () => setOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", gone);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", gone);
    };
  }, [check]);

  const minutes = Math.floor(waitedFor / 60);

  return (
    <div className="min-h-[100dvh] bg-page text-ink flex items-center justify-center gutter py-16">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute left-1/2 top-1/3 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.07] blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/[0.08] text-accent-ink">
          {offline ? <WifiOff size={24} /> : <AlertTriangle size={24} />}
        </span>

        <h1 className="mt-6 text-2xl sm:text-3xl font-semibold tracking-tight">
          {offline ? "You are offline" : "We will be back shortly"}
        </h1>

        <p className="mt-3 text-sm sm:text-base text-ink-2 leading-relaxed">
          {offline ? (
            <>
              Your device has lost its connection. SilkLLM will pick up exactly where you left off
              as soon as you are back online.
            </>
          ) : (
            <>
              SilkLLM is briefly unreachable, usually because we are deploying an update. Nothing is
              lost: your balance, your keys and your usage history are all safe, and any request
              already in flight was either completed or never charged.
            </>
          )}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          <Button variant="primary" icon={<RefreshCw size={15} />} loading={checking} onClick={check}>
            Try again
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            Reload the page
          </Button>
        </div>

        <p className="mt-6 inline-flex items-center gap-2 text-2xs text-ink-3">
          <Wifi size={12} className={checking ? "animate-pulse" : undefined} />
          Checking automatically every few seconds
          {minutes >= 1 && `, waiting ${minutes} minute${minutes === 1 ? "" : "s"} so far`}
        </p>

        <p className="mt-8 text-2xs text-ink-3 leading-relaxed">
          If this lasts more than a few minutes, it is worth checking your connection before
          assuming the fault is ours.
        </p>
      </div>
    </div>
  );
}

// EOF silkllm-frontend/src/components/ServiceDown.tsx
