/**
 * Gemini Key Service — Fetches the Gemini API key from the backend.
 *
 * Caches the key in memory for its TTL duration.
 * All frontend Gemini calls use this instead of VITE_GEMINI_API_KEY.
 * Uses a connection timeout and one retry to avoid hanging on slow networks.
 * On 401, attempts token refresh once and retries (so expired access token still works).
 */

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../store/api";
import { getApiBase } from "./apiBase";

interface GeminiConfig {
  apiKey: string;
  model: string;
  reportModel: string;
  expiresAt: number;
}

let cachedConfig: GeminiConfig | null = null;
const GEMINI_TOKEN_TIMEOUT_MS = 15_000;
const GEMINI_TOKEN_RETRIES = 2;

/** Try to refresh access token; returns new access token or null */
async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  const res = await fetch(`${getApiBase()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

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

  let token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in to use AI features.");
  }

  let lastError: Error | null = null;
  let triedRefresh = false;
  for (let attempt = 1; attempt <= GEMINI_TOKEN_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${getApiBase()}/gemini/token`,
        { headers: { Authorization: `Bearer ${token}` } },
        GEMINI_TOKEN_TIMEOUT_MS,
      );

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          cachedConfig = null;
          // Try refresh once, then retry with new token
          if (!triedRefresh && (token = (await tryRefreshToken()) ?? null)) {
            triedRefresh = true;
            continue;
          }
          clearTokens();
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
