/**
 * Proctoring Module — Shared Types
 *
 * All types used across the proctoring pipeline:
 *   Main thread (hook / scorer) ↔ Worker (MediaPipe inference)
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ProctoringThresholds {
  /** Milliseconds with no face before flagging (default 3000) */
  faceMissingMs: number;
  /** Milliseconds looking away before flagging (default 5000) */
  lookingAwayMs: number;
  /** Absolute yaw degrees to consider "looking away" (default 30) */
  yawThreshold: number;
  /** Absolute pitch degrees to consider "looking away" (default 25) */
  pitchThreshold: number;
  /** Average brightness 0-255 below which frame is "dark/covered" (default 30) */
  darkBrightnessThreshold: number;
  /** Risk score decay rate: points lost per second when behavior is normal (default 2) */
  riskDecayPerSec: number;
  /** Minimum milliseconds between same-type flags to prevent spam (default 10000) */
  flagCooldownMs: number;
}

export interface ProctoringConfig {
  enabled: boolean;
  fps: number;
  numFaces: number;
  enableHand: boolean;
  thresholds: ProctoringThresholds;
  /** URL for WASM runtime files */
  wasmPath: string;
  /** URL or path for the face_landmarker .task model */
  modelAssetPath: string;
}

// ---------------------------------------------------------------------------
// Flag / Event types
// ---------------------------------------------------------------------------

export type FlagType =
  | "TAB_HIDDEN"
  | "WINDOW_BLUR"
  | "FULLSCREEN_EXIT"
  | "MULTI_FACE"
  | "NO_FACE"
  | "LOOKING_AWAY"
  | "DARK_FRAME"
  | "HAND_NEAR_FACE"
  | "LOW_FPS"
  | "SUSPICIOUS_GAZE_SHIFT"
  | "KEYBOARD_ACTIVITY_SUSPICIOUS";

export interface ProctoringFlag {
  id: string;
  type: FlagType;
  /** Milliseconds since interview start */
  timestamp: number;
  message: string;
  pointsAdded: number;
}

/** Points added per flag type */
export const FLAG_POINTS: Record<FlagType, number> = {
  TAB_HIDDEN: 10,
  WINDOW_BLUR: 5,
  FULLSCREEN_EXIT: 10,
  MULTI_FACE: 25,
  NO_FACE: 15,
  LOOKING_AWAY: 10,
  DARK_FRAME: 10,
  HAND_NEAR_FACE: 5,
  LOW_FPS: 8,
  SUSPICIOUS_GAZE_SHIFT: 6,
  KEYBOARD_ACTIVITY_SUSPICIOUS: 5,
};

export const FLAG_MESSAGES: Record<FlagType, string> = {
  TAB_HIDDEN: "Browser tab was hidden (tab switch)",
  WINDOW_BLUR: "Window lost focus (switched to another app)",
  FULLSCREEN_EXIT: "Exited fullscreen mode",
  MULTI_FACE: "Multiple faces detected",
  NO_FACE: "No face detected for extended period",
  LOOKING_AWAY: "Looking away from screen for extended period",
  DARK_FRAME: "Camera appears covered or dark",
  HAND_NEAR_FACE: "Hand detected near face",
  LOW_FPS: "Low frame rate (possible CPU throttling)",
  SUSPICIOUS_GAZE_SHIFT: "Sudden gaze shift (possible second screen)",
  KEYBOARD_ACTIVITY_SUSPICIOUS: "Unusual keyboard activity (possible second device)",
};

/** Violations that are considered malpractice (tab/window/fullscreen) — may lead to dismissal. */
export const MALPRACTICE_FLAG_TYPES: readonly FlagType[] = [
  "TAB_HIDDEN",
  "WINDOW_BLUR",
  "FULLSCREEN_EXIT",
] as const;

export const DISMISSAL_WARNING =
  "This has been recorded. Repeated violations may result in dismissal of your interview.";

// ---------------------------------------------------------------------------
// Risk level
// ---------------------------------------------------------------------------

export type RiskLevel = "OK" | "Warning" | "High Risk";

export function getRiskLevel(score: number): RiskLevel {
  if (score >= 60) return "High Risk";
  if (score >= 30) return "Warning";
  return "OK";
}

// ---------------------------------------------------------------------------
// Metrics (live state, updated every inference tick)
// ---------------------------------------------------------------------------

export interface ProctoringMetrics {
  faceCount: number;
  faceMissingDuration: number;
  lookingAwayDuration: number;
  yaw: number;
  pitch: number;
  brightness: number;
  tabHidden: boolean;
  inferredFps: number;
  /** Cumulative ms the tab was hidden (for focus loss heuristic) */
  tabHiddenDuration: number;
  /** Focus loss heuristic score 0–100 (tab/window/fullscreen events) */
  focusLossScore: number;
  /** Video resolution width (0 if not available) */
  videoWidth: number;
  /** Video resolution height (0 if not available) */
  videoHeight: number;
  /** Camera quality: ok, low_res, or dark */
  cameraQuality: "ok" | "low_res" | "dark";
}

// ---------------------------------------------------------------------------
// Detection result (returned by Worker per frame)
// ---------------------------------------------------------------------------

export interface DetectionResult {
  faceCount: number;
  /** Estimated yaw in degrees; 0 = straight, negative = left, positive = right */
  yaw: number;
  /** Estimated pitch in degrees; 0 = straight, negative = up, positive = down */
  pitch: number;
  /** Average frame brightness 0–255 */
  brightness: number;
  /** Whether a hand was detected near the face (only when enableHand=true) */
  handNearFace: boolean;
  /** performance.now() timestamp when inference started */
  timestamp: number;
  /** Optional: video width for camera quality (set by hook) */
  videoWidth?: number;
  /** Optional: video height for camera quality (set by hook) */
  videoHeight?: number;
}

// ---------------------------------------------------------------------------
// Worker messages
// ---------------------------------------------------------------------------

/** Main thread → Worker */
export type WorkerInMessage =
  | {
      type: "init";
      wasmPath: string;
      modelAssetPath: string;
      numFaces: number;
      enableHand: boolean;
    }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number }
  | { type: "stop" };

/** Worker → Main thread */
export type WorkerOutMessage =
  | { type: "ready" }
  | { type: "result"; data: DetectionResult }
  | { type: "error"; message: string };
