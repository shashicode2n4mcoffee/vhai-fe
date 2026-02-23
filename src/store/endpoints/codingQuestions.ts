/**
 * Coding Questions & Companies API — Question bank (LeetCode-style) with company associations.
 */

import { api } from "../api";

export interface Company {
  id: string;
  name: string;
  country: string;
  type: string;
}

export interface CodingQuestionItem {
  id: string;
  leetcodeId: number;
  questionFrontendId: number | null;
  title: string;
  titleSlug: string;
  translatedTitle: string | null;
  difficulty: string;
  paidOnly: boolean;
  status: string | null;
  frequency: number | null;
  acRate: number | null;
  contestPoint: number | null;
  topicTags: string | null;
  topicSlugs: string | null;
  companies: Company[];
}

export interface CodingQuestionsResponse {
  data: CodingQuestionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ListQuestionsParams {
  page?: number;
  limit?: number;
  difficulty?: string;
  topic?: string;
  companyId?: string;
}

const codingQuestionsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listCodingQuestions: builder.query<CodingQuestionsResponse, ListQuestionsParams | void>({
      query: (params = {}) => ({
        url: "/coding-questions",
        params: {
          page: params?.page ?? 1,
          limit: params?.limit ?? 20,
          ...(params?.difficulty && { difficulty: params.difficulty }),
          ...(params?.topic && { topic: params.topic }),
          ...(params?.companyId && { companyId: params.companyId }),
        },
      }),
    }),
    getCodingQuestion: builder.query<CodingQuestionItem & { createdAt: string; updatedAt: string }, string>({
      query: (id) => `/coding-questions/${id}`,
    }),
    listQuestionCompanies: builder.query<Company[], string | void>({
      query: (country) => ({
        url: "/coding-questions/companies",
        params: country ? { country } : undefined,
      }),
    }),
  }),
});

export const {
  useListCodingQuestionsQuery,
  useGetCodingQuestionQuery,
  useListQuestionCompaniesQuery,
} = codingQuestionsApi;
