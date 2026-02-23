// ---------------------------------------------------------------------------
// Gemini Live API – WebSocket message types
// ---------------------------------------------------------------------------

/** Connection lifecycle */
export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/** Chat activity state shown in the UI */
export type ChatPhase =
  | "idle"
  | "listening"
  | "user-speaking"
  | "ai-responding";

/** A single chat transcript entry */
export interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

export interface GeminiSetupMessage {
  setup: {
    model: string;
    generationConfig: {
      responseModalities: string[];
      speechConfig?: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: string;
          };
        };
      };
    };
    systemInstruction?: {
      parts: { text: string }[];
    };
    realtimeInputConfig?: {
      automaticActivityDetection?: {
        disabled?: boolean;
        startOfSpeechSensitivity?: string;
        endOfSpeechSensitivity?: string;
        prefixPaddingMs?: number;
        silenceDurationMs?: number;
      };
    };
    inputAudioTranscription?: Record<string, never>;
    outputAudioTranscription?: Record<string, never>;
    /** Enable to receive resumption tokens and reconnect for 30+ min sessions */
    sessionResumption?: Record<string, never> | { handle: string };
    /** Extend session beyond 15 min audio-only limit */
    contextWindowCompression?: { slidingWindow?: Record<string, unknown> };
  };
}

export interface GeminiRealtimeInputMessage {
  realtimeInput: {
    audio: {
      data: string; // base64
      mimeType: string;
    };
  };
}

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

/** Session resumption: server sends token to reconnect after ~10 min connection limit */
export interface SessionResumptionUpdate {
  /** New handle for resumption (API primary field); only set when resumable is true */
  newHandle?: string;
  /** True if session can be resumed at this point (when false, newHandle is empty) */
  resumable?: boolean;
  resumptionToken?: string;
  handle?: string;
  token?: string;
}

export interface GeminiServerMessage {
  setupComplete?: Record<string, never>;
  /** Server sends this to support reconnection; store token for next setup */
  sessionResumptionUpdate?: SessionResumptionUpdate;
  serverContent?: {
    modelTurn?: {
      parts?: {
        inlineData?: {
          data: string; // base64
          mimeType: string;
        };
        text?: string;
      }[];
    };
    inputTranscription?: { text: string };
    outputTranscription?: { text: string };
    turnComplete?: boolean;
    interrupted?: boolean;
    generationComplete?: boolean;
  };
  toolCall?: unknown;
  toolCallCancellation?: unknown;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface GeminiLiveConfig {
  apiKey: string;
  model: string;
  systemInstruction: string;
  voiceName: string;
  /** Milliseconds of silence before the model responds */
  silenceDurationMs: number;
  /** Milliseconds of speech required before start-of-speech is committed */
  prefixPaddingMs: number;
}

// ---------------------------------------------------------------------------
// Template — filled out before starting a conversation
// ---------------------------------------------------------------------------

export interface ConversationTemplate {
  /** How the AI should behave (role, tone, personality) */
  aiBehavior: string;
  /** What the customer is looking for */
  customerWants: string;
  /** What the candidate / agent can offer */
  candidateOffers: string;
}
