ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS background_elements JSONB DEFAULT '[]'::jsonb;
