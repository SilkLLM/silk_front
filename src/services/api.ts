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

// ── Response interceptor: handle 401 ──────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("silk_token");
      window.location.href = "/login";
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

// ── Generation API (streaming + non‑streaming, with optional API key override) ──
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
      messages: { role: string; content: string }[];
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
};

export default api;

// EOF silkllm-frontend/src/services/api.ts