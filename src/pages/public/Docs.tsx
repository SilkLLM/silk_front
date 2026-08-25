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
  BookOpen, Key, Zap, Layers, Code2, AlertTriangle,
  ArrowLeft, ArrowRight, ChevronDown, Coins, Gift, Image as ImageIcon,
  MessageSquare, Search, Wallet, ShieldCheck, BadgePercent,
} from "lucide-react";
import clsx from "clsx";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { CodeBlock, LangTabs, Pill, Para, H3, DocTable, Callout } from "@/components/public/Prose";
import { useSEO } from "@/lib/seo";

/** One-line summaries per section, used only for the per-tab meta description
 *  (see useSEO below) - the section bodies are JSX, not plain text, so they
 *  can't be derived from SECTIONS directly. Keep in sync with SECTIONS' ids. */
const SECTION_DESCRIPTIONS: Record<string, string> = {
  quickstart: "Get your first SilkLLM response in under two minutes: create a key, add credits, and call one endpoint.",
  authentication: "Authenticate SilkLLM API requests with a Bearer token carried in the Authorization header.",
  "key-budgets": "Cap what an individual API key can spend, independent of the account's overall balance.",
  promotions: "Redeem promo codes and admin grants for a discount on the SilkLLM platform fee.",
  "key-controls": "Rate limits, model/provider allowlists and shared budget pools for individual API keys.",
  generate: "Call the unified /generate endpoint for text completions across every supported provider.",
  models: "Browse the models SilkLLM routes to across OpenAI, Anthropic, Google, DeepSeek, xAI and more.",
  marketplace: "Add your own provider key to the BYOK marketplace and earn credits when others use it.",
  trials: "Free trial credits for new SilkLLM accounts, and how they interact with paid balance.",
  multimodal: "Generate images, audio and video through the same unified SilkLLM endpoint and key.",
  chat: "How SilkLLM's built-in chat stores conversations on-device rather than on the server.",
  sdks: "Official Python and JavaScript SDKs for calling SilkLLM from your application.",
  examples: "End-to-end SilkLLM code examples for common integration patterns.",
  errors: "SilkLLM API error codes, their causes and how clients should handle each one.",
};

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

  pyAllocation: `free = client.allocation()
print(free["balance"], free["allocated"], free["available"])

# Ask for no more than is actually there.
client.create_key("CI", spend_limit_usd=min(5.0, free["available"]))`,

  jsAllocation: `const free = await client.allocation();
console.log(free.balance, free.allocated, free.available);

// Ask for no more than is actually there.
await client.createKey({ name: "CI", spendLimitUsd: Math.min(5, free.available) });`,

  pyDeleteKey: `client.revoke_key(key.id)   # stops working, still listed, history kept
client.delete_key(key.id)   # gone, with its activity log`,

  jsDeleteKey: `await client.revokeKey(key.id);   // stops working, still listed, history kept
await client.deleteKey(key.id);   // gone, with its activity log`,

  pyPromo: `# Redeem a code. One per account.
promo = client.redeem_promo("LAUNCH-ABC123")
print(promo["summary"])
# "All SilkLLM fees waived until 01 Sep 2026. Your credit balance and the
#  provider's cost are unchanged; only our margin is discounted."

client.active_promotion()   # the one currently applying, or None
client.promotions()         # everything ever claimed, live and expired`,

  jsPromo: `// Redeem a code. One per account.
const promo = await client.redeemPromo("LAUNCH-ABC123");
console.log(promo.summary);
// "All SilkLLM fees waived until 01 Sep 2026. Your credit balance and the
//  provider's cost are unchanged; only our margin is discounted."

await client.activePromotion();  // the one currently applying, or null
await client.promotions();       // everything ever claimed, live and expired`,

  curlPromo: `curl -X POST https://silkllm-backend.169.58.53.167.nip.io/api/promotions/redeem \
  -H "Authorization: Bearer silk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"code": "LAUNCH-ABC123"}'`,

  pyKeyControls: `# Every control is optional. A key with none of them behaves
# exactly as keys always have.
key = client.create_key(
    "CI pipeline",
    spend_limit_usd=5.0,        # stops at $5 of spend
    alert_at_percent=80,        # warn me at $4
    allowed_models=["gpt-4o-mini"],
    rate_limit_per_min=30,      # a runaway loop is slowed, not funded
    budget_pool_id=team["id"],  # also draws on a shared team budget
)

# Taking a control off needs its own flag: an omitted field means
# "leave this as it is".
client.update_key(key.id, clear_rate_limit=True)`,

  jsKeyControls: `// Every control is optional. A key with none of them behaves
// exactly as keys always have.
const key = await client.createKey({
  name: "CI pipeline",
  spendLimitUsd: 5.0,        // stops at $5 of spend
  alertAtPercent: 80,        // warn me at $4
  allowedModels: ["gpt-4o-mini"],
  rateLimitPerMin: 30,       // a runaway loop is slowed, not funded
  budgetPoolId: team.id,     // also draws on a shared team budget
});

// Taking a control off needs its own flag: an omitted field means
// "leave this as it is".
await client.updateKey(key.id, { clearRateLimit: true });`,

  pyBudgets: `# One ceiling for a whole team, however many keys are handed out inside it.
team = client.create_budget("Mobile team", spend_limit_usd=200)

client.create_key("Alice", budget_pool_id=team["id"])
client.create_key("Bob", budget_pool_id=team["id"], spend_limit_usd=50)

# Bob stops at $50 of his own, or sooner if the team's $200 runs out first.
for pool in client.list_budgets():
    print(pool["name"], pool["spent_usd"], "of", pool["spend_limit_usd"])

client.reset_budget(team["id"])   # new month, same keys`,

  jsBudgets: `// One ceiling for a whole team, however many keys are handed out inside it.
const team = await client.createBudget("Mobile team", 200);

await client.createKey({ name: "Alice", budgetPoolId: team.id });
await client.createKey({ name: "Bob", budgetPoolId: team.id, spendLimitUsd: 50 });

// Bob stops at $50 of his own, or sooner if the team's $200 runs out first.
for (const pool of await client.listBudgets()) {
  console.log(pool.name, pool.spent_usd, "of", pool.spend_limit_usd);
}

await client.resetBudget(team.id);   // new month, same keys`,

  pyWebhooks: `hook = client.create_webhook(
    "https://your-app.example.com/hooks/silkllm",
    events=["key.threshold_reached", "key.limit_reached", "pool.limit_reached"],
)
print(hook["secret"])   # shown once, never again

# Check the receiver before a real limit is reached. This waits for the
# delivery and reports what your endpoint answered.
print(client.test_webhook(hook["id"]))`,

  jsWebhooks: `const hook = await client.createWebhook(
  "https://your-app.example.com/hooks/silkllm",
  ["key.threshold_reached", "key.limit_reached", "pool.limit_reached"],
);
console.log(hook.secret);   // shown once, never again

// Check the receiver before a real limit is reached. This waits for the
// delivery and reports what your endpoint answered.
console.log(await client.testWebhook(hook.id));`,

  pyVerify: `from silkllm import verify_webhook

@app.post("/hooks/silkllm")
async def receive(request):
    body = await request.body()          # the raw bytes, not a parsed dict
    if not verify_webhook(SECRET, body, request.headers.get("X-Silk-Signature")):
        return Response(status_code=401)
    event = json.loads(body)
    if event["event"] == "key.limit_reached":
        page_the_on_call(event["data"])`,

  jsVerify: `import { verifyWebhook } from "silkllm";

app.post("/hooks/silkllm", express.raw({ type: "*/*" }), async (req, res) => {
  // The raw body. Re-serialising a parsed object changes key order and
  // spacing, and the signature is over the exact bytes that were sent.
  const ok = await verifyWebhook(SECRET, req.body, req.header("X-Silk-Signature"));
  if (!ok) return res.sendStatus(401);

  const event = JSON.parse(req.body.toString());
  if (event.event === "key.limit_reached") pageTheOnCall(event.data);
  res.sendStatus(200);
});`,

  pyLimitErrors: `from silkllm import (
    KeyLimitExceeded, PoolLimitExceeded, KeyScopeError,
    KeyRateLimited, InsufficientBalanceError,
)

try:
    client.generate(messages=[{"role": "user", "content": "Hello"}])
except KeyLimitExceeded as e:
    # The numbers are on the exception, so nothing has to parse the message.
    raise_limit(e.details["limit"], e.details["spent"])
except PoolLimitExceeded as e:
    notify_team(e.details["pool_name"])
except KeyScopeError as e:
    log(f"this key may not call {e.details['model']}")
except KeyRateLimited as e:
    sleep(e.details["retry_after"])
except InsufficientBalanceError:
    top_up()          # the account, not the key`,

  jsLimitErrors: `import {
  KeyLimitExceeded, PoolLimitExceeded, KeyScopeError,
  KeyRateLimited, InsufficientBalanceError,
} from "silkllm";

try {
  await client.generate({ messages: [{ role: "user", content: "Hello" }] });
} catch (e) {
  // The numbers are on the error, so nothing has to parse the message.
  if (e instanceof KeyLimitExceeded) raiseLimit(e.details.limit, e.details.spent);
  else if (e instanceof PoolLimitExceeded) notifyTeam(e.details.pool_name);
  else if (e instanceof KeyScopeError) log(\`this key may not call \${e.details.model}\`);
  else if (e instanceof KeyRateLimited) await sleep(e.details.retry_after * 1000);
  else if (e instanceof InsufficientBalanceError) await topUp();  // the account, not the key
  else throw e;
}`,

  pyExport: `# The whole history, for an audit or a spreadsheet.
open("audit.csv", "wb").write(client.export_key_usage(key.id))
open("audit.json", "wb").write(client.export_key_usage(key.id, format="json"))`,

  jsExport: `// The whole history, for an audit or a spreadsheet.
await fs.writeFile("audit.csv", await client.exportKeyUsage(key.id));
await fs.writeFile("audit.json", await client.exportKeyUsage(key.id, "json"));`,

  curlControls: `# A key restricted to one model, rate limited, on a shared budget
curl -X POST https://silkllm-backend.169.58.53.167.nip.io/api/keys \
  -H "Authorization: Bearer silk_your_key" \
  -H "Content-Type: application/json" \
  -d '{
        "name": "CI pipeline",
        "spend_limit_usd": 5.0,
        "alert_at_percent": 80,
        "allowed_models": ["gpt-4o-mini"],
        "rate_limit_per_min": 30
      }'

# A shared budget, then a key that draws on it
curl -X POST https://silkllm-backend.169.58.53.167.nip.io/api/budgets \
  -H "Authorization: Bearer silk_your_key" \
  -H "Content-Type: application/json" \
  -d '{"name": "Mobile team", "spend_limit_usd": 200}'

# Export a key's history
curl "https://silkllm-backend.169.58.53.167.nip.io/api/keys/KEY_ID/usage/export?format=csv" \
  -H "Authorization: Bearer silk_your_key" -o audit.csv`,

  pyKeyBudget: `# Create a key that can only ever spend $5 of your balance.
key = client.create_key("Side project", spend_limit_usd=5.00)
print(key.key)          # the only time the secret is shown

# Where every key stands.
for k in client.list_keys():
    print(k.name, k.spent_usd, "of", k.spend_limit_usd or "uncapped",
          "AT LIMIT" if k.is_exhausted else "")

# Raise a cap (the key resumes at once, its spend still counted),
# or remove it entirely.
client.update_key(key.id, spend_limit_usd=20.00)
client.update_key(key.id, clear_spend_limit=True)

# Start the budget again. Refunds nothing; keeps the history.
client.reset_key_usage(key.id)`,

  jsKeyBudget: `// Create a key that can only ever spend $5 of your balance.
const key = await client.createKey({ name: "Side project", spendLimitUsd: 5.0 });
console.log(key.key);   // the only time the secret is shown

// Where every key stands.
for (const k of await client.listKeys()) {
  console.log(k.name, k.spent_usd, "of", k.spend_limit_usd ?? "uncapped",
              k.is_exhausted ? "AT LIMIT" : "");
}

// Raise a cap (the key resumes at once, its spend still counted),
// or remove it entirely.
await client.updateKey(key.id, { spendLimitUsd: 20.0 });
await client.updateKey(key.id, { clearSpendLimit: true });

// Start the budget again. Refunds nothing; keeps the history.
await client.resetKeyUsage(key.id);`,

  pyKeyAudit: `# Every request this key made, newest first. Refused attempts included.
history = client.key_usage(key.id, page_size=25)
print(history.total_requests, "requests,", history.total_cost_usd, "spent")

for e in history.entries:
    print(e.created_at, e.status, e.served_model, e.cost_usd)

# Only the refusals: this is what a key hitting its cap looks like.
blocked = client.key_usage(key.id, status="limit_exceeded")
print("blocked", blocked.total, "times")`,

  jsKeyAudit: `// Every request this key made, newest first. Refused attempts included.
const history = await client.keyUsage(key.id, { pageSize: 25 });
console.log(history.total_requests, "requests,", history.total_cost_usd, "spent");

for (const e of history.entries) {
  console.log(e.created_at, e.status, e.served_model, e.cost_usd);
}

// Only the refusals: this is what a key hitting its cap looks like.
const blocked = await client.keyUsage(key.id, { status: "limit_exceeded" });
console.log("blocked", blocked.total, "times");`,

  curlKeyBudget: `# Create a capped key
curl -X POST https://silkllm-backend.169.58.53.167.nip.io/api/keys \\
  -H "Authorization: Bearer silk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"CI pipeline","spend_limit_usd":5.00}'

# Raise the cap
curl -X PATCH https://silkllm-backend.169.58.53.167.nip.io/api/keys/KEY_ID \\
  -H "Authorization: Bearer silk_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"spend_limit_usd":20.00}'

# History, and just the refusals
curl "https://silkllm-backend.169.58.53.167.nip.io/api/keys/KEY_ID/usage?page=1&page_size=25" \\
  -H "Authorization: Bearer silk_your_key"

# Reset the counter (does not refund, does not clear history)
curl -X POST https://silkllm-backend.169.58.53.167.nip.io/api/keys/KEY_ID/reset \\
  -H "Authorization: Bearer silk_your_key"`,

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

// ── Sections (one is shown at a time) ────────────────────────────────────────
const SECTIONS = [
  {
    id: "quickstart", label: "Quickstart", icon: <BookOpen size={14} />,
    body: (
      <>
        <Para>Get your first response in under two minutes.</Para>
        {/* The link carries vertical padding rather than a taller line height:
            on an inline element, padding grows the hit box but does not grow
            the line box, so the target gets comfortable without the sentence
            around it shifting. */}
        <ol className="space-y-2.5 mb-5 text-sm leading-8 text-ink-2">
          <li>1. <Link to="/login" className="text-accent-ink underline decoration-dotted underline-offset-4 py-2">Create an account</Link> via Google or GitHub.</li>
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
    id: "key-budgets", label: "Key spend limits", icon: <Wallet size={14} />,
    body: (
      <>
        <Para>
          Every API key can carry a spend limit. Once the cost charged to that key reaches the
          limit, the key stops working, while every other key on your account carries on. This is
          how you hand a key to a side project, a contractor or a CI pipeline without putting your
          whole balance at risk.
        </Para>

        <Callout>
          A limit <em>allocates</em> part of the one account balance to one key. The allocations
          compete: their unspent parts cannot add up to more than your balance, so SilkLLM will not
          let you promise a key credit you do not have. Three keys limited to $10 need $30 of
          balance between them, and the attempt to set the third is refused with{" "}
          <Pill>400 allocation_exceeds_balance</Pill>.
        </Callout>

        <Callout>
          The money is not moved or held in escrow. Each key simply stops at its own figure, and the
          account balance is enforced independently underneath: settlement locks the account row and
          refuses to go below zero. So even a limit set while the account was funded cannot overdraw
          it once the account is empty. Keys with no limit reserve nothing and can use whatever is
          left, which is how every key behaved before this existed.
        </Callout>

        <H3>Knowing what you can allocate</H3>
        <Para>
          <Pill>GET /api/keys/allocation</Pill> reports your balance, how much of it existing limits
          already promise, and what is left. The dashboard shows the same figure under any limit
          field, and offers to set the limit to your maximum, or to drop it entirely, the moment you
          ask for more than you have.
        </Para>
        <LangTabs python={CODE.pyAllocation} javascript={CODE.jsAllocation} />

        <H3>Setting a limit</H3>
        <Para>
          Set it when you create the key, or at any time afterwards. Raising the limit on a key that
          has stopped makes it work again immediately, and its spend so far still counts against the
          new figure.
        </Para>
        <LangTabs python={CODE.pyKeyBudget} javascript={CODE.jsKeyBudget} />

        <H3>What happens at the limit</H3>
        <Para>
          The key answers <Pill>402</Pill> with the error code <Pill>key_limit_exceeded</Pill>. That
          is deliberately distinct from an empty account balance, so your application can tell
          <em> this key is done</em> apart from <em>this account is out of money</em> and react
          differently: raise a limit in one case, top up in the other.
        </Para>
        <CodeBlock lang="http" code={`HTTP/1.1 402 Payment Required

{
  "error": {
    "code": "key_limit_exceeded",
    "message": "API key \"CI pipeline\" has reached its spend limit ($5.001204 of $5.00 used). Raise the limit or reset the key's usage counter to continue."
  }
}`} />
        <Callout>
          Requests are checked before any provider is contacted, so a key that has reached its limit
          costs you nothing when it is refused. Because the pre-flight check uses an estimate and the
          real cost is only known afterwards, the request that crosses the line can finish very
          slightly over, exactly as the account balance can.
        </Callout>

        <H3>Auditing a key</H3>
        <Para>
          Every key keeps its own history: what it called, which model served it, how many tokens,
          what it cost, and how long it took. Attempts that were <em>refused</em> are recorded too,
          which is the part that matters when a deployment suddenly stops working. A run of
          <Pill>limit_exceeded</Pill> rows tells you the key ran out of budget rather than the
          service being down.
        </Para>
        <LangTabs python={CODE.pyKeyAudit} javascript={CODE.jsKeyAudit} />

        <DocTable
          headers={["Status", "Meaning"]}
          rows={[
            ["ok", "The request was served and charged."],
            ["limit_exceeded", "Refused: this key has reached its spend limit."],
            ["insufficient_balance", "Refused: the account has no credit left."],
            ["provider_error", "The provider failed after the key was accepted."],
          ]}
        />

        <H3>Revoking and deleting</H3>
        <Para>
          Revoking stops a key immediately but keeps it listed with its history, because a key that
          stopped and left no trace cannot be investigated. When the trace is no longer wanted,
          delete it. Only a revoked key can be deleted, so one misclick never destroys the audit
          trail of a key that is still serving traffic.
        </Para>
        <LangTabs python={CODE.pyDeleteKey} javascript={CODE.jsDeleteKey} />
        <Callout>
          Your account ledger is untouched either way. That is the record of money that actually
          moved, it belongs to the account rather than to any one key, and deleting a key must not
          put a hole in your books.
        </Callout>

        <H3>Resetting the counter</H3>
        <Para>
          Resetting zeroes the counter the limit is measured against, giving the key its full budget
          again. It refunds nothing, since that money already left your balance, and it does not
          delete the usage history. The counter is a budget; the history is a record.
        </Para>

        <H3>From the API directly</H3>
        <CodeBlock code={CODE.curlKeyBudget} lang="bash" />

        <DocTable
          headers={["Endpoint", "Purpose"]}
          rows={[
            ["POST /api/keys", "Create a key, optionally with spend_limit_usd."],
            ["GET /api/keys", "List keys with spent_usd, remaining_usd and is_exhausted."],
            ["PATCH /api/keys/{id}", "Rename, change the limit, or disable. clear_spend_limit removes a limit."],
            ["DELETE /api/keys/{id}", "Revoke. History is kept for audit."],
            ["GET /api/keys/{id}/usage", "Paginated history. Filter with status, page, page_size."],
            ["POST /api/keys/{id}/reset", "Zero the counter, keep the history."],
            ["DELETE /api/keys/{id}/permanent", "Delete a revoked key and its history for good."],
            ["GET /api/keys/allocation", "Balance, what limits already promise, and what is left."],
          ]}
        />
        <Callout>
          Removing a limit uses the <Pill>clear_spend_limit</Pill> flag rather than sending null,
          because an omitted field has to keep meaning "leave this as it is".
        </Callout>
      </>
    ),
  },
  {
    id: "promotions", label: "Promotions", icon: <BadgePercent size={14} />,
    body: (
      <>
        <Para>
          A promotion discounts <strong>SilkLLM's own fee</strong>, the margin added on top of what
          a request costs to serve. It is worth being precise about this, because a discount and a
          credit top-up are easy to confuse and only one of them is what this is.
        </Para>

        <DocTable
          headers={["What", "Does a promotion change it?"]}
          rows={[
            ["Your credit balance", "No. Redeeming a code adds no credit and removes none."],
            ["The provider's cost", "No. That is what the model actually cost, and you always pay it."],
            ["The SilkLLM fee", "Yes. This is the only thing a discount touches."],
          ]}
        />

        <Callout>
          At 100% off you pay exactly what the request cost to serve, and not a penny less. The
          floor is the real outlay: normally the provider's charge, or the key owner's earnings when
          a marketplace key served the request. A discount can take our margin to zero, never past
          it.
        </Callout>

        <H3>Redeeming a code</H3>
        <LangTabs python={CODE.pyPromo} javascript={CODE.jsPromo} />
        <Para>
          Or straight from the API:
        </Para>
        <CodeBlock code={CODE.curlPromo} lang="bash" />

        <H3>The rules</H3>
        <DocTable
          headers={["Rule", "What it means"]}
          rows={[
            ["Once per account", "A code can be redeemed a single time by any one account."],
            ["No stacking", "Holding two discounts applies the more generous one, not the sum."],
            ["Limited seats", "Some codes stop working once a set number of accounts have claimed them."],
            ["Date windows", "Some are only valid between two dates."],
            ["Benefit duration", "Some run for a set number of days after you redeem, or until the campaign ends, whichever is sooner."],
            ["Named accounts", "Some are reserved for specific customers and will not work for anyone else."],
            ["Scoped", "Some only discount certain models or providers; anything else is charged normally."],
          ]}
        />
        <Para>
          The <Pill>summary</Pill> on the redemption response says in plain English which of these
          apply to the code you just used, so an application can show a customer what they got
          without working it out from the fields.
        </Para>

        <H3>Seeing the effect</H3>
        <Para>
          A discounted request reports both figures, so the saving is never something you have to
          infer. The ledger entry carries the same detail, which is what makes a discounted month
          reconcilable afterwards.
        </Para>
        <CodeBlock lang="json" code={`{
  "cost_usd": 0.000095,
  "gross_cost_usd": 0.0001045,
  "fee_saved_usd": 0.0000095,
  "discount_percent": 100
}`} />

        <DocTable
          headers={["Endpoint", "Purpose"]}
          rows={[
            ["POST /api/promotions/redeem", "Redeem a code. Once per account."],
            ["GET /api/promotions", "Every promotion on the account, live and expired."],
            ["GET /api/promotions/active", "The discount currently applying, or null."],
          ]}
        />

        <Callout>
          Redemption attempts are rate limited per account. A promo code is a secret worth money, and
          an unknown code and a code reserved for somebody else answer identically, so the endpoint
          cannot be used to work out which codes exist.
        </Callout>
      </>
    ),
  },
  {
    id: "key-controls", label: "Key controls", icon: <ShieldCheck size={14} />,
    body: (
      <>
        <Para>
          A spend limit answers "how much". These answer the rest: what a key may call, how fast it
          may call it, who else shares its budget, and how you hear about any of it before a customer
          does. Every control is optional, and a key created without them behaves exactly as keys
          always have.
        </Para>

        <DocTable
          headers={["Control", "What it does", "Refused with"]}
          rows={[
            ["spend_limit_usd", "Caps total spend on this key.", "402 key_limit_exceeded"],
            ["alert_at_percent", "Notifies you at this share of the cap, before it bites.", "nothing, it warns"],
            ["allowed_models", "Restricts the key to named models.", "403 key_scope_denied"],
            ["allowed_providers", "The same, by provider.", "403 key_scope_denied"],
            ["rate_limit_per_min", "Caps requests per minute for this key alone.", "429 key_rate_limited"],
            ["budget_pool_id", "Draws on a shared budget as well as its own cap.", "402 pool_limit_exceeded"],
          ]}
        />

        <H3>Setting them</H3>
        <LangTabs python={CODE.pyKeyControls} javascript={CODE.jsKeyControls} />

        <Callout>
          Checks run in this order before any provider is contacted: rate limit, then scope, then
          shared budget, then the key's own cap, then the account balance. So a key that is out of
          budget costs you nothing when it is refused, and the error names the first thing that
          actually stopped it rather than the last.
        </Callout>

        <H3>Shared budgets</H3>
        <Para>
          A shared budget gives a team, an environment or a customer one ceiling, however many keys
          are handed out inside it. Each key can still carry its own cap: whichever runs out first
          stops that key, and the error says which one it was, so nobody goes looking at the wrong
          screen.
        </Para>
        <LangTabs python={CODE.pyBudgets} javascript={CODE.jsBudgets} />
        <Callout>
          Resetting a budget refunds nothing. That money has already left the account balance; the
          reset clears only the counter the limit is measured against. Deleting a budget leaves its
          keys working, falling back to their own caps.
        </Callout>

        <H3>Webhooks</H3>
        <Para>
          Register an https endpoint and SilkLLM will tell you when a key crosses its alert
          threshold, when it stops, and when a shared budget runs out. Deliveries never block a
          generation, so a slow endpoint of yours cannot slow down your own API calls.
        </Para>
        <LangTabs python={CODE.pyWebhooks} javascript={CODE.jsWebhooks} />

        <DocTable
          headers={["Event", "When it fires"]}
          rows={[
            ["key.threshold_reached", "A key passed its alert_at_percent share of its cap."],
            ["key.limit_reached", "A key hit its cap and is now refusing requests."],
            ["pool.threshold_reached", "A shared budget passed its alert threshold."],
            ["pool.limit_reached", "A shared budget ran out; every key on it is blocked."],
            ["key.revoked", "A key was revoked."],
          ]}
        />

        <H3>Verifying a delivery</H3>
        <Para>
          Every request carries <Pill>X-Silk-Signature</Pill> as <Pill>sha256=&lt;hex&gt;</Pill>, an
          HMAC-SHA256 of the exact bytes sent, keyed with the secret shown once when you created the
          hook. Both SDKs ship a verifier that compares in constant time.
        </Para>
        <LangTabs python={CODE.pyVerify} javascript={CODE.jsVerify} />
        <Callout>
          Sign the raw body, not a re-serialised object. Parsing JSON and dumping it again changes
          key order and spacing, and the signature is over the bytes that were actually sent. A hook
          that fails ten deliveries in a row is switched off and shown as disabled in the dashboard,
          so a dead URL stops costing every request a timeout.
        </Callout>

        <H3>Reacting to a limit in code</H3>
        <Para>
          Each limit raises its own error, carrying the API's code, the HTTP status, and the figures
          behind the message. Branching on the type means an application can raise a limit, notify a
          team, back off or top up without ever parsing an English sentence.
        </Para>
        <LangTabs python={CODE.pyLimitErrors} javascript={CODE.jsLimitErrors} />

        <H3>Exporting the history for audit</H3>
        <Para>
          Every key keeps its own record, refused attempts included, and the whole thing can be
          pulled out as CSV or JSON.
        </Para>
        <LangTabs python={CODE.pyExport} javascript={CODE.jsExport} />

        <H3>From the API directly</H3>
        <CodeBlock code={CODE.curlControls} lang="bash" />

        <DocTable
          headers={["Endpoint", "Purpose"]}
          rows={[
            ["POST /api/budgets", "Create a shared budget."],
            ["GET /api/budgets", "List budgets with spend, limit and key count."],
            ["PATCH /api/budgets/{id}", "Rename or re-limit. clear_spend_limit removes the limit."],
            ["POST /api/budgets/{id}/reset", "Zero the counter, keep the keys."],
            ["DELETE /api/budgets/{id}", "Delete. Keys fall back to their own caps."],
            ["POST /api/webhooks", "Register an https endpoint. Returns the secret once."],
            ["GET /api/webhooks", "List hooks with the outcome of the last delivery."],
            ["GET /api/webhooks/events", "The event names you can subscribe to."],
            ["POST /api/webhooks/{id}/test", "Send a signed test delivery, report the answer."],
            ["DELETE /api/webhooks/{id}", "Remove a hook and discard its secret."],
            ["GET /api/keys/{id}/usage/export", "Full history as CSV or JSON."],
          ]}
        />

        <Callout>
          Unknown fields on these bodies are rejected with <Pill>422</Pill> rather than ignored.
          A mistyped limit field used to produce a budget with no limit at all, which is the worst
          possible reading of "I set a budget".
        </Callout>
        <Para>
          For use cases and the full picture, see the{" "}
          <Link to="/api-key-controls" className="text-accent-ink underline decoration-dotted underline-offset-4 py-2">API key controls page</Link>.
        </Para>
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
        <Para>
          More on this: <Link to="/guides/llm-provider-failover" className="text-accent-ink underline decoration-dotted underline-offset-4 py-2">automatic provider failover</Link> and{" "}
          <Link to="/guides/one-api-key-multiple-providers" className="text-accent-ink underline decoration-dotted underline-offset-4 py-2">calling multiple providers from one key</Link>.
        </Para>
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
        <Para>Deposit your own provider keys. A <strong className="text-ink">public</strong> key is used only by our routing engine to serve other users (never shown to anyone), and you earn 75% of the provider cost as credits. A <strong className="text-ink">private</strong> key serves only you.</Para>
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
        <Para>
          For the full walkthrough - how earnings work, security, and FAQ - see the{" "}
          <Link to="/marketplace" className="text-accent-ink underline decoration-dotted underline-offset-4 py-2">marketplace page</Link>.
        </Para>
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
        <Para>For expressive speech, pick an ElevenLabs model and a speaker, and shape delivery with voice settings (stability, similarity, style, speaker boost). List the speakers on your account, then pass a <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink border border-line">voice</code> id. OpenAI TTS uses fixed voice names (alloy, echo, fable, onyx, nova, shimmer) instead.</Para>
        <LangTabs python={CODE.pyVoice} javascript={CODE.jsVoice} />
        <H3>Voice cloning and speech-to-speech</H3>
        <Para>Clone a speaker from your own audio samples, then use it for text-to-speech or to convert an existing clip into that voice (speech-to-speech). Conversion is priced per second of source audio.</Para>
        <LangTabs python={CODE.pySts} javascript={CODE.jsSts} />
        <Callout>Add your ElevenLabs API key under Admin, Providers. Its voice models then serve just like any other model, priced per character (per second for conversion).</Callout>
        <Para>
          For pricing across every modality and more on voices, see the{" "}
          <Link to="/multimodal" className="text-accent-ink underline decoration-dotted underline-offset-4 py-2">multimodal page</Link>.
        </Para>
      </>
    ),
  },
  {
    id: "chat", label: "Chat and Data", icon: <MessageSquare size={14} />,
    body: (
      <>
        <Para>The dashboard includes a full chat client that is local-first: your conversations live only in your browser and you choose how long they are kept before they dissolve. SilkLLM never stores your chat content; only usage metadata (tokens, cost, model) is recorded.</Para>
        <Callout>Open the chat from your <Link to="/login" className="text-accent-ink underline decoration-dotted underline-offset-4 py-2">dashboard</Link>. It works on your balance, your free trial, or your own deposited key.</Callout>
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
        <Para>Free models are free only during your trial; once you are paying from balance a request needs credit, so handle <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink border border-line">InsufficientBalanceError</code> and prompt the user to top up.</Para>
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
            ["insufficient_balance", "402", "Not enough credits on the account; add more in billing"],
            ["key_limit_exceeded", "402", "This API key has reached its own spend limit; raise it or reset the counter"],
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

  // Canonical stays a single /docs URL - these are tabs within one document,
  // not separate pages, so only the title/description vary per section.
  useSEO({
    title: `${section.label} — SilkLLM Docs`,
    description: SECTION_DESCRIPTIONS[section.id],
    path: "/docs",
  });

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

      <div className="mx-auto max-w-[1180px] gutter pt-24 pb-16">
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
