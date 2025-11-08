import { useState } from "react"
import { useNavigate, useLocation, useParams } from "react-router-dom"
import {
  Calendar,
  ImageIcon,
  ChevronLeft,
  ChevronRight,
  Bell,
  LogOut,
  Settings,
  Sparkles,
  ChevronDown,
  Plus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { CreateCalendarDialog } from "@/components/settings/create-calendar-dialog"
import { apiPost } from "@/lib/api-client"

interface AppSidebarProps {
  calendars: Array<{
    id: string
    name: string
    slug: string
    color: string
  }>
  currentCalendar: {
    id: string
    name: string
    slug: string
    color: string
  } | undefined
}

const sections = [
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "library", label: "Library", icon: ImageIcon },
  { id: "brand-voice", label: "Brand Voice", icon: Sparkles },
]

export function AppSidebar({ calendars, currentCalendar }: AppSidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { calendarSlug } = useParams()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [showCreateCalendar, setShowCreateCalendar] = useState(false)

  const currentSection = location.pathname.split("/").pop() || "calendar"

  const handleSectionChange = (sectionId: string) => {
    if (calendarSlug) {
      navigate(`/${calendarSlug}/${sectionId}`)
    }
  }

  const handleCalendarChange = (calendarSlug: string) => {
    navigate(`/${calendarSlug}/${currentSection}`)
  }

  const handleCreateCalendar = async (data: { name: string; color: string }) => {
    try {
      const newCalendar = await apiPost<{ id: string; name: string; slug: string; color: string }>(
        "/api/calendars",
        data,
      )

      navigate(`/${newCalendar.slug}/calendar`)
    } catch (error) {
      console.error("Error creating calendar:", error)
      throw error
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    navigate("/login")
  }

  return (
    <>
      <aside
        className={cn(
          "flex h-screen flex-col border-r border-border bg-card transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          {!isCollapsed && <h1 className="text-lg font-semibold text-foreground">Social Hub</h1>}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        {!isCollapsed && (
          <div className="border-b border-border p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-left transition-colors hover:bg-accent">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: currentCalendar?.color || "#3b82f6" }}
                    />
                    <span className="text-sm font-medium text-foreground truncate">
                      {currentCalendar?.name || "Select Calendar"}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                {calendars.map((calendar) => (
                  <DropdownMenuItem
                    key={calendar.id}
                    onClick={() => handleCalendarChange(calendar.slug)}
                    className={cn(calendarSlug === calendar.slug && "bg-accent")}
                  >
                    <div className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: calendar.color }} />
                    {calendar.name}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowCreateCalendar(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Calendar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <nav className="flex-1 space-y-1 p-3">
          {sections.map((section) => {
            const Icon = section.icon
            const isActive = currentSection === section.id

            return (
              <button
                key={section.id}
                onClick={() => handleSectionChange(section.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!isCollapsed && <span>{section.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-border p-3">
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent">
                    <Avatar className="h-8 w-8 shrink-0 bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-medium text-primary">U</span>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">User</p>
                      <p className="text-xs text-muted-foreground truncate">user@example.com</p>
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => calendarSlug && navigate(`/${calendarSlug}/profile`)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="relative shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Bell className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                    <Avatar className="h-7 w-7 bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary">U</span>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-foreground">User</p>
                    <p className="text-xs text-muted-foreground">user@example.com</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => calendarSlug && navigate(`/${calendarSlug}/profile`)}>
                    <Settings className="mr-2 h-4 w-4" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="relative shrink-0">
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Bell className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <CreateCalendarDialog
        open={showCreateCalendar}
        onOpenChange={setShowCreateCalendar}
        onCreateCalendar={handleCreateCalendar}
      />
    </>
  )
}
