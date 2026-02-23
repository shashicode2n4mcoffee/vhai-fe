/**
 * ConnectionStatus – Pill-shaped indicator showing the current state.
 */

import type { ChatPhase, ConnectionState } from "../types/gemini";

interface Props {
  connectionState: ConnectionState;
  chatPhase: ChatPhase;
}

const STATUS_MAP: Record<
  string,
  { label: string; className: string }
> = {
  disconnected: { label: "Disconnected", className: "status--off" },
  connecting: { label: "Connecting...", className: "status--warn" },
  error: { label: "Connection Error", className: "status--error" },
  idle: { label: "Ready", className: "status--on" },
  listening: { label: "Listening", className: "status--listening" },
  "user-speaking": { label: "You're speaking", className: "status--speaking" },
  "ai-responding": { label: "Gemini is speaking", className: "status--ai" },
};

export function ConnectionStatus({ connectionState, chatPhase }: Props) {
  const key =
    connectionState === "connected" ? chatPhase : connectionState;
  const { label, className } = STATUS_MAP[key] ?? STATUS_MAP["disconnected"]!;

  return (
    <div className={`status-pill ${className}`}>
      <span className="status-pill__dot" />
      <span className="status-pill__label">{label}</span>
    </div>
  );
}
