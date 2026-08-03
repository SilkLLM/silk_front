/**
 * Billing.tsx
 * Buy credits (Stripe in USD, Paystack in NGN) and review past purchases.
 *
 * The amount and the payment rail are the whole job, so they lead; the summary
 * restates exactly what is about to be charged before the button commits.
 */

// File: silkllm-frontend/src/pages/user/Billing.tsx

import React, { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ArrowUpRight, CheckCircle2, CreditCard, Globe, Receipt, RefreshCw, Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { billingApi, usageApi } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { usd } from "@/lib/money";
import {
  Badge, Button, Callout, EmptyState, Field, Input, PageHeader, Panel, Skeleton,
} from "@/components/ui";

const PRESETS = [5, 10, 25, 50, 100, 250];
const MIN_AMOUNT = 5;

type Rail = "stripe" | "paystack";

function RailOption({ selected, onSelect, icon, title, subtitle }: {
  selected: boolean; onSelect: () => void; icon: React.ReactNode; title: string; subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={clsx(
        "flex items-start gap-3 p-4 rounded-xl border text-left transition-all",
        selected
          ? "border-accent bg-accent/[0.07] shadow-xs"
          : "border-line bg-surface hover:border-line-strong hover:bg-sunken",
      )}
    >
      <span className={clsx("shrink-0 mt-0.5", selected ? "text-accent-ink" : "text-ink-3")}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="block text-xs text-ink-3 mt-0.5">{subtitle}</span>
      </span>
      <span className={clsx(
        "ml-auto w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-colors",
        selected ? "border-accent bg-accent" : "border-line-strong",
      )} />
    </button>
  );
}

export default function Billing() {
  const { user, refreshUser } = useAuth();
  const [params] = useSearchParams();
  const status = params.get("status");
  const [amount, setAmount] = useState(10);
  const [rail, setRail] = useState<Rail>("stripe");

  const { data: rateData, isLoading: rateLoading } = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => billingApi.getRate().then((r) => r.data),
    enabled: rail === "paystack",
    staleTime: 60 * 60 * 1000,
  });

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["usage", "purchase"],
    queryFn: () => usageApi.list(1, 20, "purchase").then((r) => r.data),
  });

  const checkout = useMutation({
    mutationFn: () => billingApi.checkout(amount, rail).then((r) => r.data),
    onSuccess: (data) => { window.location.href = data.checkout_url; },
    onError: () => toast.error("Could not start checkout. Please try again."),
  });

  useEffect(() => {
    if (status === "success") {
      refreshUser();
      toast.success("Payment received. Credits added to your balance.");
    }
  }, [status]);

  const effectiveRate = rateData?.effective_rate || 0;
  const estimatedNgn = amount * (effectiveRate || 1600 * 1.1);
  const valid = amount >= MIN_AMOUNT && amount <= 10_000;

  return (
    <DashboardLayout>
      <PageHeader title="Billing" subtitle="Buy credits once and spend them across every provider." />

      {status === "success" && (
        <Callout tone="brand" icon={<CheckCircle2 size={17} />} title="Payment successful">
          Your credits are available immediately. The new balance is shown below.
        </Callout>
      )}

      {/* Balance */}
      <section className="card card-pad relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.55]"
          style={{ background: "radial-gradient(120% 100% at 100% 0%, rgb(var(--c-accent) / 0.10), transparent 60%)" }}
        />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-medium text-ink-2 flex items-center gap-2">
              <Wallet size={14} className="text-ink-3" /> Current balance
            </p>
            <p className="text-[2.5rem] sm:text-[2.75rem] leading-none font-semibold tracking-tight text-ink mt-3">
              {usd((user?.balance ?? 0))}
            </p>
            <p className="text-xs text-ink-3 mt-2">USD · shared across all providers · never expires</p>
          </div>
          <Badge tone={(user?.balance ?? 0) < 1 ? "warning" : "success"}>
            {(user?.balance ?? 0) < 1 ? "Low balance" : "Ready"}
          </Badge>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 items-start">
        {/* Purchase */}
        <Panel title="Add credits" icon={<CreditCard size={15} />}>
          <div className="px-5 sm:px-6 py-5 space-y-6">
            <Field label="Amount (USD)" hint={`Minimum $${MIN_AMOUNT}. Credits never expire.`}>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESETS.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAmount(a)}
                    aria-pressed={amount === a}
                    className={clsx(
                      "h-10 px-4 rounded-lg text-sm font-medium border transition-all num",
                      amount === a
                        ? "border-accent bg-accent/10 text-accent-ink"
                        : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
                    )}
                  >
                    ${a}
                  </button>
                ))}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">$</span>
                <Input
                  type="number"
                  min={MIN_AMOUNT}
                  max={10000}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="pl-7 num"
                  placeholder="Custom amount"
                />
              </div>
            </Field>

            <Field label="Payment method">
              <div className="grid sm:grid-cols-2 gap-3">
                <RailOption
                  selected={rail === "stripe"}
                  onSelect={() => setRail("stripe")}
                  icon={<CreditCard size={18} />}
                  title="Card (USD)"
                  subtitle="Stripe · worldwide"
                />
                <RailOption
                  selected={rail === "paystack"}
                  onSelect={() => setRail("paystack")}
                  icon={<Globe size={18} />}
                  title="NGN / Africa"
                  subtitle="Paystack · card, bank, USSD"
                />
              </div>
            </Field>

            {/* Summary: exactly what is about to be charged. */}
            <div className="rounded-xl border border-line bg-sunken px-4 py-3.5 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-2">Credits added</span>
                <span className="text-ink font-medium num">{usd(amount)}</span>
              </div>
              {rail === "paystack" && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-2">You pay</span>
                    <span className="text-ink font-medium num">
                      {rateLoading
                        ? <span className="inline-flex items-center gap-1.5 text-ink-3"><RefreshCw size={12} className="animate-spin" /> fetching rate</span>
                        : `₦${estimatedNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                    </span>
                  </div>
                  {!rateLoading && rateData?.usd_to_ngn_rate && (
                    <p className="text-2xs text-ink-3 num">
                      At ₦{rateData.usd_to_ngn_rate.toFixed(2)}/$ plus the conversion fee · rate refreshes every 6 hours
                    </p>
                  )}
                </>
              )}
              {rail === "stripe" && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink-2">You pay</span>
                  <span className="text-ink font-medium num">{usd(amount)}</span>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              className="w-full"
              disabled={!valid}
              loading={checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? "Redirecting..." : <>Add ${amount} in credits <ArrowUpRight size={15} /></>}
            </Button>
            {!valid && (
              <p className="text-xs text-danger text-center -mt-3">
                Enter an amount between ${MIN_AMOUNT} and $10,000.
              </p>
            )}
          </div>
        </Panel>

        {/* History */}
        <Panel title="Purchase history" icon={<Receipt size={15} />}>
          {historyLoading ? (
            <div className="p-5 space-y-2.5">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : !history?.entries?.length ? (
            <EmptyState icon={<Receipt size={19} />} title="No purchases yet" hint="Your credit top-ups will be listed here." />
          ) : (
            <ul className="divide-y divide-line">
              {history.entries.map((e: any) => (
                <li key={e.id} className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink capitalize truncate">
                      {e.metadata?.payment_provider || "Card"} payment
                    </p>
                    <p className="text-2xs text-ink-3 num mt-0.5">
                      {format(new Date(e.created_at), "MMM d, yyyy · HH:mm")}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-success num shrink-0">+{usd(e.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Billing.tsx
