/**
 * Billing.tsx
 * Credit purchase page — Stripe (USD) and Paystack (NGN).
 * Shows current balance, purchase form, and transaction history.
 * Now shows live exchange rate + 10% markup for Paystack.
 */

// File: silkllm-frontend/src/pages/user/Billing.tsx

import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CreditCard, DollarSign, Globe, ArrowUpRight, CheckCircle, RefreshCw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { billingApi, usageApi } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export default function Billing() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const status = searchParams.get("status");
  const [amount, setAmount] = useState(10);
  const [provider, setProvider] = useState<"stripe" | "paystack">("stripe");

  // Fetch exchange rate when Paystack is selected
  const { data: rateData, isLoading: rateLoading, refetch: refetchRate } = useQuery({
    queryKey: ["exchange-rate"],
    queryFn: () => billingApi.getRate().then(r => r.data),
    enabled: provider === "paystack",
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const { data: txHistory } = useQuery({
    queryKey: ["usage", "purchase"],
    queryFn: () => usageApi.list(1, 20, "purchase").then((r) => r.data),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => billingApi.checkout(amount, provider).then((r) => r.data),
    onSuccess: (data) => {
      window.location.href = data.checkout_url;
    },
    onError: () => toast.error("Failed to initiate checkout. Please try again."),
  });

  // Refresh user balance if redirected back after payment
  useEffect(() => {
    if (status === "success") {
      refreshUser();
      toast.success("Payment successful! Credits added to your account.");
    }
  }, [status]);

  const effectiveRate = rateData?.effective_rate || 0;
  const estimatedNgn = amount * (effectiveRate || 1600 * 1.1);

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-deep-charcoal dark:text-cloud-grey">Billing</h1>
          <p className="text-warm-grey mt-1">Purchase credits to power your API calls.</p>
        </div>

        {status === "success" && (
          <div className="card border-green-500/30 bg-green-500/5 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-400 shrink-0" />
            <div>
              <p className="font-medium text-cloud-grey">Payment successful!</p>
              <p className="text-warm-grey text-sm">Credits have been added to your account.</p>
            </div>
          </div>
        )}

        <div className="card bg-silk-gradient text-white">
          <p className="text-sm opacity-80 mb-1">Current Balance</p>
          <p className="text-4xl font-bold">${user?.balance?.toFixed(4)}</p>
          <p className="text-sm opacity-70 mt-1">USD • Never expires</p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-5">Add Credits</h2>

          <div className="mb-5">
            <label className="block text-sm text-warm-grey mb-2">Amount (USD)</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_AMOUNTS.map((a) => (
                <button key={a} onClick={() => setAmount(a)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                          amount === a
                            ? "bg-silk-gold text-white"
                            : "bg-cloud-grey dark:bg-slate-dark text-warm-grey hover:text-cloud-grey"
                        }`}>
                  ${a}
                </button>
              ))}
            </div>
            <input
              type="number" min={5} max={10000} value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input w-full"
              placeholder="Custom amount (min $5)"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm text-warm-grey mb-2">Payment Method</label>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setProvider("stripe")}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-all min-h-[44px] ${
                        provider === "stripe"
                          ? "border-silk-gold bg-silk-gold/5"
                          : "border-muted-metal hover:border-warm-grey"
                      }`}>
                <CreditCard size={20} className={provider === "stripe" ? "text-silk-gold" : "text-warm-grey"} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${provider === "stripe" ? "text-silk-gold" : "text-cloud-grey"}`}>Card (USD)</p>
                  <p className="text-xs text-warm-grey">Stripe • Global</p>
                </div>
              </button>
              <button onClick={() => setProvider("paystack")}
                      className={`flex items-center gap-3 p-4 rounded-lg border transition-all min-h-[44px] ${
                        provider === "paystack"
                          ? "border-silk-gold bg-silk-gold/5"
                          : "border-muted-metal hover:border-warm-grey"
                      }`}>
                <Globe size={20} className={provider === "paystack" ? "text-silk-gold" : "text-warm-grey"} />
                <div className="text-left">
                  <p className={`text-sm font-medium ${provider === "paystack" ? "text-silk-gold" : "text-cloud-grey"}`}>NGN / Africa</p>
                  <p className="text-xs text-warm-grey">Paystack • Cards, Bank</p>
                </div>
              </button>
            </div>
            {provider === "paystack" && (
              <div className="mt-3 text-xs text-warm-grey space-y-1">
                {rateLoading ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin" /> Fetching live rate...
                  </div>
                ) : (
                  <>
                    <p>≈ ₦{estimatedNgn.toLocaleString(undefined, { maximumFractionDigits: 0 })} NGN</p>
                    <p>Rate: ₦{rateData?.usd_to_ngn_rate?.toFixed(2)}/$ + fee</p>
                    <p className="text-[11px] text-muted-metal">Rate refreshes every 6 hours</p>
                  </>
                )}
              </div>
            )}
          </div>

          <button onClick={() => checkoutMutation.mutate()}
                  disabled={amount < 5 || checkoutMutation.isPending}
                  className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50">
            {checkoutMutation.isPending ? "Redirecting..." : (
              <><DollarSign size={18} /> Add ${amount} Credits <ArrowUpRight size={16} /></>
            )}
          </button>
        </div>

        <div className="card">
          <h2 className="font-semibold text-deep-charcoal dark:text-cloud-grey mb-4">Purchase History</h2>
          {!txHistory?.entries?.length ? (
            <p className="text-warm-grey text-sm">No purchases yet.</p>
          ) : (
            <div className="space-y-2">
              {txHistory.entries.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-cloud-grey dark:border-muted-metal last:border-0">
                  <div>
                    <p className="text-sm font-medium text-deep-charcoal dark:text-cloud-grey">
                      Credits added via {e.metadata?.payment_provider || "card"}
                    </p>
                    <p className="text-xs text-warm-grey">{format(new Date(e.created_at), "MMM d, yyyy HH:mm")}</p>
                  </div>
                  <span className="text-green-400 font-semibold text-sm">+${e.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/user/Billing.tsx