/**
 * Alerts.tsx
 * Admin page — view and acknowledge system alerts (low balance, provider down, error spike).
 */

// File: silkllm-frontend/src/pages/admin/Alerts.tsx

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle, AlertTriangle, XCircle, Info, Filter } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import { format, formatDistanceToNow } from "date-fns";

const SEVERITY_ICONS: Record<string, React.ReactNode> = {
  critical: <XCircle size={18} className="text-red-400 shrink-0" />,
  warning:  <AlertTriangle size={18} className="text-bright-glow shrink-0" />,
  info:     <Info size={18} className="text-silk-gold shrink-0" />,
};

export default function AdminAlerts() {
  const qc = useQueryClient();
  const [unackedOnly, setUnackedOnly] = useState(false);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["admin-alerts", unackedOnly],
    queryFn: () => adminApi.alerts.list(unackedOnly).then((r) => r.data),
    refetchInterval: 15000,
  });

  const ackMutation = useMutation({
    mutationFn: (id: string) => adminApi.alerts.acknowledge(id),
    onSuccess: () => { toast.success("Alert acknowledged"); qc.invalidateQueries({ queryKey: ["admin-alerts"] }); },
  });

  const unacknowledged = alerts?.filter((a: any) => !a.acknowledged).length || 0;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey flex items-center gap-2">
              Alerts Centre
              {unacknowledged > 0 && (
                <span className="badge-warning text-xs px-2 py-0.5">{unacknowledged} new</span>
              )}
            </h1>
            <p className="text-warm-grey mt-1">System health alerts — low balance, provider outages, error spikes.</p>
          </div>
          <button onClick={() => setUnackedOnly(u => !u)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all min-h-[44px] ${
                    unackedOnly ? "bg-silk-gold text-white" : "bg-cloud-grey dark:bg-slate-dark text-warm-grey"
                  }`}>
            <Filter size={14} /> {unackedOnly ? "Showing unacknowledged" : "Show all"}
          </button>
        </div>

        {isLoading ? (
          <div className="text-warm-grey">Loading alerts...</div>
        ) : !alerts?.length ? (
          <div className="card text-center py-12">
            <Bell size={32} className="text-warm-grey mx-auto mb-3" />
            <p className="text-warm-grey">No alerts. Everything looks healthy!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert: any) => (
              <div key={alert.id}
                   className={`card transition-all ${alert.acknowledged ? "opacity-60" : "border-l-4"} ${
                     !alert.acknowledged && alert.severity === "critical" ? "border-l-red-400" :
                     !alert.acknowledged && alert.severity === "warning" ? "border-l-bright-glow" : ""
                   }`}>
                <div className="flex items-start gap-3">
                  {SEVERITY_ICONS[alert.severity] || SEVERITY_ICONS.info}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium uppercase tracking-wider ${
                        alert.severity === "critical" ? "text-red-400" :
                        alert.severity === "warning" ? "text-bright-glow" : "text-silk-gold"
                      }`}>{alert.severity}</span>
                      <span className="text-xs text-warm-grey">·</span>
                      <span className="text-xs text-warm-grey capitalize">{alert.alert_type.replace("_", " ")}</span>
                      {alert.provider_id && (
                        <><span className="text-xs text-warm-grey">·</span>
                        <span className="text-xs text-warm-grey capitalize">{alert.provider_id}</span></>
                      )}
                      {alert.email_sent && <span className="badge-info text-xs">Email sent</span>}
                    </div>
                    <p className="text-sm text-deep-charcoal dark:text-cloud-grey mt-1">{alert.message}</p>
                    <p className="text-xs text-warm-grey mt-1.5">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      {alert.acknowledged && alert.acknowledged_at &&
                        ` · Acknowledged ${format(new Date(alert.acknowledged_at), "MMM d HH:mm")}`}
                    </p>
                  </div>

                  {!alert.acknowledged && (
                    <button onClick={() => ackMutation.mutate(alert.id)}
                            className="shrink-0 text-warm-grey hover:text-green-400 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Acknowledge alert">
                      <CheckCircle size={20} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Alerts.tsx
