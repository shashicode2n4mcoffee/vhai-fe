/**
 * Aptitude API Endpoints.
 */

import { api } from "../api";
import type { PaginatedResponse } from "./interviews";

export interface AptitudeListItem {
  id: string;
  topic: string;
  difficulty: string;
  score: number | null;
  total: number;
  percentage: number | null;
  passed: boolean | null;
  createdAt: string;
  completedAt: string | null;
  candidate: { id: string; name: string };
}

const aptitudeApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createAptitude: builder.mutation<any, Record<string, unknown>>({
      query: (body) => ({ url: "/aptitude", method: "POST", body }),
      invalidatesTags: ["Aptitude"],
    }),
    listAptitude: builder.query<PaginatedResponse<AptitudeListItem>, { page?: number; limit?: number } | void>({
      query: (params) => ({
        url: "/aptitude",
        params: params || {},
      }),
      providesTags: ["Aptitude"],
    }),
    getAptitude: builder.query<any, string>({
      query: (id) => `/aptitude/${id}`,
      providesTags: ["Aptitude"],
    }),
    updateAptitude: builder.mutation<any, { id: string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/aptitude/${id}`, method: "PUT", body: data }),
      invalidatesTags: ["Aptitude"],
    }),
  }),
});

export const {
  useCreateAptitudeMutation,
  useListAptitudeQuery,
  useGetAptitudeQuery,
  useUpdateAptitudeMutation,
} = aptitudeApi;
