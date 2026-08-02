/**
 * Docs.tsx
 * Public documentation. One section at a time (tabbed), with a sidebar that
 * switches sections and a pager that moves by section name. Every code example
 * has a Python and a JavaScript tab.
 */

// File: silkllm-frontend/src/pages/public/Docs.tsx

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy, CheckCircle, BookOpen, Key, Zap, Layers, Code2, AlertTriangle,
  ArrowLeft, ArrowRight, ChevronDown, Coins, Gift, Image as ImageIcon,
  MessageSquare, Search,
} from "lucide-react";
import clsx from "clsx";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";

// ── Code snippets (Python / JavaScript pairs) ────────────────────────────────
const CODE = {
  pyInstall: `pip install silkllm`,
  jsInstall: `npm install silkllm`,

  pyBasic: `import silkllm

client = silkllm.Client(api_key="silk_your_key_here")

response = client.generate(
    messages=[{"role": "user", "content": "Explain quantum computing simply."}],
    model="gpt-4o",          # optional - omit to auto-route to the cheapest healthy model
    temperature=0.7,
    max_tokens=1024,
)

print(response.content)
print(f"Tokens: {response.usage.prompt_tokens} + {response.usage.completion_tokens}")
print(f"Cost: \${response.cost_usd:.6f} | Balance: \${response.balance_after:.4f}")`,

  jsBasic: `import SilkLLM from "silkllm";

const client = new SilkLLM({ apiKey: "silk_your_key_here" });

const response = await client.generate({
  messages: [{ role: "user", content: "Explain quantum computing simply." }],
  model: "gpt-4o",          // optional - omit to auto-route
  temperature: 0.7,
  max_tokens: 1024,
});

console.log(response.content);
console.log(\`Cost: $\${response.cost_usd} | Balance: $\${response.balance_after}\`);`,

  pyStream: `for chunk in client.stream(
    messages=[{"role": "user", "content": "Write a short poem."}],
    model="claude-3-5-sonnet-20241022",
):
    print(chunk, end="", flush=True)`,

  jsStream: `for await (const chunk of client.stream({
  messages: [{ role: "user", content: "Write a short poem." }],
  model: "claude-3-5-sonnet-20241022",
})) {
  process.stdout.write(chunk);
}`,

  curlGenerate: `curl https://silkllm-backend.169.58.53.167.nip.io/api/generate \\
  -H "Authorization: Bearer silk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello!"}],"model":"gpt-4o"}'`,

  pyModels: `for m in client.models().models:
    tag = "free" if m.is_free else "paid"
    print(m.id, m.modality, tag)`,

  jsModels: `for (const m of (await client.models()).models) {
  console.log(m.id, m.modality, m.is_free ? "free" : "paid");
}`,

  pyByok: `# Deposit a public key: our engine may serve other users with it, and you
# earn 75% of the provider cost as credits, spendable on any model.
key = client.deposit_provider_key(
    provider_id="openai",
    api_key="sk-your-openai-key",
    label="my key",
    is_public=True,
    declared_budget_usd=50,      # we never spend past this
)

for k in client.list_provider_keys():
    print(k.label, "earned", k.earned_credits_total, "served", k.requests_served)

# Be served as if you deposited nothing (your key still serves others):
client.update_provider_key(key.id, serve_owner_with_own_key=False)
client.revoke_provider_key(key.id)`,

  jsByok: `const key = await client.depositProviderKey({
  providerId: "openai",
  apiKey: "sk-your-openai-key",
  label: "my key",
  isPublic: true,
  declaredBudgetUsd: 50,        // we never spend past this
});

for (const k of await client.listProviderKeys()) {
  console.log(k.label, "earned", k.earned_credits_total, "served", k.requests_served);
}

await client.updateProviderKey(key.id, { serve_owner_with_own_key: false });
await client.revokeProviderKey(key.id);`,

  pyTrial: `t = client.trial_status()
print(t.active, t.daily_remaining_usd, "of", t.daily_limit_usd, "left today", t.days_remaining, "days")`,

  jsTrial: `const t = await client.trialStatus();
console.log(t.active, t.daily_remaining_usd, "of", t.daily_limit_usd, "left today", t.days_remaining, "days");`,

  pyMedia: `# Image
img = client.generate_image(prompt="a silk ribbon", model="dall-e-3", n=2)
print(img.count, img.images)

# Audio (text to speech), base64
audio = client.generate_audio(prompt="Hello from SilkLLM", model="tts-1")
print(audio.format, len(audio.audio_b64))`,

  jsMedia: `// Image
const img = await client.generateImage({ prompt: "a silk ribbon", model: "dall-e-3", n: 2 });
console.log(img.count, img.images);

// Audio (text to speech), base64
const audio = await client.generateAudio({ prompt: "Hello from SilkLLM", model: "tts-1" });
console.log(audio.format, audio.audio_b64.length);`,

  pyVoice: `from silkllm import VoiceSettings

# List the speakers available on your ElevenLabs account
voices = client.list_voices()  # provider="elevenlabs" by default
for v in voices:
    print(v.voice_id, v.name, v.labels)

# Generate speech with a chosen speaker and voice settings
audio = client.generate_audio(
    prompt="Welcome to SilkLLM. One key, every model.",
    model="eleven_multilingual_v2",
    voice=voices[0].voice_id,
    voice_settings=VoiceSettings(
        stability=0.5, similarity_boost=0.75, style=0.2, use_speaker_boost=True,
    ),
    output_format="mp3_44100_128",
)
print(audio.voice, audio.format, len(audio.audio_b64))`,

  jsVoice: `// List the speakers available on your ElevenLabs account
const { voices } = await client.listVoices(); // "elevenlabs" by default
voices.forEach((v) => console.log(v.voice_id, v.name, v.labels));

// Generate speech with a chosen speaker and voice settings
const audio = await client.generateAudio({
  prompt: "Welcome to SilkLLM. One key, every model.",
  model: "eleven_multilingual_v2",
  voice: voices[0].voice_id,
  voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
  output_format: "mp3_44100_128",
});
console.log(audio.voice, audio.format, audio.audio_b64.length);`,

  pySetup: `pip install silkllm

from silkllm import Client
client = Client()  # reads SILKLLM_API_KEY; the endpoint is built in`,

  jsSetup: `npm install silkllm

import SilkLLM from "silkllm";
const client = new SilkLLM(); // reads SILKLLM_API_KEY; the endpoint is built in`,

  pyVision: `from silkllm import text_part, image_part

# Ask a vision model about an image (URL or base64 data URI)
resp = client.generate(
    model="gpt-4o",
    messages=[{
        "role": "user",
        "content": [
            text_part("What is in this image?"),
            image_part("https://example.com/photo.jpg"),
        ],
    }],
)
print(resp.content)`,

  jsVision: `import { textPart, imagePart } from "silkllm";

// Ask a vision model about an image (URL or base64 data URI)
const resp = await client.generate({
  model: "gpt-4o",
  messages: [{
    role: "user",
    content: [
      textPart("What is in this image?"),
      imagePart("https://example.com/photo.jpg"),
    ],
  }],
});
console.log(resp.content);`,

  pyErrors: `from silkllm import (
    InsufficientBalanceError, RateLimitError, ModelNotFoundError, ProviderError,
)

try:
    resp = client.generate(messages=[{"role": "user", "content": "Hi"}])
except InsufficientBalanceError:
    print("Out of credit - add funds to continue (free models are free only during your trial).")
except RateLimitError:
    print("Slow down and retry shortly.")
except ModelNotFoundError:
    print("That model is not enabled.")
except ProviderError as e:
    print("All providers failed:", e)`,

  jsErrors: `import { InsufficientBalanceError, RateLimitError, ModelNotFoundError, ProviderError } from "silkllm";

try {
  const resp = await client.generate({ messages: [{ role: "user", content: "Hi" }] });
} catch (e) {
  if (e instanceof InsufficientBalanceError) {
    console.log("Out of credit - add funds (free models are free only during your trial).");
  } else if (e instanceof RateLimitError) {
    console.log("Slow down and retry shortly.");
  } else if (e instanceof ModelNotFoundError) {
    console.log("That model is not enabled.");
  } else if (e instanceof ProviderError) {
    console.log("All providers failed:", e.message);
  }
}`,

  pySts: `# Voice cloning: create a speaker from your own samples
clone = client.clone_voice(name="My voice", samples=["sample1.mp3", "sample2.mp3"])
print("cloned voice_id:", clone["voice_id"])

# Speech-to-speech: convert a clip into that voice (or any speaker)
result = client.speech_to_speech(
    audio="recording.mp3",          # file path or bytes
    voice=clone["voice_id"],
    seconds=12,                      # approx duration, for pricing
)
print(result.format, len(result.audio_b64))`,

  jsSts: `import { readFileSync } from "node:fs";

// Voice cloning: create a speaker from your own samples
const clone = await client.cloneVoice({
  name: "My voice",
  samples: [readFileSync("sample1.mp3"), readFileSync("sample2.mp3")],
});
console.log("cloned voice_id:", clone.voice_id);

// Speech-to-speech: convert a clip into that voice (or any speaker)
const result = await client.speechToSpeech({
  audio: readFileSync("recording.mp3"),
  voice: clone.voice_id,
  seconds: 12,
});
console.log(result.format, result.audio_b64.length);`,
};

// ── Lightweight syntax colorizer ─────────────────────────────────────────────
// Only comments are distinguished, which is the one thing that genuinely helps
// scanning. Colours come from tokens so it reads in both themes.
function colorize(line: string): React.ReactNode {
  const hash = line.indexOf("#");
  const slashes = line.indexOf("//");
  const idx = hash >= 0 ? hash : slashes;
  if (idx >= 0 && !line.slice(0, idx).includes('"')) {
    return (
      <>
        <span className="text-ink">{line.slice(0, idx)}</span>
        <span className="text-ink-3 italic">{line.slice(idx)}</span>
      </>
    );
  }
  return <span className="text-ink">{line}</span>;
}

function CodeBlock({ code, lang = "python" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const label: Record<string, string> = { python: "Python", javascript: "JavaScript", bash: "Shell", http: "HTTP" };
  return (
    <div className="rounded-xl overflow-hidden border border-line bg-sunken my-3">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-line">
        <span className="text-2xs font-mono text-ink-3">{label[lang] || lang}</span>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1.5 text-2xs text-ink-3 hover:text-ink transition-colors"
        >
          {copied ? <><CheckCircle size={11} className="text-success" /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      {/* The snippet is the one thing on this page that must not be reflowed,
          so it scrolls inside its own box rather than widening the page. */}
      <pre className="p-4 sm:p-5 overflow-x-auto text-[13px] font-mono leading-7 m-0 text-ink">
        {code.split("\n").map((line, i) => (
          <div key={i}>{colorize(line)}</div>
        ))}
      </pre>
    </div>
  );
}

/** Python / JavaScript toggle over a pair of snippets. */
function LangTabs({ python, javascript }: { python: string; javascript: string }) {
  const [lang, setLang] = useState<"python" | "javascript">("python");
  return (
    <div className="my-3">
      <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-sunken border border-line mb-2">
        {(["python", "javascript"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            aria-pressed={lang === l}
            className={clsx(
              "px-3 h-7 rounded-[7px] text-xs font-medium transition-all",
              lang === l ? "bg-surface text-ink shadow-xs" : "text-ink-2 hover:text-ink",
            )}
          >
            {l === "python" ? "Python" : "JavaScript"}
          </button>
        ))}
      </div>
      <CodeBlock code={lang === "python" ? python : javascript} lang={lang} />
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-[0.85em] font-mono px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink border border-line">
      {children}
    </code>
  );
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed text-ink-2">{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-2xs font-semibold uppercase tracking-wider mt-7 mb-3 text-ink-3">{children}</h3>;
}

function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl border border-line overflow-hidden my-4">
      <div className="scroll-x">
        <table className="table-shell">
          <thead>
            <tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className={j === 0 ? "font-mono text-xs text-accent-ink whitespace-nowrap" : "text-sm text-ink-2"}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3.5 my-4 text-sm leading-relaxed bg-accent/[0.07] border border-accent/25 text-ink-2">
      {children}
    </div>
  );
}

// ── Sections (one is shown at a time) ────────────────────────────────────────
const SECTIONS = [
  {
    id: "quickstart", label: "Quickstart", icon: <BookOpen size={14} />,
    body: (
      <>
        <Para>Get your first response in under two minutes.</Para>
        <ol className="space-y-2 mb-5 text-sm" style={{ color: "#C2C9CC" }}>
          <li>1. <Link to="/login" className="underline decoration-dotted" style={{ color: "#D29A2D" }}>Create an account</Link> via Google or GitHub.</li>
          <li>2. Create an API key under <Pill>API Keys</Pill>.</li>
          <li>3. Add credits under <Pill>Billing</Pill>, or use your free trial.</li>
          <li>4. Install an SDK and make your first call.</li>
        </ol>
        <CodeBlock code={CODE.pyInstall} lang="bash" />
        <CodeBlock code={CODE.jsInstall} lang="bash" />
        <LangTabs python={CODE.pyBasic} javascript={CODE.jsBasic} />
      </>
    ),
  },
  {
    id: "authentication", label: "Authentication", icon: <Key size={14} />,
    body: (
      <>
        <Para>Every request needs a Bearer token in the <Pill>Authorization</Pill> header. Keys start with <Pill>silk_</Pill>.</Para>
        <CodeBlock code={`Authorization: Bearer silk_your_api_key_here`} lang="http" />
        <Callout>Never expose a key in client-side code or commit it to version control. Create and revoke keys any time from your dashboard.</Callout>
      </>
    ),
  },
  {
    id: "generate", label: "Text generation", icon: <Zap size={14} />,
    body: (
      <>
        <Para>The core endpoint. Send a conversation and get a completion from the best available provider, with automatic fallback.</Para>
        <LangTabs python={CODE.pyBasic} javascript={CODE.jsBasic} />
        <H3>Streaming</H3>
        <LangTabs python={CODE.pyStream} javascript={CODE.jsStream} />
        <H3>Raw HTTP</H3>
        <CodeBlock code={CODE.curlGenerate} lang="bash" />
        <H3>Request parameters</H3>
        <DocTable
          headers={["Field", "Type", "Description"]}
          rows={[
            ["messages", "array", "Required. Conversation history [{role, content}]"],
            ["model", "string", "Optional. Model id, e.g. gpt-4o"],
            ["provider", "string", "Optional. Provider hint, e.g. openai"],
            ["temperature", "float", "0.0-2.0 (default 0.7)"],
            ["max_tokens", "int", "Max tokens to generate (default 2048)"],
            ["stream", "bool", "Enable SSE streaming (default false)"],
          ]}
        />
        <Callout>Omit <Pill>model</Pill> and SilkLLM routes to the cheapest healthy model in the fallback chain.</Callout>
      </>
    ),
  },
  {
    id: "models", label: "Models", icon: <Layers size={14} />,
    body: (
      <>
        <Para>List every available model with pricing, modality, and whether it is free. Filter by provider.</Para>
        <LangTabs python={CODE.pyModels} javascript={CODE.jsModels} />
        <CodeBlock code={`curl "https://silkllm-backend.169.58.53.167.nip.io/api/models?provider=google" \\
  -H "Authorization: Bearer silk_your_key"`} lang="bash" />
        <Callout>Free models (is_free) are billed at $0. They serve the free tier and trials, and anyone can use them at no cost.</Callout>
      </>
    ),
  },
  {
    id: "marketplace", label: "BYOK Marketplace", icon: <Coins size={14} />,
    body: (
      <>
        <Para>Deposit your own provider keys. A <strong style={{ color: "#EDEFF0" }}>public</strong> key is used only by our routing engine to serve other users (never shown to anyone), and you earn 75% of the provider cost as credits. A <strong style={{ color: "#EDEFF0" }}>private</strong> key serves only you.</Para>
        <LangTabs python={CODE.pyByok} javascript={CODE.jsByok} />
        <H3>Endpoints</H3>
        <DocTable
          headers={["Method", "Path", "Description"]}
          rows={[
            ["POST", "/api/provider-keys", "Deposit a key (encrypted, never returned)"],
            ["GET", "/api/provider-keys", "List your keys with earnings and requests served"],
            ["PATCH", "/api/provider-keys/{id}", "Update visibility, budget, or serve-with-own-key"],
            ["DELETE", "/api/provider-keys/{id}", "Revoke a key immediately"],
          ]}
        />
        <H3>Pricing</H3>
        <DocTable
          headers={["Serving key", "You pay", "Owner earns"]}
          rows={[
            ["Platform key or anyone else's public key", "cost + 10%", "-"],
            ["Someone else's public key", "cost + 10%", "75% of cost"],
            ["Your own public key", "cost + 10%", "nothing"],
            ["Your own private key", "cost + 25%", "nothing"],
            ["Free model (during trial)", "0", "0"],
            ["Free model (paying from balance)", "cost + 10%", "0"],
          ]}
        />
        <Callout>A working marketplace key with budget always takes priority over the platform key. Free models are free only while a trial covers the request; once you are paying from balance they are billed like any other model (their provider cost is near zero, so the charge is tiny, but a request still needs credit).</Callout>
      </>
    ),
  },
  {
    id: "trials", label: "Free Trials", icon: <Gift size={14} />,
    body: (
      <>
        <Para>Every new account gets a daily free allowance for the first three months, enforced at the gateway so it works through the API and SDKs. When your balance cannot cover a request, an active trial covers it at no charge (served by free models or the platform key).</Para>
        <Para>The trial is what makes free models free. Once your daily trial allowance is used up, or the three-month window ends, requests draw from your balance, including requests to free models. If you have no credit at that point the request fails with a clear message asking you to add credits, both in the API/SDK and in the dashboard.</Para>
        <LangTabs python={CODE.pyTrial} javascript={CODE.jsTrial} />
      </>
    ),
  },
  {
    id: "multimodal", label: "Multimodal", icon: <ImageIcon size={14} />,
    body: (
      <>
        <Para>Generate images, audio, and video through dedicated endpoints that share the same routing, marketplace, and billing as text. Priced per unit (per image, per character, per second).</Para>
        <LangTabs python={CODE.pyMedia} javascript={CODE.jsMedia} />
        <DocTable
          headers={["Method", "Path", "Description"]}
          rows={[
            ["POST", "/api/generate/image", "Image generation (URLs or base64)"],
            ["POST", "/api/generate/audio", "Text to speech (base64 audio)"],
            ["POST", "/api/generate/video", "Video generation, where supported"],
            ["GET", "/api/generate/audio/voices", "List ElevenLabs speakers"],
            ["POST", "/api/generate/audio/speech-to-speech", "Voice conversion (audio in, voice out)"],
            ["POST", "/api/generate/audio/clone-voice", "Clone a voice from samples"],
          ]}
        />
        <H3>Voices and speakers (ElevenLabs)</H3>
        <Para>For expressive speech, pick an ElevenLabs model and a speaker, and shape delivery with voice settings (stability, similarity, style, speaker boost). List the speakers on your account, then pass a <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: "#1A1C1D", color: "#D29A2D" }}>voice</code> id. OpenAI TTS uses fixed voice names (alloy, echo, fable, onyx, nova, shimmer) instead.</Para>
        <LangTabs python={CODE.pyVoice} javascript={CODE.jsVoice} />
        <H3>Voice cloning and speech-to-speech</H3>
        <Para>Clone a speaker from your own audio samples, then use it for text-to-speech or to convert an existing clip into that voice (speech-to-speech). Conversion is priced per second of source audio.</Para>
        <LangTabs python={CODE.pySts} javascript={CODE.jsSts} />
        <Callout>Add your ElevenLabs API key under Admin, Providers. Its voice models then serve just like any other model, priced per character (per second for conversion).</Callout>
      </>
    ),
  },
  {
    id: "chat", label: "Chat and Data", icon: <MessageSquare size={14} />,
    body: (
      <>
        <Para>The dashboard includes a full chat client that is local-first: your conversations live only in your browser and you choose how long they are kept before they dissolve. SilkLLM never stores your chat content; only usage metadata (tokens, cost, model) is recorded.</Para>
        <Callout>Open the chat from your <Link to="/login" className="underline decoration-dotted" style={{ color: "#D29A2D" }}>dashboard</Link>. It works on your balance, your free trial, or your own deposited key.</Callout>
      </>
    ),
  },
  {
    id: "sdks", label: "SDKs", icon: <Code2 size={14} />,
    body: (
      <>
        <Para>Official SDKs for Python and JavaScript/TypeScript. Both cover generate, stream, models, balance, usage, trial status, BYOK, and multimodal.</Para>
        <H3>Install</H3>
        <CodeBlock code={CODE.pyInstall} lang="bash" />
        <CodeBlock code={CODE.jsInstall} lang="bash" />
        <H3>First call</H3>
        <LangTabs python={CODE.pyBasic} javascript={CODE.jsBasic} />
        <H3>Streaming</H3>
        <LangTabs python={CODE.pyStream} javascript={CODE.jsStream} />
      </>
    ),
  },
  {
    id: "examples", label: "Examples", icon: <Layers size={14} />,
    body: (
      <>
        <Para>A tour of the SDKs across every feature, in Python and JavaScript. Each block is copy-ready; swap in your own key and model.</Para>
        <H3>Install and connect</H3>
        <LangTabs python={CODE.pySetup} javascript={CODE.jsSetup} />
        <H3>Generate and stream</H3>
        <LangTabs python={CODE.pyBasic} javascript={CODE.jsBasic} />
        <LangTabs python={CODE.pyStream} javascript={CODE.jsStream} />
        <H3>Vision: ask about an image</H3>
        <Para>Pass a list of content parts (text plus one or more images) to any vision-capable model. Images can be public URLs or base64 data URIs.</Para>
        <LangTabs python={CODE.pyVision} javascript={CODE.jsVision} />
        <H3>Images, audio, and video</H3>
        <LangTabs python={CODE.pyMedia} javascript={CODE.jsMedia} />
        <H3>Expressive speech with a chosen speaker</H3>
        <LangTabs python={CODE.pyVoice} javascript={CODE.jsVoice} />
        <H3>Clone a voice and convert speech</H3>
        <LangTabs python={CODE.pySts} javascript={CODE.jsSts} />
        <H3>BYOK: deposit and earn</H3>
        <LangTabs python={CODE.pyByok} javascript={CODE.jsByok} />
        <H3>Free trial status</H3>
        <LangTabs python={CODE.pyTrial} javascript={CODE.jsTrial} />
        <H3>List models by modality</H3>
        <LangTabs python={CODE.pyModels} javascript={CODE.jsModels} />
        <H3>Handle errors</H3>
        <Para>Free models are free only during your trial; once you are paying from balance a request needs credit, so handle <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: "#1A1C1D", color: "#D29A2D" }}>InsufficientBalanceError</code> and prompt the user to top up.</Para>
        <LangTabs python={CODE.pyErrors} javascript={CODE.jsErrors} />
      </>
    ),
  },
  {
    id: "errors", label: "Error Reference", icon: <AlertTriangle size={14} />,
    body: (
      <>
        <Para>Errors return a JSON body with a message and an HTTP status.</Para>
        <DocTable
          headers={["Code", "HTTP", "Meaning"]}
          rows={[
            ["authentication_error", "401", "Missing or invalid API key"],
            ["insufficient_balance", "402", "Not enough credits; add more in billing"],
            ["model_not_found", "404", "Model does not exist or is disabled"],
            ["validation_error", "422", "Invalid request body"],
            ["rate_limit_exceeded", "429", "Too many requests; slow down"],
            ["provider_error", "502", "Upstream provider failed; fallback attempted"],
            ["service_unavailable", "503", "Generation is temporarily paused"],
          ]}
        />
      </>
    ),
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Docs() {
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);

  const section = SECTIONS[active];
  const prev = active > 0 ? SECTIONS[active - 1] : null;
  const next = active < SECTIONS.length - 1 ? SECTIONS[active + 1] : null;

  // Deep links from the marketing pages land on a named section.
  useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    const i = SECTIONS.findIndex((s) => s.id === id);
    if (i >= 0) setActive(i);
  }, []);

  const go = (i: number) => {
    setActive(i);
    setNavOpen(false);
    window.history.replaceState(null, "", `#${SECTIONS[i].id}`);
    document.getElementById("doc-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const q = query.trim().toLowerCase();
  const matches = q ? SECTIONS.filter((s) => s.label.toLowerCase().includes(q)) : SECTIONS;

  const sidebar = (
    <nav className="space-y-0.5">
      {matches.length === 0 && (
        <p className="px-3 py-6 text-xs text-ink-3 text-center">No section matches "{query}".</p>
      )}
      {matches.map((s) => {
        const i = SECTIONS.indexOf(s);
        return (
          <button
            key={s.id}
            onClick={() => go(i)}
            className={clsx(
              "relative w-full flex items-center gap-2.5 px-3 h-9 rounded-lg text-sm text-left transition-colors",
              i === active
                ? "bg-accent/10 text-accent-ink font-medium"
                : "text-ink-2 hover:text-ink hover:bg-ink/[0.05]",
            )}
          >
            {i === active && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-accent" />
            )}
            <span className={clsx("shrink-0", i === active ? "opacity-100" : "opacity-60")}>{s.icon}</span>
            <span className="truncate">{s.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />

      <div id="doc-top" className="scroll-mt-24" />

      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 px-safe pt-24 pb-16">
        <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-10">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto pr-2">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter sections"
                  className="input h-9 pl-8 text-xs"
                />
              </div>
              <p className="px-3 pt-2 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-3">
                Documentation
              </p>
              {sidebar}
            </div>
          </aside>

          <main className="min-w-0">
            {/* Mobile section switcher */}
            <div className="lg:hidden mb-6">
              <button
                onClick={() => setNavOpen((o) => !o)}
                className="w-full flex items-center gap-2.5 h-11 px-3.5 rounded-lg border border-line bg-surface text-sm"
              >
                <span className="text-accent-ink shrink-0">{section.icon}</span>
                <span className="flex-1 text-left font-medium text-ink truncate">{section.label}</span>
                <span className="text-2xs text-ink-3 num shrink-0">{active + 1}/{SECTIONS.length}</span>
                <ChevronDown size={15} className={clsx("text-ink-3 shrink-0 transition-transform", navOpen && "rotate-180")} />
              </button>
              {navOpen && (
                <div className="mt-2 p-2 rounded-xl border border-line bg-surface shadow-raised max-h-[60vh] overflow-y-auto">
                  {sidebar}
                </div>
              )}
            </div>

            <header className="mb-8">
              <p className="text-2xs font-mono uppercase tracking-widest text-ink-3 mb-2">
                {active + 1} / {SECTIONS.length}
              </p>
              <h1 className="font-display font-bold text-[1.75rem] sm:text-4xl tracking-tight text-ink flex items-center gap-3">
                <span className="text-accent-ink shrink-0">{section.icon}</span>
                <span className="min-w-0">{section.label}</span>
              </h1>
              <div
                className="h-px mt-5"
                style={{ background: "linear-gradient(90deg, rgb(var(--c-accent) / 0.45), transparent)" }}
              />
            </header>

            <article className="min-h-[40vh] selectable">{section.body}</article>

            {/* Pager, named by destination so it says where it goes. */}
            <div className="grid sm:grid-cols-2 gap-3 mt-14 pt-6 border-t border-line">
              {prev ? (
                <button
                  onClick={() => go(active - 1)}
                  className="text-left rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong hover:bg-sunken transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-2xs text-ink-3"><ArrowLeft size={12} /> Previous</span>
                  <span className="block mt-1 text-sm font-medium text-ink truncate">{prev.label}</span>
                </button>
              ) : <div className="hidden sm:block" />}
              {next ? (
                <button
                  onClick={() => go(active + 1)}
                  className="text-right rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong hover:bg-sunken transition-colors sm:col-start-2"
                >
                  <span className="flex items-center justify-end gap-1.5 text-2xs text-ink-3">Next <ArrowRight size={12} /></span>
                  <span className="block mt-1 text-sm font-medium text-ink truncate">{next.label}</span>
                </button>
              ) : null}
            </div>
          </main>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Docs.tsx
