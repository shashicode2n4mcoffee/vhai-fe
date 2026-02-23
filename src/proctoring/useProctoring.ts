/**
 * useProctoring — React hook that runs MediaPipe FaceLandmarker on the main
 * thread with careful throttling.
 *
 * Why main thread instead of Worker?
 *   MediaPipe's WASM/ESM bundle uses `self.import()` internally, which breaks
 *   in module workers due to Vite transforms and browser limitations.
 *   Main-thread execution is safe for the AI voice interview because:
 *     - Audio capture/playback runs in AudioWorklet (separate thread)
 *     - WebSocket I/O is async and non-blocking
 *     - Inference at 3 FPS ≈ 20ms every 333ms = ~6% CPU — no audio glitches
 *
 * Performance safeguards:
 *   - Throttled to configurable FPS (default 3)
 *   - requestVideoFrameCallback preferred (fires only on new frames)
 *   - React state updates capped at 3×/sec via separate interval
 *   - Brightness computed on tiny 16×12 canvas (reused, no alloc)
 *   - ImageBitmap.close() called immediately after use
 *   - Feature flag for low-end device detection
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  FaceLandmarker,
} from "@mediapipe/tasks-vision";
import type {
  ProctoringThresholds,
  ProctoringFlag,
  ProctoringMetrics,
  RiskLevel,
  DetectionResult,
} from "./types";
import { getRiskLevel } from "./types";
import { DEFAULT_CONFIG, isLowEndDevice } from "./thresholds";
import { logErrorToServer } from "../lib/logError";
import { RiskScorer } from "./riskScorer";

// Extend HTMLVideoElement for requestVideoFrameCallback
declare global {
  interface HTMLVideoElement {
    requestVideoFrameCallback(
      callback: (now: DOMHighResTimeStamp, metadata: Record<string, unknown>) => void,
    ): number;
    cancelVideoFrameCallback(handle: number): void;
  }
}

// ---------------------------------------------------------------------------
// Hook params & return
// ---------------------------------------------------------------------------

export interface UseProctoringParams {
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  interviewStartTs: number;
  fps?: number;
  numFaces?: number;
  enableHand?: boolean;
  thresholds?: Partial<ProctoringThresholds>;
  wasmPath?: string;
  modelAssetPath?: string;
}

export interface UseProctoringReturn {
  riskScore: number;
  riskLevel: RiskLevel;
  flags: ProctoringFlag[];
  metrics: ProctoringMetrics;
  isRunning: boolean;
  isReady: boolean;
  isLowEnd: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

const EMPTY_METRICS: ProctoringMetrics = {
  faceCount: 0,
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

// ---------------------------------------------------------------------------
// Brightness helper (reusable tiny canvas)
// ---------------------------------------------------------------------------

let _brightnessCanvas: HTMLCanvasElement | null = null;
let _brightnessCtx: CanvasRenderingContext2D | null = null;

function computeBrightness(source: HTMLVideoElement): number {
  if (!_brightnessCanvas) {
    _brightnessCanvas = document.createElement("canvas");
    _brightnessCanvas.width = 16;
    _brightnessCanvas.height = 12;
    _brightnessCtx = _brightnessCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!_brightnessCtx) return 128;
  _brightnessCtx.drawImage(source, 0, 0, 16, 12);
  const data = _brightnessCtx.getImageData(0, 0, 16, 12).data;
  let sum = 0;
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
  }
  return Math.round(sum / px);
}

// ---------------------------------------------------------------------------
// Head-pose estimation from face landmarks
// ---------------------------------------------------------------------------

function estimateHeadPose(
  landmarks: { x: number; y: number; z: number }[],
): { yaw: number; pitch: number } {
  const nose = landmarks[1]!;
  const leftEye = landmarks[33]!;
  const rightEye = landmarks[263]!;
  const chin = landmarks[152]!;

  const leftDist = Math.abs(nose.x - leftEye.x);
  const rightDist = Math.abs(nose.x - rightEye.x);
  const total = leftDist + rightDist || 0.001;
  const yaw = (leftDist / total - 0.5) * -180;

  const eyeY = (leftEye.y + rightEye.y) / 2;
  const vertSpan = chin.y - eyeY || 0.001;
  const noseRatio = (nose.y - eyeY) / vertSpan;
  const pitch = (noseRatio - 0.62) * 150;

  return {
    yaw: Math.round(yaw * 10) / 10,
    pitch: Math.round(pitch * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useProctoring(params: UseProctoringParams): UseProctoringReturn {
  const {
    enabled,
    videoRef,
    interviewStartTs,
    fps = DEFAULT_CONFIG.fps,
    numFaces = DEFAULT_CONFIG.numFaces,
    thresholds,
    wasmPath = DEFAULT_CONFIG.wasmPath,
    modelAssetPath = DEFAULT_CONFIG.modelAssetPath,
  } = params;

  // State
  const [riskScore, setRiskScore] = useState(0);
  const [flags, setFlags] = useState<ProctoringFlag[]>([]);
  const [metrics, setMetrics] = useState<ProctoringMetrics>(EMPTY_METRICS);
  const [isRunning, setIsRunning] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const scorerRef = useRef<RiskScorer | null>(null);
  const runningRef = useRef(false);
  const lastCaptureTs = useRef(0);
  const rvfcHandle = useRef(0);
  const intervalHandle = useRef(0);
  const stateUpdateHandle = useRef(0);
  const processingRef = useRef(false);
  const lowEnd = useRef(isLowEndDevice());

  const frameInterval = 1000 / fps;

  // ---- Initialize MediaPipe on mount ----
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    console.log("[Proctoring] Initializing MediaPipe on main thread...");

    const initTimeout = window.setTimeout(() => {
      if (!cancelled) {
        console.warn("[Proctoring] Init timeout — model loading took >30s");
        setError("Proctoring init timed out. Check network / console.");
      }
    }, 30_000);

    (async () => {
      try {
        console.log("[Proctoring] Loading WASM from:", wasmPath);
        const vision = await FilesetResolver.forVisionTasks(wasmPath);
        if (cancelled) return;

        console.log("[Proctoring] WASM loaded. Creating FaceLandmarker...");
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        scorerRef.current = new RiskScorer(interviewStartTs, thresholds);
        clearTimeout(initTimeout);
        setIsReady(true);
        setError(null);
        console.log("[Proctoring] FaceLandmarker ready ✓ (GPU delegate, main thread)");
      } catch (err) {
        if (cancelled) return;
        // Retry with CPU if GPU fails
        try {
          console.warn("[Proctoring] GPU failed, retrying with CPU...", err);
          const vision = await FilesetResolver.forVisionTasks(wasmPath);
          if (cancelled) return;
          const landmarker = await FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numFaces,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          });
          if (cancelled) {
            landmarker.close();
            return;
          }
          landmarkerRef.current = landmarker;
          scorerRef.current = new RiskScorer(interviewStartTs, thresholds);
          clearTimeout(initTimeout);
          setIsReady(true);
          setError(null);
          console.log("[Proctoring] FaceLandmarker ready ✓ (CPU delegate, main thread)");
        } catch (err2) {
          if (cancelled) return;
          clearTimeout(initTimeout);
          const msg = `MediaPipe init failed: ${err2 instanceof Error ? err2.message : String(err2)}`;
          console.error("[Proctoring]", msg);
          setError(msg);
          logErrorToServer(msg, { details: err2 instanceof Error ? err2.stack : undefined, source: "proctoring" });
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(initTimeout);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      scorerRef.current = null;
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // ---- Single inference tick ----
  const runInference = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || !runningRef.current || processingRef.current) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    processingRef.current = true;
    const ts = performance.now();

    try {
      // Brightness (tiny canvas, < 0.1ms)
      const brightness = computeBrightness(video);

      // Face landmarks (~15-25ms on GPU, ~20-35ms on CPU)
      const result = landmarker.detectForVideo(video, ts);

      const faceCount = result.faceLandmarks.length;
      let yaw = 0;
      let pitch = 0;
      if (faceCount >= 1 && result.faceLandmarks[0]!.length >= 264) {
        const pose = estimateHeadPose(result.faceLandmarks[0]!);
        yaw = pose.yaw;
        pitch = pose.pitch;
      }

      const detection: DetectionResult = {
        faceCount,
        yaw,
        pitch,
        brightness,
        handNearFace: false,
        timestamp: ts,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      };

      scorerRef.current?.processDetection(detection);

      // Warn if inference is too slow
      const elapsed = performance.now() - ts;
      if (elapsed > 50) {
        console.debug(`[Proctoring] Inference took ${elapsed.toFixed(0)}ms (target <50ms)`);
      }
    } catch (err) {
      console.warn("[Proctoring] Inference error:", err);
    } finally {
      processingRef.current = false;
    }
  }, [videoRef]);

  // ---- React state sync (throttled) ----
  const syncState = useCallback(() => {
    const scorer = scorerRef.current;
    if (!scorer) return;
    scorer.tick();
    setRiskScore(scorer.getScore());
    setFlags([...scorer.getFlags()]);
    setMetrics(scorer.getMetrics());
  }, []);

  // ---- Browser event listeners (visibility, blur, fullscreen, keyboard) ----
  useEffect(() => {
    if (!enabled || !isReady) return;

    const onVis = () => {
      if (document.hidden) scorerRef.current?.processTabHidden();
      else scorerRef.current?.processTabVisible();
    };
    const onBlur = () => scorerRef.current?.processWindowBlur();
    const onFs = () => {
      if (!document.fullscreenElement) scorerRef.current?.processFullscreenExit();
    };
    const onKeydown = (e: KeyboardEvent) => {
      const target = e.target as Node;
      const tagName = target && "tagName" in target ? (target as HTMLElement).tagName : "";
      const role = target && "getAttribute" in target ? (target as HTMLElement).getAttribute("role") : null;
      const isInput =
        tagName === "INPUT" ||
        tagName === "TEXTAREA" ||
        tagName === "SELECT" ||
        role === "textbox" ||
        (target as HTMLElement).isContentEditable;
      if (!isInput) scorerRef.current?.processKeydownNoInputFocus();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("keydown", onKeydown);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("keydown", onKeydown);
    };
  }, [enabled, isReady]);

  // ---- Start / Stop / Reset ----

  const start = useCallback(() => {
    if (!isReady || runningRef.current) return;
    runningRef.current = true;
    setIsRunning(true);
    lastCaptureTs.current = 0;

    const video = videoRef.current;

    // Frame capture loop
    if (video && typeof video.requestVideoFrameCallback === "function") {
      const onFrame = (now: DOMHighResTimeStamp) => {
        if (!runningRef.current) return;
        if (now - lastCaptureTs.current >= frameInterval) {
          lastCaptureTs.current = now;
          runInference();
        }
        videoRef.current?.requestVideoFrameCallback?.(onFrame);
      };
      rvfcHandle.current = video.requestVideoFrameCallback(onFrame);
    } else {
      intervalHandle.current = window.setInterval(runInference, frameInterval);
    }

    // State sync 3×/sec
    stateUpdateHandle.current = window.setInterval(syncState, 333);
  }, [isReady, videoRef, frameInterval, runInference, syncState]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setIsRunning(false);
    if (rvfcHandle.current && videoRef.current?.cancelVideoFrameCallback) {
      videoRef.current.cancelVideoFrameCallback(rvfcHandle.current);
      rvfcHandle.current = 0;
    }
    if (intervalHandle.current) {
      clearInterval(intervalHandle.current);
      intervalHandle.current = 0;
    }
    if (stateUpdateHandle.current) {
      clearInterval(stateUpdateHandle.current);
      stateUpdateHandle.current = 0;
    }
    syncState();
  }, [videoRef, syncState]);

  const reset = useCallback(() => {
    scorerRef.current?.reset();
    setRiskScore(0);
    setFlags([]);
    setMetrics(EMPTY_METRICS);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (intervalHandle.current) clearInterval(intervalHandle.current);
      if (stateUpdateHandle.current) clearInterval(stateUpdateHandle.current);
    };
  }, []);

  return {
    riskScore,
    riskLevel: getRiskLevel(riskScore),
    flags,
    metrics,
    isRunning,
    isReady,
    isLowEnd: lowEnd.current,
    error,
    start,
    stop,
    reset,
  };
}
