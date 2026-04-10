-- Add cover_image_url column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
