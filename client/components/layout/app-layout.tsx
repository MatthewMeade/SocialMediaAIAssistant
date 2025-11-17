import { useState, createContext, useContext, useCallback, useMemo, useEffect, startTransition } from "react"
import { Outlet, useParams, Navigate, useLocation } from "react-router-dom"
import { SidebarProvider } from "../ui/sidebar"
import { AppSidebar } from "./app-sidebar"
import { ChatSidebar } from "../chat/chat-sidebar"
import { ChatToggleButton } from "../chat/chat-toggle-button"
import { useCalendars } from "@/lib/hooks/use-calendars" // Import the new hook

// 1. Define the context state
interface IClientContext {
  page: string // e.g., "calendar", "postEditor", "brandVoice"
  calendarId: string | null
  pageState: any // Page-specific state (e.g., { postId: "..." } for postEditor)
}

// 2. Define the context value
interface IAppContext {
  clientContext: IClientContext
  // Allows any component to set/update the context
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

  // Store page override and pageState in state (set by child components)
  // Base page is calculated from location, but can be overridden (e.g., "postEditor")
  const [pageOverride, setPageOverride] = useState<string | null>(null)
  const [pageState, setPageState] = useState<any>(null)

  // 3. Create a stable setter function
  // Child components can override the page (e.g., set to "postEditor" when modal opens)
  const setClientContext = useCallback((page: string, newPageState: any) => {
    setPageOverride(page)
    setPageState(newPageState)
  }, [])

  // Use the new hook to fetch calendars
  const { calendars, isLoading, error } = useCalendars()

  // Map to the format expected by AppSidebar (already done by the hook)
  const mappedCalendars = calendars

  const currentCalendar = mappedCalendars?.find((c) => c.slug === calendarSlug)

  // Calculate base page from location during render (no Effect needed)
  // This follows React best practices: calculate during render, not in Effects
  // See: https://react.dev/learn/you-might-not-need-an-effect
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

  // Clear page override when base page changes (user navigates to different page)
  // This is the only Effect we need - to clear override on navigation
  // This follows React rules: minimal Effects only when necessary
  useEffect(() => {
    // Clear override if user navigates to a different base page
    // (e.g., from calendar to brandVoice, but allow postEditor on calendar)
    if (pageOverride && pageOverride !== basePage && basePage !== "calendar") {
      startTransition(() => {
        setPageOverride(null)
        setPageState(null)
      })
    }
  }, [basePage, pageOverride])

  // Use page override if set by child component, otherwise use base page
  // This is pure computation during render
  const page = pageOverride || basePage

  // Derive the full clientContext during render (no Effect needed)
  // This is pure computation based on props/state, so it should happen during render
  // See: https://react.dev/reference/rules
  const clientContext = useMemo<IClientContext>(
    () => ({
      page,
      calendarId: currentCalendar?.id || null,
      pageState,
    }),
    [page, currentCalendar?.id, pageState],
  )

  // Early returns AFTER all hooks
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

