/**
 * Users API Endpoints.
 */

import { api } from "../api";
import type { PaginatedResponse } from "./interviews";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string | null;
  isActive: boolean;
  avatarUrl: string | null;
  collegeRollNumber: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  organization: { id: string; name: string; type: string } | null;
}

const usersApi = api.injectEndpoints({
  endpoints: (builder) => ({
    listUsers: builder.query<PaginatedResponse<UserProfile>, { page?: number; limit?: number; role?: string; search?: string } | void>({
      query: (params) => ({
        url: "/users",
        params: params || {},
      }),
      providesTags: ["User"],
    }),
    getUserById: builder.query<UserProfile & { _count: Record<string, number> }, string>({
      query: (id) => `/users/${id}`,
      providesTags: ["User"],
    }),
    updateProfile: builder.mutation<UserProfile, { name?: string; avatarUrl?: string | null; collegeRollNumber?: string | null }>({
      query: (body) => ({ url: "/users/profile", method: "PUT", body }),
      invalidatesTags: ["User"],
    }),
    changePassword: builder.mutation<{ message: string }, { currentPassword: string; newPassword: string }>({
      query: (body) => ({ url: "/users/password", method: "PUT", body }),
    }),
    changeUserRole: builder.mutation<{ id: string; role: string }, { id: string; role: string }>({
      query: ({ id, role }) => ({ url: `/users/${id}/role`, method: "PATCH", body: { role } }),
      invalidatesTags: ["User"],
    }),
    deleteUser: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/users/${id}`, method: "DELETE" }),
      invalidatesTags: ["User"],
    }),
    deleteOwnAccount: builder.mutation<{ message: string }, { password: string }>({
      query: (body) => ({ url: "/users/account", method: "DELETE", body }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  useListUsersQuery,
  useGetUserByIdQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useChangeUserRoleMutation,
  useDeleteUserMutation,
  useDeleteOwnAccountMutation,
} = usersApi;
