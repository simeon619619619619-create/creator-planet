-- Add slug column to communities for friendly URLs
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- Create unique index on slug (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS communities_slug_unique ON public.communities (slug) WHERE slug IS NOT NULL;

-- Generate slugs for existing communities using id suffix to avoid duplicates
UPDATE public.communities
SET slug = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
) || '-' || SUBSTRING(id::text, 1, 8)
WHERE slug IS NULL;

-- Trim leading/trailing dashes
UPDATE public.communities
SET slug = TRIM(BOTH '-' FROM slug)
WHERE slug IS NOT NULL;
