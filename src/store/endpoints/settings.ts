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
  /** P1: set room metadata when creating LiveKit room */
  livekitRoomMetadataEnabled?: boolean;
  /** P2: send transcript/signals over data channel */
  livekitDataChannelEnabled?: boolean;
  /** P2: send connection quality to backend */
  livekitAnalyticsEnabled?: boolean;
  /** P3: adaptive video (simulcast) */
  livekitSimulcastEnabled?: boolean;
  /** P3: end-to-end encryption for room */
  livekitE2EEEnabled?: boolean;
  /** Allow HR to get observer (view-only) token for rooms */
  livekitObserverTokenAllowed?: boolean;
  /** Allow screen share in Professional interview */
  livekitScreenShareEnabled?: boolean;
  /** Dispatch LiveKit Agent to room */
  livekitAgentEnabled?: boolean;
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
