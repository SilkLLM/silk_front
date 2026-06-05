/**
 * ApiKeys.tsx
 * API key management page — create, list, and revoke keys.
 * Now stores raw key values in localStorage for playground reuse.
 */

// File: silkllm-frontend/src/pages/user/ApiKeys.tsx

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Key, Plus, Trash2, Copy, Eye, EyeOff, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { keysApi } from "@/services/api";
import { format } from "date-fns";

// Helper to manage stored raw keys in localStorage
const STORAGE_KEY = "silk_stored_keys";

interface StoredKey {
  id: string;
  name: string;
  rawKey: string;
  createdAt: number;
}

function getStoredKeys(): StoredKey[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function storeKey(key: StoredKey) {
  const keys = getStoredKeys();
  keys.push(key);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

function removeStoredKey(id: string) {
  const keys = getStoredKeys().filter(k => k.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export default function ApiKeys() {
  const qc = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<{ key: string; name: string; id: string } | null>(null);
  const [storedKeys, setStoredKeys] = useState<StoredKey[]>([]);

  // Load stored keys on mount
  useEffect(() => {
    setStoredKeys(getStoredKeys());
  }, []);

  const { data: keys, isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: () => keysApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => keysApi.create(name).then((r) => r.data),
    onSuccess: (data) => {
      // data = { id, name, key } where `key` is the raw API key
      setCreatedKey({ key: data.key, name: data.name, id: data.id });
      // Store raw key in localStorage for playground
      storeKey({
        id: data.id,
        name: data.name,
        rawKey: data.key,
        createdAt: Date.now(),
      });
      setStoredKeys(getStoredKeys());
      setNewKeyName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => toast.error("Failed to create key"),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => keysApi.revoke(id),
    onSuccess: (_data, id) => {
      toast.success("Key revoked");
      removeStoredKey(id);
      setStoredKeys(getStoredKeys());
      qc.invalidateQueries({ queryKey: ["api-keys"] });
    },
    onError: () => toast.error("Failed to revoke key"),
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">API Keys</h1>
          <p className="text-warm-grey mt-1">Create and manage your API keys. Each key has the same permissions as your account.</p>
        </div>

        {/* New key created banner */}
        {createdKey && (
          <div className="card border-silk-gold bg-silk-gold/5">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-silk-gold shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-silk-gold">Save your key — it won't be shown again</p>
                <p className="text-warm-grey text-sm mb-3">Key: <strong>{createdKey.name}</strong></p>
                <div className="flex items-center gap-2 bg-deep-charcoal rounded-lg px-4 py-2.5 font-mono text-sm text-cloud-grey overflow-x-auto">
                  <span className="flex-1 truncate">{createdKey.key}</span>
                  <button onClick={() => copyToClipboard(createdKey.key)}
                          className="shrink-0 text-silk-gold hover:text-electric-yellow transition-colors">
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            </div>
            <button onClick={() => setCreatedKey(null)} className="text-xs text-warm-grey mt-3 hover:text-silk-gold transition-colors">
              I've saved my key — dismiss
            </button>
          </div>
        )}

        {/* Create new key */}
        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-4 flex items-center gap-2">
            <Plus size={18} className="text-silk-gold" /> Create New Key
          </h2>
          <div className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="Key name (e.g., Production, Dev-Laptop)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newKeyName.trim() && createMutation.mutate(newKeyName.trim())}
            />
            <button
              onClick={() => newKeyName.trim() && createMutation.mutate(newKeyName.trim())}
              disabled={!newKeyName.trim() || createMutation.isPending}
              className="btn-primary shrink-0 disabled:opacity-50"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </button>
          </div>
        </div>

        {/* Key list */}
        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-4 flex items-center gap-2">
            <Key size={18} className="text-silk-gold" /> Your Keys
          </h2>

          {isLoading ? (
            <div className="text-warm-grey text-sm">Loading...</div>
          ) : keys?.length === 0 ? (
            <p className="text-warm-grey text-sm">No API keys yet. Create one above.</p>
          ) : (
            <div className="space-y-3">
              {keys?.map((key: any) => (
                <div key={key.id} className={`flex items-center gap-3 p-3 rounded-lg bg-cloud-grey dark:bg-deep-charcoal ${!key.is_active ? 'opacity-50' : ''}`}>
                  <Key size={16} className="text-silk-gold shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-deep-charcoal dark:text-cloud-grey">{key.name}</p>
                    <p className="text-xs text-warm-grey">
                      Created {format(new Date(key.created_at), "MMM d, yyyy")}
                      {key.last_used && ` · Last used ${format(new Date(key.last_used), "MMM d")}`}
                      {!key.is_active && " · Revoked"}
                    </p>
                  </div>
                  {key.is_active && (
                    <button
                      onClick={() => window.confirm(`Revoke key "${key.name}"?`) && revokeMutation.mutate(key.id)}
                      className="text-warm-grey hover:text-red-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Revoke key"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/ApiKeys.tsx