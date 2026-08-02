/**
 * Providers.tsx (admin)
 * Provider fleet management: enable/disable, rotate keys, set the low-balance
 * alert threshold, and see how much runway each provider has left.
 *
 * Provider keys are encrypted at rest and cannot be read back, so this page only
 * ever offers to *replace* a key - it never pretends to show one.
 */

// File: silkllm-frontend/src/pages/admin/Providers.tsx

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Check, KeyRound, Plus, Save, Server, Trash2, Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Badge, Button, Callout, ConfirmDialog, Field, IconButton, Input, Meter, Modal,
  PageHeader, Panel, Skeleton, StatTile, Switch,
} from "@/components/ui";
import { usdShort } from "@/lib/charts";

const EMPTY = { id: "", name: "", api_key: "", alert_threshold_percent: 20 };

export default function AdminProviders() {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState<Record<string, string>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState(EMPTY);
  const [confirming, setConfirming] = useState<{ id: string; name: string } | null>(null);

  const { data: providers, isLoading } = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => adminApi.providers.list().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.providers.update(id, data),
    onSuccess: () => { toast.success("Provider updated."); qc.invalidateQueries({ queryKey: ["admin-providers"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Update failed."),
  });

  /**
   * Enabling and disabling is its own mutation so the switch can move the moment
   * it is clicked. The list refetches every 30 seconds, so without an optimistic
   * write the toggle would sit on its old value until the next round trip landed
   * and then jump, which read as the click having been ignored.
   */
  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      adminApi.providers.update(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["admin-providers"] });
      const previous = qc.getQueryData<any[]>(["admin-providers"]);
      qc.setQueryData<any[]>(["admin-providers"], (old) =>
        (old || []).map((p) => (p.id === id ? { ...p, enabled } : p)),
      );
      return { previous };
    },
    onError: (e: any, _vars, ctx) => {
      qc.setQueryData(["admin-providers"], ctx?.previous);
      toast.error(e.response?.data?.detail || "Could not change the provider.");
    },
    onSuccess: (_d, { enabled }) => {
      toast.success(enabled ? "Provider enabled. It can serve traffic again." : "Provider disabled. It will not be routed to.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-providers"] }),
  });

  const create = useMutation({
    mutationFn: (data: any) => adminApi.providers.create(data),
    onSuccess: () => {
      toast.success("Provider created.");
      qc.invalidateQueries({ queryKey: ["admin-providers"] });
      setAddOpen(false);
      setDraft(EMPTY);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Could not create the provider."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.providers.delete(id),
    onSuccess: () => { toast.success("Provider deleted."); qc.invalidateQueries({ queryKey: ["admin-providers"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Could not delete the provider."),
  });

  const list = providers || [];
  const enabled = list.filter((p: any) => p.enabled);
  const low = list.filter((p: any) => {
    if (!(p.last_topup_amount > 0)) return false;
    return (p.last_known_balance / p.last_topup_amount) * 100 <= p.alert_threshold_percent;
  });

  const saveKey = (id: string) => {
    const value = newKey[id]?.trim();
    if (!value) return;
    update.mutate({ id, data: { api_key: value } });
    setNewKey((k) => ({ ...k, [id]: "" }));
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Providers"
        subtitle="Upstream accounts the router can spend against. Balances come from the last recorded top-up."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setAddOpen(true)}>
            Add provider
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Providers" value={list.length} icon={<Server size={14} />} hint={`${enabled.length} enabled`} />
        <StatTile label="Tracked balance" value={usdShort(list.reduce((s: number, p: any) => s + (p.last_known_balance || 0), 0))} icon={<Zap size={14} />} accent />
        <StatTile label="Below threshold" value={low.length} icon={<AlertTriangle size={14} />} hint={low.length ? "Needs a top-up" : "All healthy"} />
      </div>

      {low.length > 0 && (
        <Callout tone="warning" icon={<AlertTriangle size={17} />} title={`${low.length} provider${low.length > 1 ? "s" : ""} below the alert threshold`}>
          <p>{low.map((p: any) => p.name).join(", ")} - top up upstream, then record it under Top-Ups so tracking stays accurate.</p>
        </Callout>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : !list.length ? (
        <Panel title="Providers">
          <div className="p-10 text-center">
            <p className="text-sm text-ink">No providers configured</p>
            <p className="text-xs text-ink-3 mt-1.5">Add one to give the router somewhere to send traffic.</p>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          {list.map((p: any) => {
            const hasBudget = p.last_topup_amount > 0;
            const pct = hasBudget ? (p.last_known_balance / p.last_topup_amount) * 100 : null;
            const isLow = pct !== null && pct <= p.alert_threshold_percent;

            return (
              <Panel
                key={p.id}
                title={
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="w-7 h-7 rounded-lg bg-ink/[0.05] border border-line flex items-center justify-center text-2xs font-bold text-ink-2 uppercase">
                      {p.name.slice(0, 2)}
                    </span>
                    {p.name}
                    <Badge tone={p.enabled ? "success" : "neutral"}>{p.enabled ? "Enabled" : "Disabled"}</Badge>
                    {isLow && <Badge tone="warning" icon={<AlertTriangle size={10} />}>Low balance</Badge>}
                    {!p.has_api_key && <Badge tone="error">No key</Badge>}
                  </span>
                }
                actions={
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={p.enabled}
                      stateLabels={["Enabled", "Disabled"]}
                      label={`${p.name} routing`}
                      pending={toggleEnabled.isPending && toggleEnabled.variables?.id === p.id}
                      onChange={(enabled) => toggleEnabled.mutate({ id: p.id, enabled })}
                    />
                    <span className="w-px h-5 bg-line" />
                    <IconButton label={`Delete ${p.name}`} size={34} tone="danger" onClick={() => setConfirming({ id: p.id, name: p.name })}>
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                }
              >
                <div className="px-5 sm:px-6 py-5 space-y-5">
                  {!p.enabled && (
                    <Callout tone="warning" icon={<AlertTriangle size={15} />}>
                      <p>
                        This provider is disabled. The router will skip it and every model belonging to
                        it is unavailable, even if the model itself is enabled.
                      </p>
                    </Callout>
                  )}
                  {/* Runway */}
                  {hasBudget ? (
                    <div>
                      <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
                        <span className="text-sm text-ink num">
                          <span className="font-medium">${p.last_known_balance.toFixed(2)}</span>
                          <span className="text-ink-3"> of ${p.last_topup_amount.toFixed(2)} remaining</span>
                        </span>
                        <span className="text-xs text-ink-2 num">{pct!.toFixed(1)}%</span>
                      </div>
                      <Meter value={pct!} tone={isLow ? "warn" : "accent"} />
                      <p className="text-2xs text-ink-3 mt-1.5 num">Alerts fire below {p.alert_threshold_percent}%</p>
                    </div>
                  ) : (
                    <p className="text-xs text-ink-3">
                      No top-up recorded yet - record one to start tracking this provider's balance.
                    </p>
                  )}

                  <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-end pt-4 border-t border-line">
                    <Field
                      label="Rotate API key"
                      hint="Keys are encrypted at rest and cannot be read back - you can only replace one."
                    >
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          className="font-mono"
                          autoComplete="off"
                          placeholder={p.has_api_key ? "Paste a new key to replace the current one" : "Paste the provider API key"}
                          value={newKey[p.id] || ""}
                          onChange={(e) => setNewKey((k) => ({ ...k, [p.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === "Enter") saveKey(p.id); }}
                        />
                        <Button
                          variant="primary"
                          disabled={!newKey[p.id]?.trim()}
                          onClick={() => saveKey(p.id)}
                          icon={<Save size={14} />}
                        >
                          Save
                        </Button>
                      </div>
                    </Field>

                    <Field label="Alert at" hint="% of last top-up">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          className="w-20 num text-right"
                          defaultValue={p.alert_threshold_percent}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value);
                            if (v && v !== p.alert_threshold_percent) {
                              update.mutate({ id: p.id, data: { alert_threshold_percent: v } });
                            }
                          }}
                        />
                        <span className="text-sm text-ink-3">%</span>
                      </div>
                    </Field>
                  </div>

                  {p.has_api_key && (
                    <p className="text-2xs text-ink-3 flex items-center gap-1.5">
                      <KeyRound size={12} className="text-success" /> A key is configured and encrypted.
                    </p>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a provider"
        description="The router can only reach models whose provider is configured and enabled."
        icon={<Plus size={17} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={!draft.id || !draft.name || !draft.api_key}
              onClick={() => create.mutate(draft)}
            >
              Create provider
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Provider ID" required hint="Lowercase, used in model routing.">
              <Input
                className="font-mono"
                placeholder="cohere"
                value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: e.target.value.trim().toLowerCase() })}
              />
            </Field>
            <Field label="Display name" required>
              <Input placeholder="Cohere" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
          </div>
          <Field label="API key" required hint="Encrypted immediately and never displayed again.">
            <Input
              type="password"
              className="font-mono"
              autoComplete="off"
              value={draft.api_key}
              onChange={(e) => setDraft({ ...draft, api_key: e.target.value })}
            />
          </Field>
          <Field label="Alert threshold (%)" hint="Email alerts fire when the balance drops below this share of the last top-up.">
            <Input
              type="number"
              min={1}
              max={100}
              className="num"
              value={draft.alert_threshold_percent}
              onChange={(e) => setDraft({ ...draft, alert_threshold_percent: parseInt(e.target.value) || 20 })}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && remove.mutate(confirming.id)}
        title={`Delete "${confirming?.name}"?`}
        body="Every model belonging to this provider is deleted with it, and any request routed there will fail. This cannot be undone."
        confirmLabel="Delete provider"
        pending={remove.isPending}
      />
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Providers.tsx
