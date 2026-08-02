/**
 * Credits.tsx (admin)
 * Users, the financial ledger, and manual refunds.
 *
 * The top-balances chart compares one measure across users, so it uses a single
 * hue - cycling colours there would restate the axis and imply a category that
 * does not exist. Every plotted value is in the table underneath.
 */

// File: silkllm-frontend/src/pages/admin/Credits.tsx

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BookOpen, Gift, TrendingUp, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Badge, Button, EmptyState, Field, Input, PageHeader, Pagination, Panel,
  SearchInput, Select, Skeleton, StatTile, Tabs, Toolbar,
} from "@/components/ui";
import { ChartTooltip, compact, usdPrecise, usdShort, useChartTheme } from "@/lib/charts";

type Tab = "users" | "ledger" | "refund";

export default function AdminCredits() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("users");
  const [ledgerPage, setLedgerPage] = useState(1);
  const [refund, setRefund] = useState({ user_id: "", amount_usd: "", reason: "" });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const t = useChartTheme();

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

  const issueRefund = useMutation({
    mutationFn: () => adminApi.credits.refund({
      user_id: refund.user_id,
      amount_usd: parseFloat(refund.amount_usd),
      reason: refund.reason,
    }),
    onSuccess: () => {
      toast.success("Refund issued.");
      setRefund({ user_id: "", amount_usd: "", reason: "" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => toast.error(e.response?.data?.detail || "Refund failed."),
  });

  const all = users || [];
  const q = search.trim().toLowerCase();
  const filtersActive = !!q || role !== "all" || statusFilter !== "all";

  const filtered = useMemo(() => all.filter((u: any) => {
    if (role !== "all" && u.role !== role) return false;
    if (statusFilter === "active" && !u.is_active) return false;
    if (statusFilter === "suspended" && u.is_active) return false;
    if (q && !`${u.name || ""} ${u.email || ""}`.toLowerCase().includes(q)) return false;
    return true;
  }), [all, role, statusFilter, q]);

  const totals = useMemo(() => ({
    balance: all.reduce((s: number, u: any) => s + (u.balance || 0), 0),
    active: all.filter((u: any) => u.is_active).length,
    admins: all.filter((u: any) => u.role === "admin" || u.role === "super_admin").length,
  }), [all]);

  const topBalances = useMemo(
    () => all.slice()
      .sort((a: any, b: any) => b.balance - a.balance)
      .slice(0, 8)
      .map((u: any) => ({ name: (u.email || "").split("@")[0].slice(0, 12), balance: u.balance })),
    [all],
  );

  const clearFilters = () => { setSearch(""); setRole("all"); setStatusFilter("all"); };
  const selectedUser = all.find((u: any) => u.id === refund.user_id);
  const refundValid = refund.user_id && parseFloat(refund.amount_usd) > 0 && refund.reason.trim();

  return (
    <DashboardLayout>
      <PageHeader
        title="Credits & Users"
        subtitle="Account balances, the append-only ledger, and manual credit adjustments."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Users" value={compact(all.length)} icon={<Users size={14} />} hint={`${totals.active} active`} />
        <StatTile label="Credits held" value={usdShort(totals.balance)} icon={<TrendingUp size={14} />} accent hint="Sum of all balances" />
        <StatTile label="Admins" value={totals.admins} icon={<Users size={14} />} />
        <StatTile
          label="Average balance"
          value={usdShort(all.length ? totals.balance / all.length : 0)}
          icon={<TrendingUp size={14} />}
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "users",  label: "Users",  icon: <Users size={15} />,   count: all.length || undefined },
          { value: "ledger", label: "Ledger", icon: <BookOpen size={15} /> },
          { value: "refund", label: "Refund", icon: <Gift size={15} /> },
        ]}
      />

      {tab === "users" && (
        <>
          {topBalances.length > 1 && (
            <Panel title="Top balances" description="The eight largest account balances." icon={<TrendingUp size={15} />}>
              <div className="px-2 pb-4 pt-3">
                <ResponsiveContainer width="100%" height={190}>
                  <BarChart data={topBalances} margin={{ top: 8, right: 16, bottom: 24, left: 4 }} barCategoryGap="28%">
                    <CartesianGrid {...t.gridProps} />
                    <XAxis dataKey="name" {...t.axisProps} interval={0} angle={-18} textAnchor="end" height={46} />
                    <YAxis {...t.axisProps} width={60} tickFormatter={(v: number) => usdShort(v)} />
                    <Tooltip
                      cursor={{ fill: t.grid, opacity: 0.5 }}
                      content={<ChartTooltip formatter={(v: any) => usdPrecise(Number(v))} />}
                    />
                    {/* One measure across entities - a single hue, not a rainbow. */}
                    <Bar dataKey="balance" name="Balance" fill={t.seriesAt(0)} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          )}

          <Panel
            title="Accounts"
            icon={<Users size={15} />}
            actions={
              <Toolbar>
                <SearchInput value={search} onChange={setSearch} placeholder="Name or email" className="w-full sm:w-56" />
                <Select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 text-xs w-auto" aria-label="Role">
                  <option value="all">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">User</option>
                </Select>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 text-xs w-auto" aria-label="Status">
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </Select>
                {filtersActive && (
                  <button onClick={clearFilters} className="text-xs text-accent-ink hover:underline inline-flex items-center gap-1 h-8 px-1">
                    <X size={12} /> Clear
                  </button>
                )}
              </Toolbar>
            }
            footer={
              all.length > 0 ? (
                <p className="text-xs text-ink-3 num">Showing {filtered.length} of {all.length} users</p>
              ) : undefined
            }
          >
            {usersLoading ? (
              <div className="p-5 space-y-2.5">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : !filtered.length ? (
              <EmptyState
                icon={<Users size={19} />}
                title={all.length ? "No users match these filters" : "No users yet"}
                hint={all.length ? "Try widening the search." : undefined}
                action={all.length ? <Button size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
              />
            ) : (
              <div className="scroll-x">
                <table className="table-shell">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th className="text-right">Balance</th>
                      <th>Status</th>
                      <th className="text-right">Joined</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u: any) => (
                      <tr key={u.id}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-full bg-ink/[0.06] border border-line text-2xs font-semibold text-ink-2 flex items-center justify-center shrink-0 uppercase">
                              {(u.name || u.email || "?")[0]}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm text-ink truncate">{u.name || "-"}</span>
                              <span className="block text-2xs text-ink-3 truncate">{u.email}</span>
                            </span>
                          </div>
                        </td>
                        <td><Badge tone={u.role === "user" ? "neutral" : "brand"}>{u.role}</Badge></td>
                        <td className="text-right num text-sm text-ink font-medium">${u.balance.toFixed(4)}</td>
                        <td><Badge tone={u.is_active ? "success" : "error"}>{u.is_active ? "Active" : "Suspended"}</Badge></td>
                        <td className="text-right num text-xs text-ink-2">{format(new Date(u.created_at), "MMM d, yyyy")}</td>
                        <td>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Gift size={13} />}
                              onClick={() => { setRefund({ user_id: u.id, amount_usd: "", reason: "" }); setTab("refund"); }}
                            >
                              Refund
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === "ledger" && (
        <Panel
          title="Ledger"
          description="Append-only record of every balance movement."
          icon={<BookOpen size={15} />}
          footer={<Pagination page={ledgerPage} onPage={setLedgerPage} unit="entries" />}
        >
          {ledgerLoading ? (
            <div className="p-5 space-y-2.5">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
          ) : !ledger?.length ? (
            <EmptyState icon={<BookOpen size={19} />} title="No ledger entries" hint="Balance movements will appear here as they happen." />
          ) : (
            <div className="scroll-x">
              <table className="table-shell">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Type</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Balance after</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e: any) => (
                    <tr key={e.id}>
                      <td className="text-xs text-ink-2 num whitespace-nowrap">
                        {format(new Date(e.created_at), "MMM d, HH:mm")}
                      </td>
                      <td className="text-xs text-ink-2 max-w-[200px] truncate">{e.user_email || "-"}</td>
                      <td><Badge tone="neutral">{e.entry_type}</Badge></td>
                      <td className={`text-right num text-xs font-medium ${e.amount < 0 ? "text-ink" : "text-success"}`}>
                        {e.amount < 0 ? "-" : "+"}${Math.abs(e.amount).toFixed(6)}
                      </td>
                      <td className="text-right num text-xs text-ink-2">${e.balance_after.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {tab === "refund" && (
        <Panel
          title="Issue a credit refund"
          description="Adds credit to a user's balance and writes a ledger entry. There is no undo."
          icon={<Gift size={15} />}
          className="max-w-xl"
        >
          <div className="px-5 sm:px-6 py-5 space-y-4">
            <Field label="User" required>
              <Select value={refund.user_id} onChange={(e) => setRefund((f) => ({ ...f, user_id: e.target.value }))}>
                <option value="">Select a user...</option>
                {all.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.email} - ${u.balance.toFixed(2)}</option>
                ))}
              </Select>
            </Field>

            {selectedUser && (
              <div className="rounded-xl border border-line bg-sunken px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink truncate">{selectedUser.name || selectedUser.email}</p>
                  <p className="text-2xs text-ink-3 num mt-0.5">Current balance ${selectedUser.balance.toFixed(4)}</p>
                </div>
                {parseFloat(refund.amount_usd) > 0 && (
                  <div className="text-right shrink-0">
                    <p className="text-2xs text-ink-3">After refund</p>
                    <p className="text-sm font-medium text-success num">
                      ${(selectedUser.balance + parseFloat(refund.amount_usd)).toFixed(4)}
                    </p>
                  </div>
                )}
              </div>
            )}

            <Field label="Amount (USD)" required>
              <Input
                type="number" step="0.01" min="0.01" className="num"
                placeholder="5.00"
                value={refund.amount_usd}
                onChange={(e) => setRefund((f) => ({ ...f, amount_usd: e.target.value }))}
              />
            </Field>

            <Field label="Reason" required hint="Recorded on the ledger entry for audit.">
              <Input
                placeholder="Customer service credit - duplicate charge"
                value={refund.reason}
                onChange={(e) => setRefund((f) => ({ ...f, reason: e.target.value }))}
              />
            </Field>

            <Button
              variant="primary"
              className="w-full"
              disabled={!refundValid}
              loading={issueRefund.isPending}
              onClick={() => issueRefund.mutate()}
            >
              Issue refund
            </Button>
          </div>
        </Panel>
      )}
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Credits.tsx
