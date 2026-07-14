/**
 * Models.tsx
 * Admin page - full CRUD for models: enable/disable, edit pricing, fallback chains, add new, delete.
 */

// File: silkllm-frontend/src/pages/admin/Models.tsx

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ToggleLeft, ToggleRight, Save, Plus, Trash2, X, ChevronDown, ChevronRight, Search } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";

export default function AdminModels() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newModel, setNewModel] = useState({
    id: "",
    provider_id: "",
    display_name: "",
    enabled: true,
    input_cost_per_1k: 0,
    output_cost_per_1k: 0,
    routing_weight: 1,
    fallback_models: "",
    capabilities: "",
    context_window: 4096,
  });

  // Filters and per-provider collapse state
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [modalityFilter, setModalityFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { data: models, isLoading } = useQuery({
    queryKey: ["admin-models"],
    queryFn: () => adminApi.models.list().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.models.update(id, data),
    onSuccess: () => { toast.success("Model updated"); qc.invalidateQueries({ queryKey: ["admin-models"] }); },
    onError: () => toast.error("Update failed"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => adminApi.models.create(data),
    onSuccess: () => {
      toast.success("Model created");
      qc.invalidateQueries({ queryKey: ["admin-models"] });
      setShowAddForm(false);
      setNewModel({
        id: "", provider_id: "", display_name: "", enabled: true,
        input_cost_per_1k: 0, output_cost_per_1k: 0, routing_weight: 1,
        fallback_models: "", capabilities: "", context_window: 4096,
      });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Creation failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.models.delete(id),
    onSuccess: () => {
      toast.success("Model deleted");
      qc.invalidateQueries({ queryKey: ["admin-models"] });
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Deletion failed"),
  });

  const toggleModel = (id: string, current: boolean) =>
    updateMutation.mutate({ id, data: { enabled: !current } });

  const saveEdits = (id: string) => {
    if (!editing[id]) return;
    updateMutation.mutate({ id, data: editing[id] });
    setEditing(e => { const n = { ...e }; delete n[id]; return n; });
  };

  const setEdit = (id: string, field: string, value: any) =>
    setEditing(e => ({ ...e, [id]: { ...(e[id] || {}), [field]: value } }));

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Delete model "${name}"? This action cannot be undone.`)) {
      deleteMutation.mutate(id);
    }
  };

  // Full provider list (unfiltered) used for the add-model dropdown and the filter select
  const providerIds: string[] = Array.from(
    new Set(((models as any[]) || []).map((m: any) => String(m.provider_id)))
  ).sort();

  // Apply the active filters before grouping
  const q = search.trim().toLowerCase();
  const filtersActive =
    !!q || providerFilter !== "all" || modalityFilter !== "all" || tierFilter !== "all" || statusFilter !== "all";
  const filtered = (models || []).filter((m: any) => {
    if (providerFilter !== "all" && m.provider_id !== providerFilter) return false;
    const mod = m.modality || "text";
    if (modalityFilter !== "all" && mod !== modalityFilter) return false;
    if (tierFilter === "free" && !m.is_free) return false;
    if (tierFilter === "paid" && m.is_free) return false;
    if (statusFilter === "enabled" && !m.enabled) return false;
    if (statusFilter === "disabled" && m.enabled) return false;
    if (q && !`${m.display_name} ${m.id}`.toLowerCase().includes(q)) return false;
    return true;
  });

  // Group filtered models by provider
  const grouped = filtered.reduce((acc: any, m: any) => {
    if (!acc[m.provider_id]) acc[m.provider_id] = [];
    acc[m.provider_id].push(m);
    return acc;
  }, {} as Record<string, any[]>);
  const groupKeys = Object.keys(grouped).sort();

  const clearFilters = () => {
    setSearch(""); setProviderFilter("all"); setModalityFilter("all"); setTierFilter("all"); setStatusFilter("all");
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">Model Control</h1>
            <p className="text-warm-grey mt-1">Full CRUD: create, update, delete models. Configure pricing, fallbacks, and routing.</p>
            {models && (
              <div className="flex flex-wrap gap-2 mt-3 text-xs">
                <span className="badge-info">{models.length} models</span>
                <span className="badge-success">{models.filter((m: any) => m.is_free).length} free</span>
                <span className="badge-info">{models.filter((m: any) => (m.modality || "text") !== "text").length} image/audio/video</span>
                <span className="badge-info">{new Set(models.map((m: any) => m.provider_id)).size} providers</span>
              </div>
            )}
          </div>
          <button onClick={() => setShowAddForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Model
          </button>
        </div>

        {/* Add model form - improved with clear labels */}
        {showAddForm && (
          <div className="card border-silk-gold/30">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-deep-charcoal dark:text-cloud-grey">Create New Model</h3>
              <button onClick={() => setShowAddForm(false)} className="text-warm-grey hover:text-silk-gold">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Model ID */}
              <div>
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Model ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., gpt-4o-mini"
                  value={newModel.id}
                  onChange={(e) => setNewModel({ ...newModel, id: e.target.value.trim() })}
                  className="input"
                />
                <p className="text-xs text-warm-grey mt-1">Unique identifier used in API requests.</p>
              </div>

              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Provider <span className="text-red-400">*</span>
                </label>
                <select
                  value={newModel.provider_id}
                  onChange={(e) => setNewModel({ ...newModel, provider_id: e.target.value })}
                  className="input"
                >
                  <option value="">Select a provider</option>
                  {providerIds.map(pid => (
                    <option key={pid} value={pid}>{pid}</option>
                  ))}
                </select>
                <p className="text-xs text-warm-grey mt-1">Parent provider (must exist).</p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Display Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., GPT-4o Mini"
                  value={newModel.display_name}
                  onChange={(e) => setNewModel({ ...newModel, display_name: e.target.value })}
                  className="input"
                />
                <p className="text-xs text-warm-grey mt-1">Human-friendly name shown to users.</p>
              </div>

              {/* Enabled toggle */}
              <div>
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Status
                </label>
                <div className="flex items-center gap-3 mt-1">
                  <button
                    onClick={() => setNewModel({ ...newModel, enabled: !newModel.enabled })}
                    className="flex items-center gap-2 text-warm-grey hover:text-silk-gold transition-colors"
                  >
                    {newModel.enabled ? (
                      <ToggleRight size={26} className="text-silk-gold" />
                    ) : (
                      <ToggleLeft size={26} />
                    )}
                    <span>{newModel.enabled ? "Active" : "Disabled"}</span>
                  </button>
                </div>
                <p className="text-xs text-warm-grey mt-1">If disabled, users cannot use this model.</p>
              </div>

              {/* Input Cost */}
              <div>
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Input Cost ($ / 1K tokens)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={newModel.input_cost_per_1k}
                  onChange={(e) => setNewModel({ ...newModel, input_cost_per_1k: parseFloat(e.target.value) })}
                  className="input"
                />
              </div>

              {/* Output Cost */}
              <div>
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Output Cost ($ / 1K tokens)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={newModel.output_cost_per_1k}
                  onChange={(e) => setNewModel({ ...newModel, output_cost_per_1k: parseFloat(e.target.value) })}
                  className="input"
                />
              </div>

              {/* Routing Weight */}
              <div>
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Routing Weight (0-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newModel.routing_weight}
                  onChange={(e) => setNewModel({ ...newModel, routing_weight: parseInt(e.target.value) })}
                  className="input"
                />
                <p className="text-xs text-warm-grey mt-1">Higher weight = more traffic (auto-routing).</p>
              </div>

              {/* Context Window */}
              <div>
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Context Window (tokens)
                </label>
                <input
                  type="number"
                  min="1"
                  value={newModel.context_window}
                  onChange={(e) => setNewModel({ ...newModel, context_window: parseInt(e.target.value) })}
                  className="input"
                />
              </div>

              {/* Fallback Models */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Fallback Models (comma-separated IDs)
                </label>
                <input
                  type="text"
                  placeholder="gpt-3.5-turbo,claude-3-haiku"
                  value={newModel.fallback_models}
                  onChange={(e) => setNewModel({ ...newModel, fallback_models: e.target.value })}
                  className="input"
                />
                <p className="text-xs text-warm-grey mt-1">If this model fails, SilkLLM will try these in order.</p>
              </div>

              {/* Capabilities */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-deep-charcoal dark:text-cloud-grey mb-1">
                  Capabilities (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="chat,function-calling,vision"
                  value={newModel.capabilities}
                  onChange={(e) => setNewModel({ ...newModel, capabilities: e.target.value })}
                  className="input"
                />
                <p className="text-xs text-warm-grey mt-1">E.g., chat, function-calling, vision, embedding.</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowAddForm(false)} className="btn-secondary text-sm px-4 py-2">
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newModel.id || !newModel.provider_id || !newModel.display_name) {
                    toast.error("Model ID, Provider, and Display Name are required");
                    return;
                  }
                  createMutation.mutate({
                    ...newModel,
                    fallback_models: newModel.fallback_models.split(",").map(s => s.trim()).filter(Boolean),
                    capabilities: newModel.capabilities.split(",").map(s => s.trim()).filter(Boolean),
                  });
                }}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-1"
              >
                <Plus size={14} /> Create Model
              </button>
            </div>
          </div>
        )}

        {/* Filter bar */}
        {models && models.length > 0 && (
          <div className="card">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-2">
                <label className="text-xs text-warm-grey">Search</label>
                <div className="relative mt-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-grey pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or model id"
                    className="input pl-9"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-warm-grey">Provider</label>
                <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} className="input mt-1">
                  <option value="all">All providers</option>
                  {providerIds.map((pid) => <option key={pid} value={pid}>{pid}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-warm-grey">Modality</label>
                <select value={modalityFilter} onChange={(e) => setModalityFilter(e.target.value)} className="input mt-1">
                  <option value="all">All modalities</option>
                  <option value="text">Text</option>
                  <option value="image">Image</option>
                  <option value="audio">Audio</option>
                  <option value="video">Video</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-warm-grey">Tier</label>
                <select value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} className="input mt-1">
                  <option value="all">All tiers</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-warm-grey">Status</label>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input mt-1">
                  <option value="all">All statuses</option>
                  <option value="enabled">Enabled</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2 mt-3">
              <span className="text-xs text-warm-grey">
                Showing {filtered.length} of {models.length} models
                {filtersActive && (
                  <button onClick={clearFilters} className="ml-2 text-silk-gold hover:underline">Clear filters</button>
                )}
              </span>
              <div className="flex gap-4 text-xs">
                <button onClick={() => setCollapsed({})} className="text-silk-gold hover:underline">Expand all</button>
                <button
                  onClick={() => setCollapsed(Object.fromEntries(groupKeys.map((k) => [k, true])))}
                  className="text-silk-gold hover:underline"
                >
                  Collapse all
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-warm-grey">Loading models...</div>
        ) : groupKeys.length === 0 ? (
          <div className="card text-center text-warm-grey py-10">
            {models && models.length > 0 ? "No models match the current filters." : "No models yet."}
          </div>
        ) : (
          groupKeys.map((providerId) => {
            const provModels = grouped[providerId];
            const isCollapsed = !!collapsed[providerId];
            const freeCount = provModels.filter((m: any) => m.is_free).length;
            return (
            <div key={providerId} className="card p-0 overflow-hidden">
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [providerId]: !c[providerId] }))}
                className="w-full px-5 py-3 bg-cloud-grey dark:bg-deep-charcoal border-b border-muted-metal flex justify-between items-center text-left hover:bg-muted-metal/40 transition-colors"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {isCollapsed ? <ChevronRight size={18} className="text-warm-grey" /> : <ChevronDown size={18} className="text-warm-grey" />}
                  <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey capitalize">{providerId}</h2>
                  <span className="badge-info">{provModels.length}</span>
                  {freeCount > 0 && <span className="badge-success">{freeCount} free</span>}
                </div>
              </button>
              {!isCollapsed && (
              <div className="divide-y divide-cloud-grey dark:divide-muted-metal">
                {provModels.map((m: any) => {
                  const hasEdits = !!editing[m.id];
                  return (
                    <div key={m.id} className={`p-4 ${!m.enabled ? "opacity-60" : ""}`}>
                      <div className="flex items-start gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-deep-charcoal dark:text-cloud-grey text-sm">{m.display_name}</span>
                            <span className="font-mono text-xs text-warm-grey">{m.id}</span>
                            {m.is_free && <span className="badge-success">Free</span>}
                            {m.modality && m.modality !== "text" && <span className="badge-info">{m.modality}</span>}
                            {!m.enabled && <span className="badge-error">Disabled</span>}
                          </div>

                          {/* Editable fields */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                            <div>
                              <label className="text-xs text-warm-grey">Input $/1K</label>
                              <input
                                type="number"
                                step="0.000001"
                                defaultValue={m.input_cost_per_1k}
                                onChange={(e) => setEdit(m.id, "input_cost_per_1k", parseFloat(e.target.value))}
                                className="input text-xs py-1.5 mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-warm-grey">Output $/1K</label>
                              <input
                                type="number"
                                step="0.000001"
                                defaultValue={m.output_cost_per_1k}
                                onChange={(e) => setEdit(m.id, "output_cost_per_1k", parseFloat(e.target.value))}
                                className="input text-xs py-1.5 mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-warm-grey">Routing Weight</label>
                              <input
                                type="number"
                                min={0}
                                max={100}
                                defaultValue={m.routing_weight}
                                onChange={(e) => setEdit(m.id, "routing_weight", parseInt(e.target.value))}
                                className="input text-xs py-1.5 mt-1"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-warm-grey">Fallbacks (comma-sep)</label>
                              <input
                                type="text"
                                defaultValue={(m.fallback_models || []).join(",")}
                                onChange={(e) =>
                                  setEdit(
                                    m.id,
                                    "fallback_models",
                                    e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean)
                                  )
                                }
                                className="input text-xs py-1.5 mt-1"
                                placeholder="model-id-1,model-id-2"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-warm-grey">Context Window</label>
                              <input
                                type="number"
                                defaultValue={m.context_window}
                                onChange={(e) => setEdit(m.id, "context_window", parseInt(e.target.value))}
                                className="input text-xs py-1.5 mt-1"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-xs text-warm-grey">Capabilities (comma)</label>
                              <input
                                type="text"
                                defaultValue={(m.capabilities || []).join(",")}
                                onChange={(e) =>
                                  setEdit(
                                    m.id,
                                    "capabilities",
                                    e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean)
                                  )
                                }
                                className="input text-xs py-1.5 mt-1"
                              />
                            </div>
                          </div>

                          {hasEdits && (
                            <button
                              onClick={() => saveEdits(m.id)}
                              className="mt-2 text-xs btn-primary py-1.5 px-3 flex items-center gap-1"
                            >
                              <Save size={12} /> Save changes
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggleModel(m.id, m.enabled)}
                            className="text-warm-grey hover:text-silk-gold transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            {m.enabled ? (
                              <ToggleRight size={26} className="text-silk-gold" />
                            ) : (
                              <ToggleLeft size={26} />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(m.id, m.display_name)}
                            className="text-warm-grey hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Models.tsx