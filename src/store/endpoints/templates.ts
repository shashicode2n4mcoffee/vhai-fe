/**
 * Templates API Endpoints.
 */

import { api } from "../api";
import type { PaginatedResponse } from "./interviews";

export interface Template {
  id: string;
  name: string;
  aiBehavior: string;
  customerWants: string;
  candidateOffers: string;
  isPublic: boolean;
  createdAt: string;
  creator: { id: string; name: string };
}

const templatesApi = api.injectEndpoints({
  endpoints: (builder) => ({
    createTemplate: builder.mutation<Template, { name: string; aiBehavior: string; customerWants: string; candidateOffers: string; isPublic?: boolean }>({
      query: (body) => ({ url: "/templates", method: "POST", body }),
      invalidatesTags: ["Interview"],
    }),
    listTemplates: builder.query<PaginatedResponse<Template>, { page?: number; limit?: number } | void>({
      query: (params) => ({
        url: "/templates",
        params: params || {},
      }),
      providesTags: ["Interview"],
    }),
    getTemplate: builder.query<Template, string>({
      query: (id) => `/templates/${id}`,
      providesTags: ["Interview"],
    }),
    updateTemplate: builder.mutation<Template, { id: string; data: Partial<Template> }>({
      query: ({ id, data }) => ({ url: `/templates/${id}`, method: "PUT", body: data }),
      invalidatesTags: ["Interview"],
    }),
    deleteTemplate: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/templates/${id}`, method: "DELETE" }),
      invalidatesTags: ["Interview"],
    }),
  }),
});

export const {
  useCreateTemplateMutation,
  useListTemplatesQuery,
  useGetTemplateQuery,
  useUpdateTemplateMutation,
  useDeleteTemplateMutation,
} = templatesApi;
