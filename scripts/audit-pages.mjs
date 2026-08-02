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

async function newPage(browser, { keys = KEY_SHAPES.full, usageStatus = 200, budgets = POOL_SHAPES.full, hooks = HOOK_SHAPES.healthy, allocationSnapshot = { balance: 100, allocated: 0, available: 100 } } = {}) {
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

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
