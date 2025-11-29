import { useState, createContext, useContext, useCallback, useMemo, useEffect, startTransition } from "react"
import { Outlet, useParams, Navigate, useLocation } from "react-router-dom"
import { SidebarProvider } from "../ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { ChatSidebar } from "../chat/chat-sidebar"
import { ChatToggleButton } from "../chat/chat-toggle-button"
import { useCalendars } from "@/lib/hooks/use-calendars"
import { useAppEvent } from "@/hooks/use-app-event"
import { AppEvents } from "@/lib/events"

interface IClientContext {
  page: string
  calendarId: string | null
  pageState: any
}

interface IAppContext {
  clientContext: IClientContext
  setClientContext: (page: string, pageState: any) => void
}

const AppContext = createContext<IAppContext | null>(null)

export const useAppContext = () => {
  const context = useContext(AppContext)
  if (!context) throw new Error("useAppContext must be used within AppProvider")
  return context
}

export default function AppLayout() {
  const { calendarSlug } = useParams()
  const location = useLocation()
  const [isChatOpen, setIsChatOpen] = useState(false)

  const [pageOverride, setPageOverride] = useState<string | null>(null)
  const [pageState, setPageState] = useState<any>(null)

  const setClientContext = useCallback((page: string, newPageState: any) => {
    setPageOverride(page)
    setPageState(newPageState)
  }, [])

  const { calendars, isLoading, error } = useCalendars()

  const mappedCalendars = calendars

  const currentCalendar = mappedCalendars?.find((c) => c.slug === calendarSlug)

  const basePage = useMemo(() => {
    if (location.pathname.includes("/brand-voice")) {
      return "brandVoice"
    } else if (location.pathname.includes("/library")) {
      return "library"
    } else if (location.pathname.includes("/notes")) {
      return "notes"
    }
    return "calendar"
  }, [location.pathname])

  useEffect(() => {
    if (pageOverride && pageOverride !== basePage && basePage !== "calendar") {
      startTransition(() => {
        setPageOverride(null)
        setPageState(null)
      })
    }
  }, [basePage, pageOverride])

  const page = pageOverride || basePage

  const clientContext = useMemo<IClientContext>(
    () => ({
      page,
      calendarId: currentCalendar?.id || null,
      pageState,
    }),
    [page, currentCalendar?.id, pageState],
  )

  useAppEvent(AppEvents.TRIGGER_AI_CHAT, () => {
    if (!isChatOpen) {
      setIsChatOpen(true)
    }
  }, [isChatOpen])

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

  if (!currentCalendar && calendarSlug && mappedCalendars && mappedCalendars.length > 0) {
    return <Navigate to={`/${mappedCalendars[0].slug}/calendar`} replace />
  }

  if (!calendarSlug && mappedCalendars && mappedCalendars.length > 0) {
    return <Navigate to={`/${mappedCalendars[0].slug}/calendar`} replace />
  }

  return (
    <AppContext.Provider value={{ clientContext, setClientContext }}>
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
          {/* Always render ChatSidebar to avoid hook order issues, but only show when calendar exists */}
          <ChatSidebar
            isOpen={isChatOpen && !!currentCalendar}
            onClose={() => setIsChatOpen(false)}
          />
          {currentCalendar && (
            <ChatToggleButton
              onClick={() => setIsChatOpen(!isChatOpen)}
              isOpen={isChatOpen}
            />
          )}
        </div>
      </SidebarProvider>
    </AppContext.Provider>
  )
}

