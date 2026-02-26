/**
 * LiveKit API Endpoints — Token and config for Professional video interview.
 */

import { api } from "../api";

export interface LiveKitConfigResponse {
  enabled: boolean;
}

export interface LiveKitTokenResponse {
  token: string;
  url: string;
  roomName: string;
}

const livekitApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLiveKitConfig: builder.query<LiveKitConfigResponse, void>({
      query: () => "/livekit/config",
    }),
    getLiveKitToken: builder.mutation<
      LiveKitTokenResponse,
      { roomName?: string; participantName?: string }
    >({
      query: (body) => ({ url: "/livekit/token", method: "POST", body: body || {} }),
    }),
  }),
});

export const {
  useGetLiveKitConfigQuery,
  useGetLiveKitTokenMutation,
} = livekitApi;
