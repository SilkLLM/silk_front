/**
 * ProviderHub.tsx
 * The BYOK marketplace from the depositor's side: deposit provider keys, control
 * how they are used, and watch what they earn.
 *
 * The deposit form is a modal rather than an always-open block - most visits are
 * to check earnings, not to add a key. The economics sit next to the form,
 * because "public" is the consequential choice on this page.
 */

// File: silkllm-frontend/src/pages/user/ProviderHub.tsx

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Coins, Globe, Info, Lock, Plus, Server, Trash2, TrendingUp, Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { providerKeysApi, modelsApi } from "@/services/api";
import {
  Badge, Button, Callout, Checkbox, ConfirmDialog, EmptyState, Field, IconButton,
  Input, Meter, Modal, PageHeader, Panel, Select, Skeleton, StatTile, ToggleField,
} from "@/components/ui";
import { compact, usdPrecise } from "@/lib/charts";

interface ProviderKey {
  id: string; provider_id: string; label: string;
  is_public: boolean; is_free_key: boolean; serve_owner_with_own_key: boolean;
  daily_limit_usd: number; declared_budget_usd: number; consumed_usd_total: number;
  status: string; created_at: string; last_used: string | null;
  earned_credits_total: number; requests_served: number; provider_cost_served: number;
}

const EMPTY_FORM = {
  provider_id: "openai",
  api_key: "",
  label: "My key",
  is_public: true,
  serve_owner_with_own_key: true,
  declared_budget_usd: 0,
};

export default function ProviderHub() {
  const qc = useQueryClient();
  const [depositOpen, setDepositOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [consent, setConsent] = useState(false);
  const [confirming, setConfirming] = useState<ProviderKey | null>(null);

  const { data: keys, isLoading } = useQuery<ProviderKey[]>({
    queryKey: ["provider-keys"],
    queryFn: () => providerKeysApi.list().then((r) => r.data),
  });

  const { data: models } = useQuery({
    queryKey: ["models-for-providers"],
    queryFn: () => modelsApi.list().then((r) => r.data.models),
  });

  const providers = useMemo<string[]>(
    () => Array.from(new Set<string>((models || []).map((m: any) => m.provider))).sort(),
    [models],
  );

  const deposit = useMutation({
    mutationFn: () => providerKeysApi.deposit(form).then((r) => r.data),
    onSuccess: () => {
      toast.success("Key deposited and encrypted.");
      setForm(EMPTY_FORM);
      setConsent(false);
      setDepositOpen(false);
      qc.invalidateQueries({ queryKey: ["provider-keys"] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Could not deposit the key."),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => providerKeysApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provider-keys"] }),
    onError: () => toast.error("Could not update the key."),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => providerKeysApi.revoke(id),
    onSuccess: () => {
      toast.success("Key revoked.");
      qc.invalidateQueries({ queryKey: ["provider-keys"] });
    },
    onError: () => toast.error("Could not revoke the key."),
  });

  const list = keys || [];
  const earned = list.reduce((s, k) => s + (k.earned_credits_total || 0), 0);
  const served = list.reduce((s, k) => s + (k.requests_served || 0), 0);
  const delivered = list.reduce((s, k) => s + (k.provider_cost_served || 0), 0);

  return (
    <DashboardLayout>
      <PageHeader
        title="Provider Hub"
        subtitle="Deposit your own provider keys. Share one publicly and earn SilkLLM credits whenever the router serves someone with it."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setDepositOpen(true)}>
            Deposit a key
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Credits earned" value={usdPrecise(earned)} icon={<Coins size={14} />} accent hint="Spendable on any model" />
        <StatTile label="Requests served" value={compact(served)} icon={<Zap size={14} />} hint="For other users" />
        <StatTile label="Provider cost delivered" value={usdPrecise(delivered)} icon={<TrendingUp size={14} />} hint="Charged to your providers" />
        <StatTile label="Deposited keys" value={list.length} icon={<Server size={14} />} hint={`${list.filter((k) => k.is_public).length} public`} />
      </div>

      <Callout tone="brand" icon={<Info size={17} />} title="How the marketplace pays you">
        <p>
          <strong className="text-ink">Public</strong> keys are used only by the routing engine to serve
          other users - they are never shown to anyone. You earn 75% of the provider cost as SilkLLM
          credits, spendable on any model at the normal 10% markup.
        </p>
        <p>
          <strong className="text-ink">Private</strong> keys serve only you, at a 25% markup. Using your own
          public key for your own requests costs the normal 10% and earns nothing.
        </p>
        <p>
          Turn off "serve my own requests" to be routed as if you had deposited nothing, while your public
          key keeps serving the marketplace. Free models cost nothing and earn nothing. Your secret is
          encrypted at rest and never shown again.
        </p>
      </Callout>

      <Panel
        title="Your keys"
        description={list.length ? `${list.length} deposited` : undefined}
        icon={<Coins size={15} />}
        actions={
          list.length > 0 ? (
            <Button size="sm" icon={<Plus size={14} />} onClick={() => setDepositOpen(true)}>Add another</Button>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : !list.length ? (
          <EmptyState
            icon={<Coins size={19} />}
            title="No deposited keys yet"
            hint="Deposit a provider key to start earning credits when the marketplace routes through it."
            action={<Button variant="primary" icon={<Plus size={14} />} onClick={() => setDepositOpen(true)}>Deposit a key</Button>}
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((k) => {
              const budget = k.declared_budget_usd > 0;
              const pct = budget ? Math.min(100, (k.provider_cost_served / k.declared_budget_usd) * 100) : 0;
              return (
                <li key={k.id} className="px-5 sm:px-6 py-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                      k.is_public ? "bg-accent/10 border-accent/20 text-accent-ink" : "bg-ink/[0.04] border-line text-ink-3"
                    }`}>
                      {k.is_public ? <Globe size={16} /> : <Lock size={16} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ink truncate">{k.label}</span>
                        <Badge tone="neutral">{k.provider_id}</Badge>
                        <Badge tone={k.status === "active" ? "success" : "warning"}>{k.status}</Badge>
                        {k.is_free_key && <Badge tone="brand">free key</Badge>}
                      </div>
                      <p className="text-2xs text-ink-3 mt-0.5 num">
                        Added {format(new Date(k.created_at), "MMM d, yyyy")}
                        {k.last_used && ` · last used ${format(new Date(k.last_used), "MMM d")}`}
                      </p>
                    </div>

                    <IconButton label={`Revoke ${k.label}`} size={34} tone="danger" onClick={() => setConfirming(k)}>
                      <Trash2 size={15} />
                    </IconButton>
                  </div>

                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                    <div>
                      <dt className="text-2xs text-ink-3 uppercase tracking-wide">Earned</dt>
                      <dd className="text-sm font-medium text-accent-ink num mt-0.5">{usdPrecise(k.earned_credits_total)}</dd>
                    </div>
                    <div>
                      <dt className="text-2xs text-ink-3 uppercase tracking-wide">Served</dt>
                      <dd className="text-sm font-medium text-ink num mt-0.5">{compact(k.requests_served)} reqs</dd>
                    </div>
                    <div>
                      <dt className="text-2xs text-ink-3 uppercase tracking-wide">Delivered</dt>
                      <dd className="text-sm font-medium text-ink num mt-0.5">{usdPrecise(k.provider_cost_served)}</dd>
                    </div>
                    <div>
                      <dt className="text-2xs text-ink-3 uppercase tracking-wide">Budget</dt>
                      <dd className="text-sm font-medium text-ink num mt-0.5">
                        {budget ? `$${k.declared_budget_usd.toFixed(2)}` : "Uncapped"}
                      </dd>
                    </div>
                  </dl>

                  {budget && (
                    <div className="mt-3">
                      <Meter value={pct} tone={pct >= 90 ? "danger" : pct >= 70 ? "warn" : "accent"} size="sm" />
                      <p className="text-2xs text-ink-3 mt-1.5 num">{pct.toFixed(0)}% of declared budget delivered</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-line grid sm:grid-cols-2 gap-4">
                    <ToggleField
                      checked={k.is_public}
                      onChange={(v) => update.mutate({ id: k.id, data: { is_public: v } })}
                      title="Share and earn"
                      description="Let the router serve other users with this key."
                      stateLabels={["Public", "Private"]}
                      pending={update.isPending && update.variables?.id === k.id && "is_public" in (update.variables?.data || {})}
                    />
                    <ToggleField
                      checked={k.serve_owner_with_own_key}
                      onChange={(v) => update.mutate({ id: k.id, data: { serve_owner_with_own_key: v } })}
                      title="Serve my own requests"
                      description="Use this key for your own traffic instead of the pool."
                      stateLabels={["On", "Off"]}
                      pending={update.isPending && update.variables?.id === k.id && "serve_owner_with_own_key" in (update.variables?.data || {})}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Deposit */}
      <Modal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        title="Deposit a provider key"
        description="The secret is encrypted at rest and never shown again, not even to you."
        icon={<Plus size={17} />}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDepositOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!form.api_key.trim() || !consent}
              loading={deposit.isPending}
              onClick={() => deposit.mutate()}
            >
              Deposit key
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Provider" required>
              <Select value={form.provider_id} onChange={(e) => setForm({ ...form, provider_id: e.target.value })}>
                {providers.length === 0 && <option value="openai">openai</option>}
                {providers.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="Label" hint="How you will recognise it later.">
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="My key" />
            </Field>
          </div>

          <Field label="API key" required hint="Encrypted immediately. Never displayed again.">
            <Input
              type="password"
              className="font-mono"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              placeholder="sk-..."
              autoComplete="off"
            />
          </Field>

          <Field label="Declared budget (USD)" hint="How much provider spend you are willing to contribute. 0 means uncapped.">
            <Input
              type="number"
              min={0}
              step="0.01"
              className="num"
              value={form.declared_budget_usd}
              onChange={(e) => setForm({ ...form, declared_budget_usd: parseFloat(e.target.value) || 0 })}
            />
          </Field>

          <div className="rounded-xl border border-line bg-sunken p-4 space-y-3.5">
            <Checkbox
              checked={form.is_public}
              onChange={(v) => setForm({ ...form, is_public: v })}
              label="Public - share and earn"
              hint="The router may use this key to serve other users. You earn 75% of the provider cost as credits."
            />
            <Checkbox
              checked={form.serve_owner_with_own_key}
              onChange={(v) => setForm({ ...form, serve_owner_with_own_key: v })}
              label="Use my key for my own requests"
              hint="Off means you are served like any other user while your key still serves the marketplace."
            />
          </div>

          <Checkbox
            checked={consent}
            onChange={setConsent}
            label="I understand and accept how this key will be used"
            hint="A public key may serve other users, is never visible to them, and I remain responsible for my provider's terms of service."
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && revoke.mutate(confirming.id)}
        title={`Revoke "${confirming?.label}"?`}
        body="The key stops serving immediately and is removed from the routing pool. Credits you have already earned stay in your balance."
        confirmLabel="Revoke key"
        pending={revoke.isPending}
      />
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/ProviderHub.tsx
