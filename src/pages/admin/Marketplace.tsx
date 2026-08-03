/**
 * Marketplace.tsx (admin)
 * Full visibility into the BYOK marketplace: the value it has created, every
 * deposited key, per-owner delivery against declared budgets, and suspend /
 * reactivate control. Regular users never see any of this.
 *
 * The by-provider chart is a magnitude comparison of one measure, so it uses a
 * single hue - colour would be restating the axis. Every plotted value is also
 * present in the tables below.
 */

// File: silkllm-frontend/src/pages/admin/Marketplace.tsx

import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  Coins, Gift, Pause, PiggyBank, Play, Store, TrendingUp, Users,
} from "lucide-react";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { adminApi } from "@/services/api";
import {
  Badge, EmptyState, IconButton, Meter, PageHeader, Panel, SearchInput, Select,
  Skeleton, StatTile, Toolbar,
} from "@/components/ui";
import { ChartTooltip, compact, usd, usdPrecise, usdShort, useChartTheme } from "@/lib/charts";

export default function Marketplace() {
  const qc = useQueryClient();
  const [sort, setSort] = useState("highest");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const t = useChartTheme();

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["mkt-analytics"],
    queryFn: () => adminApi.marketplace.analytics().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: keysData, isLoading: keysLoading } = useQuery({
    queryKey: ["mkt-keys", sort, search, status],
    queryFn: () => adminApi.marketplace.keys({
      sort, search: search || undefined, status: status || undefined, page: 1, page_size: 50,
    }).then((r) => r.data),
  });

  const { data: owners } = useQuery({
    queryKey: ["mkt-owners"],
    queryFn: () => adminApi.marketplace.owners().then((r) => r.data),
  });

  const suspend = useMutation({
    mutationFn: (id: string) => adminApi.marketplace.suspend(id),
    onSuccess: () => { toast.success("Key suspended."); qc.invalidateQueries({ queryKey: ["mkt-keys"] }); },
    onError: () => toast.error("Could not suspend the key."),
  });
  const activate = useMutation({
    mutationFn: (id: string) => adminApi.marketplace.activate(id),
    onSuccess: () => { toast.success("Key reactivated."); qc.invalidateQueries({ queryKey: ["mkt-keys"] }); },
    onError: () => toast.error("Could not reactivate the key."),
  });

  const byProvider = useMemo(
    () => (analytics?.by_provider || [])
      .map((p: any) => ({ name: p.provider_id, value: p.provider_cost_served }))
      .sort((a: any, b: any) => b.value - a.value),
    [analytics],
  );

  const keys = keysData?.keys || [];
  const ownerRows = owners || [];

  return (
    <DashboardLayout>
      <PageHeader
        title="Marketplace"
        subtitle="What depositor keys have delivered, and full control over every key in the pool."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Provider cost served" value={usdPrecise(analytics?.total_provider_cost_served || 0)} icon={<PiggyBank size={14} />} accent hint="Cost the platform avoided" />
        <StatTile label="Owner earnings" value={usdPrecise(analytics?.total_owner_earnings || 0)} icon={<Coins size={14} />} hint="Credits paid to depositors" />
        <StatTile label="Platform fee" value={usdPrecise(analytics?.total_platform_fee || 0)} icon={<TrendingUp size={14} />} hint="Retained margin" />
        <StatTile label="Free value served" value={usdPrecise(analytics?.total_free_value_served || 0)} icon={<Gift size={14} />} hint="From free keys" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <Panel title="Key pool" icon={<Store size={15} />}>
          <div className="px-5 sm:px-6 py-5 space-y-4">
            <div>
              <p className="text-[1.75rem] leading-none font-semibold tracking-tight text-ink">
                {analytics?.total_keys || 0}
              </p>
              <p className="text-xs text-ink-3 mt-1.5 num">
                {analytics?.public_keys || 0} public · {analytics?.private_keys || 0} private
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">{analytics?.active_keys || 0} active</Badge>
              <Badge tone="warning">{analytics?.suspended_keys || 0} suspended</Badge>
            </div>
            {(analytics?.total_keys || 0) > 0 && (
              <div>
                <Meter
                  value={((analytics?.active_keys || 0) / (analytics?.total_keys || 1)) * 100}
                  tone="success"
                  size="sm"
                />
                <p className="text-2xs text-ink-3 mt-1.5">Share of the pool currently serving.</p>
              </div>
            )}
          </div>
        </Panel>

        <Panel
          title="Provider cost served, by provider"
          description="How much upstream spend depositor keys absorbed."
          icon={<TrendingUp size={15} />}
          className="lg:col-span-2"
        >
          {analyticsLoading ? (
            <div className="p-5"><Skeleton className="h-40" /></div>
          ) : !byProvider.length ? (
            <EmptyState icon={<Store size={19} />} title="Nothing served yet" hint="Once depositor keys serve traffic, the split by provider appears here." />
          ) : (
            <div className="px-2 pb-4 pt-3">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={byProvider} margin={{ top: 8, right: 16, bottom: 0, left: 4 }} barCategoryGap="28%">
                  <CartesianGrid {...t.gridProps} />
                  <XAxis dataKey="name" {...t.axisProps} />
                  <YAxis {...t.axisProps} width={64} tickFormatter={(v: number) => usdShort(v)} />
                  <Tooltip
                    cursor={{ fill: t.grid, opacity: 0.5 }}
                    content={<ChartTooltip formatter={(v: any) => usdPrecise(Number(v))} />}
                  />
                  {/* One measure, one hue - the axis already carries magnitude. */}
                  <Bar dataKey="value" name="Cost served" fill={t.seriesAt(0)} radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      {/* Keys */}
      <Panel
        title="Deposited keys"
        description={keysData ? `${keys.length} shown` : undefined}
        icon={<Store size={15} />}
        actions={
          <Toolbar>
            <SearchInput value={search} onChange={setSearch} placeholder="Owner email or label" className="w-full sm:w-52" />
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 text-xs w-auto" aria-label="Sort">
              <option value="highest">Highest providing</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 text-xs w-auto" aria-label="Status">
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="exhausted">Exhausted</option>
            </Select>
          </Toolbar>
        }
      >
        {keysLoading ? (
          <div className="p-5 space-y-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : !keys.length ? (
          <EmptyState icon={<Store size={19} />} title="No keys match" hint="Adjust the search or status filter." />
        ) : (
          <div className="scroll-x">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Provider</th>
                  <th>Visibility</th>
                  <th>Status</th>
                  <th className="text-right">Earned</th>
                  <th className="text-right">Served</th>
                  <th className="text-right">Delivered</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {keys.map((k: any) => (
                  <tr key={k.id}>
                    <td className="text-sm text-ink max-w-[180px] truncate">{k.owner_email}</td>
                    <td><Badge tone="neutral">{k.provider_id}</Badge></td>
                    <td className="text-xs text-ink-2">{k.is_public ? "Public" : "Private"}</td>
                    <td>
                      <Badge tone={k.status === "active" ? "success" : k.status === "revoked" ? "error" : "warning"}>
                        {k.status}
                      </Badge>
                    </td>
                    <td className="text-right num text-xs text-ink font-medium">{usdPrecise(k.earned_credits_total)}</td>
                    <td className="text-right num text-xs text-ink-2">{compact(k.requests_served)}</td>
                    <td className="text-right num text-xs text-ink-2">
                      {usdPrecise(k.provider_cost_served)}
                      {k.declared_budget_usd > 0 && <span className="text-ink-3"> / ${k.declared_budget_usd}</span>}
                    </td>
                    <td>
                      <div className="flex justify-end">
                        {k.status === "active" ? (
                          <IconButton label="Suspend key" size={32} tone="danger" onClick={() => suspend.mutate(k.id)}>
                            <Pause size={14} />
                          </IconButton>
                        ) : k.status !== "revoked" ? (
                          <IconButton label="Reactivate key" size={32} onClick={() => activate.mutate(k.id)}>
                            <Play size={14} />
                          </IconButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Owners */}
      <Panel
        title="Depositors: declared vs delivered"
        description="How much of each owner's stated budget has actually been consumed."
        icon={<Users size={15} />}
      >
        {!ownerRows.length ? (
          <EmptyState icon={<Users size={19} />} title="No depositors yet" hint="Users who deposit provider keys will be listed here." />
        ) : (
          <div className="scroll-x">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th className="text-right">Keys</th>
                  <th className="text-right">Declared</th>
                  <th className="text-right">Delivered</th>
                  <th>Fulfilled</th>
                  <th className="text-right">Earned</th>
                </tr>
              </thead>
              <tbody>
                {ownerRows.map((o: any) => (
                  <tr key={o.owner_id}>
                    <td className="text-sm text-ink max-w-[200px] truncate">{o.owner_email}</td>
                    <td className="text-right num text-xs text-ink-2">{o.keys}</td>
                    <td className="text-right num text-xs text-ink-2">{usd(o.declared_budget_usd)}</td>
                    <td className="text-right num text-xs text-ink-2">{usdPrecise(o.delivered_usd)}</td>
                    <td className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <Meter value={o.fulfillment_pct} size="sm" tone={o.fulfillment_pct >= 90 ? "success" : "accent"} />
                        <span className="text-2xs text-ink-2 num shrink-0 w-9 text-right">{o.fulfillment_pct}%</span>
                      </div>
                    </td>
                    <td className="text-right num text-xs text-ink font-medium">{usdPrecise(o.earned_credits_total)}</td>
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

// EOF silkllm-frontend/src/pages/admin/Marketplace.tsx
