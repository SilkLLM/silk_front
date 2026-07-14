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
  ToggleLeft, ToggleRight, Server, Cpu, Clock, Gift, CheckCircle2
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

// API Playground Component
function ApiPlayground({ models }: { models: Model[] }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([
    { role: "user", content: "Hello! Can you introduce yourself?" }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedKeyId, setSelectedKeyId] = useState<string>(""); // "default" or key ID
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [stream, setStream] = useState(true);
  const [loading, setLoading] = useState(false);
  const [responseContent, setResponseContent] = useState("");
  const [lastUsage, setLastUsage] = useState<{ tokens: number; cost: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get stored keys from localStorage
  const storedKeys = getStoredKeys();
  const keyOptions = [
    { id: "default", name: "Default (my login token)", rawKey: null as string | null },
    ...storedKeys.map(k => ({ id: k.id, name: k.name, rawKey: k.rawKey }))
  ];

  // Build list of active providers
  const activeProviders = React.useMemo(() => {
    const providersMap = new Map<string, { name: string; models: Model[] }>();
    for (const m of models) {
      if (m.is_active !== false) {
        const providerId = m.provider_id || m.provider;
        if (!providersMap.has(providerId)) {
          providersMap.set(providerId, { name: providerId, models: [] });
        }
        providersMap.get(providerId)!.models.push(m);
      }
    }
    return Array.from(providersMap.entries()).map(([id, data]) => ({
      id,
      name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
      models: data.models,
    }));
  }, [models]);

  // Auto-select first provider, model, and key on load
  useEffect(() => {
    if (activeProviders.length > 0 && !selectedProviderId) {
      const firstProvider = activeProviders[0];
      setSelectedProviderId(firstProvider.id);
      if (firstProvider.models.length > 0) {
        setSelectedModelId(firstProvider.models[0].id);
      }
    }
    if (keyOptions.length > 0 && !selectedKeyId) {
      setSelectedKeyId("default");
    }
  }, [activeProviders, keyOptions, selectedProviderId, selectedKeyId]);

  // When provider changes, select first model
  useEffect(() => {
    if (selectedProviderId) {
      const provider = activeProviders.find(p => p.id === selectedProviderId);
      if (provider && provider.models.length > 0) {
        setSelectedModelId(provider.models[0].id);
      } else {
        setSelectedModelId("");
      }
    }
  }, [selectedProviderId, activeProviders]);

  const currentProviderModels = activeProviders.find(p => p.id === selectedProviderId)?.models || [];
  const selectedKey = keyOptions.find(k => k.id === selectedKeyId);
  const apiKeyToUse = selectedKey?.rawKey; // null if default

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages, responseContent]);

  const handleSend = async () => {
    if (!inputMessage.trim()) return;
    const updatedMessages = [...messages, { role: "user", content: inputMessage.trim() }];
    setMessages(updatedMessages);
    setInputMessage("");
    setResponseContent("");
    setLastUsage(null);
    setLoading(true);

    const payload = {
      messages: updatedMessages,
      model: selectedModelId || undefined,
      provider: selectedProviderId || undefined,
      temperature,
      max_tokens: maxTokens,
      stream,
    };

    if (stream) {
      let accumulated = "";
      await generateApi.streamGenerate(
        payload as any,
        (chunk) => {
          accumulated += chunk;
          setResponseContent(accumulated);
        },
        (err) => {
          toast.error(`Stream error: ${err}`);
          setLoading(false);
        },
        () => {
          setMessages(prev => [...prev, { role: "assistant", content: accumulated }]);
          setResponseContent("");
          setLoading(false);
          toast.success("Response received");
        },
        apiKeyToUse || undefined
      );
    } else {
      try {
        const res = await generateApi.generate(payload as any, apiKeyToUse || undefined);
        const data = res.data;
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
        setLastUsage({
          tokens: data.usage.total_tokens,
          cost: data.cost_usd,
        });
        toast.success(`Generated ${data.usage.total_tokens} tokens, cost $${data.cost_usd.toFixed(6)}`);
      } catch (err: any) {
        toast.error(err.response?.data?.detail || "Generation failed");
      } finally {
        setLoading(false);
      }
    }
  };

  const copyConversation = () => {
    const text = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const clearConversation = () => {
    setMessages([{ role: "user", content: "Hello! Can you introduce yourself?" }]);
    setResponseContent("");
    setLastUsage(null);
  };

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Terminal size={20} className="text-silk-gold" />
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey">API Playground</h2>
          <span className="text-xs text-warm-grey bg-cloud-grey dark:bg-slate-dark px-2 py-0.5 rounded-full">
            test /generate
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={copyConversation} className="text-warm-grey hover:text-silk-gold transition-colors p-1" title="Copy conversation">
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button onClick={clearConversation} className="text-warm-grey hover:text-red-400 transition-colors text-xs underline">Clear</button>
        </div>
      </div>

      {/* Parameters bar */}
      <div className="flex flex-wrap gap-4 items-end bg-cloud-grey dark:bg-deep-charcoal p-3 rounded-lg">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs text-warm-grey mb-1">Provider</label>
          <select
            value={selectedProviderId}
            onChange={(e) => setSelectedProviderId(e.target.value)}
            className="input py-2 text-sm"
            title="Select API provider"
          >
            {activeProviders.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-warm-grey mb-1">Model</label>
          <select
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(e.target.value)}
            className="input py-2 text-sm"
            disabled={currentProviderModels.length === 0}
            title="Select AI model"
          >
            {currentProviderModels.map(m => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
            {currentProviderModels.length === 0 && (
              <option disabled>No active models for this provider</option>
            )}
          </select>
        </div>
        <div className="w-24">
          <label className="block text-xs text-warm-grey mb-1">Temp</label>
          <input
            type="number" step={0.1} min={0} max={2} value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="input py-2 text-sm"
            title="Temperature (0-2)"
            placeholder="1.0"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-warm-grey mb-1">Max tokens</label>
          <input
            type="number" step={256} min={1} max={32000} value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value))}
            className="input py-2 text-sm"
            title="Maximum tokens for response"
            placeholder="4096"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-warm-grey">Stream</label>
          <button
            onClick={() => setStream(!stream)}
            className="text-warm-grey hover:text-silk-gold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {stream ? <ToggleRight size={26} className="text-silk-gold" /> : <ToggleLeft size={26} />}
          </button>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-warm-grey mb-1">API Key</label>
          <select
            value={selectedKeyId}
            onChange={(e) => setSelectedKeyId(e.target.value)}
            className="input py-2 text-sm"
            title="Select which API key to use for this request"
          >
            {keyOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
          <p className="text-xs text-warm-grey mt-1">Choose which API key to use for this request</p>
        </div>
      </div>

      {/* Chat area */}
      <div className="bg-cloud-grey dark:bg-deep-charcoal rounded-lg p-4 h-80 overflow-y-auto space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
            <div className={clsx(
              "max-w-[80%] rounded-lg px-4 py-2 text-sm",
              msg.role === "user"
                ? "bg-silk-gold text-white rounded-br-none"
                : "bg-white dark:bg-slate-dark text-deep-charcoal dark:text-cloud-grey rounded-bl-none"
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        {responseContent && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 text-sm bg-white dark:bg-slate-dark text-deep-charcoal dark:text-cloud-grey rounded-bl-none">
              {responseContent}
              {loading && <span className="animate-pulse ml-1">▊</span>}
            </div>
          </div>
        )}
        {loading && !responseContent && (
          <div className="flex justify-start">
            <div className="bg-white dark:bg-slate-dark rounded-lg px-4 py-2 text-sm text-warm-grey">
              <Loader2 size={14} className="animate-spin inline mr-1" /> Generating...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && handleSend()}
          placeholder="Type your message..."
          className="input flex-1"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !inputMessage.trim() || !selectedModelId}
          className="btn-primary min-w-[80px] flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          Send
        </button>
      </div>

      {lastUsage && (
        <div className="text-xs text-warm-grey text-right border-t pt-2 border-cloud-grey dark:border-muted-metal">
          Tokens: {lastUsage.tokens} · Cost: ${lastUsage.cost.toFixed(6)}
        </div>
      )}
    </div>
  );
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
function TrialAndOnboarding() {
  const { user } = useAuth();
  const { data: trial } = useQuery({
    queryKey: ["trial-status"],
    queryFn: () => trialApi.status().then((r) => r.data),
  });
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

  const trialPct = trial && trial.daily_limit_usd > 0
    ? Math.max(0, Math.min(100, (trial.daily_remaining_usd / trial.daily_limit_usd) * 100)) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {trial?.active && (
        <div className="card">
          <div className="flex items-center justify-between">
            <span className="text-warm-grey text-sm flex items-center gap-1.5"><Gift size={15} className="text-silk-gold" /> Free trial</span>
            <span className="text-xs text-warm-grey">{trial.days_remaining}d left</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-cloud-grey dark:bg-deep-charcoal overflow-hidden">
            <div className="h-full bg-silk-gold" style={{ width: `${trialPct}%` }} />
          </div>
          <p className="text-xs text-warm-grey mt-2">${trial.daily_remaining_usd.toFixed(4)} of ${trial.daily_limit_usd.toFixed(2)} left today</p>
        </div>
      )}
      {remaining > 0 && (
        <div className={`card ${trial?.active ? "lg:col-span-2" : "lg:col-span-3"}`}>
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
      )}
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

        {/* Trial status + onboarding checklist */}
        <TrialAndOnboarding />

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

        {/* Playground */}
        {!modelsLoading && modelsData && <ApiPlayground models={modelsData} />}

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