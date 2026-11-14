/**
 * Lightweight API reachability check (task 6 — "API down").
 * Uses VITE_API_BASE_URL from frontend/.env — no secrets.
 */

/** Result of probing the backend */
export type ApiReachability = "ok" | "down" | "skipped"

/**
 * Ask GET /health. If the env URL is missing, return "skipped"
 * (local stub mode without pretending the server is up).
 */
export async function checkApiHealth(): Promise<ApiReachability> {
  // Vite exposes only env vars prefixed with VITE_
  const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

  // No API configured → not an error, just local-only mode
  if (!baseUrl) {
    return "skipped"
  }

  try {
    // Abort if the server hangs (plain "down" for the visitor)
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 2500)

    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      method: "GET",
      signal: controller.signal,
    })

    window.clearTimeout(timer)

    // Any non-OK HTTP status counts as unavailable for this MVP
    if (!response.ok) {
      return "down"
    }

    return "ok"
  } catch {
    // Network error, CORS, abort, etc. → server unavailable
    return "down"
  }
}
