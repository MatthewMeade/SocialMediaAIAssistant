import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Post } from "@/lib/types"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client"

export function usePosts(calendarId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["posts", calendarId],
    queryFn: async () => {
      return apiGet<Post[]>(`/api/posts?calendarId=${calendarId}`)
    },
    enabled: !!calendarId,
  })

  const createMutation = useMutation({
    mutationFn: async (post: Omit<Post, "id">) => {
      // Serialize the date to ISO string for the API
      const postToSend = {
        ...post,
        date: post.date instanceof Date ? post.date.toISOString() : post.date,
      }
      return apiPost<Post>("/api/posts", postToSend)
    },
    onMutate: async (newPost) => {
      await queryClient.cancelQueries({ queryKey: ["posts", calendarId] })
      const previousPosts = queryClient.getQueryData<Post[]>(["posts", calendarId])

      const tempId = `temp-${Date.now()}`
      queryClient.setQueryData<Post[]>(["posts", calendarId], (old = []) => [
        ...old,
        { ...newPost, id: tempId } as Post,
      ])

      return { previousPosts, tempId }
    },
    onSuccess: (newPost, _variables, context) => {
      // Replace the temp post with the real one
      queryClient.setQueryData<Post[]>(["posts", calendarId], (old = []) => {
        if (!old) return [newPost]
        // Remove temp post and add the real one
        return old.filter((p) => p.id !== context?.tempId).concat(newPost)
      })
    },
    onError: (_err, _newPost, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(["posts", calendarId], context.previousPosts)
      }
    },
    onSettled: () => {
      // Still invalidate to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: ["posts", calendarId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (post: Post) => {
      // Serialize the date to ISO string for the API
      const postToSend = {
        ...post,
        date: post.date instanceof Date ? post.date.toISOString() : post.date,
      }
      return apiPut<Post>("/api/posts", postToSend)
    },
    onMutate: async (updatedPost) => {
      await queryClient.cancelQueries({ queryKey: ["posts", calendarId] })
      const previousPosts = queryClient.getQueryData<Post[]>(["posts", calendarId])

      queryClient.setQueryData<Post[]>(["posts", calendarId], (old = []) =>
        old.map((post) => (post.id === updatedPost.id ? updatedPost : post)),
      )

      return { previousPosts }
    },
    onError: (_err, _updatedPost, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(["posts", calendarId], context.previousPosts)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", calendarId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      return apiDelete(`/api/posts?id=${postId}&calendarId=${calendarId}`)
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["posts", calendarId] })
      const previousPosts = queryClient.getQueryData<Post[]>(["posts", calendarId])

      queryClient.setQueryData<Post[]>(["posts", calendarId], (old = []) => old.filter((post) => post.id !== postId))

      return { previousPosts }
    },
    onError: (_err, _postId, context) => {
      if (context?.previousPosts) {
        queryClient.setQueryData(["posts", calendarId], context.previousPosts)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", calendarId] })
    },
  })

  return {
    posts: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createPost: createMutation,
    updatePost: updateMutation,
    deletePost: deleteMutation,
  }
}
