import type React from "react"

import { useState, useEffect } from "react"
import { User, Bell, Lock, Palette, Save, Upload } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/client"
import { apiGet, apiPost, apiPut } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"

interface ProfileViewProps {
  currentUser: { id: string; name: string; email: string }
}

export function ProfileView({ currentUser }: ProfileViewProps) {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [profile, setProfile] = useState({
    name: currentUser.name,
    email: currentUser.email,
    bio: "",
    avatar_url: "",
    timezone: "America/New_York",
    language: "en",
  })

  const [notifications, setNotifications] = useState({
    email_notifications: true,
    push_notifications: true,
    post_reminders: true,
    weekly_reports: false,
    new_messages: true,
    new_comments: true,
  })

  const [appearance, setAppearance] = useState({
    theme: theme || "system",
    compact_mode: false,
  })

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single()

      if (data && typeof data === 'object') {
        const profileData = data as {
          name: string
          email: string
          bio: string | null
          avatar_url: string | null
          timezone: string | null
          language: string | null
          email_notifications: boolean | null
          push_notifications: boolean | null
          post_reminders: boolean | null
          weekly_reports: boolean | null
          new_messages: boolean | null
          new_comments: boolean | null
          theme: string | null
          compact_mode: boolean | null
        }
        setProfile({
          name: profileData.name || currentUser.name,
          email: profileData.email || currentUser.email,
          bio: profileData.bio || "",
          avatar_url: profileData.avatar_url || "",
          timezone: profileData.timezone || "America/New_York",
          language: profileData.language || "en",
        })
        setNotifications({
          email_notifications: profileData.email_notifications ?? true,
          push_notifications: profileData.push_notifications ?? true,
          post_reminders: profileData.post_reminders ?? true,
          weekly_reports: profileData.weekly_reports ?? false,
          new_messages: profileData.new_messages ?? true,
          new_comments: profileData.new_comments ?? true,
        })
        setAppearance({
          theme: profileData.theme || theme || "system",
          compact_mode: profileData.compact_mode || false,
        })
      }
      setLoading(false)
    }

    loadProfile()
  }, [currentUser.id, currentUser.name, currentUser.email, theme])

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await apiPut("/api/profile", profile)

      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setSaving(true)
    try {
      await apiPut("/api/profile", notifications)

      toast({
        title: "Notifications saved",
        description: "Your notification preferences have been updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save notifications. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAppearance = async () => {
    setSaving(true)
    try {
      setTheme(appearance.theme)
      await apiPut("/api/profile", appearance)

      toast({
        title: "Appearance saved",
        description: "Your appearance preferences have been updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save appearance. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const { url } = await apiPost<{ url: string }>("/api/upload", formData)
      await apiPut("/api/profile", { avatar_url: url })

      setProfile({ ...profile, avatar_url: url })
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-card px-6 py-4">
        <h1 className="text-2xl font-semibold text-foreground">Profile & Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>Update your personal information and profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback>{profile.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <Label htmlFor="avatar-upload">
                    <Button variant="outline" size="sm" disabled={uploadingAvatar} asChild>
                      <span className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        {uploadingAvatar ? "Uploading..." : "Change Avatar"}
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <p className="text-xs text-muted-foreground mt-2">JPG, PNG or GIF. Max size 2MB.</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="min-h-[100px] resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Brief description for your profile. Max 200 characters.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={profile.timezone}
                      onValueChange={(value) => setProfile({ ...profile, timezone: value })}
                    >
                      <SelectTrigger id="timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={profile.language}
                      onValueChange={(value) => setProfile({ ...profile, language: value })}
                    >
                      <SelectTrigger id="language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="fr">French</SelectItem>
                        <SelectItem value="de">German</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={notifications.email_notifications}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, email_notifications: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="push-notifications">Push Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive push notifications in your browser</p>
                  </div>
                  <Switch
                    id="push-notifications"
                    checked={notifications.push_notifications}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, push_notifications: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="post-reminders">Post Reminders</Label>
                    <p className="text-sm text-muted-foreground">Get reminders for scheduled posts</p>
                  </div>
                  <Switch
                    id="post-reminders"
                    checked={notifications.post_reminders}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, post_reminders: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="weekly-reports">Weekly Reports</Label>
                    <p className="text-sm text-muted-foreground">Receive weekly performance reports</p>
                  </div>
                  <Switch
                    id="weekly-reports"
                    checked={notifications.weekly_reports}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, weekly_reports: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="new-messages">New Messages</Label>
                    <p className="text-sm text-muted-foreground">Notify when you receive new messages</p>
                  </div>
                  <Switch
                    id="new-messages"
                    checked={notifications.new_messages}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, new_messages: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="new-comments">New Comments</Label>
                    <p className="text-sm text-muted-foreground">Notify when you receive new comments</p>
                  </div>
                  <Switch
                    id="new-comments"
                    checked={notifications.new_comments}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, new_comments: checked })}
                  />
                </div>
              </div>

              <Button onClick={handleSaveNotifications} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Notifications"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>Customize how the app looks and feels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme">Theme</Label>
                  <Select
                    value={appearance.theme}
                    onValueChange={(value) => setAppearance({ ...appearance, theme: value })}
                  >
                    <SelectTrigger id="theme">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Choose your preferred color theme</p>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="compact-mode">Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">Use a more condensed layout</p>
                  </div>
                  <Switch
                    id="compact-mode"
                    checked={appearance.compact_mode}
                    onCheckedChange={(checked) => setAppearance({ ...appearance, compact_mode: checked })}
                  />
                </div>
              </div>

              <Button onClick={handleSaveAppearance} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save Appearance"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Security
              </CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline">Change Password</Button>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Connected Accounts</h4>
                <p className="text-sm text-muted-foreground">Social media account connections coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
