/**
 * guides.tsx
 * Content + metadata for every published guide, in one place - the single
 * source of truth for the /guides index, each /guides/:slug article, and
 * (via GUIDE_SLUGS re-exported from here) the sitemap generator, so a new
 * guide only ever needs adding in this one file.
 *
 * Keep each guide grounded in documented, real API behaviour (see Docs.tsx's
 * "generate" and "models" sections) rather than describing endpoints or
 * parameters that don't actually exist.
 */

// File: silkllm-frontend/src/content/guides.tsx

import React from "react";
import { Link } from "react-router-dom";
import { CodeBlock, Para, H2, DocTable, Callout, Pill } from "@/components/public/Prose";

export interface Guide {
  slug: string;
  /** Used as the <title> (site name is appended by the page). */
  title: string;
  /** Meta description, 25-160 chars. */
  description: string;
  /** One-line teaser shown on the /guides index card. */
  summary: string;
  body: React.ReactNode;
}

export const GUIDES: Guide[] = [
  {
    slug: "llm-provider-failover",
    title: "Automatic Failover Between LLM Providers",
    description:
      "How to stop a single provider outage from taking down your app - and why SilkLLM does most of this for you without extra retry code.",
    summary: "Stop a single OpenAI or Anthropic outage from becoming your outage.",
    body: (
      <>
        <Para>
          Build against one provider directly and its outages become your outages. A
          five-minute blip at a single provider used to mean five minutes of failed
          requests, retries piling up, and a page to whoever's on call - even though the
          request itself was something any of several providers could have answered.
        </Para>

        <H2>The naive fix, and why it's more work than it looks</H2>
        <Para>
          The obvious answer is "catch the error and call a different provider." In
          practice that means holding API keys and SDKs for every provider you might fall
          back to, translating each one's request/response shape into your own, and
          deciding - per error - whether it's worth retrying at all. That logic tends to
          get written once, under pressure, during an actual incident, and rarely gets
          revisited afterward.
        </Para>

        <H2>What SilkLLM does automatically</H2>
        <Para>
          Every model SilkLLM routes to carries a configured fallback chain. A plain call
          to <Pill>/api/generate</Pill> already tries the resolved model, then walks that
          chain through healthy alternatives, before the request ever fails back to you -
          no retry loop, no second SDK, no provider-specific error handling required on
          your side.
        </Para>
        <CodeBlock lang="python" code={`# No special "failover" parameter needed - this already has it.
res = client.generate(
    messages=[{"role": "user", "content": "Hello"}],
    model="gpt-4o",
)
print(res.content)`} />

        <H2>Let the router choose, instead of pinning one model</H2>
        <Para>
          If you don't need a specific model's behaviour, omit <Pill>model</Pill> entirely
          and SilkLLM routes to the cheapest healthy model in the fallback chain on its
          own - one less thing to hardcode, and one less place a provider name can go
          stale in your codebase.
        </Para>
        <CodeBlock lang="python" code={`res = client.generate(
    messages=[{"role": "user", "content": "Hello"}],
    # model omitted - SilkLLM picks the cheapest healthy option
)`} />

        <H2>When you do want to pin a provider</H2>
        <Para>
          Sometimes you genuinely need one provider's behaviour - a specific reasoning
          model, a particular context window. Passing <Pill>provider</Pill> as a hint
          still leaves that provider's own models and their fallback chains intact; it
          only narrows which provider SilkLLM starts with.
        </Para>
        <CodeBlock lang="bash" code={`curl -X POST https://silkllm-backend.169.58.53.167.nip.io/api/generate \\
  -H "Authorization: Bearer silk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}],"provider":"anthropic"}'`} />

        <Callout>
          Streaming responses (<Pill>stream: true</Pill>) go through the same routing and
          fallback logic as a normal call - see the{" "}
          <Link to="/docs#generate" className="text-accent-ink underline decoration-dotted underline-offset-4">
            generate reference
          </Link>{" "}
          for the full request shape.
        </Callout>

        <H2>The takeaway</H2>
        <Para>
          If you're maintaining your own retry-and-switch-provider logic today, most of it
          can come out once requests go through a gateway that already does this at the
          routing layer - one call, one error path, and a fallback chain you don't have to
          write or maintain yourself.
        </Para>
      </>
    ),
  },
  {
    slug: "one-api-key-multiple-providers",
    title: "Call OpenAI, Anthropic, Gemini and More From One API Key",
    description:
      "Stop juggling a separate SDK, key and bill for every LLM provider. Switch models by changing one string, not your integration.",
    summary: "Switch between GPT-4o, Claude and Gemini by changing one string.",
    body: (
      <>
        <Para>
          Comparing models across providers normally means installing each provider's
          SDK, holding a separate API key and bill for each one, and rewriting your
          request/response handling to match whichever shape that provider uses. Trying
          three models to see which one actually performs best on your task can easily
          take longer than building the feature itself.
        </Para>

        <H2>One endpoint, one key, any model</H2>
        <Para>
          SilkLLM puts nine providers - OpenAI, Anthropic, Google, DeepSeek, xAI, Groq,
          Cerebras, OpenRouter and ElevenLabs - behind a single endpoint and a single key.
          Switching models is a one-line change, not a new integration.
        </Para>
        <CodeBlock lang="python" code={`client = silkllm.Client()
msg = [{"role": "user", "content": "Hello"}]

# Same call shape, different model string. Run client.list_models() for the
# exact current ids - providers rename and version their models over time.
gpt    = client.generate(messages=msg, model="gpt-4o")
claude = client.generate(messages=msg, model="claude-3-5-sonnet-latest")
gemini = client.generate(messages=msg, model="gemini-1.5-flash")

print(gpt.content, claude.content, gemini.content)`} />

        <H2>Why this matters beyond convenience</H2>
        <DocTable
          headers={["Without a unified key", "With SilkLLM"]}
          rows={[
            ["A separate API key per provider", "One key for every provider"],
            ["A separate SDK and response shape per provider", "One SDK, one response shape"],
            ["A separate invoice per provider", "One prepaid balance"],
            ["Manual failover if a provider goes down", "Automatic fallback per model"],
          ]}
        />

        <H2>Finding what's available</H2>
        <Para>
          List every model SilkLLM currently routes to, with its modality and whether
          it's free, or filter to one provider with <Pill>?provider=</Pill> on the raw
          endpoint.
        </Para>
        <CodeBlock lang="python" code={`for m in client.models().models:
    tag = "free" if m.is_free else "paid"
    print(m.id, m.modality, tag)`} />

        <Callout>
          Omit <Pill>model</Pill> on a generate call and SilkLLM routes to the cheapest
          healthy option on its own - see the{" "}
          <Link to="/guides/llm-provider-failover" className="text-accent-ink underline decoration-dotted underline-offset-4">
            failover guide
          </Link>{" "}
          for how that fallback chain works.
        </Callout>

        <H2>The takeaway</H2>
        <Para>
          If you're currently choosing one provider and living with it, or maintaining
          three separate integrations to compare them, a unified endpoint removes the
          integration cost of that decision - you can change your mind about which model
          serves a request by changing a string, not your codebase.
        </Para>
      </>
    ),
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
