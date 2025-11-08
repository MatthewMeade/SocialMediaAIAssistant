-- Create community_members table
CREATE TABLE IF NOT EXISTS community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  stats_comments INTEGER DEFAULT 0,
  stats_mentions INTEGER DEFAULT 0,
  stats_dms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create inbox_messages table
CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  type TEXT NOT NULL CHECK (type IN ('comment', 'dm', 'mention')),
  content TEXT NOT NULL,
  post_id TEXT,
  post_caption TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'twitter', 'linkedin')),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  sentiment_overridden BOOLEAN DEFAULT FALSE,
  replied BOOLEAN DEFAULT FALSE,
  draft TEXT,
  liked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create member_notes table
CREATE TABLE IF NOT EXISTS member_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES community_members(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_responses table
CREATE TABLE IF NOT EXISTS saved_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  guidelines TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_community_members_calendar ON community_members(calendar_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_calendar ON inbox_messages(calendar_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_user ON inbox_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_member_notes_calendar ON member_notes(calendar_id);
CREATE INDEX IF NOT EXISTS idx_member_notes_member ON member_notes(member_id);
CREATE INDEX IF NOT EXISTS idx_saved_responses_calendar ON saved_responses(calendar_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_community_members_updated_at
  BEFORE UPDATE ON community_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inbox_messages_updated_at
  BEFORE UPDATE ON inbox_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_member_notes_updated_at
  BEFORE UPDATE ON member_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE community_members;
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE member_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE saved_responses;
