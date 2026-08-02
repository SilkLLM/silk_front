/**
 * App.tsx
 * Root application component.
 * Sets up React Router, auth context, and QueryClient.
 * Routes are split into: public, auth, user dashboard, admin dashboard.
 */

// File: silkllm-frontend/src/App.tsx

import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { AuthContext, useAuthState } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";

// Lazy load pages for code splitting
const Landing       = lazy(() => import("@/pages/public/Landing"));
const Docs          = lazy(() => import("@/pages/public/Docs"));
const Login         = lazy(() => import("@/pages/auth/Login"));
const Callback      = lazy(() => import("@/pages/auth/Callback"));
const UserDashboard = lazy(() => import("@/pages/user/Dashboard"));
const ApiKeys       = lazy(() => import("@/pages/user/ApiKeys"));
const Budgets       = lazy(() => import("@/pages/user/Budgets"));
const Billing       = lazy(() => import("@/pages/user/Billing"));
const Usage         = lazy(() => import("@/pages/user/Usage"));
const ProviderHub   = lazy(() => import("@/pages/user/ProviderHub"));
const Notifications = lazy(() => import("@/pages/user/Notifications"));
const Chat          = lazy(() => import("@/pages/user/Chat"));
const AdminProviders    = lazy(() => import("@/pages/admin/Providers"));
const AdminModels       = lazy(() => import("@/pages/admin/Models"));
const AdminTopups       = lazy(() => import("@/pages/admin/Topups"));
const AdminAlerts       = lazy(() => import("@/pages/admin/Alerts"));
const AdminCredits      = lazy(() => import("@/pages/admin/Credits"));
const AdminMarketplace  = lazy(() => import("@/pages/admin/Marketplace"));
const AdminSettings     = lazy(() => import("@/pages/admin/Settings"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// ── Route guards ────────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function LoadingSpinner() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-page">
      <div className="w-8 h-8 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/**
 * Toasts are painted from the theme tokens rather than fixed hexes, so they do
 * not arrive as a bright cream card on a dark dashboard.
 */
function ThemedToaster() {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  const surface = dark ? "#1E2122" : "#FFFFFF";
  const ink = dark ? "#F2F1EE" : "#1A1918";
  const line = dark ? "#2A2E30" : "#E5E2DB";

  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: surface,
          color: ink,
          border: `1px solid ${line}`,
          borderRadius: "12px",
          fontSize: "13px",
          padding: "10px 14px",
          boxShadow: dark
            ? "0 12px 32px -8px rgba(0,0,0,0.6)"
            : "0 12px 32px -8px rgba(26,25,24,0.18)",
        },
        success: { iconTheme: { primary: dark ? "#3FBF6E" : "#0F7A3D", secondary: surface } },
        error:   { iconTheme: { primary: dark ? "#F07570" : "#C4342F", secondary: surface } },
      }}
    />
  );
}

// ── App Shell ────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* Public */}
        <Route path="/"     element={<Landing />} />
        <Route path="/docs" element={<Docs />} />

        {/* Auth */}
        <Route path="/login"          element={<Login />} />
        <Route path="/auth/callback"  element={<Callback />} />

        {/* User dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/keys"    element={<ProtectedRoute><ApiKeys /></ProtectedRoute>} />
        <Route path="/dashboard/budgets"  element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
        <Route path="/dashboard/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
        <Route path="/dashboard/usage"   element={<ProtectedRoute><Usage /></ProtectedRoute>} />
        <Route path="/dashboard/provider-hub"  element={<ProtectedRoute><ProviderHub /></ProtectedRoute>} />
        <Route path="/dashboard/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/dashboard/chat"    element={<ProtectedRoute><Chat /></ProtectedRoute>} />

        {/* Admin dashboard */}
        <Route path="/admin"            element={<AdminRoute><AdminProviders /></AdminRoute>} />
        <Route path="/admin/providers"  element={<AdminRoute><AdminProviders /></AdminRoute>} />
        <Route path="/admin/models"     element={<AdminRoute><AdminModels /></AdminRoute>} />
        <Route path="/admin/marketplace" element={<AdminRoute><AdminMarketplace /></AdminRoute>} />
        <Route path="/admin/topups"     element={<AdminRoute><AdminTopups /></AdminRoute>} />
        <Route path="/admin/alerts"     element={<AdminRoute><AdminAlerts /></AdminRoute>} />
        <Route path="/admin/credits"    element={<AdminRoute><AdminCredits /></AdminRoute>} />
        <Route path="/admin/settings"   element={<AdminRoute><AdminSettings /></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const authState = useAuthState();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authState}>
        <BrowserRouter>
          <AppRoutes />
          <ThemedToaster />
        </BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

// EOF silkllm-frontend/src/App.tsx
