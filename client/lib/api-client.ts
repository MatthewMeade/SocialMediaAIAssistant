import { supabase } from "./supabase/client"

/**
 * API client utility that automatically adds authentication tokens to requests
 * Supports AbortController for request cancellation
 */
export async function apiFetch(url: string, options: RequestInit & { signal?: AbortSignal } = {}): Promise<Response> {
  console.log('[apiFetch] Starting request to:', url, 'with signal:', options.signal?.aborted ? 'ABORTED' : 'active')
  // Get the current session
  const { data: { session } } = await supabase.auth.getSession()
  console.log('[apiFetch] Session:', session ? 'exists' : 'none')

  // Prepare headers as a plain object
  const headers: Record<string, string> = {}

  // Copy existing headers
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value
      })
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value
      })
    } else {
      Object.assign(headers, options.headers)
    }
  }

  // Only set Content-Type for JSON, not for FormData
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  // Add authorization token if available
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`
  }

  // Make the request
  console.log('[apiFetch] Making fetch request to:', url)
  const response = await fetch(url, {
    ...options,
    headers: new Headers(headers),
  })
  console.log('[apiFetch] Response status:', response.status)

  // Handle 401 errors (unauthorized) - token might be expired
  if (response.status === 401) {
    // Try to refresh the session
    const { data: { session: newSession } } = await supabase.auth.refreshSession()
    
    if (newSession?.access_token) {
      // Retry the request with the new token
      headers["Authorization"] = `Bearer ${newSession.access_token}`
      return fetch(url, {
        ...options,
        headers: new Headers(headers),
      })
    }
  }

  return response
}

/**
 * Helper for GET requests
 */
export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiFetch(url, { method: "GET" })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Helper for POST requests
 * Supports both JSON and FormData
 * Supports AbortController for request cancellation via signal option
 */
export async function apiPost<T>(
  url: string,
  body?: unknown | FormData,
  options?: { signal?: AbortSignal }
): Promise<T> {
  const response = await apiFetch(url, {
    method: "POST",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    signal: options?.signal,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Helper for PUT requests
 * Supports both JSON and FormData
 */
export async function apiPut<T>(url: string, body?: unknown | FormData): Promise<T> {
  const response = await apiFetch(url, {
    method: "PUT",
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Helper for DELETE requests
 */
export async function apiDelete(url: string): Promise<void> {
  const response = await apiFetch(url, { method: "DELETE" })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
}

