-- Add theme_color column to communities for creator page customization
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS theme_color TEXT DEFAULT NULL;

-- Allow any authenticated user to read theme_color (already covered by existing SELECT policies)
-- No new policy needed since existing community SELECT policies cover all columns
