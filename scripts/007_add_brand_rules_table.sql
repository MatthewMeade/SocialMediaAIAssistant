-- Create brand_rules table
CREATE TABLE IF NOT EXISTS brand_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_brand_rules_calendar ON brand_rules(calendar_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_brand_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER brand_rules_updated_at
  BEFORE UPDATE ON brand_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_brand_rules_updated_at();

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE brand_rules;
