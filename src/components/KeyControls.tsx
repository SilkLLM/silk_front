/**
 * KeyControls.tsx
 * The limits that can be attached to an API key, as one editable block.
 *
 * Shared by the create panel and the edit dialog so the two cannot drift. Both
 * need exactly the same fields, and a control that exists in one but not the
 * other is the sort of gap nobody notices until a key cannot be changed back.
 *
 * Every control is off by default. A key with none of them set behaves exactly
 * as keys always have, so nothing here changes what an existing integration
 * does until someone opts in.
 */

// File: silkllm-frontend/src/components/KeyControls.tsx

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Gauge, Layers, ShieldCheck, Wallet } from "lucide-react";
import { budgetsApi, keysApi, modelsApi } from "@/services/api";
import { Button, Callout, Checkbox, Field, Input, Select } from "@/components/ui";
import { usd, usdPrecise } from "@/lib/charts";

/** Everything the two dialogs keep in state. Strings, because they come from inputs. */
export interface ControlsState {
  capEnabled: boolean;
  cap: string;
  alertEnabled: boolean;
  alertPercent: string;
  scopeEnabled: boolean;
  allowedModels: string[];
  rateEnabled: boolean;
  ratePerMin: string;
  poolId: string;
}

export const EMPTY_CONTROLS: ControlsState = {
  capEnabled: false,
  cap: "10",
  alertEnabled: false,
  alertPercent: "80",
  scopeEnabled: false,
  allowedModels: [],
  rateEnabled: false,
  ratePerMin: "60",
  poolId: "",
};

/** Read the controls off a key that came back from the API. */
export function controlsFromKey(k: any): ControlsState {
  const models: string[] = Array.isArray(k?.allowed_models) ? k.allowed_models : [];
  return {
    capEnabled: k?.spend_limit_usd != null,
    cap: k?.spend_limit_usd != null ? String(k.spend_limit_usd) : "10",
    alertEnabled: k?.alert_at_percent != null,
    alertPercent: k?.alert_at_percent != null ? String(k.alert_at_percent) : "80",
    scopeEnabled: models.length > 0,
    allowedModels: models,
    rateEnabled: k?.rate_limit_per_min != null,
    ratePerMin: k?.rate_limit_per_min != null ? String(k.rate_limit_per_min) : "60",
    poolId: k?.budget_pool_id || "",
  };
}

/** The body for a create request. Only the enabled controls are sent. */
export function toCreateBody(s: ControlsState) {
  return {
    ...(s.capEnabled ? { spend_limit_usd: Number(s.cap) } : {}),
    ...(s.capEnabled && s.alertEnabled ? { alert_at_percent: Number(s.alertPercent) } : {}),
    ...(s.scopeEnabled && s.allowedModels.length ? { allowed_models: s.allowedModels } : {}),
    ...(s.rateEnabled ? { rate_limit_per_min: Number(s.ratePerMin) } : {}),
    ...(s.poolId ? { budget_pool_id: s.poolId } : {}),
  };
}

/**
 * The body for an update.
 *
 * Turning a control off has to be an explicit flag. An omitted field means
 * "leave this alone", so without the flags a dialog that only renamed a key
 * would be unable to ever remove a limit.
 */
export function toUpdateBody(s: ControlsState) {
  const alertOn = s.capEnabled && s.alertEnabled;
  const scopeOn = s.scopeEnabled && s.allowedModels.length > 0;
  return {
    ...(s.capEnabled ? { spend_limit_usd: Number(s.cap) } : { clear_spend_limit: true }),
    ...(alertOn ? { alert_at_percent: Number(s.alertPercent) } : { clear_alert: true }),
    ...(scopeOn ? { allowed_models: s.allowedModels } : { clear_scope: true }),
    ...(s.rateEnabled ? { rate_limit_per_min: Number(s.ratePerMin) } : { clear_rate_limit: true }),
    ...(s.poolId ? { budget_pool_id: s.poolId } : { clear_budget_pool: true }),
  };
}

/** What the caller must fix before the form can be submitted, or null. */
export function controlsError(s: ControlsState): string | null {
  if (s.capEnabled && !(Number(s.cap) > 0)) return "Set a spend limit above zero.";
  if (s.capEnabled && s.alertEnabled) {
    const pct = Number(s.alertPercent);
    if (!(pct > 0 && pct <= 100)) return "The alert threshold must be between 1 and 100 percent.";
  }
  if (s.scopeEnabled && !s.allowedModels.length) return "Choose at least one model, or turn the allowlist off.";
  if (s.rateEnabled && !(Number(s.ratePerMin) >= 1)) return "Allow at least one request per minute.";
  return null;
}

/**
 * Why a limit cannot be saved, on allocation grounds, or null.
 *
 * Kept apart from controlsError because it needs a figure fetched from the
 * server. The dialog inside the control block offers the two ways out; this is
 * what stops the form being submitted while neither has been taken.
 */
export function allocationError(
  s: ControlsState, available: number, spentUsd = 0,
): string | null {
  // A key inside a shared budget spends money the budget already reserved, so
  // its own cap is a sub-limit rather than a fresh claim on the balance.
  if (!s.capEnabled || s.poolId) return null;
  const asked = Math.max(0, Number(s.cap) - spentUsd);
  if (asked > available + 1e-9) {
    return "That is more credit than you have left to allocate.";
  }
  return null;
}

/**
 * How much credit a new limit may claim, given what is already promised.
 *
 * `alreadyPromised` is what the thing being edited currently lays claim to, so
 * raising a cap from $5 to $8 is measured as asking for $3 rather than $8.
 */
export function useAllocation(alreadyPromised = 0) {
  const { data } = useQuery({
    queryKey: ["key-allocation"],
    queryFn: () => keysApi.allocation().then((r) => r.data),
    staleTime: 15_000,
  });
  const balance = data?.balance ?? 0;
  const available = (data?.available ?? 0) + Math.max(0, alreadyPromised);
  return { balance, allocated: data?.allocated ?? 0, available, loaded: !!data };
}

/** Trim float noise so a cap set from the balance is a clean number. */
function round6(n: number): number {
  return Math.floor(n * 1e6) / 1e6;
}

export default function KeyControls({ value, onChange, spentUsd, alreadyPromised = 0 }: {
  value: ControlsState;
  onChange: (next: ControlsState) => void;
  /** Shown next to the cap, so it is obvious when a new cap is already used up. */
  spentUsd?: number;
  /** What this key already claims, so an edit is not counted against itself. */
  alreadyPromised?: number;
}) {
  const set = <K extends keyof ControlsState>(k: K, v: ControlsState[K]) =>
    onChange({ ...value, [k]: v });

  const { data: models } = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.list().then((r) => r.data),
    staleTime: 5 * 60_000,
  });
  const { data: pools } = useQuery({
    queryKey: ["budget-pools"],
    queryFn: () => budgetsApi.list().then((r) => r.data),
    staleTime: 60_000,
  });

  const modelList: any[] = useMemo(() => {
    const raw = Array.isArray(models) ? models : (models as any)?.models || [];
    return raw.filter((m: any) => m?.id);
  }, [models]);

  const byProvider = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const m of modelList) {
      const p = m.provider_id || "other";
      groups.set(p, [...(groups.get(p) || []), m]);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [modelList]);

  const { balance, available, loaded } = useAllocation(alreadyPromised);

  // A key inside a shared budget draws on money that budget already set aside,
  // so its own cap claims nothing further and is not measured against the
  // balance. The server applies the same rule.
  const claimsOwnCredit = value.capEnabled && !value.poolId;
  const asked = Math.max(0, Number(value.cap) - (spentUsd ?? 0));
  const overAllocated = loaded && claimsOwnCredit && asked > available + 1e-9;

  const capUsedUp =
    value.capEnabled && spentUsd != null && Number(value.cap) <= spentUsd;

  const toggleModel = (id: string) =>
    set("allowedModels", value.allowedModels.includes(id)
      ? value.allowedModels.filter((m) => m !== id)
      : [...value.allowedModels, id]);

  return (
    <div className="space-y-3">
      {/* Spend cap, and the alert that depends on it */}
      <div className="rounded-xl border border-line bg-sunken p-4">
        <Checkbox
          checked={value.capEnabled}
          onChange={(v) => set("capEnabled", v)}
          label="Cap what this key can spend"
          hint="The key stops working at this amount. Your other keys and your balance are unaffected."
        />
        {value.capEnabled && (
          <div className="mt-4 pl-6 space-y-4">
            <div className="max-w-xs">
              <Field
                label="Spend limit (USD)"
                hint={spentUsd != null ? `Already spent: ${usdPrecise(spentUsd)}` : "You can change or remove this at any time."}
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">$</span>
                  <Input
                    type="number" min="0.01" step="0.01" className="pl-7 num"
                    value={value.cap}
                    onChange={(e) => set("cap", e.target.value)}
                  />
                </div>
              </Field>
            </div>

            <Checkbox
              checked={value.alertEnabled}
              onChange={(v) => set("alertEnabled", v)}
              label="Warn me before it runs out"
              hint="Sends a notification once the key passes this share of its cap, so it does not stop without warning."
            />
            {value.alertEnabled && (
              <div className="pl-6 max-w-[10rem]">
                <Field label="Alert at">
                  <div className="relative">
                    <Input
                      type="number" min="1" max="100" step="1" className="pr-8 num"
                      value={value.alertPercent}
                      onChange={(e) => set("alertPercent", e.target.value)}
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">%</span>
                  </div>
                </Field>
              </div>
            )}

            {loaded && claimsOwnCredit && !overAllocated && (
              <p className="text-2xs text-ink-3 num">
                {usdPrecise(available)} of your {usdPrecise(balance)} balance is still
                free to allocate.
              </p>
            )}

            {overAllocated && (
              <Callout tone="warning" icon={<AlertTriangle size={15} />}>
                <p>
                  You do not have {usdPrecise(Number(value.cap))} to give this key. Only{" "}
                  <span className="num font-medium text-ink">{usdPrecise(available)}</span> of your{" "}
                  <span className="num">{usdPrecise(balance)}</span> balance is unallocated, the rest
                  is already set aside for other keys and budgets.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => set("cap", String(round6(available + (spentUsd ?? 0))))}
                  >
                    Use my maximum ({usdPrecise(available)})
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => set("capEnabled", false)}>
                    No limit, spend from my balance
                  </Button>
                </div>
              </Callout>
            )}

            {capUsedUp && (
              <Callout tone="warning" icon={<AlertTriangle size={15} />}>
                This key has already spent {usdPrecise(spentUsd!)}, so this cap leaves it blocked.
                Set a higher one, or reset its counter to start the budget again.
              </Callout>
            )}
          </div>
        )}
      </div>

      {/* Model allowlist */}
      <div className="rounded-xl border border-line bg-sunken p-4">
        <Checkbox
          checked={value.scopeEnabled}
          onChange={(v) => set("scopeEnabled", v)}
          label="Restrict this key to certain models"
          hint="Useful when a key goes to a service that only needs one model. Anything else is refused with HTTP 403."
        />
        {value.scopeEnabled && (
          <div className="mt-4 pl-6">
            {!modelList.length ? (
              <p className="text-xs text-ink-3">Loading the model catalogue.</p>
            ) : (
              <div className="max-h-56 overflow-y-auto rounded-lg border border-line bg-surface p-3 space-y-3">
                {byProvider.map(([provider, group]) => (
                  <div key={provider}>
                    <p className="text-2xs uppercase tracking-wide text-ink-3 mb-1.5 flex items-center gap-1.5">
                      <Layers size={11} /> {provider}
                    </p>
                    <div className="space-y-1">
                      {group.map((m: any) => (
                        <label key={m.id} className="flex items-center gap-2 py-1 cursor-pointer">
                          <input
                            type="checkbox"
                            className="accent-accent"
                            checked={value.allowedModels.includes(m.id)}
                            onChange={() => toggleModel(m.id)}
                          />
                          <span className="text-xs text-ink truncate">{m.id}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-2xs text-ink-3 mt-2">
              {value.allowedModels.length
                ? `${value.allowedModels.length} model${value.allowedModels.length > 1 ? "s" : ""} allowed.`
                : "Nothing selected yet, so this key could not call anything."}
            </p>
          </div>
        )}
      </div>

      {/* Rate limit */}
      <div className="rounded-xl border border-line bg-sunken p-4">
        <Checkbox
          checked={value.rateEnabled}
          onChange={(v) => set("rateEnabled", v)}
          label="Limit how fast this key can be used"
          hint="Caps requests per minute for this key alone. A runaway loop is slowed down rather than draining the budget."
        />
        {value.rateEnabled && (
          <div className="mt-4 pl-6 max-w-[12rem]">
            <Field label="Requests per minute" hint="Refused requests answer with HTTP 429.">
              <div className="relative">
                <Gauge size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
                <Input
                  type="number" min="1" step="1" className="pl-9 num"
                  value={value.ratePerMin}
                  onChange={(e) => set("ratePerMin", e.target.value)}
                />
              </div>
            </Field>
          </div>
        )}
      </div>

      {/* Shared budget */}
      <div className="rounded-xl border border-line bg-sunken p-4">
        <Field
          label={<span className="flex items-center gap-1.5"><Wallet size={13} /> Shared budget</span>}
          hint="Optional. Several keys can draw on one budget, so a whole team or environment has a single ceiling."
        >
          <Select value={value.poolId} onChange={(e) => set("poolId", e.target.value)}>
            <option value="">No shared budget</option>
            {(pools || []).map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.spend_limit_usd != null
                  ? ` (${usdPrecise(p.spent_usd || 0)} of ${usd(Number(p.spend_limit_usd))})`
                  : " (no limit)"}
              </option>
            ))}
          </Select>
        </Field>
        {!pools?.length && (
          <p className="text-2xs text-ink-3 mt-2 flex items-center gap-1.5">
            <ShieldCheck size={11} /> Create one on the Budgets page to share a limit across keys.
          </p>
        )}
      </div>
    </div>
  );
}

// EOF silkllm-frontend/src/components/KeyControls.tsx
