/**
 * Docs.tsx
 * Public documentation page — quickstart, API reference, SDK examples.
 * Dark-first redesign for readability.
 */

// File: silkllm-frontend/src/pages/public/Docs.tsx

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Copy, CheckCircle, BookOpen, Key, Zap, Layers, Code2, AlertTriangle, ChevronRight } from "lucide-react";

const CODE = {
  pyInstall: `pip install silkllm`,
  pyBasic: `import silkllm

client = silkllm.Client(api_key="silk_your_key_here")

response = client.generate(
    messages=[{"role": "user", "content": "Explain quantum computing simply."}],
    model="gpt-4o",          # optional — omit to use cheapest available
    temperature=0.7,
    max_tokens=1024,
)

print(response.content)
print(f"Tokens: {response.usage.prompt_tokens} + {response.usage.completion_tokens}")
print(f"Cost: \${response.cost_usd:.6f}")`,

  pyStream: `import silkllm

client = silkllm.Client(api_key="silk_your_key_here")

for chunk in client.stream(
    messages=[{"role": "user", "content": "Write a short poem."}],
    model="claude-3-5-sonnet-20241022",
):
    print(chunk, end="", flush=True)`,

  jsInstall: `npm install silkllm`,
  jsBasic: `import SilkLLM from "silkllm";

const client = new SilkLLM({ apiKey: "silk_your_key_here" });

const response = await client.generate({
  messages: [{ role: "user", content: "Hello!" }],
  model: "gemini-1.5-pro",
});

console.log(response.content);
console.log(\`Cost: $\${response.cost_usd}\`);`,

  curlExample: `curl https://your-domain.com/api/generate \\
  -H "Authorization: Bearer silk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [{"role": "user", "content": "Hello!"}],
    "model": "gpt-4o",
    "max_tokens": 512
  }'`,

  authHeader: `Authorization: Bearer silk_your_api_key_here`,

  modelsExample: `curl /api/models -H "Authorization: Bearer silk_..."
# Filter by provider:
curl /api/models?provider=anthropic -H "Authorization: Bearer silk_..."`,
};

// ── Syntax-aware token colorizer ─────────────────────────────────────────────
function colorize(line: string, lang: string): React.ReactNode[] {
  if (lang === "bash" || lang === "http") {
    return [<span key={0} style={{ color: "#C2C9CC" }}>{line}</span>];
  }

  const tokens: React.ReactNode[] = [];
  // Very lightweight tokenizer — handles the patterns in our snippets
  const patterns: [RegExp, string][] = [
    [/(#.*)$/,                                  "#595F61"],   // comments — muted
    [/("(?:[^"\\]|\\.)*")/g,                   "#B5B86B"],   // strings — warm olive
    [/\b(import|from|for|print|const|await|console\.log|new)\b/g, "#D0C51E"], // keywords — electric yellow
    [/\b(silkllm|SilkLLM|client|response|chunk)\b/g, "#74aa9c"], // identifiers — teal
    [/\b(True|False|None|null|undefined)\b/g,  "#D97757"],   // literals — orange
    [/(silk_[a-z_]+)/g,                        "#D29A2D"],   // API keys — gold
    [/(\$\{[^}]+\})/g,                         "#D0C51E"],   // template literals
    [/(\d+\.?\d*)/g,                           "#D29A2D"],   // numbers — gold
  ];

  // Check for comment first (line-level)
  const commentMatch = line.match(/#(.*)$/);
  if (commentMatch) {
    const idx = line.indexOf("#");
    const before = line.slice(0, idx);
    const comment = line.slice(idx);
    return [
      <span key="b" style={{ color: "#EDEFF0" }}>{before}</span>,
      <span key="c" style={{ color: "#595F61", fontStyle: "italic" }}>{comment}</span>,
    ];
  }

  return [<span key={0} style={{ color: "#EDEFF0" }}>{line}</span>];
}

// ── Code block ───────────────────────────────────────────────────────────────
function CodeBlock({ code, lang = "python" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const langLabel: Record<string, string> = {
    python: "Python", bash: "Shell", javascript: "JavaScript",
    http: "HTTP", json: "JSON",
  };

  return (
    <div className="rounded-xl overflow-hidden border my-4"
         style={{ borderColor: "#2C2F31", background: "#141617" }}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b"
           style={{ borderColor: "#2C2F31", background: "#1A1C1D" }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "#D29A2D", opacity: 0.7 }} />
          <span className="text-xs font-mono" style={{ color: "#7A8285" }}>
            {langLabel[lang] || lang}
          </span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs transition-colors duration-150 px-2 py-1 rounded"
          style={{ color: copied ? "#74aa9c" : "#7A8285" }}
          onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = "#D29A2D"; }}
          onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = "#7A8285"; }}
        >
          {copied
            ? <><CheckCircle size={11} /> Copied</>
            : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      {/* Code body */}
      <pre className="p-5 overflow-x-auto text-sm font-mono leading-7"
           style={{ background: "#141617", margin: 0 }}>
        {code.split("\n").map((line, i) => (
          <div key={i} className="flex">
            <span className="select-none w-8 shrink-0 text-right mr-5 text-xs leading-7"
                  style={{ color: "#3A3F42" }}>
              {i + 1}
            </span>
            <span style={{ color: "#EDEFF0" }}>{colorize(line, lang)}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

// ── Inline code pill ─────────────────────────────────────────────────────────
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <code className="text-sm font-mono px-1.5 py-0.5 rounded"
          style={{ background: "#242729", color: "#D29A2D", border: "1px solid #2C2F31" }}>
      {children}
    </code>
  );
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({ id, title, icon, children }: {
  id: string; title: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section id={id} className="mb-16 scroll-mt-24">
      <div className="flex items-center gap-3 mb-5 pb-4"
           style={{ borderBottom: "1px solid #242729" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: "#D29A2D18", border: "1px solid #D29A2D30" }}>
          <span style={{ color: "#D29A2D" }}>{icon}</span>
        </div>
        <h2 className="text-xl font-display font-bold" style={{ color: "#EDEFF0" }}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

// ── Table component ──────────────────────────────────────────────────────────
function DocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-xl overflow-hidden my-4" style={{ border: "1px solid #242729" }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: "#1A1C1D", borderBottom: "1px solid #2C2F31" }}>
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-mono font-medium uppercase tracking-wider"
                  style={{ color: "#7A8285" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #1E2022" : "none",
                                 background: i % 2 === 0 ? "#141617" : "#161819" }}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3"
                    style={{ color: j === 0 ? "#D29A2D" : j === 1 ? "#C2C9CC" : "#9AA0A3",
                             fontFamily: j === 0 ? "JetBrains Mono, monospace" : "inherit",
                             fontSize: j === 0 ? "0.8rem" : "inherit" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Callout box ──────────────────────────────────────────────────────────────
function Callout({ type = "info", children }: { type?: "info" | "warn"; children: React.ReactNode }) {
  const styles = {
    info: { bg: "#D29A2D0D", border: "#D29A2D30", icon: "💡", color: "#D0A020" },
    warn: { bg: "#D975570D", border: "#D9757730", icon: "⚠️", color: "#D97757" },
  };
  const s = styles[type];
  return (
    <div className="rounded-xl px-4 py-3.5 my-4 text-sm leading-relaxed flex gap-3"
         style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <span>{s.icon}</span>
      <span style={{ color: "#C2C9CC" }}>{children}</span>
    </div>
  );
}

// ── Sidebar nav items ────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: "quickstart",     label: "Quickstart",       icon: <BookOpen size={13} /> },
  { id: "authentication", label: "Authentication",    icon: <Key size={13} /> },
  { id: "generate",       label: "POST /generate",   icon: <Zap size={13} /> },
  { id: "models",         label: "GET /models",      icon: <Layers size={13} /> },
  { id: "sdks",           label: "SDKs",             icon: <Code2 size={13} /> },
  { id: "errors",         label: "Error Reference",  icon: <AlertTriangle size={13} /> },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function Docs() {
  const [activeSection, setActiveSection] = useState("quickstart");

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    NAV_SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "#111314", color: "#EDEFF0" }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
           style={{ background: "#111314CC", backdropFilter: "blur(12px)",
                    borderBottom: "1px solid #1E2022" }}>
        <Link to="/" className="font-display font-bold text-xl" style={{ color: "#D29A2D" }}>
          SilkLLM
        </Link>
        <div className="flex items-center gap-5 text-sm" style={{ color: "#7A8285" }}>
          <Link to="/" className="hover:text-silk-gold transition-colors"
                style={{ color: "#7A8285" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#D29A2D"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#7A8285"}>
            Home
          </Link>
          <Link to="/login" className="btn-primary text-sm py-1.5 px-4 rounded-lg">
            Dashboard
          </Link>
        </div>
      </nav>

      <div className="flex pt-16 max-w-6xl mx-auto">

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <aside className="hidden lg:block w-60 shrink-0 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-4">
          <div className="mb-6">
            <p className="text-xs font-mono uppercase tracking-widest mb-3 px-3"
               style={{ color: "#595F61" }}>Documentation</p>
            <nav className="space-y-0.5">
              {NAV_SECTIONS.map(({ id, label, icon }) => {
                const isActive = activeSection === id;
                return (
                  <a key={id} href={`#${id}`}
                     className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150"
                     style={{
                       background: isActive ? "#D29A2D14" : "transparent",
                       color: isActive ? "#D29A2D" : "#7A8285",
                       borderLeft: isActive ? "2px solid #D29A2D" : "2px solid transparent",
                     }}>
                    <span style={{ opacity: isActive ? 1 : 0.5 }}>{icon}</span>
                    {label}
                    {isActive && <ChevronRight size={10} className="ml-auto" style={{ color: "#D29A2D" }} />}
                  </a>
                );
              })}
            </nav>
          </div>

          {/* Divider + quick links */}
          <div style={{ borderTop: "1px solid #1E2022", paddingTop: "1.25rem", marginTop: "0.5rem" }}>
            <p className="text-xs font-mono uppercase tracking-widest mb-3 px-3"
               style={{ color: "#595F61" }}>Resources</p>
            <nav className="space-y-0.5">
              {[{ label: "Dashboard", to: "/login" }, { label: "Home", to: "/" }].map(l => (
                <Link key={l.to} to={l.to}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{ color: "#595F61" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#D29A2D"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#595F61"}>
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <main className="flex-1 py-10 px-6 lg:px-12 min-w-0">
          {/* Page header */}
          <div className="mb-12">
            <h1 className="font-display font-bold text-4xl mb-2" style={{ color: "#EDEFF0" }}>
              Documentation
            </h1>
            <p className="text-lg" style={{ color: "#7A8285" }}>
              Everything you need to integrate SilkLLM into your project.
            </p>
            <div className="h-px mt-6" style={{ background: "linear-gradient(90deg, #D29A2D44, transparent)" }} />
          </div>

          {/* ── Quickstart ─────────────────────────────────────────── */}
          <Section id="quickstart" title="Quickstart" icon={<BookOpen size={15} />}>
            <p className="mb-4 leading-relaxed" style={{ color: "#9AA0A3" }}>
              Get your first response in under 2 minutes.
            </p>
            <ol className="space-y-3 mb-6">
              {[
                <><Link to="/login" className="underline decoration-dotted" style={{ color: "#D29A2D" }}>Create an account</Link> via Google or GitHub OAuth.</>,
                <>Go to <Pill>API Keys</Pill> and create your first key.</>,
                <>Add credits via <Pill>Billing</Pill> (min $5 to start).</>,
                <>Install the SDK and make your first call.</>,
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                        style={{ background: "#D29A2D18", border: "1px solid #D29A2D40", color: "#D29A2D" }}>
                    {i + 1}
                  </span>
                  <span style={{ color: "#C2C9CC" }}>{item}</span>
                </li>
              ))}
            </ol>
            <CodeBlock code={CODE.pyInstall} lang="bash" />
            <CodeBlock code={CODE.pyBasic} lang="python" />
          </Section>

          {/* ── Authentication ─────────────────────────────────────── */}
          <Section id="authentication" title="Authentication" icon={<Key size={15} />}>
            <p className="mb-4 leading-relaxed" style={{ color: "#9AA0A3" }}>
              All API requests require a Bearer token in the <Pill>Authorization</Pill> header.
            </p>
            <CodeBlock code={CODE.authHeader} lang="http" />
            <Callout type="warn">
              API keys start with <strong style={{ color: "#D29A2D" }}>silk_</strong>. Never expose them in
              client-side code or commit them to version control.
            </Callout>
          </Section>

          {/* ── Generate ───────────────────────────────────────────── */}
          <Section id="generate" title="POST /api/generate" icon={<Zap size={15} />}>
            <p className="mb-4 leading-relaxed" style={{ color: "#9AA0A3" }}>
              The core endpoint. Accepts a conversation history and returns a completion from the
              best available provider.
            </p>
            <CodeBlock code={CODE.curlExample} lang="bash" />
            <h3 className="text-sm font-semibold uppercase tracking-wider mt-6 mb-3"
                style={{ color: "#595F61" }}>Request Parameters</h3>
            <DocTable
              headers={["Field", "Type", "Description"]}
              rows={[
                ["messages",    "array",  "Required. Conversation history [{role, content}]"],
                ["model",       "string", "Optional. Model ID e.g. gpt-4o, claude-3-5-sonnet-20241022"],
                ["provider",    "string", "Optional. Provider hint e.g. openai, anthropic"],
                ["temperature", "float",  "0.0–2.0 (default 0.7)"],
                ["max_tokens",  "int",    "Max tokens to generate (default 2048)"],
                ["stream",      "bool",   "Enable SSE streaming (default false)"],
              ]}
            />
            <Callout>
              Omit <Pill>model</Pill> to let SilkLLM automatically route to the cheapest healthy
              provider in your fallback chain.
            </Callout>
          </Section>

          {/* ── Models ─────────────────────────────────────────────── */}
          <Section id="models" title="GET /api/models" icon={<Layers size={15} />}>
            <p className="mb-4 leading-relaxed" style={{ color: "#9AA0A3" }}>
              List all available models with per-token pricing. Filter by provider with a query param.
            </p>
            <CodeBlock code={CODE.modelsExample} lang="bash" />
          </Section>

          {/* ── SDKs ───────────────────────────────────────────────── */}
          <Section id="sdks" title="SDKs" icon={<Code2 size={15} />}>
            <h3 className="font-semibold mb-3" style={{ color: "#EDEFF0" }}>Python</h3>
            <CodeBlock code={CODE.pyInstall} lang="bash" />
            <CodeBlock code={CODE.pyBasic} lang="python" />
            <p className="text-sm mb-1 mt-4" style={{ color: "#7A8285" }}>Streaming:</p>
            <CodeBlock code={CODE.pyStream} lang="python" />

            <h3 className="font-semibold mt-10 mb-3" style={{ color: "#EDEFF0" }}>JavaScript</h3>
            <CodeBlock code={CODE.jsInstall} lang="bash" />
            <CodeBlock code={CODE.jsBasic} lang="javascript" />
          </Section>

          {/* ── Errors ─────────────────────────────────────────────── */}
          <Section id="errors" title="Error Reference" icon={<AlertTriangle size={15} />}>
            <p className="mb-4 leading-relaxed" style={{ color: "#9AA0A3" }}>
              All errors return JSON with a <Pill>code</Pill> and <Pill>message</Pill> field.
            </p>
            <DocTable
              headers={["Code", "HTTP", "Description"]}
              rows={[
                ["authentication_error",  "401", "Missing or invalid API key"],
                ["insufficient_balance",  "402", "Not enough credits — add more in billing"],
                ["model_not_found",       "404", "Model doesn't exist or is disabled"],
                ["validation_error",      "422", "Invalid request body"],
                ["rate_limit_exceeded",   "429", "Too many requests — slow down"],
                ["provider_error",        "502", "Upstream provider failed — fallback attempted"],
              ]}
            />
          </Section>

        </main>
      </div>
    </div>
  );
}

// EOF silkllm-frontend/src/pages/public/Docs.tsx