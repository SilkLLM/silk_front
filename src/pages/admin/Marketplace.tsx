/**
 * Marketplace.tsx (admin)
 * Full visibility into the BYOK marketplace: value created, every deposited key
 * (sortable and searchable), per-owner delivery vs their declared target, and
 * force suspend / reactivate. Regular users never see any of this.
 */

// File: silkllm-frontend/src/pages/admin/Marketplace.tsx

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Store, Search, Pause, Play, TrendingUp, PiggyBank, Coins, Gift } from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { StatTile } from "@/components/ui";
import { adminApi } from "@/services/api";

const CHART_COLORS = ["#D29A2D", "#D0C51E", "#B5B86B", "#FAC059", "#DCE083"];

function money(n: number) { return `$${(n || 0).toFixed(4)}`; }

export default function Marketplace() {
  const qc = useQueryClient();
  const [sort, setSort] = useState("highest");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const { data: analytics } = useQuery({
    queryKey: ["mkt-analytics"],
    queryFn: () => adminApi.marketplace.analytics().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: keysData } = useQuery({
    queryKey: ["mkt-keys", sort, search, status],
    queryFn: () => adminApi.marketplace.keys({ sort, search: search || undefined, status: status || undefined, page: 1, page_size: 50 }).then((r) => r.data),
  });

  const { data: owners } = useQuery({
    queryKey: ["mkt-owners"],
    queryFn: () => adminApi.marketplace.owners().then((r) => r.data),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => adminApi.marketplace.suspend(id),
    onSuccess: () => { toast.success("Key suspended"); qc.invalidateQueries({ queryKey: ["mkt-keys"] }); },
  });
  const activate = useMutation({
    mutationFn: (id: string) => adminApi.marketplace.activate(id),
    onSuccess: () => { toast.success("Key reactivated"); qc.invalidateQueries({ queryKey: ["mkt-keys"] }); },
  });

  const byProvider = (analytics?.by_provider || []).map((p: any) => ({ name: p.provider_id, value: p.provider_cost_served }));

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey flex items-center gap-2">
            <Store size={22} className="text-silk-gold" /> Marketplace
          </h1>
          <p className="text-warm-grey mt-1">Value the marketplace has created, and full control over deposited keys.</p>
        </div>

        {/* Analytics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile icon={<PiggyBank size={13} />} label="Cost saved" value={money(analytics?.total_provider_cost_served || 0)} accent />
          <StatTile icon={<Coins size={13} />} label="Owner earnings" value={money(analytics?.total_owner_earnings || 0)} />
          <StatTile icon={<TrendingUp size={13} />} label="Platform fee" value={money(analytics?.total_platform_fee || 0)} />
          <StatTile icon={<Gift size={13} />} label="Free value served" value={money(analytics?.total_free_value_served || 0)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-xs text-warm-grey uppercase tracking-wide mb-1">Keys</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">{analytics?.total_keys || 0}</span>
              <span className="text-xs text-warm-grey">{analytics?.public_keys || 0} public / {analytics?.private_keys || 0} private</span>
            </div>
            <div className="mt-2 flex gap-2 text-xs">
              <span className="badge-success">{analytics?.active_keys || 0} active</span>
              <span className="badge-warning">{analytics?.suspended_keys || 0} suspended</span>
            </div>
          </div>
          <div className="card lg:col-span-2">
            <p className="text-xs text-warm-grey uppercase tracking-wide mb-2">Provider cost served, by provider</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={byProvider}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#C2C9CC" }} />
                <YAxis tick={{ fontSize: 11, fill: "#C2C9CC" }} width={40} />
                <Tooltip formatter={(v: any) => money(v)} contentStyle={{ background: "#383B3D", border: "none", borderRadius: 8, color: "#EDEFF0" }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {byProvider.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Keys table */}
        <div className="card">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey">Deposited keys</h2>
            <div className="flex-1" />
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-grey" />
              <input className="input pl-8 py-1.5 text-sm" placeholder="owner email or label"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="input py-1.5 text-sm w-auto" value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="highest">Highest providing</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </select>
            <select className="input py-1.5 text-sm w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="exhausted">Exhausted</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-warm-grey uppercase tracking-wide border-b border-muted-metal/40">
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Vis</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Earned</th>
                  <th className="py-2 pr-3 text-right">Served</th>
                  <th className="py-2 pr-3 text-right">Delivered</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {(keysData?.keys || []).map((k: any) => (
                  <tr key={k.id} className="border-b border-muted-metal/20">
                    <td className="py-2 pr-3 text-deep-charcoal dark:text-cloud-grey truncate max-w-[160px]">{k.owner_email}</td>
                    <td className="py-2 pr-3"><span className="badge-info">{k.provider_id}</span></td>
                    <td className="py-2 pr-3 text-warm-grey">{k.is_public ? "public" : "private"}</td>
                    <td className="py-2 pr-3">
                      <span className={k.status === "active" ? "badge-success" : "badge-warning"}>{k.status}</span>
                    </td>
                    <td className="py-2 pr-3 text-right text-silk-gold">{money(k.earned_credits_total)}</td>
                    <td className="py-2 pr-3 text-right text-warm-grey">{k.requests_served}</td>
                    <td className="py-2 pr-3 text-right text-warm-grey">
                      {money(k.provider_cost_served)}{k.declared_budget_usd > 0 ? ` / $${k.declared_budget_usd}` : ""}
                    </td>
                    <td className="py-2 text-right">
                      {k.status === "active" ? (
                        <button onClick={() => suspend.mutate(k.id)} className="text-warm-grey hover:text-red-400" title="Suspend"><Pause size={15} /></button>
                      ) : k.status !== "revoked" ? (
                        <button onClick={() => activate.mutate(k.id)} className="text-warm-grey hover:text-warm-olive" title="Reactivate"><Play size={15} /></button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(keysData?.keys || []).length === 0 && <p className="text-warm-grey text-sm py-4">No keys match.</p>}
          </div>
        </div>

        {/* Owners: declared vs delivered */}
        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-4">Providers: declared vs delivered</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-warm-grey uppercase tracking-wide border-b border-muted-metal/40">
                  <th className="py-2 pr-3">Owner</th>
                  <th className="py-2 pr-3 text-right">Keys</th>
                  <th className="py-2 pr-3 text-right">Declared</th>
                  <th className="py-2 pr-3 text-right">Delivered</th>
                  <th className="py-2 pr-3 text-right">Fulfilled</th>
                  <th className="py-2 pr-3 text-right">Earned</th>
                </tr>
              </thead>
              <tbody>
                {(owners || []).map((o: any) => (
                  <tr key={o.owner_id} className="border-b border-muted-metal/20">
                    <td className="py-2 pr-3 text-deep-charcoal dark:text-cloud-grey truncate max-w-[180px]">{o.owner_email}</td>
                    <td className="py-2 pr-3 text-right text-warm-grey">{o.keys}</td>
                    <td className="py-2 pr-3 text-right text-warm-grey">${o.declared_budget_usd.toFixed(2)}</td>
                    <td className="py-2 pr-3 text-right text-warm-grey">{money(o.delivered_usd)}</td>
                    <td className="py-2 pr-3 text-right text-deep-charcoal dark:text-cloud-grey">{o.fulfillment_pct}%</td>
                    <td className="py-2 pr-3 text-right text-silk-gold">{money(o.earned_credits_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(owners || []).length === 0 && <p className="text-warm-grey text-sm py-4">No providers yet.</p>}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/Marketplace.tsx
