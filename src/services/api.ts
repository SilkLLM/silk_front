/**
 * api.ts
 * Axios instance configured for the SilkLLM API.
 * Automatically attaches the Bearer token from localStorage.
 * Handles 401 responses by redirecting to login.
 */

// File: silkllm-frontend/src/services/api.ts

import axios from "axios";
import { API_BASE_URL } from "@/lib/endpoint";

const BASE_URL = API_BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ── Request interceptor: attach token ──────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("silk_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Broadcast that a request failed for lack of credit, so the UI can show a
 * "add credits" reminder. Fired by the 402 interceptor and by the chat stream
 * (which uses fetch, not axios).
 */
export function notifyNeedCredit(detail?: string) {
  window.dispatchEvent(new CustomEvent("silk:need-credit", { detail }));
}

/**
 * Broadcast that a request succeeded only because the trial substituted a
 * free model for the one actually requested (out of balance, engine picked
 * a model it has vetted as reliably free instead of failing the request).
 * Fired from the chat stream's final "meta" event; deliberately separate
 * from silk:need-credit; a request that just succeeded should get a
 * light, dismissible nudge, not the same blocking "you're out of credit"
 * modal used for an actual failure.
 */
export function notifyTrialFreeModelUsed(servedModel: string) {
  window.dispatchEvent(new CustomEvent("silk:trial-free-model", { detail: { servedModel } }));
}

/**
 * Announce that the backend could not be reached, so the app can show a
 * maintenance screen instead of a broken one.
 *
 * Only two things count as unreachable: a request that never got an answer at
 * all, and a gateway status the platform returns while a service is starting or
 * gone. A 400 or a 404 means the server is up and answered, and treating those
 * as an outage would hide real errors behind a reassuring page.
 */
export function notifyServiceDown() {
  window.dispatchEvent(new CustomEvent("silk:service-down"));
}

export function notifyServiceUp() {
  window.dispatchEvent(new CustomEvent("silk:service-up"));
}

const GATEWAY_STATUSES = [502, 503, 504];

// ── Response interceptor: handle 401 (auth) and 402 (out of credit) ─────────
api.interceptors.response.use(
  (response) => {
    // Any successful answer means the service is up, which is how the
    // maintenance screen clears itself without a reload.
    notifyServiceUp();
    return response;
  },
  (error) => {
    const status = error.response?.status;
    // No response at all means the request never reached a server: DNS, TLS, a
    // dropped connection, or the browser being offline. Axios reports a
    // cancelled request the same way, so those are excluded explicitly.
    const noAnswer = !error.response && error.code !== "ERR_CANCELED";
    if (noAnswer || GATEWAY_STATUSES.includes(status)) {
      notifyServiceDown();
    }
    if (status === 401) {
      localStorage.removeItem("silk_token");
      window.location.href = "/login";
    } else if (status === 402) {
      notifyNeedCredit(error.response?.data?.error?.message || error.response?.data?.detail);
    }
    return Promise.reject(error);
  }
);

// ── Typed API helpers ──────────────────────────────────────────────────────

/** The origin the API lives on, without the /api suffix. */
const ORIGIN = BASE_URL.replace(/\/api\/?$/, "");

/**
 * Whether the backend can actually complete a sign-in right now.
 *
 * Checked before starting OAuth because that step is a full browser navigation
 * away from this app. If the backend is down, the browser renders its own error
 * page and there is no React left to catch it: the maintenance screen never
 * gets a chance to appear, and the customer sees a raw 502. Asking first is the
 * only way to keep them inside the app.
 *
 * `/ready` is the right question, since signing in needs the database rather
 * than merely a listening process. A backend too old to have that route answers
 * 404, so the check falls back to `/health` instead of blocking login against a
 * server that is perfectly fine.
 */
async function canSignIn(): Promise<boolean> {
  const ask = async (path: string) => {
    try {
      return await fetch(`${ORIGIN}${path}`, { cache: "no-store" });
    } catch {
      return null;
    }
  };

  const ready = await ask("/ready");
  if (ready?.ok) return true;
  if (ready && ready.status === 503) return false;   // up, but not serving yet

  const health = await ask("/health");
  return !!health?.ok;
}

async function startOAuth(provider: "google" | "github"): Promise<boolean> {
  if (!(await canSignIn())) {
    notifyServiceDown();
    return false;
  }
  window.location.href = `${BASE_URL}/auth/${provider}/login`;
  return true;
}

export const authApi = {
  me: () => api.get("/auth/me"),
  /** Resolves false when the backend could not take the sign-in. */
  googleLogin: () => startOAuth("google"),
  githubLogin: () => startOAuth("github"),
};

/**
 * Fill in the spend-cap fields on an API key.
 *
 * Not every response carries them: the create endpoint answers with a smaller
 * shape, and a backend that has not yet run the spend-cap migration omits them
 * entirely. Normalising here means the UI only ever sees a complete key, rather
 * than every call site having to guard, and `=== null` checks silently letting
 * `undefined` through. That exact gap crashed the keys page in production.
 */
function normaliseKey(k: any) {
  const limit = k?.spend_limit_usd ?? null;
  const spent = Number(k?.spent_usd ?? 0);
  return {
    ...k,
    spend_limit_usd: limit === null ? null : Number(limit),
    spent_usd: Number.isFinite(spent) ? spent : 0,
    remaining_usd: k?.remaining_usd ?? (limit === null ? null : Math.max(0, Number(limit) - spent)),
    is_exhausted: k?.is_exhausted ?? (limit !== null && spent >= Number(limit)),
    is_active: k?.is_active ?? true,
    last_used: k?.last_used ?? null,
    limit_reset_at: k?.limit_reset_at ?? null,
    alert_at_percent: k?.alert_at_percent ?? null,
    allowed_models: k?.allowed_models ?? null,
    allowed_providers: k?.allowed_providers ?? null,
    rate_limit_per_min: k?.rate_limit_per_min ?? null,
    budget_pool_id: k?.budget_pool_id ?? null,
  };
}

/**
 * Everything that can be configured on a key at creation time.
 * All optional: a key with none of these set behaves exactly as keys always have.
 */
export interface KeyControls {
  /** Caps how much of your balance this key may draw. Omit for no cap. */
  spend_limit_usd?: number | null;
  /** Notify at this percentage of the cap, e.g. 80. Needs a cap to mean anything. */
  alert_at_percent?: number | null;
  /** Only these model ids may be used. Omit to allow every model. */
  allowed_models?: string[] | null;
  /** Only these provider ids may be used. Omit to allow every provider. */
  allowed_providers?: string[] | null;
  /** Requests per minute ceiling for this key alone. */
  rate_limit_per_min?: number | null;
  /** Draw against a shared team budget as well as the key's own cap. */
  budget_pool_id?: string | null;
}

/**
 * Removals are explicit flags rather than nulls.
 *
 * An omitted field has to keep meaning "leave this alone", otherwise a form
 * that only edits the name would wipe every limit on the key.
 */
export interface KeyUpdate extends KeyControls {
  name?: string;
  is_active?: boolean;
  clear_spend_limit?: boolean;
  clear_alert?: boolean;
  clear_scope?: boolean;
  clear_rate_limit?: boolean;
  clear_budget_pool?: boolean;
}

/**
 * Force a list response to be a list.
 *
 * A backend mid-deploy, an error body, or a paginated envelope all answer with
 * something that is not an array, and `(data || []).map` throws on every one of
 * them because an object is truthy. Callers render lists, so they get a list.
 */
function asArray<T = any>(data: any, key?: string): T[] {
  if (Array.isArray(data)) return data;
  if (key && Array.isArray(data?.[key])) return data[key];
  return [];
}

export const keysApi = {
  list: () => api.get("/keys").then((r) => ({ ...r, data: asArray(r.data, "keys").map(normaliseKey) })),
  create: (name: string, controls: KeyControls = {}) =>
    api.post("/keys", { name, ...controls }).then((r) => ({ ...r, data: normaliseKey(r.data) })),
  update: (id: string, data: KeyUpdate) =>
    api.patch(`/keys/${id}`, data).then((r) => ({ ...r, data: normaliseKey(r.data) })),
  revoke: (id: string) => api.delete(`/keys/${id}`),
  /**
   * Delete a revoked key and its activity log for good.
   *
   * Separate from revoke on purpose: revoking stops the key but keeps the
   * history, and only a key that is already stopped can have that history
   * destroyed. The account ledger is untouched either way.
   */
  deletePermanently: (id: string) => api.delete(`/keys/${id}/permanent`),
  /** Balance, how much of it is already promised to limits, and what is left. */
  allocation: () => api.get("/keys/allocation").then((r) => ({
    ...r,
    data: {
      balance: Number(r.data?.balance ?? 0),
      allocated: Number(r.data?.allocated ?? 0),
      available: Number(r.data?.available ?? 0),
    },
  })),
  /** Per-key request history, newest first. Includes refused attempts. */
  usage: (id: string, page = 1, pageSize = 50, status?: string) =>
    api.get(`/keys/${id}/usage`, { params: { page, page_size: pageSize, status } }),
  /** Zero the spend counter. Does not touch the history or refund anything. */
  reset: (id: string) => api.post(`/keys/${id}/reset`),
  /**
   * Download the full history as a file.
   *
   * Fetched as a blob rather than linking to the URL directly: the export needs
   * the Authorization header, which a plain anchor cannot send.
   */
  exportUsage: async (id: string, format: "csv" | "json" = "csv") => {
    const resp = await api.get(`/keys/${id}/usage/export`, {
      params: { format }, responseType: "blob",
    });
    const url = URL.createObjectURL(new Blob([resp.data]));
    const a = document.createElement("a");
    a.href = url;
    a.download = `silkllm-key-usage-${id.slice(0, 8)}.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

/** Shared budgets. Several keys draw on one limit, for a team or an environment. */
export const budgetsApi = {
  list: () => api.get("/budgets").then((r) => ({ ...r, data: asArray(r.data, "budgets") })),
  create: (name: string, spendLimitUsd?: number | null) =>
    api.post("/budgets", { name, spend_limit_usd: spendLimitUsd ?? null }),
  update: (id: string, data: { name?: string; spend_limit_usd?: number; clear_spend_limit?: boolean }) =>
    api.patch(`/budgets/${id}`, data),
  reset: (id: string) => api.post(`/budgets/${id}/reset`),
  remove: (id: string) => api.delete(`/budgets/${id}`),
};

/** Outbound notifications for limit events, signed with HMAC-SHA256. */
export const webhooksApi = {
  list: () => api.get("/webhooks").then((r) => ({ ...r, data: asArray(r.data, "webhooks") })),
  /** The signing secret comes back once, on create, and is never shown again. */
  create: (url: string, events: string[]) => api.post("/webhooks", { url, events }),
  test: (id: string) => api.post(`/webhooks/${id}/test`),
  remove: (id: string) => api.delete(`/webhooks/${id}`),
  events: () => api.get("/webhooks/events").then((r) => ({ ...r, data: asArray<string>(r.data, "events") })),
};

export const balanceApi = {
  get: () => api.get("/balance"),
};

export const usageApi = {
  list: (page = 1, pageSize = 20, entryType?: string) =>
    api.get("/usage", { params: { page, page_size: pageSize, entry_type: entryType } }),
};

export const billingApi = {
  checkout: (amountUsd: number, provider: "paystack" | "dodo" | "flutterwave") =>
    api.post("/billing/checkout", { amount_usd: amountUsd, provider }),
  getRate: () => api.get("/billing/rate"),
  getRails: () => api.get("/billing/rails"),
};

export const modelsApi = {
  list: (provider?: string) => api.get("/models", { params: { provider } }),
};

// ── Generation API (streaming + non-streaming, with optional API key override) ──
export const generateApi = {
  /**
   * Non-streaming generation.
   * @param params - Generation parameters
   * @param apiKeyOverride - Optional API key (if not provided, uses default from localStorage)
   */
  generate: async (
    params: {
      messages: { role: string; content: string }[];
      model?: string;
      provider?: string;
      temperature?: number;
      max_tokens?: number;
      stream?: false;
    },
    apiKeyOverride?: string
  ) => {
    const token = apiKeyOverride || localStorage.getItem("silk_token");
    return api.post("/generate", params, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },

  /**
   * Streaming generation using fetch.
   * @param params - Generation parameters (stream: true)
   * @param onChunk - Callback for each content chunk
   * @param onError - Callback for error
   * @param onDone - Callback when stream ends
   * @param apiKeyOverride - Optional API key (if not provided, uses default from localStorage)
   */
  streamGenerate: async (
    params: {
      messages: { role: string; content: string | unknown[] }[];
      model?: string;
      provider?: string;
      temperature?: number;
      max_tokens?: number;
      stream: true;
    },
    onChunk: (chunk: string) => void,
    onError: (error: string) => void,
    onDone: () => void,
    apiKeyOverride?: string
  ) => {
    const token = apiKeyOverride || localStorage.getItem("silk_token");
    const url = `${BASE_URL}/generate`;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 402) notifyNeedCredit(errorText);
        onError(errorText);
        return;
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") {
              onDone();
              return;
            }
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.content) {
                onChunk(parsed.content);
              } else if (parsed.error) {
                onError(parsed.error);
                return;
              } else if (parsed.meta?.served_free_model) {
                notifyTrialFreeModelUsed(parsed.meta.model);
              }
            } catch (e) {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }
      onDone();
    } catch (err: any) {
      // fetch() rejects with a bare "Failed to fetch" / "Load failed" for any
      // network-level failure (DNS, TLS, CORS, dropped connection) - it never
      // reaches response.ok above, so none of the status-based handling runs.
      // The axios instance treats the equivalent case (no response at all) as
      // an outage and shows the maintenance screen instead of a raw browser
      // error; mirror that here rather than dumping the exception message into
      // the chat transcript.
      notifyServiceDown();
      onError("SilkLLM could not be reached. Check your connection and try again.");
    }
  },
};

// ── BYOK marketplace: the user's own deposited keys ────────────────────────
export const providerKeysApi = {
  list: () => api.get("/provider-keys"),
  deposit: (data: {
    provider_id: string;
    api_key: string;
    label?: string;
    is_public?: boolean;
    is_free_key?: boolean;
    serve_owner_with_own_key?: boolean;
    daily_limit_usd?: number;
    declared_budget_usd?: number;
  }) => api.post("/provider-keys", data),
  update: (id: string, data: any) => api.patch(`/provider-keys/${id}`, data),
  revoke: (id: string) => api.delete(`/provider-keys/${id}`),
};

// ── Free trial ──────────────────────────────────────────────────────────────
export const trialApi = {
  status: () => api.get("/trial"),
};

// ── Dashboard notifications ─────────────────────────────────────────────────
export const notificationsApi = {
  list: (unreadOnly = false, page = 1) =>
    api.get("/notifications", { params: { unread_only: unreadOnly, page } }),
  unreadCount: () => api.get("/notifications/unread-count"),
  markRead: (id: string) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post("/notifications/read-all"),
};

// ── Multimodal generation (uses the session token) ─────────────────────────
export interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
}

export const mediaApi = {
  image: (data: { prompt: string; model?: string; provider?: string; n?: number; size?: string }) =>
    api.post("/generate/image", data),
  audio: (data: {
    prompt: string; model?: string; provider?: string; voice?: string;
    voice_settings?: VoiceSettings; output_format?: string;
  }) => api.post("/generate/audio", data),
  video: (data: { prompt: string; model?: string; provider?: string; seconds?: number }) =>
    api.post("/generate/video", data),
  // Speakers for a voice provider (ElevenLabs). Used to render a speaker picker.
  voices: (provider = "elevenlabs") => api.get("/generate/audio/voices", { params: { provider } }),
  // Voice conversion (speech-to-speech) and instant voice cloning (multipart).
  speechToSpeech: (form: FormData) =>
    api.post("/generate/audio/speech-to-speech", form, { headers: { "Content-Type": undefined }, timeout: 180000 }),
  cloneVoice: (form: FormData) =>
    api.post("/generate/audio/clone-voice", form, { headers: { "Content-Type": undefined }, timeout: 180000 }),
};

// Admin APIs (full CRUD)
/**
 * Promotions: discounts on the SilkLLM fee.
 *
 * These reduce the margin we add on top of a request, never the credit balance
 * and never the provider's cost. Every label in the UI has to keep saying so,
 * because "discount" and "free credit" are easy to confuse and only one of them
 * is what this is.
 */
export interface Promotion {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  discount_percent: number;
  max_redemptions: number | null;
  redemption_count: number;
  seats_left: number | null;
  starts_at: string | null;
  expires_at: string | null;
  duration_days: number | null;
  restricted_user_ids: string[] | null;
  restricted_emails: string[] | null;
  allowed_models: string[] | null;
  allowed_providers: string[] | null;
  is_active: boolean;
  created_at: string;
  unavailable_reason: string | null;
  total_fee_saved_usd: number;
  total_uses: number;
}

export interface MyPromotion {
  id: string;
  promotion_name: string;
  description: string | null;
  discount_percent: number;
  redeemed_at: string;
  expires_at: string | null;
  is_active: boolean;
  uses_count: number;
  fee_saved_usd: number;
  applies_to_models: string[] | null;
  applies_to_providers: string[] | null;
  summary: string;
}

export const promotionsApi = {
  /** Claim a code. One per account. */
  redeem: (code: string) => api.post("/promotions/redeem", { code }),
  /** Everything this account has ever claimed, live and expired. */
  mine: () => api.get("/promotions").then((r) => ({ ...r, data: asArray<MyPromotion>(r.data) })),
  /** The one currently being applied, or null. Discounts do not stack. */
  active: () => api.get("/promotions/active"),
};

export const adminPromotionsApi = {
  list: () => api.get("/admin/promotions").then((r) => ({ ...r, data: asArray<Promotion>(r.data) })),
  get: (id: string) => api.get(`/admin/promotions/${id}`),
  stats: () => api.get("/admin/promotions/stats"),
  create: (data: Record<string, unknown>) => api.post("/admin/promotions", data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/admin/promotions/${id}`, data),
  remove: (id: string) => api.delete(`/admin/promotions/${id}`),
  /** Who claimed it, when, and what it has cost in given-up fees. */
  redemptions: (id: string) =>
    api.get(`/admin/promotions/${id}/redemptions`).then((r) => ({ ...r, data: asArray(r.data) })),
  /** Give it to named accounts, with no code for them to type. */
  grant: (id: string, data: { emails?: string[]; user_ids?: string[] }) =>
    api.post(`/admin/promotions/${id}/grant`, data),
  /** Email the code out. Only for promotions that have one. */
  email: (id: string, data: { emails: string[]; subject?: string; message?: string }) =>
    api.post(`/admin/promotions/${id}/email`, data),
  suggestCode: (prefix = "") =>
    api.get("/admin/promotions/generate-code", { params: { prefix } }),
};

export const adminApi = {
  providers: {
    list: () => api.get("/admin/providers"),
    create: (data: {
      id: string;
      name: string;
      api_key: string;
      alert_threshold_percent?: number;
    }) => api.post("/admin/providers", data),
    update: (id: string, data: any) => api.patch(`/admin/providers/${id}`, data),
    delete: (id: string) => api.delete(`/admin/providers/${id}`),
  },
  models: {
    list: () => api.get("/admin/models"),
    create: (data: {
      id: string;
      provider_id: string;
      display_name: string;
      enabled?: boolean;
      input_cost_per_1k?: number;
      output_cost_per_1k?: number;
      routing_weight?: number;
      fallback_models?: string[];
      capabilities?: string[];
      context_window?: number;
    }) => api.post("/admin/models", data),
    update: (id: string, data: any) => api.patch(`/admin/models/${id}`, data),
    delete: (id: string) => api.delete(`/admin/models/${id}`),
  },
  topups: {
    list: (providerId?: string) => api.get("/admin/topups", { params: { provider_id: providerId } }),
    record: (data: any) => api.post("/admin/topups", data),
  },
  alerts: {
    list: (unackedOnly = false) => api.get("/admin/alerts", { params: { unacknowledged_only: unackedOnly } }),
    acknowledge: (id: string) => api.post(`/admin/alerts/${id}/acknowledge`),
  },
  credits: {
    ledger: (page = 1) => api.get("/admin/credits/ledger", { params: { page } }),
    users: () => api.get("/admin/credits/users"),
    refund: (data: any) => api.post("/admin/credits/refund", data),
  },
  settings: {
    list: () => api.get("/admin/settings"),
    update: (key: string, value: number) => api.patch(`/admin/settings/${key}`, { value }),
  },
  marketplace: {
    keys: (params: { sort?: string; search?: string; status?: string; page?: number; page_size?: number }) =>
      api.get("/admin/marketplace/keys", { params }),
    analytics: () => api.get("/admin/marketplace/analytics"),
    owners: () => api.get("/admin/marketplace/owners"),
    suspend: (id: string) => api.post(`/admin/marketplace/keys/${id}/suspend`),
    activate: (id: string) => api.post(`/admin/marketplace/keys/${id}/activate`),
  },
  killswitch: {
    list: () => api.get("/admin/killswitch"),
    set: (key: string, enabled: boolean, reason?: string) =>
      api.post(`/admin/killswitch/${key}`, { enabled, reason }),
  },
  analytics: {
    reliability: (days = 7) => api.get("/admin/analytics/reliability", { params: { days } }),
  },
};

export default api;

// EOF silkllm-frontend/src/services/api.ts