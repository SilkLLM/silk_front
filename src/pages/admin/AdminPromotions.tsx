/**
 * AdminPromotions.tsx
 * Creating, tracking and granting fee discounts.
 *
 * Two shapes share one screen because they share one table and one meaning:
 * a **code** customers redeem themselves, and a **direct discount** granted to
 * named accounts for a partner who was promised a rate rather than a coupon.
 *
 * Every figure shown here is a fee given up, not credit issued. The discount
 * comes off SilkLLM's own margin, so "total given up" is the real cost of a
 * campaign and is the number an operator actually needs when deciding whether
 * to run another one.
 */

// File: silkllm-frontend/src/pages/admin/AdminPromotions.tsx

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent, Ban, Check, Clock, Gift, Mail, Pencil,
  Plus, Send, Sparkles, Tag, Trash2, TrendingDown, Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { format } from "date-fns";
import clsx from "clsx";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Promotion, adminPromotionsApi } from "@/services/api";
import {
  Badge, Button, Callout, Checkbox, ConfirmDialog, CopyButton, EmptyState, Field,
  IconButton, Input, Modal, PageHeader, Panel, SegmentedControl, Skeleton,
  StatTile, Textarea,
} from "@/components/ui";
import { usdPrecise } from "@/lib/charts";

/** Everything the create and edit forms hold. Strings, because they are inputs. */
interface FormState {
  name: string;
  description: string;
  discountPercent: string;
  hasCode: boolean;
  code: string;
  capped: boolean;
  maxRedemptions: string;
  hasWindow: boolean;
  startsAt: string;
  expiresAt: string;
  hasDuration: boolean;
  durationDays: string;
  scoped: boolean;
  allowedModels: string;
  restricted: boolean;
  restrictedEmails: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  discountPercent: "20",
  hasCode: true,
  code: "",
  capped: false,
  maxRedemptions: "100",
  hasWindow: false,
  startsAt: "",
  expiresAt: "",
  hasDuration: false,
  durationDays: "30",
  scoped: false,
  allowedModels: "",
  restricted: false,
  restrictedEmails: "",
};

function splitList(raw: string): string[] {
  return raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
}

/** What the form must fix before it can be submitted, or null. */
function formError(f: FormState): string | null {
  if (!f.name.trim()) return "Give the campaign a name.";
  const pct = Number(f.discountPercent);
  if (!(pct > 0 && pct <= 100)) {
    return "The discount must be between 1 and 100 percent of the fee.";
  }
  if (f.capped && !(Number(f.maxRedemptions) >= 1)) return "Allow at least one redemption.";
  if (f.hasDuration && !(Number(f.durationDays) >= 1)) return "The benefit must last at least a day.";
  if (f.hasWindow && f.startsAt && f.expiresAt && f.expiresAt <= f.startsAt) {
    return "The end date must be after the start date.";
  }
  if (f.scoped && !splitList(f.allowedModels).length) {
    return "List at least one model, or turn the scope off.";
  }
  if (f.restricted && !splitList(f.restrictedEmails).length) {
    return "List at least one account, or turn the restriction off.";
  }
  return null;
}

function toBody(f: FormState, forUpdate = false): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: f.name.trim(),
    description: f.description.trim() || null,
    discount_percent: Number(f.discountPercent),
  };
  if (!forUpdate && f.hasCode) body.code = f.code.trim() || "auto";

  // On update, turning a condition off is an explicit flag. An omitted field has
  // to keep meaning "leave this alone", or editing the name would wipe the
  // campaign's limits.
  if (f.capped) body.max_redemptions = Number(f.maxRedemptions);
  else if (forUpdate) body.clear_max_redemptions = true;

  if (f.hasWindow) {
    if (f.startsAt) body.starts_at = new Date(f.startsAt).toISOString();
    if (f.expiresAt) body.expires_at = new Date(f.expiresAt).toISOString();
  } else if (forUpdate) body.clear_expiry = true;

  if (f.hasDuration) body.duration_days = Number(f.durationDays);
  else if (forUpdate) body.clear_duration = true;

  if (f.scoped) body.allowed_models = splitList(f.allowedModels);
  else if (forUpdate) body.clear_scope = true;

  if (f.restricted) body.restricted_emails = splitList(f.restrictedEmails);
  else if (forUpdate) body.clear_restrictions = true;

  return body;
}

function PromotionForm({ value, onChange }: {
  value: FormState;
  onChange: (next: FormState) => void;
}) {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Campaign name" required>
          <Input
            placeholder="Launch week"
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </Field>
        <Field
          label="Discount"
          hint="Percentage of the SilkLLM fee. The provider's cost is never discounted."
        >
          <div className="relative">
            <Input
              type="number" min="1" max="100" step="1" className="pr-8 num"
              value={value.discountPercent}
              onChange={(e) => set("discountPercent", e.target.value)}
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-3">%</span>
          </div>
        </Field>
      </div>

      <Field label="Description" hint="Shown to the customer when they redeem it.">
        <Textarea
          rows={2}
          placeholder="20% off our fees for the first month."
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="rounded-xl border border-line bg-sunken p-4 space-y-4">
        <Checkbox
          checked={value.hasCode}
          onChange={(v) => set("hasCode", v)}
          label="Customers redeem this with a code"
          hint="Turn off for a discount you grant directly to named accounts, with nothing to type."
        />
        {value.hasCode && (
          <div className="pl-6 max-w-sm">
            <Field label="Code" hint="Leave blank to generate one that avoids easily misread characters.">
              <Input
                placeholder="Generated automatically"
                value={value.code}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                className="font-mono tracking-wider"
              />
            </Field>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-sunken p-4 space-y-4">
        <Checkbox
          checked={value.capped}
          onChange={(v) => set("capped", v)}
          label="Limit how many accounts can claim it"
          hint="Once this many have redeemed, the code stops working for everyone else."
        />
        {value.capped && (
          <div className="pl-6 max-w-[12rem]">
            <Field label="Maximum redemptions">
              <Input
                type="number" min="1" step="1" className="num"
                value={value.maxRedemptions}
                onChange={(e) => set("maxRedemptions", e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-sunken p-4 space-y-4">
        <Checkbox
          checked={value.hasWindow}
          onChange={(v) => set("hasWindow", v)}
          label="Only valid between certain dates"
        />
        {value.hasWindow && (
          <div className="pl-6 grid sm:grid-cols-2 gap-4 max-w-lg">
            <Field label="Starts">
              <Input
                type="datetime-local"
                value={value.startsAt}
                onChange={(e) => set("startsAt", e.target.value)}
              />
            </Field>
            <Field label="Ends">
              <Input
                type="datetime-local"
                value={value.expiresAt}
                onChange={(e) => set("expiresAt", e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-sunken p-4 space-y-4">
        <Checkbox
          checked={value.hasDuration}
          onChange={(v) => set("hasDuration", v)}
          label="The benefit lasts a fixed time after redemption"
          hint="A 30-day benefit redeemed today ends in 30 days, or when the campaign does, whichever is sooner."
        />
        {value.hasDuration && (
          <div className="pl-6 max-w-[12rem]">
            <Field label="Days">
              <Input
                type="number" min="1" step="1" className="num"
                value={value.durationDays}
                onChange={(e) => set("durationDays", e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-sunken p-4 space-y-4">
        <Checkbox
          checked={value.restricted}
          onChange={(v) => set("restricted", v)}
          label="Only certain accounts can redeem it"
          hint="Anyone else who tries the code is told it is not valid, without being told the code exists."
        />
        {value.restricted && (
          <div className="pl-6">
            <Field
              label="Email addresses"
              hint="One per line, or comma separated. Addresses with no account are ignored."
            >
              <Textarea
                rows={3}
                className="font-mono text-xs"
                placeholder={"partner@example.com\nvip@example.com"}
                value={value.restrictedEmails}
                onChange={(e) => set("restrictedEmails", e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-sunken p-4 space-y-4">
        <Checkbox
          checked={value.scoped}
          onChange={(v) => set("scoped", v)}
          label="Only discount certain models"
          hint="Requests to anything else are charged at the usual rate."
        />
        {value.scoped && (
          <div className="pl-6">
            <Field label="Model ids" hint="One per line, or comma separated.">
              <Textarea
                rows={3}
                className="font-mono text-xs"
                placeholder={"gpt-4o-mini\nclaude-haiku-4-5-20251001"}
                value={value.allowedModels}
                onChange={(e) => set("allowedModels", e.target.value)}
              />
            </Field>
          </div>
        )}
      </div>
    </div>
  );
}

/** Who claimed a campaign, and what it has cost. */
function RedemptionsDialog({ promo, onClose }: { promo: Promotion | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["promotion-redemptions", promo?.id],
    queryFn: () => adminPromotionsApi.redemptions(promo!.id).then((r) => r.data),
    enabled: !!promo,
  });

  const rows: any[] = data || [];

  return (
    <Modal
      open={!!promo}
      onClose={onClose}
      title={`Who used "${promo?.name || ""}"`}
      description="Every account that claimed this, and the fee each has saved since."
      icon={<Users size={17} />}
      size="lg"
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11" />)}
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={<Users size={19} />}
          title="Nobody has claimed this yet"
          hint="Redemptions appear here as soon as the first account uses the code."
        />
      ) : (
        <div className="rounded-lg border border-line overflow-hidden">
          <div className="scroll-x">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Redeemed</th>
                  <th>Status</th>
                  <th className="text-right">Requests</th>
                  <th className="text-right">Fee saved</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="max-w-[220px]">
                      <p className="text-xs text-ink truncate">{r.user_email || r.user_id}</p>
                      {r.user_name && <p className="text-2xs text-ink-3 truncate">{r.user_name}</p>}
                    </td>
                    <td className="text-2xs text-ink-2 num whitespace-nowrap">
                      {format(new Date(r.redeemed_at), "d MMM yyyy")}
                    </td>
                    <td>
                      {r.is_active
                        ? <Badge tone="success"><Check size={10} /> Active</Badge>
                        : <Badge tone="neutral">Ended</Badge>}
                    </td>
                    <td className="text-right num text-2xs text-ink-2">
                      {(r.uses_count || 0).toLocaleString()}
                    </td>
                    <td className="text-right num text-2xs text-ink">
                      {usdPrecise(r.fee_saved_usd || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Email a code out, or grant a discount directly. */
function ReachDialog({ promo, onClose }: { promo: Promotion | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [emails, setEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  React.useEffect(() => {
    if (promo) { setEmails(""); setSubject(""); setMessage(""); }
  }, [promo]);

  const list = splitList(emails);
  const isCode = !!promo?.code;

  const send = useMutation({
    mutationFn: () =>
      isCode
        ? adminPromotionsApi.email(promo!.id, {
            emails: list,
            subject: subject.trim() || undefined,
            message: message.trim() || undefined,
          }).then((r) => r.data)
        : adminPromotionsApi.grant(promo!.id, { emails: list }).then((r) => r.data),
    onSuccess: (data: any) => {
      if (isCode) {
        toast.success(`Sent to ${data.sent} of ${data.sent + data.failed}.`);
      } else {
        const granted = data.granted?.length ?? 0;
        const skipped = data.skipped?.length ?? 0;
        toast.success(
          `Granted to ${granted} account${granted === 1 ? "" : "s"}`
          + (skipped ? `, ${skipped} already had it.` : "."),
        );
        qc.invalidateQueries({ queryKey: ["admin-promotions"] });
      }
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message || e?.response?.data?.detail || "That did not go through."),
  });

  return (
    <Modal
      open={!!promo}
      onClose={onClose}
      title={isCode ? `Email "${promo?.name}"` : `Grant "${promo?.name}"`}
      description={
        isCode
          ? "Send the code to chosen customers. They still have to redeem it."
          : "Apply this discount straight to the named accounts. There is no code for them to type."
      }
      icon={isCode ? <Mail size={17} /> : <Gift size={17} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon={isCode ? <Send size={15} /> : <Gift size={15} />}
            loading={send.isPending}
            disabled={!list.length}
            onClick={() => send.mutate()}
          >
            {isCode ? `Send to ${list.length || 0}` : `Grant to ${list.length || 0}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field
          label="Email addresses"
          hint="One per line, or comma separated. Addresses with no account are skipped."
        >
          <Textarea
            rows={4}
            className="font-mono text-xs"
            placeholder={"someone@example.com\nanother@example.com"}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
        </Field>

        {isCode && (
          <>
            <Field label="Subject" hint="Optional. A sensible default is used if you leave it blank.">
              <Input
                placeholder={`Your SilkLLM promo code: ${promo?.code}`}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </Field>
            <Field label="Note" hint="Optional. Appears above the code in the email.">
              <Textarea
                rows={2}
                placeholder="Thanks for being an early customer."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>
          </>
        )}

        {!isCode && (
          <Callout tone="info" icon={<Gift size={15} />}>
            The discount applies immediately, on the account's very next request. Accounts that
            already hold it are skipped rather than duplicated.
          </Callout>
        )}
      </div>
    </Modal>
  );
}

export default function AdminPromotions() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [viewing, setViewing] = useState<Promotion | null>(null);
  const [reaching, setReaching] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState<Promotion | null>(null);
  const [filter, setFilter] = useState<"all" | "live" | "ended">("all");

  const { data: promos, isLoading } = useQuery<Promotion[]>({
    queryKey: ["admin-promotions"],
    queryFn: () => adminPromotionsApi.list().then((r) => r.data),
  });
  const { data: stats } = useQuery({
    queryKey: ["admin-promotion-stats"],
    queryFn: () => adminPromotionsApi.stats().then((r) => r.data),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
    qc.invalidateQueries({ queryKey: ["admin-promotion-stats"] });
  };
  const fail = (fallback: string) => (e: any) =>
    toast.error(e?.response?.data?.error?.message || e?.response?.data?.detail || fallback);

  const create = useMutation({
    mutationFn: () => adminPromotionsApi.create(toBody(form)).then((r) => r.data),
    onSuccess: (data: Promotion) => {
      toast.success(data.code ? `Created ${data.code}.` : "Discount created.");
      setForm(EMPTY_FORM);
      setCreating(false);
      refresh();
    },
    onError: fail("Could not create the promotion."),
  });

  const update = useMutation({
    mutationFn: () => adminPromotionsApi.update(editing!.id, toBody(editForm, true)),
    onSuccess: () => { toast.success("Promotion updated."); setEditing(null); refresh(); },
    onError: fail("Could not update the promotion."),
  });

  const toggle = useMutation({
    mutationFn: (p: Promotion) => adminPromotionsApi.update(p.id, { is_active: !p.is_active }),
    onSuccess: () => { toast.success("Updated."); refresh(); },
    onError: fail("Could not change that."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminPromotionsApi.remove(id),
    onSuccess: () => { toast.success("Promotion deleted."); setDeleting(null); refresh(); },
    onError: fail("Could not delete the promotion."),
  });

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setEditForm({
      ...EMPTY_FORM,
      name: p.name,
      description: p.description || "",
      discountPercent: String(p.discount_percent),
      hasCode: !!p.code,
      code: p.code || "",
      capped: p.max_redemptions != null,
      maxRedemptions: p.max_redemptions != null ? String(p.max_redemptions) : "100",
      hasWindow: !!(p.starts_at || p.expires_at),
      startsAt: p.starts_at ? p.starts_at.slice(0, 16) : "",
      expiresAt: p.expires_at ? p.expires_at.slice(0, 16) : "",
      hasDuration: p.duration_days != null,
      durationDays: p.duration_days != null ? String(p.duration_days) : "30",
      scoped: !!p.allowed_models?.length,
      allowedModels: (p.allowed_models || []).join("\n"),
      restricted: !!p.restricted_emails?.length,
      restrictedEmails: (p.restricted_emails || []).join("\n"),
    });
  };

  const list = promos || [];
  const shown = useMemo(() => list.filter((p) => {
    if (filter === "live") return !p.unavailable_reason;
    if (filter === "ended") return !!p.unavailable_reason;
    return true;
  }), [list, filter]);

  const createError = formError(form);
  const editError = formError(editForm);

  return (
    <DashboardLayout>
      <PageHeader
        title="Promotions"
        subtitle="Discounts on the SilkLLM fee, as codes customers redeem or as rates granted directly to named accounts. Credit balances and provider costs are never affected."
        meta={
          stats ? (
            <>
              <Badge tone="neutral">{stats.total_promotions} total</Badge>
              {stats.live_promotions > 0 && <Badge tone="brand">{stats.live_promotions} live</Badge>}
            </>
          ) : undefined
        }
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
            New promotion
          </Button>
        }
      />

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatTile
            label="Fees given up"
            value={usdPrecise(stats.total_fee_given_up_usd || 0)}
            icon={<TrendingDown size={14} />}
            accent
            hint="What every campaign has cost so far"
          />
          <StatTile
            label="Redemptions"
            value={(stats.total_redemptions || 0).toLocaleString()}
            icon={<Sparkles size={14} />}
            hint={`${stats.distinct_users || 0} account${stats.distinct_users === 1 ? "" : "s"}`}
          />
          <StatTile
            label="Discounted requests"
            value={(stats.total_uses || 0).toLocaleString()}
            icon={<BadgePercent size={14} />}
          />
          <StatTile
            label="Live campaigns"
            value={stats.live_promotions || 0}
            icon={<Gift size={14} />}
            hint={`${stats.codes || 0} code${stats.codes === 1 ? "" : "s"}, ${stats.direct_grants || 0} direct`}
          />
        </div>
      )}

      {stats?.expiring_soon?.length > 0 && (
        <Callout
          tone="warning"
          icon={<Clock size={17} />}
          title={`${stats.expiring_soon.length} campaign${stats.expiring_soon.length > 1 ? "s end" : " ends"} within a week`}
        >
          <p>
            {stats.expiring_soon.map((p: any) => p.code || p.name).join(", ")}. Extend the end date
            to keep them running, or let them lapse. Accounts that already redeemed keep their
            discount until their own window closes.
          </p>
        </Callout>
      )}

      <Panel
        title="Campaigns"
        icon={<Gift size={15} />}
        actions={
          <SegmentedControl
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "live", label: "Live" },
              { value: "ended", label: "Ended" },
            ]}
          />
        }
      >
        {isLoading ? (
          <div className="p-5 space-y-2.5">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : !shown.length ? (
          <EmptyState
            icon={<Gift size={19} />}
            title={list.length ? "Nothing matches this filter" : "No promotions yet"}
            hint={
              list.length
                ? "Try a different filter."
                : "Create a code for a marketing push, or a direct discount for a partner."
            }
            action={
              !list.length ? (
                <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                  New promotion
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((p) => (
              <li key={p.id} className="px-5 sm:px-6 py-4">
                <div className="flex items-start gap-3 flex-wrap">
                  <span className={clsx(
                    "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border",
                    p.unavailable_reason
                      ? "bg-ink/[0.04] border-line text-ink-3"
                      : "bg-accent/10 border-accent/20 text-accent-ink",
                  )}>
                    {p.code ? <Tag size={16} /> : <Gift size={16} />}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-ink truncate">{p.name}</span>
                      <Badge tone="brand">{p.discount_percent}% off fees</Badge>
                      {p.unavailable_reason
                        ? <Badge tone="neutral">{p.unavailable_reason.replace(/\.$/, "")}</Badge>
                        : <Badge tone="success"><Check size={10} /> Live</Badge>}
                      {!p.code && <Badge tone="neutral">Direct grant</Badge>}
                      {p.restricted_emails?.length ? (
                        <Badge tone="neutral">{p.restricted_emails.length} account{p.restricted_emails.length > 1 ? "s" : ""} only</Badge>
                      ) : null}
                      {p.allowed_models?.length ? (
                        <Badge tone="neutral">{p.allowed_models.length} model{p.allowed_models.length > 1 ? "s" : ""}</Badge>
                      ) : null}
                    </div>

                    {p.code && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <code className="text-xs font-mono tracking-wider text-accent-ink bg-accent/[0.08] border border-accent/20 rounded px-2 py-0.5">
                          {p.code}
                        </code>
                        <CopyButton value={p.code} label={`Copy ${p.code}`} size={28} />
                      </div>
                    )}

                    {p.description && (
                      <p className="text-2xs text-ink-3 mt-1.5 leading-relaxed">{p.description}</p>
                    )}

                    <p className="text-2xs text-ink-3 mt-1.5 num">
                      {p.redemption_count} redeemed
                      {p.max_redemptions != null && ` of ${p.max_redemptions}`}
                      {p.total_uses > 0 && `, ${p.total_uses.toLocaleString()} discounted request${p.total_uses === 1 ? "" : "s"}`}
                      {p.expires_at && `, ends ${format(new Date(p.expires_at), "d MMM yyyy")}`}
                      {p.duration_days && `, ${p.duration_days}-day benefit`}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-2xs uppercase tracking-wide text-ink-3">Given up</p>
                      <p className="text-sm font-medium text-ink num">
                        {usdPrecise(p.total_fee_saved_usd || 0)}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <IconButton label={`Who used ${p.name}`} size={34} onClick={() => setViewing(p)}>
                        <Users size={15} />
                      </IconButton>
                      <IconButton
                        label={p.code ? `Email ${p.name}` : `Grant ${p.name}`}
                        size={34}
                        onClick={() => setReaching(p)}
                      >
                        {p.code ? <Mail size={15} /> : <Gift size={15} />}
                      </IconButton>
                      <IconButton label={`Edit ${p.name}`} size={34} onClick={() => openEdit(p)}>
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label={p.is_active ? `Pause ${p.name}` : `Resume ${p.name}`}
                        size={34}
                        onClick={() => toggle.mutate(p)}
                      >
                        {p.is_active ? <Ban size={15} /> : <Check size={15} />}
                      </IconButton>
                      <IconButton
                        label={`Delete ${p.name}`}
                        size={34}
                        tone="danger"
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Callout tone="info" icon={<BadgePercent size={16} />} title="What a discount does and does not touch">
        <p>
          A promotion reduces <strong>our fee</strong>, the margin added on top of what a request
          costs to serve. It never reduces the provider's cost and never touches a customer's credit
          balance, so a 100% discount charges exactly what the request cost us and no less.
        </p>
        <p className="mt-2">
          Changing the percentage on a live campaign applies to redemptions made from then on.
          Accounts that already claimed it keep the rate they were given, so the savings already
          reported stay reconcilable. Pausing a campaign, by contrast, stops the discount for
          everyone immediately.
        </p>
      </Callout>

      {/* Create */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New promotion"
        description="A code customers redeem, or a discount you grant to named accounts."
        icon={<Plus size={17} />}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={!!createError}
              onClick={() => create.mutate()}
            >
              Create promotion
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <PromotionForm value={form} onChange={setForm} />
          {createError && <p className="text-xs text-danger">{createError}</p>}
        </div>
      </Modal>

      {/* Edit */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit "${editing?.name || ""}"`}
        description="Changing the discount applies to new redemptions. Accounts that already claimed it keep their rate."
        icon={<Pencil size={17} />}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              variant="primary"
              loading={update.isPending}
              disabled={!!editError}
              onClick={() => update.mutate()}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <PromotionForm value={editForm} onChange={setEditForm} />
          {editError && <p className="text-xs text-danger">{editError}</p>}
        </div>
      </Modal>

      <RedemptionsDialog promo={viewing} onClose={() => setViewing(null)} />
      <ReachDialog promo={reaching} onClose={() => setReaching(null)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title={`Delete "${deleting?.name}"?`}
        body="This removes the campaign and every record of who redeemed it. Pausing it instead stops the discount at once but keeps the history. The ledger is untouched either way."
        confirmLabel="Delete promotion"
        pending={remove.isPending}
      />
    </DashboardLayout>
  );
}

// EOF silkllm-frontend/src/pages/admin/AdminPromotions.tsx
