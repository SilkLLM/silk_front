/**
 * Playground.tsx
 * "Compare My Payload" - paste a real OpenAI chat completion response, see
 * the equivalent flat SilkLLM response instantly, copy a working SDK snippet.
 *
 * Everything here runs client-side. Nothing typed into the left textarea is
 * ever sent anywhere - see payloadCompare.ts for the transform logic and
 * where its financial figures (cost_usd, balance_after) are estimates versus
 * real schema fields, and why.
 */

// File: silkllm-frontend/src/pages/public/Playground.tsx

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { Textarea } from "@/components/ui";
import { CodeBlock, LangTabs, Para, H2, Callout, FAQItem, PageHero } from "@/components/public/Prose";
import { compare, formatSilkResponse } from "@/lib/payloadCompare";
import { useSEO } from "@/lib/seo";

const EXAMPLE = `{
  "id": "chatcmpl-9abcXYZ123",
  "object": "chat.completion",
  "created": 1719000000,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Silk is a strong, lightweight fiber woven from a single continuous thread."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 18,
    "completion_tokens": 24,
    "total_tokens": 42
  }
}`;

const FAQS = [
  {
    q: "Does this send my pasted JSON anywhere?",
    a: "No. The comparison and the code snippet are both generated entirely in your browser - nothing you paste here is sent to SilkLLM or anyone else.",
  },
  {
    q: "Where does the estimated cost come from?",
    a: "From the same blended, per-1K-token rates published on the pricing section of the homepage, for the handful of models in that table. It's a rough estimate, not a live quote - real billing splits input and output tokens at each model's actual current rate, fetched from the account-authenticated /api/models endpoint, which this page (being public and login-free) can't call.",
  },
  {
    q: "What if my payload isn't from OpenAI?",
    a: "Anthropic, Gemini and most other chat APIs use a similarly nested shape. If the paste doesn't have a choices[0].message.content path, the tool will tell you what it was looking for instead of guessing.",
  },
  {
    q: "Is this the real SilkLLM response schema?",
    a: "Yes - content, model, provider, usage, cost_usd, balance_after, pricing_mode and served_free_model are the exact fields SilkLLM's /generate endpoint returns. Two of them (cost_usd here, balance_after always) can't be known from a hypothetical paste, so they're clearly marked as estimated or placeholder rather than presented as real numbers.",
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

function snippets(model: string) {
  const python = `import silkllm

client = silkllm.Client()

res = client.generate(
    messages=[{"role": "user", "content": "..."}],
    model="${model}",
)

print(res.content)         # flat - no res.choices[0].message.content
print(res.cost_usd)        # computed for you, not something you calculate
print(res.usage.total_tokens)`;

  const javascript = `const client = new silkllm.Client();

const res = await client.generate({
  messages: [{ role: "user", content: "..." }],
  model: "${model}",
});

console.log(res.content);        // flat - no res.choices[0].message.content
console.log(res.cost_usd);       // computed for you, not something you calculate
console.log(res.usage.total_tokens);`;

  return { python, javascript };
}

export default function Playground() {
  useSEO({
    title: "Compare My Payload — OpenAI JSON to SilkLLM | SilkLLM",
    description:
      "Paste an OpenAI chat completion response and see it flatten into SilkLLM's native response shape instantly, with a ready-to-copy SDK snippet. Runs entirely in your browser.",
    path: "/playground",
    jsonLd: FAQ_JSONLD,
  });

  const [raw, setRaw] = useState(EXAMPLE);
  const result = useMemo(() => compare(raw), [raw]);

  const model = result.ok ? result.silk.model : "gpt-4o";
  const { python, javascript } = snippets(model);

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div className="mx-auto max-w-[980px] gutter pt-28 pb-20">
        <PageHero
          eyebrow="Free tool · runs in your browser"
          title="Compare My Payload"
          subtitle="Paste a real OpenAI chat completion response. Watch it flatten into SilkLLM's native shape, live, on the right."
        />

        {result.ok && (
          <div className="flex items-center justify-center gap-2 mb-8 -mt-6">
            <span className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-accent/10 text-accent-ink text-2xs font-medium">
              <Sparkles size={12} />
              {result.nestingBefore} levels of nesting → {result.nestingAfter}
            </span>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-5">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3 mb-2">Your OpenAI response</p>
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              spellCheck={false}
              className="font-mono text-xs leading-relaxed h-[420px] resize-none"
              placeholder="Paste a chat completion response here..."
            />
            <button
              onClick={() => setRaw(EXAMPLE)}
              className="text-2xs text-ink-3 hover:text-ink-2 mt-2 underline decoration-dotted underline-offset-4"
            >
              Reset to example
            </button>
          </div>

          <div>
            <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3 mb-2">Native SilkLLM response</p>
            {result.ok ? (
              <CodeBlock lang="json" code={formatSilkResponse(result.silk)} />
            ) : (
              <div className="h-[420px] rounded-xl border border-line bg-sunken flex items-center justify-center p-6">
                <p className="text-sm text-ink-2 text-center leading-relaxed">{result.error}</p>
              </div>
            )}
            {result.ok && !result.silk.provider_detected && (
              <p className="text-2xs text-ink-3 mt-2">
                Couldn't detect a provider from "{result.silk.model}" - SilkLLM routes nine providers, this one may just not be in our name-matching list yet.
              </p>
            )}
          </div>
        </div>

        <H2>Copy your new SilkLLM implementation</H2>
        <Para>
          Same idea, working code. This calls the model detected above (
          <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink border border-line">{model}</code>
          ) through SilkLLM instead.
        </Para>
        <LangTabs python={python} javascript={javascript} />

        <Callout>
          <Lock size={13} className="inline-block mr-1.5 -mt-0.5 text-accent-ink" />
          Nothing you paste above is sent anywhere - the comparison and the snippet are both generated locally, in your browser.
        </Callout>

        <H2>Frequently asked</H2>
        <div>
          {FAQS.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
        </div>

        <div className="mt-14 pt-8 border-t border-line text-center">
          <p className="text-sm text-ink-2 mb-4">Ready to make this the real response, not a preview?</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link to="/login" className="btn-primary h-10 px-6 text-sm inline-flex items-center gap-1.5">
              Get started free <ArrowRight size={14} />
            </Link>
            <Link to="/docs#generate" className="btn-secondary h-10 px-6 text-sm inline-flex">Read the API reference</Link>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Playground.tsx
