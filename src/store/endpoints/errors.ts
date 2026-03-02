/**
 * Errors API — Log user-facing errors and list them (admin).
 */

import { api } from "../api";

export interface LogErrorBody {
  message: string;
  details?: string;
  source?: string;
  userId?: string;
  userName?: string;
}

export interface ErrorLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  message: string;
  details: string | null;
  source: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface ErrorLogsResponse {
  data: ErrorLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const errorsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    logError: builder.mutation<{ id: string }, LogErrorBody>({
      query: (body) => ({
        url: "/errors/log",
        method: "POST",
        body,
      }),
      // No invalidatesTags — we don't need to refetch anything on log
    }),
    listErrors: builder.query<
      ErrorLogsResponse,
      { page?: number; limit?: number; source?: string; userId?: string } | void
    >({
      query: (params) => ({ url: "/errors", params: params ?? {} }),
      providesTags: ["ErrorLog"],
    }),
  }),
});

export const { useLogErrorMutation, useListErrorsQuery } = errorsApi;
