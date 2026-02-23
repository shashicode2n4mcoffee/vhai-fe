/**
 * Coding API Endpoints.
 */

import { api } from "../api";
import type { PaginatedResponse } from "./interviews";

export interface CodingListItem {
  id: string;
  topic: string;
  language: string;
  difficulty: string;
  score: number | null;
  verdict: string | null;
  timeSpent: number | null;
  createdAt: string;
  completedAt: string | null;
  candidate: { id: string; name: string };
}

const codingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createCoding: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/coding", method: "POST", body }),
      invalidatesTags: ["Coding"],
    }),
    listCoding: builder.query<PaginatedResponse<CodingListItem>, { page?: number; limit?: number } | void>({
      query: (params) => ({
        url: "/coding",
        params: params || {},
      }),
      providesTags: ["Coding"],
    }),
    getCoding: builder.query<any, string>({
      query: (id) => `/coding/${id}`,
      providesTags: ["Coding"],
    }),
    updateCoding: builder.mutation<any, { id: string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/coding/${id}`, method: "PUT", body: data }),
      invalidatesTags: ["Coding"],
    }),
  }),
});

export const {
  useCreateCodingMutation,
  useListCodingQuery,
  useGetCodingQuery,
  useUpdateCodingMutation,
} = codingApi;
