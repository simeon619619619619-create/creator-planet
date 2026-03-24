-- Clean up community slugs: remove UUID suffixes for communities with unique names
-- First, generate clean slugs from names (skip communities with empty/null names)
UPDATE public.communities
SET slug = TRIM(BOTH '-' FROM LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    ),
    '-+', '-', 'g'
  )
))
WHERE slug IS NOT NULL
  AND name IS NOT NULL
  AND TRIM(name) != ''
  AND TRIM(BOTH '-' FROM LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        REGEXP_REPLACE(name, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      ),
      '-+', '-', 'g'
    )
  )) != '';

-- Set slug to NULL for communities with empty generated slugs
UPDATE public.communities
SET slug = NULL
WHERE slug = '' OR slug IS NOT NULL AND TRIM(slug) = '';

-- For any duplicates that resulted, append a short numeric suffix
WITH dupes AS (
  SELECT id, slug, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) as rn
  FROM public.communities
  WHERE slug IS NOT NULL
)
UPDATE public.communities c
SET slug = c.slug || '-' || d.rn
FROM dupes d
WHERE c.id = d.id AND d.rn > 1;
