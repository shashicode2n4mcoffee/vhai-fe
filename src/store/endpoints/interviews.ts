/**
 * Interviews API Endpoints.
 */

import { api } from "../api";

export interface InterviewListItem {
  id: string;
  status: string;
  overallScore: number | null;
  recommendation: string | null;
  duration: number | null;
  createdAt: string;
  completedAt: string | null;
  candidate: { id: string; name: string; email: string };
  template: { id: string; name: string };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const interviewsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createInterview: builder.mutation<
      any,
      { templateId: string; interviewType?: "TECHNICAL" | "HR" | "BEHAVIORAL" | "GENERAL"; fromFullFlow?: boolean }
    >({
      query: (body) => ({ url: "/interviews", method: "POST", body }),
      invalidatesTags: ["Interview", "Credits"],
    }),
    listInterviews: builder.query<PaginatedResponse<InterviewListItem>, { page?: number; limit?: number; status?: string; candidateId?: string } | void>({
      query: (params) => ({
        url: "/interviews",
        params: params || {},
      }),
      providesTags: ["Interview"],
    }),
    getInterview: builder.query<any, string>({
      query: (id) => `/interviews/${id}`,
      providesTags: ["Interview"],
    }),
    updateInterview: builder.mutation<any, { id: string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/interviews/${id}`, method: "PUT", body: data }),
      invalidatesTags: ["Interview"],
    }),
    updateProctoring: builder.mutation<any, { id: string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/interviews/${id}/proctoring`, method: "PATCH", body: data }),
    }),
  }),
});

export const {
  useCreateInterviewMutation,
  useListInterviewsQuery,
  useGetInterviewQuery,
  useUpdateInterviewMutation,
  useUpdateProctoringMutation,
} = interviewsApi;
