/**
 * PaymentReminderModal.tsx
 * Listens for the global "silk:need-credit" event (fired on a 402 from the API or
 * the chat stream) and prompts the user to top up.
 *
 * Free models are free only while the trial allowance lasts, which is the part
 * users are surprised by — so the modal says it explicitly rather than just
 * reporting the error.
 */

// File: silkllm-frontend/src/components/PaymentReminderModal.tsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Wallet } from "lucide-react";
import { Button, Modal } from "@/components/ui";

export default function PaymentReminderModal() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
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

  // Show the server's message when it is clean prose, otherwise a friendly default.
  const friendly = message && message.length < 200 && !message.trim().startsWith("{")
    ? message
    : "You are out of credit and your free trial does not cover this request. Add credits to keep going.";

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="Add credits to continue"
      icon={<Wallet size={18} />}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>Not now</Button>
          <Button
            variant="primary"
            icon={<Wallet size={15} />}
            onClick={() => { setOpen(false); navigate("/dashboard/billing"); }}
          >
            Add credits
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-2 leading-relaxed">{friendly}</p>
      <div className="mt-4 rounded-xl border border-line bg-sunken px-4 py-3 flex items-start gap-2.5">
        <Sparkles size={14} className="text-accent-ink mt-0.5 shrink-0" />
        <p className="text-xs text-ink-2 leading-relaxed">
          Free models are free during your trial. Once the daily trial allowance is used up, every
          request — including free models — draws from your balance.
        </p>
      </div>
    </Modal>
  );
}

// EOF silkllm-frontend/src/components/PaymentReminderModal.tsx
