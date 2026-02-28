/**
 * ProfessionalInterviewSession — LiveKit video room + Gemini Live voice interview.
 * Receives token, url, roomName, dataSaver from location.state (from ProfessionalConsentPage).
 * Template is taken from Redux (set by TemplateForm professional variant).
 * Features: connection quality indicator, reconnection overlay, optional data saver (lower video).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  TrackLoop,
  useTracks,
  useParticipants,
  ParticipantTile,
  useConnectionState,
  useEnsureRoom,
} from "@livekit/components-react";
import { Track, ConnectionState, ConnectionQuality, ParticipantEvent, VideoPresets } from "livekit-client";
import type { NetworkQuality } from "../store/interviewSlice";
import { useVoiceChat } from "../hooks/useVoiceChat";
import { ConnectionStatus } from "./ConnectionStatus";
import { setInterviewResult } from "../store/interviewSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { selectTemplate, selectGuardrails } from "../store/interviewSlice";
import { saveTranscriptBackup } from "../lib/transcriptBackup";
import { useGetSettingsQuery } from "../store/endpoints/settings";
import { useReportLiveKitQualityMutation } from "../store/endpoints/livekit";

const MAX_DURATION_MS = 27 * 60 * 1000; // 27 min max; wrap-up at 26

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function connectionQualityToNetworkQuality(q: ConnectionQuality): NetworkQuality {
  switch (q) {
    case ConnectionQuality.Excellent:
    case ConnectionQuality.Good:
      return "stable";
    case ConnectionQuality.Poor:
      return "moderate";
    case ConnectionQuality.Lost:
    case ConnectionQuality.Unknown:
    default:
      return "poor";
  }
}

/** Worst quality has highest rank for display (poor > moderate > stable) */
function worstQuality(a: NetworkQuality, b: NetworkQuality): NetworkQuality {
  if (a === "poor" || b === "poor") return "poor";
  if (a === "moderate" || b === "moderate") return "moderate";
  return "stable";
}

interface SessionState {
  token: string;
  url: string;
  roomName: string;
  dataSaver?: boolean;
  /** When true, backend dispatched a LiveKit agent to the room; do not start Gemini. */
  agentDispatched?: boolean;
}

function ProfessionalSessionInner({ agentDispatched: agentDispatchedFromState }: { agentDispatched?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const room = useEnsureRoom();
  const lkConnectionState = useConnectionState();
  const template = useAppSelector(selectTemplate);
  const guardrails = useAppSelector(selectGuardrails);
  const { data: settings } = useGetSettingsQuery();
  const [reportQuality] = useReportLiveKitQualityMutation();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const participants = useParticipants();
  const remoteParticipants = participants.filter((p) => p.identity !== room.localParticipant.identity);
  const startedRef = useRef(false);
  /** Use backend's decision (agent dispatched to this room); fallback to settings so we never start Gemini when agent is in the room. */
  const useLiveKitAgent = agentDispatchedFromState === true || settings?.livekitAgentEnabled === true;
  const [connectionQualityLabel, setConnectionQualityLabel] = useState<NetworkQuality>("stable");
  const worstQualityRef = useRef<NetworkQuality>("stable");
  const [reconnectMessage, setReconnectMessage] = useState<"reconnecting" | "back-online" | null>(null);
  const reconnectMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastQualityReportRef = useRef(0);
  const QUALITY_REPORT_THROTTLE_MS = 10_000;
  const [screenShareOn, setScreenShareOn] = useState(false);
  const screenShareInProgressRef = useRef(false);
  const autoEndTriggered = useRef(false);
  const handleEndRef = useRef<() => Promise<void>>(() => Promise.resolve());

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

  // Track worst LiveKit connection quality for report
  useEffect(() => {
    const local = room.localParticipant;
    const update = (q: ConnectionQuality) => {
      const nq = connectionQualityToNetworkQuality(q);
      worstQualityRef.current = worstQuality(worstQualityRef.current, nq);
      setConnectionQualityLabel(nq);
    };
    update(local.connectionQuality);
    local.on(ParticipantEvent.ConnectionQualityChanged, update);
    return () => {
      local.off(ParticipantEvent.ConnectionQualityChanged, update);
    };
  }, [room]);

  // P2 Analytics: send quality samples when livekitAnalyticsEnabled
  useEffect(() => {
    if (!settings?.livekitAnalyticsEnabled) return;
    const now = Date.now();
    if (now - lastQualityReportRef.current < QUALITY_REPORT_THROTTLE_MS) return;
    lastQualityReportRef.current = now;
    reportQuality({ quality: connectionQualityLabel, roomName: room.name }).catch(() => {});
  }, [connectionQualityLabel, room.name, settings?.livekitAnalyticsEnabled, reportQuality]);

  // P2 Data channel: send transcript snapshot when livekitDataChannelEnabled (throttled)
  const dataChannelThrottleRef = useRef(0);
  useEffect(() => {
    if (!settings?.livekitDataChannelEnabled || !state.transcript?.length) return;
    const now = Date.now();
    if (now - dataChannelThrottleRef.current < 5000) return;
    dataChannelThrottleRef.current = now;
    const payload = JSON.stringify({
      type: "transcript",
      count: state.transcript.length,
      last: state.transcript.slice(-3),
    });
    room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true }).catch(() => {});
  }, [settings?.livekitDataChannelEnabled, state.transcript, room.localParticipant]);

  // Reconnection UI: show "Reconnecting…" / "Back online"
  const prevLkStateRef = useRef(lkConnectionState);
  useEffect(() => {
    const wasReconnecting =
      prevLkStateRef.current === ConnectionState.Reconnecting ||
      prevLkStateRef.current === ConnectionState.SignalReconnecting;
    const isReconnecting =
      lkConnectionState === ConnectionState.Reconnecting ||
      lkConnectionState === ConnectionState.SignalReconnecting;

    if (isReconnecting) {
      setReconnectMessage("reconnecting");
    } else if (lkConnectionState === ConnectionState.Connected) {
      if (wasReconnecting) {
        setReconnectMessage("back-online");
        if (reconnectMessageTimeoutRef.current) clearTimeout(reconnectMessageTimeoutRef.current);
        reconnectMessageTimeoutRef.current = setTimeout(() => setReconnectMessage(null), 3000);
      } else {
        setReconnectMessage(null);
      }
    } else {
      setReconnectMessage(null);
    }
    prevLkStateRef.current = lkConnectionState;
    return () => {
      if (reconnectMessageTimeoutRef.current) {
        clearTimeout(reconnectMessageTimeoutRef.current);
        reconnectMessageTimeoutRef.current = null;
      }
    };
  }, [lkConnectionState]);

  // Auto-start Gemini voice when mounted (consent already given on previous page).
  // When LiveKit agent was dispatched to this room (or setting is on), the agent speaks—do not start Gemini.
  useEffect(() => {
    if (!template || startedRef.current) return;
    if (useLiveKitAgent) return; // LiveKit agent is in the room; no Gemini voice
    // When token didn't include agentDispatched, wait for settings so we don't start Gemini before we know
    if (agentDispatchedFromState === undefined && settings === undefined) return;
    startedRef.current = true;
    void actions.start();
  }, [template, actions, useLiveKitAgent, agentDispatchedFromState, settings]);

  const handleEnd = useCallback(async () => {
    const finalTranscript = useLiveKitAgent ? [] : [...state.transcript];
    if (!useLiveKitAgent) {
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
    }
    const videoBlob = useLiveKitAgent ? null : await actions.stop();
    const videoUrl = videoBlob ? URL.createObjectURL(videoBlob) : null;
    dispatch(
      setInterviewResult({
        transcript: finalTranscript,
        videoUrl,
        networkQuality: worstQualityRef.current,
      }),
    );
    navigate("/interview/report", { state: location.state });
  }, [template, state.transcript, state.pendingUserText, state.pendingAssistantText, actions, dispatch, navigate, useLiveKitAgent, location.state]);

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

  const isReconnecting =
    lkConnectionState === ConnectionState.Reconnecting || lkConnectionState === ConnectionState.SignalReconnecting;

  const toggleScreenShare = useCallback(async () => {
    if (screenShareInProgressRef.current) return;
    screenShareInProgressRef.current = true;
    try {
      if (screenShareOn) {
        await room.localParticipant.setScreenShareEnabled(false);
        setScreenShareOn(false);
      } else {
        await room.localParticipant.setScreenShareEnabled(true);
        setScreenShareOn(true);
      }
    } catch (e) {
      console.error("[LiveKit] Screen share:", e);
    } finally {
      screenShareInProgressRef.current = false;
    }
  }, [room.localParticipant, screenShareOn]);

  return (
    <div className="pro-session">
      <RoomAudioRenderer />
      {reconnectMessage && (
        <div
          className={`pro-session__reconnect pro-session__reconnect--${reconnectMessage}`}
          role="status"
          aria-live="polite"
        >
          {reconnectMessage === "reconnecting"
            ? "Reconnecting your call…"
            : "Back online. Your interview is continuing."}
        </div>
      )}
      <div className="pro-session__layout">
        <div className="pro-session__video">
          {/* TrackLoop provides TrackRefContext so ParticipantTile works */}
          <TrackLoop tracks={cameraTracks}>
            <ParticipantTile />
          </TrackLoop>
          {/* Audio-only participants (e.g. LiveKit agent with no camera) get a name placeholder */}
          {remoteParticipants
            .filter((p) => !cameraTracks.some((t) => t.participant.identity === p.identity))
            .map((p) => (
              <div key={p.identity} className="pro-session__participant-placeholder">
                {p.name || p.identity}
              </div>
            ))}
        </div>
        <div className="pro-session__voice">
          <div className="pro-session__voice-header">
            {useLiveKitAgent ? (
              <span className="pro-session__agent-status" title="AI interviewer is in the LiveKit call">
                {remoteParticipants.length > 0
                  ? "Speaking with AI interviewer in the call"
                  : "Waiting for AI interviewer…"}
              </span>
            ) : (
              <ConnectionStatus connectionState={state.connectionState} chatPhase={state.chatPhase} />
            )}
            <span
              className={`pro-session__network-badge pro-session__network-badge--${connectionQualityLabel}`}
              title="LiveKit connection quality"
            >
              {connectionQualityLabel === "stable"
                ? "Stable connection"
                : connectionQualityLabel === "moderate"
                  ? "Moderate"
                  : "Poor connection"}
            </span>
            <span className="pro-session__timer">{formatTime(state.elapsedMs)}</span>
            {settings?.livekitScreenShareEnabled && (
              <button
                type="button"
                className={`btn btn--sm ${screenShareOn ? "btn--primary" : "btn--secondary"}`}
                onClick={() => void toggleScreenShare()}
                disabled={isReconnecting}
                title={screenShareOn ? "Stop sharing screen" : "Share screen"}
              >
                {screenShareOn ? "Stop screen share" : "Share screen"}
              </button>
            )}
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => void handleEnd()}
              disabled={isReconnecting}
            >
              End Interview
            </button>
          </div>
          {state.error && !useLiveKitAgent && <p className="pro-session__error">{state.error}</p>}
          <div className="pro-session__transcript">
            {useLiveKitAgent && (
              <p className="pro-session__agent-hint">
                Conversation is in the video call. The AI interviewer will speak through the call—use your microphone to respond.
              </p>
            )}
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
function RoomContent({ agentDispatched }: { agentDispatched?: boolean }) {
  return <ProfessionalSessionInner agentDispatched={agentDispatched} />;
}

export function ProfessionalInterviewSession() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionState = location.state as SessionState | null;
  const { data: settings } = useGetSettingsQuery();

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

  const simulcast = settings?.livekitSimulcastEnabled !== false;
  const videoOptions = sessionState.dataSaver
    ? { resolution: VideoPresets.h360.resolution, simulcast }
    : simulcast
      ? true
      : { simulcast: false };

  return (
    <LiveKitRoom
      serverUrl={sessionState.url}
      token={sessionState.token}
      connect={true}
      audio={true}
      video={videoOptions}
      onDisconnected={() => {}}
      onError={(err) => console.error("[LiveKit]", err)}
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      <RoomContent agentDispatched={sessionState.agentDispatched} />
    </LiveKitRoom>
  );
}
