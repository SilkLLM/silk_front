/**
 * Notifications.tsx
 * The account inbox: earnings, key events, trial warnings and system messages.
 * Unread state is carried by weight, a dot and an explicit filter — not by a
 * colour wash alone.
 */

// File: silkllm-frontend/src/pages/user/Notifications.tsx

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Bell, CheckCheck, Info, Target, TrendingUp, Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { notificationsApi } from "@/services/api";
import {
  Badge, Button, EmptyState, PageHeader, Panel, SegmentedControl, Skeleton,
} from "@/components/ui";

interface Notification {
  id: string; type: string; title: string; body: string; read: boolean; created_at: string;
}

/** Icon carries the category; it is paired with the title, never used alone. */
function iconFor(type: string) {
  switch (type) {
    case "earning":        return { icon: <TrendingUp size={16} />, tone: "text-accent-ink bg-accent/10 border-accent/20" };
    case "target_reached": return { icon: <Target size={16} />,     tone: "text-success bg-success/10 border-success/20" };
    case "key_suspended":
    case "key_exhausted":  return { icon: <AlertTriangle size={16} />, tone: "text-danger bg-danger/10 border-danger/20" };
    case "trial_low":      return { icon: <Zap size={16} />,        tone: "text-warn bg-warn/10 border-warn/20" };
    default:               return { icon: <Info size={16} />,       tone: "text-ink-3 bg-ink/[0.05] border-line" };
  }
}

export default function Notifications() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list().then((r) => r.data),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  const markRead = useMutation({ mutationFn: (id: string) => notificationsApi.markRead(id), onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: () => notificationsApi.markAllRead(), onSuccess: invalidate });

  const items: Notification[] = data?.notifications || [];
  const unread = data?.unread || 0;
  const shown = useMemo(
    () => (filter === "unread" ? items.filter((n) => !n.read) : items),
    [items, filter],
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Notifications"
        subtitle="Earnings, key events and system messages for your account."
        meta={unread > 0 ? <Badge tone="brand">{unread} unread</Badge> : <Badge tone="neutral">All caught up</Badge>}
        actions={
          unread > 0 ? (
            <Button size="sm" icon={<CheckCheck size={14} />} loading={markAll.isPending} onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <Panel
        title="Inbox"
        icon={<Bell size={15} />}
        actions={
          <SegmentedControl
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[{ value: "all", label: "All" }, { value: "unread", label: `Unread${unread ? ` (${unread})` : ""}` }]}
          />
        }
      >
        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : !shown.length ? (
          <EmptyState
            icon={<Bell size={19} />}
            title={filter === "unread" ? "Nothing unread" : "No notifications yet"}
            hint={filter === "unread"
              ? "You have read everything in your inbox."
              : "Earnings, key events and trial reminders will appear here."}
          />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((n) => {
              const { icon, tone } = iconFor(n.type);
              return (
                <li key={n.id}>
                  <button
                    onClick={() => !n.read && markRead.mutate(n.id)}
                    disabled={n.read}
                    className={clsx(
                      "w-full flex items-start gap-3 px-5 sm:px-6 py-4 text-left transition-colors",
                      !n.read && "hover:bg-sunken cursor-pointer",
                      n.read && "cursor-default",
                    )}
                  >
                    <span className={clsx("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", tone)}>
                      {icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block text-sm", n.read ? "text-ink-2" : "text-ink font-medium")}>
                        {n.title}
                      </span>
                      {n.body && <span className="block text-xs text-ink-2 mt-1 leading-relaxed">{n.body}</span>}
                      <span className="block text-2xs text-ink-3 mt-1.5">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        {!n.read && " · unread"}
                      </span>
                    </span>
                    {!n.read && <span className="w-2 h-2 rounded-full bg-accent mt-2 shrink-0" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Notifications.tsx
