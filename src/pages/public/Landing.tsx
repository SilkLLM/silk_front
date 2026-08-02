/**
 * Landing.tsx
 * The marketing page.
 *
 * Rebuilt on the same tokens as the dashboard. The previous version was locked
 * to a dark palette and took over the mouse cursor, so a visitor who preferred
 * light mode got a jarring switch on every navigation, and pointer behaviour
 * stopped matching the rest of the system. Both are gone.
 *
 * Motion is present but restrained, and every animated block degrades to a
 * static one under prefers-reduced-motion via the global media query.
 */

// File: silkllm-frontend/src/pages/public/Landing.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight, AudioLines, Check, Coins, Copy, Gauge, Image as ImageIcon, Key,
  Layers, Lock, Mic, ShieldCheck, Sparkles, Type, Video, Wand2,
} from "lucide-react";
import clsx from "clsx";
import { PublicFooter, PublicNav } from "@/components/public/PublicChrome";
import { Badge } from "@/components/ui";

// ── Content ─────────────────────────────────────────────────────────────────

const PROVIDERS = [
  { name: "OpenAI",     color: "#74aa9c", sub: "GPT-4o, o3, o1" },
  { name: "Anthropic",  color: "#D97757", sub: "Claude 3.5, 3.7 Sonnet" },
  { name: "Google",     color: "#4285f4", sub: "Gemini 2.0, 1.5 Flash" },
  { name: "DeepSeek",   color: "#5BC4F5", sub: "V3, R1, Coder" },
  { name: "xAI",        color: "#9AA0A6", sub: "Grok 3, Grok 3 Mini" },
  { name: "Groq",       color: "#F55036", sub: "Llama, Mixtral, free" },
  { name: "Cerebras",   color: "#5EC26A", sub: "Llama, free tier" },
  { name: "OpenRouter", color: "#8B93A7", sub: "Free open models" },
  { name: "ElevenLabs", color: "#A78BFA", sub: "Voices, cloning, STS" },
];

const MODALITIES = [
  { icon: <Type size={20} />,       name: "Text",  sub: "Chat, reasoning, vision input" },
  { icon: <ImageIcon size={20} />,  name: "Image", sub: "Generation across providers" },
  { icon: <AudioLines size={20} />, name: "Voice", sub: "Speech, cloning, conversion" },
  { icon: <Video size={20} />,      name: "Video", sub: "Where providers support it" },
];

const EARN_STEPS = [
  { icon: <Key size={18} />,         title: "Deposit a key",  desc: "Add your own provider key and mark it public." },
  { icon: <Sparkles size={18} />,    title: "Others use it",  desc: "The router serves other users through it." },
  { icon: <Coins size={18} />,       title: "You earn 75%",   desc: "Credited to your balance as it is used." },
  { icon: <ShieldCheck size={18} />, title: "Spend anywhere", desc: "Those credits work on any model." },
];

const STEPS = [
  { n: "01", title: "Connect",  desc: "Sign in with Google or GitHub, generate a key, and add credits with a card or a bank transfer." },
  { n: "02", title: "Generate", desc: "Call one endpoint with any model. The router picks a healthy provider and falls back on its own if one fails." },
  { n: "03", title: "Pay",      desc: "Credits come off per request at provider cost plus 10%. No subscription, no minimum, no expiry." },
];

const PRICES = [
  { label: "Gemini 1.5 Flash",  price: "$0.000083", color: "#4285f4" },
  { label: "DeepSeek V3",       price: "$0.00028",  color: "#5BC4F5" },
  { label: "Grok 3 Mini",       price: "$0.00033",  color: "#9AA0A6" },
  { label: "Claude 3.5 Sonnet", price: "$0.0033",   color: "#D97757" },
  { label: "GPT-4o",            price: "$0.0055",   color: "#74aa9c" },
];

const VOICE_FEATURES = [
  { icon: <AudioLines size={14} />, label: "Text to speech" },
  { icon: <Mic size={14} />,        label: "Voice changer" },
  { icon: <Wand2 size={14} />,      label: "Instant cloning" },
  { icon: <Sparkles size={14} />,   label: "Fine controls" },
];

const GUARANTEES = [
  { icon: <Lock size={17} />,        title: "Your chats stay yours",   desc: "Conversations live in your browser's storage. We never persist them, and you choose when they expire." },
  { icon: <ShieldCheck size={17} />, title: "Keys encrypted at rest",  desc: "Provider keys are encrypted with a key derived per deployment, and are never shown again after you save them." },
  { icon: <Gauge size={17} />,       title: "Automatic failover",      desc: "Every model carries a fallback chain, so a provider outage becomes a retry rather than an incident." },
];

const CODE = [
  { t: "import silkllm", c: "kw" },
  { t: "", c: "" },
  { t: "client = silkllm.Client()", c: "fn" },
  { t: "", c: "" },
  { t: "res = client.generate(", c: "fn" },
  { t: '    messages=[{"role": "user",', c: "str" },
  { t: '               "content": "Hello"}],', c: "str" },
  { t: '    model="gpt-4o",', c: "str" },
  { t: ")", c: "fn" },
  { t: "", c: "" },
  { t: "print(res.content)", c: "fn" },
];

// ── Building blocks ─────────────────────────────────────────────────────────

/** Fades its children up the first time they enter the viewport. */
function Reveal({ children, delay = 0, className }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Section({ id, className, children }: {
  id?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <section id={id} className={clsx("py-16 sm:py-24 scroll-mt-20", className)}>
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 px-safe">{children}</div>
    </section>
  );
}

function SectionHead({ eyebrow, title, sub, center }: {
  eyebrow?: string; title: string; sub?: string; center?: boolean;
}) {
  return (
    <Reveal className={clsx("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && (
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-accent-ink mb-3">{eyebrow}</p>
      )}
      <h2 className="font-display text-[1.75rem] sm:text-4xl font-bold tracking-tight text-ink leading-[1.15]">
        {title}
      </h2>
      {sub && <p className="text-base text-ink-2 mt-4 leading-relaxed">{sub}</p>}
    </Reveal>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

/** The code panel types itself out once, then holds. */
function CodePanel() {
  const [shown, setShown] = useState(0);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || shown >= CODE.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 250 : 90);
    return () => clearTimeout(t);
  }, [inView, shown]);

  const source = useMemo(() => CODE.map((l) => l.t).join("\n").trim(), []);

  return (
    <div ref={ref} className="rounded-2xl border border-line bg-surface shadow-raised overflow-hidden">
      <div className="flex items-center gap-2 px-4 h-11 border-b border-line bg-sunken">
        <span className="flex gap-1.5" aria-hidden="true">
          {["#ef4444", "#f5a623", "#22c55e"].map((c) => (
            <span key={c} className="w-2.5 h-2.5 rounded-full opacity-70" style={{ background: c }} />
          ))}
        </span>
        <span className="text-2xs font-mono text-ink-3 ml-1">quickstart.py</span>
        <span className="flex-1" />
        <button
          onClick={() => {
            navigator.clipboard.writeText(source);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="inline-flex items-center gap-1 h-8 px-2 -mr-2 rounded text-2xs text-ink-3 hover:text-ink hover:bg-ink/[0.05] transition-colors"
        >
          {copied ? <><Check size={12} className="text-success" /> Copied</> : <><Copy size={12} /> Copy</>}
        </button>
      </div>
      <pre className="p-4 sm:p-5 text-[13px] leading-6 font-mono overflow-x-auto">
        <code>
          {CODE.slice(0, shown).map((l, i) => (
            <div
              key={i}
              className={clsx(
                l.c === "kw" && "text-accent-ink",
                l.c === "str" && "text-ink-2",
                l.c === "fn" && "text-ink",
                !l.c && "h-6",
              )}
            >
              {l.t || " "}
            </div>
          ))}
          {shown < CODE.length && (
            <span className="inline-block w-2 h-4 align-middle bg-accent animate-pulse" />
          )}
        </code>
      </pre>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-36 pb-16 sm:pb-24">
      {/* Soft brand wash, behind everything, never intercepting pointers. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(60rem 32rem at 50% -8rem, rgb(var(--c-accent) / 0.16), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 px-safe">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          <div className="min-w-0">
            <Reveal>
              <span className="inline-flex items-center gap-2 h-7 pl-2 pr-3 rounded-full border border-accent/25 bg-accent/[0.08] text-2xs font-medium text-accent-ink">
                <Sparkles size={12} /> Nine providers, one balance
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="font-display font-bold tracking-tight text-ink mt-5 text-[2.5rem] leading-[1.05] sm:text-6xl sm:leading-[1.02]">
                One key for
                <br />
                every AI model
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="text-base sm:text-lg text-ink-2 mt-5 leading-relaxed max-w-xl">
                Text, image, audio and video from OpenAI, Anthropic, Google, DeepSeek, xAI and more,
                through a single endpoint and a single prepaid balance. Bring your own provider key
                and earn credits when others use it.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link to="/login" className="btn-primary h-11 px-5">
                  Start free <ArrowRight size={16} />
                </Link>
                <Link to="/docs" className="btn-secondary h-11 px-5">Read the docs</Link>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-7 text-xs text-ink-3">
                {["No card to start", "Credits never expire", "Chats stay on your device"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5">
                    <Check size={13} className="text-success shrink-0" /> {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1} className="min-w-0">
            <CodePanel />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── Provider marquee ────────────────────────────────────────────────────────

/**
 * A continuous strip of provider names. The list is rendered twice and the
 * track travels exactly half its width, so the loop has no visible seam.
 */
function Marquee() {
  return (
    <div className="border-y border-line bg-sunken py-4 overflow-hidden">
      <div className="flex gap-8 sm:gap-12 w-max animate-marquee hover:[animation-play-state:paused]">
        {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
          <span key={i} className="inline-flex items-center gap-2.5 shrink-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-sm font-medium text-ink-2 whitespace-nowrap">{p.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────

function Modalities() {
  return (
    <Section id="modalities">
      <SectionHead
        eyebrow="Every modality"
        title="Not just chat"
        sub="The same key and the same balance cover generation across every medium the providers support."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
        {MODALITIES.map((m, i) => (
          <Reveal key={m.name} delay={i * 0.06}>
            <div className="card card-pad h-full hover:border-line-strong transition-colors">
              <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent-ink flex items-center justify-center">
                {m.icon}
              </span>
              <p className="text-base font-semibold text-ink mt-4">{m.name}</p>
              <p className="text-sm text-ink-2 mt-1.5 leading-relaxed">{m.sub}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Marketplace() {
  return (
    <Section id="marketplace" className="bg-sunken border-y border-line">
      <SectionHead
        eyebrow="Marketplace"
        title="Your idle API key can pay for itself"
        sub="Deposit a provider key and mark it public. When the router serves someone else through it, you earn 75% of the provider cost back as credits you can spend on any model."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
        {EARN_STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.06}>
            <div className="card card-pad h-full relative">
              <span className="absolute top-5 right-5 text-2xs font-mono text-ink-3">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent-ink flex items-center justify-center">
                {s.icon}
              </span>
              <p className="text-sm font-semibold text-ink mt-4">{s.title}</p>
              <p className="text-sm text-ink-2 mt-1.5 leading-relaxed">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.2}>
        <div className="mt-8 rounded-xl border border-accent/25 bg-accent/[0.07] px-5 py-4 flex items-start gap-3">
          <ShieldCheck size={17} className="text-accent-ink shrink-0 mt-0.5" />
          <p className="text-sm text-ink-2 leading-relaxed">
            A public key is only ever used by the routing engine. It is never shown to another user,
            never returned by the API, and you can revoke it at any time.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

function HowItWorks() {
  return (
    <Section id="how">
      <SectionHead eyebrow="How it works" title="Three steps, then you are running" />
      <div className="grid md:grid-cols-3 gap-4 mt-10">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="card card-pad h-full">
              <span className="font-display text-3xl font-bold text-accent/30">{s.n}</span>
              <p className="text-lg font-semibold text-ink mt-2">{s.title}</p>
              <p className="text-sm text-ink-2 mt-2 leading-relaxed">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Providers() {
  return (
    <Section id="providers" className="bg-sunken border-y border-line">
      <SectionHead
        eyebrow="Providers"
        title="Nine providers, not nine integrations"
        sub="Swap models by changing one string. Routing, fallback, billing and rate limits are handled for you."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
        {PROVIDERS.map((p, i) => (
          <Reveal key={p.name} delay={(i % 3) * 0.06}>
            <div className="card card-pad h-full flex items-center gap-3.5 hover:border-line-strong transition-colors">
              <span
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: `${p.color}1f`, color: p.color, border: `1px solid ${p.color}38` }}
              >
                {p.name.slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink truncate">{p.name}</span>
                <span className="block text-xs text-ink-3 truncate">{p.sub}</span>
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function Voice() {
  return (
    <Section id="voice">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div className="min-w-0">
          <SectionHead
            eyebrow="Voice studio"
            title="Speech that does more than read aloud"
            sub="Generate speech from text, convert a recording into another speaker, or clone a voice from a minute of audio. Same key, same balance."
          />
          <Reveal delay={0.12}>
            <div className="flex flex-wrap gap-2 mt-7">
              {VOICE_FEATURES.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-line bg-surface text-xs font-medium text-ink-2"
                >
                  <span className="text-accent-ink">{f.icon}</span> {f.label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="min-w-0">
          <div className="card card-pad">
            <div className="flex items-center gap-2 mb-5">
              <AudioLines size={16} className="text-accent-ink" />
              <span className="text-sm font-medium text-ink">Live output</span>
              <Badge tone="success">Streaming</Badge>
            </div>
            {/* A deterministic equalizer: bar height derives from its index, so it
                animates without randomness and renders identically every time. */}
            <div className="flex items-end justify-between gap-[3px] h-24" aria-hidden="true">
              {Array.from({ length: 44 }).map((_, i) => {
                const base = 22 + Math.abs(Math.sin(i * 0.7)) * 62;
                return (
                  <motion.span
                    key={i}
                    className="flex-1 rounded-full bg-accent/70 min-w-[2px]"
                    initial={{ height: "18%" }}
                    animate={{ height: [`${base * 0.35}%`, `${base}%`, `${base * 0.5}%`] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.035, ease: "easeInOut" }}
                  />
                );
              })}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-line">
              {[["Stability", "0.50"], ["Similarity", "0.75"], ["Style", "0.00"]].map(([k, v]) => (
                <div key={k}>
                  <p className="text-2xs text-ink-3 uppercase tracking-wide">{k}</p>
                  <p className="text-sm font-medium text-ink num mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function Pricing() {
  return (
    <Section id="pricing" className="bg-sunken border-y border-line">
      <SectionHead
        eyebrow="Pricing"
        title="Provider cost, plus 10%"
        sub="No subscription, no seats, no minimum. You pay what the provider charges plus a flat markup, and only for what you actually use."
        center
      />

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-6 mt-10 items-start">
        <Reveal className="min-w-0">
          <div className="card overflow-hidden">
            <div className="px-5 sm:px-6 py-4 border-b border-line">
              <p className="text-sm font-semibold text-ink">Sample rates</p>
              <p className="text-xs text-ink-3 mt-0.5">Per 1K tokens, blended input and output.</p>
            </div>
            <ul className="divide-y divide-line">
              {PRICES.map((p) => (
                <li key={p.label} className="flex items-center gap-3 px-5 sm:px-6 py-3.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                  <span className="text-sm text-ink flex-1 min-w-0 truncate">{p.label}</span>
                  <span className="text-sm font-medium text-ink num shrink-0">{p.price}</span>
                </li>
              ))}
            </ul>
            <div className="px-5 sm:px-6 py-3 border-t border-line bg-sunken">
              <p className="text-xs text-ink-3">
                Free-tier models from Groq, Cerebras and OpenRouter cost nothing at all.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="min-w-0">
          <div className="card card-pad relative overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none opacity-60"
              style={{ background: "radial-gradient(120% 100% at 100% 0%, rgb(var(--c-accent) / 0.12), transparent 60%)" }}
            />
            <div className="relative">
              <Badge tone="brand">Start free</Badge>
              <p className="font-display text-4xl font-bold text-ink mt-4">$0</p>
              <p className="text-sm text-ink-2 mt-1.5">
                A trial allowance every day while you evaluate. No card required.
              </p>
              <ul className="space-y-2.5 mt-6">
                {[
                  "Every provider and every modality",
                  "Free-tier models at no cost, ever",
                  "Automatic fallback between providers",
                  "Earn credits by sharing a provider key",
                  "Chats stored on your device, not ours",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-ink-2">
                    <Check size={15} className="text-success shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/login" className="btn-primary w-full mt-7">
                Create your account <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

function Guarantees() {
  return (
    <Section id="trust">
      <SectionHead eyebrow="What you keep" title="Built so your data stays yours" center />
      <div className="grid md:grid-cols-3 gap-4 mt-10">
        {GUARANTEES.map((g, i) => (
          <Reveal key={g.title} delay={i * 0.07}>
            <div className="card card-pad h-full">
              <span className="w-10 h-10 rounded-xl bg-accent/10 text-accent-ink flex items-center justify-center">
                {g.icon}
              </span>
              <p className="text-sm font-semibold text-ink mt-4">{g.title}</p>
              <p className="text-sm text-ink-2 mt-1.5 leading-relaxed">{g.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

function CTA() {
  return (
    <Section className="bg-sunken border-t border-line">
      <Reveal>
        <div className="card card-pad sm:p-12 text-center relative overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(50rem 24rem at 50% 0%, rgb(var(--c-accent) / 0.14), transparent 70%)" }}
          />
          <div className="relative">
            <span className="inline-flex w-12 h-12 rounded-2xl bg-accent/12 text-accent-ink items-center justify-center">
              <Layers size={22} />
            </span>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-ink mt-5">
              One integration. Every model.
            </h2>
            <p className="text-base text-ink-2 mt-4 max-w-lg mx-auto leading-relaxed">
              Stop maintaining nine SDKs, nine billing relationships and nine sets of rate limits.
              Start with the free allowance and see how far it gets you.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mt-8">
              <Link to="/login" className="btn-primary h-11 px-6">
                Get started free <ArrowRight size={16} />
              </Link>
              <Link to="/docs" className="btn-secondary h-11 px-6">Read the docs</Link>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-page text-ink overflow-x-clip">
      <PublicNav />
      <main>
        <Hero />
        <Marquee />
        <Modalities />
        <Marketplace />
        <HowItWorks />
        <Providers />
        <Voice />
        <Pricing />
        <Guarantees />
        <CTA />
      </main>
      <PublicFooter />
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Landing.tsx
