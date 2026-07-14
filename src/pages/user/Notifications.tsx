/**
 * Notifications.tsx
 * The user's dashboard inbox: key events, earnings, target-reached, trial-low,
 * and system messages. Mark one or all read.
 */

// File: silkllm-frontend/src/pages/user/Notifications.tsx

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, TrendingUp, AlertTriangle, Target, Zap, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { notificationsApi } from "@/services/api";

interface Notification {
  id: string; type: string; title: string; body: string; read: boolean; created_at: string;
}

function iconFor(type: string) {
  switch (type) {
    case "earning": return <TrendingUp size={18} className="text-silk-gold" />;
    case "target_reached": return <Target size={18} className="text-warm-olive" />;
    case "key_suspended": case "key_exhausted": return <AlertTriangle size={18} className="text-red-400" />;
    case "trial_low": return <Zap size={18} className="text-bright-glow" />;
    default: return <Info size={18} className="text-warm-grey" />;
  }
}

export default function Notifications() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list().then((r) => r.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
  });

  const items: Notification[] = data?.notifications || [];

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">Notifications</h1>
            <p className="text-warm-grey mt-1">{data?.unread || 0} unread</p>
          </div>
          {(data?.unread || 0) > 0 && (
            <button onClick={() => markAll.mutate()} className="btn-secondary flex items-center gap-2 text-sm">
              <CheckCheck size={16} /> Mark all read
            </button>
          )}
        </div>

        <div className="card">
          {isLoading ? (
            <p className="text-warm-grey text-sm">Loading...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-10">
              <Bell size={28} className="text-muted-metal mx-auto mb-3" />
              <p className="text-warm-grey text-sm">You are all caught up.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((n) => (
                <div key={n.id}
                  onClick={() => !n.read && markRead.mutate(n.id)}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    n.read ? "opacity-60" : "bg-silk-gold/5"
                  } hover:bg-cloud-grey dark:hover:bg-deep-charcoal`}
                >
                  <div className="mt-0.5">{iconFor(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-deep-charcoal dark:text-cloud-grey">{n.title}</p>
                    {n.body && <p className="text-xs text-warm-grey mt-0.5">{n.body}</p>}
                    <p className="text-[11px] text-muted-metal mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-silk-gold mt-1.5 shrink-0" />}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Notifications.tsx
