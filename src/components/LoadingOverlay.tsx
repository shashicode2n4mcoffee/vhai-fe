/**
 * LoadingOverlay — Full-screen animated loading indicator.
 *
 * Usage:
 *   <LoadingOverlay visible message="Generating report..." />
 */

interface Props {
  visible: boolean;
  message?: string;
}

export function LoadingOverlay({ visible, message }: Props) {
  if (!visible) return null;

  return (
    <div className="loading-overlay" role="status" aria-busy="true">
      <div className="loading-overlay__inner">
        {/* Animated spinner rings */}
        <div className="loading-overlay__spinner">
          <div className="loading-overlay__ring loading-overlay__ring--1" />
          <div className="loading-overlay__ring loading-overlay__ring--2" />
          <div className="loading-overlay__ring loading-overlay__ring--3" />
          <div className="loading-overlay__dot" />
        </div>
        {message && <p className="loading-overlay__msg">{message}</p>}
      </div>
    </div>
  );
}
