import { useState, useEffect } from "react"
import { User, Lock, Palette, Save, Upload } from "lucide-react"
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
import { apiPost } from "@/lib/api-client"
import { ApiRoutes } from "@/lib/api-routes"
import { useToast } from "@/hooks/use-toast"
import { useProfile, type ProfileUpdate } from "@/lib/hooks/use-profile"
import { useCalendars } from "@/lib/hooks/use-calendars"

interface ProfileViewProps {
  currentUser: { id: string; name: string; email: string }
}

export function ProfileView({ currentUser }: ProfileViewProps) {
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { profile, isLoading: isLoadingProfile, updateProfile } = useProfile()
  const { calendars, isLoading: isLoadingCalendars } = useCalendars()

  const [savingProfile, setSavingProfile] = useState(false)
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const [formState, setFormState] = useState({
    name: currentUser.name,
    email: currentUser.email,
    bio: "",
    avatar_url: "",
    timezone: "America/New_York",
    language: "en",
    theme: theme || "system",
    compact_mode: false,
  })

  useEffect(() => {
    if (profile) {
      setFormState({
        name: profile.name || currentUser.name,
        email: profile.email || currentUser.email,
        bio: profile.bio || "",
        avatar_url: profile.avatar_url || "",
        timezone: profile.timezone || "America/New_York",
        language: profile.language || "en",
        theme: profile.theme || theme || "system",
        compact_mode: profile.compact_mode || false,
      })
      // Apply theme if it's different from current
      if (profile.theme && profile.theme !== theme) {
        setTheme(profile.theme)
      }
    }
  }, [profile, currentUser.name, currentUser.email, theme, setTheme])

  const handleProfileChange = (field: keyof typeof formState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const updates: ProfileUpdate = {
        name: formState.name,
        email: formState.email,
        bio: formState.bio,
        timezone: formState.timezone,
        language: formState.language,
      }
      await updateProfile.mutateAsync(updates)

      toast({
        title: "Profile saved",
        description: "Your profile has been updated successfully.",
      })
    } catch (error) {
      console.error("Error saving profile:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save profile. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveAppearance = async () => {
    setSavingAppearance(true)
    try {
      setTheme(formState.theme)
      const updates: ProfileUpdate = {
        theme: formState.theme,
        compact_mode: formState.compact_mode,
      }
      await updateProfile.mutateAsync(updates)

      toast({
        title: "Appearance saved",
        description: "Your appearance preferences have been updated.",
      })
    } catch (error) {
      console.error("Error saving appearance:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save appearance. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingAppearance(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Get the first calendar for avatar upload (calendarId is required for all uploads)
    const firstCalendar = calendars?.[0]
    if (!firstCalendar) {
      toast({
        title: "Error",
        description: "Please create a calendar before uploading an avatar.",
        variant: "destructive",
      })
      return
    }

    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("calendarId", firstCalendar.id)

      const { url } = await apiPost<{ url: string }>(ApiRoutes.UPLOAD, formData)
      await updateProfile.mutateAsync({ avatar_url: url })

      setFormState({ ...formState, avatar_url: url })
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
      })
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: "Error",
        description: "Failed to upload avatar. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (isLoadingProfile || isLoadingCalendars) {
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
                  <AvatarImage src={formState.avatar_url || "/placeholder.svg"} />
                  <AvatarFallback>{formState.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
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
                    value={formState.name}
                    onChange={(e) => handleProfileChange("name", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formState.email}
                    onChange={(e) => handleProfileChange("email", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={formState.bio}
                    onChange={(e) => handleProfileChange("bio", e.target.value)}
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
                      value={formState.timezone}
                      onValueChange={(value) => handleProfileChange("timezone", value)}
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
                      value={formState.language}
                      onValueChange={(value) => handleProfileChange("language", value)}
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

              <Button onClick={handleSaveProfile} disabled={savingProfile} className="gap-2">
                <Save className="h-4 w-4" />
                {savingProfile ? "Saving..." : "Save Profile"}
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
                    value={formState.theme}
                    onValueChange={(value) => handleProfileChange("theme", value)}
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
                    checked={formState.compact_mode}
                    onCheckedChange={(checked) => handleProfileChange("compact_mode", checked)}
                  />
                </div>
              </div>

              <Button onClick={handleSaveAppearance} disabled={savingAppearance} className="gap-2">
                <Save className="h-4 w-4" />
                {savingAppearance ? "Saving..." : "Save Appearance"}
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
