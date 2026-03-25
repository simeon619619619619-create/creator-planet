// Ghost Writer feature types
// Maps to tables: ghost_writer_config, ghost_writer_schedules, ghost_writer_drafts,
// student_data_points, ghost_writer_dm_log

export type GhostWriterApprovalMode = 'preview' | 'auto';
export type GhostWriterPostType = 'motivation' | 'tip' | 'question' | 'recap' | 'custom';
export type GhostWriterDraftStatus = 'pending' | 'approved' | 'rejected' | 'published';
export type GhostWriterDmTriggerType =
  | 'auto_reply'
  | 'proactive_new_student'
  | 'proactive_inactive'
  | 'proactive_at_risk'
  | 'proactive_scheduled';

// Ghost Writer Config (one per community)
export interface DbGhostWriterConfig {
  id: string;
  community_id: string;
  creator_id: string;
  persona_prompt: string;
  persona_answers: unknown[];
  data_collection_fields: unknown[];
  auto_reply_enabled: boolean;
  approval_mode: GhostWriterApprovalMode;
  post_schedule_description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Ghost Writer Schedules
export interface DbGhostWriterSchedule {
  id: string;
  community_id: string;
  config_id: string;
  schedule_cron: string;
  channel_id: string;
  post_type: GhostWriterPostType;
  topic_hints: string;
  is_active: boolean;
  last_run_at: string | null;
  created_at: string;
}

// Ghost Writer Drafts
export interface DbGhostWriterDraft {
  id: string;
  community_id: string;
  schedule_id: string | null;
  content: string;
  image_url: string | null;
  channel_id: string;
  status: GhostWriterDraftStatus;
  created_at: string;
  published_at: string | null;
}

// Student Data Points
export interface DbStudentDataPoint {
  id: string;
  student_id: string;
  community_id: string;
  field_name: string;
  value: string;
  collected_at: string;
  source_conversation_id: string | null;
  created_at: string;
}

// Ghost Writer DM Log
export interface DbGhostWriterDmLog {
  id: string;
  community_id: string;
  student_id: string;
  conversation_id: string;
  trigger_type: GhostWriterDmTriggerType;
  message_content: string;
  data_extracted: Record<string, unknown> | null;
  created_at: string;
}
