/**
 * seo.ts
 * Per-route document metadata for the two public, indexable pages (/ and
 * /docs). Everything else in the app is a dashboard behind auth and should
 * never compete with them in search results.
 *
 * The whole app is a single index.html (see vite.config.ts / _redirects), so
 * every route starts from the same static <title>/<meta> baked in at build
 * time. Without this, Google sees an identical title and description on
 * every route it renders - the exact "same title on every route" SPA SEO
 * failure mode. useSEO patches the tags a route actually cares about after
 * mount and restores the previous value on unmount, so navigating away never
 * leaves a stale title/description behind on the next page.
 */

// File: silkllm-frontend/src/lib/seo.ts

import { useEffect } from "react";

const SITE = "https://getsilkllm.com";
const JSONLD_ID = "silk-seo-jsonld";

function setMetaByName(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setMetaByProperty(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setCanonical(href: string) {
  let tag = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = "canonical";
    document.head.appendChild(tag);
  }
  tag.href = href;
}

interface SEOOptions {
  /** Rendered as-is; callers append " — SilkLLM" etc. themselves. */
  title: string;
  description?: string;
  /** Path only, e.g. "/docs" - resolved against the canonical host. */
  path?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

/** Public pages only. Sets title/description/canonical/OG and restores the
 *  previous values on unmount so leaving the page never leaks its metadata
 *  onto whatever renders next. */
export function useSEO({ title, description, path, jsonLd }: SEOOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    setMetaByProperty("og:title", title);
    setMetaByName("twitter:title", title);

    if (description) {
      setMetaByName("description", description);
      setMetaByProperty("og:description", description);
      setMetaByName("twitter:description", description);
    }

    const canonical = path ? `${SITE}${path}` : undefined;
    if (canonical) {
      setCanonical(canonical);
      setMetaByProperty("og:url", canonical);
    }

    let script: HTMLScriptElement | null = null;
    if (jsonLd) {
      script = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = JSONLD_ID;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      document.title = prevTitle;
      script?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, jsonLd]);
}

/** Private/auth-gated routes. The app is pure client-side rendering with a
 *  single HTML shell for every path, so there is no per-route HTTP response
 *  to mark noindex - this is the only lever available, and it only works for
 *  crawlers that execute JavaScript. robots.txt Disallow rules on these
 *  route prefixes are the defense-in-depth complement (see public/robots.txt);
 *  neither alone is sufficient, per Google's own guidance that a Disallowed
 *  page can still be indexed if it's linked from elsewhere. */
export function useNoIndex() {
  useEffect(() => {
    const tag = document.querySelector('meta[name="robots"]');
    const prev = tag?.getAttribute("content") ?? null;
    setMetaByName("robots", "noindex, nofollow");
    return () => {
      if (prev !== null) setMetaByName("robots", prev);
      else document.querySelector('meta[name="robots"]')?.remove();
    };
  }, []);
}
