/**
 * Docs.tsx
 * Public documentation. One section at a time (tabbed), with a sidebar that
 * switches sections and a pager that moves by section name. Every code example
 * has a Python and a JavaScript tab.
 */

// File: silkllm-frontend/src/pages/public/Docs.tsx

import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Copy, CheckCircle, BookOpen, Key, Zap, Layers, Code2, AlertTriangle,
  ArrowLeft, ArrowRight, Coins, Gift, Image as ImageIcon, MessageSquare,
} from "lucide-react";

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

  curlGenerate: `curl https://silkllm.onrender.com/api/generate \\
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
};

// ── Lightweight syntax colorizer ─────────────────────────────────────────────
function colorize(line: string): React.ReactNode {
  const hash = line.indexOf("#");
  const slashes = line.indexOf("//");
  const idx = hash >= 0 ? hash : slashes;
  if (idx >= 0 && !line.slice(0, idx).includes('"')) {
    return (
      <>
        <span style={{ color: "#EDEFF0" }}>{line.slice(0, idx)}</span>
        <span style={{ color: "#595F61", fontStyle: "italic" }}>{line.slice(idx)}</span>
      </>
    );
  }
  return <span style={{ color: "#EDEFF0" }}>{line}</span>;
}

function CodeBlock({ code, lang = "python" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const label: Record<string, string> = { python: "Python", javascript: "JavaScript", bash: "Shell", http: "HTTP" };
  return (
    <div className="rounded-xl overflow-hidden border my-3" style={{ borderColor: "#2C2F31", background: "#141617" }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "#2C2F31", background: "#1A1C1D" }}>
        <span className="text-xs font-mono" style={{ color: "#7A8285" }}>{label[lang] || lang}</span>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs" style={{ color: copied ? "#74aa9c" : "#7A8285" }}>
          {copied ? <><CheckCircle size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre className="p-5 overflow-x-auto text-sm font-mono leading-7" style={{ background: "#141617", margin: 0 }}>
        {code.split("\n").map((line, i) => (
          <div key={i}>{colorize(line)}</div>
        ))}
      </pre>
    </div>
  );
}

// Python / JavaScript toggle over a pair of snippets.
function LangTabs({ python, javascript }: { python: string; javascript: string }) {
  const [lang, setLang] = useState<"python" | "javascript">("python");
  return (
    <div>
      <div className="flex gap-1 mb-1">
        {(["python", "javascript"] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)}
            className="text-xs px-3 py-1.5 rounded-t-lg font-medium"
            style={{
              background: lang === l ? "#141617" : "transparent",
              color: lang === l ? "#D29A2D" : "#7A8285",
              border: lang === l ? "1px solid #2C2F31" : "1px solid transparent",
              borderBottom: "none",
            }}>
            {l === "python" ? "Python" : "JavaScript"}
          </button>
        ))}
      </div>
      <CodeBlock code={lang === "python" ? python : javascript} lang={lang} />
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <code className="text-sm font-mono px-1.5 py-0.5 rounded" style={{ background: "#242729", color: "#D29A2D", border: "1px solid #2C2F31" }}>{children}</code>;
}

function Para({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 leading-relaxed" style={{ color: "#9AA0A3" }}>{children}</p>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wider mt-6 mb-3" style={{ color: "#595F61" }}>{children}</h3>;
}

function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl overflow-x-auto my-4" style={{ border: "1px solid #242729" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#1A1C1D", borderBottom: "1px solid #2C2F31" }}>
            {headers.map((h) => <th key={h} className="text-left px-4 py-3 text-xs font-mono uppercase tracking-wider" style={{ color: "#7A8285" }}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #1E2022" : "none", background: i % 2 === 0 ? "#141617" : "#161819" }}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3" style={{ color: j === 0 ? "#D29A2D" : "#9AA0A3", fontFamily: j === 0 ? "JetBrains Mono, monospace" : "inherit", fontSize: j === 0 ? "0.8rem" : "inherit" }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-4 py-3.5 my-4 text-sm leading-relaxed" style={{ background: "#D29A2D0D", border: "1px solid #D29A2D30", color: "#C2C9CC" }}>
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
        <CodeBlock code={`curl "https://silkllm.onrender.com/api/models?provider=google" \\
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
          ]}
        />
        <H3>Voices and speakers (ElevenLabs)</H3>
        <Para>For expressive speech, pick an ElevenLabs model and a speaker, and shape delivery with voice settings (stability, similarity, style, speaker boost). List the speakers on your account, then pass a <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: "#1A1C1D", color: "#D29A2D" }}>voice</code> id. OpenAI TTS uses fixed voice names (alloy, echo, fable, onyx, nova, shimmer) instead.</Para>
        <LangTabs python={CODE.pyVoice} javascript={CODE.jsVoice} />
        <Callout>Add your ElevenLabs API key under Admin, Providers. Its voice models then serve just like any other model, priced per character.</Callout>
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
  const section = SECTIONS[active];
  const prev = active > 0 ? SECTIONS[active - 1] : null;
  const next = active < SECTIONS.length - 1 ? SECTIONS[active + 1] : null;

  const go = (i: number) => { setActive(i); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className="min-h-screen" style={{ background: "#111314", color: "#EDEFF0" }}>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ background: "#111314CC", backdropFilter: "blur(12px)", borderBottom: "1px solid #1E2022" }}>
        <Link to="/" className="font-display font-bold text-xl" style={{ color: "#D29A2D" }}>SilkLLM</Link>
        <div className="flex items-center gap-5 text-sm" style={{ color: "#7A8285" }}>
          <Link to="/" style={{ color: "#7A8285" }}>Home</Link>
          <Link to="/login" className="btn-primary text-sm py-1.5 px-4 rounded-lg">Dashboard</Link>
        </div>
      </nav>

      <div className="flex pt-16 max-w-6xl mx-auto">
        {/* Sidebar: switches the active section */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-4">
          <p className="text-xs font-mono uppercase tracking-widest mb-3 px-3" style={{ color: "#595F61" }}>Documentation</p>
          <nav className="space-y-0.5">
            {SECTIONS.map((s, i) => (
              <button key={s.id} onClick={() => go(i)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-left transition-all"
                style={{
                  background: i === active ? "#D29A2D14" : "transparent",
                  color: i === active ? "#D29A2D" : "#7A8285",
                  borderLeft: i === active ? "2px solid #D29A2D" : "2px solid transparent",
                }}>
                <span style={{ opacity: i === active ? 1 : 0.5 }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 py-10 px-6 lg:px-12 min-w-0">
          <div className="mb-8">
            <p className="text-xs font-mono uppercase tracking-widest mb-2" style={{ color: "#595F61" }}>
              {active + 1} / {SECTIONS.length}
            </p>
            <h1 className="font-display font-bold text-4xl flex items-center gap-3" style={{ color: "#EDEFF0" }}>
              <span style={{ color: "#D29A2D" }}>{section.icon}</span>{section.label}
            </h1>
            <div className="h-px mt-5" style={{ background: "linear-gradient(90deg, #D29A2D44, transparent)" }} />
          </div>

          {/* Mobile section picker */}
          <select className="lg:hidden input mb-6" value={active} onChange={(e) => go(Number(e.target.value))}>
            {SECTIONS.map((s, i) => <option key={s.id} value={i}>{s.label}</option>)}
          </select>

          <div className="min-h-[40vh]">{section.body}</div>

          {/* Pager, named by destination */}
          <div className="flex items-stretch gap-3 mt-14 pt-6" style={{ borderTop: "1px solid #1E2022" }}>
            {prev ? (
              <button onClick={() => go(active - 1)}
                className="flex-1 text-left rounded-xl px-4 py-3 transition-colors"
                style={{ border: "1px solid #242729", background: "#141617" }}>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: "#595F61" }}><ArrowLeft size={12} /> Previous</span>
                <span className="block mt-1 font-medium" style={{ color: "#D29A2D" }}>{prev.label}</span>
              </button>
            ) : <div className="flex-1" />}
            {next ? (
              <button onClick={() => go(active + 1)}
                className="flex-1 text-right rounded-xl px-4 py-3 transition-colors"
                style={{ border: "1px solid #242729", background: "#141617" }}>
                <span className="flex items-center justify-end gap-1.5 text-xs" style={{ color: "#595F61" }}>Next <ArrowRight size={12} /></span>
                <span className="block mt-1 font-medium" style={{ color: "#D29A2D" }}>{next.label}</span>
              </button>
            ) : <div className="flex-1" />}
          </div>
        </main>
      </div>
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Docs.tsx
