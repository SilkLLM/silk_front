/**
 * Settings.tsx (admin)
 * Live platform settings - trial limits, markup and reward percentages - plus
 * the emergency kill switches.
 *
 * A setting is only saved when it is explicitly submitted, and a dirty row says
 * so, because these values move real money within seconds of being changed.
 */

// File: silkllm-frontend/src/pages/admin/Settings.tsx

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, ShieldAlert, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Badge, Button, Callout, EmptyState, Input, PageHeader, Panel, Skeleton, Switch,
} from "@/components/ui";

interface Setting { key: string; label: string; type: string; value: number }
interface Flag { key: string; label: string; enabled: boolean }

function SettingRow({ s, onSave, saving }: {
  s: Setting; onSave: (key: string, value: number) => void; saving: boolean;
}) {
  const [value, setValue] = useState(String(s.value));
  useEffect(() => { setValue(String(s.value)); }, [s.value]);

  const parsed = parseFloat(value);
  const dirty = !Number.isNaN(parsed) && parsed !== s.value;
  const invalid = value !== "" && Number.isNaN(parsed);

  return (
    <div className="flex items-center gap-3 px-5 sm:px-6 py-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink flex items-center gap-2">
          {s.label}
          {dirty && <Badge tone="warning">Unsaved</Badge>}
        </p>
        <p className="text-2xs font-mono text-ink-3 mt-0.5">{s.key}</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          step={s.type === "int" ? 1 : 0.01}
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && dirty) onSave(s.key, parsed); }}
          className="w-28 text-right num"
          aria-label={s.label}
        />
        {dirty && (
          <Button size="sm" variant="ghost" icon={<RotateCcw size={13} />} onClick={() => setValue(String(s.value))} aria-label="Reset" />
        )}
        <Button
          size="sm"
          variant="primary"
          icon={<Save size={13} />}
          disabled={!dirty || invalid}
          loading={saving}
          onClick={() => onSave(s.key, parsed)}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

function KillSwitches() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Flag[]>({
    queryKey: ["killswitches"],
    queryFn: () => adminApi.killswitch.list().then((r) => r.data),
  });

  const set = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => adminApi.killswitch.set(key, enabled),
    onSuccess: () => { toast.success("Switch updated."); qc.invalidateQueries({ queryKey: ["killswitches"] }); },
    onError: () => toast.error("Could not flip the switch."),
  });

  const flags = data || [];
  const live = flags.filter((f) => f.enabled);

  return (
    <Panel
      title="Emergency switches"
      description="Flip to contain an incident. Takes effect within seconds, no redeploy."
      icon={<ShieldAlert size={15} />}
      actions={live.length > 0 ? <Badge tone="error">{live.length} engaged</Badge> : <Badge tone="success">All clear</Badge>}
    >
      {live.length > 0 && (
        <div className="px-5 sm:px-6 pt-4">
          <Callout tone="danger" icon={<ShieldAlert size={16} />} title="Switches are engaged">
            <p>{live.map((f) => f.label).join(", ")} - traffic is being blocked right now.</p>
          </Callout>
        </div>
      )}

      {isLoading ? (
        <div className="p-5 space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !flags.length ? (
        <EmptyState icon={<ShieldAlert size={19} />} title="No switches configured" />
      ) : (
        <ul className="divide-y divide-line">
          {flags.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm text-ink flex items-center gap-2">
                  {f.label}
                  {f.enabled && <Badge tone="error">On</Badge>}
                </p>
                <p className="text-2xs font-mono text-ink-3 mt-0.5">{f.key}</p>
              </div>
              <Switch
                checked={f.enabled}
                tone="danger"
                stateLabels={["Engaged", "Off"]}
                label={f.label}
                pending={set.isPending && set.variables?.key === f.key}
                onChange={(v) => set.mutate({ key: f.key, enabled: v })}
              />
            </li>
          ))}
        </ul>
      )}
    </Panel>
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
    onSuccess: () => { toast.success("Saved."); qc.invalidateQueries({ queryKey: ["admin-settings"] }); },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Could not save."),
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Platform Settings"
        subtitle="Live values read on every request. Changes apply within seconds - no redeploy."
      />

      <Callout tone="warning" icon={<SlidersHorizontal size={17} />} title="These move real money">
        <p>
          Markup and reward percentages affect what every user is charged and what depositors earn on the
          very next request. Change them deliberately.
        </p>
      </Callout>

      <Panel title="Values" icon={<SlidersHorizontal size={15} />}>
        {isLoading ? (
          <div className="p-5 space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : !data?.length ? (
          <EmptyState icon={<SlidersHorizontal size={19} />} title="No settings exposed" />
        ) : (
          <div className="divide-y divide-line">
            {data.map((s) => (
              <SettingRow
                key={s.key}
                s={s}
                saving={save.isPending && save.variables?.key === s.key}
                onSave={(key, value) => save.mutate({ key, value })}
              />
            ))}
          </div>
        )}
      </Panel>

      <KillSwitches />
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Settings.tsx
