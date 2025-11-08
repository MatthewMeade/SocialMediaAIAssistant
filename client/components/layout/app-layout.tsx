import { Outlet, useParams, Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { SidebarProvider } from "../ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { apiGet } from "../../lib/api-client"

export default function AppLayout() {
  const { calendarSlug } = useParams()

  const { data: calendars, isLoading } = useQuery({
    queryKey: ["calendars"],
    queryFn: async () => {
      return apiGet<Array<{ id: string; name: string; slug: string; color: string; createdAt: string }>>(
        "/api/calendars",
      )
    },
  })

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!calendars || calendars.length === 0) {
    return <div className="flex h-screen items-center justify-center">No calendars found</div>
  }

  // Map API response to match expected format
  const mappedCalendars =
    calendars?.map((c) => ({
      ...c,
      created_at: c.createdAt,
    })) || []

  const currentCalendar = mappedCalendars?.find((c) => c.slug === calendarSlug)

  if (!currentCalendar && calendarSlug && mappedCalendars && mappedCalendars.length > 0) {
    return <Navigate to={`/${mappedCalendars[0].slug}/calendar`} replace />
  }

  if (!calendarSlug && mappedCalendars && mappedCalendars.length > 0) {
    return <Navigate to={`/${mappedCalendars[0].slug}/calendar`} replace />
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <AppSidebar calendars={mappedCalendars} currentCalendar={currentCalendar} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  )
}

