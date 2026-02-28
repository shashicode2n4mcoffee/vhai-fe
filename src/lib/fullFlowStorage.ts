/**
 * Full Interview Flow — persist each stage result in localStorage so we can
 * show a combined final report after the coding round.
 */

import type { TranscriptEntry } from "../types/gemini";

const STORAGE_KEY = "vocalhireai_full_flow_report";

export interface FullFlowAptitudeResult {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  topic: string;
  timeSpentSec?: number;
  aptitudeId?: string;
  savedAt: number;
}

export interface FullFlowInterviewResult {
  transcript: TranscriptEntry[];
  /** Full evaluation report from ConversationReport (if generated) */
  report: unknown;
  interviewId: string | null;
  savedAt: number;
}

export interface FullFlowCodingResult {
  score: number;
  verdict: string;
  problemTitle: string;
  language: string;
  difficulty: string;
  timeSpentSec: number;
  codingId?: string;
  evaluation: unknown;
  savedAt: number;
}

export interface FullFlowReportSession {
  templateName: string;
  startedAt: number;
  aptitude: FullFlowAptitudeResult | null;
  interview: FullFlowInterviewResult | null;
  coding: FullFlowCodingResult | null;
}

export function getFullFlowReport(): FullFlowReportSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as FullFlowReportSession;
    if (!data || typeof data.startedAt !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

export function initFullFlowReport(templateName: string): void {
  try {
    const session: FullFlowReportSession = {
      templateName,
      startedAt: Date.now(),
      aptitude: null,
      interview: null,
      coding: null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // quota or disabled
  }
}

export function saveFullFlowAptitude(result: Omit<FullFlowAptitudeResult, "savedAt">): void {
  try {
    const session = getFullFlowReport();
    if (!session) return;
    session.aptitude = { ...result, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    //
  }
}

export function saveFullFlowInterview(result: Omit<FullFlowInterviewResult, "savedAt">): void {
  try {
    const session = getFullFlowReport();
    if (!session) return;
    session.interview = { ...result, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    //
  }
}

export function saveFullFlowCoding(result: Omit<FullFlowCodingResult, "savedAt">): void {
  try {
    const session = getFullFlowReport();
    if (!session) return;
    session.coding = { ...result, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    //
  }
}

export function clearFullFlowReport(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    //
  }
}
