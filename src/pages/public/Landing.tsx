/**
 * Landing.tsx - SilkLLM 2026 Living Landing Page
 * Optimized: lighter canvas, throttled mouse, no blend-mode cursor issues.
 * - Magnetic cursor (no mix-blend-mode, avoids compositing bugs)
 * - Breathing noise mesh (pauses when off-screen, ~20fps, no grid)
 * - Throttled hero mouse tracking (RAF-based)
 * - Provider cards with fluid surface-tension hover
 * - Code block types itself when it enters viewport
 * All routes preserved from original App.tsx
 */

// File: silkllm-frontend/src/pages/public/Landing.tsx

import React, {
  useRef, useEffect, useState, useCallback, useMemo
} from "react";
import { motion, useMotionValue, useSpring, useTransform,
         useScroll } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight, ChevronDown, Coins, Type, Image as ImageIcon, AudioLines,
  Video, ShieldCheck, Sparkles, Gift,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// MAGNETIC CURSOR - no mixBlendMode to prevent white-section compositing bugs
// ─────────────────────────────────────────────────────────────────────────────
function MagneticCursor() {
  const cursorX  = useMotionValue(-100);
  const cursorY  = useMotionValue(-100);
  // Softer springs for less jitter
  const trailX   = useSpring(cursorX, { stiffness: 60,  damping: 20 });
  const trailY   = useSpring(cursorY, { stiffness: 60,  damping: 20 });
  const dotX     = useSpring(cursorX, { stiffness: 300, damping: 30 });
  const dotY     = useSpring(cursorY, { stiffness: 300, damping: 30 });
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const move = (e: MouseEvent) => { cursorX.set(e.clientX); cursorY.set(e.clientY); };
    const down = () => setPressed(true);
    const up   = () => setPressed(false);
    const over = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      setHovered(!!(el.closest("a,button,[data-magnetic]")));
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mousedown", down);
    window.addEventListener("mouseup",   up);
    window.addEventListener("mouseover", over);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup",   up);
      window.removeEventListener("mouseover", over);
    };
  }, [cursorX, cursorY]);

  const ringSize = hovered ? 40 : 24;

  return (
    <>
      {/* Ring - no mix-blend-mode, uses soft shadow for visibility */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full"
        style={{
          x: useTransform(trailX, v => v - ringSize / 2),
          y: useTransform(trailY, v => v - ringSize / 2),
          width: ringSize,
          height: ringSize,
          border: "1.5px solid #D29A2D",
          scale: pressed ? 0.7 : 1,
          opacity: 0.85,
          boxShadow: "0 0 18px rgba(210,154,45,0.3), 0 0 4px rgba(210,154,45,0.5)",
          transition: "width 0.25s, height 0.25s",
        }}
      />
      {/* Dot */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full"
        style={{
          x: useTransform(dotX, v => v - 3),
          y: useTransform(dotY, v => v - 3),
          width: 6,
          height: 6,
          background: "#D29A2D",
          opacity: hovered ? 0 : 1,
          boxShadow: "0 0 10px rgba(210,154,45,0.6)",
          transition: "opacity 0.2s",
        }}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BREATHING NOISE MESH - optimized: ~20fps, no grid, 2 orbs, pauses off-screen
// ─────────────────────────────────────────────────────────────────────────────
function NoiseMesh({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef  = useRef({ x: 0.5, y: 0.5 });
  const t         = useRef(0);
  const frameCount = useRef(0);
  const rafId      = useRef<number>(0);
  const isVisible  = useRef(true);

  // Update mouse ref when props change (throttled by parent)
  useEffect(() => {
    mouseRef.current = { x: mouseX, y: mouseY };
  }, [mouseX, mouseY]);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;

    const resize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Pause canvas when scrolled out of view
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible.current = entry.isIntersecting;
        if (entry.isIntersecting && !rafId.current) {
          // Resume
          draw();
        }
      },
      { threshold: 0 }
    );
    observer.observe(c);

    const draw = () => {
      if (!isVisible.current) {
        rafId.current = 0;
        return;
      }

      rafId.current = requestAnimationFrame(draw);

      // Draw only every 3rd frame (~20fps) for huge GPU savings
      frameCount.current++;
      if (frameCount.current % 3 !== 0) return;

      t.current += 0.012; // scaled up to match ~20fps timing
      const W = c.width;
      const H = c.height;
      ctx.clearRect(0, 0, W, H);

      // base radial gradient
      const base = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H * 0.4, W);
      base.addColorStop(0, "#1A1900");
      base.addColorStop(0.4, "#0F1010");
      base.addColorStop(1, "#080809");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);

      // mouse bloom
      const mx = mouseRef.current.x * W;
      const my = mouseRef.current.y * H;
      const bloom = ctx.createRadialGradient(mx, my, 0, mx, my, W * 0.5);
      bloom.addColorStop(0, "rgba(210,154,45,0.08)");
      bloom.addColorStop(0.5, "rgba(210,154,45,0.015)");
      bloom.addColorStop(1, "transparent");
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, W, H);

      // Only 2 breathing orbs (was 3) - lighter on GPU
      [
        { bx: 0.25, by: 0.3, sx: 0.05, sy: 0.04, ts: 0.7, tc: 0.9, r: 0.36, ca: "rgba(210,154,45,", p: 0.02 },
        { bx: 0.75, by: 0.6, sx: 0.04, sy: 0.05, ts: 0.5, tc: 0.6, r: 0.28, ca: "rgba(77,78,42,",   p: 0.014 },
      ].forEach(o => {
        const ox = o.bx + o.sx * Math.sin(t.current * o.ts);
        const oy = o.by + o.sy * Math.cos(t.current * o.tc);
        const pulse = o.p + 0.005 * Math.sin(t.current * 2.1 + o.r);
        const g = ctx.createRadialGradient(ox * W, oy * H, 0, ox * W, oy * H, o.r * W);
        g.addColorStop(0, o.ca + pulse + ")");
        g.addColorStop(0.55, o.ca + "0.003)");
        g.addColorStop(1, "transparent");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      });

      // No more grid - saves dozens of stroke calls per frame
    };

    draw();

    return () => {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ willChange: "transform" }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPEWRITER CODE BLOCK
// ─────────────────────────────────────────────────────────────────────────────
const CODE_LINES = [
  { text: "import silkllm",                               color: "#D0C51E" },
  { text: "",                                             color: "" },
  { text: `client = silkllm.Client(api_key="silk_...")`,  color: "#EDEFF0" },
  { text: "",                                             color: "" },
  { text: "response = client.generate(",                  color: "#EDEFF0" },
  { text: `    model="gpt-4o",   # or claude, gemini`,    color: "#595F61" },
  { text: `    messages=[{"role": "user",`,               color: "#B5B86B" },
  { text: `               "content": "Hello!"}]`,         color: "#B5B86B" },
  { text: ")",                                            color: "#EDEFF0" },
  { text: "",                                             color: "" },
  { text: "print(response.content)",                      color: "#74aa9c" },
  { text: "# Cost: $0.0023 | Balance: $47.82",            color: "#595F61" },
];

function TypewriterCode() {
  const ref      = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [chars,   setChars]   = useState(0);
  const allChars = CODE_LINES.reduce((a, l) => a + l.text.length + 1, 0);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold: 0.3 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || chars >= allChars) return;
    const id = setTimeout(() => setChars(c => c + (Math.random() > 0.7 ? 3 : 1)), 18);
    return () => clearTimeout(id);
  }, [visible, chars, allChars]);

  return (
    <div
      ref={ref}
      className="rounded-2xl overflow-hidden"
      style={{
        background: "#0D0E0F",
        border: "1px solid #1E2022",
        boxShadow: "0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(210,154,45,0.06)",
      }}
    >
      {/* Title bar */}
      <div
        className="flex items-center gap-2 px-5 py-3.5"
        style={{ borderBottom: "1px solid #1A1C1E", background: "#111314" }}
      >
        <div className="flex gap-1.5">
          {["#ff5f57", "#ffbd2e", "#28ca41"].map(c => (
            <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />
          ))}
        </div>
        <span className="ml-3 text-xs font-mono" style={{ color: "#3A3F42" }}>example.py</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#28ca41" }} />
          <span className="text-xs font-mono" style={{ color: "#28ca41", opacity: 0.7 }}>live</span>
        </div>
      </div>
      {/* Code area */}
      <pre className="p-6 text-sm font-mono leading-7 overflow-x-auto" style={{ minHeight: 300, margin: 0 }}>
        {CODE_LINES.map((line, li) => {
          const start = CODE_LINES.slice(0, li).reduce((a, l) => a + l.text.length + 1, 0);
          const end   = start + line.text.length;
          const show  = Math.max(0, Math.min(line.text.length, chars - start));
          if (chars < start) return null;
          return (
            <div key={li}>
              <span style={{ color: line.color || "#EDEFF0" }}>{line.text.slice(0, show)}</span>
              {chars >= start && chars < end && (
                <span className="animate-pulse" style={{ borderRight: "2px solid #D29A2D" }}>&nbsp;</span>
              )}
            </div>
          );
        })}
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER CARD - tilt + glow on hover (unchanged visually, slightly lighter)
// ─────────────────────────────────────────────────────────────────────────────
const PROVIDERS = [
  { name: "OpenAI",    color: "#74aa9c", sub: "GPT-4o · o3 · o1"        },
  { name: "Anthropic", color: "#D97757", sub: "Claude 3.5 · 3.7 Sonnet" },
  { name: "Google",    color: "#4285f4", sub: "Gemini 2.0 · 1.5 Flash"  },
  { name: "DeepSeek",  color: "#5BC4F5", sub: "V3 · R1 · Coder"         },
  { name: "xAI",       color: "#D8D8D8", sub: "Grok 3 · Grok 3 Mini"    },
];

function ProviderCard({ name, color, sub, index }: (typeof PROVIDERS)[0] & { index: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rotX = useMotionValue(0);
  const rotY = useMotionValue(0);
  const glow = useMotionValue(0);
  const sRotX = useSpring(rotX, { stiffness: 180, damping: 22 });
  const sRotY = useSpring(rotY, { stiffness: 180, damping: 22 });
  const sGlow = useSpring(glow, { stiffness: 120, damping: 28 });

  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = cardRef.current!.getBoundingClientRect();
    rotX.set(((e.clientY - r.top - r.height / 2) / r.height) * -10);
    rotY.set(((e.clientX - r.left - r.width / 2) / r.width) * 10);
    glow.set(1);
  }, [rotX, rotY, glow]);

  const onLeave = useCallback(() => {
    rotX.set(0);
    rotY.set(0);
    glow.set(0);
  }, [rotX, rotY, glow]);

  return (
    <motion.div
      ref={cardRef}
      data-magnetic
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay: index * 0.09, ease: [0.16, 1, 0.3, 1] }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: sRotX, rotateY: sRotY, transformStyle: "preserve-3d", perspective: 600 }}
      className="relative rounded-2xl cursor-default"
    >
      {/* Glow overlay */}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${color}33, transparent 55%)`,
          opacity: sGlow,
        }}
      />
      {/* Card body */}
      <div
        className="relative rounded-2xl px-6 py-5"
        style={{ background: "#0F1011", border: "1px solid #1E2022" }}
      >
        <motion.div
          className="w-2.5 h-2.5 rounded-full mb-4"
          style={{ background: color }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.5 + index * 0.3, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="font-display font-semibold text-base mb-1"
          style={{ color: "#EDEFF0", letterSpacing: "-0.01em" }}
        >
          {name}
        </div>
        <div className="text-xs font-mono" style={{ color: "#595F61" }}>
          {sub}
        </div>
        {/* Bottom glow line */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 h-px rounded-b-2xl"
          style={{
            background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
            opacity: sGlow,
          }}
        />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATED STAT COUNT-UP
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedStat({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) {
  const ref    = useRef<HTMLDivElement>(null);
  const fired  = useRef(false);
  const [display, setDisplay] = useState("-");

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || fired.current) return;
        fired.current = true;
        const num = parseFloat(value);
        const hasPlus = value.includes("+");
        const hasPct  = value.includes("%");
        const dur = 1300;
        const startAt = Date.now() + delay * 1000;
        const tick = () => {
          const now = Date.now();
          if (now < startAt) {
            requestAnimationFrame(tick);
            return;
          }
          const p = Math.min((now - startAt) / dur, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          const v = num * ease;
          const formatted = hasPct
            ? v.toFixed(1) + "%"
            : v >= 10
              ? Math.round(v) + (hasPlus ? "+" : "")
              : v.toFixed(0) + (hasPlus ? "+" : "");
          setDisplay(formatted);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.5 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value, label, delay]);

  return (
    <div ref={ref} className="text-center">
      <div
        className="font-display font-bold text-4xl md:text-5xl mb-1.5"
        style={{ color: "#D29A2D", letterSpacing: "-0.04em" }}
      >
        {display}
      </div>
      <div className="text-xs uppercase tracking-widest font-mono" style={{ color: "#3A3F42" }}>
        {label}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV
// ─────────────────────────────────────────────────────────────────────────────
function Nav() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const unsub = scrollY.on("change", v => setSolid(v > 60));
    return unsub;
  }, [scrollY]);

  const navLinkStyle = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement | HTMLDivElement>) => {
      (e.currentTarget as HTMLElement).style.color = "#D29A2D";
    },
    []
  );
  const navLinkLeave = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement | HTMLDivElement>) => {
      (e.currentTarget as HTMLElement).style.color = "#595F61";
    },
    []
  );

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4"
      animate={{
        background: solid ? "rgba(8,8,9,0.92)" : "transparent",
        borderBottomColor: solid ? "rgba(255,255,255,0.05)" : "transparent",
      }}
      style={{
        backdropFilter: solid ? "blur(20px)" : "none",
        borderBottom: "1px solid transparent",
      }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className="font-display font-bold text-2xl tracking-tight"
        style={{ color: "#D29A2D" }}
        whileHover={{ scale: 1.04 }}
      >
        SilkLLM
      </motion.div>

      <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "#595F61" }}>
        {[
          ["#marketplace", "Marketplace"],
          ["#modalities", "Modalities"],
          ["#pricing", "Pricing"],
          ["/docs", "Docs"],
        ].map(([href, label]) =>
          (href as string).startsWith("/") ? (
            <Link
              key={label}
              to={href as string}
              className="transition-colors duration-200"
              style={{ color: "inherit" }}
              onMouseEnter={navLinkStyle}
              onMouseLeave={navLinkLeave}
            >
              {label}
            </Link>
          ) : (
            <a
              key={label}
              href={href as string}
              className="transition-colors duration-200"
              style={{ color: "inherit" }}
              onMouseEnter={navLinkStyle}
              onMouseLeave={navLinkLeave}
            >
              {label}
            </a>
          )
        )}
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/login"
          style={{ color: "#595F61", fontSize: "0.875rem", transition: "color 0.2s" }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#EDEFF0")}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#595F61")}
        >
          Sign In
        </Link>
        <Link to="/login">
          <motion.div
            className="text-sm font-semibold px-5 py-2.5 rounded-xl"
            style={{ background: "#D29A2D", color: "#0A0A0A" }}
            whileHover={{ scale: 1.03, background: "#E0A830" }}
            whileTap={{ scale: 0.97 }}
          >
            Get Started
          </motion.div>
        </Link>
      </div>
    </motion.nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO - throttled mouse tracking so it no longer feels like "dragging mountains"
// ─────────────────────────────────────────────────────────────────────────────
function Hero() {
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const rafRef   = useRef<number>(0);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.22], [1, 0]);
  const heroY       = useTransform(scrollYProgress, [0, 0.22], [0, -70]);

  // Throttled mouse handler - max one state update per animation frame
  useEffect(() => {
    const h = (e: MouseEvent) => {
      mouseRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          setMouse({ ...mouseRef.current });
          rafRef.current = 0;
        });
      }
    };
    window.addEventListener("mousemove", h);
    return () => {
      window.removeEventListener("mousemove", h);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <NoiseMesh mouseX={mouse.x} mouseY={mouse.y} />

      {/* vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, #080809 100%)",
        }}
      />

      <motion.div
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative z-10 text-center px-6 max-w-5xl mx-auto pt-28"
      >
        {/* eyebrow pill */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full mb-10"
          style={{
            border: "1px solid rgba(210,154,45,0.2)",
            background: "rgba(210,154,45,0.05)",
            color: "#D29A2D",
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
          }}
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full inline-block"
            style={{ background: "#D29A2D" }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          ONE KEY - EVERY MODEL - A LIVING MARKETPLACE
        </motion.div>

        {/* headline - word by word reveal */}
        {[
          { text: "One API.",      stroke: false, delay: 0.2 },
          { text: "One Bill.",     stroke: true,  delay: 0.38 },
          { text: "Infinite Models.", stroke: false, delay: 0.56 },
        ].map((line, i) => (
          <div key={i} className="overflow-hidden mb-3">
            <motion.h1
              initial={{ y: "110%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.85, delay: line.delay, ease: [0.16, 1, 0.3, 1] }}
              className="font-display font-bold leading-[0.9] tracking-tight block"
              style={{
                fontSize: "clamp(3.5rem,10vw,8.5rem)",
                color: line.stroke ? "transparent" : "#EDEFF0",
                WebkitTextStroke: line.stroke ? "2px #D29A2D" : undefined,
              }}
            >
              {line.text}
            </motion.h1>
          </div>
        ))}

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.75 }}
          className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
          style={{ color: "#595F61" }}
        >
          One key across text, image, audio and video. Bring your own provider key and earn credits when
          others use it. Start free, and keep your chats on your own device.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.9 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link to="/login">
            <motion.div
              className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl"
              style={{ background: "#D29A2D", color: "#0A0A0A" }}
              whileHover={{
                scale: 1.04,
                background: "#E0A830",
                boxShadow: "0 0 50px rgba(210,154,45,0.4)",
              }}
              whileTap={{ scale: 0.96 }}
            >
              Get Started Free <ArrowRight size={17} />
            </motion.div>
          </Link>
          <Link to="/docs">
            <motion.div
              className="inline-flex items-center gap-2 text-base font-semibold px-8 py-4 rounded-2xl"
              style={{ border: "1px solid #222426", color: "#595F61" }}
              whileHover={{
                borderColor: "#D29A2D44",
                color: "#EDEFF0",
                background: "rgba(210,154,45,0.04)",
              }}
            >
              View Docs
            </motion.div>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS ROW
// ─────────────────────────────────────────────────────────────────────────────
function StatsRow() {
  return (
    <section className="py-16 px-6" style={{ background: "#0A0A0A", borderTop: "1px solid #111314" }}>
      <div className="max-w-3xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8">
        <AnimatedStat value="99.9" label="Uptime (%)"         delay={0} />
        <AnimatedStat value="50+"  label="Models"             delay={0.1} />
        <AnimatedStat value="4"    label="Modalities"         delay={0.2} />
        <AnimatedStat value="75%"  label="Earn on your keys"  delay={0.3} />
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: "01",
    title: "Connect",
    accent: "#D29A2D",
    desc: "Create an account via Google or GitHub OAuth. Generate an API key. Add credits via Stripe or Paystack.",
  },
  {
    n: "02",
    title: "Generate",
    accent: "#D0C51E",
    desc: "Call /generate with any model. SilkLLM routes to the best provider and automatically falls back if needed.",
  },
  {
    n: "03",
    title: "Pay",
    accent: "#B5B86B",
    desc: "Credits deducted per request at provider cost + 10% markup. Transparent. Predictable. Never expires.",
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 px-6" style={{ background: "#080809" }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-20"
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "#3A3F42" }}>
            Process
          </p>
          <h2
            className="font-display font-bold leading-tight"
            style={{
              fontSize: "clamp(2.5rem,6vw,4.5rem)",
              color: "#EDEFF0",
              letterSpacing: "-0.03em",
            }}
          >
            Three steps.
            <br />
            <span style={{ color: "#D29A2D" }}>Production-ready.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-px" style={{ background: "#151618" }}>
          {STEPS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] }}
              className="group p-10 relative overflow-hidden"
              style={{ background: "#0A0A0A" }}
              whileHover={{ background: "#0D0E0F" }}
            >
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(135deg, ${s.accent}08, transparent)`,
                  opacity: 0,
                  transition: "opacity 0.4s",
                }}
                whileHover={{ opacity: 1 }}
              />
              <div
                className="font-display text-7xl font-bold mb-6 leading-none"
                style={{ color: "#181A1B", letterSpacing: "-0.04em" }}
              >
                {s.n}
              </div>
              <div className="text-xl font-display font-semibold mb-3" style={{ color: "#EDEFF0" }}>
                {s.title}
              </div>
              <div className="text-sm leading-relaxed" style={{ color: "#595F61" }}>
                {s.desc}
              </div>
              <motion.div
                className="absolute bottom-0 left-0 h-0.5"
                style={{ background: s.accent, width: 0 }}
                whileInView={{ width: "100%" }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.5 + i * 0.15, ease: [0.16, 1, 0.3, 1] }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────
function Providers() {
  return (
    <section id="providers" className="py-28 px-6" style={{ background: "#0A0A0A" }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "#3A3F42" }}>
            Providers
          </p>
          <h2
            className="font-display font-bold"
            style={{
              fontSize: "clamp(2.5rem,6vw,4.5rem)",
              color: "#EDEFF0",
              letterSpacing: "-0.03em",
            }}
          >
            Every network.
            <br />
            <span style={{ color: "#D29A2D" }}>One key.</span>
          </h2>
          <p className="text-base leading-relaxed mt-5 max-w-xl" style={{ color: "#595F61" }}>
            We start with the majors and add more continuously. Your one key keeps working as the catalogue grows.
          </p>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PROVIDERS.map((p, i) => (
            <ProviderCard key={p.name} {...p} index={i} />
          ))}
          {/* Growth card: signals we go beyond the current set */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.7, delay: PROVIDERS.length * 0.09, ease: [0.16, 1, 0.3, 1] }}
            className="relative rounded-2xl px-6 py-5 flex flex-col justify-center items-start overflow-hidden"
            style={{ background: "#0F1011", border: "1px dashed #2A2C2E" }}
          >
            <motion.div
              className="absolute inset-0 pointer-events-none"
              animate={{ opacity: [0.15, 0.4, 0.15] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "radial-gradient(circle at 30% 30%, rgba(210,154,45,0.14), transparent 70%)" }}
            />
            <div className="relative font-display font-semibold text-base" style={{ color: "#D29A2D" }}>
              and more
            </div>
            <div className="relative text-xs font-mono mt-1" style={{ color: "#595F61" }}>
              added continuously
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────────────────────────────────────
const PRICES = [
  { label: "GPT-4o",            price: "$0.0055/1K",   color: "#74aa9c" },
  { label: "Claude 3.5 Sonnet", price: "$0.0033/1K",   color: "#D97757" },
  { label: "Gemini 1.5 Flash",  price: "$0.000083/1K", color: "#4285f4" },
  { label: "DeepSeek V3",       price: "$0.00028/1K",  color: "#5BC4F5" },
  { label: "Grok 3 Mini",       price: "$0.00033/1K",  color: "#D8D8D8" },
];

function Pricing() {
  return (
    <section id="pricing" className="py-28 px-6" style={{ background: "#080809" }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "#3A3F42" }}>
            Pricing
          </p>
          <h2
            className="font-display font-bold"
            style={{
              fontSize: "clamp(2.5rem,6vw,4.5rem)",
              color: "#EDEFF0",
              letterSpacing: "-0.03em",
            }}
          >
            Provider cost
            <br />
            <span style={{ color: "#D29A2D" }}>+ 10%. Full stop.</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="rounded-2xl p-10 flex flex-col justify-between"
            style={{
              background: "#0D0E0F",
              border: "1px solid #1A1C1E",
              boxShadow: "inset 0 1px 0 rgba(210,154,45,0.05)",
            }}
          >
            <div>
              <div
                className="font-display font-bold mb-2"
                style={{
                  fontSize: "5.5rem",
                  lineHeight: 1,
                  color: "#D29A2D",
                  letterSpacing: "-0.04em",
                }}
              >
                +10%
              </div>
              <div className="text-sm leading-relaxed mb-6" style={{ color: "#595F61" }}>
                No subscriptions. No seats. No hidden fees.
                <br />
                USD via Stripe · NGN via Paystack.
                <br />
                Credits never expire.
              </div>
            </div>
            <Link to="/login">
              <motion.div
                className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl w-fit"
                style={{ background: "#D29A2D", color: "#0A0A0A" }}
                whileHover={{ scale: 1.03, background: "#E0A830" }}
                whileTap={{ scale: 0.97 }}
              >
                Add Credits <ArrowRight size={15} />
              </motion.div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "#0D0E0F", border: "1px solid #1A1C1E" }}
          >
            <div
              className="px-6 py-4 border-b text-xs font-mono uppercase tracking-widest"
              style={{ borderColor: "#1A1C1E", color: "#3A3F42" }}
            >
              Sample input prices · per 1K tokens
            </div>
            {PRICES.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: 16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.07 }}
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: i < PRICES.length - 1 ? "1px solid #111314" : "none" }}
                whileHover={{ background: "#111314" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                  <span className="text-sm" style={{ color: "#C2C9CC" }}>
                    {item.label}
                  </span>
                </div>
                <span className="font-mono text-sm" style={{ color: "#D29A2D" }}>
                  {item.price}
                </span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEV EXPERIENCE
// ─────────────────────────────────────────────────────────────────────────────
function DevExperience() {
  return (
    <section className="py-28 px-6" style={{ background: "#0A0A0A" }}>
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "#3A3F42" }}>
              DX
            </p>
            <h2
              className="font-display font-bold mb-6 leading-tight"
              style={{
                fontSize: "clamp(2rem,5vw,3.5rem)",
                color: "#EDEFF0",
                letterSpacing: "-0.03em",
              }}
            >
              Integrate
              <br />
              <span style={{ color: "#D29A2D" }}>in minutes.</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "#595F61" }}>
              <code
                className="font-mono text-sm px-2 py-0.5 rounded"
                style={{
                  background: "#141617",
                  color: "#D29A2D",
                  border: "1px solid #1E2022",
                }}
              >
                pip install silkllm
              </code>{" "}
              and you're live. Streaming support, automatic fallbacks, and per-request cost tracking out of the
              box.
            </p>
            <div className="space-y-3 mb-8">
              {[
                "Streaming via SSE",
                "Automatic provider fallbacks",
                "Per-request cost in every response",
                "Python & JavaScript SDKs",
              ].map((f, i) => (
                <motion.div
                  key={f}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-3 text-sm"
                  style={{ color: "#7A8285" }}
                >
                  <motion.div
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{
                      background: "rgba(210,154,45,0.1)",
                      border: "1px solid rgba(210,154,45,0.2)",
                    }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#D29A2D" }} />
                  </motion.div>
                  {f}
                </motion.div>
              ))}
            </div>
            <Link to="/login">
              <motion.div
                className="inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl w-fit"
                style={{ border: "1px solid #D29A2D33", color: "#D29A2D" }}
                whileHover={{
                  background: "rgba(210,154,45,0.07)",
                  borderColor: "#D29A2D66",
                }}
              >
                Start Building <ArrowRight size={15} />
              </motion.div>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <TypewriterCode />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA
// ─────────────────────────────────────────────────────────────────────────────
function CTA() {
  return (
    <section className="py-28 px-6 relative overflow-hidden" style={{ background: "#080809" }}>
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.35, 0.75, 0.35] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          background:
            "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(210,154,45,0.07), transparent)",
        }}
      />
      <div className="relative max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2
            className="font-display font-bold mb-6 leading-tight"
            style={{
              fontSize: "clamp(2.5rem,7vw,5rem)",
              color: "#EDEFF0",
              letterSpacing: "-0.04em",
            }}
          >
            Ready to ship
            <br />
            <span style={{ color: "#D29A2D" }}>faster?</span>
          </h2>
          <p className="text-lg mb-12" style={{ color: "#595F61" }}>
            One API key. Every model. Start free, scale as you grow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <motion.div
                className="inline-flex items-center gap-2 text-base font-semibold px-10 py-4 rounded-2xl"
                style={{ background: "#D29A2D", color: "#0A0A0A" }}
                whileHover={{
                  scale: 1.04,
                  background: "#E0A830",
                  boxShadow: "0 0 60px rgba(210,154,45,0.4)",
                }}
                whileTap={{ scale: 0.96 }}
              >
                Get Started Free <ArrowRight size={17} />
              </motion.div>
            </Link>
            <Link to="/docs">
              <motion.div
                className="inline-flex items-center gap-2 text-base font-semibold px-10 py-4 rounded-2xl"
                style={{ border: "1px solid #1E2022", color: "#595F61" }}
                whileHover={{ borderColor: "#D29A2D44", color: "#EDEFF0" }}
              >
                Read the Docs
              </motion.div>
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer
      className="px-8 py-10"
      style={{ borderTop: "1px solid #111314", background: "#0A0A0A" }}
    >
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div
          className="font-display font-bold text-xl tracking-tight"
          style={{ color: "#D29A2D" }}
        >
          SilkLLM
        </div>
        <div className="flex gap-8 text-sm" style={{ color: "#3A3F42" }}>
          {[
            ["Docs", "/docs"],
            ["Dashboard", "/login"],
            ["Pricing", "#pricing"],
            ["Providers", "#providers"],
          ].map(([l, h]) =>
            (h as string).startsWith("/") ? (
              <Link
                key={l}
                to={h as string}
                style={{ color: "inherit", transition: "color 0.2s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#D29A2D")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#3A3F42")}
              >
                {l}
              </Link>
            ) : (
              <a
                key={l}
                href={h as string}
                style={{ color: "inherit", transition: "color 0.2s" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "#D29A2D")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = "#3A3F42")}
              >
                {l}
              </a>
            )
          )}
        </div>
        <div className="text-sm" style={{ color: "#2C2F31" }}>
          © {new Date().getFullYear()} SilkLLM
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SILK THREAD - hand-crafted animated SVG ribbon (the brand signature)
// ─────────────────────────────────────────────────────────────────────────────
function SilkThread({ height = 120 }: { height?: number }) {
  return (
    <div className="relative w-full overflow-hidden" style={{ height, background: "#080809" }} aria-hidden>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1200 120" preserveAspectRatio="none">
        <defs>
          <linearGradient id="silkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D29A2D" stopOpacity="0" />
            <stop offset="50%" stopColor="#D29A2D" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#B5B86B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => (
          <motion.path
            key={i}
            d={`M0 ${60 + i * 6} C 300 ${20 + i * 10}, 500 ${100 - i * 8}, 700 ${60 + i * 4} S 1100 ${30 + i * 6}, 1200 ${60 - i * 4}`}
            fill="none"
            stroke="url(#silkGrad)"
            strokeWidth={1.5}
            strokeDasharray="10 16"
            animate={{ strokeDashoffset: [0, -260] }}
            transition={{ duration: 6 + i * 2, repeat: Infinity, ease: "linear" }}
            style={{ opacity: 0.5 - i * 0.13 }}
          />
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EARN LOOP - the BYOK marketplace, told as a flow
// ─────────────────────────────────────────────────────────────────────────────
const EARN_STEPS = [
  { icon: <Coins size={20} />,       title: "Deposit a key",  desc: "Add your own provider key as public." },
  { icon: <Sparkles size={20} />,    title: "Others use it",  desc: "Our engine serves other users with it." },
  { icon: <ArrowRight size={20} />,  title: "You earn 75%",   desc: "Credited to you as SilkLLM balance." },
  { icon: <ShieldCheck size={20} />, title: "Spend anywhere", desc: "Use credits on any model, any provider." },
];

function EarnLoop() {
  return (
    <section id="marketplace" className="py-28 px-6" style={{ background: "#0A0A0A" }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.8 }} className="mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "#3A3F42" }}>Marketplace</p>
          <h2 className="font-display font-bold leading-tight"
            style={{ fontSize: "clamp(2.5rem,6vw,4.5rem)", color: "#EDEFF0", letterSpacing: "-0.03em" }}>
            Bring your own key.
            <br /><span style={{ color: "#D29A2D" }}>Earn while you build.</span>
          </h2>
          <p className="text-base leading-relaxed mt-5 max-w-xl" style={{ color: "#595F61" }}>
            Share a key and our engine quietly uses it to serve others. You earn 75% of the provider cost as
            credits. Public keys are never shown to anyone, and a working marketplace key always comes before ours.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {EARN_STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -5 }}
              className="relative rounded-2xl px-5 py-6"
              style={{ background: "#0F1011", border: "1px solid #1E2022" }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4"
                style={{ background: "rgba(210,154,45,0.1)", color: "#D29A2D", border: "1px solid rgba(210,154,45,0.2)" }}>
                {s.icon}
              </div>
              <div className="font-display font-semibold text-sm mb-1" style={{ color: "#EDEFF0" }}>{s.title}</div>
              <div className="text-xs leading-relaxed" style={{ color: "#595F61" }}>{s.desc}</div>
              <div className="absolute top-4 right-4 font-mono text-xs" style={{ color: "#22242699" }}>{`0${i + 1}`}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODALITIES - text / image / audio / video
// ─────────────────────────────────────────────────────────────────────────────
const MODALITIES = [
  { icon: <Type size={22} />,       name: "Text",  sub: "GPT-4o, Claude, Gemini, Grok", color: "#D29A2D" },
  { icon: <ImageIcon size={22} />,  name: "Image", sub: "DALL-E and more",             color: "#D0C51E" },
  { icon: <AudioLines size={22} />, name: "Audio", sub: "Text to speech",              color: "#B5B86B" },
  { icon: <Video size={22} />,      name: "Video", sub: "Where providers support it",  color: "#FAC059" },
];

function Modalities() {
  return (
    <section id="modalities" className="py-28 px-6" style={{ background: "#080809" }}>
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.8 }} className="mb-16"
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "#3A3F42" }}>Modalities</p>
          <h2 className="font-display font-bold" style={{ fontSize: "clamp(2.5rem,6vw,4.5rem)", color: "#EDEFF0", letterSpacing: "-0.03em" }}>
            Every modality.
            <br /><span style={{ color: "#D29A2D" }}>One gateway.</span>
          </h2>
        </motion.div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {MODALITIES.map((m, i) => (
            <motion.div
              key={m.name} data-magnetic
              initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.09, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              className="rounded-2xl px-6 py-7" style={{ background: "#0F1011", border: "1px solid #1E2022" }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                style={{ background: `${m.color}18`, color: m.color, border: `1px solid ${m.color}33` }}>
                {m.icon}
              </div>
              <div className="font-display font-semibold text-lg mb-1" style={{ color: "#EDEFF0" }}>{m.name}</div>
              <div className="text-xs font-mono" style={{ color: "#595F61" }}>{m.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OWN YOUR DATA - local-first chat + free trial
// ─────────────────────────────────────────────────────────────────────────────
function OwnData() {
  return (
    <section className="py-28 px-6" style={{ background: "#0A0A0A" }}>
      <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.8 }}
        >
          <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: "#3A3F42" }}>Own your data</p>
          <h2 className="font-display font-bold mb-6 leading-tight"
            style={{ fontSize: "clamp(2rem,5vw,3.5rem)", color: "#EDEFF0", letterSpacing: "-0.03em" }}>
            Your chats.
            <br /><span style={{ color: "#D29A2D" }}>Your device.</span>
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: "#595F61" }}>
            A full chat experience that keeps every conversation in your own browser. You choose how long it lives
            before it dissolves. We never store your chat content. Start on a free trial, no card needed.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl"
              style={{ background: "rgba(210,154,45,0.08)", color: "#D29A2D", border: "1px solid rgba(210,154,45,0.2)" }}>
              <Gift size={15} /> Free trial for 3 months
            </span>
            <span className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-xl"
              style={{ background: "#111314", color: "#7A8285", border: "1px solid #1E2022" }}>
              <ShieldCheck size={15} /> Nothing stored server-side
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.15 }}
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "#0D0E0F", border: "1px solid #1E2022", boxShadow: "0 32px 80px rgba(0,0,0,0.6)" }}
        >
          {[
            { me: false, text: "Write me a haiku about silk." },
            { me: true, text: "Threads of gold and light / weaving every model through / one quiet gateway." },
          ].map((b, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, x: b.me ? 20 : -20 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.25 }}
              className={`flex ${b.me ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm"
                style={b.me
                  ? { background: "#D29A2D", color: "#0A0A0A" }
                  : { background: "#141617", color: "#C2C9CC", border: "1px solid #1E2022" }}>
                {b.text}
              </div>
            </motion.div>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 rounded-xl px-3 py-2 text-xs font-mono" style={{ background: "#141617", color: "#3A3F42", border: "1px solid #1E2022" }}>
              Message SilkLLM...
            </div>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "#D29A2D", color: "#0A0A0A" }}>
              <ArrowRight size={15} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function Landing() {
  // The custom cursor is desktop-only; touch devices keep their native behavior.
  const [finePointer, setFinePointer] = useState(false);
  useEffect(() => {
    setFinePointer(typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches);
  }, []);

  return (
    <div style={{ background: "#0A0A0A", cursor: finePointer ? "none" : "auto" }}>
      {finePointer && <MagneticCursor />}
      <Nav />
      <Hero />
      <StatsRow />
      <EarnLoop />
      <SilkThread />
      <Modalities />
      <HowItWorks />
      <Providers />
      <SilkThread />
      <OwnData />
      <Pricing />
      <DevExperience />
      <SilkThread height={90} />
      <CTA />
      <Footer />
    </div>
  );
}