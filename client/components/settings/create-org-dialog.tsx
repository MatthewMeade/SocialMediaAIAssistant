import type React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Organization } from "@/lib/types"

interface CreateOrgDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateOrg: (org: Omit<Organization, "id" | "createdAt">) => void
  currentUserId: string
}

export function CreateOrgDialog({ open, onOpenChange, onCreateOrg, currentUserId }: CreateOrgDialogProps) {
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name && slug) {
      onCreateOrg({
        name,
        slug: slug.toLowerCase().replace(/\s+/g, "-"),
        ownerId: currentUserId,
      })
      setName("")
      setSlug("")
      onOpenChange(false)
    }
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (!slug || slug === name.toLowerCase().replace(/\s+/g, "-")) {
      setSlug(value.toLowerCase().replace(/\s+/g, "-"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Create a new organization to manage your social media calendars and team.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              placeholder="Acme Inc."
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org-slug">URL Slug</Label>
            <Input
              id="org-slug"
              placeholder="acme-inc"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">This will be used in your organization's URL</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create Organization</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
