/**
 * Login.tsx
 * OAuth sign-in. No password fields - Google and GitHub only.
 *
 * This is the first authenticated-app surface a user sees, so it is painted from
 * the same theme tokens as the dashboard rather than being hardcoded dark.
 */

// File: silkllm-frontend/src/pages/auth/Login.tsx

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Github, ShieldCheck } from "lucide-react";
import { authApi } from "@/services/api";
import Logo from "@/components/Logo";
import { useNoIndex } from "@/lib/seo";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.548 0 9s.348 2.825.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export default function Login() {
  useNoIndex();
  // OAuth is a full page navigation away from this app, so the backend is asked
  // whether it can take the sign-in before we leave. If it cannot, the app shows
  // its maintenance screen instead of the browser showing a 502.
  const [busy, setBusy] = useState<"google" | "github" | null>(null);

  const start = async (provider: "google" | "github") => {
    setBusy(provider);
    const went = await (provider === "google"
      ? authApi.googleLogin()
      : authApi.githubLogin());
    // On success the browser is already navigating away, so only a refusal
    // needs the button restored.
    if (!went) setBusy(null);
  };

  return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[400px]"
      >
        <div className="text-center mb-7">
          <Link to="/" className="inline-flex items-center">
            <Logo size={38} wordClassName="text-2xl" className="gap-2.5" />
          </Link>
          <p className="text-sm text-ink-2 mt-3">One key for every model. Sign in to continue.</p>
        </div>

        <div className="card card-pad">
          <h1 className="text-base font-semibold text-ink text-center">Welcome back</h1>
          <p className="text-xs text-ink-3 text-center mt-1.5 mb-6">
            We use OAuth only - there is no password to remember or leak.
          </p>

          <div className="space-y-2.5">
            <button
              onClick={() => start("google")}
              disabled={!!busy}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-lg
                         bg-white text-[#1f1f1f] font-medium text-sm border border-line
                         shadow-xs hover:brightness-[0.98] active:brightness-95 transition-all
                         disabled:opacity-60 disabled:cursor-wait"
            >
              <GoogleIcon />
              {busy === "google" ? "Connecting..." : "Continue with Google"}
            </button>

            <button
              onClick={() => start("github")}
              disabled={!!busy}
              className="w-full flex items-center justify-center gap-3 h-11 rounded-lg
                         bg-[#1b1f23] text-white font-medium text-sm border border-transparent
                         shadow-xs hover:brightness-125 active:brightness-100 transition-all
                         disabled:opacity-60 disabled:cursor-wait"
            >
              <Github size={17} />
              {busy === "github" ? "Connecting..." : "Continue with GitHub"}
            </button>
          </div>

          <div className="flex items-start gap-2.5 mt-6 pt-5 border-t border-line">
            <ShieldCheck size={15} className="text-success shrink-0 mt-0.5" />
            <p className="text-2xs text-ink-3 leading-relaxed">
              Signing in creates your account and a prepaid balance. By continuing you agree to the
              terms of service.
            </p>
          </div>
        </div>

        <p className="text-center mt-6">
          <Link to="/" className="text-sm text-ink-2 hover:text-ink transition-colors inline-flex items-center gap-1.5 min-h-[36px] px-2">
            <ArrowLeft size={14} /> Back to home
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

// EOF silkllm-frontend/src/pages/auth/Login.tsx
