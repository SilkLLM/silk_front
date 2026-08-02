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

async function newPage(browser, { keys = KEY_SHAPES.full, usageStatus = 200 } = {}) {
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

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
