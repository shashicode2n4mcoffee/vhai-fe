/**
 * Log an error to the backend for admin tracking.
 * Can be called from any part of the app (components, hooks, libs).
 * Excluded from login/signup flows per product requirement.
 */

import { getAccessToken } from "../store/api";
import { getApiBase } from "./apiBase";

function getCurrentUserFromStorage(): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem("vocalhireai_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { id?: string; name?: string };
    return u?.id && u?.name ? { id: u.id, name: u.name } : null;
  } catch {
    return null;
  }
}

export function logErrorToServer(
  message: string,
  options?: { details?: string; source?: string },
): void {
  const user = getCurrentUserFromStorage();
  const body = {
    message: message.slice(0, 2000),
    details: options?.details?.slice(0, 10000),
    source: options?.source?.slice(0, 100),
    ...(user && { userId: user.id, userName: user.name }),
  };
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  fetch(`${getApiBase()}/errors/log`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    keepalive: true, // allow send on page unload
  }).catch(() => {
    // fire-and-forget; avoid logging failures from breaking the app
  });
}
