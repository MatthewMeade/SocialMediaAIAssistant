import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { useNavigate } from "react-router-dom"

export function LoginForm() {
  const [mode, setMode] = useState<"login" | "signup">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [orgName, setOrgName] = useState("")
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    const supabase = createClient()

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        navigate("/")
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name,
              org_name: orgName,
            },
            emailRedirectTo: import.meta.env.VITE_SUPABASE_REDIRECT_URL || window.location.origin,
          },
        })
        if (error) throw error
        navigate("/")
      }
    } catch (err) {
      console.error("[v0] Auth error:", err)
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-border bg-card p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground">Social Hub</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" ? "Welcome back! Log in to continue" : "Create your account to get started"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
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
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                type="text"
                placeholder="Your company or team name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">This will be your workspace for managing social media</p>
            </div>
          )}

          {mode === "login" && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                Remember me
              </Label>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading
              ? mode === "login"
                ? "Logging in..."
                : "Creating account..."
              : mode === "login"
                ? "Log In"
                : "Create Account"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login")
              setError(null)
            }}
            className="text-primary hover:underline"
          >
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
          </button>
        </div>
      </Card>
    </div>
  )
}
