import type React from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { useAuth } from "../lib/auth/context"
import LoginPage from "./pages/login"
import CalendarPage from "./pages/calendar"
import LibraryPage from "./pages/library"
import BrandVoicePage from "./pages/brand-voice"
import ProfilePage from "./pages/profile"
import SettingsPage from "./pages/settings"
import AppLayout from "../components/layout/app-layout"

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RootRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If user is authenticated, fetch calendars and redirect to first calendar
  // This will be handled by the login page's redirect logic if needed
  // For now, redirect to a default calendar route
  return <Navigate to="/default/calendar" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/:calendarSlug/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route path="brand-voice" element={<BrandVoicePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="/" element={<RootRedirect />} />
    </Routes>
  )
}
