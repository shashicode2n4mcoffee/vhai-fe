/**
 * FlagsTimeline — Scrollable list of proctoring violation events.
 *
 * Each flag shows:
 *   - Timestamp (relative to interview start)
 *   - Type icon + label
 *   - Points added
 */

import type { ProctoringFlag } from "../proctoring/types";

interface Props {
  flags: ProctoringFlag[];
  maxVisible?: number;
  className?: string;
}

export function FlagsTimeline({ flags, maxVisible = 50, className }: Props) {
  // Show most recent first
  const visible = flags.slice(-maxVisible).reverse();

  if (visible.length === 0) {
    return (
      <div className={`proctor-timeline proctor-timeline--empty ${className ?? ""}`}>
        <ShieldIcon />
        <span>No violations detected</span>
      </div>
    );
  }

  return (
    <div className={`proctor-timeline ${className ?? ""}`}>
      <div className="proctor-timeline__header">
        <span className="proctor-timeline__title">Violations ({flags.length})</span>
      </div>
      <div className="proctor-timeline__list">
        {visible.map((flag) => (
          <div key={flag.id} className={`proctor-flag proctor-flag--${flagSeverity(flag.type)}`}>
            <span className="proctor-flag__time">{formatTs(flag.timestamp)}</span>
            <span className="proctor-flag__icon">{flagIcon(flag.type)}</span>
            <span className="proctor-flag__msg">{flag.message}</span>
            <span className="proctor-flag__pts">+{flag.pointsAdded}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Severity = "low" | "medium" | "high";

function flagSeverity(type: string): Severity {
  switch (type) {
    case "MULTI_FACE":
    case "FULLSCREEN_EXIT":
    case "NO_FACE":
    case "TAB_HIDDEN":
    case "WINDOW_BLUR":
      return "high";
    case "LOOKING_AWAY":
    case "DARK_FRAME":
      return "medium";
    default:
      return "low";
  }
}

function flagIcon(type: string): string {
  switch (type) {
    case "TAB_HIDDEN": return "👁";
    case "WINDOW_BLUR": return "↗";
    case "FULLSCREEN_EXIT": return "⛶";
    case "MULTI_FACE": return "👥";
    case "NO_FACE": return "🚫";
    case "LOOKING_AWAY": return "↔";
    case "DARK_FRAME": return "🌑";
    case "HAND_NEAR_FACE": return "✋";
    default: return "⚠";
  }
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
