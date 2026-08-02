/**
 * prefetch.ts
 * Fetch route bundles before they are asked for.
 *
 * Every page is a lazy import, which keeps the first visit small but means the
 * first visit to *each* page pays a round trip of its own. On a fast connection
 * that is invisible. On a connection where a single round trip costs a second,
 * it is the difference between a dashboard that feels instant and one that
 * blinks a spinner every time you touch the sidebar.
 *
 * So the chunks are fetched while nothing else is happening: after the current
 * page has settled, during idle time, and immediately when a pointer lands on a
 * link. By the time anything is clicked the code is usually already in memory.
 *
 * Deliberately conservative about when. Prefetching competes for bandwidth with
 * the page being loaded right now, so nothing starts until the app is
 * interactive, and nothing starts at all on a connection that says it is slow or
 * metered. Making somebody's data plan pay for a page they never opened is not
 * a performance win.
 */

// File: silkllm-frontend/src/lib/prefetch.ts

/** Loaders already started, so a route is never fetched twice. */
const started = new Set<string>();

type Loader = () => Promise<unknown>;

/**
 * The routes worth having ready, by the area someone is in.
 *
 * Ordered by how likely they are to be opened next, because a slow connection
 * will not get through the whole list before the person clicks something.
 */
const ROUTES: Record<string, Record<string, Loader>> = {
  dashboard: {
    dashboard: () => import("@/pages/user/Dashboard"),
    keys: () => import("@/pages/user/ApiKeys"),
    usage: () => import("@/pages/user/Usage"),
    billing: () => import("@/pages/user/Billing"),
    chat: () => import("@/pages/user/Chat"),
    promotions: () => import("@/pages/user/Promotions"),
    budgets: () => import("@/pages/user/Budgets"),
  },
  public: {
    landing: () => import("@/pages/public/Landing"),
    docs: () => import("@/pages/public/Docs"),
    login: () => import("@/pages/auth/Login"),
  },
};

/** Map a href to the loader for the page it renders. */
const BY_PATH: Record<string, Loader> = {
  "/": ROUTES.public.landing,
  "/docs": ROUTES.public.docs,
  "/login": ROUTES.public.login,
  "/dashboard": ROUTES.dashboard.dashboard,
  "/dashboard/keys": ROUTES.dashboard.keys,
  "/dashboard/usage": ROUTES.dashboard.usage,
  "/dashboard/billing": ROUTES.dashboard.billing,
  "/dashboard/chat": ROUTES.dashboard.chat,
  "/dashboard/promotions": ROUTES.dashboard.promotions,
  "/dashboard/budgets": ROUTES.dashboard.budgets,
};

/**
 * Whether it is polite to spend someone's bandwidth on a page they have not
 * asked for. Absent the Network Information API, assume it is.
 */
function shouldPrefetch(): boolean {
  const connection = (navigator as any).connection;
  if (!connection) return true;
  if (connection.saveData) return false;
  return !/(^|-)2g$/.test(connection.effectiveType || "");
}

function whenIdle(fn: () => void, timeout = 2000): void {
  const idle = (window as any).requestIdleCallback;
  if (typeof idle === "function") idle(fn, { timeout });
  else setTimeout(fn, timeout);
}

function run(key: string, load: Loader): void {
  if (started.has(key)) return;
  started.add(key);
  // Failures are silent on purpose. This is an optimisation, and a chunk that
  // will not load now will be retried, and reported properly, when the route is
  // actually navigated to.
  load().catch(() => started.delete(key));
}

/** Fetch the bundle for one path, if it has one. Safe to call repeatedly. */
export function prefetchPath(path: string): void {
  if (!shouldPrefetch()) return;
  const load = BY_PATH[path];
  if (load) run(path, load);
}

/**
 * Warm the routes someone in this area is likely to open next.
 *
 * Started one at a time rather than all at once: a burst of parallel requests
 * on a slow link delays every one of them, including whatever the person is
 * actually waiting for.
 */
export function prefetchArea(area: "dashboard" | "public"): void {
  if (!shouldPrefetch()) return;

  const entries = Object.entries(ROUTES[area]);
  let index = 0;

  const next = () => {
    while (index < entries.length) {
      const [name, load] = entries[index++];
      const key = `${area}:${name}`;
      if (started.has(key)) continue;
      started.add(key);
      load().catch(() => started.delete(key)).finally(() => whenIdle(next));
      return;
    }
  };

  whenIdle(next);
}

// EOF silkllm-frontend/src/lib/prefetch.ts
