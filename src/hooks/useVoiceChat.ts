/**
 * useVoiceChat – Central orchestrating hook
 *
 * Wires together:
 *   GeminiWebSocketClient  (live API)
 *   AudioCaptureManager    (mic → Gemini input)
 *   VideoRecorder           (webcam video + mic audio + AI audio → recording)
 *   VADAnalyzer             (client-side energy VAD for UI)
 *
 * Interview constraints:
 *   - No question limit (for testing; was 15 in production)
 *   - Maximum 15 minutes
 *   - 3 minutes before timeout → AI wraps up
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatPhase,
  ConnectionState,
  ConversationTemplate,
  GeminiLiveConfig,
  TranscriptEntry,
} from "../types/gemini";
import type { OrgGuardrails } from "../store/interviewSlice";
import { GeminiWebSocketClient } from "../lib/gemini-websocket";
import { AudioCaptureManager } from "../lib/audio-capture";
import { VideoRecorder } from "../lib/video-recorder";
import { VADAnalyzer, type VADState } from "../lib/vad-analyzer";
import { getGeminiConfig } from "../lib/gemini-key";
import { useLogErrorMutation } from "../store/endpoints/errors";
import { clearTranscriptBackup, saveTranscriptBackup } from "../lib/transcriptBackup";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DURATION_MS = 15 * 60 * 1000;          // 15 minutes
const WRAP_UP_BEFORE_MS = 3 * 60 * 1000;         // 3 minutes before timeout
const WRAP_UP_THRESHOLD_MS = MAX_DURATION_MS - WRAP_UP_BEFORE_MS; // 27 minutes
/** If no audio and no turnComplete for this long while AI is "responding", commit pending and set listening (Section 9.2) */
const TURN_COMPLETE_TIMEOUT_MS = 15_000;
/** After sending wrap-up signal, if onWrapUpComplete hasn't fired by this time, fire it anyway (guarantee auto-end) */
const WRAP_UP_FALLBACK_MS = 40_000;

// ---------------------------------------------------------------------------
// Hook return type
// ---------------------------------------------------------------------------

export interface VoiceChatState {
  connectionState: ConnectionState;
  chatPhase: ChatPhase;
  transcript: TranscriptEntry[];
  vadState: VADState;
  error: string | null;
  pendingUserText: string;
  pendingAssistantText: string;
  /** Live webcam MediaStream for the video preview element */
  webcamStream: MediaStream | null;
  /** Number of AI questions asked so far */
  questionCount: number;
  /** Elapsed time in milliseconds since interview started */
  elapsedMs: number;
  /** Whether the AI is in the wrap-up phase */
  isWrappingUp: boolean;
}

export interface VoiceChatActions {
  /** Connect to Gemini, start mic + webcam + recording */
  start: () => Promise<void>;
  /** Stop everything and return the recorded video Blob (or null) */
  stop: () => Promise<Blob | null>;
}

/** Optional callbacks for the voice chat session */
export interface VoiceChatOptions {
  /** Called once when the AI has finished the wrap-up statement (after INTERVIEW_WRAP_UP_SIGNAL). Use to auto-end and navigate to report. */
  onWrapUpComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Config defaults — API key is fetched from backend
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: GeminiLiveConfig = {
  apiKey: "", // Will be fetched from backend
  model: "gemini-2.5-flash-native-audio-preview-12-2025",
  systemInstruction: "",
  voiceName: "Aoede",
  silenceDurationMs: 1000, // Wait 1s of silence before AI responds (lets user finish fully; only then AI asks)
  prefixPaddingMs: 120,    // Capture start of user speech without cutting off first syllables
};

// ---------------------------------------------------------------------------
// Build do-not-ask / EEO compliance block from org guardrails
// ---------------------------------------------------------------------------

function buildDoNotAskBlock(guardrails: OrgGuardrails | null | undefined): string {
  if (!guardrails) return "";
  const topics =
    Array.isArray(guardrails.doNotAskTopics) && guardrails.doNotAskTopics.length > 0
      ? guardrails.doNotAskTopics
      : [];
  if (topics.length === 0) return "";
  const list = topics.map((t) => `- ${t}`).join("\n");
  return [
    "",
    "═══════════════════════════════════════",
    "COMPLIANCE — DO NOT ASK (STRICT)",
    "═══════════════════════════════════════",
    "You MUST NOT ask the candidate about, or make assumptions based on, any of the following topics. If the candidate volunteers such information, acknowledge briefly and steer the conversation back to job-related questions only.",
    list,
    "Do not ask follow-up questions about these topics. Keep the interview strictly job- and competency-based.",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Build system instruction from template — NEW 3-section format + guardrails
// ---------------------------------------------------------------------------

function buildSystemInstruction(
  template?: ConversationTemplate,
  guardrails?: OrgGuardrails | null,
): string {
  if (!template) {
    return "You are a helpful, friendly, and concise AI voice assistant. Speak only in English. Keep responses short and conversational. Respond naturally as in a voice conversation.";
  }
  const doNotAsk = buildDoNotAskBlock(guardrails ?? null);
  return [
    "You are an AI interviewer conducting a real-time voice interview. Your name is Christie. Follow ALL rules below STRICTLY.",
    "",
    "LANGUAGE AND TRANSCRIPT (STRICT): The transcript must ALWAYS be in English only. You MUST speak only in English — every word you say must be in English. Never use another language in your speech or in the transcript. If the candidate speaks in another language, acknowledge in English (e.g. 'Thanks for that — in English please, so we can keep the transcript consistent') and continue the interview in English. The official transcript language for this session is English only.",
    "",
    "FILLERS: As the interviewer, use brief verbal fillers from your point of view while you process their answer or think of the next question (e.g. 'Give me a moment...', 'I see...', 'Right...', 'Okay...', 'Interesting...', 'Noted...', 'One second...'). Keep fillers short, then give your full response or next question.",
    doNotAsk,
    "═══════════════════════════════════════",
    "SECTION 1 — YOUR BEHAVIOR (FOLLOW STRICTLY)",
    "═══════════════════════════════════════",
    template.aiBehavior,
    "",
    "═══════════════════════════════════════",
    "SECTION 2 — JOB DESCRIPTION (REFERENCE FOR QUESTIONS)",
    "═══════════════════════════════════════",
    template.customerWants,
    "",
    "═══════════════════════════════════════",
    "SECTION 3 — CANDIDATE RESUME (REFERENCE FOR QUESTIONS)",
    "═══════════════════════════════════════",
    template.candidateOffers,
    "",
    "═══════════════════════════════════════",
    "INTERVIEW RULES (MANDATORY)",
    "═══════════════════════════════════════",
    "1. You MUST strictly follow Section 1 for your behavior, tone, and approach.",
    "2. Use Section 2 (JD) and Section 3 (Resume) together to ask relevant, personalized questions.",
    "3. Ask questions one at a time. Wait for the candidate to finish before asking the next.",
    "4. There is NO maximum number of questions. Do NOT stop at 15 questions. Continue asking relevant questions for the full 15-minute duration. Keep asking until you receive the wrap-up signal or time runs out.",
    "5. Maximum interview duration is 15 minutes.",
    "6. Ask a mix of technical, situational, and behavioral questions based on the JD and resume.",
    "7. Probe deeper with follow-up questions when the candidate gives shallow answers.",
    "8. Keep your responses short and conversational — this is a real-time voice interview.",
    "9. Start by briefly introducing yourself as Christie and the role, then begin with the first question.",
    "10. WAIT for the candidate to finish their full answer before you respond. Do not interrupt or jump in during brief pauses. Only speak after they have clearly stopped (about 1 second of silence). If they are silent for a long moment, then you may ask or prompt.",
    "11. Conduct the entire interview in English only. All speech and transcript must be in English only — no exceptions.",
    "12. Do NOT limit yourself to 15 questions. Ask as many relevant questions as fit within the 15-minute session.",
    "",
    "IMPORTANT: When you receive a message saying 'INTERVIEW_WRAP_UP_SIGNAL', you MUST:",
    "- Thank the candidate warmly for their time.",
    "- Say: 'This concludes our interview. You can view your detailed report shortly and download the video recording of this session. For your privacy, we do not save your video on our servers.'",
    "- End the conversation naturally after this closing statement.",
    "- Do NOT ask any more questions after this signal.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVoiceChat(
  template?: ConversationTemplate,
  configOverrides?: Partial<GeminiLiveConfig>,
  options?: VoiceChatOptions,
  guardrails?: OrgGuardrails | null,
): [VoiceChatState, VoiceChatActions] {
  const config: GeminiLiveConfig = {
    ...DEFAULT_CONFIG,
    ...configOverrides,
    systemInstruction: buildSystemInstruction(template, guardrails ?? null),
  };

  // ---- React state --------------------------------------------------------
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [chatPhase, setChatPhase] = useState<ChatPhase>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [vadState, setVadState] = useState<VADState>({
    isSpeaking: false,
    energy: 0,
    smoothedEnergy: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [pendingUserText, setPendingUserText] = useState("");
  const [pendingAssistantText, setPendingAssistantText] = useState("");
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isWrappingUp, setIsWrappingUp] = useState(false);

  const [logErrorMutation] = useLogErrorMutation();

  // ---- Refs ---------------------------------------------------------------
  const wsClientRef = useRef<GeminiWebSocketClient | null>(null);
  const captureRef = useRef<AudioCaptureManager | null>(null);
  const recorderRef = useRef<VideoRecorder | null>(null);
  const vadRef = useRef<VADAnalyzer>(new VADAnalyzer());
  const pendingUserRef = useRef("");
  const pendingAssistantRef = useRef("");
  const questionCountRef = useRef(0);
  const wrapUpSentRef = useRef(false);
  const wrapUpCompleteFiredRef = useRef(false);
  const wrapUpFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const interviewStartRef = useRef(0);
  /** Throttle VAD/phase updates to reduce React lag from high-frequency audio callbacks */
  const lastVadUpdateRef = useRef(0);
  const VAD_THROTTLE_MS = 100;
  /** Idempotent stop: second call reuses the in-flight promise */
  const stopPromiseRef = useRef<Promise<Blob | null> | null>(null);
  /** Last time we got AI audio or turnComplete; used for turnComplete timeout */
  const lastAiActivityRef = useRef(0);
  /** Ref to commit-turn logic so timeout and onTurnComplete can share it */
  const commitTurnRef = useRef<() => void>(() => {});
  /** Throttle transcript backup to localStorage (every 2s) */
  const lastBackupRef = useRef(0);
  const BACKUP_THROTTLE_MS = 2000;

  // ---- Transcript helpers -------------------------------------------------
  const commitTranscript = useCallback(
    (role: "user" | "assistant", text: string) => {
      if (!text.trim()) return;
      setTranscript((prev) => [
        ...prev,
        {
          id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role,
          text: text.trim(),
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

  // ---- Send wrap-up signal to AI ------------------------------------------
  const sendWrapUpSignal = useCallback(() => {
    if (wrapUpSentRef.current) return;
    wrapUpSentRef.current = true;
    setIsWrappingUp(true);
    const ws = wsClientRef.current;
    if (ws) {
      ws.sendText("INTERVIEW_WRAP_UP_SIGNAL");
    }
    // Guarantee programmatic end: if turnComplete never fires, still end after WRAP_UP_FALLBACK_MS
    if (wrapUpFallbackTimerRef.current) clearTimeout(wrapUpFallbackTimerRef.current);
    wrapUpFallbackTimerRef.current = setTimeout(() => {
      wrapUpFallbackTimerRef.current = null;
      if (wrapUpCompleteFiredRef.current) return;
      wrapUpCompleteFiredRef.current = true;
      optionsRef.current?.onWrapUpComplete?.();
    }, WRAP_UP_FALLBACK_MS);
  }, []);

  // ---- Check limits after each AI turn ------------------------------------
  const checkLimits = useCallback(() => {
    const elapsed = Date.now() - interviewStartRef.current;

    // After 27 minutes (time only) → wrap up (question count not used for testing)
    if (elapsed >= WRAP_UP_THRESHOLD_MS && !wrapUpSentRef.current) {
      sendWrapUpSignal();
    }
  }, [sendWrapUpSignal]);

  // ---- Commit turn (shared by onTurnComplete and turnComplete timeout) ----
  const doCommitTurn = useCallback(() => {
    if (pendingUserRef.current.trim()) {
      commitTranscript("user", pendingUserRef.current);
      pendingUserRef.current = "";
      setPendingUserText("");
    }
    if (pendingAssistantRef.current.trim()) {
      const assistantText = pendingAssistantRef.current.trim();
      commitTranscript("assistant", assistantText);
      pendingAssistantRef.current = "";
      setPendingAssistantText("");
      if (assistantText.includes("?") && !wrapUpSentRef.current) {
        questionCountRef.current += 1;
        setQuestionCount(questionCountRef.current);
      }
    }
    setChatPhase("listening");
    checkLimits();
    if (wrapUpSentRef.current && !wrapUpCompleteFiredRef.current) {
      wrapUpCompleteFiredRef.current = true;
      if (wrapUpFallbackTimerRef.current) {
        clearTimeout(wrapUpFallbackTimerRef.current);
        wrapUpFallbackTimerRef.current = null;
      }
      options?.onWrapUpComplete?.();
    }
  }, [commitTranscript, checkLimits, options]);

  useEffect(() => {
    commitTurnRef.current = doCommitTurn;
  }, [doCommitTurn]);

  // ---- Timer effect (survives StrictMode remounts) -------------------------
  useEffect(() => {
    // Only run timer when connected
    if (connectionState !== "connected" && connectionState !== "connecting") return;
    // Make sure start time is set
    if (interviewStartRef.current === 0) return;

    const id = setInterval(() => {
      const elapsed = Date.now() - interviewStartRef.current;
      setElapsedMs(elapsed);

      // Auto wrap-up at 27 minutes
      if (elapsed >= WRAP_UP_THRESHOLD_MS && !wrapUpSentRef.current) {
        sendWrapUpSignal();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [connectionState, sendWrapUpSignal]);

  // ---- turnComplete timeout: if AI never sends turnComplete, commit pending after N s (Section 9.2) ----
  useEffect(() => {
    if (connectionState !== "connected" || chatPhase !== "ai-responding") return;
    const id = setInterval(() => {
      const elapsed = Date.now() - lastAiActivityRef.current;
      if (elapsed >= TURN_COMPLETE_TIMEOUT_MS) {
        commitTurnRef.current();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [connectionState, chatPhase]);

  // ---- START --------------------------------------------------------------
  const start = useCallback(async () => {
    clearTranscriptBackup();
    setError(null);
    interviewStartRef.current = Date.now();
    questionCountRef.current = 0;
    wrapUpSentRef.current = false;
    wrapUpCompleteFiredRef.current = false;
    if (wrapUpFallbackTimerRef.current) {
      clearTimeout(wrapUpFallbackTimerRef.current);
      wrapUpFallbackTimerRef.current = null;
    }
    setQuestionCount(0);
    setElapsedMs(0);
    setIsWrappingUp(false);

    try {
      // Fetch Gemini API key from backend
      const geminiConfig = await getGeminiConfig();
      config.apiKey = geminiConfig.apiKey;
      config.model = geminiConfig.model;
      // 1. Start video recorder (webcam + mic for recording + AI audio playback)
      const recorder = new VideoRecorder();
      const camStream = await recorder.start();
      recorderRef.current = recorder;
      setWebcamStream(camStream);

      // 2. Create Gemini WebSocket client
      const wsClient = new GeminiWebSocketClient(config, {
        onConnectionStateChange: (state) => {
          setConnectionState(state);
          if (state === "connected") setChatPhase("listening");
          if (state === "disconnected" || state === "error")
            setChatPhase("idle");
        },

        onSetupComplete: () => {
          void startCapture();
          wsClient.sendText(
            "Begin the interview now. Introduce yourself as Christie, briefly mention the role, then ask the first question.",
          );
          lastAiActivityRef.current = Date.now();
          setChatPhase("ai-responding");
        },
        onResumed: () => {
          // Session reconnected after ~10 min; do not re-send intro. Capture still running.
          setChatPhase("listening");
        },

        onAudioData: (base64Audio) => {
          lastAiActivityRef.current = Date.now();
          setChatPhase("ai-responding");
          // Play through VideoRecorder (speakers + recording)
          recorder.playAiChunk(base64Audio);
        },

        onInputTranscription: (text) => {
          pendingUserRef.current += text;
          setPendingUserText(pendingUserRef.current);
        },

        onOutputTranscription: (text) => {
          pendingAssistantRef.current += text;
          setPendingAssistantText(pendingAssistantRef.current);
        },

        onInterrupted: () => {
          recorder.stopPlayback();
          setChatPhase("user-speaking");
          if (pendingAssistantRef.current.trim()) {
            commitTranscript("assistant", pendingAssistantRef.current);
            pendingAssistantRef.current = "";
            setPendingAssistantText("");
          }
        },

        onTurnComplete: () => {
          commitTurnRef.current();
        },

        onError: (err) => {
          setError(err.message);
          console.error("[VoiceChat] Error:", err);
          void logErrorMutation({
            message: err.message,
            details: err instanceof Error ? err.stack : undefined,
            source: "voice_chat",
          });
        },
      });

      wsClientRef.current = wsClient;
      wsClient.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      console.error("[VoiceChat] Start failed:", err);
      void logErrorMutation({
        message: msg,
        details: err instanceof Error ? err.stack : undefined,
        source: "voice_chat",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.apiKey, config.model]);

  // ---- Start mic capture (sends audio to Gemini) --------------------------
  const startCapture = useCallback(async () => {
    const wsClient = wsClientRef.current;
    if (!wsClient) return;

    const capture = new AudioCaptureManager({
      onAudioChunk: (base64Pcm) => {
        wsClient.sendAudio(base64Pcm);
      },
      onEnergyLevel: (rms) => {
        const state = vadRef.current.update(rms);
        const now = Date.now();
        if (now - lastVadUpdateRef.current < VAD_THROTTLE_MS) return;
        lastVadUpdateRef.current = now;
        setVadState(state);
        if (state.isSpeaking) {
          setChatPhase((prev) =>
            prev === "ai-responding" ? prev : "user-speaking",
          );
        } else {
          setChatPhase((prev) =>
            prev === "user-speaking" ? "listening" : prev,
          );
        }
      },
    });

    await capture.start();
    captureRef.current = capture;
  }, []);

  // ---- STOP (async — waits for recording to finalise; idempotent) ---------
  const stop = useCallback(async (): Promise<Blob | null> => {
    if (stopPromiseRef.current != null) return stopPromiseRef.current;
    const p = (async (): Promise<Blob | null> => {
      captureRef.current?.stop();
      captureRef.current = null;
      wsClientRef.current?.disconnect();
      wsClientRef.current = null;
      let videoBlob: Blob | null = null;
      if (recorderRef.current) {
        videoBlob = await recorderRef.current.stop();
        recorderRef.current = null;
      }
      vadRef.current.reset();
      setConnectionState("disconnected");
      setChatPhase("idle");
      setVadState({ isSpeaking: false, energy: 0, smoothedEnergy: 0 });
      setPendingUserText("");
      setPendingAssistantText("");
      setWebcamStream(null);
      return videoBlob;
    })();
    stopPromiseRef.current = p;
    try {
      return await p;
    } finally {
      stopPromiseRef.current = null;
    }
  }, []);

  // ---- Persist transcript to localStorage (throttled) for recovery -------
  useEffect(() => {
    if (!template || connectionState !== "connected") return;
    const now = Date.now();
    if (now - lastBackupRef.current < BACKUP_THROTTLE_MS) return;
    lastBackupRef.current = now;
    saveTranscriptBackup({
      transcript,
      pendingUserText,
      pendingAssistantText,
      template,
    });
  }, [template, connectionState, transcript, pendingUserText, pendingAssistantText]);

  // ---- Cleanup on unmount -------------------------------------------------
  useEffect(() => {
    return () => {
      if (wrapUpFallbackTimerRef.current) {
        clearTimeout(wrapUpFallbackTimerRef.current);
        wrapUpFallbackTimerRef.current = null;
      }
      captureRef.current?.stop();
      wsClientRef.current?.disconnect();
      void recorderRef.current?.stop();
    };
  }, []);

  return [
    {
      connectionState,
      chatPhase,
      transcript,
      vadState,
      error,
      pendingUserText,
      pendingAssistantText,
      webcamStream,
      questionCount,
      elapsedMs,
      isWrappingUp,
    },
    { start, stop },
  ];
}
