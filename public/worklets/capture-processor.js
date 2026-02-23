/**
 * AudioWorklet Processor for real-time microphone capture.
 *
 * Responsibilities:
 *  - Downsample from the AudioContext sample rate (typically 44100/48000) to 16 kHz
 *    using linear interpolation.
 *  - Convert Float32 samples to 16-bit signed PCM (little-endian).
 *  - Compute RMS energy per frame for client-side VAD visualization.
 *  - Accumulate samples into chunks and post them to the main thread.
 *  - Noise gate: when energy is below threshold (with hysteresis), send silence to
 *    reduce background noise sent to Gemini and improve ASR/latency.
 */
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    /** @type {number[]} */
    this._buffer = [];
    this._targetSampleRate = 16000;
    // ~32 ms at 16 kHz — smaller chunks reduce end-to-end latency (API best practice 20–40 ms)
    this._chunkSize = 512;
    this._active = true;

    // Noise gate: suppress low-level background noise sent to Gemini (hysteresis to avoid flapping)
    this._gateOpenThreshold = 0.018;   // above this → pass audio
    this._gateCloseThreshold = 0.006; // below this → send silence
    this._gateOpen = false;
    this._smoothedRms = 0;
    this._smoothingAlpha = 0.25;

    this.port.onmessage = (event) => {
      if (event.data?.type === "stop") {
        this._active = false;
      }
      if (event.data?.type === "noiseGate" && typeof event.data.openThreshold === "number") {
        this._gateOpenThreshold = event.data.openThreshold;
        if (typeof event.data.closeThreshold === "number") {
          this._gateCloseThreshold = event.data.closeThreshold;
        }
      }
    };
  }

  /**
   * @param {Float32Array[][]} inputs
   * @returns {boolean}
   */
  process(inputs) {
    if (!this._active) return false;

    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    // ---- RMS energy for VAD visualization and noise gate ----
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / channelData.length);
    this._smoothedRms = this._smoothingAlpha * rms + (1 - this._smoothingAlpha) * this._smoothedRms;

    // ---- Noise gate (hysteresis) ----
    if (this._gateOpen) {
      if (this._smoothedRms < this._gateCloseThreshold) this._gateOpen = false;
    } else {
      if (this._smoothedRms > this._gateOpenThreshold) this._gateOpen = true;
    }

    // ---- Downsample via linear interpolation ----
    const ratio = sampleRate / this._targetSampleRate;
    const outputLength = Math.ceil(channelData.length / ratio);

    for (let i = 0; i < outputLength; i++) {
      const srcIdx = i * ratio;
      const floor = Math.floor(srcIdx);
      const ceil = Math.min(floor + 1, channelData.length - 1);
      const frac = srcIdx - floor;

      const sample = this._gateOpen
        ? channelData[floor] * (1 - frac) + channelData[ceil] * frac
        : 0;

      // Float32 → Int16
      const clamped = Math.max(-1, Math.min(1, sample));
      this._buffer.push(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
    }

    // ---- Flush complete chunks ----
    while (this._buffer.length >= this._chunkSize) {
      const chunk = this._buffer.splice(0, this._chunkSize);
      const int16 = new Int16Array(chunk);

      this.port.postMessage(
        { type: "audio", buffer: int16.buffer, rms },
        [int16.buffer]
      );
    }

    return true;
  }
}

registerProcessor("capture-processor", CaptureProcessor);
