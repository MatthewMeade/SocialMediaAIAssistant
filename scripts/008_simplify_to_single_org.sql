-- Add slug column to calendars for URL-friendly identifiers
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs from existing calendar names (lowercase, replace spaces with hyphens)
UPDATE calendars 
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug unique and not null
ALTER TABLE calendars ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendars_slug ON calendars(slug);

-- Add user_id to calendars so each calendar belongs directly to a user
ALTER TABLE calendars ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- Migrate existing calendars to be owned by the organization owner
UPDATE calendars c
SET user_id = o.owner_id
FROM organizations o
WHERE c.organization_id = o.id AND c.user_id IS NULL;

-- Make user_id not null
ALTER TABLE calendars ALTER COLUMN user_id SET NOT NULL;

-- Add index for user_id lookups
CREATE INDEX IF NOT EXISTS idx_calendars_user ON calendars(user_id);

-- Make organization_id nullable since we're removing multi-org support
ALTER TABLE calendars ALTER COLUMN organization_id DROP NOT NULL;

-- Fixed DROP POLICY statements to match actual policy names
DROP POLICY IF EXISTS "Users can view their own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can create their own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can update their own calendars" ON calendars;
DROP POLICY IF EXISTS "Users can delete their own calendars" ON calendars;

CREATE POLICY "Users can view their own calendars"
  ON calendars FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own calendars"
  ON calendars FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendars"
  ON calendars FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendars"
  ON calendars FOR DELETE
  USING (auth.uid() = user_id);
