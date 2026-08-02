/**
 * audit-pwa.mjs
 * Checks that the installable-app pieces actually work in a browser, rather
 * than merely being present in the build output.
 *
 * Verifies: the manifest parses and is linked; the service worker registers and
 * activates; assets get cached; API responses do NOT get cached (the rule that
 * matters most, since those carry balances and keys); and a navigation still
 * resolves with the network cut.
 *
 * Usage: node scripts/audit-pwa.mjs [baseUrl]
 */

import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:4173";
const CHROME = "/usr/bin/google-chrome";

const checks = [];
const record = (name, pass, detail = "") => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();

// Stub the API so the app boots without a live backend.
await page.setRequestInterception(true);
page.on("request", (req) => {
  const url = new URL(req.url());
  if (url.pathname.startsWith("/api/")) {
    req.respond({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ balance: 1, models: [], entries: [], total: 0, notifications: [], unread: 0 }),
    });
  } else if (url.origin !== new URL(BASE).origin) {
    req.abort();
  } else {
    req.continue();
  }
});

await page.goto(BASE + "/", { waitUntil: "networkidle2" });

// ── Manifest ────────────────────────────────────────────────────────────────
const manifestHref = await page.$eval('link[rel="manifest"]', (el) => el.getAttribute("href")).catch(() => null);
record("manifest is linked from the document", !!manifestHref, manifestHref || "no <link rel=manifest>");

const manifest = await page.evaluate(async (href) => {
  const r = await fetch(href);
  return r.ok ? r.json() : null;
}, manifestHref || "/manifest.webmanifest");

record("manifest parses as JSON", !!manifest);
if (manifest) {
  record("manifest display is standalone", manifest.display === "standalone", manifest.display);
  record("manifest has 192 and 512 icons",
    ["192x192", "512x512"].every((s) => manifest.icons.some((i) => i.sizes === s)));
  record("manifest has a maskable icon",
    manifest.icons.some((i) => (i.purpose || "").includes("maskable")));
  record("manifest declares start_url and scope", !!manifest.start_url && !!manifest.scope,
    `${manifest.start_url} / ${manifest.scope}`);
}

// ── iOS chrome ──────────────────────────────────────────────────────────────
const ios = await page.evaluate(() => ({
  capable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
  statusBar: !!document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]'),
  touchIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
  splashes: document.querySelectorAll('link[rel="apple-touch-startup-image"]').length,
  viewportFit: (document.querySelector('meta[name="viewport"]')?.content || "").includes("viewport-fit=cover"),
}));
record("iOS standalone meta present", ios.capable && ios.statusBar);
record("apple-touch-icon present", ios.touchIcon);
record("iOS launch images present", ios.splashes > 0, `${ios.splashes} images`);
record("viewport opts into the safe area", ios.viewportFit);

// ── Service worker ──────────────────────────────────────────────────────────
const swReady = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return "not-registered";
  await navigator.serviceWorker.ready;
  return reg.active ? "active" : String(reg.installing?.state || "pending");
});
record("service worker reaches active", swReady === "active", swReady);

// Give the worker a beat to populate its caches, then exercise the routes.
await page.goto(BASE + "/dashboard", { waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 1500));

const cacheState = await page.evaluate(async () => {
  const names = await caches.keys();
  const out = { names, assets: 0, apiEntries: [] };
  for (const n of names) {
    const c = await caches.open(n);
    for (const req of await c.keys()) {
      const p = new URL(req.url).pathname;
      if (p.startsWith("/api/")) out.apiEntries.push(p);
      else out.assets += 1;
    }
  }
  return out;
});
record("caches were created", cacheState.names.length > 0, cacheState.names.join(", "));
record("static assets are cached", cacheState.assets > 0, `${cacheState.assets} entries`);
// The important one: authenticated responses must never land in a shared cache.
record("no API responses cached", cacheState.apiEntries.length === 0,
  cacheState.apiEntries.slice(0, 3).join(", ") || "none");

// ── Offline navigation ──────────────────────────────────────────────────────
await page.setOfflineMode(true);
let offlineOk = false;
let offlineDetail = "";
try {
  const resp = await page.goto(BASE + "/dashboard/usage", { waitUntil: "domcontentloaded", timeout: 15000 });
  // The app boots, then its first API call fails and the router settles on a
  // destination. Assert that the shell was served and React mounted, rather
  // than racing that settle and reading an empty body.
  await new Promise((r) => setTimeout(r, 2500));
  const state = await page.evaluate(() => ({
    mounted: (document.getElementById("root")?.children.length || 0) > 0,
    html: document.documentElement.outerHTML.length,
    text: document.body.innerText.trim().slice(0, 60),
  }));
  // resp is null when the app immediately routes elsewhere (offline, the auth
  // call fails and the router lands on the login screen), so the response
  // object is not the signal. What matters is that the shell was served from
  // cache and the app booted on top of it.
  offlineOk = state.mounted && state.html > 1000 && state.text.length > 0;
  offlineDetail = `shell ${state.html}b, mounted=${state.mounted}` +
    (state.text ? `, rendered "${state.text.split("\n").filter(Boolean).pop()}"` : ", no content");
} catch (e) {
  offlineDetail = String(e).slice(0, 80);
}
record("navigates while offline", offlineOk, offlineDetail);
await page.setOfflineMode(false);

await browser.close();

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) process.exitCode = 1;
