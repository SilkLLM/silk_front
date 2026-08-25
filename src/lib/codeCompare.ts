/**
 * codeCompare.ts
 * "Request code" mode for the /playground tool: paste a call to OpenAI,
 * OpenRouter, Anthropic or Google's SDK (Python, JS, or raw curl) and get an
 * equivalent SilkLLM call back.
 *
 * This is deliberately NOT a real parser. Most gateways and SDKs converge on
 * the same OpenAI-shaped { model, messages, temperature, max_tokens } call,
 * so extracting those fields by pattern and re-emitting SilkLLM's own call
 * with the same values is reliable for that huge common case, and this is
 * honest about failing with guidance rather than emitting confident-looking
 * wrong code when a snippet doesn't match it. The extracted `messages` value
 * is reused verbatim (not re-serialized) in both the Python and JS output, so
 * it is only ever as syntactically correct as whatever the visitor pasted.
 */

// File: silkllm-frontend/src/lib/codeCompare.ts

export type DetectedSource = "openai" | "openrouter" | "anthropic" | "google" | "generic";

export interface CodeExtraction {
  source: DetectedSource;
  sourceLabel: string;
  model: string;
  messagesRaw: string;
  temperature: string | null;
  maxTokens: string | null;
}

export type CodeCompareResult =
  | { ok: true; extraction: CodeExtraction }
  | { ok: false; error: string };

const SOURCE_LABELS: Record<DetectedSource, string> = {
  openai: "OpenAI SDK",
  openrouter: "OpenRouter",
  anthropic: "Anthropic SDK",
  google: "Google Gemini SDK",
  generic: "OpenAI-compatible (generic)",
};

function detectSource(raw: string): DetectedSource {
  if (/openrouter\.ai/i.test(raw)) return "openrouter";
  if (/anthropic|\.messages\.create\(/i.test(raw)) return "anthropic";
  if (/generativeai|GoogleGenerativeAI|gemini/i.test(raw)) return "google";
  if (/openai/i.test(raw)) return "openai";
  return "generic";
}

/** Extracts the balanced [...] literal that starts at the first `[` after
 *  the first occurrence of `key`. Bracket-counting rather than a lazy regex,
 *  so a nested array (multimodal content parts, for example) doesn't cut the
 *  match short at the first inner `]`. */
function extractBalancedArray(raw: string, key: string): string | null {
  const keyIdx = raw.search(new RegExp(`${key}\\s*[:=]\\s*\\[`));
  if (keyIdx === -1) return null;
  const start = raw.indexOf("[", keyIdx);
  if (start === -1) return null;

  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    if (raw[i] === "[") depth++;
    else if (raw[i] === "]") {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null; // unbalanced - truncated paste
}

function extractQuoted(raw: string, key: string): string | null {
  const m = raw.match(new RegExp(`${key}\\s*[:=]\\s*["']([^"']+)["']`));
  return m ? m[1] : null;
}

function extractNumber(raw: string, key: string): string | null {
  const m = raw.match(new RegExp(`${key}\\s*[:=]\\s*([\\d.]+)`));
  return m ? m[1] : null;
}

export function extractFromCode(raw: string): CodeCompareResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste a call to any chat completion API - OpenAI, OpenRouter, Anthropic, or similar." };
  }

  const model = extractQuoted(trimmed, "model");
  const messagesRaw = extractBalancedArray(trimmed, "messages");

  if (!model && !messagesRaw) {
    return { ok: false, error: 'Couldn\'t find a "model" value or a "messages" array in that snippet. This works best on a standard chat-completion call.' };
  }
  if (!messagesRaw) {
    return { ok: false, error: 'Found a model, but no "messages" array - or it\'s missing its closing bracket. Paste the whole call.' };
  }
  if (!model) {
    return { ok: false, error: 'Found a "messages" array, but no "model" value alongside it.' };
  }

  const source = detectSource(trimmed);
  return {
    ok: true,
    extraction: {
      source,
      sourceLabel: SOURCE_LABELS[source],
      model,
      messagesRaw,
      temperature: extractNumber(trimmed, "temperature"),
      maxTokens: extractNumber(trimmed, "max_tokens"),
    },
  };
}

export function silkSnippets(e: CodeExtraction): { python: string; javascript: string } {
  const extra = [
    e.temperature ? `    temperature=${e.temperature},` : null,
    e.maxTokens ? `    max_tokens=${e.maxTokens},` : null,
  ].filter(Boolean).join("\n");

  const extraJs = [
    e.temperature ? `  temperature: ${e.temperature},` : null,
    e.maxTokens ? `  maxTokens: ${e.maxTokens},` : null,
  ].filter(Boolean).join("\n");

  const python = `import silkllm

client = silkllm.Client()

res = client.generate(
    messages=${e.messagesRaw},
    model="${e.model}",
${extra ? extra + "\n" : ""})

print(res.content)
print(res.cost_usd)`;

  const javascript = `const client = new silkllm.Client();

const res = await client.generate({
  messages: ${e.messagesRaw},
  model: "${e.model}",
${extraJs ? extraJs + "\n" : ""}});

console.log(res.content);
console.log(res.cost_usd);`;

  return { python, javascript };
}
