-- ============================================================================
-- Migration 043: Residents System
-- AI personas that post and comment in communities as if they were real users.
-- Hidden mode (no AI disclosure). Per-community customization. Random scheduling.
-- ============================================================================

-- pgvector for knowledge base embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ----------------------------------------------------------------------------
-- profiles: flag to identify AI personas (hidden from end users)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_persona BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_is_persona_idx ON public.profiles(is_persona) WHERE is_persona = true;

COMMENT ON COLUMN public.profiles.is_persona IS 'Internal flag — true for AI residents. NEVER expose to client UI.';

-- ----------------------------------------------------------------------------
-- community_personas: 7 personas per community
-- ----------------------------------------------------------------------------
CREATE TABLE public.community_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  archetype TEXT NOT NULL CHECK (archetype IN (
    'newbie', 'rising_star', 'skeptic', 'empath', 'expert', 'lurker', 'connector'
  )),
  display_name TEXT NOT NULL,
  bio TEXT NOT NULL,
  style_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  topics TEXT[] DEFAULT ARRAY[]::TEXT[],
  uses_latin BOOLEAN DEFAULT false NOT NULL,
  short_long_ratio NUMERIC(3,2) DEFAULT 0.5 CHECK (short_long_ratio BETWEEN 0 AND 1),
  intensity TEXT DEFAULT 'normal' CHECK (intensity IN ('quiet', 'normal', 'active')),
  is_active BOOLEAN DEFAULT true NOT NULL,
  last_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX community_personas_community_id_idx ON public.community_personas(community_id);
CREATE INDEX community_personas_profile_id_idx ON public.community_personas(profile_id);
CREATE INDEX community_personas_active_idx ON public.community_personas(community_id, is_active) WHERE is_active = true;

COMMENT ON TABLE public.community_personas IS 'AI residents per community. Posts under profile_id are indistinguishable from real users.';
COMMENT ON COLUMN public.community_personas.style_config IS 'JSON: tone, typo_rate, emoji_freq, reply_latency_minutes, vocabulary hints';
COMMENT ON COLUMN public.community_personas.short_long_ratio IS 'Probability of short post (<25 words). 1-this = long (>120 words). No middle.';

-- ----------------------------------------------------------------------------
-- persona_schedule_config: creator's per-community schedule rules
-- ----------------------------------------------------------------------------
CREATE TABLE public.persona_schedule_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL UNIQUE,
  master_enabled BOOLEAN DEFAULT false NOT NULL,
  active_windows JSONB NOT NULL DEFAULT '{"morning":true,"midday":true,"evening":true,"night":false}'::jsonb,
  active_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5,6,0]::INTEGER[],
  global_intensity TEXT DEFAULT 'normal' CHECK (global_intensity IN ('quiet', 'normal', 'active')),
  niche_template TEXT,
  manual_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX persona_schedule_community_id_idx ON public.persona_schedule_config(community_id);
CREATE INDEX persona_schedule_master_enabled_idx ON public.persona_schedule_config(master_enabled) WHERE master_enabled = true;

COMMENT ON TABLE public.persona_schedule_config IS 'Per-community master settings. master_enabled=false → all residents paused.';
COMMENT ON COLUMN public.persona_schedule_config.manual_notes IS 'Creator override notes — passed to AI as system instruction, takes precedence over knowledge base.';
COMMENT ON COLUMN public.persona_schedule_config.active_days IS '0=Sunday, 1=Monday, ..., 6=Saturday';

-- ----------------------------------------------------------------------------
-- community_knowledge: course transcripts, manual notes — embedded for RAG
-- ----------------------------------------------------------------------------
CREATE TABLE public.community_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'course_lesson', 'video_transcript', 'manual_note', 'gdoc'
  )),
  source_ref TEXT,
  title TEXT,
  content TEXT NOT NULL,
  embedding vector(768),
  chunk_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX community_knowledge_community_id_idx ON public.community_knowledge(community_id);
CREATE INDEX community_knowledge_source_idx ON public.community_knowledge(community_id, source_type, source_ref);
CREATE INDEX community_knowledge_embedding_idx ON public.community_knowledge
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMENT ON TABLE public.community_knowledge IS 'RAG corpus — what residents "know" about the community subject matter.';

-- ----------------------------------------------------------------------------
-- persona_memory: what each persona has said / referenced (avoids repetition)
-- ----------------------------------------------------------------------------
CREATE TABLE public.persona_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES public.community_personas(id) ON DELETE CASCADE NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'own_post', 'tagged_user', 'topic_covered', 'reaction_to'
  )),
  content_summary TEXT NOT NULL,
  ref_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  ref_comment_id UUID REFERENCES public.post_comments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX persona_memory_persona_id_idx ON public.persona_memory(persona_id, created_at DESC);
CREATE INDEX persona_memory_type_idx ON public.persona_memory(persona_id, memory_type);

COMMENT ON TABLE public.persona_memory IS 'Persona self-memory. Used to avoid repetition and maintain consistency across actions.';

-- ----------------------------------------------------------------------------
-- persona_activity_log: rate-limit + audit trail
-- ----------------------------------------------------------------------------
CREATE TABLE public.persona_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID REFERENCES public.community_personas(id) ON DELETE CASCADE NOT NULL,
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'post', 'comment', 'tick_skipped', 'tick_decision', 'avatar_generated'
  )),
  channel_id UUID REFERENCES public.community_channels(id) ON DELETE SET NULL,
  ref_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  ref_comment_id UUID REFERENCES public.post_comments(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX persona_activity_persona_id_idx ON public.persona_activity_log(persona_id, created_at DESC);
CREATE INDEX persona_activity_community_id_idx ON public.persona_activity_log(community_id, created_at DESC);
CREATE INDEX persona_activity_action_type_idx ON public.persona_activity_log(action_type);

COMMENT ON TABLE public.persona_activity_log IS 'Per-persona action log. Used for rate limits, anti-detection cooldowns, creator audit.';

-- ----------------------------------------------------------------------------
-- ai_usage_log: token tracking per community
-- ----------------------------------------------------------------------------
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES public.community_personas(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX ai_usage_community_id_idx ON public.ai_usage_log(community_id, created_at DESC);
CREATE INDEX ai_usage_feature_idx ON public.ai_usage_log(feature, created_at DESC);
CREATE INDEX ai_usage_created_at_idx ON public.ai_usage_log(created_at DESC);

COMMENT ON TABLE public.ai_usage_log IS 'Token usage tracking per community. Drives admin cost dashboards.';

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
CREATE TRIGGER community_personas_updated_at
  BEFORE UPDATE ON public.community_personas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER persona_schedule_updated_at
  BEFORE UPDATE ON public.persona_schedule_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.community_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_schedule_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.persona_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- community_personas: only the creator of the community can read/manage
CREATE POLICY community_personas_creator_select ON public.community_personas
  FOR SELECT TO authenticated USING (
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY community_personas_creator_insert ON public.community_personas
  FOR INSERT TO authenticated WITH CHECK (
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY community_personas_creator_update ON public.community_personas
  FOR UPDATE TO authenticated USING (
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY community_personas_creator_delete ON public.community_personas
  FOR DELETE TO authenticated USING (
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- persona_schedule_config: only creator
CREATE POLICY persona_schedule_creator_all ON public.persona_schedule_config
  FOR ALL TO authenticated USING (
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- community_knowledge: only creator
CREATE POLICY community_knowledge_creator_all ON public.community_knowledge
  FOR ALL TO authenticated USING (
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- persona_memory: only creator (via persona)
CREATE POLICY persona_memory_creator_all ON public.persona_memory
  FOR ALL TO authenticated USING (
    persona_id IN (
      SELECT id FROM public.community_personas WHERE community_id IN (
        SELECT id FROM public.communities WHERE creator_id IN (
          SELECT id FROM public.profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

-- persona_activity_log: only creator
CREATE POLICY persona_activity_creator_select ON public.persona_activity_log
  FOR SELECT TO authenticated USING (
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ai_usage_log: only creator
CREATE POLICY ai_usage_creator_select ON public.ai_usage_log
  FOR SELECT TO authenticated USING (
    community_id IN (
      SELECT id FROM public.communities WHERE creator_id IN (
        SELECT id FROM public.profiles WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Vector similarity search for RAG retrieval
CREATE OR REPLACE FUNCTION public.match_community_knowledge(
  p_community_id UUID,
  p_query_embedding vector(768),
  p_match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  source_type TEXT,
  title TEXT,
  content TEXT,
  similarity NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ck.id,
    ck.source_type,
    ck.title,
    ck.content,
    (1 - (ck.embedding <=> p_query_embedding))::NUMERIC AS similarity
  FROM public.community_knowledge ck
  WHERE ck.community_id = p_community_id
    AND ck.embedding IS NOT NULL
  ORDER BY ck.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

COMMENT ON FUNCTION public.match_community_knowledge IS 'RAG: find top-N most similar knowledge chunks for a query embedding.';

-- Active personas due for tick (used by persona-tick edge fn)
CREATE OR REPLACE FUNCTION public.get_personas_due_for_tick(p_now TIMESTAMPTZ DEFAULT NOW())
RETURNS TABLE (
  persona_id UUID,
  community_id UUID,
  archetype TEXT,
  intensity TEXT,
  global_intensity TEXT,
  active_windows JSONB,
  active_days INTEGER[],
  last_action_at TIMESTAMPTZ,
  manual_notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.id,
    cp.community_id,
    cp.archetype,
    cp.intensity,
    psc.global_intensity,
    psc.active_windows,
    psc.active_days,
    cp.last_action_at,
    psc.manual_notes
  FROM public.community_personas cp
  JOIN public.persona_schedule_config psc ON psc.community_id = cp.community_id
  WHERE cp.is_active = true
    AND psc.master_enabled = true
    AND (cp.last_action_at IS NULL OR cp.last_action_at < p_now - INTERVAL '3 hours');
END;
$$;

COMMENT ON FUNCTION public.get_personas_due_for_tick IS 'Returns personas eligible for action this tick. Caller still does probability roll.';
