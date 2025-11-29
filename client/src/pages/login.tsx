import type React from "react"
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../../lib/auth/context"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { apiGet } from "../../lib/api-client"
import { ApiRoutes } from "../../lib/api-routes"
import { supabase } from "../../lib/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && user) {
      apiGet<Array<{ id: string; name: string; slug: string; color: string; createdAt: string }>>(
        ApiRoutes.CALENDARS
      )
        .then((calendars) => {
          if (calendars && calendars.length > 0) {
            navigate(`/${calendars[0].slug}/calendar`, { replace: true })
          } else {
            navigate("/default/settings", { replace: true })
          }
        })
        .catch(() => {
          navigate("/default/settings", { replace: true })
        })
    }
  }, [user, authLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw signInError
      }

      if (!signInData.session) {
        throw new Error("No session returned from sign in")
      }

      await new Promise((resolve) => setTimeout(resolve, 100))

      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session) {
        throw new Error("Failed to establish session")
      }

      const calendars = await apiGet<Array<{ id: string; name: string; slug: string; color: string; createdAt: string }>>(
        ApiRoutes.CALENDARS
      )

      if (calendars && calendars.length > 0) {
        navigate(`/${calendars[0].slug}/calendar`, { replace: true })
      } else {
        navigate("/default/settings", { replace: true })
      }
    } catch (error: any) {
      console.error("Login error:", error)
      setError(error.message || "Failed to login")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to your social media calendar</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
