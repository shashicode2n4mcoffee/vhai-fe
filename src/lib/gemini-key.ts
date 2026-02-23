/**
 * Gemini Key Service — Fetches the Gemini API key from the backend.
 *
 * Caches the key in memory for its TTL duration.
 * All frontend Gemini calls use this instead of VITE_GEMINI_API_KEY.
 * Uses a connection timeout and one retry to avoid hanging on slow networks.
 */

import { getAccessToken } from "../store/api";

interface GeminiConfig {
  apiKey: string;
  model: string;
  reportModel: string;
  expiresAt: number;
}

let cachedConfig: GeminiConfig | null = null;

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";
const GEMINI_TOKEN_TIMEOUT_MS = 15_000;
const GEMINI_TOKEN_RETRIES = 2;

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getGeminiConfig(): Promise<GeminiConfig> {
  // Return cached if still valid (30s buffer)
  if (cachedConfig && cachedConfig.expiresAt > Date.now() + 30000) {
    return cachedConfig;
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in to use AI features.");
  }

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= GEMINI_TOKEN_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${API_BASE}/gemini/token`,
        { headers: { Authorization: `Bearer ${token}` } },
        GEMINI_TOKEN_TIMEOUT_MS,
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          cachedConfig = null;
          throw new Error("Session expired. Please log in again to use AI features.");
        }
        if (res.status === 429) {
          throw new Error("Rate limit exceeded for AI features. Please try again later.");
        }
        throw new Error(`Failed to fetch Gemini configuration (${res.status})`);
      }

      const data = await res.json();
      cachedConfig = {
        apiKey: data.apiKey,
        model: data.model,
        reportModel: data.reportModel,
        expiresAt: data.issuedAt + data.expiresIn * 1000,
      };
      return cachedConfig;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isTimeout = lastError.name === "AbortError";
      const isRetryable = isTimeout || /network|failed|timeout/i.test(lastError.message);
      if (attempt < GEMINI_TOKEN_RETRIES && isRetryable) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (isTimeout) {
        throw new Error("Connection timeout. Please check your network and try again.");
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("Failed to fetch Gemini configuration");
}

/** Clear cached config (e.g. on logout) */
export function clearGeminiCache(): void {
  cachedConfig = null;
}
