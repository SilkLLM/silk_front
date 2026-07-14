/**
 * Dashboard.tsx
 * User dashboard overview page.
 * Now includes:
 * - Credit balance, quick stats, recent usage chart.
 * - API Playground: with dropdown to select saved API keys.
 * - Available Providers & Models: grouped by provider.
 */

// File: silkllm-frontend/src/pages/user/Dashboard.tsx

import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CreditCard, Key, BarChart2, ArrowRight, TrendingUp, Zap,
  Send, Loader2, Code, Terminal, ChevronDown, ChevronUp, Copy, Check,
  ToggleLeft, ToggleRight, Server, Cpu, Clock, Gift, CheckCircle2, MessageSquare
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { usageApi, modelsApi, generateApi, trialApi, providerKeysApi } from "@/services/api";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";

// Types
interface Model {
  id: string;
  display_name: string;
  provider: string;
  provider_id?: string;
  input_cost_per_1k_usd: number;
  output_cost_per_1k_usd: number;
  context_window: number;
  capabilities: string[];
  is_active?: boolean;
}

interface Provider {
  id: string;
  name: string;
  enabled: boolean;
  models: Model[];
}

interface StoredKey {
  id: string;
  name: string;
  rawKey: string;
}

// Helper: get stored keys from localStorage
function getStoredKeys(): StoredKey[] {
  try {
    return JSON.parse(localStorage.getItem("silk_stored_keys") || "[]");
  } catch {
    return [];
  }
}

// Group models by provider
function groupModelsByProvider(models: Model[]): Provider[] {
  const providerMap = new Map<string, Provider>();
  for (const m of models) {
    const providerId = m.provider_id || m.provider;
    if (!providerMap.has(providerId)) {
      providerMap.set(providerId, {
        id: providerId,
        name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
        enabled: true,
        models: [],
      });
    }
    providerMap.get(providerId)!.models.push(m);
  }
  return Array.from(providerMap.values());
}


// Available Providers & Models List (same as before, unchanged)
function AvailableProvidersModels({ models }: { models: Model[] }) {
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const providers = groupModelsByProvider(models);

  const toggleProvider = (providerId: string) => {
    setExpandedProviders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(providerId)) newSet.delete(providerId);
      else newSet.add(providerId);
      return newSet;
    });
  };

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4">
        <Server size={18} className="text-silk-gold" />
        <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey">Available Providers & Models</h2>
        <span className="text-xs bg-silk-gold/10 text-silk-gold px-2 py-0.5 rounded-full">
          {providers.length} provider{providers.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-3">
        {providers.map(provider => {
          const activeModels = provider.models.filter(m => m.is_active !== false);
          const pendingModels = provider.models.filter(m => m.is_active === false);
          const isExpanded = expandedProviders.has(provider.id);
          const displayedModels = isExpanded ? provider.models : activeModels.slice(0, 3);
          return (
            <div key={provider.id} className="border border-cloud-grey dark:border-muted-metal rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleProvider(provider.id)}
                className="w-full flex items-center justify-between p-3 bg-cloud-grey/30 dark:bg-deep-charcoal/30 hover:bg-cloud-grey/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <Cpu size={16} className="text-silk-gold" />
                  <span className="font-medium capitalize">{provider.name}</span>
                  <span className="text-xs bg-white/50 dark:bg-slate-dark/50 px-1.5 py-0.5 rounded">{activeModels.length} active</span>
                  {pendingModels.length > 0 && <span className="text-xs">{pendingModels.length} pending</span>}
                </div>
                <ChevronDown size={16} className={clsx("transition-transform", isExpanded && "rotate-180")} />
              </button>
              <div className={clsx("px-4 overflow-hidden transition-all", isExpanded ? "max-h-[2000px] pb-3" : "max-h-0 pb-0")}>
                <div className="space-y-2 pt-2">
                  {displayedModels.map(model => (
                    <div key={model.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{model.display_name}</span>
                          {model.is_active !== false ? (
                            <span className="badge-success flex items-center gap-0.5"><Check size={10} /> Active</span>
                          ) : (
                            <span className="badge-warning flex items-center gap-0.5"><Clock size={10} /> Pending</span>
                          )}
                        </div>
                        <div className="text-xs text-warm-grey mt-0.5">
                          ${model.input_cost_per_1k_usd.toFixed(6)}/1k in · ${model.output_cost_per_1k_usd.toFixed(6)}/1k out
                          {model.context_window && ` · ctx ${model.context_window.toLocaleString()}`}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isExpanded && provider.models.length > 3 && (
                    <button onClick={() => toggleProvider(provider.id)} className="text-xs text-silk-gold hover:underline mt-1">Show {provider.models.length - 3} more</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Main Dashboard
function TrialBanner() {
  const { data: trial } = useQuery({
    queryKey: ["trial-status"],
    queryFn: () => trialApi.status().then((r) => r.data),
  });
  if (!trial?.active) return null;

  const pct = trial.daily_limit_usd > 0
    ? Math.max(0, Math.min(100, (trial.daily_remaining_usd / trial.daily_limit_usd) * 100)) : 0;

  return (
    <div className="rounded-2xl p-5 relative overflow-hidden"
      style={{ background: "linear-gradient(120deg, rgba(210,154,45,0.18), rgba(208,197,30,0.10) 60%, transparent)", border: "1px solid rgba(210,154,45,0.35)" }}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-silk-gold/20 flex items-center justify-center shrink-0">
            <Gift size={20} className="text-silk-gold" />
          </div>
          <div>
            <p className="font-semibold text-deep-charcoal dark:text-cloud-grey flex items-center gap-2">
              You are on the free trial
              <span className="badge-warning">{trial.days_remaining} days left</span>
            </p>
            <p className="text-sm text-warm-grey mt-0.5">
              ${trial.daily_remaining_usd.toFixed(4)} of ${trial.daily_limit_usd.toFixed(2)} free usage left today
            </p>
          </div>
        </div>
        <Link to="/dashboard/billing" className="btn-primary text-sm py-2 px-4 shrink-0">Add credits</Link>
      </div>
      <div className="mt-4 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #D29A2D, #D0C51E)" }} />
      </div>
    </div>
  );
}

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
    { done: true, label: "Create your account", to: "/dashboard" },
    { done: hasChat, label: "Try the chat", to: "/dashboard/chat" },
    { done: hasKey, label: "Deposit a key and start earning", to: "/dashboard/provider-hub" },
    { done: hasBalance, label: "Add credits (or use your free trial)", to: "/dashboard/billing" },
  ];
  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <div className="card">
      <p className="text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-3">Get started ({steps.length - remaining}/{steps.length})</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {steps.map((s) => (
          <Link key={s.label} to={s.to}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${s.done ? "text-warm-grey" : "text-deep-charcoal dark:text-cloud-grey hover:bg-cloud-grey dark:hover:bg-deep-charcoal"}`}>
            <CheckCircle2 size={16} className={s.done ? "text-warm-olive" : "text-muted-metal"} />
            <span className={s.done ? "line-through" : ""}>{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function UserDashboard() {
  const { user } = useAuth();
  const { data: usageData } = useQuery({
    queryKey: ["usage"],
    queryFn: () => usageApi.list(1, 10, "usage").then((r) => r.data),
  });
  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    queryKey: ["available-models"],
    queryFn: () => modelsApi.list().then((r) => r.data.models),
  });

  const chartData = (usageData?.entries || []).slice(0,10).reverse().map((e: any) => ({
    time: format(new Date(e.created_at), "HH:mm"),
    cost: Math.abs(e.amount),
  }));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
          <p className="text-warm-grey mt-1">Here's your account overview.</p>
        </div>

        {/* Prominent free-trial banner (only while a trial is active) */}
        <TrialBanner />

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex justify-between mb-3"><span className="text-warm-grey text-sm">Credit Balance</span><CreditCard size={18} className="text-silk-gold" /></div>
            <div className="text-3xl font-bold text-silk-gold">${user?.balance?.toFixed(4)}</div>
            <Link to="/dashboard/billing" className="text-xs text-warm-grey hover:text-silk-gold mt-2 inline-flex gap-1">Add credits <ArrowRight size={12} /></Link>
          </div>
          <div className="card">
            <div className="flex justify-between mb-3"><span className="text-warm-grey text-sm">Total Requests</span><Zap size={18} className="text-silk-gold" /></div>
            <div className="text-3xl font-bold">{usageData?.total || 0}</div>
            <Link to="/dashboard/usage" className="text-xs text-warm-grey hover:text-silk-gold mt-2 inline-flex gap-1">View usage <ArrowRight size={12} /></Link>
          </div>
          <div className="card">
            <div className="flex justify-between mb-3"><span className="text-warm-grey text-sm">API Keys</span><Key size={18} className="text-silk-gold" /></div>
            <div className="text-3xl font-bold">{getStoredKeys().length}</div>
            <Link to="/dashboard/keys" className="text-xs text-warm-grey hover:text-silk-gold mt-2 inline-flex gap-1">Manage keys <ArrowRight size={12} /></Link>
          </div>
        </div>

        {/* Onboarding checklist */}
        <Onboarding />

        {/* Usage chart */}
        {chartData.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4"><TrendingUp size={18} className="text-silk-gold" /><h2 className="font-semibold">Recent Spend</h2></div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData}>
                <defs><linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#D29A2D" stopOpacity={0.3}/><stop offset="95%" stopColor="#D29A2D" stopOpacity={0}/></linearGradient></defs>
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#C2C9CC" }} axisLine={false}/>
                <YAxis tick={{ fontSize: 11, fill: "#C2C9CC" }} axisLine={false} tickFormatter={(v)=>`$${v.toFixed(4)}`}/>
                <Tooltip formatter={(v:any)=>[`$${Number(v).toFixed(6)}`, "Cost"]} contentStyle={{background:"#383B3D", border:"1px solid #595F61", borderRadius:8}}/>
                <Area type="monotone" dataKey="cost" stroke="#D29A2D" fill="url(#costGrad)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Chat lives on its own page now */}
        <Link to="/dashboard/chat" className="card block hover:border-silk-gold/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-silk-gold/10 flex items-center justify-center shrink-0">
              <MessageSquare size={18} className="text-silk-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-deep-charcoal dark:text-cloud-grey">Open the chat</p>
              <p className="text-sm text-warm-grey">Talk to any model in a full chat, kept only on your device.</p>
            </div>
            <ArrowRight size={18} className="text-warm-grey" />
          </div>
        </Link>

        {/* Providers & Models */}
        {!modelsLoading && modelsData && <AvailableProvidersModels models={modelsData} />}

        {/* Low balance prompt */}
        {(!user?.balance || user.balance < 1) && (
          <div className="card border-silk-gold/30 bg-silk-gold/5">
            <h3 className="font-semibold text-silk-gold mb-1">Add credits to get started</h3>
            <p className="text-warm-grey text-sm mb-3">Your balance is low. Add at least $5 to start making API calls.</p>
            <Link to="/dashboard/billing" className="btn-primary text-sm py-2 px-4 inline-block">Add Credits</Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Dashboard.tsx