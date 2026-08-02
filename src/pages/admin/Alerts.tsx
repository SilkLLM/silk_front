/**
 * Alerts.tsx (admin)
 * System health alerts — low provider balance, outages, error spikes — with
 * acknowledgement.
 *
 * Severity is carried by an icon and an explicit label as well as colour, so it
 * survives a colour-blind reader and a greyscale print.
 */

// File: silkllm-frontend/src/pages/admin/Alerts.tsx

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Bell, CheckCircle2, Info, ShieldCheck, XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import { format, formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Badge, Button, EmptyState, IconButton, PageHeader, Panel, SegmentedControl, Skeleton, StatTile,
} from "@/components/ui";

const SEVERITY = {
  critical: { icon: <XCircle size={16} />,        tone: "text-danger bg-danger/10 border-danger/20", label: "Critical", badge: "error" as const },
  warning:  { icon: <AlertTriangle size={16} />,  tone: "text-warn bg-warn/10 border-warn/20",       label: "Warning",  badge: "warning" as const },
  info:     { icon: <Info size={16} />,           tone: "text-ink-3 bg-ink/[0.05] border-line",      label: "Info",     badge: "neutral" as const },
};

export default function AdminAlerts() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "open">("all");

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["admin-alerts"],
    queryFn: () => adminApi.alerts.list(false).then((r) => r.data),
    refetchInterval: 15_000,
  });

  const ack = useMutation({
    mutationFn: (id: string) => adminApi.alerts.acknowledge(id),
    onSuccess: () => { toast.success("Alert acknowledged."); qc.invalidateQueries({ queryKey: ["admin-alerts"] }); },
    onError: () => toast.error("Could not acknowledge the alert."),
  });

  const list = alerts || [];
  const open = list.filter((a: any) => !a.acknowledged);
  const critical = open.filter((a: any) => a.severity === "critical");
  const shown = useMemo(
    () => (filter === "open" ? open : list),
    [list, open, filter],
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Alerts"
        subtitle="Low provider balances, outages and error spikes raised by the monitoring worker."
        meta={
          open.length === 0
            ? <Badge tone="success"><CheckCircle2 size={10} /> All clear</Badge>
            : <Badge tone={critical.length ? "error" : "warning"}>{open.length} unacknowledged</Badge>
        }
      />

      <div className="grid grid-cols-3 gap-4">
        <StatTile label="Unacknowledged" value={open.length} icon={<Bell size={14} />} hint={open.length ? "Needs attention" : "Nothing pending"} />
        <StatTile label="Critical" value={critical.length} icon={<XCircle size={14} />} hint="Open, highest severity" />
        <StatTile label="Total raised" value={list.length} icon={<ShieldCheck size={14} />} hint="All time" />
      </div>

      <Panel
        title="Alert feed"
        icon={<Bell size={15} />}
        actions={
          <SegmentedControl
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All (${list.length})` },
              { value: "open", label: `Open (${open.length})` },
            ]}
          />
        }
      >
        {isLoading ? (
          <div className="p-5 space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : !shown.length ? (
          <EmptyState
            icon={<CheckCircle2 size={19} />}
            title={filter === "open" ? "Nothing unacknowledged" : "No alerts raised"}
            hint="Provider balances are checked every five minutes; anything unhealthy shows up here."
          />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((a: any) => {
              const sev = SEVERITY[a.severity as keyof typeof SEVERITY] || SEVERITY.info;
              return (
                <li key={a.id} className={clsx("flex items-start gap-3 px-5 sm:px-6 py-4", a.acknowledged && "opacity-60")}>
                  <span className={clsx("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", sev.tone)}>
                    {sev.icon}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge tone={sev.badge}>{sev.label}</Badge>
                      <span className="text-xs text-ink-2 capitalize">{String(a.alert_type).replace(/_/g, " ")}</span>
                      {a.provider_id && (
                        <>
                          <span className="text-ink-3 text-xs">·</span>
                          <span className="text-xs text-ink-2 capitalize">{a.provider_id}</span>
                        </>
                      )}
                      {a.email_sent && <Badge tone="neutral">Email sent</Badge>}
                      {a.acknowledged && <Badge tone="success"><CheckCircle2 size={10} /> Acknowledged</Badge>}
                    </div>

                    <p className="text-sm text-ink mt-1.5 leading-relaxed">{a.message}</p>

                    <p className="text-2xs text-ink-3 mt-1.5">
                      {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                      {a.acknowledged && a.acknowledged_at &&
                        ` · acknowledged ${format(new Date(a.acknowledged_at), "MMM d, HH:mm")}`}
                    </p>
                  </div>

                  {!a.acknowledged && (
                    <Button
                      size="sm"
                      icon={<CheckCircle2 size={14} />}
                      loading={ack.isPending && ack.variables === a.id}
                      onClick={() => ack.mutate(a.id)}
                    >
                      Acknowledge
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Alerts.tsx
