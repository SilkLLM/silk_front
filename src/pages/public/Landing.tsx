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
import { PROVIDER_LOGOS } from "@/components/public/ProviderLogos";
import { Badge } from "@/components/ui";
import { useSEO } from "@/lib/seo";

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
  { label: "Gemini 1.5 Flash",  price: "$0.000083", color: "#4285f4", provider: "Google" },
  { label: "DeepSeek V3",       price: "$0.00028",  color: "#5BC4F5", provider: "DeepSeek" },
  { label: "Grok 3 Mini",       price: "$0.00033",  color: "#9AA0A6", provider: "xAI" },
  { label: "Claude 3.5 Sonnet", price: "$0.0033",   color: "#D97757", provider: "Anthropic" },
  { label: "GPT-4o",            price: "$0.0055",   color: "#74aa9c", provider: "OpenAI" },
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

// ── Atmosphere ──────────────────────────────────────────────────────────────

/**
 * The light behind the page. Three slow-drifting colour fields, sitting under
 * everything and never intercepting a pointer. This replaces what used to be
 * a wall of hard-bordered boxes: depth comes from light and layering now, and
 * the panels on top of it can afford to be translucent rather than outlined.
 */
function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={clsx("pointer-events-none absolute inset-0 overflow-hidden z-0", className)}>
      {/* Colour fields. No blur filter: a radial gradient is already a soft
          edge, and stacking a 64px blur on top of one spreads it so thin it
          stops reading at all. These sit mostly inside the frame rather than
          hanging off it, so what is painted is what you see. */}
      <div
        className="aurora absolute -top-[16rem] -left-[10rem] w-[44rem] h-[44rem] rounded-full"
        style={{ background: "radial-gradient(circle, rgb(var(--c-accent) / 0.55), rgb(var(--c-accent) / 0.14) 45%, transparent 70%)" }}
      />
      <div
        className="aurora-slow absolute -top-[8rem] right-[-12rem] w-[40rem] h-[40rem] rounded-full"
        style={{ background: "radial-gradient(circle, rgb(181 184 107 / 0.50), rgb(181 184 107 / 0.12) 45%, transparent 70%)" }}
      />
      <div
        className="aurora absolute top-[18rem] left-[24%] w-[36rem] h-[36rem] rounded-full"
        style={{ background: "radial-gradient(circle, rgb(208 197 30 / 0.34), transparent 65%)" }}
      />
      {/* A technical grid over the light, masked so it fades out. It gives the
          gradients something to sit against, so they read as depth rather than
          as a smear of colour. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgb(var(--c-ink) / 0.10) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgb(var(--c-ink) / 0.10) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(90% 70% at 35% 15%, black, transparent 78%)",
          WebkitMaskImage: "radial-gradient(90% 70% at 35% 15%, black, transparent 78%)",
        }}
      />
    </div>
  );
}

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

function Section({ id, className, atmosphere, children }: {
  id?: string;
  className?: string;
  /** Renders the aurora full-bleed behind this section rather than inside the
   *  content container, where it would clip to the max width and show an edge. */
  atmosphere?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={clsx("relative py-16 sm:py-24 scroll-mt-20", className)}>
      {atmosphere && <Aurora className="opacity-70" />}
      <div className="relative z-10 mx-auto max-w-[1180px] gutter">{children}</div>
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
    <div ref={ref} className="relative">
      {/* A second pane behind the first, rotated a little, so the code reads as
          one card in a stack rather than a lone rectangle. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-3xl glass rotate-[2.5deg] translate-y-3 opacity-60"
      />
      <div className="relative glass rounded-3xl shadow-overlay overflow-hidden">
        <div className="flex items-center gap-2 px-4 h-11 border-b border-ink/[0.06]">
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
        <pre className="p-4 sm:p-6 text-[13px] leading-6 font-mono overflow-x-auto">
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
    </div>
  );
}

function Hero() {
  return (
    <section className="relative pt-28 sm:pt-36 pb-20 sm:pb-28">
      <Aurora />
      <div className="relative z-10 mx-auto max-w-[1180px] gutter">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-14 lg:gap-16 items-center">
          <div className="min-w-0">
            <Reveal>
              <span className="inline-flex items-center gap-2 h-8 pl-2.5 pr-3.5 rounded-full glass text-2xs font-medium text-accent-ink">
                <Sparkles size={12} /> Nine providers, one balance
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              <h1 className="font-display font-bold tracking-tight mt-6 text-[2.75rem] leading-[1.02] sm:text-[4.25rem] sm:leading-[0.98]">
                <span className="text-ink">One key for</span>
                <br />
                <span className="text-gradient">every AI model</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="text-base sm:text-lg text-ink-2 mt-6 leading-relaxed max-w-xl">
                Text, image, audio and video from OpenAI, Anthropic, Google, DeepSeek, xAI and more,
                through a single endpoint and a single prepaid balance. Bring your own provider key
                and earn credits when others use it.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="flex flex-wrap gap-3 mt-9">
                <Link to="/login" className="btn-primary h-12 px-6 rounded-xl text-[15px]">
                  Start free <ArrowRight size={17} />
                </Link>
                <Link to="/docs" className="btn h-12 px-6 rounded-xl text-[15px] glass text-ink hover:bg-surface/80">
                  Read the docs
                </Link>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-8 text-xs text-ink-3">
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
 * A continuous strip of provider names. The list is rendered four times and
 * the track travels exactly a quarter of its width, so the loop has no
 * visible seam - two copies looked seamless on a laptop but on a wide enough
 * monitor a single copy is narrower than the viewport, so the track ran out
 * of content and visibly snapped back before reaching the halfway point.
 * Four copies keep the strip wider than any realistic viewport. The edges
 * fade into the page rather than stopping at a border.
 */
function Marquee() {
  return (
    <div className="relative py-6 overflow-hidden">
      <div className="rule-fade absolute top-0 inset-x-0" />
      <div className="rule-fade absolute bottom-0 inset-x-0" />
      <div className="flex gap-10 sm:gap-14 w-max animate-marquee hover:[animation-play-state:paused]">
        {[...PROVIDERS, ...PROVIDERS, ...PROVIDERS, ...PROVIDERS].map((p, i) => {
          const Logo = PROVIDER_LOGOS[p.name];
          return (
            <span key={i} className="inline-flex items-center gap-2.5 shrink-0">
              {Logo && <Logo className="w-4 h-4" style={{ color: p.color }} />}
              <span className="text-sm font-medium text-ink-2 whitespace-nowrap">{p.name}</span>
            </span>
          );
        })}
      </div>
      {/* Fade the strip into the page at both ends so it reads as continuous. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-24"
        style={{ background: "linear-gradient(90deg, rgb(var(--c-page)), transparent)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-24"
        style={{ background: "linear-gradient(270deg, rgb(var(--c-page)), transparent)" }} />
    </div>
  );
}

// ── Modalities: a bento, not a row of equal boxes ───────────────────────────

/**
 * Varied cell sizes on an asymmetric grid. Uniform cards make four things look
 * like a checklist; giving the first one real estate makes the set read as a
 * composition and gives the eye somewhere to land.
 */
function Modalities() {
  return (
    <Section id="modalities">
      <SectionHead
        eyebrow="Every modality"
        title="Not just chat"
        sub="The same key and the same balance cover generation across every medium the providers support."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
        {/* Lead cell, deliberately larger and carrying the gradient. */}
        <Reveal className="sm:col-span-2 lg:row-span-2">
          <div className="relative h-full rounded-3xl glass overflow-hidden p-7 sm:p-9 min-h-[16rem]">
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(90% 80% at 15% 0%, rgb(var(--c-accent) / 0.16), transparent 60%)" }}
            />
            <div className="relative flex flex-col h-full">
              <span className="w-12 h-12 rounded-2xl bg-accent/12 text-accent-ink flex items-center justify-center">
                <Type size={22} />
              </span>
              <p className="font-display text-2xl sm:text-3xl font-bold text-ink mt-6">Text</p>
              <p className="text-sm sm:text-base text-ink-2 mt-2 leading-relaxed max-w-sm">
                Chat, reasoning and vision input across every frontier model, with automatic
                fallback when a provider stumbles.
              </p>
              <div className="mt-auto pt-8 flex flex-wrap gap-2">
                {["Streaming", "Vision input", "Function calling", "Fallback chains"].map((t) => (
                  <span key={t} className="text-2xs font-medium text-ink-2 px-2.5 h-7 inline-flex items-center rounded-full bg-ink/[0.05]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>

        {MODALITIES.slice(1).map((m, i, arr) => {
          // The lead cell occupies two columns and two rows, so the last item
          // takes the full width beneath it. Without this it is left stranded
          // in a third of a row on its own.
          const last = i === arr.length - 1;
          return (
            <Reveal key={m.name} delay={0.06 + i * 0.06} className={clsx(last && "sm:col-span-2 lg:col-span-3")}>
              <div className="h-full rounded-3xl glass p-6 flex items-start gap-4 hover:-translate-y-0.5 transition-transform duration-300">
                <span className="w-11 h-11 rounded-2xl bg-accent/10 text-accent-ink flex items-center justify-center shrink-0">
                  {m.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-semibold text-ink">{m.name}</span>
                  <span className="block text-sm text-ink-2 mt-1 leading-relaxed">{m.sub}</span>
                </span>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

// ── Marketplace: a flow, not four boxes ─────────────────────────────────────

/**
 * The four steps sit on a line that is drawn as it scrolls into view, so the
 * sequence reads as a loop of value rather than as separate tiles. The line is
 * decorative; the numbered captions carry the order on their own.
 */
function Marketplace() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <Section id="marketplace" className="overflow-hidden" atmosphere>
      <SectionHead
        eyebrow="Marketplace"
        title="Your idle API key can pay for itself"
        sub="Deposit a provider key and mark it public. When the router serves someone else through it, you earn 75% of the provider cost back as credits you can spend on any model."
      />

      <div ref={ref} className="relative mt-14">
        {/* The connecting line, horizontal on wide screens, vertical below. */}
        <motion.div
          aria-hidden="true"
          className="hidden lg:block absolute top-7 left-[12%] right-[12%] h-px origin-left"
          style={{ background: "linear-gradient(90deg, transparent, rgb(var(--c-accent) / 0.5), rgb(var(--c-accent) / 0.5), transparent)" }}
          initial={{ scaleX: 0 }}
          animate={inView ? { scaleX: 1 } : undefined}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {EARN_STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <div className="relative text-center lg:px-2">
                <span className="relative z-10 mx-auto w-14 h-14 rounded-2xl glass shadow-raised text-accent-ink flex items-center justify-center">
                  {s.icon}
                </span>
                <p className="text-2xs font-mono text-ink-3 mt-5">{String(i + 1).padStart(2, "0")}</p>
                <p className="text-base font-semibold text-ink mt-1.5">{s.title}</p>
                <p className="text-sm text-ink-2 mt-2 leading-relaxed max-w-[16rem] mx-auto">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal delay={0.2}>
        <div className="mt-14 mx-auto max-w-2xl text-center">
          <div className="rule-fade mb-6" />
          <p className="text-sm text-ink-2 leading-relaxed">
            <ShieldCheck size={15} className="inline-block mr-1.5 -mt-0.5 text-accent-ink" />
            A public key is only ever used by the routing engine. It is never shown to another user,
            never returned by the API, and you can revoke it at any time.
          </p>
        </div>
      </Reveal>
    </Section>
  );
}

// ── How it works: numerals, no containers ───────────────────────────────────

function HowItWorks() {
  return (
    <Section id="how">
      <SectionHead eyebrow="How it works" title="Three steps, then you are running" />
      <div className="grid md:grid-cols-3 gap-x-10 gap-y-12 mt-12">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="relative">
              {/* Oversized ghost numeral behind the copy, instead of a border
                  around it. */}
              <span
                aria-hidden="true"
                className="font-display text-[5rem] leading-none font-bold absolute -top-6 -left-1 select-none"
                style={{ color: "rgb(var(--c-accent) / 0.10)" }}
              >
                {s.n}
              </span>
              <div className="relative pt-6">
                <p className="text-xl font-semibold text-ink">{s.title}</p>
                <p className="text-sm text-ink-2 mt-2.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ── Providers: a drifting field, not a grid ─────────────────────────────────

/**
 * The nine providers laid out as staggered pills of varying emphasis rather
 * than nine identical bordered cells. Each row is offset, so the eye travels
 * across the set instead of scanning a table.
 */
function Providers() {
  return (
    <Section id="providers" className="relative overflow-hidden">
      <SectionHead
        eyebrow="Providers"
        title="Nine providers, not nine integrations"
        sub="Swap models by changing one string. Routing, fallback, billing and rate limits are handled for you."
      />

      <div className="mt-12 flex flex-wrap justify-center gap-3 sm:gap-4 max-w-4xl mx-auto">
        {PROVIDERS.map((p, i) => {
          const Logo = PROVIDER_LOGOS[p.name];
          return (
            <Reveal key={p.name} delay={(i % 5) * 0.05}>
              <div
                className="group relative flex items-center gap-3 rounded-2xl glass pl-3 pr-5 py-3 hover:-translate-y-1 transition-transform duration-300"
                // Alternating vertical offset breaks the row alignment so the
                // field reads as scattered rather than tabular.
                style={{ transform: `translateY(${(i % 3) * 8}px)` }}
              >
                <span
                  aria-hidden="true"
                  className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: `radial-gradient(80% 120% at 0% 0%, ${p.color}26, transparent 70%)` }}
                />
                <span
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${p.color}22`, color: p.color }}
                >
                  {Logo ? <Logo className="w-5 h-5" /> : p.name.slice(0, 2)}
                </span>
                <span className="relative min-w-0">
                  <span className="block text-sm font-semibold text-ink whitespace-nowrap">{p.name}</span>
                  <span className="block text-2xs text-ink-3 whitespace-nowrap">{p.sub}</span>
                </span>
              </div>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

// ── Voice ───────────────────────────────────────────────────────────────────

function Voice() {
  return (
    <Section id="voice" className="overflow-hidden" atmosphere>
      <div className="grid lg:grid-cols-2 gap-14 items-center">
        <div className="min-w-0">
          <SectionHead
            eyebrow="Voice studio"
            title="Speech that does more than read aloud"
            sub="Generate speech from text, convert a recording into another speaker, or clone a voice from a minute of audio. Same key, same balance."
          />
          <Reveal delay={0.12}>
            <div className="flex flex-wrap gap-2.5 mt-8">
              {VOICE_FEATURES.map((f) => (
                <span
                  key={f.label}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-full glass text-xs font-medium text-ink-2"
                >
                  <span className="text-accent-ink">{f.icon}</span> {f.label}
                </span>
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="min-w-0">
          <div className="relative rounded-3xl glass shadow-overlay p-7 sm:p-8 overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(100% 90% at 50% 0%, rgb(var(--c-accent) / 0.14), transparent 65%)" }}
            />
            <div className="relative">
              <div className="flex items-center gap-2.5 mb-7">
                <AudioLines size={17} className="text-accent-ink" />
                <span className="text-sm font-medium text-ink">Live output</span>
                <Badge tone="success">Streaming</Badge>
              </div>
              {/* Deterministic equalizer: bar height derives from its index, so
                  it animates without randomness and renders identically every
                  time. */}
              <div className="flex items-end justify-between gap-[3px] h-28" aria-hidden="true">
                {Array.from({ length: 44 }).map((_, i) => {
                  const base = 22 + Math.abs(Math.sin(i * 0.7)) * 62;
                  return (
                    <motion.span
                      key={i}
                      className="flex-1 rounded-full min-w-[2px]"
                      style={{ background: "linear-gradient(180deg, rgb(var(--c-accent)), rgb(var(--c-accent) / 0.35))" }}
                      initial={{ height: "18%" }}
                      animate={{ height: [`${base * 0.35}%`, `${base}%`, `${base * 0.5}%`] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.035, ease: "easeInOut" }}
                    />
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3 mt-7 pt-6" style={{ borderTop: "1px solid rgb(var(--c-ink) / 0.07)" }}>
                {[["Stability", "0.50"], ["Similarity", "0.75"], ["Style", "0.00"]].map(([k, v]) => (
                  <div key={k}>
                    <p className="text-2xs text-ink-3 uppercase tracking-wide">{k}</p>
                    <p className="text-sm font-medium text-ink num mt-1">{v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ── Pricing ─────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <Section id="pricing" className="relative overflow-hidden">
      <SectionHead
        eyebrow="Pricing"
        title="Provider cost, plus 10%"
        sub="No subscription, no seats, no minimum. You pay what the provider charges plus a flat markup, and only for what you actually use."
        center
      />

      <div className="grid lg:grid-cols-[1fr_1.05fr] gap-6 lg:gap-8 mt-12 items-center">
        <Reveal className="min-w-0">
          <div className="rounded-3xl glass overflow-hidden">
            <div className="px-6 sm:px-7 pt-6 pb-4">
              <p className="text-sm font-semibold text-ink">Sample rates</p>
              <p className="text-xs text-ink-3 mt-1">Per 1K tokens, blended input and output.</p>
            </div>
            <ul>
              {PRICES.map((p, i) => {
                const Logo = PROVIDER_LOGOS[p.provider];
                return (
                  <li
                    key={p.label}
                    className="flex items-center gap-3 px-6 sm:px-7 py-3.5"
                    style={{ borderTop: "1px solid rgb(var(--c-ink) / 0.06)" }}
                  >
                    {Logo
                      ? <Logo className="w-3.5 h-3.5 shrink-0" style={{ color: p.color }} />
                      : <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: p.color }} />}
                    <span className="text-sm text-ink flex-1 min-w-0 truncate">{p.label}</span>
                    <span className="text-sm font-medium text-ink num shrink-0">{p.price}</span>
                  </li>
                );
              })}
            </ul>
            <p className="px-6 sm:px-7 py-4 text-xs text-ink-3" style={{ borderTop: "1px solid rgb(var(--c-ink) / 0.06)" }}>
              Free-tier models from Groq, Cerebras and OpenRouter cost nothing at all.
            </p>
          </div>
        </Reveal>

        {/* Lifted slightly and glowing, so it reads as the offer rather than
            the second column of a table. */}
        <Reveal delay={0.08} className="min-w-0">
          <div className="relative rounded-3xl glass shadow-overlay p-7 sm:p-9 overflow-hidden lg:-translate-y-3">
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(110% 90% at 80% 0%, rgb(var(--c-accent) / 0.20), transparent 62%)" }}
            />
            <div className="relative">
              <Badge tone="brand">Start free</Badge>
              <p className="font-display text-5xl font-bold text-gradient mt-5 leading-none">$0</p>
              <p className="text-sm text-ink-2 mt-3">
                A trial allowance every day while you evaluate. No card required.
              </p>
              <ul className="space-y-3 mt-7">
                {[
                  "Every provider and every modality",
                  "Free-tier models at no cost, ever",
                  "Automatic fallback between providers",
                  "Earn credits by sharing a provider key",
                  "Chats stored on your device, not ours",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-ink-2">
                    <span className="w-5 h-5 rounded-full bg-success/12 text-success flex items-center justify-center shrink-0 mt-px">
                      <Check size={12} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/login" className="btn-primary w-full mt-8 h-12 rounded-xl">
                Create your account <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ── Guarantees: a list, not three cards ─────────────────────────────────────

function Guarantees() {
  return (
    <Section id="trust">
      <SectionHead eyebrow="What you keep" title="Built so your data stays yours" center />
      <div className="mt-12 max-w-3xl mx-auto">
        {GUARANTEES.map((g, i) => (
          <Reveal key={g.title} delay={i * 0.07}>
            <div
              className="flex items-start gap-5 py-7"
              style={i > 0 ? { borderTop: "1px solid rgb(var(--c-ink) / 0.07)" } : undefined}
            >
              <span className="w-12 h-12 rounded-2xl glass text-accent-ink flex items-center justify-center shrink-0">
                {g.icon}
              </span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink">{g.title}</p>
                <p className="text-sm text-ink-2 mt-1.5 leading-relaxed">{g.desc}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ── Closing call to action ──────────────────────────────────────────────────

function CTA() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      <Aurora />
      <div className="relative z-10 mx-auto max-w-[1180px] gutter text-center">
        <Reveal>
          <span className="inline-flex w-14 h-14 rounded-2xl glass text-accent-ink items-center justify-center">
            <Layers size={24} />
          </span>
          <h2 className="font-display text-[2rem] sm:text-5xl font-bold tracking-tight mt-7 leading-[1.05]">
            <span className="text-ink">One integration.</span>{" "}
            <span className="text-gradient">Every model.</span>
          </h2>
          <p className="text-base sm:text-lg text-ink-2 mt-5 max-w-xl mx-auto leading-relaxed">
            Stop maintaining nine SDKs, nine billing relationships and nine sets of rate limits.
            Start with the free allowance and see how far it gets you.
          </p>
          <div className="flex flex-wrap gap-3 justify-center mt-9">
            <Link to="/login" className="btn-primary h-12 px-7 rounded-xl text-[15px]">
              Get started free <ArrowRight size={17} />
            </Link>
            <Link to="/docs" className="btn h-12 px-7 rounded-xl text-[15px] glass text-ink hover:bg-surface/80">
              Read the docs
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

const LANDING_JSONLD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SilkLLM",
    "url": "https://getsilkllm.com",
    "logo": "https://getsilkllm.com/logo.png",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "SilkLLM",
    "url": "https://getsilkllm.com",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Any",
    "description":
      "One API key across text, image, audio and video models from OpenAI, Anthropic, Google, DeepSeek, xAI and more. Bring your own provider key and earn credits when others use it.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free trial credits, then pay-as-you-go at provider cost plus a 10% markup.",
    },
  },
];

export default function Landing() {
  useSEO({
    title: "SilkLLM - One key for every AI model, and a marketplace that pays you back",
    description:
      "One API key across text, image, audio and video models from OpenAI, Anthropic, Google, DeepSeek and xAI. Bring your own provider key and earn credits when others use it. Start free, and keep your chats on your own device.",
    path: "/",
    jsonLd: LANDING_JSONLD,
  });

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
