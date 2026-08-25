/**
 * Guides.tsx
 * Index of long-form, single-topic guides at /guides - the informational,
 * "how do I..." end of search intent that a product page or API reference
 * doesn't target well on its own. Content lives in src/content/guides.tsx, the
 * one place a new guide needs adding for it to show up here, at its own
 * article route, and in the sitemap.
 */

// File: silkllm-frontend/src/pages/public/Guides.tsx

import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { PageHero } from "@/components/public/Prose";
import { GUIDES } from "@/content/guides";
import { useSEO } from "@/lib/seo";

export default function Guides() {
  useSEO({
    title: "Guides — SilkLLM",
    description: "Practical guides for building on SilkLLM: provider failover, switching models across providers, and more.",
    path: "/guides",
  });

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div className="mx-auto max-w-[760px] gutter pt-28 pb-20">
        <PageHero eyebrow="Guides" title="Guides" subtitle="Practical, single-topic write-ups for building on SilkLLM." />

        <div className="space-y-3">
          {GUIDES.map((g) => (
            <Link
              key={g.slug}
              to={`/guides/${g.slug}`}
              className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-surface p-5 hover:border-line-strong hover:bg-sunken transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{g.title}</p>
                <p className="text-sm text-ink-2 mt-1 leading-relaxed">{g.summary}</p>
              </div>
              <ArrowRight size={16} className="shrink-0 text-ink-3 group-hover:text-ink-2 group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Guides.tsx
