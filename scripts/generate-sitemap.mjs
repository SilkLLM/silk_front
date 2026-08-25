/**
 * generate-sitemap.mjs
 * Writes public/sitemap.xml before `vite build` copies public/ into dist/, so
 * every deploy ships a sitemap without anyone hand-editing XML.
 *
 * PUBLIC_URLS is the source of truth and must be kept in sync with the public
 * routes in src/App.tsx by hand - this app has no CMS/content collection to
 * derive it from automatically, and this is a plain Node script that can't
 * import src/App.tsx's JSX/TSX directly without adding a build step just for
 * this. The /guides/:slug entries below must also be kept in sync with the
 * GUIDES array in src/content/guides.tsx - add a guide there, add its URL
 * here, same commit. Add a URL here the same day you add any public route,
 * or it silently never gets discovered through the sitemap.
 *
 * Usage: node scripts/generate-sitemap.mjs
 */

import fs from "node:fs";
import path from "node:path";

const BASE_URL = "https://getsilkllm.com";
const today = new Date().toISOString().slice(0, 10);

const PUBLIC_URLS = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/docs", changefreq: "weekly", priority: "0.9" },
  { loc: "/marketplace", changefreq: "monthly", priority: "0.8" },
  { loc: "/api-key-controls", changefreq: "monthly", priority: "0.8" },
  { loc: "/multimodal", changefreq: "monthly", priority: "0.8" },
  { loc: "/alternatives", changefreq: "monthly", priority: "0.7" },
  { loc: "/guides", changefreq: "weekly", priority: "0.6" },
  { loc: "/guides/llm-provider-failover", changefreq: "monthly", priority: "0.6" },
  { loc: "/guides/one-api-key-multiple-providers", changefreq: "monthly", priority: "0.6" },
];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PUBLIC_URLS.map(
  (u) => `  <url>
    <loc>${BASE_URL}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
).join("\n")}
</urlset>
`;

const outDir = "public";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "sitemap.xml"), xml, "utf8");

console.log(`Wrote ${outDir}/sitemap.xml with ${PUBLIC_URLS.length} URLs.`);
