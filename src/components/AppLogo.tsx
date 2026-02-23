/**
 * AppLogo — Clickable VocalHireAI logo; navigates to home (dashboard or landing).
 * Uses the same lightning bolt icon as the landing nav for consistency.
 */

import { useNavigate } from "react-router-dom";

/** Shared lightning bolt icon for consistent branding across all pages */
export function BoltIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

interface AppLogoProps {
  /** "dashboard" for app pages, "landing" for public pages */
  to?: "dashboard" | "landing";
  className?: string;
  /** Compact = text only, no icon */
  compact?: boolean;
}

export function AppLogo({ to = "dashboard", className = "", compact = false }: AppLogoProps) {
  const navigate = useNavigate();
  const path = to === "landing" ? "/" : "/dashboard";

  return (
    <button
      type="button"
      className={className}
      onClick={() => navigate(path)}
      title="Home"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 0 : 8,
        border: "none",
        background: "none",
        padding: 0,
        cursor: "pointer",
        color: "inherit",
        font: "inherit",
      }}
    >
      {!compact && <BoltIcon />}
      <span>VocalHireAI</span>
    </button>
  );
}
