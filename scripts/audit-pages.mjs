/**
 * audit-pages.mjs
 * Drives real interactions on real pages and fails on any uncaught error.
 *
 * The layout audit renders pages with well-formed fixtures and measures
 * geometry. That is not enough: it never clicks anything, and its fixtures are
 * always the *current* API shape. Both gaps let a real bug through, where
 * creating an API key crashed the page because a response legitimately omits
 * fields the render assumed were present.
 *
 * So this file does the two things that audit cannot:
 *
 *   1. It performs the interactions a user performs (type, submit, open a
 *      dialog), not just the initial paint.
 *   2. It serves degraded API shapes on purpose - fields missing, nulls where
 *      numbers are expected, empty lists, error statuses - because a frontend
 *      that only works against a perfectly matched backend will break during
 *      any rollout where the two are briefly out of step.
 *
 * Usage: node scripts/audit-pages.mjs [baseUrl]
 */

import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:4173";
const CHROME = "/usr/bin/google-chrome";

const results = [];
const record = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const USER = { id: "u1", email: "dev@example.com", name: "Dev", role: "admin", balance: 42.5 };

/** A fully-formed key, as a current backend returns it from the list endpoint. */
const fullKey = (over = {}) => ({
  id: "k1", name: "Production", created_at: new Date().toISOString(),
  last_used: null, is_active: true, spend_limit_usd: 5, spent_usd: 1.25,
  remaining_usd: 3.75, is_exhausted: false, limit_reset_at: null, ...over,
});

/**
 * The response shapes worth defending against.
 *
 * `legacy` is the one that actually broke production: a key object without the
 * spend-cap fields, which is what a backend that has not yet run the migration
 * returns, and what the create endpoint returns by design.
 */
const KEY_SHAPES = {
  full: [fullKey()],
  uncapped: [fullKey({ spend_limit_usd: null, remaining_usd: null, spent_usd: 0.5 })],
  exhausted: [fullKey({ spent_usd: 5.2, remaining_usd: 0, is_exhausted: true })],
  legacy: [{ id: "k1", name: "Old key", created_at: new Date().toISOString(), last_used: null, is_active: true }],
  nulls: [{ ...fullKey(), spend_limit_usd: null, spent_usd: null, remaining_usd: null, is_exhausted: null }],
  empty: [],
};

async function newPage(browser, { keys = KEY_SHAPES.full, usageStatus = 200, budgets = POOL_SHAPES.full, hooks = HOOK_SHAPES.healthy, allocationSnapshot = { balance: 100, allocated: 0, available: 100 }, promotions = PROMO_SHAPES.full, activePromotion = PROMO_SHAPES.full[0], adminPromotions = ADMIN_PROMO_SHAPES.full, redeemStatus = 201 } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Only genuine page errors matter; blocked third-party assets do not.
    if (m.type() === "error" && !/Failed to load resource/.test(m.text())) {
      errors.push(m.text().slice(0, 200));
    }
  });

  await page.setViewport({ width: 1280, height: 900 });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url());
    const json = (body, status = 200) =>
      req.respond({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (!url.pathname.startsWith("/api/")) {
      if (url.origin !== new URL(BASE).origin) return req.abort();
      return req.continue();
    }
    const p = url.pathname;
    if (p === "/api/auth/me") return json(USER);
    if (p === "/api/keys" && req.method() === "POST") {
      // Deliberately the narrow create shape: no spent_usd, no remaining_usd,
      // no is_exhausted. This is what the real endpoint returns.
      return json({
        id: "new", name: "Test key", key: `silk_${"a".repeat(60)}`,
        created_at: new Date().toISOString(), spend_limit_usd: 5,
      }, 201);
    }
    if (p === "/api/keys") return json(keys);
    if (/^\/api\/keys\/[^/]+\/usage$/.test(p)) {
      return json({
        key_id: "k1", key_name: "Production", total: 2, page: 1, page_size: 25,
        total_cost_usd: 0.5, total_requests: 2, total_prompt_tokens: 100, total_completion_tokens: 50,
        entries: [
          { id: "e1", created_at: new Date().toISOString(), endpoint: "generate", status: "ok",
            cost_usd: 0.25, prompt_tokens: 50, completion_tokens: 25,
            requested_model: "gpt-4o", served_model: "gpt-4o", provider_id: "openai",
            detail: null, latency_ms: 420 },
          // A refused row, including nulls in the optional columns.
          { id: "e2", created_at: new Date().toISOString(), endpoint: "generate", status: "limit_exceeded",
            cost_usd: 0, prompt_tokens: 0, completion_tokens: 0,
            requested_model: null, served_model: null, provider_id: null,
            detail: "Cap reached", latency_ms: null },
        ],
      });
    }
    if (p === "/api/usage") {
      const size = Number(url.searchParams.get("page_size") || 20);
      // Mirror the server's real validation: page_size above 100 is a 422.
      if (size > 100 || usageStatus === 422) {
        return json({ detail: [{ loc: ["query", "page_size"], msg: "less than or equal to 100" }] }, 422);
      }
      return json({ total: 0, entries: [] });
    }
    if (p === "/api/keys/allocation") return json(allocationSnapshot);
    if (p === "/api/promotions/active") return json(activePromotion);
    if (p === "/api/promotions/redeem") {
      return redeemStatus === 201
        ? json({ ...PROMO_SHAPES.full[0], id: "new" }, 201)
        : json({ error: { code: "promotion_already_redeemed", message: "You have already redeemed this code." } }, 400);
    }
    if (p === "/api/promotions") return json(promotions);
    if (p === "/api/admin/promotions/stats") return json(ADMIN_PROMO_STATS);
    if (/^\/api\/admin\/promotions\/[^/]+\/redemptions$/.test(p)) return json(ADMIN_REDEMPTIONS);
    if (p === "/api/admin/promotions") return json(adminPromotions);
    if (/^\/api\/keys\/[^/]+\/permanent$/.test(p) && req.method() === "DELETE") {
      return req.respond({ status: 204, body: "" });
    }
    if (p === "/api/budgets" && req.method() === "POST") {
      return json({ id: "p-new", name: "Team", spend_limit_usd: 25, spent_usd: 0,
                    key_count: 0, created_at: new Date().toISOString() }, 201);
    }
    if (p === "/api/budgets") return json(budgets);
    if (p === "/api/webhooks/events") return json(WEBHOOK_EVENTS);
    if (p === "/api/webhooks" && req.method() === "POST") {
      // The secret comes back once, on create, and never again.
      return json({ id: "wh-new", url: "https://example.com/hook", events: ["key.limit_reached"],
                    is_active: true, secret: "s".repeat(64), last_status: null, last_error: null,
                    last_delivery_at: null, consecutive_failures: 0 }, 201);
    }
    if (p === "/api/webhooks") return json(hooks);
    if (p === "/api/models") return json({ models: [] });
    if (p === "/api/trial") return json({ active: false });
    if (p === "/api/notifications/unread-count") return json({ unread: 0 });
    if (p === "/api/notifications") return json({ unread: 0, notifications: [] });
    if (p === "/api/provider-keys") return json([]);
    if (p === "/api/balance") return json({ balance: 42.5 });
    return json({});
  });

  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("silk_token", "test-token");
    localStorage.setItem("silk_theme", "dark");
    localStorage.setItem("silk_install_dismissed_at", String(Date.now()));
  });
  return { page, errors };
}

// The real event names, as served by GET /api/webhooks/events.
const WEBHOOK_EVENTS = [
  "key.limit_reached", "key.threshold_reached", "pool.limit_reached", "pool.threshold_reached", "key.revoked",
];

/**
 * Budget and webhook shapes, including the ones a half-deployed or erroring
 * backend produces. `{}` is the important one: it is truthy, so every
 * `(data || []).map` throws on it, which is how the keys page broke.
 */
const POOL_SHAPES = {
  full: [{ id: "p1", name: "Mobile team", spend_limit_usd: 100, spent_usd: 42.5,
           key_count: 3, created_at: new Date().toISOString(), limit_reset_at: null }],
  uncapped: [{ id: "p2", name: "Reporting", spend_limit_usd: null, spent_usd: 12,
               key_count: 1, created_at: new Date().toISOString() }],
  exhausted: [{ id: "p3", name: "Staging", spend_limit_usd: 10, spent_usd: 10,
                key_count: 2, created_at: new Date().toISOString() }],
  nulls: [{ id: "p4", name: "Partial", spend_limit_usd: null, spent_usd: null,
            key_count: null, created_at: new Date().toISOString() }],
  empty: [],
  notAList: {},
};

const HOOK_SHAPES = {
  healthy: [{ id: "h1", url: "https://example.com/hook", events: ["key.limit_reached"],
              is_active: true, last_status: 200, last_error: null,
              last_delivery_at: new Date().toISOString(), consecutive_failures: 0 }],
  failing: [{ id: "h2", url: "https://example.com/down", events: ["pool.limit_reached"],
              is_active: false, last_status: 500, last_error: "HTTP 500",
              last_delivery_at: new Date().toISOString(), consecutive_failures: 10 }],
  empty: [],
  notAList: {},
};

/**
 * Promotion shapes, including the degraded ones. `notAList` is the important
 * one: an object body is truthy, so every `(data || []).map` throws on it.
 */
const PROMO_SHAPES = {
  full: [{
    id: "r1", promotion_name: "Launch week", description: "20% off our fees",
    discount_percent: 20, redeemed_at: new Date().toISOString(),
    expires_at: new Date().toISOString(), is_active: true,
    uses_count: 12, fee_saved_usd: 1.2345,
    applies_to_models: null, applies_to_providers: null,
    summary: "20% off the SilkLLM fee. Your credit balance is unchanged.",
  }],
  expired: [{
    id: "r2", promotion_name: "Old campaign", description: null,
    discount_percent: 50, redeemed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() - 86400000).toISOString(), is_active: false,
    uses_count: 0, fee_saved_usd: 0,
    applies_to_models: null, applies_to_providers: null, summary: "Ended.",
  }],
  empty: [],
  notAList: {},
};

const ADMIN_PROMO_SHAPES = {
  full: [{
    id: "p1", code: "LAUNCH-ABC123", name: "Launch week", description: "20% off",
    discount_percent: 20, max_redemptions: 100, redemption_count: 42, seats_left: 58,
    starts_at: null, expires_at: new Date().toISOString(), duration_days: 30,
    restricted_user_ids: null, restricted_emails: null,
    allowed_models: null, allowed_providers: null, is_active: true,
    created_at: new Date().toISOString(), unavailable_reason: null,
    total_fee_saved_usd: 12.34, total_uses: 98,
  }],
  directGrant: [{
    id: "p2", code: null, name: "Partner rate", description: null,
    discount_percent: 40, max_redemptions: null, redemption_count: 3, seats_left: null,
    starts_at: null, expires_at: null, duration_days: null,
    restricted_user_ids: null, restricted_emails: null,
    allowed_models: null, allowed_providers: null, is_active: true,
    created_at: new Date().toISOString(), unavailable_reason: null,
    total_fee_saved_usd: 4.5, total_uses: 12,
  }],
  empty: [],
  notAList: {},
};

const ADMIN_PROMO_STATS = {
  total_promotions: 2, live_promotions: 1, codes: 1, direct_grants: 1,
  total_redemptions: 45, distinct_users: 40, total_uses: 110,
  total_fee_given_up_usd: 16.84, expiring_soon: [],
};

const ADMIN_REDEMPTIONS = [{
  id: "x1", user_id: "u1", user_email: "someone@example.com", user_name: "Someone",
  discount_percent: 20, redeemed_at: new Date().toISOString(),
  expires_at: null, is_active: true, uses_count: 9, fee_saved_usd: 1.23,
}];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

// ── Every key shape must render without throwing ────────────────────────────
for (const [shape, keys] of Object.entries(KEY_SHAPES)) {
  const { page, errors } = await newPage(browser, { keys });
  await page.goto(`${BASE}/dashboard/keys`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  record(`keys page renders with a "${shape}" response`, errors.length === 0, errors[0] || "");
  await page.close();
}

// ── Creating a key, which is where the production crash happened ────────────
{
  const { page, errors } = await newPage(browser, { keys: KEY_SHAPES.legacy });
  await page.goto(`${BASE}/dashboard/keys`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 500));
  await page.type('input[placeholder^="Name this key"]', "Test key");
  await page.evaluate(() => {
    document.querySelectorAll("input[type=checkbox]")[0]?.click();
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Create key"))?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const secretShown = await page.evaluate(() => document.body.innerText.includes("Save your API key"));
  record("creating a capped key does not throw", errors.length === 0, errors[0] || "");
  record("the one-time secret dialog opens", secretShown);
  await page.close();
}

// ── The activity dialog, including a refused row with null columns ──────────
{
  const { page, errors } = await newPage(browser, { keys: KEY_SHAPES.full });
  await page.goto(`${BASE}/dashboard/keys`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => {
    document.querySelector('button[aria-label^="Activity for"]')?.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  const opened = await page.evaluate(() => document.body.innerText.includes("Activity for"));
  record("the activity dialog opens and renders history", errors.length === 0 && opened, errors[0] || "");
  await page.close();
}

// ── The edit dialog ─────────────────────────────────────────────────────────
{
  const { page, errors } = await newPage(browser, { keys: KEY_SHAPES.exhausted });
  await page.goto(`${BASE}/dashboard/keys`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 600));
  await page.evaluate(() => {
    document.querySelector('button[aria-label^="Edit"]')?.click();
  });
  await new Promise((r) => setTimeout(r, 700));
  const opened = await page.evaluate(() => document.body.innerText.includes("Spend limit"));
  record("the edit dialog opens on an exhausted key", errors.length === 0 && opened, errors[0] || "");
  await page.close();
}

// ── No page may ask the server for a page size it rejects ───────────────────
{
  const { page, errors } = await newPage(browser);
  const rejected = [];
  page.on("response", (res) => {
    if (res.status() === 422 && res.url().includes("/api/")) rejected.push(new URL(res.url()).pathname + new URL(res.url()).search);
  });
  for (const route of ["/dashboard", "/dashboard/usage", "/dashboard/keys", "/dashboard/billing"]) {
    await page.goto(BASE + route, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 600));
  }
  record("no request is rejected as invalid", rejected.length === 0, rejected.slice(0, 2).join(", "));
  record("dashboard routes raise no page errors", errors.length === 0, errors[0] || "");
  await page.close();
}

// ── Budgets page: every shape, including responses that are not lists ───────
for (const [shape, budgets] of Object.entries(POOL_SHAPES)) {
  const { page, errors } = await newPage(browser, { budgets });
  await page.goto(`${BASE}/dashboard/budgets`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  record(`budgets page renders with a "${shape}" budget response`, errors.length === 0, errors[0] || "");
  await page.close();
}

for (const [shape, hooks] of Object.entries(HOOK_SHAPES)) {
  const { page, errors } = await newPage(browser, { hooks });
  await page.goto(`${BASE}/dashboard/budgets`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  record(`budgets page renders with a "${shape}" webhook response`, errors.length === 0, errors[0] || "");
  await page.close();
}

// ── Creating a webhook shows the secret exactly once ────────────────────────
{
  const { page, errors } = await newPage(browser);
  await page.goto(`${BASE}/dashboard/budgets`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  await page.type('input[placeholder^="https://your-app"]', "https://example.com/hook");
  await page.evaluate(() => {
    // The first event checkbox. The button stays disabled until one is picked,
    // which is itself worth exercising.
    const boxes = [...document.querySelectorAll("input[type=checkbox]")];
    boxes[boxes.length - 4]?.click();
  });
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Add webhook"))?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  const shown = await page.evaluate(() => document.body.innerText.includes("Save your signing secret"));
  record("creating a webhook does not throw", errors.length === 0, errors[0] || "");
  record("the signing secret dialog opens", shown);
  await page.close();
}

// ── A key can be given every control without the page throwing ──────────────
{
  const { page, errors } = await newPage(browser, { keys: KEY_SHAPES.full });
  await page.goto(`${BASE}/dashboard/keys`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 600));
  await page.type('input[placeholder^="Name this key"]', "Fully controlled");
  // Tick the cap, its alert, the model allowlist and the rate limit in turn.
  for (const i of [0, 1, 2, 3]) {
    await page.evaluate((n) => {
      document.querySelectorAll("input[type=checkbox]")[n]?.click();
    }, i);
    await new Promise((r) => setTimeout(r, 200));
  }
  const blocked = await page.evaluate(() =>
    document.body.innerText.includes("Choose at least one model"));
  record("an empty model allowlist blocks creation with a reason", blocked);
  record("toggling every control raises no page error", errors.length === 0, errors[0] || "");
  await page.close();
}

// ── A cap above what is unallocated must be caught, and offer a way out ─────
{
  const { page, errors } = await newPage(browser, {
    keys: KEY_SHAPES.empty,
    allocationSnapshot: { balance: 10, allocated: 8, available: 2 },
  });
  await page.goto(`${BASE}/dashboard/keys`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  await page.type('input[placeholder^="Name this key"]', "Over budget");
  await page.evaluate(() => document.querySelectorAll("input[type=checkbox]")[0]?.click());
  await new Promise((r) => setTimeout(r, 250));
  // The default cap is $10, against $2 available.
  const warned = await page.evaluate(() => document.body.innerText.includes("You do not have"));
  const blocked = await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Create key"))?.disabled === true);
  record("a cap above the unallocated balance is refused in the UI", warned && blocked,
         `warned=${warned} blocked=${blocked}`);

  // "Use my maximum" must drop it to exactly what is free, and unblock the form.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Use my maximum"))?.click();
  });
  await new Promise((r) => setTimeout(r, 350));
  const nowAllowed = await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Create key"))?.disabled === false);
  record("\"use my maximum\" sets an allocatable cap", nowAllowed);
  record("the allocation dialog raises no page error", errors.length === 0, errors[0] || "");
  await page.close();
}

// ── Declining the limit entirely also unblocks ──────────────────────────────
{
  const { page } = await newPage(browser, {
    keys: KEY_SHAPES.empty,
    allocationSnapshot: { balance: 10, allocated: 10, available: 0 },
  });
  await page.goto(`${BASE}/dashboard/keys`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  await page.type('input[placeholder^="Name this key"]', "No limit please");
  await page.evaluate(() => document.querySelectorAll("input[type=checkbox]")[0]?.click());
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("No limit"))?.click();
  });
  await new Promise((r) => setTimeout(r, 350));
  const allowed = await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Create key"))?.disabled === false);
  record("declining the limit lets the key be created uncapped", allowed);
  await page.close();
}

// ── A revoked key offers a permanent delete ─────────────────────────────────
{
  const revoked = [{ ...KEY_SHAPES.full[0], id: "revoked1", name: "Old key", is_active: false }];
  const { page, errors } = await newPage(browser, { keys: revoked });
  await page.goto(`${BASE}/dashboard/keys`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  const hasDelete = await page.evaluate(() =>
    !!document.querySelector('button[aria-label^="Delete"][aria-label*="permanently"]'));
  record("a revoked key offers a permanent delete", hasDelete);

  await page.evaluate(() =>
    document.querySelector('button[aria-label*="permanently"]')?.click());
  await new Promise((r) => setTimeout(r, 500));
  const confirms = await page.evaluate(() => document.body.innerText.includes("for good"));
  record("deleting asks for confirmation first", confirms);
  record("the delete flow raises no page error", errors.length === 0, errors[0] || "");
  await page.close();
}

// ── Promotions: every shape, user side and admin side ───────────────────────
for (const [shape, promotions] of Object.entries(PROMO_SHAPES)) {
  const active = Array.isArray(promotions) ? promotions[0] ?? null : null;
  const { page, errors } = await newPage(browser, { promotions, activePromotion: active });
  await page.goto(`${BASE}/dashboard/promotions`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  record(`promotions page renders with a "${shape}" response`, errors.length === 0, errors[0] || "");
  await page.close();
}

for (const [shape, adminPromotions] of Object.entries(ADMIN_PROMO_SHAPES)) {
  const { page, errors } = await newPage(browser, { adminPromotions });
  await page.goto(`${BASE}/admin/promotions`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  record(`admin promotions renders with a "${shape}" response`, errors.length === 0, errors[0] || "");
  await page.close();
}

// ── A customer must be told what a code does, and what it does not ──────────
{
  const { page, errors } = await newPage(browser);
  await page.goto(`${BASE}/dashboard/promotions`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  const text = await page.evaluate(() => document.body.innerText);
  record("the page says a discount is off the fee, not credit",
         /fee/i.test(text) && /balance/i.test(text));
  record("the active discount is shown with what it has saved", /saved/i.test(text));
  record("the promotions page raises no page error", errors.length === 0, errors[0] || "");
  await page.close();
}

// ── Redeeming, and a refusal that has to read clearly ───────────────────────
{
  const { page, errors } = await newPage(browser, { promotions: PROMO_SHAPES.empty, activePromotion: null });
  await page.goto(`${BASE}/dashboard/promotions`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  await page.type('input[placeholder^="Enter your promo code"]', "launch-abc");
  const upper = await page.evaluate(() =>
    document.querySelector('input[placeholder^="Enter your promo code"]')?.value);
  record("a typed code is upper-cased as it is entered", upper === "LAUNCH-ABC", String(upper));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Redeem")?.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  const after = await page.evaluate(() => document.body.innerText);
  record("a successful redemption explains the benefit", /applied/i.test(after));
  record("redeeming raises no page error", errors.length === 0, errors[0] || "");
  await page.close();
}

{
  const { page } = await newPage(browser, {
    promotions: PROMO_SHAPES.empty, activePromotion: null, redeemStatus: 400,
  });
  await page.goto(`${BASE}/dashboard/promotions`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  await page.type('input[placeholder^="Enter your promo code"]', "USED");
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Redeem")?.click();
  });
  await new Promise((r) => setTimeout(r, 900));
  const shown = await page.evaluate(() => document.body.innerText);
  record("a refused code shows the server's reason",
         /already redeemed/i.test(shown), shown.slice(0, 80));
  await page.close();
}

// ── The admin form must refuse a discount above 100% of the fee ─────────────
{
  const { page, errors } = await newPage(browser, { adminPromotions: ADMIN_PROMO_SHAPES.empty });
  await page.goto(`${BASE}/admin/promotions`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 700));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("New promotion"))?.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  await page.type('input[placeholder="Launch week"]', "Too generous");
  await page.evaluate(() => {
    const input = [...document.querySelectorAll('input[type=number]')][0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, "150");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 400));
  const blocked = await page.evaluate(() =>
    [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Create promotion"))?.disabled === true);
  const explained = await page.evaluate(() =>
    document.body.innerText.includes("between 1 and 100 percent"));
  record("a discount above 100% of the fee is blocked in the admin form", blocked && explained,
         `blocked=${blocked} explained=${explained}`);
  record("the admin promotion form raises no page error", errors.length === 0, errors[0] || "");
  await page.close();
}

// ── The maintenance screen: shown for an outage, and only for an outage ─────
{
  // Every API call fails the way a dead backend fails: no response at all.
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("silk_token", "test-token");
    localStorage.setItem("silk_theme", "dark");
    localStorage.setItem("silk_install_dismissed_at", String(Date.now()));
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/") || url.pathname === "/health") return req.abort();
    if (url.origin !== new URL(BASE).origin) return req.abort();
    req.continue();
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2500));
  const text = await page.evaluate(() => document.body.innerText);
  record("an unreachable backend shows the maintenance screen",
         /be back shortly|you are offline/i.test(text), text.slice(0, 90));
  record("the maintenance screen reassures rather than alarms",
         /nothing is lost|balance/i.test(text) || /offline/i.test(text));
  record("the maintenance screen raises no page error", errors.length === 0, errors[0] || "");
  await page.close();
}

{
  // A 404 means the server is up and answered. Covering the app for that would
  // hide real errors behind a reassuring screen, so it must NOT trigger.
  const { page } = await newPage(browser);
  await page.setRequestInterception(false);
  const p2 = await browser.newPage();
  await p2.setViewport({ width: 1280, height: 900 });
  await p2.evaluateOnNewDocument(() => {
    localStorage.setItem("silk_token", "test-token");
    localStorage.setItem("silk_install_dismissed_at", String(Date.now()));
  });
  await p2.setRequestInterception(true);
  p2.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/auth/me") {
        return req.respond({ status: 200, contentType: "application/json",
          body: JSON.stringify(USER) });
      }
      return req.respond({ status: 404, contentType: "application/json",
        body: JSON.stringify({ detail: "Not found" }) });
    }
    if (url.origin !== new URL(BASE).origin) return req.abort();
    req.continue();
  });
  await p2.goto(`${BASE}/dashboard`, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1200));
  const text = await p2.evaluate(() => document.body.innerText);
  record("a 404 does not trigger the maintenance screen",
         !/be back shortly/i.test(text), text.slice(0, 70));
  await p2.close();
  await page.close();
}

// ── Signing in when the backend is dead must not leave the app ──────────────
{
  // OAuth is a full page navigation, so a dead backend used to hand the browser
  // its own 502 page with no React left to catch it.
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1280, height: 900 });
  let navigatedAway = false;
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname.includes("/auth/google/login")) { navigatedAway = true; return req.abort(); }
    if (url.pathname.startsWith("/api/") || url.pathname === "/health" || url.pathname === "/ready") {
      return req.abort();
    }
    if (url.origin !== new URL(BASE).origin) return req.abort();
    req.continue();
  });
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 1200));
  await page.evaluate(() => {
    [...document.querySelectorAll("button")]
      .find((b) => b.textContent.includes("Continue with Google"))?.click();
  });
  await new Promise((r) => setTimeout(r, 2000));
  const text = await page.evaluate(() => document.body.innerText);
  record("signing in with a dead backend never navigates away", !navigatedAway);
  record("signing in with a dead backend shows the maintenance screen",
         /be back shortly|you are offline/i.test(text), text.slice(0, 80));
  record("the guarded sign-in raises no page error", errors.length === 0, errors[0] || "");
  await page.close();
}

// ── A 503 from the schema gate is treated as an outage, not a bug ───────────
{
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("silk_token", "test-token");
    localStorage.setItem("silk_install_dismissed_at", String(Date.now()));
  });
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname.startsWith("/api/")) {
      return req.respond({
        status: 503, contentType: "application/json",
        body: JSON.stringify({ error: { code: "service_starting", message: "Finishing an update." } }),
      });
    }
    if (url.origin !== new URL(BASE).origin) return req.abort();
    req.continue();
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2000));
  const text = await page.evaluate(() => document.body.innerText);
  record("a 503 while the schema updates shows the maintenance screen",
         /be back shortly|you are offline/i.test(text), text.slice(0, 80));
  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
