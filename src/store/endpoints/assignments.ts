/**
 * Assignments API Endpoints.
 */

import { api } from "../api";
import type { PaginatedResponse } from "./interviews";

export interface Assignment {
  id: string;
  type: string;
  config: Record<string, unknown>;
  deadline: string | null;
  status: string;
  resultId: string | null;
  createdAt: string;
  candidate: { id: string; name: string; email: string };
  creator: { id: string; name: string };
}

const assignmentsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createAssignment: builder.mutation<Assignment, { type: string; candidateId: string; config: Record<string, unknown>; deadline?: string }>({
      query: (body) => ({ url: "/assignments", method: "POST", body }),
      invalidatesTags: ["Interview"],
    }),
    bulkCreateAssignments: builder.mutation<Assignment[], { type: string; candidateIds: string[]; config: Record<string, unknown>; deadline?: string }>({
      query: (body) => ({ url: "/assignments/bulk", method: "POST", body }),
      invalidatesTags: ["Interview"],
    }),
    listAssignments: builder.query<PaginatedResponse<Assignment>, { page?: number; limit?: number; status?: string; type?: string } | void>({
      query: (params) => ({
        url: "/assignments",
        params: params || {},
      }),
      providesTags: ["Interview"],
    }),
    getAssignment: builder.query<Assignment, string>({
      query: (id) => `/assignments/${id}`,
    }),
    updateAssignment: builder.mutation<Assignment, { id: string; data: Record<string, unknown> }>({
      query: ({ id, data }) => ({ url: `/assignments/${id}`, method: "PUT", body: data }),
      invalidatesTags: ["Interview"],
    }),
    deleteAssignment: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/assignments/${id}`, method: "DELETE" }),
      invalidatesTags: ["Interview"],
    }),
  }),
});

export const {
  useCreateAssignmentMutation,
  useBulkCreateAssignmentsMutation,
  useListAssignmentsQuery,
  useGetAssignmentQuery,
  useUpdateAssignmentMutation,
  useDeleteAssignmentMutation,
} = assignmentsApi;
