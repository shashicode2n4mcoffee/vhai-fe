/**
 * Full Interview Flow — persist each stage result in localStorage so we can
 * show a combined final report after the coding round.
 */

import type { TranscriptEntry } from "../types/gemini";
import type { AptitudeQuiz } from "./aptitude";

const STORAGE_KEY = "vocalhireai_full_flow_report";

/** Stored proctoring flag (serializable) */
export interface StoredProctoringFlag {
  id: string;
  type: string;
  timestamp: number;
  message: string;
  pointsAdded: number;
}

export interface FullFlowAptitudeResult {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  topic: string;
  timeSpentSec?: number;
  aptitudeId?: string;
  /** Proctoring flags recorded during aptitude test */
  proctoringFlags?: StoredProctoringFlag[];
  /** Proctoring risk score 0–100 (higher = more concerns) */
  riskScore?: number;
  /** Full quiz + answers for full report (question breakdown with explanations) */
  quiz?: AptitudeQuiz;
  answers?: Record<number, number>;
  /** Object URL of proctoring webcam recording (blob URL; valid for session) */
  videoUrl?: string;
  savedAt: number;
}

export interface FullFlowInterviewResult {
  transcript: TranscriptEntry[];
  /** Full evaluation report from ConversationReport (if generated) */
  report: unknown;
  interviewId: string | null;
  /** Object URL of interview recording (blob URL; valid for session) */
  videoUrl?: string;
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
  /** Proctoring flags recorded during coding round */
  proctoringFlags?: StoredProctoringFlag[];
  /** Proctoring risk score 0–100 (higher = more concerns) */
  riskScore?: number;
  /** Object URL of proctoring webcam recording (blob URL; valid for session) */
  videoUrl?: string;
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
