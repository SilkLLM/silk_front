/**
 * Dashboard.tsx
 * The overview page. Leads with the one number that matters (balance), then
 * supporting stats, then spend over time, then the catalogue.
 *
 * The spend chart is a single series, so it carries no legend - the panel title
 * already names what is plotted. Identity for the model catalogue comes from
 * labels and provider names, never from colour alone.
 */

// File: silkllm-frontend/src/pages/user/Dashboard.tsx

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, BarChart2, Check, CheckCircle2, ChevronDown, Clock,
  CreditCard, Gift, Key, MessageSquare, Server, Sparkles, TrendingUp, Wallet, Zap,
} from "lucide-react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { usageApi, modelsApi, trialApi, providerKeysApi } from "@/services/api";
import {
  Badge, Button, Card, EmptyState, Meter, Panel, SegmentedControl, Skeleton, StatTile,
} from "@/components/ui";
import { ChartTooltip, compact, usd, usdPrecise, useChartTheme } from "@/lib/charts";

interface Model {
  id: string;
  display_name: string;
  provider: string;
  provider_id?: string;
  input_cost_per_1k_usd: number;
  output_cost_per_1k_usd: number;
  context_window: number;
  capabilities: string[];
  modality?: string;
  is_free?: boolean;
  is_active?: boolean;
}

function storedKeyCount(): number {
  try { return (JSON.parse(localStorage.getItem("silk_stored_keys") || "[]") as unknown[]).length; }
  catch { return 0; }
}

// ── Hero: balance ───────────────────────────────────────────────────────────

/**
 * The single hero figure for this view. Everything else on the page is a
 * supporting stat tile.
 */
function BalanceHero({ spent7d }: { spent7d: number }) {
  const { user } = useAuth();
  const balance = user?.balance ?? 0;
  const low = balance < 1;
  // Rough runway, only meaningful once there is a week of spend to divide by.
  const daysLeft = spent7d > 0 ? balance / (spent7d / 7) : null;

  return (
    <section className="card card-pad relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.55]"
        style={{ background: "radial-gradient(120% 100% at 100% 0%, rgb(var(--c-accent) / 0.10), transparent 60%)" }}
      />
      <div className="relative flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink-2 flex items-center gap-2">
            <Wallet size={14} className="text-ink-3" /> Credit balance
          </p>
          <p className="text-[2.75rem] sm:text-5xl leading-none font-semibold tracking-tight text-ink mt-3">
            ${balance.toFixed(4)}
          </p>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {low
              ? <Badge tone="warning">Low balance</Badge>
              : <Badge tone="success"><Check size={10} /> Active</Badge>}
            <span className="text-xs text-ink-3">
              {daysLeft !== null && Number.isFinite(daysLeft)
                ? `~ ${daysLeft < 1 ? "under a day" : `${Math.floor(daysLeft)} days`} at your current rate`
                : "USD · never expires"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/dashboard/billing" className="btn-primary">
            <CreditCard size={16} /> Add credits
          </Link>
          <Link to="/dashboard/usage" className="btn-secondary">
            <BarChart2 size={16} /> Usage
          </Link>
        </div>
      </div>
    </section>
  );
}

// ── Trial ───────────────────────────────────────────────────────────────────

function TrialBanner() {
  const { data: trial } = useQuery({
    queryKey: ["trial-status"],
    queryFn: () => trialApi.status().then((r) => r.data),
  });
  if (!trial?.active) return null;

  const remaining = trial.daily_remaining_usd ?? 0;
  const limit = trial.daily_limit_usd ?? 0;
  const pct = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;
  const tone = pct <= 15 ? "danger" : pct <= 40 ? "warn" : "accent";

  return (
    <section className="rounded-card border border-accent/25 bg-accent/[0.07] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 text-accent-ink">
            <Gift size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink flex items-center gap-2 flex-wrap">
              You are on the free trial
              <Badge tone="brand">{trial.days_remaining} days left</Badge>
            </p>
            <p className="text-xs text-ink-2 mt-1 num">
              ${remaining.toFixed(4)} of ${limit.toFixed(2)} free usage left today
            </p>
          </div>
        </div>
        <Link to="/dashboard/billing" className="btn-primary h-9 px-3.5 text-xs shrink-0">Add credits</Link>
      </div>
      <div className="mt-4"><Meter value={pct} tone={tone as any} /></div>
    </section>
  );
}

// ── Onboarding ──────────────────────────────────────────────────────────────

function Onboarding() {
  const { user } = useAuth();
  const { data: keys } = useQuery({
    queryKey: ["provider-keys-count"],
    queryFn: () => providerKeysApi.list().then((r) => r.data),
  });

  const hasBalance = (user?.balance || 0) > 0;
  const hasKey = (keys || []).length > 0;
  let hasChat = false;
  try { hasChat = JSON.parse(localStorage.getItem("silk_chats") || "{}")?.conversations?.length > 0; } catch { /* ignore */ }

  const steps = [
    { done: true,       label: "Create your account",                    to: "/dashboard" },
    { done: hasChat,    label: "Try the chat",                           to: "/dashboard/chat" },
    { done: hasKey,     label: "Deposit a key and start earning",        to: "/dashboard/provider-hub" },
    { done: hasBalance, label: "Add credits (or use your free trial)",   to: "/dashboard/billing" },
  ];
  const complete = steps.filter((s) => s.done).length;
  if (complete === steps.length) return null;

  return (
    <Card
      title="Get set up"
      description="A few minutes now and every model is one call away."
      icon={<Sparkles size={15} />}
      actions={<span className="text-xs text-ink-3 num">{complete}/{steps.length}</span>}
    >
      <div className="mb-4"><Meter value={(complete / steps.length) * 100} /></div>
      <div className="grid sm:grid-cols-2 gap-1.5">
        {steps.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className={clsx(
              "flex items-center gap-2.5 text-sm px-3 py-2.5 rounded-lg border transition-colors",
              s.done
                ? "border-transparent text-ink-3"
                : "border-line text-ink hover:border-line-strong hover:bg-sunken",
            )}
          >
            <CheckCircle2 size={16} className={clsx("shrink-0", s.done ? "text-success" : "text-ink-3")} />
            <span className={clsx("truncate", s.done && "line-through")}>{s.label}</span>
            {!s.done && <ArrowRight size={14} className="ml-auto text-ink-3 shrink-0" />}
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ── Spend chart ─────────────────────────────────────────────────────────────

type Range = "7d" | "30d" | "all";

function SpendChart({ entries, range, onRange }: {
  entries: any[]; range: Range; onRange: (r: Range) => void;
}) {
  const t = useChartTheme();

  const data = useMemo(() => {
    const cutoff = range === "all" ? 0 : Date.now() - (range === "7d" ? 7 : 30) * 86_400_000;
    // Roll individual requests up to a daily total - a point per request is noise.
    const byDay = new Map<string, number>();
    for (const e of entries) {
      const ts = new Date(e.created_at).getTime();
      if (ts < cutoff || e.amount >= 0) continue;
      const day = format(new Date(ts), "yyyy-MM-dd");
      byDay.set(day, (byDay.get(day) || 0) + Math.abs(e.amount));
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, cost]) => ({ day, label: format(new Date(day), "MMM d"), cost }));
  }, [entries, range]);

  const total = data.reduce((s, d) => s + d.cost, 0);
  const peak = data.reduce((m, d) => (d.cost > m.cost ? d : m), { cost: -1, label: "" } as any);

  return (
    <Panel
      title="Spend over time"
      description={data.length ? `${usdPrecise(total)} across ${data.length} active ${data.length === 1 ? "day" : "days"}` : undefined}
      icon={<TrendingUp size={15} />}
      actions={
        <SegmentedControl
          size="sm"
          value={range}
          onChange={onRange}
          options={[{ value: "7d", label: "7d" }, { value: "30d", label: "30d" }, { value: "all", label: "All" }]}
        />
      }
    >
      {data.length < 2 ? (
        <EmptyState
          icon={<BarChart2 size={19} />}
          title="Not enough activity yet"
          hint="Once you have made API calls on more than one day, your spend trend appears here."
          action={<Link to="/dashboard/chat" className="btn-secondary h-8 px-3 text-xs">Try the chat</Link>}
        />
      ) : (
        <div className="px-2 pb-4 pt-2">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.seriesAt(0)} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={t.seriesAt(0)} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...t.gridProps} />
              <XAxis dataKey="label" {...t.axisProps} minTickGap={24} />
              <YAxis
                {...t.axisProps}
                width={62}
                tickFormatter={(v: number) => (v >= 0.01 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`)}
              />
              <Tooltip
                cursor={{ stroke: t.axis, strokeWidth: 1 }}
                content={<ChartTooltip formatter={(v: any) => usdPrecise(Number(v))} />}
              />
              <Area
                type="monotone"
                dataKey="cost"
                name="Spend"
                stroke={t.seriesAt(0)}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="url(#spendFill)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: t.surface }}
              />
            </AreaChart>
          </ResponsiveContainer>
          {peak.cost > 0 && (
            <p className="px-4 pt-1 text-xs text-ink-3">
              Busiest day <span className="text-ink-2 font-medium">{peak.label}</span> at{" "}
              <span className="text-ink-2 font-medium num">{usdPrecise(peak.cost)}</span>.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Catalogue ───────────────────────────────────────────────────────────────

function ModelCatalogue({ models, loading }: { models?: Model[]; loading: boolean }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const providers = useMemo(() => {
    const map = new Map<string, Model[]>();
    for (const m of models || []) {
      const id = m.provider_id || m.provider;
      if (!map.has(id)) map.set(id, []);
      map.get(id)!.push(m);
    }
    return Array.from(map.entries())
      .map(([id, list]) => ({ id, list: list.slice().sort((a, b) => a.display_name.localeCompare(b.display_name)) }))
      .sort((a, b) => b.list.length - a.list.length);
  }, [models]);

  const toggle = (id: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const allOpen = providers.length > 0 && open.size === providers.length;
  const toggleAll = () =>
    setOpen(allOpen ? new Set() : new Set(providers.map((p) => p.id)));

  if (loading) {
    return (
      <Panel title="Providers & models" icon={<Server size={15} />}>
        <div className="p-5 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      </Panel>
    );
  }

  if (!providers.length) {
    return (
      <Panel title="Providers & models" icon={<Server size={15} />}>
        <EmptyState icon={<Server size={19} />} title="No models available yet" hint="An administrator has not enabled any models." />
      </Panel>
    );
  }

  return (
    <Panel
      title="Providers & models"
      description="Everything reachable with your key right now."
      icon={<Server size={15} />}
      actions={
        <div className="flex items-center gap-3">
          <Badge tone="neutral">{providers.length} providers, {(models || []).length} models</Badge>
          <button onClick={toggleAll} className="inline-flex items-center h-8 px-2 -mx-1 rounded text-xs text-accent-ink hover:underline whitespace-nowrap">
            {allOpen ? "Collapse all" : "Expand all"}
          </button>
        </div>
      }
    >
      <div className="divide-y divide-line">
        {providers.map((p) => {
          const expanded = open.has(p.id);
          const active = p.list.filter((m) => m.is_active !== false);
          const free = p.list.filter((m) => m.is_free);

          return (
            <div key={p.id}>
              <button
                onClick={() => toggle(p.id)}
                aria-expanded={expanded}
                aria-controls={`models-${p.id}`}
                className="w-full flex items-center gap-3 px-5 sm:px-6 py-3.5 text-left hover:bg-sunken transition-colors"
              >
                <span className="w-8 h-8 rounded-lg bg-ink/[0.05] border border-line flex items-center justify-center text-2xs font-bold text-ink-2 uppercase shrink-0">
                  {p.id.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink capitalize truncate">{p.id}</span>
                  <span className="block text-xs text-ink-3 num">
                    {p.list.length} {p.list.length === 1 ? "model" : "models"}
                    {active.length !== p.list.length && `, ${active.length} active`}
                    {free.length > 0 && `, ${free.length} free`}
                  </span>
                </span>
                <span className="text-xs text-ink-3 hidden sm:inline">{expanded ? "Hide" : "Show"}</span>
                <ChevronDown
                  size={16}
                  className={clsx("text-ink-3 shrink-0 transition-transform duration-200", expanded && "rotate-180")}
                />
              </button>

              {/* The whole table is what collapses. Previously the rows stayed on
                  screen and only the chevron moved, so the control did nothing. */}
              {expanded && (
                <div id={`models-${p.id}`} className="px-5 sm:px-6 pb-4">
                  <div className="rounded-lg border border-line overflow-hidden">
                    <div className="scroll-x">
                      <table className="table-shell">
                        <thead>
                          <tr>
                            <th>Model</th>
                            <th className="text-right">Input / 1K</th>
                            <th className="text-right">Output / 1K</th>
                            <th className="text-right">Context</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.list.map((m) => (
                            <tr key={m.id}>
                              <td>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm text-ink">{m.display_name}</span>
                                  {m.is_free && <Badge tone="success">Free</Badge>}
                                  {m.modality && m.modality !== "text" && <Badge tone="neutral">{m.modality}</Badge>}
                                  {m.is_active === false && <Badge tone="warning" icon={<Clock size={10} />}>Pending</Badge>}
                                </div>
                                <p className="text-2xs text-ink-3 font-mono mt-0.5 truncate max-w-[240px]">{m.id}</p>
                              </td>
                              <td className="text-right num text-ink-2 text-xs">${m.input_cost_per_1k_usd.toFixed(6)}</td>
                              <td className="text-right num text-ink-2 text-xs">${m.output_cost_per_1k_usd.toFixed(6)}</td>
                              <td className="text-right num text-ink-2 text-xs">
                                {m.context_window ? m.context_window.toLocaleString() : "n/a"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function UserDashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("30d");

  const { data: usageData } = useQuery({
    queryKey: ["usage-overview"],
    queryFn: () => usageApi.list(1, 200, "usage").then((r) => r.data),
  });
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ["available-models"],
    queryFn: () => modelsApi.list().then((r) => r.data.models as Model[]),
  });

  const entries: any[] = usageData?.entries || [];

  const stats = useMemo(() => {
    const now = Date.now();
    const spendIn = (days: number) => entries
      .filter((e) => e.amount < 0 && new Date(e.created_at).getTime() >= now - days * 86_400_000)
      .reduce((s, e) => s + Math.abs(e.amount), 0);

    const spent7 = spendIn(7);
    const prev7 = entries
      .filter((e) => {
        const ts = new Date(e.created_at).getTime();
        return e.amount < 0 && ts < now - 7 * 86_400_000 && ts >= now - 14 * 86_400_000;
      })
      .reduce((s, e) => s + Math.abs(e.amount), 0);

    const tokens = entries.reduce((s, e) => s + (e.prompt_tokens || 0) + (e.completion_tokens || 0), 0);

    // Daily spend for the tile sparkline, oldest first.
    const byDay = new Map<string, number>();
    for (const e of entries) {
      if (e.amount >= 0) continue;
      const day = format(new Date(e.created_at), "yyyy-MM-dd");
      byDay.set(day, (byDay.get(day) || 0) + Math.abs(e.amount));
    }
    const spark = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);

    return {
      spent7,
      delta7: prev7 > 0 ? ((spent7 - prev7) / prev7) * 100 : undefined,
      tokens,
      requests: usageData?.total ?? entries.length,
      spark,
    };
  }, [entries, usageData]);

  return (
    <DashboardLayout>
      <div>
        <h1 className="text-[1.375rem] sm:text-2xl font-semibold tracking-tight text-ink">
          Welcome back, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-sm text-ink-2 mt-1">Here is where your account stands today.</p>
      </div>

      <TrialBanner />
      <BalanceHero spent7d={stats.spent7} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Spent, last 7 days"
          value={usdPrecise(stats.spent7)}
          icon={<TrendingUp size={14} />}
          delta={stats.delta7}
          deltaGood="down"
          deltaLabel={stats.delta7 !== undefined ? "vs previous 7 days" : undefined}
          hint={stats.delta7 === undefined ? "No prior period to compare" : undefined}
          spark={stats.spark}
        />
        <StatTile label="Total requests" value={compact(stats.requests)} icon={<Zap size={14} />} hint="All time" />
        <StatTile label="Tokens processed" value={compact(stats.tokens)} icon={<BarChart2 size={14} />} hint="Across recent activity" />
        <StatTile label="API keys" value={storedKeyCount()} icon={<Key size={14} />} hint="Saved in this browser" />
      </div>

      <Onboarding />

      <SpendChart entries={entries} range={range} onRange={setRange} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Link to="/dashboard/chat" className="card card-pad group hover:border-line-strong transition-colors">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 text-accent-ink">
              <MessageSquare size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                Open the chat <ArrowUpRight size={14} className="text-ink-3 group-hover:text-accent-ink transition-colors" />
              </p>
              <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                Talk to any text, image, audio or video model. Conversations stay on your device.
              </p>
            </div>
          </div>
        </Link>

        <Link to="/dashboard/provider-hub" className="card card-pad group hover:border-line-strong transition-colors">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 text-accent-ink">
              <Gift size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                Earn with your own key <ArrowUpRight size={14} className="text-ink-3 group-hover:text-accent-ink transition-colors" />
              </p>
              <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                Share a provider key and earn credits whenever the marketplace routes through it.
              </p>
            </div>
          </div>
        </Link>
      </div>

      <ModelCatalogue models={modelsData} loading={modelsLoading} />

      {(user?.balance ?? 0) < 1 && (
        <Card
          title="Add credits to keep going"
          description="Your balance is running low. $5 covers thousands of requests on most models."
          icon={<Wallet size={15} />}
          actions={<Link to="/dashboard/billing" className="btn-primary h-9 px-3.5 text-xs">Add credits</Link>}
        >
          <p className="text-xs text-ink-3">
            Balance is shared across every provider and never expires. You are only charged the provider's real cost plus the platform markup.
          </p>
        </Card>
      )}
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Dashboard.tsx
