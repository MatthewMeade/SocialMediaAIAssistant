import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Calendar } from "@/lib/types"
import { apiGet, apiPost } from "@/lib/api-client"
import { ApiRoutes } from "@/lib/api-routes"

type ApiCalendar = Omit<Calendar, "createdAt"> & { createdAt: string }



export function useCalendars() {

  const queryClient = useQueryClient()



  const query = useQuery({

    queryKey: ["calendars"],

    queryFn: async () => {

      const calendars = await apiGet<ApiCalendar[]>(ApiRoutes.CALENDARS)

      return calendars.map((c) => ({

        ...c,

        createdAt: new Date(c.createdAt),

      }))

    },

    retry: 1,

  })



  const createCalendar = useMutation({

    mutationFn: async (data: { name: string; color: string }) => {

      const newCalendar = await apiPost<ApiCalendar>(ApiRoutes.CALENDARS, data)

      return {

        ...newCalendar,

        createdAt: new Date(newCalendar.createdAt),

      }

    },

    onSuccess: (newCalendar) => {
      queryClient.setQueryData<Calendar[]>(["calendars"], (old = []) => [...old, newCalendar])
      queryClient.invalidateQueries({ queryKey: ["calendars"] })
    },

  })



  return {

    calendars: query.data ?? [],

    isLoading: query.isLoading,

    error: query.error,

    createCalendar: createCalendar,

  }

}

