/**
 * Single source of truth for API base URL.
 * Use this instead of duplicating VITE_API_BASE_URL || "/api" across the app.
 */
export function getApiBase(): string {
  return import.meta.env.VITE_API_BASE_URL ?? "/api";
}
