/**
 * PaymentReminderModal.tsx
 * Listens for the global "silk:need-credit" event (fired when a request fails
 * with 402 Insufficient Balance) and shows a reminder to add credits. Free
 * models are free only during the trial; once the trial allowance is used up a
 * request needs balance, so this nudges the user to top up and keep going.
 */

// File: silkllm-frontend/src/components/PaymentReminderModal.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, X, Sparkles } from "lucide-react";

export default function PaymentReminderModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setMessage(typeof detail === "string" && detail ? detail : "");
      setOpen(true);
    };
    window.addEventListener("silk:need-credit", handler);
    return () => window.removeEventListener("silk:need-credit", handler);
  }, []);

  if (!open) return null;

  const goBilling = () => { setOpen(false); navigate("/dashboard/billing"); };

  // Show the server's message when it is clean, otherwise a friendly default.
  const friendly = message && message.length < 200 && !message.trim().startsWith("{")
    ? message
    : "You are out of credit and your free trial does not cover this request. Add credits to keep going.";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md rounded-2xl bg-white dark:bg-slate-dark border border-silk-gold/30 shadow-2xl p-6">
        <button onClick={() => setOpen(false)}
          className="absolute top-3 right-3 text-warm-grey hover:text-silk-gold p-1" aria-label="Close">
          <X size={18} />
        </button>
        <div className="w-12 h-12 rounded-xl bg-silk-gold/15 flex items-center justify-center mb-4">
          <Wallet size={22} className="text-silk-gold" />
        </div>
        <h2 className="text-lg font-bold text-deep-charcoal dark:text-cloud-grey">Add credits to continue</h2>
        <p className="text-sm text-warm-grey mt-2 leading-relaxed">{friendly}</p>
        <div className="mt-3 rounded-lg bg-cloud-grey dark:bg-deep-charcoal px-3 py-2.5 flex items-start gap-2">
          <Sparkles size={14} className="text-silk-gold mt-0.5 shrink-0" />
          <p className="text-xs text-warm-grey">
            Free models are free during your trial. Once the daily trial allowance is used up, every request,
            including free models, draws from your balance.
          </p>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={() => setOpen(false)} className="btn-secondary flex-1 text-sm">Not now</button>
          <button onClick={goBilling} className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
            <Wallet size={15} /> Add credits
          </button>
        </div>
      </div>
    </div>
  );
}

// EOF silkllm-frontend/src/components/PaymentReminderModal.tsx
