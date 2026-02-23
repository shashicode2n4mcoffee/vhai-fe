/**
 * Audio Capture Manager
 *
 * Uses the Web Audio API + AudioWorklet to capture microphone audio,
 * downsample to 16 kHz 16-bit PCM, and deliver base64-encoded chunks
 * to a callback. Also exposes real-time RMS energy for UI visualisation.
 */

export interface AudioCaptureCallbacks {
  /** Called with a base64-encoded 16 kHz 16-bit mono PCM chunk */
  onAudioChunk: (base64Pcm: string) => void;
  /** Called with the current mic RMS energy (0 – 1 range, smoothed) */
  onEnergyLevel: (rms: number) => void;
}

export class AudioCaptureManager {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private callbacks: AudioCaptureCallbacks;
  private _active = false;

  // Smoothed energy value for UI
  private _smoothedEnergy = 0;
  private readonly SMOOTHING = 0.3; // EMA alpha

  constructor(callbacks: AudioCaptureCallbacks) {
    this.callbacks = callbacks;
  }

  get active(): boolean {
    return this._active;
  }

  get smoothedEnergy(): number {
    return this._smoothedEnergy;
  }

  // ---- lifecycle ----------------------------------------------------------

  async start(): Promise<void> {
    if (this._active) return;

    // 1. Get microphone access
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });

    // 2. Create AudioContext (browser default sample rate, usually 44.1/48 kHz)
    this.context = new AudioContext();

    // 3. Load the capture worklet processor
    await this.context.audioWorklet.addModule("/worklets/capture-processor.js");

    // 4. Wire mic → worklet
    this.sourceNode = this.context.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.context, "capture-processor");

    this.workletNode.port.onmessage = this.handleWorkletMessage;
    this.sourceNode.connect(this.workletNode);
    // Worklet doesn't produce output audio, but we must connect to keep it alive
    this.workletNode.connect(this.context.destination);

    this._active = true;
  }

  stop(): void {
    this._active = false;

    // Tell worklet to stop processing
    this.workletNode?.port.postMessage({ type: "stop" });

    // Tear down audio graph
    this.sourceNode?.disconnect();
    this.workletNode?.disconnect();

    // Stop all mic tracks
    this.stream?.getTracks().forEach((t) => t.stop());

    // Close context
    void this.context?.close();

    this.sourceNode = null;
    this.workletNode = null;
    this.stream = null;
    this.context = null;
    this._smoothedEnergy = 0;
  }

  // ---- worklet message handling -------------------------------------------

  private handleWorkletMessage = (event: MessageEvent): void => {
    const { type, buffer, rms } = event.data as {
      type: string;
      buffer: ArrayBuffer;
      rms: number;
    };

    if (type !== "audio") return;

    // Update smoothed energy
    this._smoothedEnergy =
      this.SMOOTHING * rms + (1 - this.SMOOTHING) * this._smoothedEnergy;
    this.callbacks.onEnergyLevel(this._smoothedEnergy);

    // Convert Int16 ArrayBuffer → base64
    const base64 = this.arrayBufferToBase64(buffer);
    this.callbacks.onAudioChunk(base64);
  };

  // ---- helpers ------------------------------------------------------------

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chunks: string[] = [];
    const CHUNK = 0x8000; // 32 KB per String.fromCharCode call
    for (let i = 0; i < bytes.length; i += CHUNK) {
      const slice = bytes.subarray(i, i + CHUNK);
      chunks.push(String.fromCharCode(...slice));
    }
    return btoa(chunks.join(""));
  }
}
