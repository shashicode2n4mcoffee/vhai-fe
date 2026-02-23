/**
 * Audio Playback Manager
 *
 * Receives base64-encoded 24 kHz 16-bit PCM chunks from the Gemini Live API
 * and plays them through an AudioContext with gapless scheduling.
 * Also exposes an AnalyserNode for waveform / frequency visualisation.
 */

export class AudioPlaybackManager {
  private context: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private scheduledEnd = 0;
  private sources: AudioBufferSourceNode[] = [];
  private _isPlaying = false;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  // ---- lifecycle ----------------------------------------------------------

  async initialize(): Promise<void> {
    // Playback context at 24 kHz to match Gemini output
    this.context = new AudioContext({ sampleRate: 24000 });
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1.0;

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;

    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.context.destination);

    this.scheduledEnd = 0;
  }

  /** Enqueue one audio chunk for gapless playback. */
  playChunk(base64Audio: string): void {
    if (!this.context || !this.gainNode) return;

    // Resume context if suspended (e.g. after user gesture requirement)
    if (this.context.state === "suspended") {
      void this.context.resume();
    }

    // 1. base64 → Uint8Array → Int16Array
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);

    // 2. Int16 → Float32
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i]! / 32768;
    }

    // 3. Create AudioBuffer and schedule
    const audioBuffer = this.context.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const now = this.context.currentTime;
    const startAt = Math.max(now + 0.02, this.scheduledEnd);
    source.start(startAt);
    this.scheduledEnd = startAt + audioBuffer.duration;
    this._isPlaying = true;

    source.onended = () => {
      const idx = this.sources.indexOf(source);
      if (idx !== -1) this.sources.splice(idx, 1);
      if (this.sources.length === 0) {
        this._isPlaying = false;
      }
    };

    this.sources.push(source);
  }

  /** Immediately stop all scheduled audio (e.g. on barge-in). */
  stop(): void {
    for (const src of this.sources) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
    this.scheduledEnd = 0;
    this._isPlaying = false;
  }

  /** Get frequency data for visualisation (0-255 per bin). */
  getFrequencyData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  /** Get time-domain waveform data for visualisation. */
  getTimeDomainData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  async destroy(): Promise<void> {
    this.stop();
    await this.context?.close();
    this.context = null;
    this.gainNode = null;
    this.analyser = null;
  }
}
