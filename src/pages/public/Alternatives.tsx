/**
 * Alternatives.tsx
 * Comparison page for people searching "<competitor> alternative" - the
 * highest-converting kind of traffic a new product can get, since the visitor
 * has already decided they want a gateway/router and is just picking one.
 *
 * Deliberately conservative about competitor claims: characterizations here
 * are each project's own well-known public positioning, not granular feature
 * audits, and pricing is never quoted since it changes independently of this
 * page. Anywhere a capability isn't confidently known it's marked "Varies"
 * rather than asserted, and the page says outright to verify current details
 * on each project's own site - accuracy matters more than a tidier table.
 */

// File: silkllm-frontend/src/pages/public/Alternatives.tsx

import React from "react";
import { Link } from "react-router-dom";
import { Check, Minus, HelpCircle } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { Para, H2, Callout, FAQItem, PageHero } from "@/components/public/Prose";
import { useSEO } from "@/lib/seo";

type Cell = "yes" | "no" | "varies";

function Mark({ v }: { v: Cell }) {
  if (v === "yes") return <Check size={16} className="text-success mx-auto" aria-label="Yes" />;
  if (v === "no") return <Minus size={16} className="text-ink-3 mx-auto" aria-label="No" />;
  return <HelpCircle size={16} className="text-ink-3 mx-auto" aria-label="Varies" />;
}

const TOOLS = ["SilkLLM", "OpenRouter", "LiteLLM", "Portkey", "Helicone"] as const;

const ROWS: { label: string; values: Cell[] }[] = [
  { label: "Unified endpoint across many providers", values: ["yes", "yes", "yes", "yes", "varies"] },
  { label: "Earn credits sharing your own provider key", values: ["yes", "no", "no", "no", "no"] },
  { label: "Per-key spend caps & shared team budgets", values: ["yes", "varies", "varies", "varies", "varies"] },
  { label: "Image, audio & video in the same endpoint", values: ["yes", "varies", "varies", "varies", "no"] },
  { label: "Managed hosted balance, no self-hosting", values: ["yes", "yes", "varies", "yes", "yes"] },
];

const POSITIONING = [
  { name: "OpenRouter", desc: "A unified API and marketplace of models across many providers, priced per token. Strong model catalog and routing; not built around letting you earn from your own idle provider capacity." },
  { name: "LiteLLM", desc: "An open-source proxy/SDK that speaks one interface to 100+ LLM APIs. Typically self-hosted, which means you run and maintain the routing layer, balance tracking and infrastructure yourself." },
  { name: "Portkey", desc: "An AI gateway aimed at production teams, with routing, caching, guardrails and observability. Positioned more toward enterprise reliability tooling than a prepaid consumer-style balance." },
  { name: "Helicone", desc: "Primarily an observability and analytics layer that sits in front of calls you're already making, rather than a routing/billing gateway in its own right." },
];

const FAQS = [
  {
    q: "Is this comparison up to date?",
    a: "The general positioning is durable, but every one of these tools ships new features regularly and none of us control their pricing. Check each project's own site for current specifics before deciding - this page is a starting point, not the final word.",
  },
  {
    q: "What makes SilkLLM specifically different?",
    a: "Two things most alternatives don't offer together: a BYOK marketplace where your own provider key earns credits when SilkLLM routes other users through it, and per-key governance (spend caps, rate limits, shared budgets) enforced before a provider is ever contacted - not just logged afterward.",
  },
  {
    q: "Do I need to self-host SilkLLM?",
    a: "No. SilkLLM is a managed, hosted gateway - you get one API key and one balance without running any infrastructure yourself.",
  },
  {
    q: "Can I switch from one of these to SilkLLM easily?",
    a: "If your code already targets an OpenAI-style chat completion shape, switching is usually a base-URL and API-key change. See the Quickstart in the docs for the exact call shape.",
  },
];

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export default function Alternatives() {
  useSEO({
    title: "SilkLLM vs. OpenRouter, LiteLLM, Portkey & Helicone",
    description:
      "How SilkLLM's unified API, BYOK marketplace and per-key spend controls compare to OpenRouter, LiteLLM, Portkey and Helicone.",
    path: "/alternatives",
    jsonLd: FAQ_JSONLD,
  });

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div className="mx-auto max-w-[760px] gutter pt-28 pb-20">
        <PageHero
          eyebrow="Comparison"
          title="SilkLLM vs. the other LLM gateways"
          subtitle="OpenRouter, LiteLLM, Portkey and Helicone are all worth knowing about. Here's how SilkLLM's approach - one balance, a BYOK marketplace, and per-key governance - differs."
          cta={
            <>
              <Link to="/login" className="btn-primary h-10 px-5 text-sm">Try SilkLLM free</Link>
              <Link to="/docs" className="btn-secondary h-10 px-5 text-sm">Read the docs</Link>
            </>
          }
        />

        <Callout>
          These are each project's well-known public positioning, not a line-by-line audit -
          feature sets and pricing change on their own schedule, not SilkLLM's. Where a
          capability isn't confidently known it's marked "varies" rather than guessed at.
        </Callout>

        <H2>At a glance</H2>
        <div className="rounded-xl border border-line overflow-hidden my-4">
          <div className="scroll-x">
            <table className="table-shell">
              <thead>
                <tr>
                  <th></th>
                  {TOOLS.map((t) => (
                    <th key={t} className={t === "SilkLLM" ? "text-accent-ink" : undefined}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="text-sm text-ink-2">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="text-center">
                        <Mark v={v} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <H2>What each tool is built around</H2>
        <div className="space-y-5 my-2">
          {POSITIONING.map((p) => (
            <div key={p.name}>
              <p className="text-sm font-semibold text-ink">{p.name}</p>
              <p className="text-sm text-ink-2 mt-1 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        <H2>Why teams pick SilkLLM</H2>
        <Para>
          A single prepaid balance and key across nine providers is table stakes among
          gateways at this point. Two things aren't: the{" "}
          <Link to="/marketplace" className="text-accent-ink underline decoration-dotted underline-offset-4">BYOK marketplace</Link>{" "}
          - deposit a key you're not fully using and earn 75% of the provider cost whenever
          SilkLLM routes another user through it - and{" "}
          <Link to="/api-key-controls" className="text-accent-ink underline decoration-dotted underline-offset-4">per-key governance</Link>{" "}
          that refuses an over-limit request before any provider is contacted, rather than
          just logging the overage after the fact.
        </Para>

        <H2>Frequently asked</H2>
        <div>
          {FAQS.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
        </div>

        <div className="mt-14 pt-8 border-t border-line text-center">
          <p className="text-sm text-ink-2 mb-4">See the difference in your own code in under two minutes.</p>
          <Link to="/login" className="btn-primary h-10 px-6 text-sm inline-flex">Get started free</Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Alternatives.tsx
