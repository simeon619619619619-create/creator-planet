-- Add sidebar_hidden_sections to communities
-- Stores View IDs hidden from members. Empty array = all sections visible.
ALTER TABLE public.communities
ADD COLUMN IF NOT EXISTS sidebar_hidden_sections text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.communities.sidebar_hidden_sections IS
  'Array of sidebar section IDs (View enum values) hidden from members. Creators always see all sections.';
