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
  interviewId?: string;
  /** True when backend dispatched a LiveKit agent to the room; frontend must not start Gemini. */
  agentDispatched?: boolean;
}

const livekitApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getLiveKitConfig: builder.query<LiveKitConfigResponse, void>({
      query: () => "/livekit/config",
    }),
    getLiveKitToken: builder.mutation<
      LiveKitTokenResponse,
      { roomName?: string; participantName?: string; interviewId?: string; templateId?: string; role?: string }
    >({
      query: (body) => ({ url: "/livekit/token", method: "POST", body: body || {} }),
    }),
    reportLiveKitQuality: builder.mutation<
      { ok: boolean },
      { quality: string; roomName?: string }
    >({
      query: (body) => ({ url: "/livekit/quality", method: "POST", body }),
    }),
  }),
});

export const {
  useGetLiveKitConfigQuery,
  useGetLiveKitTokenMutation,
  useReportLiveKitQualityMutation,
} = livekitApi;
