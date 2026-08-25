/**
 * App.tsx
 * Root application component.
 * Sets up React Router, auth context, and QueryClient.
 * Routes are split into: public, auth, user dashboard, admin dashboard.
 */

// File: silkllm-frontend/src/App.tsx

import React, { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { prefetchArea } from "@/lib/prefetch";
import { AuthContext, useAuthState } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useNoIndex } from "@/lib/seo";

// Lazy load pages for code splitting
const Landing         = lazy(() => import("@/pages/public/Landing"));
const Docs            = lazy(() => import("@/pages/public/Docs"));
const Marketplace     = lazy(() => import("@/pages/public/Marketplace"));
const ApiKeyControls  = lazy(() => import("@/pages/public/ApiKeyControls"));
const Multimodal      = lazy(() => import("@/pages/public/Multimodal"));
const Alternatives    = lazy(() => import("@/pages/public/Alternatives"));
const Guides          = lazy(() => import("@/pages/public/Guides"));
const GuideArticle    = lazy(() => import("@/pages/public/GuideArticle"));
const Login         = lazy(() => import("@/pages/auth/Login"));
const Callback      = lazy(() => import("@/pages/auth/Callback"));
const UserDashboard = lazy(() => import("@/pages/user/Dashboard"));
const ApiKeys       = lazy(() => import("@/pages/user/ApiKeys"));
const ServiceDown   = lazy(() => import("@/components/ServiceDown"));
const Budgets       = lazy(() => import("@/pages/user/Budgets"));
const Promotions    = lazy(() => import("@/pages/user/Promotions"));
const Billing       = lazy(() => import("@/pages/user/Billing"));
const Usage         = lazy(() => import("@/pages/user/Usage"));
const ProviderHub   = lazy(() => import("@/pages/user/ProviderHub"));
const Notifications = lazy(() => import("@/pages/user/Notifications"));
const Chat          = lazy(() => import("@/pages/user/Chat"));
const AdminProviders    = lazy(() => import("@/pages/admin/Providers"));
const AdminPaymentProviders = lazy(() => import("@/pages/admin/PaymentProviders"));
const AdminModels       = lazy(() => import("@/pages/admin/Models"));
const AdminTopups       = lazy(() => import("@/pages/admin/Topups"));
const AdminAlerts       = lazy(() => import("@/pages/admin/Alerts"));
const AdminCredits      = lazy(() => import("@/pages/admin/Credits"));
const AdminMarketplace  = lazy(() => import("@/pages/admin/Marketplace"));
const AdminAnalytics    = lazy(() => import("@/pages/admin/Analytics"));
const AdminSettings     = lazy(() => import("@/pages/admin/Settings"));
const AdminPromotions = lazy(() => import("@/pages/admin/AdminPromotions"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

// ── Route guards ────────────────────────────────────────────────────────────

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  useNoIndex();
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  useNoIndex();
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
        <Route path="/marketplace"       element={<Marketplace />} />
        <Route path="/api-key-controls"  element={<ApiKeyControls />} />
        <Route path="/multimodal"        element={<Multimodal />} />
        <Route path="/alternatives"      element={<Alternatives />} />
        <Route path="/guides"            element={<Guides />} />
        <Route path="/guides/:slug"      element={<GuideArticle />} />

        {/* Auth */}
        <Route path="/login"          element={<Login />} />
        <Route path="/auth/callback"  element={<Callback />} />

        {/* User dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/keys"    element={<ProtectedRoute><ApiKeys /></ProtectedRoute>} />
        <Route path="/dashboard/budgets"  element={<ProtectedRoute><Budgets /></ProtectedRoute>} />
        <Route path="/dashboard/promotions" element={<ProtectedRoute><Promotions /></ProtectedRoute>} />
        <Route path="/dashboard/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
        <Route path="/dashboard/usage"   element={<ProtectedRoute><Usage /></ProtectedRoute>} />
        <Route path="/dashboard/provider-hub"  element={<ProtectedRoute><ProviderHub /></ProtectedRoute>} />
        <Route path="/dashboard/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
        <Route path="/dashboard/chat"    element={<ProtectedRoute><Chat /></ProtectedRoute>} />

        {/* Admin dashboard */}
        <Route path="/admin"            element={<AdminRoute><AdminProviders /></AdminRoute>} />
        <Route path="/admin/providers"  element={<AdminRoute><AdminProviders /></AdminRoute>} />
        <Route path="/admin/payment-providers" element={<AdminRoute><AdminPaymentProviders /></AdminRoute>} />
        <Route path="/admin/models"     element={<AdminRoute><AdminModels /></AdminRoute>} />
        <Route path="/admin/marketplace" element={<AdminRoute><AdminMarketplace /></AdminRoute>} />
        <Route path="/admin/analytics"   element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/topups"     element={<AdminRoute><AdminTopups /></AdminRoute>} />
        <Route path="/admin/alerts"     element={<AdminRoute><AdminAlerts /></AdminRoute>} />
        <Route path="/admin/credits"    element={<AdminRoute><AdminCredits /></AdminRoute>} />
        <Route path="/admin/promotions" element={<AdminRoute><AdminPromotions /></AdminRoute>} />
        <Route path="/admin/settings"   element={<AdminRoute><AdminSettings /></AdminRoute>} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

/**
 * Swap the whole app for a maintenance screen while the backend is unreachable.
 *
 * Held here rather than per page, because an outage is not something any one
 * screen can sensibly handle, and a half-rendered dashboard with every panel
 * showing its own error is exactly the "something is badly wrong" impression
 * this exists to avoid.
 *
 * It clears itself: any successful response anywhere in the app fires
 * `silk:service-up`, and the screen polls /health on its own besides.
 */
/**
 * Warm the bundles for pages this visitor is likely to open next.
 *
 * Runs after mount and only during idle time, so it never competes with the
 * page currently being loaded. Without it, every page is a fresh round trip the
 * first time it is opened, which on a slow link reads as the app being slow
 * rather than the network being slow.
 */
function RoutePrefetcher() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    prefetchArea(pathname.startsWith("/dashboard") || user ? "dashboard" : "public");
  }, [pathname, user]);

  return null;
}

function ServiceGate({ children }: { children: React.ReactNode }) {
  const [down, setDown] = useState(false);

  useEffect(() => {
    const goDown = () => setDown(true);
    const goUp = () => setDown(false);
    window.addEventListener("silk:service-down", goDown);
    window.addEventListener("silk:service-up", goUp);
    return () => {
      window.removeEventListener("silk:service-down", goDown);
      window.removeEventListener("silk:service-up", goUp);
    };
  }, []);

  if (!down) return <>{children}</>;
  return (
    <Suspense fallback={null}>
      <ServiceDown onRecovered={() => setDown(false)} />
    </Suspense>
  );
}

export default function App() {
  const authState = useAuthState();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authState}>
        <BrowserRouter>
          <ServiceGate>
            <RoutePrefetcher />
            <AppRoutes />
          </ServiceGate>
          <ThemedToaster />
        </BrowserRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

// EOF silkllm-frontend/src/App.tsx
