/**
 * Proctoring — Default thresholds & configuration.
 *
 * Override any of these via the `thresholds` param of useProctoring().
 */

import type { ProctoringThresholds, ProctoringConfig } from "./types";

/** Minimum width or height to consider camera "ok" (below = low_res) */
export const MIN_CAMERA_RESOLUTION = 320;

/** FPS below this for lowFpsMs triggers LOW_FPS flag */
export const LOW_FPS_THRESHOLD = 1;
/** Duration (ms) of low FPS before flagging CPU throttling */
export const LOW_FPS_DURATION_MS = 5_000;
/** Gaze delta (degrees) in one frame to flag suspicious shift */
export const GAZE_SHIFT_DEGREES = 25;
/** Keydowns in this window (ms) without input focus to flag keyboard suspicion */
export const KEYBOARD_SUSPICION_WINDOW_MS = 2_000;
/** Min keydown count in window to flag */
export const KEYBOARD_SUSPICION_MIN_KEYS = 15;

export const DEFAULT_THRESHOLDS: ProctoringThresholds = {
  faceMissingMs: 3_000,
  lookingAwayMs: 5_000,
  yawThreshold: 30,
  pitchThreshold: 25,
  darkBrightnessThreshold: 30,
  riskDecayPerSec: 2,
  flagCooldownMs: 10_000,
};

/**
 * CDN paths for MediaPipe wasm runtime + model.
 * For production, copy these to /public and use local paths.
 */
const MEDIAPIPE_CDN_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";

const FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export const DEFAULT_CONFIG: ProctoringConfig = {
  enabled: true,
  fps: 3,
  numFaces: 2,
  enableHand: false,
  thresholds: DEFAULT_THRESHOLDS,
  wasmPath: MEDIAPIPE_CDN_WASM,
  modelAssetPath: FACE_LANDMARKER_MODEL,
};

/**
 * Detect low-end devices where proctoring may degrade UX.
 * Returns true if device has ≤2 CPU cores or ≤2 GB memory.
 */
export function isLowEndDevice(): boolean {
  const nav = navigator as unknown as Record<string, unknown>;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency <= 2) return true;
  if (typeof nav.deviceMemory === "number" && (nav.deviceMemory as number) <= 2) return true;
  return false;
}
