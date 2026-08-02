/**
 * Models.tsx (admin)
 * The model catalogue: pricing, routing weight, fallback chains and availability.
 *
 * The previous version rendered every editable field for every model inline,
 * which made a hundred-model catalogue unreadable. Editing now happens in a
 * dialog, so the list stays a scannable table and a change is an explicit,
 * reviewable action rather than a stray keystroke.
 */

// File: silkllm-frontend/src/pages/admin/Models.tsx

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown, Cpu, Pencil, Plus, Settings, Trash2, X,
} from "lucide-react";
import toast from "react-hot-toast";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Modal,
  PageHeader, Panel, SearchInput, Select, Skeleton, StatTile, Switch, ToggleField, Toolbar,
} from "@/components/ui";

interface AdminModel {
  id: string;
  provider_id: string;
  display_name: string;
  enabled: boolean;
  is_free?: boolean;
  modality?: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  routing_weight: number;
  fallback_models?: string[];
  capabilities?: string[];
  context_window: number;
}

const BLANK = {
  id: "", provider_id: "", display_name: "", enabled: true,
  input_cost_per_1k: 0, output_cost_per_1k: 0, routing_weight: 1,
  fallback_models: "", capabilities: "", context_window: 4096,
};

type Draft = typeof BLANK;

const toDraft = (m: AdminModel): Draft => ({
  id: m.id,
  provider_id: m.provider_id,
  display_name: m.display_name,
  enabled: m.enabled,
  input_cost_per_1k: m.input_cost_per_1k,
  output_cost_per_1k: m.output_cost_per_1k,
  routing_weight: m.routing_weight,
  fallback_models: (m.fallback_models || []).join(", "),
  capabilities: (m.capabilities || []).join(", "),
  context_window: m.context_window,
});

const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Shared field set for both the create and edit dialogs. */
function ModelForm({ draft, setDraft, providerIds, isNew }: {
  draft: Draft; setDraft: (d: Draft) => void; providerIds: string[]; isNew: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Model ID" required hint={isNew ? "Exactly as the provider expects it in API calls." : "Immutable once created."}>
          <Input
            className="font-mono"
            placeholder="gpt-4o-mini"
            value={draft.id}
            disabled={!isNew}
            onChange={(e) => setDraft({ ...draft, id: e.target.value.trim() })}
          />
        </Field>
        <Field label="Provider" required>
          <Select
            value={draft.provider_id}
            disabled={!isNew}
            onChange={(e) => setDraft({ ...draft, provider_id: e.target.value })}
          >
            <option value="">Select a provider</option>
            {providerIds.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Display name" required hint="What users see in the model picker.">
        <Input
          placeholder="GPT-4o Mini"
          value={draft.display_name}
          onChange={(e) => setDraft({ ...draft, display_name: e.target.value })}
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Input cost ($ / 1K tokens)">
          <Input
            type="number" step="0.000001" min="0" className="num"
            value={draft.input_cost_per_1k}
            onChange={(e) => setDraft({ ...draft, input_cost_per_1k: parseFloat(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Output cost ($ / 1K tokens)">
          <Input
            type="number" step="0.000001" min="0" className="num"
            value={draft.output_cost_per_1k}
            onChange={(e) => setDraft({ ...draft, output_cost_per_1k: parseFloat(e.target.value) || 0 })}
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Routing weight" hint="Higher wins when a provider is chosen without a model.">
          <Input
            type="number" min="0" max="100" className="num"
            value={draft.routing_weight}
            onChange={(e) => setDraft({ ...draft, routing_weight: parseInt(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Context window (tokens)">
          <Input
            type="number" min="1" className="num"
            value={draft.context_window}
            onChange={(e) => setDraft({ ...draft, context_window: parseInt(e.target.value) || 0 })}
          />
        </Field>
      </div>

      <Field label="Fallback models" hint="Comma-separated model IDs, tried in order when this one fails.">
        <Input
          className="font-mono text-xs"
          placeholder="gpt-3.5-turbo, claude-3-haiku"
          value={draft.fallback_models}
          onChange={(e) => setDraft({ ...draft, fallback_models: e.target.value })}
        />
      </Field>

      <Field label="Capabilities" hint="Comma-separated, e.g. chat, function-calling, vision.">
        <Input
          className="font-mono text-xs"
          placeholder="chat, vision"
          value={draft.capabilities}
          onChange={(e) => setDraft({ ...draft, capabilities: e.target.value })}
        />
      </Field>

      <div className="rounded-xl border border-line bg-sunken px-4 py-3.5">
        <ToggleField
          checked={draft.enabled}
          onChange={(v) => setDraft({ ...draft, enabled: v })}
          title="Available to users"
          description="Disabled models are hidden from the picker and never routed to."
          stateLabels={["Enabled", "Disabled"]}
        />
      </div>
    </div>
  );
}

export default function AdminModels() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [editing, setEditing] = useState<AdminModel | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(BLANK);
  const [confirming, setConfirming] = useState<AdminModel | null>(null);

  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [modality, setModality] = useState("all");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: models, isLoading } = useQuery<AdminModel[]>({
    queryKey: ["admin-models"],
    queryFn: () => adminApi.models.list().then((r) => r.data),
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.models.update(id, data),
    onSuccess: () => { toast.success("Model updated."); qc.invalidateQueries({ queryKey: ["admin-models"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Update failed."),
  });

  /**
   * Availability gets its own mutation with an optimistic write, so the switch
   * moves on click instead of waiting for the refetch. See the matching comment
   * on the Providers page.
   */
  const toggleEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      adminApi.models.update(id, { enabled }),
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["admin-models"] });
      const previous = qc.getQueryData<AdminModel[]>(["admin-models"]);
      qc.setQueryData<AdminModel[]>(["admin-models"], (old) =>
        (old || []).map((m) => (m.id === id ? { ...m, enabled } : m)),
      );
      return { previous };
    },
    onError: (e: any, _vars, ctx) => {
      qc.setQueryData(["admin-models"], ctx?.previous);
      toast.error(e.response?.data?.detail || "Could not change the model.");
    },
    onSuccess: (_d, { enabled }) => {
      toast.success(enabled ? "Model enabled and routable." : "Model disabled and hidden from users.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["admin-models"] }),
  });

  const create = useMutation({
    mutationFn: (data: any) => adminApi.models.create(data),
    onSuccess: () => {
      toast.success("Model created.");
      qc.invalidateQueries({ queryKey: ["admin-models"] });
      setAddOpen(false);
      setDraft(BLANK);
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Could not create the model."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.models.delete(id),
    onSuccess: () => { toast.success("Model deleted."); qc.invalidateQueries({ queryKey: ["admin-models"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Could not delete the model."),
  });

  const all = models || [];
  const providerIds = useMemo(
    () => Array.from(new Set(all.map((m) => String(m.provider_id)))).sort(),
    [all],
  );

  const q = search.trim().toLowerCase();
  const filtersActive = !!q || provider !== "all" || modality !== "all" || tier !== "all" || status !== "all";

  const filtered = useMemo(() => all.filter((m) => {
    if (provider !== "all" && m.provider_id !== provider) return false;
    if (modality !== "all" && (m.modality || "text") !== modality) return false;
    if (tier === "free" && !m.is_free) return false;
    if (tier === "paid" && m.is_free) return false;
    if (status === "enabled" && !m.enabled) return false;
    if (status === "disabled" && m.enabled) return false;
    if (q && !`${m.display_name} ${m.id}`.toLowerCase().includes(q)) return false;
    return true;
  }), [all, provider, modality, tier, status, q]);

  const grouped = useMemo(() => {
    const map: Record<string, AdminModel[]> = {};
    for (const m of filtered) (map[m.provider_id] ||= []).push(m);
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.display_name.localeCompare(b.display_name));
    return map;
  }, [filtered]);

  const groupKeys = Object.keys(grouped).sort();

  const openEdit = (m: AdminModel) => { setEditing(m); setEditDraft(toDraft(m)); };

  const clearFilters = () => {
    setSearch(""); setProvider("all"); setModality("all"); setTier("all"); setStatus("all");
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Model Control"
        subtitle="Pricing, routing weight and fallback chains for every model the gateway can reach."
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => { setDraft(BLANK); setAddOpen(true); }}>
            Add model
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Models" value={all.length} icon={<Cpu size={14} />} hint={`${all.filter((m) => m.enabled).length} enabled`} />
        <StatTile label="Providers" value={providerIds.length} icon={<Settings size={14} />} />
        <StatTile label="Free models" value={all.filter((m) => m.is_free).length} icon={<Cpu size={14} />} hint="No cost to serve" />
        <StatTile label="Multimodal" value={all.filter((m) => (m.modality || "text") !== "text").length} icon={<Cpu size={14} />} hint="Image, audio, video" />
      </div>

      {/* Filters - one row above the content they filter. */}
      <Panel>
        <div className="px-5 sm:px-6 py-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <SearchInput value={search} onChange={setSearch} placeholder="Search by name or model ID" />
            </div>
            <Select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Provider">
              <option value="all">All providers</option>
              {providerIds.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select value={modality} onChange={(e) => setModality(e.target.value)} aria-label="Modality">
              <option value="all">All modalities</option>
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="video">Video</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="all">All statuses</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </Select>
          </div>

          <Toolbar className="justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={tier} onChange={(e) => setTier(e.target.value)} className="h-8 text-xs w-auto" aria-label="Tier">
                <option value="all">All tiers</option>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
              </Select>
              <span className="text-xs text-ink-3 num">
                Showing {filtered.length} of {all.length}
              </span>
              {filtersActive && (
                <button onClick={clearFilters} className="text-xs text-accent-ink hover:underline inline-flex items-center gap-1 h-8 px-1">
                  <X size={12} /> Clear filters
                </button>
              )}
            </div>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setCollapsed({})} className="inline-flex items-center h-8 px-2 rounded text-accent-ink hover:underline">Expand all</button>
              <button
                onClick={() => setCollapsed(Object.fromEntries(groupKeys.map((k) => [k, true])))}
                className="inline-flex items-center h-8 px-2 rounded text-accent-ink hover:underline"
              >
                Collapse all
              </button>
            </div>
          </Toolbar>
        </div>
      </Panel>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>
      ) : !groupKeys.length ? (
        <Panel>
          <EmptyState
            icon={<Cpu size={19} />}
            title={all.length ? "No models match these filters" : "No models configured"}
            hint={all.length ? "Try widening the search or clearing the filters." : "Add a model to make it routable."}
            action={all.length
              ? <Button size="sm" onClick={clearFilters}>Clear filters</Button>
              : <Button size="sm" variant="primary" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>Add model</Button>}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {groupKeys.map((pid) => {
            const list = grouped[pid];
            const isCollapsed = !!collapsed[pid];
            const free = list.filter((m) => m.is_free).length;

            return (
              <section key={pid} className="card overflow-hidden">
                <button
                  onClick={() => setCollapsed((c) => ({ ...c, [pid]: !c[pid] }))}
                  aria-expanded={!isCollapsed}
                  className="w-full flex items-center gap-3 px-5 sm:px-6 py-3.5 text-left hover:bg-sunken transition-colors border-b border-line"
                >
                  <ChevronDown size={16} className={clsx("text-ink-3 shrink-0 transition-transform", isCollapsed && "-rotate-90")} />
                  <span className="text-sm font-semibold text-ink capitalize">{pid}</span>
                  <Badge tone="neutral">{list.length}</Badge>
                  {free > 0 && <Badge tone="success">{free} free</Badge>}
                  <span className="ml-auto text-xs text-ink-3 num">
                    {list.filter((m) => m.enabled).length} enabled
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="scroll-x">
                    <table className="table-shell">
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th className="text-right">Input / 1K</th>
                          <th className="text-right">Output / 1K</th>
                          <th className="text-right">Weight</th>
                          <th className="text-right">Context</th>
                          <th>Fallbacks</th>
                          <th>Availability</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((m) => (
                          <tr key={m.id} className={clsx(!m.enabled && "opacity-60")}>
                            <td>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-ink font-medium">{m.display_name}</span>
                                {m.is_free && <Badge tone="success">Free</Badge>}
                                {m.modality && m.modality !== "text" && <Badge tone="neutral">{m.modality}</Badge>}
                              </div>
                              <p className="text-2xs font-mono text-ink-3 mt-0.5 truncate max-w-[220px]">{m.id}</p>
                            </td>
                            <td className="text-right num text-xs text-ink-2">${m.input_cost_per_1k.toFixed(6)}</td>
                            <td className="text-right num text-xs text-ink-2">${m.output_cost_per_1k.toFixed(6)}</td>
                            <td className="text-right num text-xs text-ink-2">{m.routing_weight}</td>
                            <td className="text-right num text-xs text-ink-2">
                              {m.context_window ? m.context_window.toLocaleString() : "-"}
                            </td>
                            <td className="text-xs text-ink-3 font-mono max-w-[180px] truncate">
                              {(m.fallback_models || []).join(", ") || "-"}
                            </td>
                            <td>
                              <Switch
                                size="sm"
                                checked={m.enabled}
                                stateLabels={["Enabled", "Disabled"]}
                                label={`${m.display_name} availability`}
                                pending={toggleEnabled.isPending && toggleEnabled.variables?.id === m.id}
                                onChange={(enabled) => toggleEnabled.mutate({ id: m.id, enabled })}
                              />
                            </td>
                            <td>
                              <div className="flex items-center justify-end gap-0.5">
                                <IconButton label={`Edit ${m.display_name}`} size={32} onClick={() => openEdit(m)}>
                                  <Pencil size={14} />
                                </IconButton>
                                <IconButton label={`Delete ${m.display_name}`} size={32} tone="danger" onClick={() => setConfirming(m)}>
                                  <Trash2 size={14} />
                                </IconButton>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Create */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add a model"
        description="The ID must match what the provider expects - the router passes it through verbatim."
        icon={<Plus size={17} />}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={!draft.id || !draft.provider_id || !draft.display_name}
              onClick={() => create.mutate({
                ...draft,
                fallback_models: csv(draft.fallback_models),
                capabilities: csv(draft.capabilities),
              })}
            >
              Create model
            </Button>
          </>
        }
      >
        <ModelForm draft={draft} setDraft={setDraft} providerIds={providerIds} isNew />
      </Modal>

      {/* Edit */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit ${editing?.display_name || "model"}`}
        description="Changes take effect on the next request routed to this model."
        icon={<Pencil size={17} />}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={update.isPending}
              onClick={() => {
                if (!editing) return;
                update.mutate({
                  id: editing.id,
                  data: {
                    display_name: editDraft.display_name,
                    enabled: editDraft.enabled,
                    input_cost_per_1k: editDraft.input_cost_per_1k,
                    output_cost_per_1k: editDraft.output_cost_per_1k,
                    routing_weight: editDraft.routing_weight,
                    context_window: editDraft.context_window,
                    fallback_models: csv(editDraft.fallback_models),
                    capabilities: csv(editDraft.capabilities),
                  },
                });
                setEditing(null);
              }}
            >
              Save changes
            </Button>
          </>
        }
      >
        <ModelForm draft={editDraft} setDraft={setEditDraft} providerIds={providerIds} isNew={false} />
      </Modal>

      <ConfirmDialog
        open={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && remove.mutate(confirming.id)}
        title={`Delete "${confirming?.display_name}"?`}
        body="Requests naming this model will fail, and any fallback chain pointing at it will skip it. This cannot be undone."
        confirmLabel="Delete model"
        pending={remove.isPending}
      />
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Models.tsx
