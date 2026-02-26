/**
 * RTK Query Base API — Connected to the backend.
 *
 * Features:
 * - Automatic JWT token attachment
 * - Token refresh on 401 responses (uses httpOnly cookie when same-origin, else body)
 * - Tag-based cache invalidation
 *
 * Security: Access token in sessionStorage (cleared when tab closes; reduces XSS scope).
 * Refresh token: when backend sets httpOnly cookie it is not stored here; we still
 * store refresh in localStorage when received in body for cross-origin / fallback.
 */

import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { getApiBase } from "../lib/apiBase";

const TOKEN_KEY = "vocalhireai_token";
const REFRESH_KEY = "vocalhireai_refresh_token";

/** Access token: sessionStorage so it is not shared across tabs and is cleared on tab close. */
export function getAccessToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

/** Refresh token: localStorage fallback when not using httpOnly cookie (e.g. cross-origin). */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ── Base query with auth header ─────────────────────────

const baseQuery = fetchBaseQuery({
  baseUrl: getApiBase(),
  credentials: "include",
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

// ── Base query with automatic token refresh ─────────────

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    // Try to refresh the token
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      const refreshResult = await baseQuery(
        {
          url: "/auth/refresh",
          method: "POST",
          body: { refreshToken },
        },
        api,
        extraOptions,
      );

      if (refreshResult.data) {
        const { accessToken, refreshToken: newRefresh } = refreshResult.data as {
          accessToken: string;
          refreshToken: string;
        };
        setTokens(accessToken, newRefresh);

        // Retry the original request
        result = await baseQuery(args, api, extraOptions);
      } else {
        // Refresh failed — clear tokens and redirect to login
        clearTokens();
        window.location.href = "/login";
      }
    } else {
      clearTokens();
      window.location.href = "/login";
    }
  }

  return result;
};

// ── API Instance ────────────────────────────────────────

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["User", "Interview", "Aptitude", "Coding", "Settings", "Credits", "ErrorLog"],
  endpoints: () => ({}),
});
