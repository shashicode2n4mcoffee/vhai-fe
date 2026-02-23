/**
 * Client-Side Voice Activity Detection Analyzer
 *
 * This module provides real-time speech detection purely for UI feedback.
 * The actual turn-taking decisions are handled server-side by Gemini's
 * built-in AutomaticActivityDetection (configurable via realtimeInputConfig).
 *
 * Algorithm:
 *  - Maintains a short rolling window of RMS energy values.
 *  - Uses an adaptive threshold (percentile-based noise floor + fixed offset).
 *  - Applies a minimum hold time to prevent flickering.
 */

export interface VADState {
  /** Whether the user appears to be speaking */
  isSpeaking: boolean;
  /** Current energy level (0 – 1, normalised) */
  energy: number;
  /** Smoothed energy suitable for animation */
  smoothedEnergy: number;
}

export class VADAnalyzer {
  // Config
  private readonly windowSize: number;
  private readonly speechThreshold: number;
  private readonly silenceThreshold: number;
  private readonly holdTimeMs: number;

  // State
  private energyWindow: number[] = [];
  private _isSpeaking = false;
  private lastSpeechTime = 0;
  private _smoothedEnergy = 0;

  constructor(
    options: {
      /** Rolling window length for noise estimation */
      windowSize?: number;
      /** Energy above this triggers speech */
      speechThreshold?: number;
      /** Energy below this ends speech */
      silenceThreshold?: number;
      /** Minimum ms to remain in "speaking" state */
      holdTimeMs?: number;
    } = {},
  ) {
    this.windowSize = options.windowSize ?? 50;
    this.speechThreshold = options.speechThreshold ?? 0.015;
    this.silenceThreshold = options.silenceThreshold ?? 0.008;
    this.holdTimeMs = options.holdTimeMs ?? 250;
  }

  /** Process a new RMS sample. Returns the updated VAD state. */
  update(rms: number): VADState {
    const now = Date.now();

    // Keep a rolling window
    this.energyWindow.push(rms);
    if (this.energyWindow.length > this.windowSize) {
      this.energyWindow.shift();
    }

    // Exponential moving average for visualisation
    const alpha = 0.35;
    this._smoothedEnergy = alpha * rms + (1 - alpha) * this._smoothedEnergy;

    // Speech detection with hysteresis
    if (!this._isSpeaking) {
      if (rms > this.speechThreshold) {
        this._isSpeaking = true;
        this.lastSpeechTime = now;
      }
    } else {
      if (rms > this.silenceThreshold) {
        this.lastSpeechTime = now;
      } else if (now - this.lastSpeechTime > this.holdTimeMs) {
        this._isSpeaking = false;
      }
    }

    return {
      isSpeaking: this._isSpeaking,
      energy: rms,
      smoothedEnergy: this._smoothedEnergy,
    };
  }

  reset(): void {
    this.energyWindow = [];
    this._isSpeaking = false;
    this.lastSpeechTime = 0;
    this._smoothedEnergy = 0;
  }
}
