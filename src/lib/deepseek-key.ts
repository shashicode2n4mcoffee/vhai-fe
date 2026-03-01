/**
 * DeepSeek Key Service — Fetches DeepSeek API key from backend or uses VITE_DEEPSEEK_API_KEY.
 * Used for aptitude, coding challenge, and final report generation (DeepSeek-V3.2).
 */

import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../store/api";
import { getApiBase } from "./apiBase";

export interface DeepSeekConfig {
  apiKey: string;
  model: string;
  expiresAt: number;
}

const DEEPSEEK_MODEL = "deepseek-chat"; // DeepSeek-V3.2 non-thinking
let cachedConfig: DeepSeekConfig | null = null;
const TOKEN_TIMEOUT_MS = 15_000;
const RETRIES = 2;

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

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getDeepSeekConfig(): Promise<DeepSeekConfig> {
  if (cachedConfig && cachedConfig.expiresAt > Date.now() + 30_000) {
    return cachedConfig;
  }

  const envKey = import.meta.env.VITE_DEEPSEEK_API_KEY;
  if (envKey && typeof envKey === "string" && envKey.length > 0) {
    cachedConfig = {
      apiKey: envKey,
      model: DEEPSEEK_MODEL,
      expiresAt: Date.now() + 300_000,
    };
    return cachedConfig;
  }

  let token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated. Please log in to use aptitude, coding, and report features.");
  }

  let lastError: Error | null = null;
  let triedRefresh = false;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(
        `${getApiBase()}/deepseek/token`,
        { headers: { Authorization: `Bearer ${token}` } },
        TOKEN_TIMEOUT_MS,
      );

      if (!res.ok) {
        if ((res.status === 401 || res.status === 403) && !triedRefresh) {
          const newToken = await tryRefreshToken();
          if (newToken) {
            token = newToken;
            triedRefresh = true;
            continue;
          }
        }
        cachedConfig = null;
        if (res.status === 503) {
          throw new Error(
            "DeepSeek is not configured. Set DEEPSEEK_API_KEY on the server or VITE_DEEPSEEK_API_KEY in the app.",
          );
        }
        if (res.status === 401 || res.status === 403) {
          clearTokens();
          throw new Error("Session expired. Please log in again.");
        }
        if (res.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.");
        }
        throw new Error(`Failed to get DeepSeek configuration (${res.status})`);
      }

      const data = await res.json();
      cachedConfig = {
        apiKey: data.apiKey,
        model: data.model || DEEPSEEK_MODEL,
        expiresAt: (data.issuedAt || Date.now()) + (data.expiresIn || 300) * 1000,
      };
      return cachedConfig;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isRetryable =
        lastError.name === "AbortError" || /network|failed|timeout/i.test(lastError.message);
      if (attempt < RETRIES && isRetryable) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      if (lastError.name === "AbortError") {
        throw new Error("Connection timeout. Please check your network and try again.");
      }
      throw lastError;
    }
  }
  throw lastError ?? new Error("Failed to fetch DeepSeek configuration");
}

export function clearDeepSeekCache(): void {
  cachedConfig = null;
}
