/**
 * Risk Scorer — Lightweight, main-thread scoring engine.
 *
 * Processes DetectionResults from the worker + browser events and produces
 * a riskScore (0–100) with decay, plus a timeline of ProctoringFlags.
 *
 * Design:
 *   - Score INCREASES when violations occur.
 *   - Score DECAYS slowly (configurable) when behaviour is normal.
 *   - Each flag type has a cooldown to prevent score explosion.
 *   - All computation is trivial (no ML, no allocations in hot path).
 */

import type {
  DetectionResult,
  FlagType,
  ProctoringFlag,
  ProctoringMetrics,
  ProctoringThresholds,
  RiskLevel,
} from "./types";
import { FLAG_MESSAGES, FLAG_POINTS, getRiskLevel } from "./types";
import { DEFAULT_THRESHOLDS } from "./thresholds";
import {
  LOW_FPS_THRESHOLD,
  LOW_FPS_DURATION_MS,
  GAZE_SHIFT_DEGREES,
  KEYBOARD_SUSPICION_WINDOW_MS,
  KEYBOARD_SUSPICION_MIN_KEYS,
  MIN_CAMERA_RESOLUTION,
} from "./thresholds";

export class RiskScorer {
  private score = 0;
  private flags: ProctoringFlag[] = [];
  private thresholds: ProctoringThresholds;
  private interviewStartTs: number;

  // Duration accumulators
  private faceMissingSince = 0;
  private lookingAwaySince = 0;
  private faceMissingFlagged = false;
  private lookingAwayFlagged = false;
  private lowFpsSince = 0; // 0 = FPS ok
  private lowFpsFlagged = false;

  // Focus loss heuristic
  private tabHiddenSince = 0; // 0 = visible
  private totalTabHiddenMs = 0;
  private focusLossScore = 0; // 0–100, decay over time
  private lastFocusLossTs = 0;

  // Gaze: previous frame for sudden shift
  private lastYaw = 0;
  private lastPitch = 0;

  // Keyboard: timestamps when keydown and focus not on input
  private keydownTimestamps: number[] = [];

  // Cooldown map: flagType → last timestamp
  private lastFlagTs: Partial<Record<FlagType, number>> = {};
  private lastUpdateTs = 0;

  // Metrics snapshot (reused object to avoid GC pressure)
  private metrics: ProctoringMetrics = {
    faceCount: 1,
    faceMissingDuration: 0,
    lookingAwayDuration: 0,
    yaw: 0,
    pitch: 0,
    brightness: 128,
    tabHidden: false,
    inferredFps: 0,
    tabHiddenDuration: 0,
    focusLossScore: 0,
    videoWidth: 0,
    videoHeight: 0,
    cameraQuality: "ok",
  };

  // FPS tracking
  private frameTimestamps: number[] = [];

  constructor(interviewStartTs: number, thresholds?: Partial<ProctoringThresholds>) {
    this.interviewStartTs = interviewStartTs;
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
    this.lastUpdateTs = performance.now();
  }

  // ---------------------------------------------------------------------------
  // Public getters
  // ---------------------------------------------------------------------------

  getScore(): number {
    return Math.round(this.score);
  }

  getLevel(): RiskLevel {
    return getRiskLevel(this.score);
  }

  getFlags(): ProctoringFlag[] {
    return this.flags;
  }

  getMetrics(): ProctoringMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    this.score = 0;
    this.flags = [];
    this.faceMissingSince = 0;
    this.lookingAwaySince = 0;
    this.faceMissingFlagged = false;
    this.lookingAwayFlagged = false;
    this.lowFpsSince = 0;
    this.lowFpsFlagged = false;
    this.tabHiddenSince = 0;
    this.totalTabHiddenMs = 0;
    this.focusLossScore = 0;
    this.lastFocusLossTs = 0;
    this.lastYaw = 0;
    this.lastPitch = 0;
    this.keydownTimestamps = [];
    this.lastFlagTs = {};
    this.lastUpdateTs = performance.now();
    this.frameTimestamps = [];
  }

  // ---------------------------------------------------------------------------
  // Process a detection result from the worker
  // ---------------------------------------------------------------------------

  processDetection(result: DetectionResult): void {
    const now = performance.now();

    // ---- Decay ----
    const elapsed = (now - this.lastUpdateTs) / 1000;
    this.score = Math.max(0, this.score - elapsed * this.thresholds.riskDecayPerSec);
    this.lastUpdateTs = now;

    // ---- FPS tracking ----
    this.frameTimestamps.push(now);
    const oneSecAgo = now - 1000;
    this.frameTimestamps = this.frameTimestamps.filter((t) => t > oneSecAgo);
    this.metrics.inferredFps = this.frameTimestamps.length;

    // ---- Low FPS / CPU throttling ----
    if (this.metrics.inferredFps < LOW_FPS_THRESHOLD) {
      if (this.lowFpsSince === 0) this.lowFpsSince = now;
      const duration = now - this.lowFpsSince;
      if (duration >= LOW_FPS_DURATION_MS && !this.lowFpsFlagged) {
        this.addFlag("LOW_FPS", now);
        this.lowFpsFlagged = true;
      }
    } else {
      this.lowFpsSince = 0;
      this.lowFpsFlagged = false;
    }

    // ---- Camera quality (resolution + brightness) ----
    const w = result.videoWidth ?? 0;
    const h = result.videoHeight ?? 0;
    this.metrics.videoWidth = w;
    this.metrics.videoHeight = h;
    if (result.brightness < this.thresholds.darkBrightnessThreshold) {
      this.metrics.cameraQuality = "dark";
    } else if (w > 0 && h > 0 && (w < MIN_CAMERA_RESOLUTION || h < MIN_CAMERA_RESOLUTION)) {
      this.metrics.cameraQuality = "low_res";
    } else {
      this.metrics.cameraQuality = "ok";
    }

    // ---- Update metrics ----
    this.metrics.faceCount = result.faceCount;
    this.metrics.yaw = result.yaw;
    this.metrics.pitch = result.pitch;
    this.metrics.brightness = result.brightness;

    // ---- Sudden gaze shift (second-screen suspicion) ----
    if (result.faceCount === 1) {
      const deltaYaw = Math.abs(result.yaw - this.lastYaw);
      const deltaPitch = Math.abs(result.pitch - this.lastPitch);
      if (deltaYaw >= GAZE_SHIFT_DEGREES || deltaPitch >= GAZE_SHIFT_DEGREES) {
        this.addFlag("SUSPICIOUS_GAZE_SHIFT", now);
      }
    }
    this.lastYaw = result.yaw;
    this.lastPitch = result.pitch;

    // ---- Multi-face ----
    if (result.faceCount > 1) {
      this.addFlag("MULTI_FACE", now);
    }

    // ---- No face ----
    if (result.faceCount === 0) {
      if (this.faceMissingSince === 0) this.faceMissingSince = now;
      const duration = now - this.faceMissingSince;
      this.metrics.faceMissingDuration = duration;
      if (duration >= this.thresholds.faceMissingMs && !this.faceMissingFlagged) {
        this.addFlag("NO_FACE", now);
        this.faceMissingFlagged = true;
      }
    } else {
      this.faceMissingSince = 0;
      this.faceMissingFlagged = false;
      this.metrics.faceMissingDuration = 0;
    }

    // ---- Looking away ----
    const isLookingAway =
      result.faceCount === 1 &&
      (Math.abs(result.yaw) > this.thresholds.yawThreshold ||
        Math.abs(result.pitch) > this.thresholds.pitchThreshold);

    if (isLookingAway) {
      if (this.lookingAwaySince === 0) this.lookingAwaySince = now;
      const duration = now - this.lookingAwaySince;
      this.metrics.lookingAwayDuration = duration;
      if (duration >= this.thresholds.lookingAwayMs && !this.lookingAwayFlagged) {
        this.addFlag("LOOKING_AWAY", now);
        this.lookingAwayFlagged = true;
      }
    } else {
      this.lookingAwaySince = 0;
      this.lookingAwayFlagged = false;
      this.metrics.lookingAwayDuration = 0;
    }

    // ---- Dark / covered camera ----
    if (result.brightness < this.thresholds.darkBrightnessThreshold) {
      this.addFlag("DARK_FRAME", now);
    }

    // ---- Hand near face (optional) ----
    if (result.handNearFace) {
      this.addFlag("HAND_NEAR_FACE", now);
    }
  }

  // ---------------------------------------------------------------------------
  // Process browser events (called from main thread listeners)
  // ---------------------------------------------------------------------------

  processTabHidden(): void {
    this.metrics.tabHidden = true;
    if (this.tabHiddenSince === 0) this.tabHiddenSince = performance.now();
    this.addFlag("TAB_HIDDEN", performance.now());
  }

  processTabVisible(): void {
    const now = performance.now();
    if (this.tabHiddenSince > 0) {
      this.totalTabHiddenMs += now - this.tabHiddenSince;
      this.tabHiddenSince = 0;
    }
    this.metrics.tabHidden = false;
    this.metrics.tabHiddenDuration = this.totalTabHiddenMs;
    this.focusLossScore = Math.min(100, this.focusLossScore + 10);
    this.lastFocusLossTs = now;
  }

  processWindowBlur(): void {
    this.focusLossScore = Math.min(100, this.focusLossScore + 5);
    this.lastFocusLossTs = performance.now();
    this.addFlag("WINDOW_BLUR", performance.now());
  }

  processFullscreenExit(): void {
    this.addFlag("FULLSCREEN_EXIT", performance.now());
  }

  /** Call when keydown and focus is not on an input (suspicious keyboard activity) */
  processKeydownNoInputFocus(): void {
    const now = performance.now();
    this.keydownTimestamps.push(now);
    const cutoff = now - KEYBOARD_SUSPICION_WINDOW_MS;
    this.keydownTimestamps = this.keydownTimestamps.filter((t) => t > cutoff);
    if (this.keydownTimestamps.length >= KEYBOARD_SUSPICION_MIN_KEYS) {
      this.addFlag("KEYBOARD_ACTIVITY_SUSPICIOUS", now);
      this.keydownTimestamps = [];
    }
  }

  /** Apply time-based decay without a detection (call from tick if worker is slow) */
  tick(): void {
    const now = performance.now();
    const elapsed = (now - this.lastUpdateTs) / 1000;
    this.score = Math.max(0, this.score - elapsed * this.thresholds.riskDecayPerSec);
    this.lastUpdateTs = now;
    this.metrics.tabHiddenDuration = this.totalTabHiddenMs + (this.tabHiddenSince > 0 ? now - this.tabHiddenSince : 0);
    this.metrics.focusLossScore = Math.round(this.focusLossScore);
    if (this.focusLossScore > 0) {
      this.focusLossScore = Math.max(0, this.focusLossScore - elapsed * 5);
    }
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private addFlag(type: FlagType, now: number): void {
    // Cooldown check
    const lastTs = this.lastFlagTs[type];
    if (lastTs && now - lastTs < this.thresholds.flagCooldownMs) return;

    const points = FLAG_POINTS[type];
    this.score = Math.min(100, this.score + points);
    this.lastFlagTs[type] = now;

    this.flags.push({
      id: `${type}_${Date.now().toString(36)}_${(Math.random() * 1000) | 0}`,
      type,
      timestamp: now - this.interviewStartTs,
      message: FLAG_MESSAGES[type],
      pointsAdded: points,
    });
  }
}
