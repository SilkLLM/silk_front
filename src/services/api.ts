/**
 * api.ts
 * Axios instance configured for the SilkLLM API.
 * Automatically attaches the Bearer token from localStorage.
 * Handles 401 responses by redirecting to login.
 */

// File: silkllm-frontend/src/services/api.ts

import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "/api";

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

// ── Response interceptor: handle 401 (auth) and 402 (out of credit) ─────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
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

export const authApi = {
  me: () => api.get("/auth/me"),
  googleLogin: () => { window.location.href = `${BASE_URL}/auth/google/login`; },
  githubLogin: () => { window.location.href = `${BASE_URL}/auth/github/login`; },
};

export const keysApi = {
  list: () => api.get("/keys"),
  create: (name: string) => api.post("/keys", { name }),
  revoke: (id: string) => api.delete(`/keys/${id}`),
};

export const balanceApi = {
  get: () => api.get("/balance"),
};

export const usageApi = {
  list: (page = 1, pageSize = 20, entryType?: string) =>
    api.get("/usage", { params: { page, page_size: pageSize, entry_type: entryType } }),
};

export const billingApi = {
  checkout: (amountUsd: number, provider: "stripe" | "paystack") =>
    api.post("/billing/checkout", { amount_usd: amountUsd, provider }),
  getRate: () => api.get("/billing/rate"),  // <-- NEW: fetch live USD/NGN rate
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
              }
            } catch (e) {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }
      onDone();
    } catch (err: any) {
      onError(err.message);
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
};

// Admin APIs (full CRUD)
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
};

export default api;

// EOF silkllm-frontend/src/services/api.ts