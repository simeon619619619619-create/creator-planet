-- Ghost Writer Config (one per community)
CREATE TABLE IF NOT EXISTS public.ghost_writer_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  persona_prompt TEXT DEFAULT '',
  persona_answers JSONB DEFAULT '[]'::jsonb,
  data_collection_fields JSONB DEFAULT '[]'::jsonb,
  auto_reply_enabled BOOLEAN DEFAULT false,
  approval_mode TEXT DEFAULT 'preview' CHECK (approval_mode IN ('preview', 'auto')),
  post_schedule_description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id)
);

CREATE TABLE IF NOT EXISTS public.ghost_writer_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES public.ghost_writer_config(id) ON DELETE CASCADE,
  schedule_cron TEXT NOT NULL DEFAULT '0 9 * * *',
  channel_id UUID NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  post_type TEXT DEFAULT 'motivation' CHECK (post_type IN ('motivation', 'tip', 'question', 'recap', 'custom')),
  topic_hints TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ghost_writer_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.ghost_writer_schedules(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  channel_id UUID NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.student_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  value TEXT NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  source_conversation_id UUID REFERENCES public.direct_conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ghost_writer_dm_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto_reply', 'proactive_new_student', 'proactive_inactive', 'proactive_at_risk', 'proactive_scheduled')),
  message_content TEXT NOT NULL,
  data_extracted JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gw_config_community ON public.ghost_writer_config(community_id);
CREATE INDEX IF NOT EXISTS idx_gw_schedules_community ON public.ghost_writer_schedules(community_id);
CREATE INDEX IF NOT EXISTS idx_gw_drafts_community_status ON public.ghost_writer_drafts(community_id, status);
CREATE INDEX IF NOT EXISTS idx_student_data_student ON public.student_data_points(student_id, community_id);
CREATE INDEX IF NOT EXISTS idx_student_data_field ON public.student_data_points(community_id, field_name);
CREATE INDEX IF NOT EXISTS idx_gw_dm_log_community ON public.ghost_writer_dm_log(community_id);

-- RLS
ALTER TABLE public.ghost_writer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_writer_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_writer_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_writer_dm_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gw_config_creator_all" ON public.ghost_writer_config
  FOR ALL TO authenticated
  USING (creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "gw_schedules_creator_all" ON public.ghost_writer_schedules
  FOR ALL TO authenticated
  USING (config_id IN (SELECT id FROM public.ghost_writer_config WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())))
  WITH CHECK (config_id IN (SELECT id FROM public.ghost_writer_config WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "gw_drafts_creator_all" ON public.ghost_writer_drafts
  FOR ALL TO authenticated
  USING (community_id IN (SELECT community_id FROM public.ghost_writer_config WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())))
  WITH CHECK (community_id IN (SELECT community_id FROM public.ghost_writer_config WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "student_data_creator_read" ON public.student_data_points
  FOR SELECT TO authenticated
  USING (
    community_id IN (SELECT id FROM public.communities WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
    OR student_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "student_data_service_insert" ON public.student_data_points
  FOR INSERT TO authenticated
  WITH CHECK (
    community_id IN (SELECT id FROM public.communities WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  );

CREATE POLICY "gw_dm_log_creator_read" ON public.ghost_writer_dm_log
  FOR SELECT TO authenticated
  USING (community_id IN (SELECT id FROM public.communities WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "gw_dm_log_service_insert" ON public.ghost_writer_dm_log
  FOR INSERT TO authenticated
  WITH CHECK (community_id IN (SELECT id FROM public.communities WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));
