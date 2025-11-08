import { ProfileView } from "../../components/profile/profile-view"
import { useAuth } from "../../lib/auth/context"

export default function ProfilePage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <div>Not authenticated</div>
  }

  const currentUser = {
    id: user.id,
    name: user.user_metadata?.name || user.email || "User",
    email: user.email || "",
  }

  return <ProfileView currentUser={currentUser} />
}

