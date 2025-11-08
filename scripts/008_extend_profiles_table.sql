-- Add extended profile fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS push_notifications BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS post_reminders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_reports BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS new_messages BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS new_comments BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'system',
ADD COLUMN IF NOT EXISTS compact_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profiles_updated_at();

-- Create invitations table for organization member invites
CREATE TABLE IF NOT EXISTS organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted BOOLEAN DEFAULT false,
  UNIQUE(organization_id, email)
);

-- Create index for invitations
CREATE INDEX IF NOT EXISTS idx_invitations_org ON organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON organization_invitations(email);

-- Enable Realtime for profiles and invitations
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE organization_invitations;
