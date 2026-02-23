/**
 * Transcript backup to localStorage for recovery when report generation fails
 * (e.g. long interviews >9 mins) or when Redux state is lost (refresh).
 * Cleared before starting a new interview and after report is generated successfully.
 */

import type { ConversationTemplate, TranscriptEntry } from "../types/gemini";

const STORAGE_KEY = "vocalhireai_interview_transcript_backup";

export interface TranscriptBackup {
  transcript: TranscriptEntry[];
  pendingUserText: string;
  pendingAssistantText: string;
  template: ConversationTemplate;
  savedAt: number;
}

export function saveTranscriptBackup(payload: {
  transcript: TranscriptEntry[];
  pendingUserText: string;
  pendingAssistantText: string;
  template: ConversationTemplate;
}): void {
  try {
    const data: TranscriptBackup = {
      ...payload,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // quota or disabled localStorage
  }
}

export function getTranscriptBackup(): TranscriptBackup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as TranscriptBackup;
    if (!Array.isArray(data.transcript) || !data.template) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearTranscriptBackup(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
