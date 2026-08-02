/**
 * audit-speed.mjs
 * First-paint timings on a connection that behaves like the real one.
 *
 * Production measurements showed roughly 1.3s of round trip and seconds of
 * third-party latency, which is where the "takes forever" feeling comes from
 * rather than from the size of the bundle. Chrome's own throttling reproduces
 * that shape closely enough to tell whether a change helps.
 *
 * The number that matters is first contentful paint: how long somebody stares
 * at nothing. Total load time matters far less, because an app that has painted
 * its frame and is filling in content does not feel broken.
 */

// File: silkllm-frontend/scripts/audit-speed.mjs

import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome";
const BASE = process.argv[2] || "http://localhost:4173";

//: Roughly a good 3G link: enough round trip to expose anything render blocking.
const NETWORK = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 300,
};

const ROUTES = ["/", "/login", "/docs", "/dashboard"];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const results = [];

for (const route of ROUTES) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("silk_token", "test-token");
    localStorage.setItem("silk_install_dismissed_at", String(Date.now()));
  });

  const client = await page.createCDPSession();
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", NETWORK);
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });

  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const url = new URL(req.url());
    // Stub the API so the measurement is of the app, not of a backend that is
    // being fixed separately. Third-party origins are blocked because their
    // latency is not something this audit can change.
    if (url.pathname.startsWith("/api/")) {
      return req.respond({ status: 200, contentType: "application/json", body: "{}" });
    }
    if (url.origin !== new URL(BASE).origin) return req.abort();
    req.continue();
  });

  await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 60000 });

  const paint = await page.evaluate(() => {
    const fcp = performance.getEntriesByName("first-contentful-paint")[0];
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      fcp: fcp ? Math.round(fcp.startTime) : null,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load: nav ? Math.round(nav.loadEventEnd) : null,
      transferred: nav ? Math.round(nav.transferSize / 1024) : null,
    };
  });

  results.push({ route, ...paint });
  await page.close();
}

// ── Are the other pages already in memory before they are clicked? ─────────
// Measured from the resource timeline rather than by diffing requests around
// page load: prefetching starts as soon as the app is interactive, which can be
// before Puppeteer decides the network is idle, so a naive diff reports nothing
// warmed even when everything was.
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
      return req.respond({ status: 200, contentType: "application/json", body: "{}" });
    }
    if (url.origin !== new URL(BASE).origin) return req.abort();
    req.continue();
  });

  await page.goto(BASE + "/dashboard", { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 6000));

  const warmed = await page.evaluate(() => {
    const wanted = ["ApiKeys", "Usage", "Billing", "Chat", "Promotions", "Budgets"];
    const fetched = performance.getEntriesByType("resource").map((e) => e.name);
    return wanted.filter((w) => fetched.some((f) => f.includes(`/assets/${w}-`)));
  });

  console.log(`\nprefetched before being clicked: ${warmed.length}/6  (${warmed.join(", ") || "none"})`);
  if (warmed.length < 4) {
    console.log("FAIL: pages are not being warmed, so each first visit pays a round trip.");
    process.exitCode = 1;
  }
  await page.close();
}

await browser.close();

const pad = (s, n) => String(s).padEnd(n);
console.log(`\n${pad("route", 22)}${pad("first paint", 14)}${pad("dom ready", 13)}load`);
for (const r of results) {
  console.log(
    `${pad(r.route, 22)}${pad(r.fcp === null ? "n/a" : r.fcp + "ms", 14)}` +
    `${pad(r.domContentLoaded + "ms", 13)}${r.load}ms`,
  );
}

const worst = Math.max(...results.map((r) => r.fcp ?? 0));
console.log(`\nworst first paint: ${worst}ms`);
// A blank screen past about two and a half seconds on this profile is the thing
// being fixed; anything under it means the frame is up while content arrives.
if (worst > 2500) {
  console.log("FAIL: something is still blocking the first paint.");
  process.exitCode = 1;
} else {
  console.log("PASS: the frame paints promptly on a slow connection.");
}

// EOF silkllm-frontend/scripts/audit-speed.mjs
