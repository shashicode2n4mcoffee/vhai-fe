/**
 * Interview Slice — Stores data flowing through the interview pipeline:
 *   TemplateForm → VoiceChat → ConversationReport
 *
 * Fields:
 *   template   – set by TemplateForm, read by VoiceChat + Report
 *   transcript – set by VoiceChat on end, read by Report
 *   videoUrl   – objectURL created from the recorded Blob, read by Report
 *   guardrails – EEO/do-not-ask from org, used to build AI system instruction
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConversationTemplate, TranscriptEntry } from "../types/gemini";
import type { RootState } from "./store";

export interface OrgGuardrails {
  eeoSafeMode: boolean;
  doNotAskTopics: string[];
  toxicityTerminateOnHigh: boolean;
}

/** LiveKit connection quality for Professional interview report */
export type NetworkQuality = "stable" | "moderate" | "poor";

interface InterviewState {
  template: ConversationTemplate | null;
  transcript: TranscriptEntry[];
  videoUrl: string | null;
  interviewId: string | null;
  guardrails: OrgGuardrails | null;
  /** Set by Professional session; shown on report as "Network: Stable/Moderate/Poor" */
  networkQuality: NetworkQuality | null;
  /** Full flow: selected template id (use existing template for video interview) */
  selectedTemplateIdForFullFlow: string | null;
  /** Full flow: selected template name (for display in coding step) */
  selectedTemplateNameForFullFlow: string | null;
}

const initialState: InterviewState = {
  template: null,
  transcript: [],
  videoUrl: null,
  interviewId: null,
  guardrails: null,
  networkQuality: null,
  selectedTemplateIdForFullFlow: null,
  selectedTemplateNameForFullFlow: null,
};

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setTemplate(state, action: PayloadAction<ConversationTemplate>) {
      state.template = action.payload;
    },
    /** Full flow: store selected template and use for video + coding context */
    setTemplateForFullFlow(
      state,
      action: PayloadAction<{ template: ConversationTemplate; templateId: string; templateName: string }>,
    ) {
      state.template = action.payload.template;
      state.selectedTemplateIdForFullFlow = action.payload.templateId;
      state.selectedTemplateNameForFullFlow = action.payload.templateName;
    },
    setInterviewResult(
      state,
      action: PayloadAction<{
        transcript: TranscriptEntry[];
        videoUrl: string | null;
        networkQuality?: NetworkQuality | null;
      }>,
    ) {
      state.transcript = action.payload.transcript;
      state.videoUrl = action.payload.videoUrl;
      if (action.payload.networkQuality !== undefined) {
        state.networkQuality = action.payload.networkQuality;
      }
    },
    setInterviewId(state, action: PayloadAction<string>) {
      state.interviewId = action.payload;
    },
    setGuardrails(state, action: PayloadAction<OrgGuardrails | null>) {
      state.guardrails = action.payload;
    },
    /**
     * Reset the interview pipeline.
     * IMPORTANT: Call URL.revokeObjectURL(videoUrl) in the component
     * BEFORE dispatching this action to prevent memory leaks.
     */
    resetInterview(state) {
      state.template = null;
      state.transcript = [];
      state.videoUrl = null;
      state.interviewId = null;
      state.guardrails = null;
      state.networkQuality = null;
      state.selectedTemplateIdForFullFlow = null;
      state.selectedTemplateNameForFullFlow = null;
    },
  },
});

export const { setTemplate, setTemplateForFullFlow, setInterviewResult, setInterviewId, setGuardrails, resetInterview } =
  interviewSlice.actions;

// Selectors
export const selectTemplate = (state: RootState) => state.interview.template;
export const selectSelectedTemplateIdForFullFlow = (state: RootState) => state.interview.selectedTemplateIdForFullFlow;
export const selectSelectedTemplateNameForFullFlow = (state: RootState) => state.interview.selectedTemplateNameForFullFlow;
export const selectTranscript = (state: RootState) => state.interview.transcript;
export const selectVideoUrl = (state: RootState) => state.interview.videoUrl;
export const selectInterviewId = (state: RootState) => state.interview.interviewId;
export const selectGuardrails = (state: RootState) => state.interview.guardrails;
export const selectNetworkQuality = (state: RootState) => state.interview.networkQuality;

export default interviewSlice.reducer;
