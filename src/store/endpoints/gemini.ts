/**
 * Gemini API Endpoints — Secure token fetching from backend.
 */

import { api } from "../api";

export interface GeminiTokenResponse {
  apiKey: string;
  model: string;
  reportModel: string;
  expiresIn: number;
  issuedAt: number;
}

const geminiApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getGeminiToken: builder.query<GeminiTokenResponse, void>({
      query: () => "/gemini/token",
      // Cache for 4 minutes (TTL is 5min from backend)
      keepUnusedDataFor: 240,
    }),
  }),
});

export const { useGetGeminiTokenQuery, useLazyGetGeminiTokenQuery } = geminiApi;
