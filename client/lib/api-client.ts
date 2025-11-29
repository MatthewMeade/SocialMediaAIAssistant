import { supabase } from "./supabase/client"

export async function apiFetch(url: string, options: RequestInit & { signal?: AbortSignal } = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession()

  const headers: Record<string, string> = {}

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

  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`
  }

  const response = await fetch(url, {
    ...options,
    headers: new Headers(headers),
  })

  if (response.status === 401) {
    const { data: { session: newSession } } = await supabase.auth.refreshSession()
    
    if (newSession?.access_token) {
      headers["Authorization"] = `Bearer ${newSession.access_token}`
      return fetch(url, {
        ...options,
        headers: new Headers(headers),
      })
    }
  }

  return response
}

export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiFetch(url, { method: "GET" })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json()
}

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

export async function apiDelete(url: string): Promise<void> {
  const response = await apiFetch(url, { method: "DELETE" })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }))
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`)
  }
}

