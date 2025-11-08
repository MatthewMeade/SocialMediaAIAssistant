import { useState, useEffect, useRef } from "react"
import { useMutation } from "@tanstack/react-query"
import type { BrandScore } from "@/lib/types"
import { apiPost } from "@/lib/api-client"

export function useBrandScore(initialCaption: string | null, calendarId: string | null) {
  const [brandScore, setBrandScore] = useState<BrandScore | null>(null)
  const lastFetchedCaptionRef = useRef<string | null>(null)
  const scoreFetchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)

  const [isFetchingScore, setIsFetchingScore] = useState(false)

  const { mutate: fetchBrandScore } = useMutation({
    mutationFn: ({ caption, calendarId }: { caption: string; calendarId: string }) =>
      apiPost<BrandScore>('/api/ai/grade-caption', {
        caption: caption,
        calendarId: calendarId,
      }),
    onMutate: () => {
      setIsFetchingScore(true)
    },
    onSuccess: (data) => {
      console.log('Brand score fetched successfully:', data)
      setBrandScore(data)
      setIsFetchingScore(false)
    },
    onError: (error) => {
      console.error('Error fetching brand score:', error)
      setBrandScore({
        overall: 0,
        rules: [],
        suggestions: ['Failed to get AI brand score.'],
      })
      setIsFetchingScore(false)
    },
  })

  // Fetch brand score helper - prevents duplicate calls
  const fetchScoreIfNeeded = (caption: string, calendarId: string) => {
    if (!caption || !calendarId || caption === lastFetchedCaptionRef.current) {
      return
    }

    if (scoreFetchTimeoutRef.current) {
      clearTimeout(scoreFetchTimeoutRef.current)
    }

    scoreFetchTimeoutRef.current = setTimeout(() => {
      if (caption === lastFetchedCaptionRef.current) {
        return
      }
      
      lastFetchedCaptionRef.current = caption
      fetchBrandScore({ caption, calendarId })
    }, 1000)
  }

  // Fetch initial score on mount
  useEffect(() => {
    if (isInitialMount.current && calendarId && initialCaption) {
      lastFetchedCaptionRef.current = initialCaption
      fetchBrandScore({ caption: initialCaption, calendarId })
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
      setBrandScore(null)
      lastFetchedCaptionRef.current = null
    }

    return () => {
      if (scoreFetchTimeoutRef.current) {
        clearTimeout(scoreFetchTimeoutRef.current)
      }
    }
  }, [initialCaption, calendarId])

  return {
    brandScore,
    isFetchingScore,
    fetchScoreIfNeeded,
  }
}

