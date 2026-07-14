# SilkLLM Frontend

React + Vite frontend for SilkLLM - landing page, user dashboard, and admin dashboard.

## Quick Start

```bash
npm install
npm run dev
# Opens at http://localhost:5173
```

## V2 Surfaces

New routes and pages (all wired to the backend API in `src/services/api.ts`):

- **Chat** (`/dashboard/chat`) - a local-first chat client. Conversations live only in `localStorage`; the server stores nothing. Streaming, model picker, markdown + code rendering, and a user-set expiry (session / 1d / 7d / 30d / never) that purges on load.
- **Provider Hub** (`/dashboard/provider-hub`) - deposit and manage your own provider keys, see per-key earnings and requests served, with plain-language explanations and a consent step.
- **Notifications** (`/dashboard/notifications`) - the dashboard inbox, with an unread badge on the header bell.
- **Admin Marketplace** (`/admin/marketplace`) - full oversight: value-created analytics, a sortable/searchable keys table, per-owner declared-vs-delivered, and suspend/activate.
- **Admin Settings** (`/admin/settings`) - live-editable markup/reward/trial values, plus emergency kill-switch toggles.

Other additions: a real **dark-mode toggle** (`hooks/useTheme.ts`), analytics charts (Recharts) across Marketplace, Usage, Credits, and the Dashboard, a small shared UI kit (`components/ui.tsx`), an onboarding + trial card on the Dashboard, and SEO/OG meta. Every surface is mobile-native (tables scroll, grids collapse, 44px targets).

### Build

```bash
npm run build     # tsc + vite build
```
