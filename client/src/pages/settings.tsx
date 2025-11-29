import { OrgSettingsView } from "../../components/settings/org-settings-view"
import { useAuth } from "../../lib/auth/context"
import { useOrganization } from "@/lib/hooks/use-organization"

export default function SettingsPage() {
  const { user } = useAuth()
  const { organization, isLoadingOrg } = useOrganization()

  if (isLoadingOrg || !user) {
    return <div>Loading...</div>
  }

  if (!organization) {
    return <div>No organization found.</div>
  }

  return <OrgSettingsView organization={organization} currentUserId={user.id} />
}

