/**
 * Topups.tsx
 * Admin page - record manual provider top-ups and view top-up history.
 */

// File: silkllm-frontend/src/pages/admin/Topups.tsx

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusCircle, Clock } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import { format } from "date-fns";

export default function AdminTopups() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ provider_id: "", amount: "", remaining_after: "", note: "" });

  const { data: providers } = useQuery({
    queryKey: ["admin-providers"],
    queryFn: () => adminApi.providers.list().then((r) => r.data),
  });

  const { data: topups, isLoading } = useQuery({
    queryKey: ["admin-topups"],
    queryFn: () => adminApi.topups.list().then((r) => r.data),
  });

  const recordMutation = useMutation({
    mutationFn: () => adminApi.topups.record({
      provider_id: form.provider_id,
      amount: parseFloat(form.amount),
      remaining_after: parseFloat(form.remaining_after),
      note: form.note || undefined,
    }),
    onSuccess: () => {
      toast.success("Top-up recorded and provider balance updated.");
      setForm({ provider_id: "", amount: "", remaining_after: "", note: "" });
      qc.invalidateQueries({ queryKey: ["admin-topups"] });
      qc.invalidateQueries({ queryKey: ["admin-providers"] });
    },
    onError: () => toast.error("Failed to record top-up."),
  });

  const canSubmit = form.provider_id && form.amount && form.remaining_after;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">Manual Top-Up Recording</h1>
          <p className="text-warm-grey mt-1">
            After purchasing credits directly from a provider, record it here to keep balance tracking accurate.
          </p>
        </div>

        {/* Info box */}
        <div className="card border-silk-gold/30 bg-silk-gold/5">
          <p className="text-sm text-warm-grey leading-relaxed">
            <strong className="text-silk-gold">How this works:</strong> SilkLLM does not automatically purchase provider credits.
            You buy credits directly from OpenAI, Anthropic, etc., then record the transaction here.
            This updates the system's balance tracker and resets the low-credit alert threshold.
          </p>
        </div>

        {/* Record form */}
        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-5 flex items-center gap-2">
            <PlusCircle size={18} className="text-silk-gold" /> Record a Top-Up
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-warm-grey mb-1.5">Provider *</label>
              <select value={form.provider_id}
                      onChange={(e) => setForm(f => ({ ...f, provider_id: e.target.value }))}
                      className="input">
                <option value="">Select provider...</option>
                {providers?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-warm-grey mb-1.5">Amount Added (USD) *</label>
                <input type="number" step="0.01" min="0" value={form.amount}
                       onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
                       className="input" placeholder="500.00" />
              </div>
              <div>
                <label className="block text-sm text-warm-grey mb-1.5">Balance After Top-Up (USD) *</label>
                <input type="number" step="0.01" min="0" value={form.remaining_after}
                       onChange={(e) => setForm(f => ({ ...f, remaining_after: e.target.value }))}
                       className="input" placeholder="500.00" />
                <p className="text-xs text-warm-grey mt-1">As shown in the provider's dashboard</p>
              </div>
            </div>

            <div>
              <label className="block text-sm text-warm-grey mb-1.5">Note (optional)</label>
              <input type="text" value={form.note}
                     onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))}
                     className="input" placeholder="e.g., Added $500 via OpenAI billing, invoice #12345" />
            </div>

            <button onClick={() => recordMutation.mutate()}
                    disabled={!canSubmit || recordMutation.isPending}
                    className="btn-primary w-full disabled:opacity-50">
              {recordMutation.isPending ? "Recording..." : "Record Top-Up"}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-4 flex items-center gap-2">
            <Clock size={18} className="text-silk-gold" /> Top-Up History
          </h2>
          {isLoading ? (
            <p className="text-warm-grey text-sm">Loading...</p>
          ) : !topups?.length ? (
            <p className="text-warm-grey text-sm">No top-ups recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {topups.map((t: any) => (
                <div key={t.id} className="flex items-start justify-between gap-4 py-3 border-b border-cloud-grey dark:border-muted-metal last:border-0">
                  <div>
                    <p className="text-sm font-medium text-deep-charcoal dark:text-cloud-grey capitalize">{t.provider_id}</p>
                    {t.note && <p className="text-xs text-warm-grey mt-0.5">{t.note}</p>}
                    <p className="text-xs text-warm-grey mt-0.5">{format(new Date(t.created_at), "MMM d, yyyy HH:mm")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-green-400 font-semibold text-sm">+${t.amount.toFixed(2)}</p>
                    <p className="text-xs text-warm-grey">Balance after: ${t.remaining_after.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Topups.tsx
