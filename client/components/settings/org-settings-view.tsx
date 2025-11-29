import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserPlus, Trash2 } from "lucide-react"
import type { Organization } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useOrganization } from "@/lib/hooks/use-organization" // Import the new hook

interface OrgSettingsViewProps {
  organization: Organization
  currentUserId: string
}

export function OrgSettingsView({ organization, currentUserId }: OrgSettingsViewProps) {
  const { toast } = useToast()
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, _setInviteRole] = useState<"admin" | "member">("member")
  const [inviting, setInviting] = useState(false)

  const {
    members,
    isLoadingMembers,
    inviteMember,
    removeMember,
  } = useOrganization()

  const isOwner = organization.ownerId === currentUserId

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return

    setInviting(true)
    try {
      const result = await inviteMember.mutateAsync({
        email: inviteEmail,
        role: inviteRole,
      })

      if (result.type === "direct") {
        toast({
          title: "Member added",
          description: `${inviteEmail} has been added to the organization.`,
        })
      } else {
        toast({
          title: "Invitation sent",
          description: `An invitation has been sent to ${inviteEmail}.`,
        })
      }

      setInviteEmail("")
    } catch (error) {
      console.error('Error inviting member:', error)
      toast({
        title: "Error",
        description: "Failed to invite member. Please try again.",
        variant: "destructive",
      })
    } finally {
      setInviting(false)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember.mutateAsync(memberId)

      toast({
        title: "Member removed",
        description: "The member has been removed from the organization.",
      })
    } catch (error) {
      console.error('Error removing member:', error)
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="h-full overflow-auto p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{organization.name}</h1>
          <p className="mt-2 text-muted-foreground">Manage your organization settings and members</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
            <CardDescription>Basic information about your organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input value={organization.name} disabled />
            </div>
            <div className="space-y-2">
              <Label>URL Slug</Label>
              <Input value={organization.slug} disabled />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage who has access to this organization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isOwner && (
              <form onSubmit={handleInvite} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={inviting}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {inviting ? "Inviting..." : "Invite"}
                </Button>
              </form>
            )}

            <div className="space-y-2">
              {isLoadingMembers ? (
                <p className="text-sm text-muted-foreground">Loading members...</p>
              ) : (
                members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-sm font-medium text-primary">
                        {member.profiles.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{member.profiles.name}</p>
                      <p className="text-xs text-muted-foreground">{member.profiles.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      {member.role}
                    </span>
                    {isOwner && member.user_id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(member.id)}
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
