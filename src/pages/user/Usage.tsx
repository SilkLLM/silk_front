/**
 * Usage.tsx
 * The activity log: every API call and balance movement, with the summary stats
 * and spend shape above the table that produced them.
 *
 * Filters sit in one row above the content they filter. The chart is a single
 * series so it carries no legend, and every value it plots is also present in
 * the table below - colour is never the only way to read this page.
 */

// File: silkllm-frontend/src/pages/user/Usage.tsx

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart2, Coins, Download, Hash, Receipt, TrendingDown } from "lucide-react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { usageApi } from "@/services/api";
import {
  Badge, Button, EmptyState, PageHeader, Pagination, Panel, SegmentedControl,
  Skeleton, StatTile, Toolbar,
} from "@/components/ui";
import { ChartTooltip, compact, usd, usdPrecise, useChartTheme } from "@/lib/charts";

const PAGE_SIZE = 20;

type EntryType = "" | "usage" | "purchase" | "refund";

const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: "",         label: "All" },
  { value: "usage",    label: "API calls" },
  { value: "purchase", label: "Purchases" },
  { value: "refund",   label: "Refunds" },
];

const TONE: Record<string, "neutral" | "success" | "warning" | "brand"> = {
  usage: "neutral", purchase: "success", refund: "warning", earning: "brand",
};

function totalTokens(entry: any): number | null {
  if (entry.total_tokens) return entry.total_tokens;
  if (entry.prompt_tokens !== undefined || entry.completion_tokens !== undefined) {
    return (entry.prompt_tokens || 0) + (entry.completion_tokens || 0);
  }
  return null;
}

/** Download the visible page as CSV - the table view, portable. */
function exportCsv(entries: any[]) {
  const header = ["time", "type", "model", "prompt_tokens", "completion_tokens", "amount_usd", "balance_after_usd"];
  const rows = entries.map((e) => [
    new Date(e.created_at).toISOString(),
    e.entry_type,
    e.model || "",
    e.prompt_tokens ?? "",
    e.completion_tokens ?? "",
    e.amount,
    e.balance_after,
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `silkllm-usage-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Usage() {
  const [page, setPage] = useState(1);
  const [entryType, setEntryType] = useState<EntryType>("");
  const t = useChartTheme();

  const { data, isLoading } = useQuery({
    queryKey: ["usage-list", page, entryType],
    queryFn: () => usageApi.list(page, PAGE_SIZE, entryType || undefined).then((r) => r.data),
  });

  const entries: any[] = data?.entries || [];
  const totalPages = data?.total ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  const summary = useMemo(() => {
    const spent = entries.filter((e) => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);
    const added = entries.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const tokens = entries.reduce((s, e) => s + (e.prompt_tokens || 0) + (e.completion_tokens || 0), 0);
    // Chronological for the chart; the table stays newest-first.
    const chart = [...entries].reverse().map((e, i) => ({
      i: i + 1,
      cost: e.amount < 0 ? Math.abs(e.amount) : 0,
      label: format(new Date(e.created_at), "MMM d, HH:mm"),
    }));
    return { spent, added, tokens, chart };
  }, [entries]);

  return (
    <DashboardLayout>
      <PageHeader
        title="Usage"
        subtitle="Every API call and balance movement on your account, newest first."
        actions={
          <Button
            size="sm"
            icon={<Download size={14} />}
            disabled={!entries.length}
            onClick={() => exportCsv(entries)}
          >
            Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Spent on this page" value={usdPrecise(summary.spent)} icon={<TrendingDown size={14} />} accent />
        <StatTile label="Credits added" value={usdPrecise(summary.added)} icon={<Coins size={14} />} />
        <StatTile label="Tokens" value={compact(summary.tokens)} icon={<Hash size={14} />} />
        <StatTile label="Records" value={compact(data?.total ?? entries.length)} icon={<Receipt size={14} />} hint="Matching the filter" />
      </div>

      {summary.chart.length > 1 && (
        <Panel title="Spend across this page" description="One point per record, oldest to newest." icon={<BarChart2 size={15} />}>
          <div className="px-2 pb-4 pt-3">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={summary.chart} margin={{ top: 8, right: 16, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="usageFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={t.seriesAt(0)} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={t.seriesAt(0)} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...t.gridProps} />
                <XAxis dataKey="i" {...t.axisProps} minTickGap={20} />
                <YAxis {...t.axisProps} width={64} tickFormatter={(v: number) => `${usd(v)}`} />
                <Tooltip
                  cursor={{ stroke: t.axis, strokeWidth: 1 }}
                  content={
                    <ChartTooltip
                      formatter={(v: any) => usdPrecise(Number(v))}
                      labelFormatter={(l: any) => summary.chart[Number(l) - 1]?.label || ""}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="Cost"
                  stroke={t.seriesAt(0)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  fill="url(#usageFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: t.surface }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      )}

      <Panel
        title="Activity"
        actions={
          <Toolbar>
            <SegmentedControl
              size="sm"
              value={entryType}
              onChange={(v) => { setEntryType(v); setPage(1); }}
              options={ENTRY_TYPES.map((e) => ({ value: e.value, label: e.label }))}
            />
          </Toolbar>
        }
        footer={
          totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} total={data?.total} onPage={setPage} />
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
          </div>
        ) : !entries.length ? (
          <EmptyState
            icon={<Receipt size={19} />}
            title="No records yet"
            hint={entryType ? "Nothing matches this filter. Try 'All'." : "Your API calls and purchases will show up here."}
          />
        ) : (
          <div className="scroll-x">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Model</th>
                  <th className="text-right">Tokens</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const tokens = totalTokens(e);
                  const debit = e.amount < 0;
                  return (
                    <tr key={e.id}>
                      <td className="text-ink-2 text-xs whitespace-nowrap num">
                        {format(new Date(e.created_at), "MMM d, HH:mm")}
                      </td>
                      <td>
                        <Badge tone={TONE[e.entry_type] || "neutral"}>{e.entry_type}</Badge>
                      </td>
                      <td className="font-mono text-xs text-ink-2 max-w-[220px] truncate">{e.model || "-"}</td>
                      <td className="text-right num text-ink-2 text-xs">
                        {tokens !== null ? tokens.toLocaleString() : "-"}
                      </td>
                      <td className={`text-right num text-xs font-medium ${debit ? "text-ink" : "text-success"}`}>
                        {debit ? "-" : "+"}{usd(Math.abs(e.amount))}
                      </td>
                      <td className="text-right num text-ink-2 text-xs">{usd(e.balance_after)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Usage.tsx
