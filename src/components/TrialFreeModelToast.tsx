/**
 * TrialFreeModelToast.tsx
 * Listens for "silk:trial-free-model" (fired when the engine served a chat
 * message with a free model instead of the one requested, because the
 * account has no balance and is relying on the free trial). Shows a single
 * dismissible toast rather than PaymentReminderModal's blocking dialog - the
 * request just succeeded, so interrupting it would read as a complaint about
 * something that worked.
 *
 * Shown at most once per browser session (sessionStorage), so it nudges
 * without nagging on every message sent while broke-and-on-trial.
 */

// File: silkllm-frontend/src/components/TrialFreeModelToast.tsx

import { useEffect } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";

const SEEN_KEY = "silk_trial_free_model_nudged";

export default function TrialFreeModelToast() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, "1");
      toast.custom(
        (t) => (
          <div
            className={`max-w-sm rounded-xl border border-line bg-surface px-4 py-3 shadow-lg flex items-start gap-2.5 transition-opacity ${t.visible ? "opacity-100" : "opacity-0"}`}
          >
            <Sparkles size={15} className="text-accent-ink shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs text-ink-2 leading-relaxed">
                You're out of balance, so this reply came from a free model covered by your trial.
                Add credit to use every provider and model.
              </p>
              <button
                type="button"
                onClick={() => { toast.dismiss(t.id); navigate("/dashboard/billing"); }}
                className="mt-1.5 text-xs font-medium text-accent-ink hover:underline"
              >
                Add credits
              </button>
            </div>
          </div>
        ),
        { duration: 8000 },
      );
    };
    window.addEventListener("silk:trial-free-model", handler);
    return () => window.removeEventListener("silk:trial-free-model", handler);
  }, [navigate]);

  return null;
}

// EOF silkllm-frontend/src/components/TrialFreeModelToast.tsx
