/**
 * Analytics.tsx (admin)
 * Provider/model reliability: what actually succeeds, what errors outright,
 * and what "succeeds" while returning something that looks like a safety
 * classifier's verdict instead of a real answer (content_suspect - see
 * app/core/content_checks.py on the backend). Regular users never see any
 * of this; it exists so an admin can tell which free/cheap models are
 * actually reliable versus silently broken.
 *
 * The per-provider chart stacks three genuinely different outcomes for the
 * same total, so each gets its own hue (unlike a single-measure magnitude
 * comparison, where one hue is correct and a second would just restate the
 * axis) - every plotted value is also in the table below.
 */

// File: silkllm-frontend/src/pages/admin/Analytics.tsx

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Badge, EmptyState, Meter, PageHeader, Panel, Select, Skeleton, StatTile,
} from "@/components/ui";
import { ChartTooltip, ChartLegend, compact, percent, useChartTheme } from "@/lib/charts";

export default function Analytics() {
  const [days, setDays] = useState(7);
  const t = useChartTheme();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reliability", days],
    queryFn: () => adminApi.analytics.reliability(days).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const byProvider = useMemo(
    () => (data?.by_provider || []).map((p: any) => ({
      name: p.provider_id,
      succeeded: p.succeeded,
      provider_error: p.provider_error,
      content_suspect: p.content_suspect,
    })),
    [data],
  );

  const byModel = data?.by_model || [];
  const combined = data?.combined;

  return (
    <DashboardLayout>
      <PageHeader
        title="Reliability Analytics"
        subtitle="Success, failure and content-suspect ratios per provider and per model - not shown to regular users."
        actions={
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="h-9 text-xs w-auto" aria-label="Window">
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </Select>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Total attempts" value={compact(combined?.total || 0)} icon={<Activity size={14} />} accent hint={`Last ${days} day${days === 1 ? "" : "s"}`} />
        <StatTile label="Success rate" value={percent((combined?.success_rate || 0) * 100)} icon={<CheckCircle2 size={14} />} hint="Of all attempts" />
        <StatTile label="Provider errors" value={compact(combined?.provider_error || 0)} icon={<AlertTriangle size={14} />} hint="Raised, fell back or failed" />
        <StatTile label="Content-suspect" value={compact(combined?.content_suspect || 0)} icon={<ShieldAlert size={14} />} hint="Looked like a safety verdict, not an answer" />
      </div>

      <Panel
        title="Outcomes by provider"
        description="Every attempt this window, split by what actually happened."
        icon={<Activity size={15} />}
      >
        {isLoading ? (
          <div className="p-5"><Skeleton className="h-52" /></div>
        ) : !byProvider.length ? (
          <EmptyState icon={<Activity size={19} />} title="No attempts logged yet" hint="Generation attempts across every provider will appear here as chat and media requests are made." />
        ) : (
          <div className="px-2 pb-4 pt-3 space-y-3">
            <div className="px-3">
              <ChartLegend items={[
                { label: "Succeeded", color: t.seriesAt(2) },
                { label: "Provider error", color: t.seriesAt(4) },
                { label: "Content-suspect", color: t.seriesAt(7) },
              ]} />
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byProvider} margin={{ top: 8, right: 16, bottom: 0, left: 4 }} barCategoryGap="28%">
                <CartesianGrid {...t.gridProps} />
                <XAxis dataKey="name" {...t.axisProps} />
                <YAxis {...t.axisProps} width={40} tickFormatter={(v: number) => compact(v)} allowDecimals={false} />
                <Tooltip cursor={{ fill: t.grid, opacity: 0.5 }} content={<ChartTooltip />} />
                <Bar dataKey="succeeded" name="Succeeded" stackId="a" fill={t.seriesAt(2)} radius={[0, 0, 0, 0]} maxBarSize={32} />
                <Bar dataKey="provider_error" name="Provider error" stackId="a" fill={t.seriesAt(4)} maxBarSize={32} />
                <Bar dataKey="content_suspect" name="Content-suspect" stackId="a" fill={t.seriesAt(7)} radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      <Panel
        title="By model"
        description={byModel.length ? `${byModel.length} model${byModel.length === 1 ? "" : "s"} with attempts this window` : undefined}
        icon={<ShieldAlert size={15} />}
      >
        {isLoading ? (
          <div className="p-5 space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : !byModel.length ? (
          <EmptyState icon={<ShieldAlert size={19} />} title="No attempts logged yet" hint="Per-model reliability appears here once requests have been made." />
        ) : (
          <div className="scroll-x">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Model</th>
                  <th className="text-right">Attempts</th>
                  <th className="text-right">Errors</th>
                  <th className="text-right">Suspect</th>
                  <th>Success rate</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((m: any) => (
                  <tr key={`${m.provider_id}/${m.model_id}`}>
                    <td><Badge tone="neutral">{m.provider_id}</Badge></td>
                    <td className="text-sm text-ink max-w-[220px] truncate">{m.model_id}</td>
                    <td className="text-right num text-xs text-ink-2">{compact(m.total)}</td>
                    <td className="text-right num text-xs text-ink-2">
                      {m.provider_error > 0 ? <span className="text-danger">{compact(m.provider_error)}</span> : "0"}
                    </td>
                    <td className="text-right num text-xs text-ink-2">
                      {m.content_suspect > 0 ? <span className="text-warning">{compact(m.content_suspect)}</span> : "0"}
                    </td>
                    <td className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <Meter
                          value={m.success_rate * 100}
                          size="sm"
                          tone={m.success_rate >= 0.9 ? "success" : m.success_rate >= 0.5 ? "accent" : "danger"}
                        />
                        <span className="text-2xs text-ink-2 num shrink-0 w-9 text-right">
                          {percent(m.success_rate * 100)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Analytics.tsx
