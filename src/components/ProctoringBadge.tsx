/**
 * ProctoringBadge — Compact live risk indicator.
 *
 * Shows:
 *   - Color-coded risk level (green / amber / red)
 *   - Numeric score (0–100)
 *   - Status label (OK / Warning / High Risk)
 *   - Optional face count + FPS
 *
 * Designed to overlay on top of the interview video panel.
 */

import type { ProctoringMetrics, RiskLevel } from "../proctoring/types";

interface Props {
  riskScore: number;
  riskLevel: RiskLevel;
  metrics?: ProctoringMetrics;
  isRunning: boolean;
  isReady: boolean;
  error?: string | null;
  compact?: boolean;
  className?: string;
  /** 0–1 mic level from VAD; when provided, show device status */
  micLevel?: number;
}

export function ProctoringBadge({
  riskScore,
  riskLevel,
  metrics,
  isRunning,
  isReady,
  error,
  compact = false,
  className,
  micLevel,
}: Props) {
  const levelClass =
    riskLevel === "OK"
      ? "proctor-badge--ok"
      : riskLevel === "Warning"
        ? "proctor-badge--warn"
        : "proctor-badge--danger";

  // Show error state if worker failed
  if (error) {
    return (
      <div className={`proctor-badge proctor-badge--danger ${className ?? ""}`} title={error}>
        <div className="proctor-badge__dot proctor-badge__dot--danger" />
        <span className="proctor-badge__label">Proctor error</span>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className={`proctor-badge proctor-badge--loading ${className ?? ""}`}>
        <div className="proctor-badge__dot proctor-badge__dot--loading" />
        <span className="proctor-badge__label">Loading proctoring...</span>
      </div>
    );
  }

  if (!isRunning) {
    return (
      <div className={`proctor-badge proctor-badge--idle ${className ?? ""}`}>
        <div className="proctor-badge__dot proctor-badge__dot--idle" />
        <span className="proctor-badge__label">Proctoring idle</span>
      </div>
    );
  }

  return (
    <div className={`proctor-badge ${levelClass} ${className ?? ""}`}>
      {/* Risk dot */}
      <div className={`proctor-badge__dot proctor-badge__dot--${riskLevel === "OK" ? "ok" : riskLevel === "Warning" ? "warn" : "danger"}`} />

      {/* Score */}
      <span className="proctor-badge__score">{riskScore}</span>

      {/* Level label */}
      <span className="proctor-badge__label">{riskLevel}</span>

      {/* Extended info: face count, FPS, camera, mic */}
      {!compact && metrics && (
        <span className="proctor-badge__meta">
          {metrics.faceCount === 0
            ? "No face"
            : metrics.faceCount === 1
              ? "1 face"
              : `${metrics.faceCount} faces`}
          {" · "}
          {metrics.inferredFps} fps
          {metrics.cameraQuality && metrics.cameraQuality !== "ok" && (
            <> · Cam: {metrics.cameraQuality === "dark" ? "low light" : "low res"}</>
          )}
          {typeof micLevel === "number" && (
            <> · Mic: {micLevel > 0.01 ? "OK" : "Low"}</>
          )}
        </span>
      )}
    </div>
  );
}
