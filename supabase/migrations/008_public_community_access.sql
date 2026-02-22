-- ============================================================================
-- MIGRATION 008: PUBLIC COMMUNITY ACCESS
-- ============================================================================
-- Enable anonymous users to view public communities and limited preview data
-- This supports public community landing pages for marketing/discovery
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Grant anonymous role access to public schema
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.communities TO anon;
GRANT SELECT ON public.community_channels TO anon;
GRANT SELECT ON public.posts TO anon;
GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.creator_profiles TO anon;
GRANT SELECT ON public.memberships TO anon;

-- ----------------------------------------------------------------------------
-- RLS: communities - Allow anon to view public communities
-- ----------------------------------------------------------------------------
CREATE POLICY "Anon can view public communities"
  ON public.communities FOR SELECT
  TO anon
  USING (is_public = true);

-- ----------------------------------------------------------------------------
-- RLS: community_channels - Allow anon to view channels in public communities
-- ----------------------------------------------------------------------------
CREATE POLICY "Anon can view channels in public communities"
  ON public.community_channels FOR SELECT
  TO anon
  USING (
    community_id IN (
      SELECT id FROM public.communities WHERE is_public = true
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: posts - Allow anon to view posts in public community channels
-- ----------------------------------------------------------------------------
CREATE POLICY "Anon can view posts in public communities"
  ON public.posts FOR SELECT
  TO anon
  USING (
    channel_id IN (
      SELECT cc.id FROM public.community_channels cc
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.is_public = true
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: post_likes - Allow anon to view like counts (for post previews)
-- ----------------------------------------------------------------------------
CREATE POLICY "Anon can view likes in public communities"
  ON public.post_likes FOR SELECT
  TO anon
  USING (
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.is_public = true
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: post_comments - Allow anon to view comment counts (for post previews)
-- ----------------------------------------------------------------------------
CREATE POLICY "Anon can view comments in public communities"
  ON public.post_comments FOR SELECT
  TO anon
  USING (
    post_id IN (
      SELECT p.id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.is_public = true
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: profiles - Allow anon to view basic profile info for authors
-- ----------------------------------------------------------------------------
CREATE POLICY "Anon can view public profile info"
  ON public.profiles FOR SELECT
  TO anon
  USING (
    id IN (
      -- Post authors in public communities
      SELECT DISTINCT p.author_id FROM public.posts p
      JOIN public.community_channels cc ON cc.id = p.channel_id
      JOIN public.communities c ON c.id = cc.community_id
      WHERE c.is_public = true
      UNION
      -- Community creators
      SELECT creator_id FROM public.communities WHERE is_public = true
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: creator_profiles - Allow anon to view creator profiles for public communities
-- ----------------------------------------------------------------------------
CREATE POLICY "Anon can view creator profiles for public communities"
  ON public.creator_profiles FOR SELECT
  TO anon
  USING (
    creator_id IN (
      SELECT creator_id FROM public.communities WHERE is_public = true
    )
  );

-- ----------------------------------------------------------------------------
-- RLS: memberships - Allow anon to count members (for social proof)
-- ----------------------------------------------------------------------------
CREATE POLICY "Anon can view membership counts in public communities"
  ON public.memberships FOR SELECT
  TO anon
  USING (
    community_id IN (
      SELECT id FROM public.communities WHERE is_public = true
    )
  );

-- ----------------------------------------------------------------------------
-- Performance Indexes: Optimize public community queries
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS communities_is_public_created_at_idx
  ON public.communities(is_public, created_at DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS memberships_community_id_count_idx
  ON public.memberships(community_id);

CREATE INDEX IF NOT EXISTS posts_channel_id_created_idx
  ON public.posts(channel_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- Completion notice
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  RAISE NOTICE 'Migration 008: Public Community Access policies applied';
  RAISE NOTICE 'Anonymous users can now view public communities and previews';
END $$;
