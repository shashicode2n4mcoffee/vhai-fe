/**
 * ProfessionalInterviewSession — LiveKit video room + Gemini Live voice interview.
 * Receives token, url, roomName from location.state (from ProfessionalConsentPage).
 * Template is taken from Redux (set by TemplateForm professional variant).
 */

import { useCallback, useEffect, useRef } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { LiveKitRoom, RoomAudioRenderer, TrackLoop, useTracks, ParticipantTile } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useVoiceChat } from "../hooks/useVoiceChat";
import { ConnectionStatus } from "./ConnectionStatus";
import { setInterviewResult } from "../store/interviewSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { selectTemplate, selectGuardrails } from "../store/interviewSlice";
import { saveTranscriptBackup } from "../lib/transcriptBackup";

const MAX_DURATION_MS = 15 * 60 * 1000;

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

interface SessionState {
  token: string;
  url: string;
  roomName: string;
}

function ProfessionalSessionInner() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const template = useAppSelector(selectTemplate);
  const guardrails = useAppSelector(selectGuardrails);
  const cameraTracks = useTracks([Track.Source.Camera]);
  const startedRef = useRef(false);

  const [state, actions] = useVoiceChat(
    template ?? undefined,
    undefined,
    {
      onWrapUpComplete: () => {
        if (!autoEndTriggered.current) {
          autoEndTriggered.current = true;
          setTimeout(() => void handleEndRef.current(), 1200);
        }
      },
    },
    guardrails ?? null,
  );

  const autoEndTriggered = useRef(false);
  const handleEndRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // Auto-start Gemini voice when mounted (consent already given on previous page)
  useEffect(() => {
    if (!template || startedRef.current) return;
    startedRef.current = true;
    void actions.start();
  }, [template, actions]);

  const handleEnd = useCallback(async () => {
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
      template: template!,
    });
    const videoBlob = await actions.stop();
    const videoUrl = videoBlob ? URL.createObjectURL(videoBlob) : null;
    dispatch(setInterviewResult({ transcript: finalTranscript, videoUrl }));
    navigate("/interview/report");
  }, [template, state.transcript, state.pendingUserText, state.pendingAssistantText, actions, dispatch, navigate]);

  handleEndRef.current = handleEnd;

  useEffect(() => {
    if (state.elapsedMs >= MAX_DURATION_MS && !autoEndTriggered.current) {
      autoEndTriggered.current = true;
      void handleEnd();
    }
  }, [state.elapsedMs, handleEnd]);

  const isActive =
    state.connectionState === "connecting" || state.connectionState === "connected";

  if (!template) {
    return <Navigate to="/interview/professional/new" replace />;
  }

  return (
    <div className="pro-session">
      <RoomAudioRenderer />
      <div className="pro-session__layout">
        <div className="pro-session__video">
          <TrackLoop tracks={cameraTracks}>
            <ParticipantTile />
          </TrackLoop>
        </div>
        <div className="pro-session__voice">
          <div className="pro-session__voice-header">
            <ConnectionStatus connectionState={state.connectionState} chatPhase={state.chatPhase} />
            <span className="pro-session__timer">{formatTime(state.elapsedMs)}</span>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => void handleEnd()}>
              End Interview
            </button>
          </div>
          {state.error && <p className="pro-session__error">{state.error}</p>}
          <div className="pro-session__transcript">
            {state.transcript.map((e) => (
              <div key={e.id} className={`pro-session__line pro-session__line--${e.role}`}>
                <strong>{e.role === "user" ? "You" : "AI"}:</strong> {e.text}
              </div>
            ))}
            {state.pendingUserText && (
              <div className="pro-session__line pro-session__line--user pro-session__line--pending">
                <strong>You:</strong> {state.pendingUserText}
              </div>
            )}
            {state.pendingAssistantText && (
              <div className="pro-session__line pro-session__line--assistant pro-session__line--pending">
                <strong>AI:</strong> {state.pendingAssistantText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Wrapper that uses local participant to get MediaStream and pass to voice chat (optional future: pass stream to useVoiceChat). */
function RoomContent() {
  return <ProfessionalSessionInner />;
}

export function ProfessionalInterviewSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionState = location.state as SessionState | null;

  useEffect(() => {
    if (!sessionState?.token || !sessionState?.url) {
      navigate("/interview/professional", { replace: true });
    }
  }, [sessionState, navigate]);

  if (!sessionState?.token || !sessionState?.url) {
    return (
      <div className="pro-session">
        <p>Missing session. Redirecting…</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={sessionState.url}
      token={sessionState.token}
      connect={true}
      audio={true}
      video={true}
      onDisconnected={() => {}}
      onError={(err) => console.error("[LiveKit]", err)}
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      <RoomContent />
    </LiveKitRoom>
  );
}
