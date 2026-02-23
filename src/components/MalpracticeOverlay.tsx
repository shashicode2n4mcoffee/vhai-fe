/**
 * MalpracticeOverlay — Blocking overlay shown when tab switch, window switch,
 * or fullscreen exit is detected. Warns that the action is recorded and may
 * lead to dismissal; requires acknowledgment (and fullscreen when applicable).
 */

import { DISMISSAL_WARNING } from "../proctoring/types";

export type MalpracticeKind = "tab_switch" | "window_switch" | "fullscreen_exit";

interface Props {
  kind: MalpracticeKind;
  onAcknowledge: () => void;
  onRequestFullscreen?: () => void;
  isFullscreen: boolean;
}

const TITLES: Record<MalpracticeKind, string> = {
  tab_switch: "Tab switch detected",
  window_switch: "Window switch detected",
  fullscreen_exit: "Fullscreen required",
};

const DESCRIPTIONS: Record<MalpracticeKind, string> = {
  tab_switch:
    "You switched to another browser tab. You must stay on this tab for the entire interview.",
  window_switch:
    "You switched to another application or window. You must keep this window focused for the entire interview.",
  fullscreen_exit:
    "You left fullscreen mode. You must remain in fullscreen for the entire interview. Do not use other monitors or windows.",
};

export function MalpracticeOverlay({
  kind,
  onAcknowledge,
  onRequestFullscreen,
  isFullscreen,
}: Props) {
  const needsFullscreen = kind === "fullscreen_exit" && !isFullscreen;
  const canAcknowledge = !needsFullscreen;

  return (
    <div className="malpractice-overlay" role="alertdialog" aria-modal="true" aria-labelledby="malpractice-title">
      <div className="malpractice-overlay__backdrop" />
      <div className="malpractice-overlay__card">
        <div className="malpractice-overlay__icon" aria-hidden>
          ⚠
        </div>
        <h2 id="malpractice-title" className="malpractice-overlay__title">
          {TITLES[kind]}
        </h2>
        <p className="malpractice-overlay__desc">{DESCRIPTIONS[kind]}</p>
        <p className="malpractice-overlay__warning">{DISMISSAL_WARNING}</p>
        <div className="malpractice-overlay__actions">
          {needsFullscreen && onRequestFullscreen && (
            <button
              type="button"
              className="btn btn--primary malpractice-overlay__btn"
              onClick={onRequestFullscreen}
            >
              Return to fullscreen
            </button>
          )}
          <button
            type="button"
            className="btn malpractice-overlay__btn malpractice-overlay__btn--ack"
            onClick={onAcknowledge}
            disabled={!canAcknowledge}
          >
            {needsFullscreen ? "Return to fullscreen to continue" : "I understand"}
          </button>
        </div>
      </div>
    </div>
  );
}
