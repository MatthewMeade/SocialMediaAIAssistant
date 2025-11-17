import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Note } from "@/lib/types"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client"
import { ApiRoutes } from "@/lib/api-routes"

export function useNotes(calendarId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["notes", calendarId],
    queryFn: async () => {
      return apiGet<Note[]>(`${ApiRoutes.NOTES}?calendarId=${calendarId}`)
    },
    enabled: !!calendarId,
  })

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: any }) => {
      return apiPost<Note>(ApiRoutes.NOTES, {
        calendarId,
        title: data.title,
        content: data.content || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", calendarId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, content }: { id: string; title: string; content: any }) => {
      return apiPut<Note>(`${ApiRoutes.NOTES}/${id}`, {
        title,
        content,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", calendarId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiDelete(`${ApiRoutes.NOTES}/${noteId}`)
    },
    onMutate: async (noteId) => {
      await queryClient.cancelQueries({ queryKey: ["notes", calendarId] })
      const previousNotes = queryClient.getQueryData<Note[]>(["notes", calendarId])

      queryClient.setQueryData<Note[]>(["notes", calendarId], (old = []) =>
        old.filter((note) => note.id !== noteId),
      )

      return { previousNotes }
    },
    onError: (_err, _noteId, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(["notes", calendarId], context.previousNotes)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", calendarId] })
    },
  })

  return {
    notes: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createNote: createMutation,
    updateNote: updateMutation,
    deleteNote: deleteMutation,
  }
}

