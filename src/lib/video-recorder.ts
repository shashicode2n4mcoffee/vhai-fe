/**
 * VideoRecorder
 *
 * Records the candidate's webcam video with mixed audio (mic + AI playback)
 * into a single WebM file. Also handles AI audio playback through speakers
 * so only one AudioContext is needed for both playback and recording.
 *
 * Audio routing:
 *   mic stream ──────┐
 *                     ├──► mixedDest ──► MediaRecorder (recording)
 *   AI audio chunks ──┤
 *                     └──► ctx.destination (speakers)
 */

export class VideoRecorder {
  private webcamStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private mixedDest: MediaStreamAudioDestinationNode | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  // AI playback scheduling (gapless, same approach as AudioPlaybackManager)
  private scheduledEnd = 0;
  private activeSources: AudioBufferSourceNode[] = [];

  /** Whether we are currently recording */
  get isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }

  // ---- lifecycle ----------------------------------------------------------

  /**
   * Start webcam + recording. Returns the raw webcam MediaStream so the
   * UI can show a live `<video>` preview.
   */
  async start(): Promise<MediaStream> {
    // 1. Get webcam video + mic audio
    this.webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // 2. Create a mixing AudioContext at the browser's default sample rate
    this.audioCtx = new AudioContext();
    this.mixedDest = this.audioCtx.createMediaStreamDestination();

    // 3. Route mic audio into the mixer (NOT to speakers — that causes echo)
    const micSource = this.audioCtx.createMediaStreamSource(this.webcamStream);
    micSource.connect(this.mixedDest);

    // 4. Build combined MediaStream: webcam video + mixed audio
    const combinedStream = new MediaStream([
      ...this.webcamStream.getVideoTracks(),
      ...this.mixedDest.stream.getAudioTracks(),
    ]);

    // 5. Choose a supported MIME type
    const mimeType = this.pickMimeType();

    // 6. Start recording
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(combinedStream, {
      mimeType,
      videoBitsPerSecond: 2_500_000,
    });
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.mediaRecorder.start(1000); // flush every 1 s
    this.scheduledEnd = 0;

    return this.webcamStream;
  }

  // ---- AI audio playback (speakers + recording) ---------------------------

  /** Play an AI audio chunk (base64 24 kHz 16-bit PCM) through speakers and into the recording. */
  playAiChunk(base64Audio: string): void {
    if (!this.audioCtx || !this.mixedDest) return;

    if (this.audioCtx.state === "suspended") {
      void this.audioCtx.resume();
    }

    // Decode base64 → Int16 → Float32
    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i]! / 32768;
    }

    // Create AudioBuffer (AudioContext resamples from 24 kHz automatically)
    const buffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    // Route to speakers
    source.connect(this.audioCtx.destination);
    // Route to recording mixer
    source.connect(this.mixedDest);

    const now = this.audioCtx.currentTime;
    const startAt = Math.max(now + 0.02, this.scheduledEnd);
    source.start(startAt);
    this.scheduledEnd = startAt + buffer.duration;

    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) this.activeSources.splice(idx, 1);
    };
    this.activeSources.push(source);
  }

  /** Stop AI audio immediately (barge-in). */
  stopPlayback(): void {
    for (const src of this.activeSources) {
      try { src.stop(); } catch { /* already stopped */ }
    }
    this.activeSources = [];
    this.scheduledEnd = 0;
  }

  // ---- stop recording -----------------------------------------------------

  /** Stop recording and return the final video Blob. */
  async stop(): Promise<Blob> {
    this.stopPlayback();

    return new Promise<Blob>((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === "inactive") {
        resolve(new Blob(this.chunks, { type: "video/webm" }));
        this.cleanup();
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: "video/webm" });
        this.cleanup();
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  // ---- internals ----------------------------------------------------------

  private cleanup(): void {
    // Stop all webcam / mic tracks
    this.webcamStream?.getTracks().forEach((t) => t.stop());
    this.webcamStream = null;

    void this.audioCtx?.close();
    this.audioCtx = null;
    this.mixedDest = null;
    this.mediaRecorder = null;
    this.chunks = [];
    this.activeSources = [];
    this.scheduledEnd = 0;
  }

  private pickMimeType(): string {
    const preferred = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/webm",
      "video/mp4",
    ];
    for (const mt of preferred) {
      if (MediaRecorder.isTypeSupported(mt)) return mt;
    }
    return "video/webm";
  }
}
