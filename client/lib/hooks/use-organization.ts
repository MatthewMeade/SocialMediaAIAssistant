import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Organization } from "@/lib/types"
import { apiGet, apiPost, apiDelete } from "@/lib/api-client"
import { ApiRoutes } from "@/lib/api-routes"

type ApiOrganization = Omit<Organization, "createdAt"> & { createdAt: string }



interface Member {

  id: string

  user_id: string

  role: string

  profiles: {

    id: string

    name: string

    email: string

  }

}



export function useOrganization() {

  const queryClient = useQueryClient()



  const orgQuery = useQuery({

    queryKey: ["organization"],

    queryFn: async () => {

      const org = await apiGet<ApiOrganization>(ApiRoutes.ORGANIZATION)

      return {

        ...org,

        createdAt: new Date(org.createdAt),

      }

    },

    retry: 1,

  })



  const membersQuery = useQuery({

    queryKey: ["organizationMembers", orgQuery.data?.id],

    queryFn: async () => {

      return apiGet<Member[]>(`${ApiRoutes.ORGANIZATION}/members`)

    },

    enabled: !!orgQuery.data?.id,
  })



  const inviteMember = useMutation({

    mutationFn: async (data: { email: string; role: "admin" | "member" }) => {

      if (!orgQuery.data?.id) throw new Error("Organization not loaded")

      return apiPost<{ type: string }>(`${ApiRoutes.ORGANIZATION}/members`, {

        ...data,

        organizationId: orgQuery.data.id,

      })

    },

    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: ["organizationMembers"] })

    },

  })



  const removeMember = useMutation({

    mutationFn: async (memberId: string) => {

      return apiDelete(`${ApiRoutes.ORGANIZATION}/members?memberId=${memberId}`)

    },

    onMutate: async (memberId) => {

      await queryClient.cancelQueries({ queryKey: ["organizationMembers"] })

      const previousMembers = queryClient.getQueryData<Member[]>(["organizationMembers"])

      queryClient.setQueryData<Member[]>(["organizationMembers"], (old = []) =>

        old.filter((m) => m.id !== memberId)

      )

      return { previousMembers }

    },

    onError: (_err, _vars, context) => {

      if (context?.previousMembers) {

        queryClient.setQueryData(["organizationMembers"], context.previousMembers)

      }

    },

    onSettled: () => {

      queryClient.invalidateQueries({ queryKey: ["organizationMembers"] })

    },

  })



  return {

    organization: orgQuery.data,

    isLoadingOrg: orgQuery.isLoading,

    orgError: orgQuery.error,

    members: membersQuery.data ?? [],

    isLoadingMembers: membersQuery.isLoading,

    membersError: membersQuery.error,

    inviteMember,

    removeMember,

  }

}

