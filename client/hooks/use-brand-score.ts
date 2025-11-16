import { useState, useEffect, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import type { BrandScore } from "@/lib/types"
import { apiPost } from "@/lib/api-client"

// Type helper for apiPost with signal support
type ApiPostWithSignal = <T>(
  url: string,
  body: unknown | FormData,
  options: { signal?: AbortSignal }
) => Promise<T>

export function useBrandScore(initialCaption: string | null, calendarId: string | null) {
  const [brandScore, setBrandScore] = useState<BrandScore | null>(null)
  const lastFetchedCaptionRef = useRef<string | null>(null)
  const scoreFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isInitialMount = useRef(true)

  const [isFetchingScore, setIsFetchingScore] = useState(false)

  const { mutate: fetchBrandScore, reset } = useMutation({
    mutationFn: ({ caption, calendarId, signal }: { caption: string; calendarId: string; signal?: AbortSignal }) => {
      console.log('[useBrandScore] Starting fetch for caption:', caption.substring(0, 50), 'calendarId:', calendarId)
      const body = {
        caption: caption,
        calendarId: calendarId,
      }
      const url = '/api/ai/grade-caption'
      console.log('[useBrandScore] Making request to:', url, 'with body:', body)
      try {
        if (signal) {
          return (apiPost as ApiPostWithSignal)<BrandScore>(url, body, { signal })
        }
        return apiPost<BrandScore>(url, body)
      } catch (error) {
        console.error('[useBrandScore] Error in mutationFn:', error)
        throw error
      }
    },
    onMutate: () => {
      setIsFetchingScore(true)
    },
    onSuccess: (data, variables) => {
      // Only update if this is still the current caption
      if (variables.caption === lastFetchedCaptionRef.current) {
        console.log('Brand score fetched successfully:', data)
        setBrandScore(data)
        setIsFetchingScore(false)
        abortControllerRef.current = null
      }
    },
    onError: (error, variables) => {
      // Only update if this is still the current caption and not aborted
      if (variables.caption === lastFetchedCaptionRef.current && error.name !== 'AbortError') {
        console.error('Error fetching brand score:', error)
        setBrandScore({
          overall: 0,
          rules: [],
          suggestions: ['Failed to get AI brand score.'],
        })
        setIsFetchingScore(false)
      }
      abortControllerRef.current = null
    },
  })

  // Fetch brand score helper - debounced and cancels previous requests
  const fetchScoreIfNeeded = (caption: string, calendarId: string) => {
    if (!caption || !calendarId || caption === lastFetchedCaptionRef.current) {
      return
    }

    // Clear any pending timeout
    if (scoreFetchTimeoutRef.current) {
      clearTimeout(scoreFetchTimeoutRef.current)
      scoreFetchTimeoutRef.current = null
    }

    // Cancel any in-flight request (but only if there's actually a request in flight)
    // Don't abort if we're just clearing a pending timeout
    if (abortControllerRef.current && isFetchingScore) {
      abortControllerRef.current.abort()
      reset() // Reset the mutation state
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Store the caption we're about to queue, so we can check if it's still current when timeout fires
    const queuedCaption = caption

    // Debounce the request
    scoreFetchTimeoutRef.current = setTimeout(() => {
      // Check if this controller is still the current one (hasn't been replaced)
      // and if it's been aborted
      if (abortControllerRef.current !== abortController || abortController.signal.aborted) {
        console.log('[useBrandScore] Request cancelled - controller replaced or aborted')
        return
      }
      // Only fetch if this caption hasn't already been fetched
      // (If a newer caption was queued, this timeout would have been cleared)
      if (queuedCaption !== lastFetchedCaptionRef.current) {
        console.log('[useBrandScore] Calling fetchBrandScore for:', queuedCaption.substring(0, 50))
        lastFetchedCaptionRef.current = queuedCaption
        fetchBrandScore({ caption: queuedCaption, calendarId, signal: abortController.signal })
      } else {
        console.log('[useBrandScore] Skipping fetch - caption already fetched:', queuedCaption.substring(0, 50))
      }
    }, 1000)
  }

  // Fetch initial score on mount
  useEffect(() => {
    if (isInitialMount.current && calendarId && initialCaption) {
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      lastFetchedCaptionRef.current = initialCaption
      fetchBrandScore({ caption: initialCaption, calendarId, signal: abortController.signal })
      isInitialMount.current = false
    }
  }, []) // Only run on mount

  // Debounce fetching when caption changes
  useEffect(() => {
    if (isInitialMount.current) {
      return
    }

    if (calendarId && initialCaption) {
      fetchScoreIfNeeded(initialCaption, calendarId)
    } else {
      // Don't clear brandScore - keep last score visible
      // Only clear the ref so it can be re-fetched if caption is added back
      lastFetchedCaptionRef.current = null
      setIsFetchingScore(false)
    }

    return () => {
      // Clear the timeout - this will prevent the fetch from happening
      if (scoreFetchTimeoutRef.current) {
        clearTimeout(scoreFetchTimeoutRef.current)
        scoreFetchTimeoutRef.current = null
      }
      // Only abort if there's actually an in-flight request (not just a pending timeout)
      // The fetchScoreIfNeeded function will handle aborting when setting up a new request
      // We don't abort here to avoid aborting a request that hasn't started yet
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCaption, calendarId]) // fetchScoreIfNeeded is stable and doesn't need to be in deps

  return {
    brandScore,
    isFetchingScore,
    fetchScoreIfNeeded,
  }
}

