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
      const body = {
        caption: caption,
        calendarId: calendarId,
      }
      if (signal) {
        return (apiPost as ApiPostWithSignal)<BrandScore>('/api/ai/grade-caption', body, { signal })
      }
      return apiPost<BrandScore>('/api/ai/grade-caption', body)
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
    }

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      reset() // Reset the mutation state
    }

    // Create new AbortController for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Debounce the request
    scoreFetchTimeoutRef.current = setTimeout(() => {
      // Double-check the caption hasn't changed during the timeout
      if (caption !== lastFetchedCaptionRef.current) {
        lastFetchedCaptionRef.current = caption
        fetchBrandScore({ caption, calendarId, signal: abortController.signal })
      }
    }, 1000)
  }

  // Fetch initial score on mount
  useEffect(() => {
    if (isInitialMount.current && calendarId && initialCaption) {
      lastFetchedCaptionRef.current = initialCaption
      const abortController = new AbortController()
      abortControllerRef.current = abortController
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
      if (scoreFetchTimeoutRef.current) {
        clearTimeout(scoreFetchTimeoutRef.current)
      }
      // Cancel any in-flight request when component unmounts or dependencies change
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [initialCaption, calendarId])

  return {
    brandScore,
    isFetchingScore,
    fetchScoreIfNeeded,
  }
}

