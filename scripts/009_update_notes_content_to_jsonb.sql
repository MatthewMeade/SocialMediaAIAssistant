-- Update notes table to use JSONB for Slate content
-- This migration converts the content column from TEXT to JSONB

-- Truncate the table to clear existing data
TRUNCATE TABLE notes;

-- Drop and recreate the column with JSONB type
-- Since table is empty, this is the simplest approach
ALTER TABLE notes DROP COLUMN content;
ALTER TABLE notes ADD COLUMN content JSONB DEFAULT '[]'::jsonb;

-- Column is already nullable and has default value from ADD COLUMN above

