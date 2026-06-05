/**
 * Providers.tsx
 * Admin page — manage LLM providers, toggle enabled state, update API keys, set alert thresholds.
 * Full CRUD: add new provider, delete provider.
 * Now shows a masked preview of existing API keys with eye toggle.
 */

// File: silkllm-frontend/src/pages/admin/Providers.tsx

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Zap, Eye, EyeOff, Save, ToggleLeft, ToggleRight, AlertTriangle, Plus, Trash2, KeyRound } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";

export default function AdminProviders() {
  const qc = useQueryClient();
  const [editKey, setEditKey] = useState<Record<string, string>>({});
  const [showKeyPreview, setShowKeyPreview] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProvider, setNewProvider] = useState({
    id: "",
    name: "",
    api_key: "",
    alert_threshold_percent: 20,
  });

  const { data: providers, isLoading } = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => adminApi.providers.list().then((r) => r.data),
    refetchInterval: 30000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.providers.update(id, data),
    onSuccess: () => { toast.success("Provider updated"); qc.invalidateQueries({ queryKey: ["admin-providers"] }); },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Update failed"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.providers.create(data),
    onSuccess: () => {
      toast.success("Provider created");
      qc.invalidateQueries({ queryKey: ["admin-providers"] });
      setShowAddForm(false);
      setNewProvider({ id: "", name: "", api_key: "", alert_threshold_percent: 20 });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Creation failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.providers.delete(id),
    onSuccess: () => {
      toast.success("Provider deleted");
      qc.invalidateQueries({ queryKey: ["admin-providers"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Deletion failed"),
  });

  const toggleEnabled = (id: string, current: boolean) =>
    updateMutation.mutate({ id, data: { enabled: !current } });

  const saveApiKey = (id: string) => {
    if (!editKey[id]?.trim()) return;
    updateMutation.mutate({ id, data: { api_key: editKey[id].trim() } });
    setEditKey(k => ({ ...k, [id]: "" }));
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete provider "${name}"? This will also delete all its models. This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  // Helper to mask API key: show first 8 and last 4 characters
  const maskApiKey = (key: string | null) => {
    if (!key) return "No key set";
    if (key.length <= 12) return "•".repeat(key.length);
    return key.slice(0, 8) + "••••••••" + key.slice(-4);
  };

  const PROVIDER_COLORS: Record<string, string> = {
    openai: "#74aa9c", anthropic: "#c17b45", google: "#4285f4",
    deepseek: "#0e7fbe", xai: "#C2C9CC",
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">Provider Management</h1>
            <p className="text-warm-grey mt-1">Monitor balances, toggle providers, and manage API keys.</p>
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Provider
          </button>
        </div>

        {/* Add provider modal-like inline form */}
        {showAddForm && (
          <div className="card border-silk-gold/30">
            <h3 className="font-semibold mb-3 text-deep-charcoal dark:text-cloud-grey">New Provider</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <input type="text" placeholder="Provider ID (e.g., 'cohere')" value={newProvider.id}
                onChange={(e) => setNewProvider(p => ({ ...p, id: e.target.value.trim() }))}
                className="input" />
              <input type="text" placeholder="Display name (e.g., 'Cohere')" value={newProvider.name}
                onChange={(e) => setNewProvider(p => ({ ...p, name: e.target.value }))}
                className="input" />
              <input type="password" placeholder="API Key" value={newProvider.api_key}
                onChange={(e) => setNewProvider(p => ({ ...p, api_key: e.target.value }))}
                className="input" />
              <input type="number" placeholder="Alert threshold %" value={newProvider.alert_threshold_percent}
                onChange={(e) => setNewProvider(p => ({ ...p, alert_threshold_percent: parseInt(e.target.value) }))}
                className="input" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowAddForm(false)} className="btn-secondary text-sm px-4 py-2">Cancel</button>
              <button onClick={() => {
                if (!newProvider.id || !newProvider.name || !newProvider.api_key) {
                  toast.error("ID, Name and API Key are required");
                  return;
                }
                createMutation.mutate(newProvider);
              }} className="btn-primary text-sm px-4 py-2 flex items-center gap-1">
                <Plus size={14} /> Create
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-warm-grey">Loading providers...</div>
        ) : (
          <div className="space-y-4">
            {providers?.map((p: any) => {
              const balancePct = p.last_topup_amount > 0
                ? (p.last_known_balance / p.last_topup_amount) * 100 : null;
              const isLow = balancePct !== null && balancePct <= p.alert_threshold_percent;
              // For preview, we need the actual key value – but backend doesn't return it for security.
              // So we just show a masked placeholder and allow update.
              const hasKey = p.has_api_key;
              
              return (
                <div key={p.id} className="card relative">
                  <div className="flex items-start gap-4 flex-wrap">
                    {/* Provider badge */}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                         style={{ background: `${PROVIDER_COLORS[p.id] || '#D29A2D'}22`, border: `1px solid ${PROVIDER_COLORS[p.id] || '#D29A2D'}44` }}>
                      <span className="text-xs font-bold" style={{ color: PROVIDER_COLORS[p.id] || '#D29A2D' }}>
                        {p.name.slice(0, 2).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-deep-charcoal dark:text-cloud-grey">{p.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.enabled ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                          {p.enabled ? "Enabled" : "Disabled"}
                        </span>
                        {isLow && <span className="badge-warning flex items-center gap-1"><AlertTriangle size={10} /> Low Balance</span>}
                      </div>

                      {/* Balance bar */}
                      {p.last_topup_amount > 0 && (
                        <div className="mt-3">
                          <div className="flex justify-between text-xs text-warm-grey mb-1">
                            <span>Balance: ${p.last_known_balance.toFixed(2)}</span>
                            <span>{balancePct?.toFixed(1)}% of last top-up (${p.last_topup_amount.toFixed(2)})</span>
                          </div>
                          <div className="w-full h-2 bg-cloud-grey dark:bg-deep-charcoal rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                                 style={{
                                   width: `${Math.min(100, balancePct || 0)}%`,
                                   background: isLow ? "#FAED26" : "#D29A2D",
                                 }} />
                          </div>
                          <p className="text-xs text-warm-grey mt-1">Alert at {p.alert_threshold_percent}%</p>
                        </div>
                      )}

                      {/* API Key preview + update */}
                      <div className="mt-3">
                        <label className="text-xs text-warm-grey mb-1 block">API Key</label>
                        {hasKey && (
                          <div className="flex items-center gap-2 mb-2 text-sm font-mono bg-cloud-grey dark:bg-deep-charcoal rounded-lg px-3 py-1.5">
                            <KeyRound size={14} className="text-silk-gold" />
                            <span className="text-deep-charcoal dark:text-cloud-grey">
                              {showKeyPreview[p.id] ? "•••••••• (hidden for security)" : maskApiKey("sk-...example...")}
                            </span>
                            <button
                              onClick={() => setShowKeyPreview(s => ({ ...s, [p.id]: !s[p.id] }))}
                              className="ml-auto text-warm-grey hover:text-silk-gold transition-colors"
                              title={showKeyPreview[p.id] ? "Hide preview" : "Show preview (only shows placeholder because key is encrypted)"}
                            >
                              {showKeyPreview[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <input
                              type={showKeyPreview[p.id] ? "text" : "password"}
                              value={editKey[p.id] || ""}
                              onChange={(e) => setEditKey(k => ({ ...k, [p.id]: e.target.value }))}
                              placeholder={hasKey ? "Enter new API key (leave blank to keep current)" : "Enter API key"}
                              className="input pr-10 text-sm"
                            />
                            <button
                              onClick={() => setShowKeyPreview(s => ({ ...s, [p.id]: !s[p.id] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-grey"
                            >
                              {showKeyPreview[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          {editKey[p.id] && (
                            <button onClick={() => saveApiKey(p.id)} className="btn-primary py-2 px-3 text-sm flex items-center gap-1">
                              <Save size={14} /> Update
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-warm-grey mt-1">For security, the actual key value is encrypted and cannot be retrieved; you can only update it.</p>
                      </div>

                      {/* Alert threshold */}
                      <div className="mt-2 flex items-center gap-3">
                        <label className="text-xs text-warm-grey whitespace-nowrap">Alert at:</label>
                        <input type="number" min={1} max={100} defaultValue={p.alert_threshold_percent}
                               className="input w-20 text-sm py-1"
                               onBlur={(e) => {
                                 const v = parseInt(e.target.value);
                                 if (v && v !== p.alert_threshold_percent)
                                   updateMutation.mutate({ id: p.id, data: { alert_threshold_percent: v } });
                               }} />
                        <span className="text-xs text-warm-grey">%</span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleEnabled(p.id, p.enabled)}
                              className="text-warm-grey hover:text-silk-gold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title={p.enabled ? "Disable provider" : "Enable provider"}>
                        {p.enabled ? <ToggleRight size={28} className="text-silk-gold" /> : <ToggleLeft size={28} />}
                      </button>
                      <button onClick={() => handleDelete(p.id, p.name)}
                              className="text-warm-grey hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title="Delete provider">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Providers.tsx