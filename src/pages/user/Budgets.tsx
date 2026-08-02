/**
 * Budgets.tsx
 * Shared budgets across keys, and webhooks that fire when a limit is reached.
 *
 * The two belong on one page because they answer the same question from
 * opposite ends: a shared budget decides when spending stops, a webhook is how
 * you hear about it before a customer does.
 *
 * As with a new key, a webhook secret is shown exactly once. That moment gets a
 * modal rather than a banner, because it cannot be recovered afterwards.
 */

// File: silkllm-frontend/src/pages/user/Budgets.tsx

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Check, Pencil, Plus, RotateCcw, Send, Trash2, Users, Webhook as WebhookIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { budgetsApi, webhooksApi } from "@/services/api";
import {
  Badge, Button, Callout, Checkbox, ConfirmDialog, CopyButton, EmptyState, Field,
  IconButton, Input, Meter, Modal, PageHeader, Panel, Skeleton, StatTile,
} from "@/components/ui";
import { usdPrecise } from "@/lib/charts";
import { useAllocation } from "@/components/KeyControls";

interface Pool {
  id: string;
  name: string;
  spend_limit_usd: number | null;
  spent_usd: number;
  key_count?: number;
  created_at: string;
  limit_reset_at?: string | null;
}

interface Hook {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  secret?: string;
  last_status: number | null;
  last_error: string | null;
  last_delivery_at: string | null;
  consecutive_failures: number;
}

/** How much of a shared budget is gone. Uncapped pools show spend without a bar. */
function PoolState({ p }: { p: Pool }) {
  if (p.spend_limit_usd == null) {
    return <p className="text-2xs text-ink-3 num mt-1">{usdPrecise(p.spent_usd)} spent, no limit</p>;
  }
  const pct = Math.min(100, (p.spent_usd / p.spend_limit_usd) * 100);
  const spent = p.spent_usd >= p.spend_limit_usd;
  return (
    <div className="mt-2 max-w-xs">
      <Meter value={pct} tone={spent ? "danger" : pct >= 80 ? "warn" : "accent"} size="sm" />
      <p className="text-2xs text-ink-3 num mt-1.5">
        {usdPrecise(p.spent_usd)} of ${p.spend_limit_usd.toFixed(2)} used
        {!spent && `, ${usdPrecise(p.spend_limit_usd - p.spent_usd)} left`}
      </p>
    </div>
  );
}

export default function Budgets() {
  const qc = useQueryClient();
  const [poolName, setPoolName] = useState("");
  const [poolLimit, setPoolLimit] = useState("100");
  const [poolCapped, setPoolCapped] = useState(true);
  const [editingPool, setEditingPool] = useState<Pool | null>(null);
  const [deletingPool, setDeletingPool] = useState<Pool | null>(null);

  const [hookUrl, setHookUrl] = useState("");
  const [hookEvents, setHookEvents] = useState<string[]>([]);
  const [createdHook, setCreatedHook] = useState<Hook | null>(null);
  const [deletingHook, setDeletingHook] = useState<Hook | null>(null);

  const { data: pools, isLoading: poolsLoading } = useQuery<Pool[]>({
    queryKey: ["budget-pools"],
    queryFn: () => budgetsApi.list().then((r) => r.data),
  });
  const { data: hooks, isLoading: hooksLoading } = useQuery<Hook[]>({
    queryKey: ["webhooks"],
    queryFn: () => webhooksApi.list().then((r) => r.data),
  });
  const { data: events } = useQuery<string[]>({
    queryKey: ["webhook-events"],
    queryFn: () => webhooksApi.events().then((r) => r.data),
    staleTime: 10 * 60_000,
  });

  const refreshPools = () => {
    qc.invalidateQueries({ queryKey: ["budget-pools"] });
    qc.invalidateQueries({ queryKey: ["key-allocation"] });
  };
  const refreshHooks = () => qc.invalidateQueries({ queryKey: ["webhooks"] });
  const fail = (fallback: string) => (e: any) =>
    toast.error(e?.response?.data?.error?.message || e?.response?.data?.detail || fallback);

  const createPool = useMutation({
    mutationFn: () => budgetsApi.create(poolName.trim(), poolCapped ? Number(poolLimit) : null),
    onSuccess: () => {
      toast.success("Shared budget created.");
      setPoolName(""); setPoolLimit("100"); setPoolCapped(true);
      refreshPools();
    },
    onError: fail("Could not create the budget."),
  });

  const updatePool = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => budgetsApi.update(id, data),
    onSuccess: () => { toast.success("Budget updated."); setEditingPool(null); refreshPools(); },
    onError: fail("Could not update the budget."),
  });

  const resetPool = useMutation({
    mutationFn: (id: string) => budgetsApi.reset(id),
    onSuccess: () => { toast.success("Counter reset."); refreshPools(); },
    onError: fail("Could not reset the counter."),
  });

  const removePool = useMutation({
    mutationFn: (id: string) => budgetsApi.remove(id),
    onSuccess: () => { toast.success("Budget removed."); setDeletingPool(null); refreshPools(); },
    onError: fail("Could not remove the budget."),
  });

  const createHook = useMutation({
    mutationFn: () => webhooksApi.create(hookUrl.trim(), hookEvents).then((r) => r.data),
    onSuccess: (data) => {
      setCreatedHook(data);
      setHookUrl(""); setHookEvents([]);
      refreshHooks();
    },
    onError: fail("Could not create the webhook."),
  });

  const testHook = useMutation({
    mutationFn: (id: string) => webhooksApi.test(id).then((r) => r.data),
    onSuccess: (data: any) => {
      if (data?.delivered) toast.success(`Endpoint answered ${data.status_code}.`);
      else toast.error(data?.error || "The endpoint did not accept the delivery.");
      refreshHooks();
    },
    onError: fail("Could not reach the endpoint."),
  });

  const removeHook = useMutation({
    mutationFn: (id: string) => webhooksApi.remove(id),
    onSuccess: () => { toast.success("Webhook removed."); setDeletingHook(null); refreshHooks(); },
    onError: fail("Could not remove the webhook."),
  });

  const poolList = pools || [];
  const hookList = hooks || [];
  const pooledSpend = poolList.reduce((s, p) => s + (p.spent_usd || 0), 0);
  const atLimit = poolList.filter((p) => p.spend_limit_usd != null && p.spent_usd >= p.spend_limit_usd);
  const failingHooks = hookList.filter((h) => h.consecutive_failures > 0);

  // A shared budget reserves part of the one account balance, exactly as a key
  // cap does, so the two compete for the same credit and the same guard applies.
  const { balance, available, loaded } = useAllocation();
  const poolAsked = poolCapped ? Number(poolLimit) : 0;
  const poolOverAllocated = loaded && poolCapped && poolAsked > available + 1e-9;

  const urlLooksValid = /^https:\/\/.+/.test(hookUrl.trim());
  const canCreateHook = urlLooksValid && hookEvents.length > 0;

  return (
    <DashboardLayout>
      <PageHeader
        title="Budgets & Webhooks"
        subtitle="Give several keys one shared ceiling, and get told when a limit is about to bite rather than finding out from a failed request."
        meta={
          <>
            <Badge tone="neutral">{poolList.length} budget{poolList.length === 1 ? "" : "s"}</Badge>
            {atLimit.length > 0 && <Badge tone="warning">{atLimit.length} at limit</Badge>}
            {failingHooks.length > 0 && <Badge tone="warning">{failingHooks.length} failing hook{failingHooks.length > 1 ? "s" : ""}</Badge>}
          </>
        }
      />

      {poolList.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Shared budgets" value={poolList.length} icon={<Users size={14} />} />
          <StatTile label="Spend on record" value={usdPrecise(pooledSpend)} icon={<Users size={14} />} accent hint="Across all budgets" />
          <StatTile label="At their limit" value={atLimit.length} icon={<AlertTriangle size={14} />} hint={atLimit.length ? "Keys on these are blocked" : "None blocked"} />
          <StatTile label="Webhooks" value={hookList.length} icon={<WebhookIcon size={14} />} hint={failingHooks.length ? `${failingHooks.length} failing` : "All healthy"} />
        </div>
      )}

      {atLimit.length > 0 && (
        <Callout tone="warning" icon={<AlertTriangle size={17} />} title={`${atLimit.length} shared budget${atLimit.length > 1 ? "s are" : " is"} used up`}>
          <p>
            {atLimit.map((p) => p.name).join(", ")} will refuse requests from every key attached to
            {atLimit.length > 1 ? " them" : " it"}, whatever those keys have left individually.
            Raise the limit or reset the counter to resume.
          </p>
        </Callout>
      )}

      {/* ── Shared budgets ─────────────────────────────────────────────── */}

      <Panel title="Create a shared budget" icon={<Plus size={15} />}>
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              placeholder="Name this budget, e.g. Mobile team, Staging"
              value={poolName}
              onChange={(e) => setPoolName(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="primary"
              icon={<Users size={15} />}
              disabled={!poolName.trim() || (poolCapped && !(Number(poolLimit) > 0)) || poolOverAllocated}
              loading={createPool.isPending}
              onClick={() => createPool.mutate()}
            >
              Create budget
            </Button>
          </div>

          <div className="rounded-xl border border-line bg-sunken p-4">
            <Checkbox
              checked={poolCapped}
              onChange={setPoolCapped}
              label="Limit total spend across the keys on this budget"
              hint="Without a limit the budget only groups keys together and reports what they spent."
            />
            {poolCapped && (
              <div className="mt-4 pl-6 max-w-xs">
                <Field label="Shared limit (USD)" hint="Every key attached to this budget draws on the same amount.">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">$</span>
                    <Input
                      type="number" min="0.01" step="0.01" className="pl-7 num"
                      value={poolLimit}
                      onChange={(e) => setPoolLimit(e.target.value)}
                    />
                  </div>
                </Field>

                {loaded && !poolOverAllocated && (
                  <p className="text-2xs text-ink-3 num mt-2">
                    {usdPrecise(available)} of your {usdPrecise(balance)} balance is still
                    free to allocate.
                  </p>
                )}

                {poolOverAllocated && (
                  <div className="mt-3">
                    <Callout tone="warning" icon={<AlertTriangle size={15} />}>
                      <p>
                        You do not have {usdPrecise(poolAsked)} to give this budget. Only{" "}
                        <span className="num font-medium text-ink">{usdPrecise(available)}</span> of
                        your <span className="num">{usdPrecise(balance)}</span> balance is
                        unallocated, the rest is already set aside for other keys and budgets.
                      </p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => setPoolLimit(String(Math.floor(available * 1e6) / 1e6))}
                        >
                          Use my maximum ({usdPrecise(available)})
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPoolCapped(false)}>
                          No limit, just group the keys
                        </Button>
                      </div>
                    </Callout>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Your shared budgets" icon={<Users size={15} />}>
        {poolsLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !poolList.length ? (
          <EmptyState
            icon={<Users size={19} />}
            title="No shared budgets yet"
            hint="Create one above, then pick it on any key to have that key draw on the shared amount."
          />
        ) : (
          <ul className="divide-y divide-line">
            {poolList.map((p) => {
              const spent = p.spend_limit_usd != null && p.spent_usd >= p.spend_limit_usd;
              return (
                <li key={p.id} className="px-5 sm:px-6 py-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                      spent ? "bg-warn/10 border-warn/25 text-warn" : "bg-accent/10 border-accent/20 text-accent-ink"
                    }`}>
                      <Users size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                        {spent
                          ? <Badge tone="warning">Used up</Badge>
                          : <Badge tone="success"><Check size={10} /> Active</Badge>}
                        {p.key_count != null && (
                          <Badge tone="neutral">{p.key_count} key{p.key_count === 1 ? "" : "s"}</Badge>
                        )}
                      </div>
                      <p className="text-2xs text-ink-3 mt-0.5 num">
                        Created {format(new Date(p.created_at), "MMM d, yyyy")}
                        {p.limit_reset_at && `, reset ${format(new Date(p.limit_reset_at), "MMM d")}`}
                      </p>
                      <PoolState p={p} />
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <IconButton label={`Edit ${p.name}`} size={34} onClick={() => setEditingPool(p)}>
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label={`Reset the counter on ${p.name}`}
                        size={34}
                        disabled={resetPool.isPending && resetPool.variables === p.id}
                        onClick={() => resetPool.mutate(p.id)}
                      >
                        <RotateCcw size={15} />
                      </IconButton>
                      <IconButton label={`Delete ${p.name}`} size={34} tone="danger" onClick={() => setDeletingPool(p)}>
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* ── Webhooks ───────────────────────────────────────────────────── */}

      <Panel title="Add a webhook" icon={<WebhookIcon size={15} />}>
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              placeholder="https://your-app.example.com/hooks/silkllm"
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              variant="primary"
              icon={<WebhookIcon size={15} />}
              disabled={!canCreateHook}
              loading={createHook.isPending}
              onClick={() => createHook.mutate()}
            >
              Add webhook
            </Button>
          </div>

          {hookUrl.trim() && !urlLooksValid && (
            <p className="text-xs text-danger">The URL must start with https.</p>
          )}

          <div className="rounded-xl border border-line bg-sunken p-4">
            <p className="text-xs font-medium text-ink-2 mb-2.5">Send me</p>
            {/* Each row is padded to a comfortable touch height. These labels
                carry no hint text, so without it the hit area is one line tall
                and the rows sit close enough together to mis-tap. */}
            <div className="grid sm:grid-cols-2 gap-x-4">
              {(events || []).map((ev) => (
                <Checkbox
                  key={ev}
                  className="py-3"
                  checked={hookEvents.includes(ev)}
                  onChange={(v) => setHookEvents(v ? [...hookEvents, ev] : hookEvents.filter((e) => e !== ev))}
                  label={<span className="font-mono text-xs">{ev}</span>}
                />
              ))}
            </div>
            {!events?.length && <p className="text-xs text-ink-3">Loading the event list.</p>}
          </div>
        </div>
      </Panel>

      <Panel title="Your webhooks" icon={<WebhookIcon size={15} />}>
        {hooksLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : !hookList.length ? (
          <EmptyState
            icon={<WebhookIcon size={19} />}
            title="No webhooks yet"
            hint="Add an https endpoint above to be told when a key or a shared budget reaches its limit."
          />
        ) : (
          <ul className="divide-y divide-line">
            {hookList.map((h) => (
              <li key={h.id} className="px-5 sm:px-6 py-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    !h.is_active ? "bg-ink/[0.04] border-line text-ink-3"
                      : h.consecutive_failures > 0 ? "bg-warn/10 border-warn/25 text-warn"
                      : "bg-accent/10 border-accent/20 text-accent-ink"
                  }`}>
                    <WebhookIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink truncate">{h.url}</span>
                      {!h.is_active
                        ? <Badge tone="neutral">Disabled</Badge>
                        : h.consecutive_failures > 0
                          ? <Badge tone="warning">{h.consecutive_failures} failure{h.consecutive_failures > 1 ? "s" : ""}</Badge>
                          : <Badge tone="success"><Check size={10} /> Healthy</Badge>}
                    </div>
                    <p className="text-2xs text-ink-3 mt-0.5">{h.events.join(", ")}</p>
                    {h.last_delivery_at && (
                      <p className="text-2xs text-ink-3 mt-0.5 num">
                        Last delivery {format(new Date(h.last_delivery_at), "MMM d, HH:mm")}
                        {h.last_status != null && `, answered ${h.last_status}`}
                        {h.last_error && `, ${h.last_error}`}
                      </p>
                    )}
                    {!h.is_active && (
                      <p className="text-2xs text-warn mt-1">
                        Switched off after repeated failures. Remove it and add it again once the endpoint is back.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <IconButton
                      label={`Send a test delivery to ${h.url}`}
                      size={34}
                      disabled={testHook.isPending && testHook.variables === h.id}
                      onClick={() => testHook.mutate(h.id)}
                    >
                      <Send size={15} />
                    </IconButton>
                    <IconButton label={`Remove ${h.url}`} size={34} tone="danger" onClick={() => setDeletingHook(h)}>
                      <Trash2 size={15} />
                    </IconButton>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Callout tone="info" icon={<WebhookIcon size={16} />} title="Verifying a delivery">
        <p>
          Every request carries <code className="mx-1 px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink font-mono">X-Silk-Signature</code>
          as <code className="mx-1 px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink font-mono">sha256=&lt;hex&gt;</code>,
          an HMAC of the exact bytes sent, keyed with the secret shown when you created the hook.
          Compare it with a constant-time function.
        </p>
        <pre className="mt-2 rounded-lg border border-line bg-sunken px-3 py-2.5 overflow-x-auto text-2xs font-mono text-ink-2 leading-relaxed">
{`import hmac, hashlib

def verify(secret: str, body: bytes, header: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header)`}
        </pre>
        <p className="mt-2">
          Deliveries are fire and forget, so a slow endpoint never delays a generation. A hook that
          fails ten times in a row is switched off and shown here as disabled.
        </p>
      </Callout>

      {/* One-time webhook secret */}
      <Modal
        open={!!createdHook}
        onClose={() => setCreatedHook(null)}
        title="Save your signing secret"
        description="This is the only time the secret is shown. Store it before closing, or remove the hook and add it again."
        icon={<AlertTriangle size={17} />}
        footer={<Button variant="primary" onClick={() => setCreatedHook(null)}>I have saved it</Button>}
      >
        {createdHook && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-ink-2 mb-1.5">Endpoint</p>
              <p className="text-sm text-ink break-all">{createdHook.url}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-2 mb-1.5">Signing secret</p>
              <div className="flex items-center gap-1 rounded-lg border border-line bg-sunken pl-3 pr-1 py-1">
                <code className="flex-1 min-w-0 text-xs font-mono text-ink truncate select-all">
                  {createdHook.secret}
                </code>
                <CopyButton value={createdHook.secret || ""} label="Copy secret" size={32} />
              </div>
            </div>
            <Callout tone="warning" icon={<AlertTriangle size={15} />}>
              Anyone with this secret can forge a delivery that looks like ours. Keep it with your
              other server-side credentials, not in client code.
            </Callout>
          </div>
        )}
      </Modal>

      <EditPoolDialog
        pool={editingPool}
        onClose={() => setEditingPool(null)}
        onSave={(data) => editingPool && updatePool.mutate({ id: editingPool.id, data })}
        saving={updatePool.isPending}
      />

      <ConfirmDialog
        open={!!deletingPool}
        onClose={() => setDeletingPool(null)}
        onConfirm={() => deletingPool && removePool.mutate(deletingPool.id)}
        title={`Delete "${deletingPool?.name}"?`}
        body="Keys attached to this budget keep working and fall back to their own caps. The spend history stays on each key. This cannot be undone."
        confirmLabel="Delete budget"
        pending={removePool.isPending}
      />

      <ConfirmDialog
        open={!!deletingHook}
        onClose={() => setDeletingHook(null)}
        onConfirm={() => deletingHook && removeHook.mutate(deletingHook.id)}
        title="Remove this webhook?"
        body="Deliveries stop immediately and the signing secret is discarded. Adding the endpoint again issues a new secret."
        confirmLabel="Remove webhook"
        pending={removeHook.isPending}
      />
    </DashboardLayout>
  );
}

/** Rename a shared budget, and change or remove its limit. */
function EditPoolDialog({ pool, onClose, onSave, saving }: {
  pool: Pool | null;
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [capped, setCapped] = useState(true);
  const [limit, setLimit] = useState("100");

  React.useEffect(() => {
    if (!pool) return;
    setName(pool.name);
    setCapped(pool.spend_limit_usd != null);
    setLimit(pool.spend_limit_usd != null ? String(pool.spend_limit_usd) : "100");
  }, [pool]);

  const valid = !capped || Number(limit) > 0;
  const alreadyPast = capped && pool ? Number(limit) <= pool.spent_usd : false;

  return (
    <Modal
      open={!!pool}
      onClose={onClose}
      title={`Edit "${pool?.name || ""}"`}
      icon={<Pencil size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!name.trim() || !valid}
            onClick={() => onSave({
              name: name.trim(),
              // Removing a limit is an explicit flag: the server cannot tell a
              // JSON null apart from a field that was simply not sent.
              ...(capped ? { spend_limit_usd: Number(limit) } : { clear_spend_limit: true }),
            })}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div className="rounded-xl border border-line bg-sunken p-4">
          <Checkbox
            checked={capped}
            onChange={setCapped}
            label="Limit total spend across the keys on this budget"
            hint="Turn this off to keep grouping the keys without stopping them."
          />
          {capped && (
            <div className="mt-4 pl-6 max-w-xs">
              <Field
                label="Shared limit (USD)"
                hint={pool ? `Already spent: ${usdPrecise(pool.spent_usd)}` : undefined}
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">$</span>
                  <Input
                    type="number" min="0.01" step="0.01" className="pl-7 num"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                </div>
              </Field>
            </div>
          )}
        </div>

        {alreadyPast && (
          <Callout tone="warning" icon={<AlertTriangle size={15} />}>
            This budget has already spent {usdPrecise(pool!.spent_usd)}, so every key on it stays
            blocked at this limit. Set a higher one, or reset the counter.
          </Callout>
        )}
      </div>
    </Modal>
  );
}

// EOF silkllm-frontend/src/pages/user/Budgets.tsx
