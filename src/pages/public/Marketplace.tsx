/**
 * Marketplace.tsx
 * Dedicated page for the BYOK (bring-your-own-key) marketplace - previously
 * just one section on the homepage and one tab in /docs. Neither is reachable
 * on its own for someone searching "bring your own api key marketplace" or
 * "earn credits sharing api key", since a homepage section and a docs tab
 * both share their parent page's single title/description.
 *
 * Facts here (pricing table, endpoints, code) are pulled straight from the
 * "BYOK Marketplace" section of Docs.tsx rather than restated from memory, so
 * this stays accurate as the product changes.
 */

// File: silkllm-frontend/src/pages/public/Marketplace.tsx

import React from "react";
import { Link } from "react-router-dom";
import { Coins, Key, ShieldCheck, Sparkles } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { CodeBlock, Para, H2, DocTable, Callout, FAQItem, PageHero } from "@/components/public/Prose";
import { useSEO } from "@/lib/seo";

const STEPS = [
  { icon: <Key size={18} />, title: "Deposit a key", desc: "Add a provider key you already have and mark it public. It's encrypted and never shown again, to you or anyone else." },
  { icon: <Sparkles size={18} />, title: "SilkLLM routes through it", desc: "When it has spare capacity, the router serves other users' requests through your key - never revealing it to them." },
  { icon: <Coins size={18} />, title: "You earn 75%", desc: "75% of the provider cost lands in your account as credit, automatically, per request served." },
  { icon: <ShieldCheck size={18} />, title: "Spend anywhere", desc: "Those credits work on any model from any provider, not just the one your key belongs to." },
];

const FAQS = [
  {
    q: "Is my provider key ever exposed to other users?",
    a: "No. Public keys are used only by SilkLLM's own routing engine to serve requests - the key itself is never returned by the API or shown in anyone else's dashboard, including yours, after the moment you first save it.",
  },
  {
    q: "How much do I actually earn?",
    a: "75% of the provider's cost for every request served through your key, credited automatically. The requester still pays SilkLLM's standard cost-plus-10% price - the 75% comes out of what would otherwise be SilkLLM's margin on that request, not on top of what the requester pays.",
  },
  {
    q: "Can I cap how much my own key spends?",
    a: "Yes. A declared budget stops SilkLLM from ever spending past a figure you set on that key, independent of your account balance.",
  },
  {
    q: "What if I still want to use my own key myself?",
    a: "A public key still serves you first when you generate: it doesn't stop being your key. You can also flip serve_owner_with_own_key off if you'd rather your own usage draw from your balance while the key keeps earning from others.",
  },
  {
    q: "What happens if I revoke a key?",
    a: "It stops immediately. Nothing already earned is affected - those credits are already in your balance.",
  },
  {
    q: "Do I need a public key to use SilkLLM?",
    a: "No. A private key serves only you and never earns credits; most accounts never deposit a key at all and simply pay from balance through SilkLLM's own platform keys.",
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

export default function Marketplace() {
  useSEO({
    title: "BYOK Marketplace — Earn Credits Sharing Your API Key | SilkLLM",
    description:
      "Deposit a provider key you're not fully using, mark it public, and earn 75% of the provider cost every time SilkLLM routes another user's request through it.",
    path: "/marketplace",
    jsonLd: FAQ_JSONLD,
  });

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div className="mx-auto max-w-[760px] gutter pt-28 pb-20">
        <PageHero
          eyebrow="BYOK marketplace"
          title="Turn a spare API key into a second income"
          subtitle="Every provider key deposited into SilkLLM can serve two purposes at once: your own requests, and other users' - and the second one pays you."
          cta={
            <>
              <Link to="/login" className="btn-primary h-10 px-5 text-sm">Deposit a key</Link>
              <Link to="/docs#marketplace" className="btn-secondary h-10 px-5 text-sm">Read the API reference</Link>
            </>
          }
        />

        <H2>How it works</H2>
        <div className="grid sm:grid-cols-2 gap-4 my-2">
          {STEPS.map((s, i) => (
            <div key={s.title} className="rounded-xl border border-line bg-surface p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <span className="w-8 h-8 rounded-lg bg-accent/10 text-accent-ink flex items-center justify-center shrink-0">{s.icon}</span>
                <span className="text-2xs font-mono text-ink-3">Step {i + 1}</span>
              </div>
              <p className="text-sm font-semibold text-ink">{s.title}</p>
              <p className="text-sm text-ink-2 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        <H2>Why this exists</H2>
        <Para>
          Most developers hold provider keys with unused headroom - a rate limit or a
          monthly credit grant they're nowhere near spending. The marketplace turns that
          slack into income without you writing a proxy, monitoring uptime, or billing
          anyone: SilkLLM's router already does the load balancing, and the ledger already
          does the accounting.
        </Para>
        <Callout>
          A key with a working declared budget always takes priority over SilkLLM's own
          platform keys when the router picks who serves a request - so an active
          marketplace key earns before the platform absorbs the cost itself.
        </Callout>

        <H2>Pricing</H2>
        <Para>Who pays what, and who earns what, depends entirely on whose key serves the request:</Para>
        <DocTable
          headers={["Serving key", "Requester pays", "Owner earns"]}
          rows={[
            ["Platform key or someone else's public key", "cost + 10%", "—"],
            ["Someone else's public key", "cost + 10%", "75% of provider cost"],
            ["Your own public key", "cost + 10%", "nothing (you're the requester)"],
            ["Your own private key", "cost + 25%", "nothing (it never serves anyone else)"],
          ]}
        />
        <Para>
          Every request costs the requester the same either way - cost plus SilkLLM's
          standard 10% - so using a marketplace key is never more expensive for the person
          calling it than using SilkLLM's own platform capacity.
        </Para>

        <H2>Depositing a key</H2>
        <CodeBlock lang="python" code={`key = client.deposit_provider_key(
    provider_id="openai",
    api_key="sk-your-openai-key",
    label="my key",
    is_public=True,
    declared_budget_usd=50,      # SilkLLM never spends past this
)

for k in client.list_provider_keys():
    print(k.label, "earned", k.earned_credits_total, "served", k.requests_served)`} />

        <H2>How supply meets demand</H2>
        <Para>
          When a request comes in, SilkLLM checks first whether a marketplace key with
          budget remaining can serve it - matching that supply (deposited keys with room
          left) to demand (incoming requests) automatically, before falling back to
          SilkLLM's own platform capacity. A working marketplace key always takes priority
          over the platform key, which is what makes depositing one worth doing: it starts
          earning as soon as there's demand for it, without you manually routing anything.
        </Para>

        <H2>Security</H2>
        <Para>
          Keys are encrypted at rest with a key derived per deployment, and never returned
          by the API after the moment you save them - not to you, and never to the users
          your key ends up serving. The routing engine holds the decrypted key only for the
          instant it takes to make the provider call; it is never logged, and revoking a
          key takes effect immediately.
        </Para>

        <H2>Frequently asked</H2>
        <div>
          {FAQS.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
        </div>

        <div className="mt-14 pt-8 border-t border-line text-center">
          <p className="text-sm text-ink-2 mb-4">Ready to put a spare key to work?</p>
          <Link to="/login" className="btn-primary h-10 px-6 text-sm inline-flex">Get started free</Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Marketplace.tsx
