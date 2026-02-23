/**
 * Analytics API Endpoints.
 */

import { api } from "../api";

export interface DashboardStats {
  stats: {
    totalInterviews: number;
    completedInterviews: number;
    totalAptitude: number;
    totalCoding: number;
    totalUsers: number;
    avgInterviewScore: number;
    avgAptitudeScore: number;
    avgCodingScore: number;
  };
  recent: {
    interviews: Array<{
      id: string;
      overallScore: number | null;
      recommendation: string | null;
      createdAt: string;
      candidate: { name: string };
      template: { name: string };
    }>;
    aptitude: Array<{
      id: string;
      topic: string;
      score: number | null;
      total: number;
      percentage: number | null;
      passed: boolean | null;
      createdAt: string;
      candidate: { name: string };
    }>;
    coding: Array<{
      id: string;
      topic: string;
      language: string;
      score: number | null;
      verdict: string | null;
      createdAt: string;
      candidate: { name: string };
    }>;
  };
}

const analyticsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardStats, void>({
      query: () => "/analytics/dashboard",
      providesTags: ["Interview", "Aptitude", "Coding"],
    }),
    getCandidates: builder.query<any, { page?: number; limit?: number } | void>({
      query: (params) => ({
        url: "/analytics/candidates",
        params: params || {},
      }),
    }),
    getExport: builder.query<any, { type: string }>({
      query: ({ type }) => `/analytics/export?type=${type}`,
    }),
  }),
});

export const {
  useGetDashboardQuery,
  useGetCandidatesQuery,
  useLazyGetExportQuery,
} = analyticsApi;
