/**
 * ProviderHub.tsx
 * BYOK marketplace, user side. Deposit and manage your own provider keys, see
 * per-key earnings and requests served. A public key is used only by our backend
 * to serve others (you earn credits); it is never shown to other users. This page
 * explains, in plain language, exactly what you are opting into.
 */

// File: silkllm-frontend/src/pages/user/ProviderHub.tsx

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, Plus, Trash2, Globe, Lock, Info, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { providerKeysApi, modelsApi } from "@/services/api";

interface ProviderKey {
  id: string; provider_id: string; label: string;
  is_public: boolean; is_free_key: boolean; serve_owner_with_own_key: boolean;
  daily_limit_usd: number; declared_budget_usd: number; consumed_usd_total: number;
  status: string; created_at: string; last_used: string | null;
  earned_credits_total: number; requests_served: number; provider_cost_served: number;
}

function money(n: number) { return `$${(n || 0).toFixed(4)}`; }

export default function ProviderHub() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    provider_id: "openai", api_key: "", label: "My key",
    is_public: true, serve_owner_with_own_key: true, declared_budget_usd: 0,
  });
  const [consent, setConsent] = useState(false);

  const { data: keys, isLoading } = useQuery<ProviderKey[]>({
    queryKey: ["provider-keys"],
    queryFn: () => providerKeysApi.list().then((r) => r.data),
  });

  const { data: models } = useQuery({
    queryKey: ["models-for-providers"],
    queryFn: () => modelsApi.list().then((r) => r.data.models),
  });

  const providers = useMemo<string[]>(() => {
    const set = new Set<string>((models || []).map((m: any) => m.provider));
    return Array.from(set).sort();
  }, [models]);

  const deposit = useMutation({
    mutationFn: () => providerKeysApi.deposit(form).then((r) => r.data),
    onSuccess: () => {
      toast.success("Key deposited");
      setForm((f) => ({ ...f, api_key: "", label: "My key" }));
      setConsent(false);
      qc.invalidateQueries({ queryKey: ["provider-keys"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Failed to deposit key"),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => providerKeysApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["provider-keys"] }); },
    onError: () => toast.error("Failed to update key"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => providerKeysApi.revoke(id),
    onSuccess: () => { toast.success("Key revoked"); qc.invalidateQueries({ queryKey: ["provider-keys"] }); },
    onError: () => toast.error("Failed to revoke key"),
  });

  const totalEarned = (keys || []).reduce((s, k) => s + (k.earned_credits_total || 0), 0);
  const totalServed = (keys || []).reduce((s, k) => s + (k.requests_served || 0), 0);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">Provider Hub</h1>
          <p className="text-warm-grey mt-1">Bring your own provider keys. Share a public key and earn credits when others use it, spendable on any model.</p>
        </div>

        {/* Earnings summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-xs text-warm-grey uppercase tracking-wide">Credits earned</p>
            <p className="text-2xl font-bold text-silk-gold mt-1">{money(totalEarned)}</p>
          </div>
          <div className="card">
            <p className="text-xs text-warm-grey uppercase tracking-wide">Requests served</p>
            <p className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey mt-1">{totalServed}</p>
          </div>
          <div className="card">
            <p className="text-xs text-warm-grey uppercase tracking-wide">Active keys</p>
            <p className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey mt-1">{(keys || []).length}</p>
          </div>
        </div>

        {/* How it works */}
        <div className="card border-silk-gold/30 bg-silk-gold/5">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-silk-gold shrink-0 mt-0.5" />
            <div className="text-sm text-warm-grey space-y-1.5">
              <p><strong className="text-deep-charcoal dark:text-cloud-grey">Public</strong> keys are used only by our routing engine to serve other users. They are never shown to anyone. You earn 75% of the provider cost as SilkLLM credits, which you spend on any model at the normal 10% markup.</p>
              <p><strong className="text-deep-charcoal dark:text-cloud-grey">Private</strong> keys serve only you (25% markup). Using your own public key for your own requests costs the normal 10% and earns nothing.</p>
              <p>Turn off "use my key for my own requests" to be served as if you deposited nothing, while your public key still serves the marketplace. Free models cost nothing and earn nothing. Your secret is encrypted and never shown again.</p>
            </div>
          </div>
        </div>

        {/* Deposit form */}
        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-4 flex items-center gap-2">
            <Plus size={18} className="text-silk-gold" /> Deposit a key
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-warm-grey">Provider</span>
              <select className="input mt-1" value={form.provider_id}
                onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
                {providers.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-warm-grey">Label</span>
              <input className="input mt-1" value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="My key" />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs text-warm-grey">API key (encrypted, never shown again)</span>
              <input className="input mt-1 font-mono" type="password" value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })} placeholder="sk-..." />
            </label>
            <label className="block">
              <span className="text-xs text-warm-grey">Declared budget (USD, 0 = uncapped)</span>
              <input className="input mt-1" type="number" min={0} step="0.01" value={form.declared_budget_usd}
                onChange={(e) => setForm({ ...form, declared_budget_usd: parseFloat(e.target.value) || 0 })} />
            </label>
            <div className="flex flex-col justify-center gap-2">
              <label className="flex items-center gap-2 text-sm text-deep-charcoal dark:text-cloud-grey">
                <input type="checkbox" checked={form.is_public}
                  onChange={(e) => setForm({ ...form, is_public: e.target.checked })} />
                Public (share and earn)
              </label>
              <label className="flex items-center gap-2 text-sm text-deep-charcoal dark:text-cloud-grey">
                <input type="checkbox" checked={form.serve_owner_with_own_key}
                  onChange={(e) => setForm({ ...form, serve_owner_with_own_key: e.target.checked })} />
                Use my key for my own requests
              </label>
            </div>
          </div>

          <label className="flex items-start gap-2 mt-4 text-xs text-warm-grey">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
            I understand this key will be used per the rules above, that a public key may serve other users (never visible to them), and that I am responsible for my provider's terms.
          </label>

          <button
            onClick={() => deposit.mutate()}
            disabled={!form.api_key.trim() || !consent || deposit.isPending}
            className="btn-primary mt-4 disabled:opacity-50"
          >
            {deposit.isPending ? "Depositing..." : "Deposit key"}
          </button>
        </div>

        {/* Keys list */}
        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-4 flex items-center gap-2">
            <Coins size={18} className="text-silk-gold" /> Your keys
          </h2>
          {isLoading ? (
            <p className="text-warm-grey text-sm">Loading...</p>
          ) : (keys || []).length === 0 ? (
            <p className="text-warm-grey text-sm">No deposited keys yet. Add one above to start earning.</p>
          ) : (
            <div className="space-y-3">
              {(keys || []).map((k) => (
                <div key={k.id} className="p-4 rounded-lg bg-cloud-grey dark:bg-deep-charcoal">
                  <div className="flex items-center gap-3 flex-wrap">
                    {k.is_public ? <Globe size={16} className="text-silk-gold" /> : <Lock size={16} className="text-warm-grey" />}
                    <span className="font-medium text-sm text-deep-charcoal dark:text-cloud-grey">{k.label}</span>
                    <span className="badge-info">{k.provider_id}</span>
                    <span className={k.status === "active" ? "badge-success" : "badge-warning"}>{k.status}</span>
                    {k.is_free_key && <span className="badge-info">free key</span>}
                    <div className="flex-1" />
                    <button
                      onClick={() => window.confirm(`Revoke "${k.label}"?`) && revoke.mutate(k.id)}
                      className="text-warm-grey hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Revoke"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
                    <div><span className="text-warm-grey">Earned</span><br /><span className="text-silk-gold font-semibold flex items-center gap-1"><TrendingUp size={12} />{money(k.earned_credits_total)}</span></div>
                    <div><span className="text-warm-grey">Served</span><br /><span className="text-deep-charcoal dark:text-cloud-grey">{k.requests_served} reqs</span></div>
                    <div><span className="text-warm-grey">Delivered</span><br /><span className="text-deep-charcoal dark:text-cloud-grey">{money(k.provider_cost_served)}{k.declared_budget_usd > 0 ? ` / $${k.declared_budget_usd}` : ""}</span></div>
                    <div><span className="text-warm-grey">Added</span><br /><span className="text-deep-charcoal dark:text-cloud-grey">{format(new Date(k.created_at), "MMM d")}</span></div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <label className="flex items-center gap-1.5 text-warm-grey cursor-pointer">
                      <input type="checkbox" checked={k.is_public}
                        onChange={(e) => update.mutate({ id: k.id, data: { is_public: e.target.checked } })} />
                      Public
                    </label>
                    <label className="flex items-center gap-1.5 text-warm-grey cursor-pointer">
                      <input type="checkbox" checked={k.serve_owner_with_own_key}
                        onChange={(e) => update.mutate({ id: k.id, data: { serve_owner_with_own_key: e.target.checked } })} />
                      Serve my own requests
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/ProviderHub.tsx
