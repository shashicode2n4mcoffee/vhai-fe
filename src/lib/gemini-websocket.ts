/**
 * Gemini Live API — Raw WebSocket Client
 *
 * Manages a single bidirectional WebSocket session with the Gemini Live API.
 * Handles the setup handshake, real-time audio streaming, and server message
 * parsing with typed callbacks.
 */

import type {
  ConnectionState,
  GeminiLiveConfig,
  GeminiServerMessage,
  SessionResumptionUpdate,
} from "../types/gemini";
import { clearGeminiCache } from "./gemini-key";

// ---------------------------------------------------------------------------
// Callback interface
// ---------------------------------------------------------------------------

export interface GeminiLiveCallbacks {
  onConnectionStateChange: (state: ConnectionState) => void;
  onSetupComplete: () => void;
  /** Called after reconnect with session resumption (do not re-send intro text) */
  onResumed?: () => void;
  onAudioData: (base64Audio: string) => void;
  onInputTranscription: (text: string) => void;
  onOutputTranscription: (text: string) => void;
  onInterrupted: () => void;
  onTurnComplete: () => void;
  onError: (error: Error) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WS_ENDPOINT =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Delay before reconnecting after connection close (e.g. 10 min limit) */
const RECONNECT_DELAY_MS = 800;
/** Proactively rotate connection before server closes at ~10 min (use 9 min to be safe) */
const PROACTIVE_RECONNECT_MS = 9 * 60 * 1000;
/** Max time to wait for WebSocket to open before failing (connection timeout) */
const CONNECT_TIMEOUT_MS = 20_000;
/** One retry for initial connect on timeout/failure */
const INITIAL_CONNECT_RETRIES = 1;

export class GeminiWebSocketClient {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private callbacks: GeminiLiveCallbacks;
  private _state: ConnectionState = "disconnected";
  /** Last resumption token from server; used to resume session after ~10 min disconnect */
  private resumptionToken: string | null = null;
  /** When true, do not auto-reconnect on close (user called disconnect()) */
  private intentionalDisconnect = false;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  /** Proactive reconnect before 10 min; cleared on disconnect/reconnect */
  private proactiveReconnectTimerId: ReturnType<typeof setTimeout> | null = null;
  /** True when we sent setup with a resumption token (next setupComplete = resume, not initial) */
  private didSendSetupWithResumptionToken = false;
  /** Number of resumption reconnect attempts left (avoid infinite loop on invalid token) */
  private resumptionRetriesLeft = 1;
  /** Timer for connection timeout (close if WebSocket doesn't open in time) */
  private connectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  /** Retries left for initial connect (no resumption) on timeout/error */
  private initialConnectRetriesLeft = INITIAL_CONNECT_RETRIES;

  constructor(config: GeminiLiveConfig, callbacks: GeminiLiveCallbacks) {
    this.config = config;
    this.callbacks = callbacks;
  }

  // ---- public API ---------------------------------------------------------

  get state(): ConnectionState {
    return this._state;
  }

  connect(): void {
    if (this.ws) this.disconnect();
    this.intentionalDisconnect = false;
    // One retry for initial connect (when not resuming)
    if (!this.resumptionToken) this.initialConnectRetriesLeft = INITIAL_CONNECT_RETRIES;

    const url = `${WS_ENDPOINT}?key=${this.config.apiKey}`;
    this.setState("connecting");

    try {
      this.ws = new WebSocket(url);
      this.ws.binaryType = "arraybuffer";
      this.ws.onopen = this.handleOpen;
      this.ws.onmessage = this.handleMessage;
      this.ws.onerror = this.handleError as (ev: Event) => void;
      this.ws.onclose = this.handleClose as (ev: Event) => void;

      this.clearConnectTimeout();
      this.connectTimeoutId = setTimeout(() => this.handleConnectTimeout(), CONNECT_TIMEOUT_MS);
    } catch (err) {
      this.setState("error");
      this.callbacks.onError(
        err instanceof Error ? err : new Error(String(err)),
      );
    }
  }

  private clearConnectTimeout(): void {
    if (this.connectTimeoutId !== null) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = null;
    }
  }

  private handleConnectTimeout(): void {
    this.connectTimeoutId = null;
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.CONNECTING) return;

    this.ws = null;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    ws.close(1000, "Connection timeout");

    this.setState("disconnected");

    const canRetry =
      !this.intentionalDisconnect &&
      !this.resumptionToken &&
      this.initialConnectRetriesLeft > 0;

    if (canRetry) {
      this.initialConnectRetriesLeft--;
      console.warn("[GeminiWS] Connection timeout, retrying in 2s...");
      this.reconnectTimeoutId = setTimeout(() => {
        this.reconnectTimeoutId = null;
        this.connect();
      }, 2000);
    } else {
      this.setState("error");
      this.callbacks.onError(new Error("Connection timeout. Please check your network and try again."));
    }
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.resumptionToken = null;
    this.didSendSetupWithResumptionToken = false;
    this.resumptionRetriesLeft = 1;
    this.initialConnectRetriesLeft = INITIAL_CONNECT_RETRIES;
    this.clearConnectTimeout();
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
    if (this.proactiveReconnectTimerId !== null) {
      clearTimeout(this.proactiveReconnectTimerId);
      this.proactiveReconnectTimerId = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close(1000, "Client disconnect");
      }
      this.ws = null;
    }
    this.setState("disconnected");
  }

  /** Stream a 16 kHz 16-bit PCM chunk (base64-encoded) to the server. */
  sendAudio(base64Pcm: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            data: base64Pcm,
            mimeType: "audio/pcm;rate=16000",
          },
        },
      }),
    );
  }

  /**
   * Send a text turn to the model (triggers a response).
   * Used to make the AI start the conversation first.
   */
  sendText(text: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        clientContent: {
          turns: [{ role: "user", parts: [{ text }] }],
          turnComplete: true,
        },
      }),
    );
  }

  // ---- WebSocket handlers (arrow fns keep `this`) -------------------------

  private handleOpen = (): void => {
    this.clearConnectTimeout();
    this.sendSetupMessage();
  };

  private static decoder = new TextDecoder();

  private handleMessage = (event: MessageEvent): void => {
    try {
      // Messages arrive as ArrayBuffer (binary frames) or string (text frames)
      const raw =
        event.data instanceof ArrayBuffer
          ? GeminiWebSocketClient.decoder.decode(event.data)
          : (event.data as string);

      const msg = JSON.parse(raw) as Record<string, unknown>;

      // ---- Handle server-side error responses ----
      if (msg["error"]) {
        const err = msg["error"] as {
          message?: string;
          code?: number;
          status?: string;
        };
        const errMsg = `Gemini API error ${err.code ?? ""}: ${err.message ?? "Unknown error"} (${err.status ?? ""})`;
        console.error("[GeminiWS]", errMsg, msg);
        // If this was a resumption attempt and we have retries, reconnect once (fresh connection without token)
        if (
          this.didSendSetupWithResumptionToken &&
          this.resumptionRetriesLeft > 0 &&
          !this.intentionalDisconnect
        ) {
          this.resumptionRetriesLeft--;
          this.didSendSetupWithResumptionToken = false;
          this.resumptionToken = null;
          console.warn("[GeminiWS] Resumption failed, retrying with fresh connection...");
          this.reconnectTimeoutId = setTimeout(() => {
            this.reconnectTimeoutId = null;
            this.connect();
          }, 2000);
          return;
        }
        // Key revoked or expired: clear cache so next start fetches a new key
        const code = err.code;
        const status = (err.status ?? "").toString().toUpperCase();
        if (
          code === 401 ||
          code === 403 ||
          status === "UNAUTHENTICATED" ||
          status === "PERMISSION_DENIED"
        ) {
          clearGeminiCache();
          this.callbacks.onError(
            new Error("Session expired or access denied. Please try again."),
          );
          this.disconnect();
        } else {
          this.callbacks.onError(new Error(errMsg));
        }
        return;
      }

      const typed = msg as unknown as GeminiServerMessage;

      // 1. Session resumption token (store for reconnect after ~10 min)
      // API sends newHandle when resumable=true; only then should we store and schedule proactive reconnect
      const resumptionUpdate =
        typed.sessionResumptionUpdate ??
        (msg["session_resumption_update"] as SessionResumptionUpdate | undefined);
      if (resumptionUpdate) {
        const resumable =
          (resumptionUpdate as Record<string, unknown>)["resumable"] ??
          resumptionUpdate.resumable;
        const tok = this.getResumptionToken(resumptionUpdate);
        // Only store when server says session is resumable (when false, newHandle is empty)
        if (resumable !== false && tok) {
          this.resumptionToken = tok;
          this.scheduleProactiveReconnect();
          console.log("[GeminiWS] Session resumption token received (for 30+ min support)");
        }
      }

      // 2. Setup acknowledgement (camelCase or snake_case)
      const setupComplete = typed.setupComplete !== undefined || msg["setup_complete"] !== undefined;
      if (setupComplete) {
        this.setState("connected");
        if (this.didSendSetupWithResumptionToken) {
          this.didSendSetupWithResumptionToken = false;
          console.log("[GeminiWS] Session resumed — connection live again");
          this.callbacks.onResumed?.();
        } else {
          console.log("[GeminiWS] Setup complete — session is live");
          this.callbacks.onSetupComplete();
        }
        return;
      }

      // 3. Server content (audio, transcription, turn signals)
      if (typed.serverContent) {
        const sc = typed.serverContent;

        if (sc.interrupted) {
          this.callbacks.onInterrupted();
        }

        // Audio chunks from model
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data) {
              this.callbacks.onAudioData(part.inlineData.data);
            }
          }
        }

        // Input transcription (user speech → text)
        if (sc.inputTranscription?.text) {
          this.callbacks.onInputTranscription(sc.inputTranscription.text);
        }

        // Output transcription (model speech → text)
        if (sc.outputTranscription?.text) {
          this.callbacks.onOutputTranscription(sc.outputTranscription.text);
        }

        if (sc.turnComplete) {
          this.callbacks.onTurnComplete();
        }
        if (sc.generationComplete) {
          this.callbacks.onTurnComplete();
        }
      } else if (
        !msg["error"] &&
        !typed.sessionResumptionUpdate &&
        !(msg["session_resumption_update"]) &&
        typed.setupComplete === undefined &&
        msg["setup_complete"] === undefined
      ) {
        console.warn("[GeminiWS] Unknown message shape (no handler):", Object.keys(msg));
      }
    } catch (err) {
      console.error("[GeminiWS] Failed to parse message:", err, event.data);
      this.callbacks.onError(
        err instanceof Error ? err : new Error("Invalid response from AI service. Try reconnecting."),
      );
      this.disconnect();
    }
  };

  private handleError = (ev: Event): void => {
    this.clearConnectTimeout();
    console.error("[GeminiWS] WebSocket error event:", ev);
    this.setState("error");
    this.callbacks.onError(new Error("WebSocket connection error"));
  };

  private handleClose = (ev: CloseEvent): void => {
    this.clearConnectTimeout();
    const reason = ev.reason || "No reason provided";
    console.warn(
      `[GeminiWS] WebSocket closed — code: ${ev.code}, reason: ${reason}, clean: ${ev.wasClean}`,
    );

    this.ws = null;
    this.setState("disconnected");

    // Auto-reconnect with session resumption to support 30+ min (server closes ~every 10 min)
    if (!this.intentionalDisconnect && this.resumptionToken) {
      if (this.proactiveReconnectTimerId !== null) {
        clearTimeout(this.proactiveReconnectTimerId);
        this.proactiveReconnectTimerId = null;
      }
      this.reconnectTimeoutId = setTimeout(() => {
        this.reconnectTimeoutId = null;
        console.log("[GeminiWS] Reconnecting with session resumption...");
        this.connect();
      }, RECONNECT_DELAY_MS);
      return;
    }

    // One retry for initial connect on connection failure (no resumption)
    if (
      !this.intentionalDisconnect &&
      !this.resumptionToken &&
      this.initialConnectRetriesLeft > 0
    ) {
      this.initialConnectRetriesLeft--;
      console.warn("[GeminiWS] Connection failed, retrying in 2s...");
      this.reconnectTimeoutId = setTimeout(() => {
        this.reconnectTimeoutId = null;
        this.connect();
      }, 2000);
      return;
    }

    // Reset retry count on normal close so next resumption can retry if needed
    if (this.intentionalDisconnect) this.resumptionRetriesLeft = 1;

    if (ev.code !== 1000 && ev.code !== 1005) {
      this.callbacks.onError(
        new Error(`Connection closed (code ${ev.code}): ${reason}`),
      );
    }
  };

  /** Extract resumption token from server message. API uses newHandle (camelCase) or new_handle (snake_case). */
  private getResumptionToken(update: SessionResumptionUpdate): string | null {
    const raw = update as Record<string, unknown>;
    const t =
      update.newHandle ??
      raw["new_handle"] ??
      update.resumptionToken ??
      update.handle ??
      update.token ??
      raw["resumption_token"] ??
      raw["handle"];
    return typeof t === "string" && t.length > 0 ? t : null;
  }

  /** Schedule closing this connection before 10 min so we reconnect with resumption (no user-visible drop). */
  private scheduleProactiveReconnect(): void {
    if (this.proactiveReconnectTimerId !== null) {
      clearTimeout(this.proactiveReconnectTimerId);
      this.proactiveReconnectTimerId = null;
    }
    this.proactiveReconnectTimerId = setTimeout(() => {
      this.proactiveReconnectTimerId = null;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.resumptionToken) return;
      console.log("[GeminiWS] Proactive reconnect before 10 min limit...");
      this.ws.close(1000, "Proactive reconnect before 10 min limit");
    }, PROACTIVE_RECONNECT_MS);
  }

  // ---- internals ----------------------------------------------------------

  private setState(state: ConnectionState): void {
    this._state = state;
    this.callbacks.onConnectionStateChange(state);
  }

  private sendSetupMessage(): void {
    const setup: Record<string, unknown> = {
      model: `models/${this.config.model}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: this.config.voiceName,
            },
          },
        },
      },
      systemInstruction: {
        parts: [{ text: this.config.systemInstruction }],
      },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: false,
          startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
          // End-of-speech: require clear pause so AI doesn't interrupt mid-answer (industry standard ~1–1.5s silence).
          endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
          prefixPaddingMs: this.config.prefixPaddingMs,
          silenceDurationMs: this.config.silenceDurationMs, // e.g. 1200ms = wait 1.2s silence before model responds
        },
      },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Request resumption tokens so we can reconnect after ~10 min and keep session 30+ min
      // API expects camelCase: sessionResumption with handle when resuming (BidiGenerateContentSetup.sessionResumption)
      sessionResumption: this.resumptionToken
        ? { handle: this.resumptionToken }
        : {},
      // Extend session beyond default 15 min audio-only limit
      contextWindowCompression: { slidingWindow: {} },
    };

    if (this.resumptionToken) this.didSendSetupWithResumptionToken = true;

    const msg = JSON.stringify({ setup });
    console.log(
      "[GeminiWS] Sending setup",
      this.resumptionToken ? "(with session resumption)" : "(initial)",
    );
    this.ws?.send(msg);
  }
}
