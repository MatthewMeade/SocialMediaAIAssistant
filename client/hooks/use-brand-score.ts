import { useState, useEffect, useRef, useCallback } from "react"
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
  const scoreFetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isInitialMount = useRef(true)

  const [isFetchingScore, setIsFetchingScore] = useState(false)

  const { mutate: fetchBrandScore, reset } = useMutation({
    mutationFn: ({ caption, calendarId, signal }: { caption: string; calendarId: string; signal?: AbortSignal }) => {
      const body = {
        caption: caption,
        calendarId: calendarId,
      }
      const url = '/api/ai/grade-caption'
      try {
        if (signal) {
          return (apiPost as ApiPostWithSignal)<BrandScore>(url, body, { signal })
        }
        return apiPost<BrandScore>(url, body)
      } catch (error) {
        console.error('Error in mutationFn:', error)
        throw error
      }
    },
    onMutate: () => {
      setIsFetchingScore(true)
    },
    onSuccess: (data, variables) => {
      if (variables.caption === lastFetchedCaptionRef.current) {
        setBrandScore(data)
        setIsFetchingScore(false)
        abortControllerRef.current = null
      }
    },
    onError: (error, variables) => {
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

  const fetchScoreIfNeeded = useCallback((caption: string, calendarId: string) => {
    if (!caption || !calendarId || caption === lastFetchedCaptionRef.current) {
      return
    }

    if (scoreFetchTimeoutRef.current) {
      clearTimeout(scoreFetchTimeoutRef.current)
      scoreFetchTimeoutRef.current = null
    }

    if (abortControllerRef.current && isFetchingScore) {
      abortControllerRef.current.abort()
      reset()
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const queuedCaption = caption

    scoreFetchTimeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current !== abortController || abortController.signal.aborted) {
        return
      }
      if (queuedCaption !== lastFetchedCaptionRef.current) {
        lastFetchedCaptionRef.current = queuedCaption
        fetchBrandScore({ caption: queuedCaption, calendarId, signal: abortController.signal })
      }
    }, 1000)
  }, [isFetchingScore, reset, fetchBrandScore])

  useEffect(() => {
    if (isInitialMount.current && calendarId && initialCaption) {
      const abortController = new AbortController()
      abortControllerRef.current = abortController
      lastFetchedCaptionRef.current = initialCaption
      fetchBrandScore({ caption: initialCaption, calendarId, signal: abortController.signal })
      isInitialMount.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (isInitialMount.current) {
      return
    }

    if (calendarId && initialCaption) {
      fetchScoreIfNeeded(initialCaption, calendarId)
    } else {
      lastFetchedCaptionRef.current = null
      setTimeout(() => {
        setIsFetchingScore(false)
      }, 0)
    }

    return () => {
      if (scoreFetchTimeoutRef.current) {
        clearTimeout(scoreFetchTimeoutRef.current)
        scoreFetchTimeoutRef.current = null
      }
    }
  }, [initialCaption, calendarId, fetchScoreIfNeeded])

  return {
    brandScore,
    isFetchingScore,
    fetchScoreIfNeeded,
  }
}

