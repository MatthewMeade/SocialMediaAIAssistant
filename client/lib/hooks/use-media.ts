import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { MediaItem } from "@/lib/types"
import { apiGet, apiDelete } from "@/lib/api-client"

export function useMedia(calendarId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["media", calendarId],
    queryFn: async () => {
      return apiGet<MediaItem[]>(`/api/media?calendarId=${calendarId}`)
    },
    enabled: !!calendarId,
  })

  const deleteMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      return apiDelete(`/api/media?id=${mediaId}`)
    },
    onMutate: async (mediaId) => {
      await queryClient.cancelQueries({ queryKey: ["media", calendarId] })
      const previousMedia = queryClient.getQueryData<MediaItem[]>(["media", calendarId])

      queryClient.setQueryData<MediaItem[]>(["media", calendarId], (old = []) =>
        old.filter((item) => item.id !== mediaId),
      )

      return { previousMedia }
    },
    onError: (_err, _mediaId, context) => {
      if (context?.previousMedia) {
        queryClient.setQueryData(["media", calendarId], context.previousMedia)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["media", calendarId] })
    },
  })

  return {
    media: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    deleteMedia: deleteMutation,
  }
}
