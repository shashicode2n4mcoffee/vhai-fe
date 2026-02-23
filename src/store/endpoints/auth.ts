/**
 * Auth API Endpoints — Login, Signup, Token Refresh, Profile.
 */

import { api } from "../api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "HIRING_MANAGER" | "COLLEGE" | "CANDIDATE";
  organizationId: string | null;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
  organization?: { id: string; name: string; type: string } | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  role?: "CANDIDATE" | "HIRING_MANAGER" | "COLLEGE";
  organizationName?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    signup: builder.mutation<AuthResult, SignupPayload>({
      query: (body) => ({ url: "/auth/signup", method: "POST", body }),
      invalidatesTags: ["User"],
    }),
    login: builder.mutation<AuthResult, LoginPayload>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      invalidatesTags: ["User"],
    }),
    refreshToken: builder.mutation<AuthTokens, { refreshToken: string }>({
      query: (body) => ({ url: "/auth/refresh", method: "POST", body }),
    }),
    logout: builder.mutation<{ message: string }, { refreshToken: string }>({
      query: (body) => ({ url: "/auth/logout", method: "POST", body }),
    }),
    getMe: builder.query<User, void>({
      query: () => "/auth/me",
      providesTags: ["User"],
    }),
  }),
});

export const {
  useSignupMutation,
  useLoginMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetMeQuery,
} = authApi;
