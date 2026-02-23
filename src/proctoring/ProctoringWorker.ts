/**
 * Proctoring Web Worker — Runs MediaPipe FaceLandmarker off the main thread.
 *
 * Compatibility shim:
 *   MediaPipe's vision_bundle.mjs internally calls `self.import()` to load
 *   WASM modules. But `import()` is a language keyword, not a method on
 *   `self`, so `self.import()` is undefined in module workers.
 *   We polyfill it below using `new Function` so the string is opaque to
 *   Vite's AST transformer (which would otherwise turn import() → self.import()
 *   again, creating an infinite loop).
 *
 * Protocol:
 *   Main → Worker:  { type: 'init', wasmPath, modelAssetPath, numFaces, enableHand }
 *   Main → Worker:  { type: 'frame', bitmap, timestamp }
 *   Main → Worker:  { type: 'stop' }
 *
 *   Worker → Main:  { type: 'ready' }
 *   Worker → Main:  { type: 'result', data }
 *   Worker → Main:  { type: 'error', message }
 */

// ---------------------------------------------------------------------------
// Polyfill self.import — MUST run before any MediaPipe code.
// MediaPipe's ESM bundle calls self.import() to dynamically load WASM.
// `new Function` hides the `import()` keyword from Vite's transform pass.
// ---------------------------------------------------------------------------
const _selfAny = self as unknown as Record<string, unknown>;
if (typeof _selfAny["import"] !== "function") {
  _selfAny["import"] = new Function("u", "return import(u)");
}

// ---- NO top-level imports from @mediapipe/tasks-vision ----
// Types are fine (erased at compile time)
import type { DetectionResult, WorkerOutMessage } from "./types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let faceLandmarker: any = null;

// Reusable canvas for brightness calculation (tiny — 16×12)
let brightnessCanvas: OffscreenCanvas | null = null;
let brightnessCtx: OffscreenCanvasRenderingContext2D | null = null;

let processing = false; // Guard against overlapping frames

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(msg: WorkerOutMessage): void {
  self.postMessage(msg);
}

/**
 * Compute average brightness from an ImageBitmap using a tiny canvas.
 * Returns 0–255. Very fast (~0.1 ms on a 16×12 canvas).
 */
function computeBrightness(bitmap: ImageBitmap): number {
  if (!brightnessCanvas) {
    brightnessCanvas = new OffscreenCanvas(16, 12);
    brightnessCtx = brightnessCanvas.getContext("2d", {
      willReadFrequently: true,
    });
  }
  if (!brightnessCtx) return 128;

  brightnessCtx.drawImage(bitmap, 0, 0, 16, 12);
  const imageData = brightnessCtx.getImageData(0, 0, 16, 12);
  const data = imageData.data;

  let sum = 0;
  const pixelCount = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    // Perceived luminance: 0.299R + 0.587G + 0.114B
    sum += data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
  }
  return Math.round(sum / pixelCount);
}

/**
 * Estimate head pose (yaw & pitch) from 478 face landmarks.
 *
 * Landmarks:  1=nose tip, 33=left eye outer, 263=right eye outer, 152=chin
 */
function estimateHeadPose(
  landmarks: { x: number; y: number; z: number }[],
): { yaw: number; pitch: number } {
  const nose = landmarks[1]!;
  const leftEye = landmarks[33]!;
  const rightEye = landmarks[263]!;
  const chin = landmarks[152]!;

  // Yaw: compare nose-to-eye horizontal distances
  const leftDist = Math.abs(nose.x - leftEye.x);
  const rightDist = Math.abs(nose.x - rightEye.x);
  const total = leftDist + rightDist || 0.001;
  const yaw = (leftDist / total - 0.5) * -180;

  // Pitch: nose vertical position relative to eye-chin span
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
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  switch (msg.type) {
    // ------------------------------------------------------------------
    // INIT — Load MediaPipe dynamically, then load WASM + model
    // ------------------------------------------------------------------
    case "init": {
      console.log("[ProctoringWorker] Init received, loading MediaPipe...");

      try {
        // Derive the ESM bundle URL from the WASM path.
        // e.g. ".../tasks-vision@0.10.32/wasm" → ".../tasks-vision@0.10.32/vision_bundle.mjs"
        const bundleUrl = msg.wasmPath.replace(/\/wasm\/?$/, "/vision_bundle.mjs");

        // Load MediaPipe from CDN directly — the @vite-ignore comment
        // prevents Vite from transforming import() into self.import()
        // which doesn't exist in worker contexts.
        const mediapipe = await import(/* @vite-ignore */ bundleUrl);
        const { FilesetResolver, FaceLandmarker } = mediapipe;

        console.log("[ProctoringWorker] MediaPipe JS loaded, loading WASM from:", msg.wasmPath);

        const vision = await FilesetResolver.forVisionTasks(msg.wasmPath);

        console.log("[ProctoringWorker] WASM loaded, creating FaceLandmarker...");

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: msg.modelAssetPath,
            delegate: "CPU", // GPU unreliable in workers; CPU is fast enough at 3 FPS
          },
          runningMode: "VIDEO",
          numFaces: msg.numFaces,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });

        console.log("[ProctoringWorker] FaceLandmarker ready ✓");
        post({ type: "ready" });
      } catch (err) {
        const message = `MediaPipe init failed: ${err instanceof Error ? err.message : String(err)}`;
        console.error("[ProctoringWorker]", message, err);
        post({ type: "error", message });
      }
      break;
    }

    // ------------------------------------------------------------------
    // FRAME — Run inference on a single ImageBitmap
    // ------------------------------------------------------------------
    case "frame": {
      if (!faceLandmarker || processing) {
        msg.bitmap.close();
        return;
      }

      processing = true;

      try {
        const brightness = computeBrightness(msg.bitmap);
        const result = faceLandmarker.detectForVideo(msg.bitmap, msg.timestamp);
        const faceCount = result.faceLandmarks.length;
        let yaw = 0;
        let pitch = 0;

        if (faceCount >= 1 && result.faceLandmarks[0].length >= 264) {
          const pose = estimateHeadPose(result.faceLandmarks[0]);
          yaw = pose.yaw;
          pitch = pose.pitch;
        }

        const detection: DetectionResult = {
          faceCount,
          yaw,
          pitch,
          brightness,
          handNearFace: false,
          timestamp: msg.timestamp,
        };

        post({ type: "result", data: detection });
      } catch (err) {
        post({
          type: "error",
          message: `Inference error: ${err instanceof Error ? err.message : String(err)}`,
        });
      } finally {
        msg.bitmap.close();
        processing = false;
      }
      break;
    }

    // ------------------------------------------------------------------
    // STOP — Cleanup
    // ------------------------------------------------------------------
    case "stop": {
      if (faceLandmarker) {
        faceLandmarker.close();
        faceLandmarker = null;
      }
      break;
    }
  }
};
