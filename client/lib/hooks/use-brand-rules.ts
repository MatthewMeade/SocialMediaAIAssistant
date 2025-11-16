import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { BrandRule } from "@/lib/types"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client"
import { ApiRoutes } from "@/lib/api-routes"

export function useBrandRules(calendarId: string) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ["brandRules", calendarId],
    queryFn: async () => {
      return apiGet<BrandRule[]>(`${ApiRoutes.BRAND_VOICE}?calendarId=${calendarId}`)
    },
    enabled: !!calendarId,
  })

  const createMutation = useMutation({
    mutationFn: async (rule: Omit<BrandRule, "id">) => {
      return apiPost<BrandRule>(ApiRoutes.BRAND_VOICE, rule)
    },
    onMutate: async (newRule) => {
      await queryClient.cancelQueries({ queryKey: ["brandRules", calendarId] })
      const previousRules = queryClient.getQueryData<BrandRule[]>(["brandRules", calendarId])

      queryClient.setQueryData<BrandRule[]>(["brandRules", calendarId], (old = []) => [
        ...old,
        { ...newRule, id: `temp-${Date.now()}` } as BrandRule,
      ])

      return { previousRules }
    },
    onError: (_err, _newRule, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(["brandRules", calendarId], context.previousRules)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["brandRules", calendarId] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (rule: BrandRule) => {
      return apiPut<BrandRule>(ApiRoutes.BRAND_VOICE, rule)
    },
    onMutate: async (updatedRule) => {
      await queryClient.cancelQueries({ queryKey: ["brandRules", calendarId] })
      const previousRules = queryClient.getQueryData<BrandRule[]>(["brandRules", calendarId])

      queryClient.setQueryData<BrandRule[]>(["brandRules", calendarId], (old = []) =>
        old.map((rule) => (rule.id === updatedRule.id ? updatedRule : rule)),
      )

      return { previousRules }
    },
    onError: (_err, _updatedRule, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(["brandRules", calendarId], context.previousRules)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["brandRules", calendarId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return apiDelete(`${ApiRoutes.BRAND_VOICE}?id=${ruleId}`)
    },
    onMutate: async (ruleId) => {
      await queryClient.cancelQueries({ queryKey: ["brandRules", calendarId] })
      const previousRules = queryClient.getQueryData<BrandRule[]>(["brandRules", calendarId])

      queryClient.setQueryData<BrandRule[]>(["brandRules", calendarId], (old = []) =>
        old.filter((rule) => rule.id !== ruleId),
      )

      return { previousRules }
    },
    onError: (_err, _ruleId, context) => {
      if (context?.previousRules) {
        queryClient.setQueryData(["brandRules", calendarId], context.previousRules)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["brandRules", calendarId] })
    },
  })

  return {
    brandRules: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    createBrandRule: createMutation,
    updateBrandRule: updateMutation,
    deleteBrandRule: deleteMutation,
  }
}
