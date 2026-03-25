import { supabase } from '../../core/supabase/client';
import { createPost } from '../community/communityService';
import type {
  DbGhostWriterConfig,
  DbGhostWriterSchedule,
  DbGhostWriterDraft,
  DbStudentDataPoint,
  DbGhostWriterDmLog,
  GhostWriterPostType,
  GhostWriterDmTriggerType,
} from './ghostWriterTypes';

// ============================================================================
// CONFIG CRUD
// ============================================================================

export async function getGhostWriterConfig(
  communityId: string
): Promise<DbGhostWriterConfig | null> {
  const { data, error } = await supabase
    .from('ghost_writer_config')
    .select('*')
    .eq('community_id', communityId)
    .single();

  if (error) {
    // PGRST116 = no rows found — not an error for "fetch or null"
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching ghost writer config:', error);
    return null;
  }
  return data as DbGhostWriterConfig;
}

export async function createGhostWriterConfig(
  communityId: string,
  creatorId: string
): Promise<DbGhostWriterConfig | null> {
  const { data, error } = await supabase
    .from('ghost_writer_config')
    .insert({
      community_id: communityId,
      creator_id: creatorId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating ghost writer config:', error);
    return null;
  }
  return data as DbGhostWriterConfig;
}

export async function updateGhostWriterConfig(
  configId: string,
  updates: Partial<
    Pick<
      DbGhostWriterConfig,
      | 'persona_prompt'
      | 'persona_answers'
      | 'data_collection_fields'
      | 'auto_reply_enabled'
      | 'approval_mode'
      | 'post_schedule_description'
      | 'is_active'
    >
  >
): Promise<DbGhostWriterConfig | null> {
  const { data, error } = await supabase
    .from('ghost_writer_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', configId)
    .select()
    .single();

  if (error) {
    console.error('Error updating ghost writer config:', error);
    return null;
  }
  return data as DbGhostWriterConfig;
}

export async function toggleGhostWriter(
  configId: string,
  isActive: boolean
): Promise<DbGhostWriterConfig | null> {
  return updateGhostWriterConfig(configId, { is_active: isActive });
}

// ============================================================================
// SCHEDULE CRUD
// ============================================================================

export async function getSchedules(
  communityId: string
): Promise<DbGhostWriterSchedule[]> {
  const { data, error } = await supabase
    .from('ghost_writer_schedules')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching schedules:', error);
    return [];
  }
  return (data ?? []) as DbGhostWriterSchedule[];
}

export async function createSchedule(
  communityId: string,
  configId: string,
  channelId: string,
  cron: string,
  postType: GhostWriterPostType,
  topicHints: string
): Promise<DbGhostWriterSchedule | null> {
  const { data, error } = await supabase
    .from('ghost_writer_schedules')
    .insert({
      community_id: communityId,
      config_id: configId,
      channel_id: channelId,
      schedule_cron: cron,
      post_type: postType,
      topic_hints: topicHints,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating schedule:', error);
    return null;
  }
  return data as DbGhostWriterSchedule;
}

export async function updateSchedule(
  scheduleId: string,
  updates: Partial<
    Pick<
      DbGhostWriterSchedule,
      'schedule_cron' | 'channel_id' | 'post_type' | 'topic_hints' | 'is_active' | 'last_run_at'
    >
  >
): Promise<DbGhostWriterSchedule | null> {
  const { data, error } = await supabase
    .from('ghost_writer_schedules')
    .update(updates)
    .eq('id', scheduleId)
    .select()
    .single();

  if (error) {
    console.error('Error updating schedule:', error);
    return null;
  }
  return data as DbGhostWriterSchedule;
}

export async function deleteSchedule(scheduleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('ghost_writer_schedules')
    .delete()
    .eq('id', scheduleId);

  if (error) {
    console.error('Error deleting schedule:', error);
    return false;
  }
  return true;
}

// ============================================================================
// DRAFTS MANAGEMENT
// ============================================================================

export async function getPendingDrafts(
  communityId: string
): Promise<DbGhostWriterDraft[]> {
  const { data, error } = await supabase
    .from('ghost_writer_drafts')
    .select('*')
    .eq('community_id', communityId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending drafts:', error);
    return [];
  }
  return (data ?? []) as DbGhostWriterDraft[];
}

export async function approveDraft(
  draftId: string,
  creatorProfileId: string
): Promise<DbGhostWriterDraft | null> {
  // 1. Fetch the draft to get content and channel
  const { data: draft, error: fetchError } = await supabase
    .from('ghost_writer_drafts')
    .select('*')
    .eq('id', draftId)
    .single();

  if (fetchError || !draft) {
    console.error('Error fetching draft for approval:', fetchError);
    return null;
  }

  // 2. Update draft status to published
  const { data: updated, error: updateError } = await supabase
    .from('ghost_writer_drafts')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', draftId)
    .select()
    .single();

  if (updateError) {
    console.error('Error updating draft status:', updateError);
    return null;
  }

  // 3. Resolve user_id from profile so we can call createPost
  //    (createPost expects auth user_id and does its own profile lookup)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('id', creatorProfileId)
    .single();

  if (profileError || !profile) {
    console.error('Error resolving user_id from profile:', profileError);
    return updated as DbGhostWriterDraft;
  }

  // 4. Publish as a community post via communityService
  await createPost(
    draft.channel_id,
    profile.user_id,
    draft.content,
    draft.image_url
  );

  return updated as DbGhostWriterDraft;
}

export async function rejectDraft(
  draftId: string
): Promise<DbGhostWriterDraft | null> {
  const { data, error } = await supabase
    .from('ghost_writer_drafts')
    .update({ status: 'rejected' })
    .eq('id', draftId)
    .select()
    .single();

  if (error) {
    console.error('Error rejecting draft:', error);
    return null;
  }
  return data as DbGhostWriterDraft;
}

export async function createDraft(
  communityId: string,
  channelId: string,
  content: string,
  scheduleId?: string
): Promise<DbGhostWriterDraft | null> {
  const { data, error } = await supabase
    .from('ghost_writer_drafts')
    .insert({
      community_id: communityId,
      channel_id: channelId,
      content,
      schedule_id: scheduleId ?? null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating draft:', error);
    return null;
  }
  return data as DbGhostWriterDraft;
}

// ============================================================================
// STUDENT DATA POINTS
// ============================================================================

export async function getStudentDataPoints(
  studentId: string,
  communityId: string,
  fieldName?: string,
  limit?: number
): Promise<DbStudentDataPoint[]> {
  let query = supabase
    .from('student_data_points')
    .select('*')
    .eq('student_id', studentId)
    .eq('community_id', communityId)
    .order('collected_at', { ascending: false });

  if (fieldName) {
    query = query.eq('field_name', fieldName);
  }
  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching student data points:', error);
    return [];
  }
  return (data ?? []) as DbStudentDataPoint[];
}

export async function saveDataPoints(
  studentId: string,
  communityId: string,
  points: { field_name: string; value: string }[],
  conversationId?: string
): Promise<DbStudentDataPoint[]> {
  const now = new Date().toISOString();
  const rows = points.map((p) => ({
    student_id: studentId,
    community_id: communityId,
    field_name: p.field_name,
    value: p.value,
    collected_at: now,
    source_conversation_id: conversationId ?? null,
  }));

  const { data, error } = await supabase
    .from('student_data_points')
    .insert(rows)
    .select();

  if (error) {
    console.error('Error saving data points:', error);
    return [];
  }
  return (data ?? []) as DbStudentDataPoint[];
}

export async function getDataCollectionSummary(
  communityId: string
): Promise<{ field_name: string; count: number }[]> {
  // Supabase JS doesn't support GROUP BY directly, so we fetch all field_names
  // and aggregate client-side. For large datasets, use an RPC instead.
  const { data, error } = await supabase
    .from('student_data_points')
    .select('field_name')
    .eq('community_id', communityId);

  if (error) {
    console.error('Error fetching data collection summary:', error);
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const current = counts.get(row.field_name) ?? 0;
    counts.set(row.field_name, current + 1);
  }

  return Array.from(counts.entries()).map(([field_name, count]) => ({
    field_name,
    count,
  }));
}

// ============================================================================
// DM LOG
// ============================================================================

export async function logGhostDM(
  communityId: string,
  studentId: string,
  conversationId: string,
  triggerType: GhostWriterDmTriggerType,
  content: string,
  dataExtracted?: Record<string, unknown>
): Promise<DbGhostWriterDmLog | null> {
  const { data, error } = await supabase
    .from('ghost_writer_dm_log')
    .insert({
      community_id: communityId,
      student_id: studentId,
      conversation_id: conversationId,
      trigger_type: triggerType,
      message_content: content,
      data_extracted: dataExtracted ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging ghost DM:', error);
    return null;
  }
  return data as DbGhostWriterDmLog;
}

export async function getGhostDMLog(
  communityId: string,
  limit?: number
): Promise<DbGhostWriterDmLog[]> {
  let query = supabase
    .from('ghost_writer_dm_log')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching ghost DM log:', error);
    return [];
  }
  return (data ?? []) as DbGhostWriterDmLog[];
}
