/**
 * Callback.tsx
 * OAuth callback page.
 * Reads the ?token= query parameter set by the backend after OAuth,
 * stores it in localStorage, refreshes the authenticated user,
 * then redirects to the dashboard.
 */

// File: silkllm-frontend/src/pages/auth/Callback.tsx

import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Callback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const finishLogin = async () => {
      const token = params.get("token");

      if (!token) {
        navigate("/login?error=oauth_failed", { replace: true });
        return;
      }

      try {
        // Store JWT returned by backend
        localStorage.setItem("silk_token", token);

        // Refresh auth context so ProtectedRoute sees the user immediately
        await refreshUser();

        // Redirect to dashboard
        navigate("/dashboard", { replace: true });
      } catch (error) {
        console.error("OAuth callback failed:", error);

        localStorage.removeItem("silk_token");
        navigate("/login?error=oauth_failed", { replace: true });
      }
    };

    finishLogin();
  }, [params, navigate, refreshUser]);

  return (
    <div className="min-h-[100dvh] bg-page flex items-center justify-center px-4">
      <div className="text-center">
        <div className="w-9 h-9 border-[3px] border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-ink">Signing you in…</p>
        <p className="text-xs text-ink-3 mt-1.5">This only takes a moment.</p>
      </div>
    </div>
  );
}

// EOF silkllm-frontend/src/pages/auth/Callback.tsx