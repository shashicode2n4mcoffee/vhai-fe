/**
 * Settings API Endpoints.
 */

import { api } from "../api";

export interface UserSettings {
  id: string;
  userId: string;
  defaultQuestionCount: number;
  defaultDifficulty: string;
  theme: string;
  notifications: boolean;
  /** Business plan only: store interview recording in cloud (LiveKit Egress) */
  cloudRecordingEnabled?: boolean;
}

const settingsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<UserSettings, void>({
      query: () => "/settings",
      providesTags: ["Settings"],
    }),
    updateSettings: builder.mutation<UserSettings, Partial<UserSettings>>({
      query: (body) => ({ url: "/settings", method: "PUT", body }),
      invalidatesTags: ["Settings"],
    }),
  }),
});

export const { useGetSettingsQuery, useUpdateSettingsMutation } = settingsApi;
