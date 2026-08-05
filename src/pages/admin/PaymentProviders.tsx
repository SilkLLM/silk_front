/**
 * PaymentProviders.tsx (admin)
 * Payment rail management: enable/disable and rotate credentials for
 * Paystack, Dodo Payments and Flutterwave, the same way Providers.tsx does
 * for LLM providers - so turning a rail on or off, or replacing a leaked
 * key, is a dashboard action rather than a code change and a redeploy.
 *
 * Rows are seeded by migration 0013 and never created here: each rail needs
 * a matching module under app/payment/rails/ to actually take traffic, so
 * this page only edits the three that exist rather than offering to invent
 * a fourth that would silently do nothing.
 */

// File: silkllm-frontend/src/pages/admin/PaymentProviders.tsx

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CreditCard, Globe, KeyRound, Landmark, Save, Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Badge, Button, Callout, Field, Input, PageHeader, Panel, Select, Skeleton, StatTile, Switch,
} from "@/components/ui";

type PaymentProvider = {
  id: string;
  name: string;
  enabled: boolean;
  has_secret_key: boolean;
  has_public_key: boolean;
  has_webhook_secret: boolean;
  config: Record<string, any>;
};

const RAIL_META: Record<string, { icon: React.ReactNode; blurb: string; hasWebhookSecret: boolean }> = {
  paystack: { icon: <Globe size={16} />, blurb: "NGN checkout, converted live from USD.", hasWebhookSecret: false },
  dodo: { icon: <CreditCard size={16} />, blurb: "Global card checkout, charged in USD.", hasWebhookSecret: true },
  flutterwave: { icon: <Landmark size={16} />, blurb: "Pan-African checkout, charged in USD.", hasWebhookSecret: true },
};

export default function AdminPaymentProviders() {
  const qc = useQueryClient();
  const [secretDraft, setSecretDraft] = useState<Record<string, string>>({});
  const [webhookDraft, setWebhookDraft] = useState<Record<string, string>>({});
  const [configDraft, setConfigDraft] = useState<Record<string, Record<string, string>>>({});

  const { data: rails, isLoading } = useQuery({
    queryKey: ["admin-payment-providers"],
    queryFn: () => adminApi.paymentProviders.list().then((r) => r.data as PaymentProvider[]),
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.paymentProviders.update(id, data),
    onSuccess: () => { toast.success("Payment provider updated."); qc.invalidateQueries({ queryKey: ["admin-payment-providers"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Update failed."),
  });

  /** Same optimistic-toggle pattern as the LLM Providers page: the list also
   * polls every 30 seconds, so without this the switch would sit on its old
   * value until the next poll landed. */
  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      adminApi.paymentProviders.update(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["admin-payment-providers"] });
      const previous = qc.getQueryData<PaymentProvider[]>(["admin-payment-providers"]);
      qc.setQueryData<PaymentProvider[]>(["admin-payment-providers"], (old) =>
        (old || []).map((p) => (p.id === id ? { ...p, enabled } : p)),
      );
      return { previous };
    },
    onError: (e: any, _vars, ctx) => {
      qc.setQueryData(["admin-payment-providers"], ctx?.previous);
      toast.error(e.response?.data?.detail || "Could not change the rail.");
    },
    onSuccess: (_d, { enabled }) => {
      toast.success(enabled ? "Rail enabled. Customers can check out with it again." : "Rail disabled. It will no longer be offered at checkout.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-payment-providers"] }),
  });

  const list = rails || [];
  const enabledCount = list.filter((p) => p.enabled).length;
  const readyCount = list.filter((p) => p.enabled && p.has_secret_key).length;

  const saveSecret = (id: string) => {
    const value = secretDraft[id]?.trim();
    if (!value) return;
    update.mutate({ id, data: { secret_key: value } });
    setSecretDraft((d) => ({ ...d, [id]: "" }));
  };

  const saveWebhookSecret = (id: string) => {
    const value = webhookDraft[id]?.trim();
    if (!value) return;
    update.mutate({ id, data: { webhook_secret: value } });
    setWebhookDraft((d) => ({ ...d, [id]: "" }));
  };

  const saveConfig = (p: PaymentProvider, patch: Record<string, string>) => {
    const next = { ...(p.config || {}), ...patch };
    update.mutate({ id: p.id, data: { config: next } });
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Payment Providers"
        subtitle="Checkout rails customers can buy credits through. Enable, disable or rotate credentials here - no redeploy needed."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Rails" value={list.length} icon={<Wallet size={14} />} hint={`${enabledCount} enabled`} />
        <StatTile label="Live at checkout" value={readyCount} icon={<CreditCard size={14} />} accent hint="Enabled and configured" />
        <StatTile
          label="Needs attention"
          value={list.filter((p) => p.enabled && !p.has_secret_key).length}
          icon={<AlertTriangle size={14} />}
          hint="Enabled without a key"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {list.map((p) => {
            const meta = RAIL_META[p.id] || { icon: <Wallet size={16} />, blurb: "", hasWebhookSecret: true };
            const misconfigured = p.enabled && !p.has_secret_key;

            return (
              <Panel
                key={p.id}
                title={
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="w-7 h-7 rounded-lg bg-ink/[0.05] border border-line flex items-center justify-center text-ink-2">
                      {meta.icon}
                    </span>
                    {p.name}
                    <Badge tone={p.enabled ? "success" : "neutral"}>{p.enabled ? "Enabled" : "Disabled"}</Badge>
                    {!p.has_secret_key && <Badge tone="error">No key</Badge>}
                  </span>
                }
                actions={
                  <Switch
                    checked={p.enabled}
                    stateLabels={["Enabled", "Disabled"]}
                    label={`${p.name} checkout`}
                    pending={toggleEnabled.isPending && toggleEnabled.variables?.id === p.id}
                    onChange={(enabled) => toggleEnabled.mutate({ id: p.id, enabled })}
                  />
                }
              >
                <div className="px-5 sm:px-6 py-5 space-y-5">
                  <p className="text-xs text-ink-3">{meta.blurb}</p>

                  {misconfigured && (
                    <Callout tone="warning" icon={<AlertTriangle size={15} />}>
                      Enabled but missing a secret key - customers will not see it as available at checkout until one is set.
                    </Callout>
                  )}
                  {!p.enabled && p.has_secret_key && (
                    <Callout tone="info" icon={<AlertTriangle size={15} />}>
                      Configured but disabled. Customers will not see this option at checkout until it is enabled.
                    </Callout>
                  )}

                  <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end">
                    <Field label="Secret key" hint="Encrypted at rest and never shown again - you can only replace it.">
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          className="font-mono"
                          autoComplete="off"
                          placeholder={p.has_secret_key ? "Paste a new secret key to replace the current one" : "Paste the rail's secret key"}
                          value={secretDraft[p.id] || ""}
                          onChange={(e) => setSecretDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveSecret(p.id); }}
                        />
                        <Button
                          variant="primary"
                          disabled={!secretDraft[p.id]?.trim()}
                          onClick={() => saveSecret(p.id)}
                          icon={<Save size={14} />}
                        >
                          Save
                        </Button>
                      </div>
                    </Field>
                  </div>

                  {meta.hasWebhookSecret && (
                    <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end pt-4 border-t border-line">
                      <Field
                        label="Webhook secret"
                        hint={
                          p.id === "dodo"
                            ? "Dodo's webhook signing secret (whsec_...), from the Dodo dashboard."
                            : "The verification hash configured in the Flutterwave dashboard."
                        }
                      >
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            className="font-mono"
                            autoComplete="off"
                            placeholder={p.has_webhook_secret ? "Paste a new webhook secret to replace the current one" : "Paste the webhook secret"}
                            value={webhookDraft[p.id] || ""}
                            onChange={(e) => setWebhookDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") saveWebhookSecret(p.id); }}
                          />
                          <Button
                            variant="secondary"
                            disabled={!webhookDraft[p.id]?.trim()}
                            onClick={() => saveWebhookSecret(p.id)}
                            icon={<Save size={14} />}
                          >
                            Save
                          </Button>
                        </div>
                      </Field>
                    </div>
                  )}

                  {p.id === "dodo" && (
                    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-line">
                      <Field label="Credit product ID" hint="The Dodo 'Pay What You Want' product that checkout charges against.">
                        <Input
                          className="font-mono"
                          placeholder="prod_credit_pwyw"
                          defaultValue={p.config?.credit_product_id || ""}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (p.config?.credit_product_id || "")) saveConfig(p, { credit_product_id: v });
                          }}
                        />
                      </Field>
                      <Field label="Environment">
                        <Select
                          defaultValue={p.config?.environment || "live_mode"}
                          onChange={(e) => saveConfig(p, { environment: e.target.value })}
                        >
                          <option value="live_mode">Live</option>
                          <option value="test_mode">Test</option>
                        </Select>
                      </Field>
                    </div>
                  )}

                  {p.id === "flutterwave" && (
                    <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-line">
                      <Field label="Webhook signing mode" hint="How the webhook secret above is checked against incoming events.">
                        <Select
                          defaultValue={p.config?.webhook_header_mode || "verif_hash"}
                          onChange={(e) => saveConfig(p, { webhook_header_mode: e.target.value })}
                        >
                          <option value="verif_hash">Verification hash (verif-hash header)</option>
                          <option value="signature_hmac">HMAC signature</option>
                        </Select>
                      </Field>
                    </div>
                  )}

                  {p.has_secret_key && (
                    <p className="text-2xs text-ink-3 flex items-center gap-1.5">
                      <KeyRound size={12} className="text-success" /> A secret key is configured and encrypted.
                    </p>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/PaymentProviders.tsx
