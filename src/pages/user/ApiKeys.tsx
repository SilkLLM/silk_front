/**
 * ApiKeys.tsx
 * Create, review and revoke API keys.
 *
 * The secret is shown exactly once, so that moment gets a modal rather than a
 * banner that can be scrolled past — the key cannot be recovered afterwards.
 */

// File: silkllm-frontend/src/pages/user/ApiKeys.tsx

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Eye, EyeOff, Key, Plus, Terminal, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { keysApi } from "@/services/api";
import {
  Badge, Button, Callout, ConfirmDialog, CopyButton, EmptyState, IconButton, Input,
  Modal, PageHeader, Panel, Skeleton,
} from "@/components/ui";

const STORAGE_KEY = "silk_stored_keys";

interface StoredKey { id: string; name: string; rawKey: string; createdAt: number }

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
  const masked = `${value.slice(0, 8)}${"•".repeat(24)}${value.slice(-4)}`;
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

export default function ApiKeys() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; name: string } | null>(null);
  const [stored, setStored] = useState<StoredKey[]>([]);

  useEffect(() => { setStored(getStoredKeys()); }, []);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => keysApi.list().then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: (n: string) => keysApi.create(n).then((r) => r.data),
    onSuccess: (data) => {
      setCreated({ key: data.key, name: data.name });
      storeKey({ id: data.id, name: data.name, rawKey: data.key, createdAt: Date.now() });
      setStored(getStoredKeys());
      setName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => toast.error("Could not create the key."),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => keysApi.revoke(id),
    onSuccess: (_d, id) => {
      toast.success("Key revoked.");
      removeStoredKey(id);
      setStored(getStoredKeys());
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => toast.error("Could not revoke the key."),
  });

  const active = (keys || []).filter((k: any) => k.is_active);

  return (
    <DashboardLayout>
      <PageHeader
        title="API Keys"
        subtitle="Each key carries the same permissions and balance as your account. Revoke one the moment it leaks."
        meta={
          keys ? (
            <>
              <Badge tone="neutral">{active.length} active</Badge>
              {keys.length > active.length && <Badge tone="warning">{keys.length - active.length} revoked</Badge>}
            </>
          ) : undefined
        }
      />

      <Panel title="Create a key" icon={<Plus size={15} />}>
        <div className="px-5 sm:px-6 py-5">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              placeholder="Name this key — e.g. Production, CI, Dev laptop"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) create.mutate(name.trim()); }}
              className="flex-1"
            />
            <Button
              variant="primary"
              disabled={!name.trim()}
              loading={create.isPending}
              onClick={() => create.mutate(name.trim())}
              icon={<Key size={15} />}
            >
              Create key
            </Button>
          </div>
          <p className="text-xs text-ink-3 mt-2.5">
            A descriptive name makes it obvious which key to revoke later.
          </p>
        </div>
      </Panel>

      <Panel title="Your keys" icon={<Key size={15} />}>
        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
          </div>
        ) : !keys?.length ? (
          <EmptyState
            icon={<Key size={19} />}
            title="No API keys yet"
            hint="Create one above, then pass it as a Bearer token to start making requests."
          />
        ) : (
          <ul className="divide-y divide-line">
            {keys.map((k: any) => {
              const local = stored.find((s) => s.id === k.id);
              return (
                <li key={k.id} className="flex items-center gap-3 px-5 sm:px-6 py-4">
                  <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                    k.is_active ? "bg-accent/10 border-accent/20 text-accent-ink" : "bg-ink/[0.04] border-line text-ink-3"
                  }`}>
                    <Key size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink truncate">{k.name}</span>
                      {k.is_active ? <Badge tone="success"><Check size={10} /> Active</Badge> : <Badge tone="neutral">Revoked</Badge>}
                    </div>
                    <p className="text-2xs text-ink-3 mt-0.5 num">
                      Created {format(new Date(k.created_at), "MMM d, yyyy")}
                      {k.last_used && ` · last used ${format(new Date(k.last_used), "MMM d")}`}
                    </p>
                  </div>
                  {local && k.is_active && (
                    <CopyButton value={local.rawKey} label="Copy key (saved in this browser)" size={34} />
                  )}
                  {k.is_active && (
                    <IconButton
                      label={`Revoke ${k.name}`}
                      size={34}
                      tone="danger"
                      onClick={() => setConfirming({ id: k.id, name: k.name })}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Callout tone="info" icon={<Terminal size={16} />} title="Using your key">
        <p>Send it as a Bearer token against a single endpoint — the gateway resolves the provider for you.</p>
        <pre className="mt-2 rounded-lg border border-line bg-sunken px-3 py-2.5 overflow-x-auto text-2xs font-mono text-ink-2 leading-relaxed">
{`curl https://silkllm.onrender.com/api/generate \\
  -H "Authorization: Bearer silk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}]}'`}
        </pre>
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
            <Callout tone="warning" icon={<AlertTriangle size={15} />}>
              Anyone with this key can spend your balance. It is also cached in this browser so the
              copy button keeps working — clear your site data to remove it.
            </Callout>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && revoke.mutate(confirming.id)}
        title={`Revoke “${confirming?.name}”?`}
        body="Any application still using this key will start failing immediately. This cannot be undone."
        confirmLabel="Revoke key"
        pending={revoke.isPending}
      />
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/ApiKeys.tsx
