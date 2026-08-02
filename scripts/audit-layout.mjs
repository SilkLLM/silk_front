/**
 * audit-layout.mjs
 * Renders every route at phone, tablet and desktop widths in both themes and
 * reports horizontal overflow.
 *
 * The dashboard is behind OAuth, so the API is stubbed with fixtures and a
 * token is seeded into localStorage. That renders the real components with
 * realistic data rather than empty states, which is where overflow actually
 * shows up.
 *
 * Usage: node scripts/audit-layout.mjs [baseUrl]
 */

import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:4173";
const CHROME = "/usr/bin/google-chrome";

const VIEWPORTS = [
  { name: "phone",   width: 375, height: 812, mobile: true },
  { name: "phone-l", width: 414, height: 896, mobile: true },
  { name: "tablet",  width: 768, height: 1024, mobile: true },
  { name: "laptop",  width: 1280, height: 800, mobile: false },
  { name: "wide",    width: 1920, height: 1080, mobile: false },
];

const ROUTES = [
  "/", "/docs", "/login",
  "/dashboard", "/dashboard/chat", "/dashboard/usage", "/dashboard/billing",
  "/dashboard/keys", "/dashboard/budgets", "/dashboard/provider-hub", "/dashboard/notifications",
  "/admin/providers", "/admin/models", "/admin/marketplace", "/admin/topups",
  "/admin/alerts", "/admin/credits", "/admin/settings",
];

// Fixtures shaped like the real API, with deliberately long strings so that
// truncation and wrapping are actually exercised.
const LONG_EMAIL = "a.very.long.user.email.address@some-quite-long-domain-name.example.com";
const MODELS = Array.from({ length: 14 }, (_, i) => ({
  id: `provider-${i}/an-unusually-long-model-identifier-v${i}-preview`,
  provider: ["openai", "anthropic", "google", "deepseek", "xai"][i % 5],
  provider_id: ["openai", "anthropic", "google", "deepseek", "xai"][i % 5],
  display_name: `Extremely Long Model Display Name ${i}`,
  input_cost_per_1k_usd: 0.0000025 * (i + 1),
  output_cost_per_1k_usd: 0.00001 * (i + 1),
  input_cost_per_1k: 0.0000025 * (i + 1),
  output_cost_per_1k: 0.00001 * (i + 1),
  context_window: 128000,
  capabilities: ["chat", "vision"],
  modality: i % 6 === 0 ? "image" : "text",
  enabled: i % 5 !== 0,
  is_free: i % 4 === 0,
  is_active: true,
  routing_weight: i,
  fallback_models: ["fallback-model-one", "fallback-model-two"],
}));

const LEDGER = Array.from({ length: 20 }, (_, i) => ({
  id: `entry-${i}`,
  created_at: new Date(Date.now() - i * 36e5).toISOString(),
  entry_type: ["usage", "purchase", "refund"][i % 3],
  model: MODELS[i % MODELS.length].id,
  amount: i % 3 === 1 ? 25 : -0.00123 * (i + 1),
  balance_after: 42.1234 - i * 0.01,
  prompt_tokens: 1200 + i * 37,
  completion_tokens: 800 + i * 11,
  user_email: LONG_EMAIL,
  metadata: { payment_provider: "stripe" },
}));

const FIXTURES = {
  "/auth/me": { id: "u1", email: LONG_EMAIL, name: "Alexandra Constantine-Fitzwilliam", role: "admin", balance: 42.1234 },
  "/balance": { balance: 42.1234 },
  "/models": { models: MODELS },
  "/keys": Array.from({ length: 4 }, (_, i) => ({
    id: `k${i}`, name: `A rather long API key name number ${i}`,
    created_at: new Date().toISOString(), last_used: new Date().toISOString(), is_active: i !== 3,
  })),
  "/usage": { total: 240, entries: LEDGER },
  "/trial": { active: true, days_remaining: 5, daily_limit_usd: 1, daily_remaining_usd: 0.4213 },
  "/notifications": {
    unread: 3,
    notifications: Array.from({ length: 6 }, (_, i) => ({
      id: `n${i}`, type: ["earning", "trial_low", "key_suspended", "info"][i % 4],
      title: "A notification title that runs on considerably longer than expected",
      body: "Body copy that is also quite long, to make sure it wraps rather than pushing the layout wide.",
      read: i > 2, created_at: new Date().toISOString(),
    })),
  },
  "/notifications/unread-count": { unread: 3 },
  "/provider-keys": Array.from({ length: 3 }, (_, i) => ({
    id: `pk${i}`, provider_id: "openai", label: `A long deposited key label ${i}`,
    is_public: i % 2 === 0, is_free_key: false, serve_owner_with_own_key: true,
    daily_limit_usd: 5, declared_budget_usd: i === 0 ? 50 : 0, consumed_usd_total: 12.5,
    status: "active", created_at: new Date().toISOString(), last_used: new Date().toISOString(),
    earned_credits_total: 3.21, requests_served: 1234, provider_cost_served: 4.3,
  })),
  "/keys/allocation": { balance: 100, allocated: 42.5, available: 57.5 },
  "/budgets": Array.from({ length: 4 }, (_, i) => ({
    id: `pool${i}`, name: "Mobile platform team, Europe and North America",
    spend_limit_usd: i === 3 ? null : 100 + i * 50, spent_usd: i === 1 ? 250 : 42.5,
    key_count: 3 + i, created_at: new Date().toISOString(), limit_reset_at: null,
  })),
  "/webhooks": Array.from({ length: 3 }, (_, i) => ({
    id: `wh${i}`,
    url: "https://a-really-quite-long-hostname.example.com/integrations/silkllm/limit-events",
    events: ["key.limit_reached", "key.threshold_reached", "pool.limit_reached"],
    is_active: i !== 2, last_status: i === 1 ? 500 : 200,
    last_error: i === 1 ? "HTTP 500 from the endpoint, which returned a long body" : null,
    last_delivery_at: new Date().toISOString(), consecutive_failures: i === 1 ? 3 : 0,
  })),
  "/webhooks/events": [
    "key.limit_reached", "key.threshold_reached", "pool.limit_reached", "pool.threshold_reached", "key.revoked",
  ],
  "/billing/rate": { usd_to_ngn_rate: 1650.42, effective_rate: 1815.46 },
  "/admin/providers": ["openai", "anthropic", "google", "deepseek", "xai"].map((id, i) => ({
    id, name: id[0].toUpperCase() + id.slice(1), enabled: i !== 2, has_api_key: true,
    alert_threshold_percent: 20, last_known_balance: 120.5 - i * 20, last_topup_amount: 500,
  })),
  "/admin/models": MODELS,
  "/admin/topups": Array.from({ length: 5 }, (_, i) => ({
    id: `t${i}`, provider_id: "openai", amount: 500, remaining_after: 480,
    note: "A reasonably long note about this particular top-up transaction", created_at: new Date().toISOString(),
  })),
  "/admin/alerts": Array.from({ length: 5 }, (_, i) => ({
    id: `a${i}`, severity: ["critical", "warning", "info"][i % 3], alert_type: "low_balance",
    provider_id: "openai", message: "A long alert message describing exactly what went wrong and when.",
    acknowledged: i > 2, acknowledged_at: new Date().toISOString(), email_sent: true,
    created_at: new Date().toISOString(),
  })),
  "/admin/credits/users": Array.from({ length: 8 }, (_, i) => ({
    id: `u${i}`, name: "Alexandra Constantine-Fitzwilliam", email: LONG_EMAIL,
    role: i === 0 ? "admin" : "user", balance: 100 - i * 7.5, is_active: i !== 4,
    created_at: new Date().toISOString(),
  })),
  "/admin/credits/ledger": LEDGER,
  "/admin/settings": [
    { key: "markup_percent", label: "Platform markup percent", type: "float", value: 10 },
    { key: "trial_daily_limit_usd", label: "Free trial daily limit in USD", type: "float", value: 1 },
  ],
  "/admin/killswitch": [
    { key: "disable_all_generation", label: "Disable all generation", enabled: false },
    { key: "disable_marketplace", label: "Disable the marketplace", enabled: true },
  ],
  "/admin/marketplace/analytics": {
    total_provider_cost_served: 812.3, total_owner_earnings: 609.2, total_platform_fee: 203.1,
    total_free_value_served: 45.6, total_keys: 12, public_keys: 9, private_keys: 3,
    active_keys: 10, suspended_keys: 2,
    by_provider: [
      { provider_id: "openai", provider_cost_served: 400 },
      { provider_id: "anthropic", provider_cost_served: 250 },
      { provider_id: "google", provider_cost_served: 162.3 },
    ],
  },
  "/admin/marketplace/keys": {
    keys: Array.from({ length: 8 }, (_, i) => ({
      id: `mk${i}`, owner_email: LONG_EMAIL, provider_id: "openai", is_public: true,
      status: ["active", "suspended", "exhausted"][i % 3], earned_credits_total: 12.3,
      requests_served: 4321, provider_cost_served: 16.4, declared_budget_usd: 50,
    })),
  },
  "/admin/marketplace/owners": Array.from({ length: 5 }, (_, i) => ({
    owner_id: `o${i}`, owner_email: LONG_EMAIL, keys: 2, declared_budget_usd: 100,
    delivered_usd: 61.2, fulfillment_pct: 61, earned_credits_total: 45.9,
  })),
};

function fixtureFor(pathname) {
  const key = pathname.replace(/^\/api/, "").split("?")[0];
  if (FIXTURES[key] !== undefined) return FIXTURES[key];
  const hit = Object.keys(FIXTURES).find((k) => key.startsWith(k));
  return hit ? FIXTURES[hit] : {};
}

const findings = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
});

for (const theme of ["dark", "light"]) {
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({
      width: vp.width, height: vp.height,
      deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile,
    });
    if (vp.mobile) {
      // The tap-target rules are scoped to coarse pointers, which puppeteer
      // cannot emulate, so they are switched back on explicitly for the touch
      // runs. Without this the audit would measure the desktop code path.
      await page.evaluateOnNewDocument(() => {
        addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = ".tap-target::before{display:block !important}";
          document.head.appendChild(s);
        });
      });
    }
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.pathname.startsWith("/api/")) {
        req.respond({
          status: 200,
          contentType: "application/json",
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify(fixtureFor(url.pathname)),
        });
      } else if (url.origin !== new URL(BASE).origin) {
        // Block fonts and any other third-party asset so runs are deterministic.
        req.abort();
      } else {
        req.continue();
      }
    });

    await page.evaluateOnNewDocument((t) => {
      localStorage.setItem("silk_token", "test-token");
      localStorage.setItem("silk_theme", t);
      localStorage.setItem("silk_install_dismissed_at", String(Date.now()));
    }, theme);

    for (const route of ROUTES) {
      try {
        await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 20000 });
      } catch {
        findings.push({ theme, vp: vp.name, route, kind: "load-timeout", detail: "" });
        continue;
      }
      await new Promise((r) => setTimeout(r, 500));

      const result = await page.evaluate((checkTargets) => {
        const doc = document.documentElement;
        const vw = doc.clientWidth;
        const pageOverflow = Math.max(doc.scrollWidth, document.body.scrollWidth) - vw;

        // Find the specific elements sticking out past the viewport. Elements
        // inside a deliberate horizontal scroller are ignored: those are meant
        // to scroll, and they are the correct fix, not a bug.
        const culprits = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right <= vw + 1 && r.left >= -1) continue;
          let p = el.parentElement, scrollable = false;
          while (p && p !== document.body) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === "auto" || ox === "scroll" || ox === "hidden" || ox === "clip") { scrollable = true; break; }
            p = p.parentElement;
          }
          if (scrollable) continue;
          culprits.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && String(el.className).slice(0, 90)) || "",
            left: Math.round(r.left), right: Math.round(r.right),
          });
          if (culprits.length >= 5) break;
        }

        // Controls smaller than the platform minimum are hard to hit on touch.
        // The measurement is of the *hit* area, not the painted box: a small
        // control carrying a .tap-target pseudo-element is genuinely easy to
        // press even though its own rect is tiny, so that counts.
        const tiny = [];
        for (const el of checkTargets
          ? document.querySelectorAll("button, a[href], [role='button'], input, select")
          : []) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;

          let w = r.width, h = r.height;
          const before = getComputedStyle(el, "::before");
          if (before && before.content !== "none") {
            w = Math.max(w, parseFloat(before.minWidth) || 0, parseFloat(before.width) || 0);
            h = Math.max(h, parseFloat(before.minHeight) || 0, parseFloat(before.height) || 0);
          }

          // A checkbox or radio inside a label is pressed by tapping anywhere on
          // that label, so the label's box is the hit area. Measuring the input
          // alone reports a 16px target for a control that is comfortably a full
          // row wide, which is a measurement bug rather than a real finding.
          const owner = el.closest("label")
            || (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
          if (owner && owner !== el) {
            const lr = owner.getBoundingClientRect();
            if (lr.width > 0 && lr.height > 0) { w = Math.max(w, lr.width); h = Math.max(h, lr.height); }
          }

          if (h < 24 || w < 24) {
            tiny.push({ tag: el.tagName.toLowerCase(), w: Math.round(w), h: Math.round(h),
                        label: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40) });
          }
          if (tiny.length >= 5) break;
        }

        return { pageOverflow, culprits, tiny, title: document.title };
      }, vp.mobile);

      if (result.pageOverflow > 1) {
        findings.push({
          theme, vp: vp.name, route, kind: "overflow",
          detail: `${result.pageOverflow}px past viewport`,
          culprits: result.culprits,
        });
      }
      if (result.tiny.length) {
        findings.push({ theme, vp: vp.name, route, kind: "small-target", detail: JSON.stringify(result.tiny) });
      }
    }
    await page.close();
  }
}

await browser.close();

if (!findings.length) {
  console.log("PASS: no horizontal overflow or undersized targets across "
    + `${ROUTES.length} routes x ${VIEWPORTS.length} viewports x 2 themes.`);
} else {
  console.log(`${findings.length} finding(s):\n`);
  for (const f of findings) {
    console.log(`[${f.kind}] ${f.route}  ${f.vp}/${f.theme}  ${f.detail}`);
    for (const c of f.culprits || []) {
      console.log(`    <${c.tag} class="${c.cls}">  x: ${c.left}..${c.right}`);
    }
  }
  process.exitCode = 1;
}
