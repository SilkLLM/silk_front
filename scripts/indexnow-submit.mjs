/**
 * indexnow-submit.mjs
 * Notifies IndexNow-participating search engines (Bing, Yandex, and others
 * that read the shared endpoint) that the public URLs below were added or
 * changed, so they can be crawled sooner than waiting on the next scheduled
 * sitemap crawl. This does not affect Google, which does not participate in
 * IndexNow - Google discovery still runs through sitemap.xml + Search Console.
 *
 * The key file at public/<INDEXNOW_KEY>.txt (containing just the key) must be
 * live on the deployed site before this runs, since IndexNow verifies
 * ownership by fetching https://getsilkllm.com/<key>.txt and checking it
 * matches. Run this manually after a deploy that changed public content -
 * it is not wired into `build`, since it makes an outbound network call and a
 * build should stay side-effect free.
 *
 * Usage: node scripts/indexnow-submit.mjs
 */

const HOST = "getsilkllm.com";
const INDEXNOW_KEY = "7d0f46b53685104e4f4d4e9e8d8f59f8";
const KEY_LOCATION = `https://${HOST}/${INDEXNOW_KEY}.txt`;

// Keep in sync with PUBLIC_URLS in generate-sitemap.mjs.
const URL_LIST = [
  `https://${HOST}/`,
  `https://${HOST}/docs`,
  `https://${HOST}/marketplace`,
  `https://${HOST}/api-key-controls`,
  `https://${HOST}/multimodal`,
  `https://${HOST}/alternatives`,
  `https://${HOST}/guides`,
  `https://${HOST}/guides/llm-provider-failover`,
  `https://${HOST}/guides/one-api-key-multiple-providers`,
];

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: KEY_LOCATION,
    urlList: URL_LIST,
  }),
});

if (res.ok) {
  console.log(`IndexNow accepted the submission (${res.status}) for ${URL_LIST.length} URL(s).`);
} else {
  console.error(`IndexNow rejected the submission: ${res.status} ${res.statusText}`);
  console.error(await res.text().catch(() => ""));
  process.exitCode = 1;
}
