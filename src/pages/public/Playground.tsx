/**
 * Playground.tsx
 * "Compare My Payload" - two modes, one page:
 *   - Response JSON: paste an OpenAI chat completion response, see it
 *     flatten into SilkLLM's native response shape.
 *   - Request code: paste a call to OpenAI, OpenRouter, Anthropic or
 *     Google's SDK (or raw curl) and get an equivalent SilkLLM snippet.
 *
 * Everything here runs client-side - see payloadCompare.ts and
 * codeCompare.ts for the transform logic, and where each one's figures are
 * estimates/best-effort versus real schema fields, and why.
 */

// File: silkllm-frontend/src/pages/public/Playground.tsx

import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Code2, FileJson, Lock, Sparkles } from "lucide-react";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { Textarea, SegmentedControl } from "@/components/ui";
import { CodeBlock, LangTabs, Para, H2, Callout, FAQItem, PageHero } from "@/components/public/Prose";
import { compare, formatSilkResponse } from "@/lib/payloadCompare";
import { extractFromCode, silkSnippets } from "@/lib/codeCompare";
import { useSEO } from "@/lib/seo";

type Mode = "response" | "code";

// A textarea can't grow with content on its own without JS wiring, and this
// page's globals.css gives every `.input` a fixed h-10 that a plain h-[...]
// utility loses to on specificity (textarea.input beats a single class). The
// `!` forces these to actually apply.
const TEXTAREA_CLASS = "font-mono text-xs leading-relaxed !h-[480px] !resize-y";

const RESPONSE_EXAMPLE = `{
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

const CODE_EXAMPLE = `from openai import OpenAI

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="sk-or-your-openrouter-key",
)

response = client.chat.completions.create(
    model="anthropic/claude-3.5-sonnet",
    messages=[{"role": "user", "content": "What is silk?"}],
    temperature=0.7,
)

print(response.choices[0].message.content)`;

const RESPONSE_FAQS = [
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

const CODE_FAQS = [
  {
    q: "Does this actually parse my code?",
    a: "Not with a real parser - it looks for a model value and a messages array, which is what OpenAI, OpenRouter, Groq, DeepSeek's OpenAI-compatible endpoint and several others all converge on. That covers most real snippets; when it can't find both, it tells you instead of guessing.",
  },
  {
    q: "Will the output run as-is?",
    a: "The messages array is reused exactly as you pasted it, not re-parsed - if it was valid in your original language, it'll be valid here too, since that literal syntax is shared between Python and JS in the common case. Genuinely unusual syntax (f-strings, trailing commas, single-quoted strings with embedded apostrophes) may need a manual tweak.",
  },
  {
    q: "Which SDKs does source-detection recognize?",
    a: "OpenAI, OpenRouter (by its openrouter.ai base URL), Anthropic, and Google's Gemini SDK. Anything else still converts fine as long as it has a model and a messages array - it's just labelled \"OpenAI-compatible (generic)\" instead of named.",
  },
];

const FAQ_JSONLD = (faqs: typeof RESPONSE_FAQS) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

function responseSnippets(model: string) {
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
  const [mode, setMode] = useState<Mode>("response");
  const [rawResponse, setRawResponse] = useState(RESPONSE_EXAMPLE);
  const [rawCode, setRawCode] = useState(CODE_EXAMPLE);

  const faqs = mode === "response" ? RESPONSE_FAQS : CODE_FAQS;

  useSEO({
    title: "Compare My Payload — OpenAI & OpenRouter Code to SilkLLM | SilkLLM",
    description:
      "Paste an OpenAI response, or a call to OpenAI, OpenRouter or Anthropic code, and get the SilkLLM equivalent instantly - all in your browser.",
    path: "/playground",
    jsonLd: FAQ_JSONLD(faqs),
  });

  const result = useMemo(() => compare(rawResponse), [rawResponse]);
  const codeResult = useMemo(() => extractFromCode(rawCode), [rawCode]);

  const responseModel = result.ok ? result.silk.model : "gpt-4o";
  const { python: implPython, javascript: implJs } = responseSnippets(responseModel);

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div className="mx-auto max-w-[980px] gutter pt-28 pb-20">
        <PageHero
          eyebrow="Free tool · runs in your browser"
          title="Compare My Payload"
          subtitle="Paste an OpenAI response to see it flatten, or paste an existing call to any OpenAI-compatible API to get the SilkLLM equivalent - live, on the right."
        />

        <div className="flex justify-center mb-10 -mt-6">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: "response", label: "Response JSON", icon: <FileJson size={14} /> },
              { value: "code", label: "Request code", icon: <Code2 size={14} /> },
            ]}
          />
        </div>

        {mode === "response" ? (
          <>
            {result.ok && (
              <div className="flex items-center justify-center gap-2 mb-8">
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
                  value={rawResponse}
                  onChange={(e) => setRawResponse(e.target.value)}
                  spellCheck={false}
                  className={TEXTAREA_CLASS}
                  placeholder="Paste a chat completion response here..."
                />
                <button
                  onClick={() => setRawResponse(RESPONSE_EXAMPLE)}
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
                  <div className="min-h-[480px] rounded-xl border border-line bg-sunken flex items-center justify-center p-6">
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
              <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink border border-line">{responseModel}</code>
              ) through SilkLLM instead.
            </Para>
            <LangTabs python={implPython} javascript={implJs} />
          </>
        ) : (
          <>
            {codeResult.ok && (
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-accent/10 text-accent-ink text-2xs font-medium">
                  <Sparkles size={12} />
                  Detected: {codeResult.extraction.sourceLabel}
                </span>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-5">
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3 mb-2">Your existing code</p>
                <Textarea
                  value={rawCode}
                  onChange={(e) => setRawCode(e.target.value)}
                  spellCheck={false}
                  className={TEXTAREA_CLASS}
                  placeholder="Paste a chat completion call - OpenAI, OpenRouter, Anthropic, curl..."
                />
                <button
                  onClick={() => setRawCode(CODE_EXAMPLE)}
                  className="text-2xs text-ink-3 hover:text-ink-2 mt-2 underline decoration-dotted underline-offset-4"
                >
                  Reset to example
                </button>
              </div>

              <div>
                <p className="text-2xs font-semibold uppercase tracking-wider text-ink-3 mb-2">Equivalent SilkLLM code</p>
                {codeResult.ok ? (
                  <LangTabs {...silkSnippets(codeResult.extraction)} />
                ) : (
                  <div className="min-h-[480px] rounded-xl border border-line bg-sunken flex items-center justify-center p-6">
                    <p className="text-sm text-ink-2 text-center leading-relaxed">{codeResult.error}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Callout>
          <Lock size={13} className="inline-block mr-1.5 -mt-0.5 text-accent-ink" />
          Nothing you paste above is sent anywhere - both modes run entirely locally, in your browser.
        </Callout>

        <H2>Frequently asked</H2>
        <div>
          {faqs.map((f) => <FAQItem key={f.q} q={f.q} a={f.a} />)}
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
