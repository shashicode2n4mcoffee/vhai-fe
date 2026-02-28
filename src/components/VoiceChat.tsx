/**
 * VoiceChat – Main voice interview view.
 *
 * Side-by-side layout:
 *   Left  — AI animated orb visualizer
 *   Right — Candidate live webcam recording
 *
 * Shows: question counter, timer (MM:SS / 27:00), wrap-up indicator.
 * Auto-ends at 27 minutes; wrap-up at 26 so closing statement fits.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useVoiceChat } from "../hooks/useVoiceChat";
import { AudioVisualizer } from "./AudioVisualizer";
import { ConnectionStatus } from "./ConnectionStatus";
import { ProctoringBadge } from "./ProctoringBadge";
import { FlagsTimeline } from "./FlagsTimeline";
import { MalpracticeOverlay, type MalpracticeKind } from "./MalpracticeOverlay";
import { useProctoring } from "../proctoring/useProctoring";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { selectTemplate, selectGuardrails, selectInterviewId, selectSelectedTemplateNameForFullFlow, setInterviewResult, resetInterview } from "../store/interviewSlice";
import { saveTranscriptBackup, clearTranscriptBackup } from "../lib/transcriptBackup";
import { generateReport, computeScoring } from "../lib/report-generator";
import { saveFullFlowInterview } from "../lib/fullFlowStorage";
import { useUpdateInterviewMutation } from "../store/endpoints/interviews";

const MAX_DURATION_MS = 27 * 60 * 1000; // 27 minutes max; wrap-up at 26

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function VoiceChat() {
  const template = useAppSelector(selectTemplate);
  const guardrails = useAppSelector(selectGuardrails);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // Redirect if no template set (e.g. direct URL access)
  if (!template) {
    return <Navigate to="/interview/new" replace />;
  }

  const location = useLocation();
  return (
    <VoiceChatInner
      template={template}
      guardrails={guardrails}
      dispatch={dispatch}
      navigate={navigate}
      locationState={location.state}
    />
  );
}

// Inner component that always has a valid template (avoids hook-ordering issues with early return)
function VoiceChatInner({
  template,
  guardrails,
  dispatch,
  navigate,
  locationState,
}: {
  template: NonNullable<ReturnType<typeof selectTemplate>>;
  guardrails: ReturnType<typeof selectGuardrails>;
  dispatch: ReturnType<typeof useAppDispatch>;
  navigate: ReturnType<typeof useNavigate>;
  locationState?: unknown;
}) {
  const interviewId = useAppSelector(selectInterviewId);
  const templateNameForFullFlow = useAppSelector(selectSelectedTemplateNameForFullFlow);
  const [updateInterview] = useUpdateInterviewMutation();

  const startedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const interviewStartTs = useRef(Date.now());
  const [showTimeline, setShowTimeline] = useState(false);
  const autoEndTriggered = useRef(false);
  const handleEndRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const endingRef = useRef(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [fullscreenDeclined, setFullscreenDeclined] = useState(false);
  const [pendingMalpractice, setPendingMalpractice] = useState<MalpracticeKind | null>(null);
  const tabWasHiddenRef = useRef(false);
  const windowHadBlurRef = useRef(false);

  const [state, actions] = useVoiceChat(template, undefined, {
    onWrapUpComplete: () => {
      if (autoEndTriggered.current) return;
      autoEndTriggered.current = true;
      // Delay so React commits last turn to transcript and user hears end of wrap-up sentence
      setTimeout(() => void handleEndRef.current(), 1200);
    },
  }, guardrails ?? undefined);

  // ---- Proctoring (off-thread ML, does NOT affect audio) ----
  const proctoring = useProctoring({
    enabled: true,
    videoRef,
    interviewStartTs: interviewStartTs.current,
    fps: 3,
  });

  const requestFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (document.fullscreenElement) return true;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return !!document.fullscreenElement;
      }
    } catch {
      // User denied or not supported
    }
    return false;
  }, []);

  // Start the conversation only after consent AND fullscreen (required to prevent malpractice)
  const handleConsentAndStart = async () => {
    if (startedRef.current) return;
    const entered = await requestFullscreen();
    if (!entered) {
      setFullscreenDeclined(true);
      return;
    }
    setFullscreenDeclined(false);
    startedRef.current = true;
    clearTranscriptBackup();
    setConsentGiven(true);
    void actions.start();
  };

  // Malpractice detection: tab switch, window switch, fullscreen exit
  useEffect(() => {
    if (!consentGiven) return;

    const onVisibilityChange = () => {
      if (document.hidden) tabWasHiddenRef.current = true;
      else if (tabWasHiddenRef.current) {
        tabWasHiddenRef.current = false;
        setPendingMalpractice("tab_switch");
      }
    };
    const onBlur = () => { windowHadBlurRef.current = true; };
    const onFocus = () => {
      if (windowHadBlurRef.current) {
        windowHadBlurRef.current = false;
        setPendingMalpractice("window_switch");
      }
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setPendingMalpractice("fullscreen_exit");
      } else {
        setPendingMalpractice((prev) => (prev === "fullscreen_exit" ? null : prev));
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [consentGiven]);

  // Start proctoring once worker is ready and webcam is live
  useEffect(() => {
    if (proctoring.isReady && state.webcamStream && !proctoring.isRunning) {
      proctoring.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proctoring.isReady, state.webcamStream]);

  // Attach webcam stream to <video> element
  useEffect(() => {
    const el = videoRef.current;
    if (el && state.webcamStream) {
      el.srcObject = state.webcamStream;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [state.webcamStream]);

  // Auto-end at 27 minutes hard limit
  useEffect(() => {
    if (state.elapsedMs >= MAX_DURATION_MS && !autoEndTriggered.current) {
      autoEndTriggered.current = true;
      void handleEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.elapsedMs]);

  const handleEnd = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore if exit fails (e.g. not supported or already exited)
        }
      }
      const finalTranscript = [...state.transcript];
      if (state.pendingUserText.trim()) {
        finalTranscript.push({
          id: `user-final-${Date.now()}`,
          role: "user",
          text: state.pendingUserText.trim(),
          timestamp: Date.now(),
        });
      }
      if (state.pendingAssistantText.trim()) {
        finalTranscript.push({
          id: `assistant-final-${Date.now()}`,
          role: "assistant",
          text: state.pendingAssistantText.trim(),
          timestamp: Date.now(),
        });
      }

      saveTranscriptBackup({
        transcript: finalTranscript,
        pendingUserText: "",
        pendingAssistantText: "",
        template,
      });
      proctoring.stop();
      const videoBlob = await actions.stop();
      const videoUrl = videoBlob ? URL.createObjectURL(videoBlob) : null;

      dispatch(setInterviewResult({ transcript: finalTranscript, videoUrl }));

      const fromFullFlow = (locationState as { fromFullFlow?: boolean } | null)?.fromFullFlow === true;
      if (fromFullFlow) {
        try {
          const report = await generateReport(finalTranscript, template);
          const scoring = computeScoring(report);
          saveFullFlowInterview({
            transcript: finalTranscript,
            report,
            interviewId,
          });
          if (interviewId) {
            const first = finalTranscript[0];
            const last = finalTranscript[finalTranscript.length - 1];
            const durationSeconds =
              finalTranscript.length >= 2 && first && last
                ? Math.round((last.timestamp - first.timestamp) / 1000)
                : 0;
            await updateInterview({
              id: interviewId,
              data: {
                report,
                scoring,
                transcript: finalTranscript,
                duration: durationSeconds,
                overallScore: scoring.overallScore,
                recommendation: scoring.recommendation,
                status: "COMPLETED",
              },
            }).unwrap();
          }
        } catch (err) {
          const { logErrorToServer } = await import("../lib/logError");
          logErrorToServer(err instanceof Error ? err.message : String(err), {
            details: err instanceof Error ? err.stack : undefined,
            source: "voice_chat_full_flow_report",
          });
          saveFullFlowInterview({
            transcript: finalTranscript,
            report: null,
            interviewId,
          });
        }
        clearTranscriptBackup();
        if (videoUrl) URL.revokeObjectURL(videoUrl);
        dispatch(resetInterview());
        navigate("/coding", { state: { fromFullFlow: true, templateName: templateNameForFullFlow ?? undefined } });
      } else {
        navigate("/interview/report", { state: locationState });
      }
    } finally {
      endingRef.current = false;
    }
  };

  const handleTryAgain = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    try {
      await actions.stop();
      await actions.start();
    } finally {
      endingRef.current = false;
    }
  };

  handleEndRef.current = handleEnd;

  const isActive =
    state.connectionState === "connecting" ||
    state.connectionState === "connected";

  // ---- Consent screen (industry-standard) — must agree before interview starts ----
  if (!consentGiven) {
    return (
      <div className="voice-chat voice-chat--consent">
        <header className="voice-chat__header">
          <button type="button" className="voice-chat__title" onClick={() => navigate("/dashboard")} title="Home" style={{ border: "none", background: "none", padding: 0, cursor: "pointer", font: "inherit", color: "inherit" }}>
            VocalHireAI
          </button>
        </header>
        {fullscreenDeclined && (
          <div className="voice-chat__fullscreen-required">
            <span>Fullscreen is required to start. Switching tabs, windows, or using other screens may result in dismissal.</span>
            <button type="button" className="btn btn--primary" onClick={async () => { if (await requestFullscreen()) setFullscreenDeclined(false); }}>
              Enter fullscreen
            </button>
          </div>
        )}
        <div className="voice-chat__consent-card">
          <h2 className="voice-chat__consent-title">Interview consent</h2>
          <p className="voice-chat__consent-intro">
            Before we begin, please read and accept the following. By starting the interview, you confirm that you understand and agree to these terms.
          </p>
          <ul className="voice-chat__consent-list">
            <li><strong>Recording:</strong> This interview session will be recorded (audio and video). The recording may be shared with the hiring organization and used for evaluation and quality assurance.</li>
            <li><strong>AI evaluation:</strong> Your responses will be transcribed and evaluated using artificial intelligence. The AI-generated evaluation report may be shared with the hiring organization.</li>
            <li><strong>Data use:</strong> Your responses, transcript, and recording will be processed to produce an evaluation report. We do not store your video on our servers after you download it; transcript and report data may be retained as per the organization’s policy.</li>
            <li><strong>Proctoring:</strong> This session uses automated proctoring (e.g. face detection) to help ensure interview integrity. No biometric data is stored.</li>
            <li><strong>Conduct:</strong> You must take the interview in <strong>fullscreen</strong> on a <strong>single screen</strong>. Do not switch browser tabs, switch to other applications or windows, or use additional monitors. These actions are detected and recorded; repeated violations may result in <strong>dismissal of your interview</strong>.</li>
            <li><strong>Your consent:</strong> By clicking &quot;I agree and start interview&quot;, you confirm that you have read this notice, consent to being recorded, and agree to the use of AI and the above data practices and conduct rules.</li>
          </ul>
          <button type="button" className="btn btn--primary voice-chat__consent-btn" onClick={() => void handleConsentAndStart()}>
            I agree and start interview
          </button>
        </div>
      </div>
    );
  }

  // Timer color: green < 20min, amber < 26min (wrap-up), red >= 26min
  const timerClass =
    state.elapsedMs >= 26 * 60 * 1000
      ? "vc-timer--red"
      : state.elapsedMs >= 20 * 60 * 1000
        ? "vc-timer--amber"
        : "";

  return (
    <div className="voice-chat voice-chat--split">
      {/* Malpractice overlay: tab switch, window switch, or fullscreen exit */}
      {pendingMalpractice && (
        <MalpracticeOverlay
          kind={pendingMalpractice}
          onAcknowledge={() => {
            if (pendingMalpractice === "fullscreen_exit" && !document.fullscreenElement) return;
            setPendingMalpractice(null);
          }}
          onRequestFullscreen={requestFullscreen}
          isFullscreen={!!document.fullscreenElement}
        />
      )}
      {/* ---- Header with Stats ---- */}
      <header className="voice-chat__header">
        <button type="button" className="voice-chat__title" onClick={() => navigate("/dashboard")} title="Home" style={{ border: "none", background: "none", padding: 0, cursor: "pointer", font: "inherit", color: "inherit" }}>
          VocalHireAI
        </button>

        <div className="vc-stats">
          {/* Question Counter */}
          <div className="vc-stat">
            <span className="vc-stat__label">Questions</span>
            <span className="vc-stat__value">
              {state.questionCount} / 15
            </span>
          </div>

          {/* Timer */}
          <div className={`vc-stat ${timerClass}`}>
            <span className="vc-stat__label">Time</span>
            <span className="vc-stat__value">
              {formatTime(state.elapsedMs)} / 27:00
            </span>
          </div>

          {/* Wrapping Up Indicator */}
          {state.isWrappingUp && (
            <div className="vc-stat vc-stat--wrapup">
              <span className="vc-stat__value">Wrapping Up...</span>
            </div>
          )}
        </div>

        <ConnectionStatus
          connectionState={state.connectionState}
          chatPhase={state.chatPhase}
        />
      </header>

      {/* ---- Split View: AI Visualizer | Candidate Video ---- */}
      <div className="voice-chat__split-panels">
        {/* Left — AI Orb */}
        <div className="voice-chat__ai-panel">
          <div className="voice-chat__ai-label">AI Interviewer</div>
          <AudioVisualizer
            chatPhase={state.chatPhase}
            vadState={state.vadState}
          />
        </div>

        {/* Right — Candidate Video */}
        <div className="voice-chat__video-panel">
          <div className="voice-chat__video-label">You</div>
          <video
            ref={videoRef}
            className="voice-chat__video"
            autoPlay
            playsInline
            muted
          />
          {isActive && (
            <div className="voice-chat__rec-badge">
              <span className="voice-chat__rec-dot" />
              REC
            </div>
          )}

          {/* Proctoring badge overlay */}
          <div className="proctor-overlay" onClick={() => setShowTimeline((p) => !p)}>
            <ProctoringBadge
              riskScore={proctoring.riskScore}
              riskLevel={proctoring.riskLevel}
              metrics={proctoring.metrics}
              isRunning={proctoring.isRunning}
              isReady={proctoring.isReady}
              error={proctoring.error}
              compact
              micLevel={state.vadState.smoothedEnergy}
            />
          </div>

          {/* Proctoring timeline (toggleable) */}
          {showTimeline && (
            <div className="proctor-sidebar">
              <FlagsTimeline flags={proctoring.flags} maxVisible={20} />
            </div>
          )}
        </div>
      </div>

      {/* ---- Live Captions ---- */}
      <div className="voice-chat__captions">
        {state.pendingAssistantText.trim() && (
          <p className="caption caption--ai">
            <span className="caption__role">AI Interviewer</span>
            {state.pendingAssistantText}
          </p>
        )}
        {state.pendingUserText.trim() && (
          <p className="caption caption--user">
            <span className="caption__role">You</span>
            {state.pendingUserText}
          </p>
        )}
      </div>

      {/* ---- Error banner + reconnect when connection failed ---- */}
      {state.error && (
        <div className="voice-chat__error">
          <p>{state.error}</p>
          {state.connectionState === "error" && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => void handleTryAgain()}
              style={{ marginTop: "0.5rem" }}
            >
              Try again
            </button>
          )}
        </div>
      )}

      {/* ---- Controls ---- */}
      <div className="voice-chat__controls">
        {isActive ? (
          <button className="btn btn--stop" onClick={() => void handleEnd()}>
            <StopIcon />
            <span>End Interview</span>
          </button>
        ) : (
          <button className="btn btn--start" onClick={() => void handleEnd()}>
            <ReportIcon />
            <span>View Report</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Inline SVG icons -----------------------------------------------------

function StopIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <rect x="4" y="4" width="16" height="16" rx="3" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}
