import { useQuery } from "@tanstack/react-query"
import { OrgSettingsView } from "../../components/settings/org-settings-view"
import { useAuth } from "../../lib/auth/context"
import { supabase } from "../../lib/supabase/client"

export default function SettingsPage() {
  const { user } = useAuth()

  const { data: organization } = useQuery<{ id: string; name: string; slug: string; created_at: string; owner_id: string } | null>({
    queryKey: ["organization"],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle()
      if (error) throw error
      return data as { id: string; name: string; slug: string; created_at: string; owner_id: string } | null
    },
    enabled: !!user,
  })

  if (!user || !organization) {
    return <div>Loading...</div>
  }

  const org: { id: string; name: string; slug: string; createdAt: Date; ownerId: string } = {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    createdAt: new Date(organization.created_at),
    ownerId: organization.owner_id,
  }

  return <OrgSettingsView organization={org} currentUserId={user.id} />
}

