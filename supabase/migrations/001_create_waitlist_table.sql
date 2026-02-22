-- Create waitlist table for email capture
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  interest TEXT NOT NULL CHECK (interest IN ('creator', 'coach', 'mentor', 'student', 'other')),
  source TEXT NOT NULL DEFAULT 'landing_page',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_interest ON waitlist(interest);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_source ON waitlist(source);

-- Enable Row Level Security (RLS)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert (for public signup)
CREATE POLICY "Anyone can sign up for waitlist"
  ON waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users can view entries (for admin dashboard)
CREATE POLICY "Authenticated users can view waitlist"
  ON waitlist
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only authenticated users can delete entries (for admin)
CREATE POLICY "Authenticated users can delete waitlist entries"
  ON waitlist
  FOR DELETE
  TO authenticated
  USING (true);

-- Add comment for documentation
COMMENT ON TABLE waitlist IS 'Stores email signups for product waitlist from landing page';
COMMENT ON COLUMN waitlist.email IS 'User email address (unique, required)';
COMMENT ON COLUMN waitlist.name IS 'User name (optional)';
COMMENT ON COLUMN waitlist.interest IS 'User type: creator, coach, mentor, student, or other';
COMMENT ON COLUMN waitlist.source IS 'Source of signup (landing_page, referral, etc.)';
COMMENT ON COLUMN waitlist.created_at IS 'Timestamp when user joined waitlist';
