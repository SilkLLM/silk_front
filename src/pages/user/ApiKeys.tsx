/**
 * ApiKeys.tsx
 * Create, cap, audit and revoke API keys.
 *
 * The spend cap is the reason this page is more than a list. A key can be given
 * a ceiling, and every key carries its own request history, so a developer can
 * hand one key to a side project, cap it at $5, and see exactly what it did.
 *
 * The secret is shown exactly once, so that moment gets a modal rather than a
 * banner that can be scrolled past - the key cannot be recovered afterwards.
 */

// File: silkllm-frontend/src/pages/user/ApiKeys.tsx

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Check, Eye, EyeOff, History, Key, Pencil, Plus, RotateCcw,
  Terminal, Trash2, Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { keysApi } from "@/services/api";
import {
  Badge, Button, Callout, Checkbox, ConfirmDialog, CopyButton, EmptyState, Field,
  IconButton, Input, Meter, Modal, PageHeader, Pagination, Panel, SegmentedControl,
  Skeleton, StatTile,
} from "@/components/ui";
import { compact, usdPrecise } from "@/lib/charts";

const STORAGE_KEY = "silk_stored_keys";

interface StoredKey { id: string; name: string; rawKey: string; createdAt: number }

interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used: string | null;
  is_active: boolean;
  spend_limit_usd: number | null;
  spent_usd: number;
  remaining_usd: number | null;
  is_exhausted: boolean;
  limit_reset_at: string | null;
}

function getStoredKeys(): StoredKey[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function storeKey(key: StoredKey) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...getStoredKeys(), key]));
}
function removeStoredKey(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getStoredKeys().filter((k) => k.id !== id)));
}

/** The secret, revealed once, with copy and a masked default. */
function SecretReveal({ value }: { value: string }) {
  const [shown, setShown] = useState(false);
  const masked = `${value.slice(0, 8)}${"*".repeat(24)}${value.slice(-4)}`;
  return (
    <div className="flex items-center gap-1 rounded-lg border border-line bg-sunken pl-3 pr-1 py-1">
      <code className="flex-1 min-w-0 text-xs font-mono text-ink truncate select-all">
        {shown ? value : masked}
      </code>
      <IconButton label={shown ? "Hide key" : "Show key"} size={32} onClick={() => setShown((s) => !s)}>
        {shown ? <EyeOff size={14} /> : <Eye size={14} />}
      </IconButton>
      <CopyButton value={value} label="Copy key" size={32} />
    </div>
  );
}

/** How much of its cap a key has used. Uncapped keys show spend without a bar. */
function SpendState({ k }: { k: ApiKey }) {
  if (k.spend_limit_usd == null) {
    return (
      <p className="text-2xs text-ink-3 num mt-1">
        {usdPrecise(k.spent_usd)} spent, no cap
      </p>
    );
  }
  const pct = Math.min(100, (k.spent_usd / k.spend_limit_usd) * 100);
  const tone = k.is_exhausted ? "danger" : pct >= 80 ? "warn" : "accent";
  return (
    <div className="mt-2 max-w-xs">
      <Meter value={pct} tone={tone} size="sm" />
      <p className="text-2xs text-ink-3 num mt-1.5">
        {usdPrecise(k.spent_usd)} of ${k.spend_limit_usd.toFixed(2)} used
        {!k.is_exhausted && k.remaining_usd !== null && `, ${usdPrecise(k.remaining_usd)} left`}
      </p>
    </div>
  );
}

const STATUS_TONE: Record<string, "success" | "warning" | "error" | "neutral"> = {
  ok: "success",
  limit_exceeded: "warning",
  insufficient_balance: "warning",
  provider_error: "error",
};

/** Per-key request history, including attempts that were refused. */
function UsageDialog({ keyRow, onClose }: { keyRow: ApiKey | null; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"" | "ok" | "limit_exceeded">("");

  useEffect(() => { setPage(1); }, [keyRow?.id, filter]);

  const { data, isLoading } = useQuery({
    queryKey: ["key-usage", keyRow?.id, page, filter],
    queryFn: () => keysApi.usage(keyRow!.id, page, 25, filter || undefined).then((r) => r.data),
    enabled: !!keyRow,
  });

  const entries = data?.entries || [];
  const totalPages = data?.total ? Math.max(1, Math.ceil(data.total / (data.page_size || 25))) : 1;

  return (
    <Modal
      open={!!keyRow}
      onClose={onClose}
      title={`Activity for "${keyRow?.name || ""}"`}
      description="Every request this key made, newest first. Refused attempts are included."
      icon={<History size={17} />}
      size="lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div>
          <p className="text-2xs text-ink-3 uppercase tracking-wide">Requests</p>
          <p className="text-sm font-medium text-ink num mt-0.5">{compact(data?.total_requests ?? 0)}</p>
        </div>
        <div>
          <p className="text-2xs text-ink-3 uppercase tracking-wide">Total spend</p>
          <p className="text-sm font-medium text-ink num mt-0.5">{usdPrecise(data?.total_cost_usd ?? 0)}</p>
        </div>
        <div>
          <p className="text-2xs text-ink-3 uppercase tracking-wide">Prompt tokens</p>
          <p className="text-sm font-medium text-ink num mt-0.5">{compact(data?.total_prompt_tokens ?? 0)}</p>
        </div>
        <div>
          <p className="text-2xs text-ink-3 uppercase tracking-wide">Output tokens</p>
          <p className="text-sm font-medium text-ink num mt-0.5">{compact(data?.total_completion_tokens ?? 0)}</p>
        </div>
      </div>

      <div className="mb-4">
        <SegmentedControl
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "", label: "All" },
            { value: "ok", label: "Served" },
            { value: "limit_exceeded", label: "Refused" },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
      ) : !entries.length ? (
        <EmptyState
          icon={<History size={19} />}
          title="Nothing recorded yet"
          hint={filter ? "No entries match this filter." : "Requests made with this key will appear here."}
        />
      ) : (
        <>
          <div className="rounded-lg border border-line overflow-hidden">
            <div className="scroll-x">
              <table className="table-shell">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th className="text-right">Tokens</th>
                    <th className="text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e: any) => (
                    <tr key={e.id}>
                      <td className="text-2xs text-ink-2 num whitespace-nowrap">
                        {format(new Date(e.created_at), "MMM d, HH:mm:ss")}
                      </td>
                      <td className="max-w-[180px]">
                        <p className="text-xs text-ink truncate">{e.served_model || e.requested_model || "n/a"}</p>
                        <p className="text-2xs text-ink-3 truncate">{e.provider_id || e.endpoint}</p>
                      </td>
                      <td>
                        <Badge tone={STATUS_TONE[e.status] || "neutral"}>
                          {e.status === "ok" ? "Served" : e.status.replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="text-right num text-2xs text-ink-2">
                        {(e.prompt_tokens + e.completion_tokens).toLocaleString()}
                      </td>
                      <td className="text-right num text-2xs text-ink">{usdPrecise(e.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination page={page} totalPages={totalPages} total={data?.total} onPage={setPage} unit="entries" />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export default function ApiKeys() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [capEnabled, setCapEnabled] = useState(false);
  const [cap, setCap] = useState("10");
  const [created, setCreated] = useState<{ key: string; name: string; limit: number | null } | null>(null);
  const [confirming, setConfirming] = useState<ApiKey | null>(null);
  const [editing, setEditing] = useState<ApiKey | null>(null);
  const [viewing, setViewing] = useState<ApiKey | null>(null);
  const [stored, setStored] = useState<StoredKey[]>([]);

  useEffect(() => { setStored(getStoredKeys()); }, []);

  const { data: keys, isLoading } = useQuery<ApiKey[]>({
    queryKey: ["api-keys"],
    queryFn: () => keysApi.list().then((r) => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["api-keys"] });

  const create = useMutation({
    mutationFn: () => keysApi.create(name.trim(), capEnabled ? Number(cap) : undefined).then((r) => r.data),
    onSuccess: (data) => {
      setCreated({ key: data.key, name: data.name, limit: data.spend_limit_usd });
      storeKey({ id: data.id, name: data.name, rawKey: data.key, createdAt: Date.now() });
      setStored(getStoredKeys());
      setName("");
      setCapEnabled(false);
      setCap("10");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Could not create the key."),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => keysApi.update(id, data),
    onSuccess: () => { toast.success("Key updated."); setEditing(null); invalidate(); },
    onError: (e: any) => toast.error(e?.response?.data?.detail || "Could not update the key."),
  });

  const reset = useMutation({
    mutationFn: (id: string) => keysApi.reset(id).then((r) => r.data),
    onSuccess: (data) => { toast.success(data.message); invalidate(); },
    onError: () => toast.error("Could not reset the counter."),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => keysApi.revoke(id),
    onSuccess: (_d, id) => {
      toast.success("Key revoked.");
      removeStoredKey(id);
      setStored(getStoredKeys());
      invalidate();
    },
    onError: () => toast.error("Could not revoke the key."),
  });

  const list = keys || [];
  const active = list.filter((k) => k.is_active);
  const capped = active.filter((k) => k.spend_limit_usd != null);
  const exhausted = active.filter((k) => k.is_exhausted);
  const totalSpent = list.reduce((s, k) => s + (k.spent_usd || 0), 0);

  return (
    <DashboardLayout>
      <PageHeader
        title="API Keys"
        subtitle="Each key draws on the same account balance. Give a key a spend cap and it stops at that amount, while your other keys carry on."
        meta={
          keys ? (
            <>
              <Badge tone="neutral">{active.length} active</Badge>
              {capped.length > 0 && <Badge tone="brand">{capped.length} capped</Badge>}
              {exhausted.length > 0 && <Badge tone="warning">{exhausted.length} at limit</Badge>}
            </>
          ) : undefined
        }
      />

      {list.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile label="Active keys" value={active.length} icon={<Key size={14} />} hint={`${list.length} total`} />
          <StatTile label="Spend on record" value={usdPrecise(totalSpent)} icon={<Wallet size={14} />} accent hint="Across all keys" />
          <StatTile label="Capped keys" value={capped.length} icon={<AlertTriangle size={14} />} hint={`${active.length - capped.length} uncapped`} />
          <StatTile label="At their limit" value={exhausted.length} icon={<AlertTriangle size={14} />} hint={exhausted.length ? "Raise or reset to resume" : "None blocked"} />
        </div>
      )}

      {exhausted.length > 0 && (
        <Callout tone="warning" icon={<AlertTriangle size={17} />} title={`${exhausted.length} key${exhausted.length > 1 ? "s have" : " has"} reached its limit`}>
          <p>
            {exhausted.map((k) => k.name).join(", ")} will refuse requests until you raise the cap or
            reset the counter. Your balance is unaffected and your other keys keep working.
          </p>
        </Callout>
      )}

      <Panel title="Create a key" icon={<Plus size={15} />}>
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              placeholder="Name this key, e.g. Production, CI, Side project"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) create.mutate(); }}
              className="flex-1"
            />
            <Button
              variant="primary"
              disabled={!name.trim() || (capEnabled && !(Number(cap) > 0))}
              loading={create.isPending}
              onClick={() => create.mutate()}
              icon={<Key size={15} />}
            >
              Create key
            </Button>
          </div>

          <div className="rounded-xl border border-line bg-sunken p-4">
            <Checkbox
              checked={capEnabled}
              onChange={setCapEnabled}
              label="Cap what this key can spend"
              hint="The key stops working once it reaches this much spend. Leave off for a key that can use the whole balance."
            />
            {capEnabled && (
              <div className="mt-4 pl-6 max-w-xs">
                <Field label="Spend limit (USD)" hint="You can raise, lower or remove this at any time.">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">$</span>
                    <Input
                      type="number" min="0.01" step="0.01" className="pl-7 num"
                      value={cap}
                      onChange={(e) => setCap(e.target.value)}
                    />
                  </div>
                </Field>
              </div>
            )}
          </div>
        </div>
      </Panel>

      <Panel title="Your keys" icon={<Key size={15} />}>
        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !list.length ? (
          <EmptyState
            icon={<Key size={19} />}
            title="No API keys yet"
            hint="Create one above, then pass it as a Bearer token to start making requests."
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((k) => {
              const local = stored.find((s) => s.id === k.id);
              return (
                <li key={k.id} className="px-5 sm:px-6 py-4">
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className={clsx(
                      "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                      !k.is_active ? "bg-ink/[0.04] border-line text-ink-3"
                        : k.is_exhausted ? "bg-warn/10 border-warn/25 text-warn"
                        : "bg-accent/10 border-accent/20 text-accent-ink",
                    )}>
                      <Key size={16} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-ink truncate">{k.name}</span>
                        {!k.is_active
                          ? <Badge tone="neutral">Revoked</Badge>
                          : k.is_exhausted
                            ? <Badge tone="warning">At limit</Badge>
                            : <Badge tone="success"><Check size={10} /> Active</Badge>}
                        {k.spend_limit_usd != null && (
                          <Badge tone="brand">${k.spend_limit_usd.toFixed(2)} cap</Badge>
                        )}
                      </div>
                      <p className="text-2xs text-ink-3 mt-0.5 num">
                        Created {format(new Date(k.created_at), "MMM d, yyyy")}
                        {k.last_used && `, last used ${format(new Date(k.last_used), "MMM d")}`}
                        {k.limit_reset_at && `, reset ${format(new Date(k.limit_reset_at), "MMM d")}`}
                      </p>
                      {k.is_active && <SpendState k={k} />}
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <IconButton label={`Activity for ${k.name}`} size={34} onClick={() => setViewing(k)}>
                        <History size={15} />
                      </IconButton>
                      {k.is_active && (
                        <>
                          <IconButton label={`Edit ${k.name}`} size={34} onClick={() => setEditing(k)}>
                            <Pencil size={15} />
                          </IconButton>
                          {k.spend_limit_usd != null && (
                            <IconButton
                              label={`Reset the counter on ${k.name}`}
                              size={34}
                              disabled={reset.isPending && reset.variables === k.id}
                              onClick={() => reset.mutate(k.id)}
                            >
                              <RotateCcw size={15} />
                            </IconButton>
                          )}
                          {local && <CopyButton value={local.rawKey} label="Copy key (saved in this browser)" size={34} />}
                          <IconButton label={`Revoke ${k.name}`} size={34} tone="danger" onClick={() => setConfirming(k)}>
                            <Trash2 size={15} />
                          </IconButton>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Callout tone="info" icon={<Terminal size={16} />} title="Using your key">
        <p>Send it as a Bearer token against a single endpoint. The gateway resolves the provider for you.</p>
        <pre className="mt-2 rounded-lg border border-line bg-sunken px-3 py-2.5 overflow-x-auto text-2xs font-mono text-ink-2 leading-relaxed">
{`curl https://silkllm-backend.169.58.53.167.nip.io/api/generate \\
  -H "Authorization: Bearer silk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}]}'`}
        </pre>
        <p className="mt-2">
          A key that has reached its cap answers with HTTP 402 and the code
          <code className="mx-1 px-1.5 py-0.5 rounded bg-ink/[0.06] text-accent-ink font-mono">key_limit_exceeded</code>
          so your application can tell a spent key apart from an empty account.
        </p>
      </Callout>

      {/* One-time secret */}
      <Modal
        open={!!created}
        onClose={() => setCreated(null)}
        title="Save your API key"
        description="This is the only time the full key is shown. Store it somewhere safe before closing."
        icon={<AlertTriangle size={17} />}
        footer={<Button variant="primary" onClick={() => setCreated(null)}>I have saved it</Button>}
      >
        {created && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-ink-2 mb-1.5">Key name</p>
              <p className="text-sm text-ink">{created.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-2 mb-1.5">Secret</p>
              <SecretReveal value={created.key} />
            </div>
            {created.limit != null && (
              <p className="text-xs text-ink-2">
                Capped at <span className="num font-medium text-ink">${created.limit.toFixed(2)}</span>.
                It will stop working once it has spent that much.
              </p>
            )}
            <Callout tone="warning" icon={<AlertTriangle size={15} />}>
              Anyone with this key can spend against your balance, up to its cap. It is also cached in
              this browser so the copy button keeps working; clear your site data to remove it.
            </Callout>
          </div>
        )}
      </Modal>

      {/* Edit */}
      <EditDialog
        keyRow={editing}
        onClose={() => setEditing(null)}
        onSave={(data) => editing && update.mutate({ id: editing.id, data })}
        saving={update.isPending}
      />

      <UsageDialog keyRow={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && revoke.mutate(confirming.id)}
        title={`Revoke "${confirming?.name}"?`}
        body="Any application still using this key will start failing immediately. Its usage history is kept for audit. This cannot be undone."
        confirmLabel="Revoke key"
        pending={revoke.isPending}
      />
    </DashboardLayout>
  );
}

/** Rename a key, and set, change or remove its cap. */
function EditDialog({ keyRow, onClose, onSave, saving }: {
  keyRow: ApiKey | null;
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const [capEnabled, setCapEnabled] = useState(false);
  const [cap, setCap] = useState("10");

  useEffect(() => {
    if (!keyRow) return;
    setName(keyRow.name);
    setCapEnabled(keyRow.spend_limit_usd != null);
    setCap(keyRow.spend_limit_usd != null ? String(keyRow.spend_limit_usd) : "10");
  }, [keyRow]);

  const capValid = !capEnabled || Number(cap) > 0;
  const wouldStillBeExhausted =
    capEnabled && keyRow ? Number(cap) <= keyRow.spent_usd : false;

  return (
    <Modal
      open={!!keyRow}
      onClose={onClose}
      title={`Edit "${keyRow?.name || ""}"`}
      icon={<Pencil size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!name.trim() || !capValid}
            onClick={() => onSave({
              name: name.trim(),
              // Removing a cap is an explicit flag: a JSON null cannot be told
              // apart from an omitted field on the server.
              ...(capEnabled ? { spend_limit_usd: Number(cap) } : { clear_spend_limit: true }),
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
            checked={capEnabled}
            onChange={setCapEnabled}
            label="Cap what this key can spend"
            hint="Turn this off to let the key use the whole account balance."
          />
          {capEnabled && (
            <div className="mt-4 pl-6 max-w-xs">
              <Field
                label="Spend limit (USD)"
                hint={keyRow ? `Already spent: ${usdPrecise(keyRow.spent_usd)}` : undefined}
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">$</span>
                  <Input
                    type="number" min="0.01" step="0.01" className="pl-7 num"
                    value={cap}
                    onChange={(e) => setCap(e.target.value)}
                  />
                </div>
              </Field>
            </div>
          )}
        </div>

        {wouldStillBeExhausted && (
          <Callout tone="warning" icon={<AlertTriangle size={15} />}>
            This key has already spent {usdPrecise(keyRow!.spent_usd)}, so a cap of ${Number(cap).toFixed(2)}
            {" "}leaves it blocked. Set a higher cap, or reset its counter to start the budget again.
          </Callout>
        )}
      </div>
    </Modal>
  );
}

// EOF silkllm-frontend/src/pages/user/ApiKeys.tsx
