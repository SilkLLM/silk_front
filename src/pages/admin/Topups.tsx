/**
 * Topups.tsx (admin)
 * Record credit purchased directly from a provider so balance tracking and the
 * low-credit alert threshold stay accurate. SilkLLM never buys provider credit
 * itself, which is why this is a manual ledger.
 */

// File: silkllm-frontend/src/pages/admin/Topups.tsx

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Info, PlusCircle, Receipt } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Button, Callout, EmptyState, Field, Input, PageHeader, Panel, Select, Skeleton, StatTile,
} from "@/components/ui";
import { usdShort } from "@/lib/charts";

const EMPTY = { provider_id: "", amount: "", remaining_after: "", note: "" };

export default function AdminTopups() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  const { data: providers } = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => adminApi.providers.list().then((r) => r.data),
  });

  const { data: topups, isLoading } = useQuery({
    queryKey: ["admin-topups"],
    queryFn: () => adminApi.topups.list().then((r) => r.data),
  });

  const record = useMutation({
    mutationFn: () => adminApi.topups.record({
      provider_id: form.provider_id,
      amount: parseFloat(form.amount),
      remaining_after: parseFloat(form.remaining_after),
      note: form.note || undefined,
    }),
    onSuccess: () => {
      toast.success("Top-up recorded and the provider balance updated.");
      setForm(EMPTY);
      qc.invalidateQueries({ queryKey: ["admin-topups"] });
      qc.invalidateQueries({ queryKey: ["admin-providers"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Could not record the top-up."),
  });

  const list = topups || [];
  const total = list.reduce((s: number, t: any) => s + (t.amount || 0), 0);
  const last = list[0];
  const valid = form.provider_id && form.amount !== "" && form.remaining_after !== "";

  return (
    <DashboardLayout>
      <PageHeader
        title="Top-Ups"
        subtitle="Record credit you bought directly from a provider so balance tracking and alerts stay accurate."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatTile label="Total recorded" value={usdShort(total)} icon={<Receipt size={14} />} accent hint="All providers" />
        <StatTile label="Top-ups logged" value={list.length} icon={<PlusCircle size={14} />} />
        <StatTile
          label="Most recent"
          value={last ? usdShort(last.amount) : "—"}
          icon={<Clock size={14} />}
          hint={last ? `${last.provider_id} · ${format(new Date(last.created_at), "MMM d")}` : "Nothing yet"}
        />
      </div>

      <Callout tone="info" icon={<Info size={17} />} title="How this works">
        <p>
          SilkLLM does not purchase provider credit automatically. Buy it directly from OpenAI, Anthropic
          and the rest, then record the transaction here — that resets the balance tracker and the
          low-credit alert threshold for that provider.
        </p>
      </Callout>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4 items-start">
        <Panel title="Record a top-up" icon={<PlusCircle size={15} />}>
          <div className="px-5 sm:px-6 py-5 space-y-4">
            <Field label="Provider" required>
              <Select value={form.provider_id} onChange={(e) => setForm((f) => ({ ...f, provider_id: e.target.value }))}>
                <option value="">Select a provider…</option>
                {(providers || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Amount added (USD)" required>
                <Input
                  type="number" step="0.01" min="0" className="num"
                  placeholder="500.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </Field>
              <Field label="Balance after (USD)" required hint="As shown in the provider's own dashboard.">
                <Input
                  type="number" step="0.01" min="0" className="num"
                  placeholder="500.00"
                  value={form.remaining_after}
                  onChange={(e) => setForm((f) => ({ ...f, remaining_after: e.target.value }))}
                />
              </Field>
            </div>

            <Field label="Note" hint="Optional — invoice number, who paid, anything worth remembering.">
              <Input
                placeholder="Added $500 via OpenAI billing, invoice #12345"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </Field>

            <Button
              variant="primary"
              className="w-full"
              disabled={!valid}
              loading={record.isPending}
              onClick={() => record.mutate()}
            >
              Record top-up
            </Button>
          </div>
        </Panel>

        <Panel title="History" icon={<Clock size={15} />}>
          {isLoading ? (
            <div className="p-5 space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : !list.length ? (
            <EmptyState icon={<Receipt size={19} />} title="No top-ups recorded" hint="Log your first provider purchase to start tracking balances." />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((t: any) => (
                <li key={t.id} className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink capitalize">{t.provider_id}</p>
                    {t.note && <p className="text-xs text-ink-2 mt-0.5 leading-relaxed">{t.note}</p>}
                    <p className="text-2xs text-ink-3 mt-1 num">
                      {format(new Date(t.created_at), "MMM d, yyyy · HH:mm")}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-success num">+${t.amount.toFixed(2)}</p>
                    <p className="text-2xs text-ink-3 num mt-0.5">balance ${t.remaining_after.toFixed(2)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Topups.tsx
