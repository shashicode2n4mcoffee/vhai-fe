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

interface InterviewState {
  template: ConversationTemplate | null;
  transcript: TranscriptEntry[];
  videoUrl: string | null;
  interviewId: string | null;
  guardrails: OrgGuardrails | null;
}

const initialState: InterviewState = {
  template: null,
  transcript: [],
  videoUrl: null,
  interviewId: null,
  guardrails: null,
};

const interviewSlice = createSlice({
  name: "interview",
  initialState,
  reducers: {
    setTemplate(state, action: PayloadAction<ConversationTemplate>) {
      state.template = action.payload;
    },
    setInterviewResult(
      state,
      action: PayloadAction<{
        transcript: TranscriptEntry[];
        videoUrl: string | null;
      }>,
    ) {
      state.transcript = action.payload.transcript;
      state.videoUrl = action.payload.videoUrl;
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
    },
  },
});

export const { setTemplate, setInterviewResult, setInterviewId, setGuardrails, resetInterview } =
  interviewSlice.actions;

// Selectors
export const selectTemplate = (state: RootState) => state.interview.template;
export const selectTranscript = (state: RootState) => state.interview.transcript;
export const selectVideoUrl = (state: RootState) => state.interview.videoUrl;
export const selectInterviewId = (state: RootState) => state.interview.interviewId;
export const selectGuardrails = (state: RootState) => state.interview.guardrails;

export default interviewSlice.reducer;
