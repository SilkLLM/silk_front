/**
 * GuideArticle.tsx
 * Renders one guide at /guides/:slug from the registry in src/content/guides.tsx.
 * No JSON-LD here deliberately: an Article schema would need a publish date
 * this app doesn't track, and inventing one would be exactly the kind of
 * structured data the SEO playbook warns against - markup asserting something
 * the page doesn't actually represent.
 */

// File: silkllm-frontend/src/pages/public/GuideArticle.tsx

import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { getGuide } from "@/content/guides";
import { useSEO, useNoIndex } from "@/lib/seo";

function NotFound() {
  // An unknown slug still resolves to a real component (React Router's own
  // catch-all only fires for paths with no matching route at all), so this
  // needs its own noindex rather than inheriting one from anywhere else.
  useNoIndex();
  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />
      <div className="mx-auto max-w-[760px] gutter pt-32 pb-20 text-center">
        <p className="text-sm text-ink-2 mb-4">That guide doesn't exist (yet).</p>
        <Link to="/guides" className="btn-primary h-10 px-5 text-sm inline-flex">Browse all guides</Link>
      </div>
      <PublicFooter />
    </div>
  );
}

export default function GuideArticle() {
  const { slug } = useParams<{ slug: string }>();
  const guide = slug ? getGuide(slug) : undefined;

  // Hooks must run unconditionally, so this fires (harmlessly) even when we
  // are about to render NotFound instead. description/path are always real
  // values, even for a missing slug - useSEO only overwrites a tag when given
  // one, so an undefined value here would leave whatever page rendered before
  // this one's description/canonical in place rather than this page's own.
  useSEO({
    title: guide ? `${guide.title} — SilkLLM Guides` : "Guide not found — SilkLLM",
    description: guide?.description ?? "This guide doesn't exist. Browse the full list of SilkLLM guides.",
    path: guide ? `/guides/${guide.slug}` : `/guides/${slug ?? ""}`,
  });

  if (!guide) return <NotFound />;

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div className="mx-auto max-w-[760px] gutter pt-28 pb-20">
        <Link to="/guides" className="inline-flex items-center gap-1.5 text-2xs text-ink-3 hover:text-ink-2 mb-6">
          <ArrowLeft size={12} /> All guides
        </Link>

        <h1 className="font-display font-bold tracking-tight text-[1.75rem] sm:text-4xl leading-[1.1] text-ink mb-8">
          {guide.title}
        </h1>

        <article className="selectable">{guide.body}</article>

        <div className="mt-14 pt-8 border-t border-line text-center">
          <Link to="/login" className="btn-primary h-10 px-6 text-sm inline-flex">Get started free</Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/GuideArticle.tsx
