import { useState } from "react"
import { Outlet, useParams, Navigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { SidebarProvider } from "../ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { ChatSidebar } from "../chat/chat-sidebar"
import { ChatToggleButton } from "../chat/chat-toggle-button"
import { apiGet } from "../../lib/api-client"

export default function AppLayout() {
  const { calendarSlug } = useParams()
  const [isChatOpen, setIsChatOpen] = useState(false)

  const { data: calendars, isLoading, error } = useQuery({
    queryKey: ["calendars"],
    queryFn: async () => {
      return apiGet<Array<{ id: string; name: string; slug: string; color: string; createdAt: string }>>(
        "/api/calendars",
      )
    },
    retry: 1,
  })

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-2">Error loading calendars</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      </div>
    )
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
        <main
          className="flex-1 overflow-auto transition-all duration-300"
          style={{
            marginRight: isChatOpen ? "24rem" : "0",
          }}
        >
          <Outlet />
        </main>
        {currentCalendar && (
          <>
            <ChatSidebar
              isOpen={isChatOpen}
              onClose={() => setIsChatOpen(false)}
              calendarId={currentCalendar.id}
            />
            <ChatToggleButton
              onClick={() => setIsChatOpen(!isChatOpen)}
              isOpen={isChatOpen}
            />
          </>
        )}
      </div>
    </SidebarProvider>
  )
}

