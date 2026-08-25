/**
 * payloadCompare.ts
 * Pure transform logic behind the /playground "Compare My Payload" tool -
 * takes a pasted OpenAI-shaped chat completion response and produces the
 * equivalent SilkLLM GenerateResponse shape.
 *
 * The SilkLLM field names and types here (content, model, provider, usage,
 * cost_usd, balance_after, pricing_mode, served_free_model) are copied from
 * the real GenerateResponse Pydantic model in
 * silkllm-backend/app/api/v1/generate.py, not invented - a public tool whose
 * whole point is "paste this in your code" has to get the schema right.
 *
 * cost_usd is an ESTIMATE, deliberately: this page is unauthenticated and has
 * no way to call the real, auth-gated /api/models endpoint for live per-model
 * rates. RATE_TABLE_PER_1K reuses the exact blended $/1K-token figures already
 * published on the homepage's Pricing section (Landing.tsx's PRICES array,
 * labelled there "Per 1K tokens, blended input and output") rather than
 * inventing new numbers - keep the two in sync if pricing changes.
 * balance_after genuinely can't be known from a hypothetical payload, so it's
 * left as an explanatory placeholder, not a fabricated number.
 */

// File: silkllm-frontend/src/lib/payloadCompare.ts

export interface SilkUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface SilkResponse {
  content: string;
  model: string;
  provider: string;
  provider_detected: boolean;
  usage: SilkUsage;
  cost_usd: number | null;
  cost_is_estimate: boolean;
  balance_after: string;
  pricing_mode: string;
  served_free_model: boolean;
}

export type CompareResult =
  | { ok: true; silk: SilkResponse; nestingBefore: number; nestingAfter: number }
  | { ok: false; error: string };

/** Same figures as PRICES in Landing.tsx - blended $/1K tokens, includes the 10% markup already. */
const RATE_TABLE_PER_1K: { match: RegExp; provider: string; rate: number }[] = [
  { match: /gemini.*flash/i, provider: "google", rate: 0.000083 },
  { match: /deepseek/i, provider: "deepseek", rate: 0.00028 },
  { match: /grok.*mini/i, provider: "xai", rate: 0.00033 },
  { match: /claude/i, provider: "anthropic", rate: 0.0033 },
  { match: /gpt-4o|gpt4o/i, provider: "openai", rate: 0.0055 },
];

const PROVIDER_HINTS: { match: RegExp; provider: string }[] = [
  { match: /^gpt|^o1|^o3|^chatgpt|^text-|^dall-e|^tts-/i, provider: "openai" },
  { match: /claude/i, provider: "anthropic" },
  { match: /gemini/i, provider: "google" },
  { match: /deepseek/i, provider: "deepseek" },
  { match: /grok/i, provider: "xai" },
  { match: /llama|mixtral/i, provider: "groq" },
];

export function inferProvider(model: string): { provider: string; detected: boolean } {
  for (const { match, provider } of PROVIDER_HINTS) {
    if (match.test(model)) return { provider, detected: true };
  }
  return { provider: "unknown", detected: false };
}

function estimateCost(model: string, totalTokens: number): { cost: number | null; isEstimate: boolean } {
  for (const { match, rate } of RATE_TABLE_PER_1K) {
    if (match.test(model)) {
      return { cost: (totalTokens / 1000) * rate, isEstimate: true };
    }
  }
  return { cost: null, isEstimate: true };
}

/** Rough proxy for "how deep do you have to reach into this object to get
 *  the text back" - counts property/array-index hops from the root to the
 *  string SilkLLM would return as `.content`. Purely structural, not a
 *  performance or cost claim. */
function nestingDepthForOpenAI(): number {
  return 4; // choices -> [0] -> message -> content
}

export function compare(rawOpenAI: string): CompareResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawOpenAI);
  } catch {
    return { ok: false, error: "That isn't valid JSON. Check for a trailing comma or an unclosed brace." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "Expected a JSON object, not a primitive or array at the top level." };
  }

  const obj = parsed as Record<string, unknown>;
  const choices = obj.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return { ok: false, error: 'No choices[] array found. Paste a standard OpenAI chat completion response (the one with choices[0].message.content).' };
  }

  const firstChoice = choices[0] as Record<string, unknown> | undefined;
  const message = firstChoice?.message as Record<string, unknown> | undefined;
  const content = typeof message?.content === "string" ? message.content
    : typeof firstChoice?.text === "string" ? firstChoice.text // legacy /completions shape
    : null;

  if (content === null) {
    return { ok: false, error: "Found choices[0], but no message.content (or legacy text) string inside it." };
  }

  const model = typeof obj.model === "string" ? obj.model : "unknown-model";
  const usageObj = (obj.usage as Record<string, unknown>) || {};
  const usage: SilkUsage = {
    prompt_tokens: typeof usageObj.prompt_tokens === "number" ? usageObj.prompt_tokens : 0,
    completion_tokens: typeof usageObj.completion_tokens === "number" ? usageObj.completion_tokens : 0,
    total_tokens: typeof usageObj.total_tokens === "number" ? usageObj.total_tokens : 0,
  };

  const { provider, detected } = inferProvider(model);
  const { cost, isEstimate } = estimateCost(model, usage.total_tokens);

  const silk: SilkResponse = {
    content,
    model,
    provider,
    provider_detected: detected,
    usage,
    cost_usd: cost,
    cost_is_estimate: isEstimate,
    balance_after: "→ your real balance after this call",
    pricing_mode: "standard",
    served_free_model: false,
  };

  return { ok: true, silk, nestingBefore: nestingDepthForOpenAI(), nestingAfter: 1 };
}

/** JSON.stringify with the placeholder strings kept human-readable, for the
 *  right-hand preview panel. Real API responses never contain these strings -
 *  they're this page's own explanatory placeholders. */
export function formatSilkResponse(silk: SilkResponse): string {
  const display = {
    content: silk.content,
    model: silk.model,
    provider: silk.provider,
    usage: silk.usage,
    cost_usd: silk.cost_usd === null ? "— (model not in our sample rate table)" : `~$${silk.cost_usd.toFixed(6)} (estimated)`,
    balance_after: silk.balance_after,
    pricing_mode: silk.pricing_mode,
    served_free_model: silk.served_free_model,
  };
  return JSON.stringify(display, null, 2);
}
