/**
 * Settings.tsx (admin)
 * Live-editable platform settings: the free-trial daily limit and duration, and
 * the reward/markup percentages. Changes take effect within seconds, no redeploy.
 */

// File: silkllm-frontend/src/pages/admin/Settings.tsx

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal, Save, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";

interface Setting { key: string; label: string; type: string; value: number; }
interface Flag { key: string; label: string; enabled: boolean; }

function KillSwitches() {
  const qc = useQueryClient();
  const { data } = useQuery<Flag[]>({
    queryKey: ["killswitches"],
    queryFn: () => adminApi.killswitch.list().then((r) => r.data),
  });
  const set = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => adminApi.killswitch.set(key, enabled),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["killswitches"] }); },
    onError: () => toast.error("Failed"),
  });
  return (
    <div className="card border-red-500/20">
      <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-1 flex items-center gap-2">
        <ShieldAlert size={18} className="text-red-400" /> Emergency switches
      </h2>
      <p className="text-xs text-warm-grey mb-4">Flip to contain an incident. Takes effect within seconds.</p>
      <div className="space-y-2">
        {(data || []).map((f) => (
          <div key={f.key} className="flex items-center justify-between py-2 border-b border-muted-metal/20 last:border-0">
            <div>
              <p className="text-sm text-deep-charcoal dark:text-cloud-grey">{f.label}</p>
              <p className="text-xs font-mono text-warm-grey">{f.key}</p>
            </div>
            <button
              onClick={() => set.mutate({ key: f.key, enabled: !f.enabled })}
              className={`relative w-12 h-6 rounded-full transition-colors ${f.enabled ? "bg-red-500" : "bg-muted-metal"}`}
              title={f.enabled ? "On" : "Off"}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${f.enabled ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ s, onSave }: { s: Setting; onSave: (key: string, value: number) => void }) {
  const [value, setValue] = useState(String(s.value));
  useEffect(() => { setValue(String(s.value)); }, [s.value]);
  const dirty = parseFloat(value) !== s.value;
  return (
    <div className="flex items-center gap-3 py-3 border-b border-muted-metal/20 last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium text-deep-charcoal dark:text-cloud-grey">{s.label}</p>
        <p className="text-xs text-warm-grey font-mono">{s.key}</p>
      </div>
      <input
        className="input py-1.5 text-sm w-32 text-right"
        type="number" step={s.type === "int" ? 1 : 0.01} min={0}
        value={value} onChange={(e) => setValue(e.target.value)}
      />
      <button
        onClick={() => onSave(s.key, parseFloat(value))}
        disabled={!dirty || isNaN(parseFloat(value))}
        className="btn-primary py-1.5 px-3 text-sm disabled:opacity-40 flex items-center gap-1.5"
      >
        <Save size={14} /> Save
      </button>
    </div>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Setting[]>({
    queryKey: ["admin-settings"],
    queryFn: () => adminApi.settings.list().then((r) => r.data),
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: number }) => adminApi.settings.update(key, value),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: () => toast.error("Failed to save"),
  });

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey flex items-center gap-2">
            <SlidersHorizontal size={22} className="text-silk-gold" /> Platform Settings
          </h1>
          <p className="text-warm-grey mt-1">These take effect within seconds. No redeploy needed.</p>
        </div>

        <div className="card">
          {isLoading ? (
            <p className="text-warm-grey text-sm">Loading...</p>
          ) : (
            (data || []).map((s) => (
              <Row key={s.key} s={s} onSave={(key, value) => save.mutate({ key, value })} />
            ))
          )}
        </div>

        <KillSwitches />
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Settings.tsx
