/**
 * ApiKeyControls.tsx
 * Dedicated page for per-key spend limits, rate limits, allowlists and shared
 * budget pools - real, shipped features (see app/core/key_limits.py on the
 * backend) that previously only existed as two tabs buried in /docs, invisible
 * to anyone searching for "api key spend limit" or "shared budget pool api
 * keys" who has never heard of SilkLLM by name.
 *
 * Facts, endpoint names and code here are pulled from the "Key spend limits"
 * and "Key controls" sections of Docs.tsx rather than restated from memory.
 */

// File: silkllm-frontend/src/pages/public/ApiKeyControls.tsx

import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Gauge, ShieldCheck, Users, Wallet, Webhook } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { CodeBlock, Para, H2, DocTable, Callout, FAQItem, PageHero } from "@/components/public/Prose";
import { useSEO } from "@/lib/seo";

const CONTROLS = [
  { icon: <Wallet size={18} />, name: "Spend limits", desc: "Cap total spend on one key. It stops working at the cap; every other key on the account carries on." },
  { icon: <Gauge size={18} />, name: "Rate limits", desc: "Cap requests per minute for that key alone, so a runaway loop is slowed rather than funded." },
  { icon: <ShieldCheck size={18} />, name: "Model & provider allowlists", desc: "Restrict a key to named models or providers. Anything else is refused before a provider is ever contacted." },
  { icon: <Users size={18} />, name: "Shared budget pools", desc: "Give a team, environment or customer one ceiling, however many keys are handed out inside it." },
  { icon: <Webhook size={18} />, name: "Webhooks", desc: "Get notified the moment a key crosses its alert threshold, hits its cap, or a shared budget runs out." },
  { icon: <AlertTriangle size={18} />, name: "Audit trail", desc: "Every call and every refusal is logged per key, so a cap is never indistinguishable from an outage." },
];

const USE_CASES = [
  { title: "Hand a key to a contractor", body: "Give them a key capped at exactly what the engagement is worth. When it stops, it stops - it can never touch the rest of your balance." },
  { title: "Cap what a CI pipeline can spend", body: "A bug that loops a generate call in CI used to be able to drain an entire account. A rate limit and a spend cap turn that into a contained, visible failure." },
  { title: "Give each customer of your product a metered key", body: "Issue one SilkLLM key per customer, each with its own cap, and read spend per key back through the usage export instead of building your own metering." },
  { title: "Split one balance across a team", body: "Put everyone on a shared budget pool with its own per-person caps. Whichever limit is reached first stops that person, and the error says which one." },
];

const FAQS = [
  {
    q: "Does a spend limit move money into a separate wallet?",
    a: "No. Nothing is held in escrow. A limit allocates part of the one account balance to a key - SilkLLM refuses to let the unspent parts of every capped key and budget add up to more than the account actually holds.",
  },
  {
    q: "What happens when a key hits its limit?",
    a: "It answers 402 with the error code key_limit_exceeded - deliberately distinct from insufficient_balance (an empty account), so your application can tell \"this key is done\" apart from \"top up the account\" and react to each differently.",
  },
  {
    q: "Are refused requests billed?",
    a: "No. Every control - rate limit, then scope, then shared budget, then the key's own cap - is checked before any provider is contacted, so a request a limit refuses costs you nothing.",
  },
  {
    q: "Can I combine a per-key cap with a shared team budget?",
    a: "Yes. A key on a budget pool can still carry its own cap. Whichever runs out first stops that key, and the error names which one it was.",
  },
  {
    q: "Does resetting a key's counter refund the spend?",
    a: "No. That money already left the account balance. Resetting only zeroes the counter the limit is measured against and gives the key its budget back - it keeps the usage history intact.",
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

export default function ApiKeyControls() {
  useSEO({
    title: "API Key Spend Limits, Rate Limits & Budget Pools | SilkLLM",
    description:
      "Cap what any API key can spend, rate-limit it per minute, restrict it to named models, or put a whole team on one shared budget - enforced before a provider is ever called.",
    path: "/api-key-controls",
    jsonLd: FAQ_JSONLD,
  });

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div className="mx-auto max-w-[760px] gutter pt-28 pb-20">
        <PageHero
          eyebrow="Spend limits & governance"
          title="Give out a key without giving out your whole balance"
          subtitle="Every SilkLLM API key can carry its own spend limit, rate limit, model allowlist and shared budget - so a contractor, a CI pipeline or a customer never has more reach than you intended."
          cta={
            <>
              <Link to="/login" className="btn-primary h-10 px-5 text-sm">Create a key</Link>
              <Link to="/docs#key-controls" className="btn-secondary h-10 px-5 text-sm">Read the API reference</Link>
            </>
          }
        />

        <H2>What you can control per key</H2>
        <div className="grid sm:grid-cols-2 gap-4 my-2">
          {CONTROLS.map((c) => (
            <div key={c.name} className="rounded-xl border border-line bg-surface p-5">
              <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent-ink flex items-center justify-center mb-3">{c.icon}</span>
              <p className="text-sm font-semibold text-ink">{c.name}</p>
              <p className="text-sm text-ink-2 mt-1 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
        <Para>Every control is optional. A key created without any of them behaves exactly as keys always have.</Para>

        <H2>Setting them</H2>
        <CodeBlock lang="python" code={`# Every control is optional. A key with none of them behaves
# exactly as keys always have.
key = client.create_key(
    "CI pipeline",
    spend_limit_usd=5.0,        # stops at $5 of spend
    alert_at_percent=80,        # warn me at $4
    allowed_models=["gpt-4o-mini"],
    rate_limit_per_min=30,      # a runaway loop is slowed, not funded
    budget_pool_id=team["id"],  # also draws on a shared team budget
)`} />
        <Callout>
          Checks run in this order before any provider is contacted: rate limit, then
          scope, then shared budget, then the key's own cap, then the account balance -
          so the error a caller sees names the first thing that actually stopped it.
        </Callout>

        <H2>Shared budget pools</H2>
        <Para>
          A shared budget gives a team, an environment or a customer one ceiling, however
          many keys are handed out inside it. Each key can still carry its own cap - whichever
          runs out first stops that key.
        </Para>
        <CodeBlock lang="python" code={`team = client.create_budget("Mobile team", spend_limit_usd=200)

client.create_key("Alice", budget_pool_id=team["id"])
client.create_key("Bob", budget_pool_id=team["id"], spend_limit_usd=50)
# Bob stops at $50 of his own, or sooner if the team's $200 runs out first.`} />

        <H2>Where this matters</H2>
        <div className="space-y-5 my-2">
          {USE_CASES.map((u) => (
            <div key={u.title}>
              <p className="text-sm font-semibold text-ink">{u.title}</p>
              <p className="text-sm text-ink-2 mt-1 leading-relaxed">{u.body}</p>
            </div>
          ))}
        </div>

        <H2>Errors, not guesswork</H2>
        <Para>
          Each limit raises its own error carrying the API's code, the HTTP status, and the
          figures behind the message - so an application can raise a limit, notify a team,
          back off or top up without parsing an English sentence.
        </Para>
        <DocTable
          headers={["Refused by", "HTTP", "Code"]}
          rows={[
            ["Spend limit", "402", "key_limit_exceeded"],
            ["Shared budget", "402", "pool_limit_exceeded"],
            ["Model/provider allowlist", "403", "key_scope_denied"],
            ["Rate limit", "429", "key_rate_limited"],
            ["Account balance", "402", "insufficient_balance"],
          ]}
        />

        <H2>Frequently asked</H2>
        <div>
          {FAQS.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
        </div>

        <div className="mt-14 pt-8 border-t border-line text-center">
          <p className="text-sm text-ink-2 mb-4">Set a limit on your first key in under a minute.</p>
          <Link to="/login" className="btn-primary h-10 px-6 text-sm inline-flex">Get started free</Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/ApiKeyControls.tsx
