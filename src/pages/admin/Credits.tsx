/**
 * Credits.tsx
 * Admin page - financial ledger view, user list with balances, issue refunds.
 */

// File: silkllm-frontend/src/pages/admin/Credits.tsx

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, BookOpen, Gift } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import { format } from "date-fns";

const BAL_COLORS = ["#D29A2D", "#D0C51E", "#B5B86B", "#FAC059", "#DCE083", "#A87B22", "#8F9254", "#7D5A17"];

type Tab = "ledger" | "users" | "refund";

export default function AdminCredits() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("users");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [refundForm, setRefundForm] = useState({ user_id: "", amount_usd: "", reason: "" });

  const { data: ledger, isLoading: ledgerLoading } = useQuery({
    queryKey: ["admin-ledger", ledgerPage],
    queryFn: () => adminApi.credits.ledger(ledgerPage).then((r) => r.data),
    enabled: tab === "ledger",
  });

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.credits.users().then((r) => r.data),
    enabled: tab === "users" || tab === "refund",
  });

  const refundMutation = useMutation({
    mutationFn: () => adminApi.credits.refund({
      user_id: refundForm.user_id,
      amount_usd: parseFloat(refundForm.amount_usd),
      reason: refundForm.reason,
    }),
    onSuccess: () => {
      toast.success("Refund issued successfully.");
      setRefundForm({ user_id: "", amount_usd: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: () => toast.error("Refund failed."),
  });

  const topBalances = useMemo(() =>
    (users || []).slice().sort((a: any, b: any) => b.balance - a.balance).slice(0, 8)
      .map((u: any) => ({ name: (u.email || "").split("@")[0].slice(0, 12), balance: u.balance })),
  [users]);

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "users",  label: "Users",   icon: <Users size={16} /> },
    { key: "ledger", label: "Ledger",  icon: <BookOpen size={16} /> },
    { key: "refund", label: "Refund",  icon: <Gift size={16} /> },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">Credits & Users</h1>
          <p className="text-warm-grey mt-1">View the financial ledger, manage user balances, and issue refunds.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-cloud-grey dark:border-muted-metal pb-0">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                      tab === t.key
                        ? "border-silk-gold text-silk-gold"
                        : "border-transparent text-warm-grey hover:text-cloud-grey"
                    }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {tab === "users" && (
          <>
            {topBalances.length > 1 && (
              <div className="card">
                <p className="text-xs text-warm-grey uppercase tracking-wide mb-2">Top balances</p>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={topBalances}>
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#C2C9CC" }} interval={0} angle={-20} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 11, fill: "#C2C9CC" }} width={44} />
                    <Tooltip formatter={(v: any) => `$${Number(v).toFixed(4)}`} contentStyle={{ background: "#383B3D", border: "none", borderRadius: 8, color: "#EDEFF0" }} />
                    <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                      {topBalances.map((_: any, i: number) => <Cell key={i} fill={BAL_COLORS[i % BAL_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cloud-grey dark:bg-deep-charcoal border-b border-muted-metal">
                <tr>
                  {["Name", "Email", "Role", "Balance", "Status", "Joined"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs text-warm-grey font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cloud-grey dark:divide-muted-metal">
                {usersLoading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-warm-grey">Loading...</td></tr>
                ) : users?.map((u: any) => (
                  <tr key={u.id} className="hover:bg-soft-cream dark:hover:bg-slate-dark">
                    <td className="px-4 py-3 font-medium text-deep-charcoal dark:text-cloud-grey">{u.name}</td>
                    <td className="px-4 py-3 text-warm-grey text-xs">{u.email}</td>
                    <td className="px-4 py-3"><span className={`badge-${u.role === "admin" ? "warning" : "info"}`}>{u.role}</span></td>
                    <td className="px-4 py-3 text-silk-gold font-semibold">${u.balance.toFixed(4)}</td>
                    <td className="px-4 py-3"><span className={`badge-${u.is_active ? "success" : "error"}`}>{u.is_active ? "Active" : "Suspended"}</span></td>
                    <td className="px-4 py-3 text-warm-grey text-xs">{format(new Date(u.created_at), "MMM d, yyyy")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          </>
        )}

        {/* Ledger tab */}
        {tab === "ledger" && (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cloud-grey dark:bg-deep-charcoal border-b border-muted-metal">
                  <tr>
                    {["Time", "User", "Type", "Amount", "Balance After"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-warm-grey font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-cloud-grey dark:divide-muted-metal">
                  {ledgerLoading ? (
                    <tr><td colSpan={5} className="text-center py-8 text-warm-grey">Loading...</td></tr>
                  ) : ledger?.map((e: any) => (
                    <tr key={e.id} className="hover:bg-soft-cream dark:hover:bg-slate-dark">
                      <td className="px-4 py-3 text-warm-grey text-xs">{format(new Date(e.created_at), "MMM d HH:mm")}</td>
                      <td className="px-4 py-3 text-xs text-warm-grey">{e.user_email || "-"}</td>
                      <td className="px-4 py-3"><span className="badge-info">{e.entry_type}</span></td>
                      <td className={`px-4 py-3 font-semibold text-sm ${e.amount < 0 ? "text-red-400" : "text-green-400"}`}>
                        {e.amount > 0 ? "+" : ""}${Math.abs(e.amount).toFixed(6)}
                      </td>
                      <td className="px-4 py-3 text-warm-grey text-xs">${e.balance_after.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 p-3 border-t border-cloud-grey dark:border-muted-metal">
              <button onClick={() => setLedgerPage(p => Math.max(1, p - 1))} disabled={ledgerPage === 1}
                      className="px-3 py-1.5 text-sm text-warm-grey disabled:opacity-40 min-h-[36px]">Previous</button>
              <span className="px-3 py-1.5 text-sm text-warm-grey">Page {ledgerPage}</span>
              <button onClick={() => setLedgerPage(p => p + 1)}
                      className="px-3 py-1.5 text-sm text-warm-grey min-h-[36px]">Next</button>
            </div>
          </div>
        )}

        {/* Refund tab */}
        {tab === "refund" && (
          <div className="card max-w-lg">
            <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-4">Issue Credit Refund</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-warm-grey mb-1.5">User *</label>
                <select value={refundForm.user_id}
                        onChange={(e) => setRefundForm(f => ({ ...f, user_id: e.target.value }))}
                        className="input">
                  <option value="">Select user...</option>
                  {users?.map((u: any) => (
                    <option key={u.id} value={u.id}>{u.email} (${u.balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-warm-grey mb-1.5">Amount USD *</label>
                <input type="number" step="0.01" min="0.01" value={refundForm.amount_usd}
                       onChange={(e) => setRefundForm(f => ({ ...f, amount_usd: e.target.value }))}
                       className="input" placeholder="5.00" />
              </div>
              <div>
                <label className="block text-sm text-warm-grey mb-1.5">Reason *</label>
                <input type="text" value={refundForm.reason}
                       onChange={(e) => setRefundForm(f => ({ ...f, reason: e.target.value }))}
                       className="input" placeholder="e.g., Customer service credit" />
              </div>
              <button onClick={() => refundMutation.mutate()}
                      disabled={!refundForm.user_id || !refundForm.amount_usd || !refundForm.reason || refundMutation.isPending}
                      className="btn-primary w-full disabled:opacity-50">
                {refundMutation.isPending ? "Processing..." : "Issue Refund"}
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Credits.tsx
