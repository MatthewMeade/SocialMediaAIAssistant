import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

import { apiGet, apiPut } from "@/lib/api-client"

import { ApiRoutes } from "@/lib/api-routes"



// Define the shape of the profile data

interface Profile {

  id: string

  name: string

  email: string

  bio: string | null

  avatar_url: string | null

  timezone: string | null

  language: string | null

  theme: string | null

  compact_mode: boolean | null

  updated_at: string

}



export type ProfileUpdate = Partial<Omit<Profile, "id" | "updated_at">>



export function useProfile() {

  const queryClient = useQueryClient()



  const profileQuery = useQuery({

    queryKey: ["profile"],

    queryFn: async () => {

      return apiGet<Profile>(ApiRoutes.PROFILE)

    },

    retry: 1,

    staleTime: 1000 * 60 * 5, // Cache profile for 5 minutes

  })



  const updateProfile = useMutation({

    mutationFn: async (updates: ProfileUpdate) => {

      return apiPut<Profile>(ApiRoutes.PROFILE, updates)

    },

    onMutate: async (updates) => {

      await queryClient.cancelQueries({ queryKey: ["profile"] })

      const previousProfile = queryClient.getQueryData<Profile>(["profile"])

      queryClient.setQueryData<Profile>(["profile"], (old) =>

        old ? { ...old, ...updates } : undefined

      )

      return { previousProfile }

    },

    onError: (_err, _updates, context) => {

      if (context?.previousProfile) {

        queryClient.setQueryData(["profile"], context.previousProfile)

      }

    },

    onSettled: () => {

      queryClient.invalidateQueries({ queryKey: ["profile"] })

    },

  })



  return {

    profile: profileQuery.data,

    isLoading: profileQuery.isLoading,

    error: profileQuery.error,

    updateProfile,

  }

}

