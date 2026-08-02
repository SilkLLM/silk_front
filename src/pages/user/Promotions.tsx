/**
 * Promotions.tsx
 * Redeeming a promo code, and seeing what it is doing for you.
 *
 * The one thing this page has to be relentless about is what a discount is. It
 * comes off SilkLLM's own fee, the margin added on top of what a request costs
 * to serve. It is not free credit, it does not change the balance, and it does
 * not change what the provider charges. Every panel here repeats that in one
 * form or another, because "25% off" and "25% more credit" are easy to conflate
 * and only one of them is true.
 */

// File: silkllm-frontend/src/pages/user/Promotions.tsx

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent, Check, Clock, Gift, Info, Sparkles, Tag, TrendingDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { MyPromotion, promotionsApi } from "@/services/api";
import {
  Badge, Button, Callout, EmptyState, Input, PageHeader, Panel, Skeleton, StatTile,
} from "@/components/ui";
import { usdPrecise } from "@/lib/charts";

/** A live discount, shown as the headline of the page. */
function ActiveDiscount({ promo }: { promo: MyPromotion }) {
  const full = promo.discount_percent >= 100;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent/25 bg-accent/[0.06] p-6 sm:p-7">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/15 blur-2xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge tone="brand" icon={<Sparkles size={10} />}>Active</Badge>
          <span className="text-xs text-ink-2">{promo.promotion_name}</span>
        </div>

        <p className="mt-3 text-3xl sm:text-4xl font-semibold text-ink tracking-tight num">
          {full ? "No SilkLLM fees" : `${promo.discount_percent}% off fees`}
        </p>
        <p className="mt-2 text-sm text-ink-2 max-w-xl leading-relaxed">{promo.summary}</p>

        <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          <div>
            <p className="text-2xs uppercase tracking-wide text-ink-3">Saved so far</p>
            <p className="text-sm font-medium text-ink num mt-0.5">
              {usdPrecise(promo.fee_saved_usd)}
            </p>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wide text-ink-3">Requests discounted</p>
            <p className="text-sm font-medium text-ink num mt-0.5">
              {promo.uses_count.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-2xs uppercase tracking-wide text-ink-3">Runs until</p>
            <p className="text-sm font-medium text-ink num mt-0.5">
              {promo.expires_at ? format(new Date(promo.expires_at), "d MMM yyyy") : "No end date"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** One row in the history list. */
function PromotionRow({ promo }: { promo: MyPromotion }) {
  const expired = !promo.is_active;
  return (
    <li className="px-5 sm:px-6 py-4">
      <div className="flex items-start gap-3 flex-wrap">
        <span className={clsx(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
          expired
            ? "bg-ink/[0.04] border-line text-ink-3"
            : "bg-accent/10 border-accent/20 text-accent-ink",
        )}>
          <BadgePercent size={16} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-ink truncate">{promo.promotion_name}</span>
            {expired
              ? <Badge tone="neutral">Ended</Badge>
              : <Badge tone="success"><Check size={10} /> Active</Badge>}
            <Badge tone="brand">{promo.discount_percent}% off fees</Badge>
          </div>
          <p className="text-2xs text-ink-3 mt-1 leading-relaxed">{promo.summary}</p>
          <p className="text-2xs text-ink-3 mt-1 num">
            Redeemed {format(new Date(promo.redeemed_at), "d MMM yyyy")}
            {promo.uses_count > 0 && `, used on ${promo.uses_count.toLocaleString()} request${promo.uses_count === 1 ? "" : "s"}`}
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-2xs uppercase tracking-wide text-ink-3">Saved</p>
          <p className="text-sm font-medium text-ink num">{usdPrecise(promo.fee_saved_usd)}</p>
        </div>
      </div>
    </li>
  );
}

export default function Promotions() {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [justRedeemed, setJustRedeemed] = useState<MyPromotion | null>(null);

  const { data: mine, isLoading } = useQuery<MyPromotion[]>({
    queryKey: ["my-promotions"],
    queryFn: () => promotionsApi.mine().then((r) => r.data),
  });
  const { data: active } = useQuery<MyPromotion | null>({
    queryKey: ["active-promotion"],
    queryFn: () => promotionsApi.active().then((r) => r.data),
  });

  const redeem = useMutation({
    mutationFn: () => promotionsApi.redeem(code.trim()).then((r) => r.data),
    onSuccess: (data: MyPromotion) => {
      setJustRedeemed(data);
      setCode("");
      toast.success("Code redeemed.");
      qc.invalidateQueries({ queryKey: ["my-promotions"] });
      qc.invalidateQueries({ queryKey: ["active-promotion"] });
    },
    onError: (e: any) =>
      toast.error(
        e?.response?.data?.error?.message
          || e?.response?.data?.detail
          || "That code could not be redeemed.",
      ),
  });

  const list = mine || [];
  const totalSaved = list.reduce((s, p) => s + (p.fee_saved_usd || 0), 0);
  const totalUses = list.reduce((s, p) => s + (p.uses_count || 0), 0);
  const liveCount = list.filter((p) => p.is_active).length;

  return (
    <DashboardLayout>
      <PageHeader
        title="Promotions"
        subtitle="Redeem a code to reduce the SilkLLM fee on your requests. Your credit balance and what the provider charges are never affected."
        meta={
          list.length > 0 ? (
            <>
              <Badge tone="neutral">{list.length} redeemed</Badge>
              {liveCount > 0 && <Badge tone="brand">{liveCount} active</Badge>}
            </>
          ) : undefined
        }
      />

      {active && <ActiveDiscount promo={active} />}

      {list.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatTile
            label="Fees saved"
            value={usdPrecise(totalSaved)}
            icon={<TrendingDown size={14} />}
            accent
            hint="Across every promotion"
          />
          <StatTile
            label="Requests discounted"
            value={totalUses.toLocaleString()}
            icon={<Tag size={14} />}
          />
          <StatTile
            label="Active discounts"
            value={liveCount}
            icon={<BadgePercent size={14} />}
            hint={liveCount > 1 ? "The largest one applies" : undefined}
          />
        </div>
      )}

      <Panel title="Redeem a code" icon={<Gift size={15} />}>
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              placeholder="Enter your promo code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) redeem.mutate(); }}
              className="flex-1 font-mono tracking-wider"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
            />
            <Button
              variant="primary"
              icon={<Sparkles size={15} />}
              disabled={!code.trim()}
              loading={redeem.isPending}
              onClick={() => redeem.mutate()}
            >
              Redeem
            </Button>
          </div>

          <Callout tone="info" icon={<Info size={15} />} title="What a promo code changes">
            <p>
              A code reduces <strong>SilkLLM's fee</strong>, the margin added on top of what a
              request costs to serve. It is not credit: your balance stays exactly as it is, and the
              provider's own cost is never discounted. A code can be redeemed once per account, and
              if you hold more than one, the largest applies.
            </p>
          </Callout>
        </div>
      </Panel>

      {justRedeemed && (
        <Callout tone="brand" icon={<Check size={16} />} title={`${justRedeemed.promotion_name} applied`}>
          <p>{justRedeemed.summary}</p>
          <p className="mt-1.5">It takes effect on your very next request. Nothing else to do.</p>
        </Callout>
      )}

      <Panel title="Your promotions" icon={<BadgePercent size={15} />}>
        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : !list.length ? (
          <EmptyState
            icon={<Gift size={19} />}
            title="No promotions yet"
            hint="Redeem a code above and it will appear here, along with what it has saved you."
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((p) => <PromotionRow key={p.id} promo={p} />)}
          </ul>
        )}
      </Panel>

      <Callout tone="info" icon={<Clock size={16} />} title="How long a discount lasts">
        <p>
          Every promotion carries its own window. Some run until a fixed date, some for a set number
          of days after you redeem them, and some have no end at all. Whichever comes first is what
          you see under "Runs until". When one ends your requests simply return to standard pricing,
          and nothing about your balance or your keys changes.
        </p>
      </Callout>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Promotions.tsx
