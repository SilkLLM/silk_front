/**
 * Usage.tsx
 * Usage logs page — shows per-request token counts, costs, models used.
 */

// File: silkllm-frontend/src/pages/user/Usage.tsx

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Filter } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { usageApi } from "@/services/api";
import { format } from "date-fns";

const ENTRY_TYPES = [
  { value: "", label: "All" },
  { value: "usage", label: "API Calls" },
  { value: "purchase", label: "Purchases" },
  { value: "refund", label: "Refunds" },
];

export default function Usage() {
  const [page, setPage] = useState(1);
  const [entryType, setEntryType] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["usage-list", page, entryType],
    queryFn: () => usageApi.list(page, 20, entryType || undefined).then((r) => r.data),
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const getTotalTokens = (entry: any): number | null => {
    if (entry.total_tokens) return entry.total_tokens;
    if (entry.prompt_tokens !== undefined || entry.completion_tokens !== undefined) {
      return (entry.prompt_tokens || 0) + (entry.completion_tokens || 0);
    }
    return null;
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">Usage</h1>
          <p className="text-warm-grey mt-1">Every API call and transaction in your account.</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <Filter size={16} className="text-warm-grey" />
          {ENTRY_TYPES.map((t) => (
            <button key={t.value} onClick={() => { setEntryType(t.value); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all min-h-[36px] ${
                      entryType === t.value
                        ? "bg-silk-gold text-white"
                        : "bg-cloud-grey dark:bg-slate-dark text-warm-grey hover:text-cloud-grey"
                    }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cloud-grey dark:bg-deep-charcoal border-b border-muted-metal">
                <tr>
                  <th className="text-left px-4 py-3 text-warm-grey font-medium text-xs uppercase tracking-wider">Time</th>
                  <th className="text-left px-4 py-3 text-warm-grey font-medium text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-warm-grey font-medium text-xs uppercase tracking-wider">Model</th>
                  <th className="text-left px-4 py-3 text-warm-grey font-medium text-xs uppercase tracking-wider">Tokens</th>
                  <th className="text-left px-4 py-3 text-warm-grey font-medium text-xs uppercase tracking-wider">Cost</th>
                  <th className="text-left px-4 py-3 text-warm-grey font-medium text-xs uppercase tracking-wider">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cloud-grey dark:divide-muted-metal">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-warm-grey">Loading...</td></tr>
                ) : !data?.entries?.length ? (
                  <tr><td colSpan={6} className="text-center py-8 text-warm-grey">No records found.</td></tr>
                ) : (
                  data.entries.map((e: any) => {
                    const totalTokens = getTotalTokens(e);
                    return (
                      <tr key={e.id} className="hover:bg-soft-cream dark:hover:bg-slate-dark transition-colors">
                        <td className="px-4 py-3 text-warm-grey whitespace-nowrap">
                          {format(new Date(e.created_at), "MMM d, HH:mm")}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`badge-${e.entry_type === "usage" ? "info" : e.entry_type === "purchase" ? "success" : "warning"}`}>
                            {e.entry_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-deep-charcoal dark:text-cloud-grey font-mono text-xs">
                          {e.model || "—"}
                        </td>
                        <td className="px-4 py-3 text-warm-grey">
                          {totalTokens !== null ? totalTokens.toLocaleString() : "—"}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${e.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                          {e.amount > 0 ? "+" : ""}${Math.abs(e.amount).toFixed(6)}
                        </td>
                        <td className="px-4 py-3 text-warm-grey">${e.balance_after.toFixed(4)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-cloud-grey dark:border-muted-metal">
              <p className="text-xs text-warm-grey">Page {page} of {totalPages} · {data?.total} records</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1.5 rounded text-sm text-warm-grey hover:text-cloud-grey disabled:opacity-40 min-h-[36px]">
                  Previous
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-3 py-1.5 rounded text-sm text-warm-grey hover:text-cloud-grey disabled:opacity-40 min-h-[36px]">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Usage.tsx