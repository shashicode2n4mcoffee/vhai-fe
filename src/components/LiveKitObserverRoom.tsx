/**
 * LiveKitObserverRoom — View-only room for HR/observers.
 * Receives token, url, roomName from location.state (from "Join as observer" flow).
 * Does not publish audio/video; only subscribes to remote participants.
 */

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LiveKitRoom, TrackLoop, useTracks, ParticipantTile } from "@livekit/components-react";
import { Track } from "livekit-client";

interface ObserverState {
  token: string;
  url: string;
  roomName: string;
}

function ObserverRoomInner() {
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone, Track.Source.ScreenShare]);
  return (
    <div className="pro-session pro-session--observer">
      <div className="pro-session__video">
        <TrackLoop tracks={tracks}>
          <ParticipantTile />
        </TrackLoop>
      </div>
      <p className="pro-session__observer-hint">View-only mode. You are not visible to participants.</p>
    </div>
  );
}

export function LiveKitObserverRoom() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as ObserverState | null;

  useEffect(() => {
    if (!state?.token || !state?.url) {
      navigate("/dashboard", { replace: true });
    }
  }, [state, navigate]);

  if (!state?.token || !state?.url) {
    return (
      <div className="pro-session">
        <p>Missing observer session. Redirecting…</p>
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={state.url}
      token={state.token}
      connect={true}
      audio={false}
      video={false}
      onDisconnected={() => navigate("/dashboard", { replace: true })}
      onError={(err) => console.error("[LiveKit Observer]", err)}
      style={{ height: "100vh", display: "flex", flexDirection: "column" }}
    >
      <ObserverRoomInner />
    </LiveKitRoom>
  );
}
