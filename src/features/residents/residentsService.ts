import { supabase } from '../../core/supabase/client';

export type Archetype = 'newbie' | 'rising_star' | 'skeptic' | 'empath' | 'expert' | 'lurker' | 'connector';
export type Intensity = 'quiet' | 'normal' | 'active';

export interface Persona {
  id: string;
  community_id: string;
  profile_id: string;
  archetype: Archetype;
  display_name: string;
  bio: string;
  topics: string[];
  uses_latin: boolean;
  short_long_ratio: number;
  intensity: Intensity;
  is_active: boolean;
  last_action_at: string | null;
  created_at: string;
}

export interface ScheduleConfig {
  id: string;
  community_id: string;
  master_enabled: boolean;
  active_windows: { morning: boolean; midday: boolean; evening: boolean; night: boolean };
  active_days: number[];
  global_intensity: Intensity;
  niche_template: string | null;
  manual_notes: string | null;
}

export interface ActivityLogRow {
  id: string;
  persona_id: string;
  community_id: string;
  action_type: 'post' | 'comment' | 'tick_skipped' | 'tick_decision' | 'avatar_generated';
  ref_post_id: string | null;
  ref_comment_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  persona_name?: string;
}

export interface UsageSummary {
  total_actions: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost_usd: number;
}

const ARCHETYPE_LABELS_BG: Record<Archetype, string> = {
  newbie: 'Новакът-съмняващ се',
  rising_star: 'Звездата-в-прогрес',
  skeptic: 'Скептикът-практик',
  empath: 'Емпатът',
  expert: 'Експерт-съсед',
  lurker: 'Lurker-който-се-обажда',
  connector: 'Връзкаджията',
};

export function archetypeLabel(a: Archetype): string {
  return ARCHETYPE_LABELS_BG[a];
}

export async function getPersonas(communityId: string): Promise<Persona[]> {
  const { data, error } = await supabase
    .from('community_personas')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('getPersonas:', error);
    return [];
  }
  return (data ?? []) as Persona[];
}

export async function getScheduleConfig(communityId: string): Promise<ScheduleConfig | null> {
  const { data, error } = await supabase
    .from('persona_schedule_config')
    .select('*')
    .eq('community_id', communityId)
    .maybeSingle();
  if (error) {
    console.error('getScheduleConfig:', error);
    return null;
  }
  return (data as ScheduleConfig) ?? null;
}

export async function ensureScheduleConfig(communityId: string): Promise<ScheduleConfig | null> {
  const existing = await getScheduleConfig(communityId);
  if (existing) return existing;
  const { data, error } = await supabase
    .from('persona_schedule_config')
    .insert({ community_id: communityId, master_enabled: false })
    .select('*')
    .single();
  if (error) {
    console.error('ensureScheduleConfig:', error);
    return null;
  }
  return data as ScheduleConfig;
}

export async function setMasterEnabled(communityId: string, enabled: boolean): Promise<boolean> {
  const cfg = await ensureScheduleConfig(communityId);
  if (!cfg) return false;
  const { error } = await supabase
    .from('persona_schedule_config')
    .update({ master_enabled: enabled })
    .eq('community_id', communityId);
  return !error;
}

export async function setManualNotes(communityId: string, notes: string): Promise<boolean> {
  await ensureScheduleConfig(communityId);
  const { error } = await supabase
    .from('persona_schedule_config')
    .update({ manual_notes: notes })
    .eq('community_id', communityId);
  return !error;
}

export async function togglePersonaActive(personaId: string, isActive: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('community_personas')
    .update({ is_active: isActive })
    .eq('id', personaId);
  return !error;
}

export async function setPersonaIntensity(personaId: string, intensity: Intensity): Promise<boolean> {
  const { error } = await supabase
    .from('community_personas')
    .update({ intensity })
    .eq('id', personaId);
  return !error;
}

export async function getRecentActivity(communityId: string, limit = 20): Promise<ActivityLogRow[]> {
  const { data, error } = await supabase
    .from('persona_activity_log')
    .select('id, persona_id, community_id, action_type, ref_post_id, ref_comment_id, metadata, created_at, community_personas(display_name)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('getRecentActivity:', error);
    return [];
  }
  return ((data ?? []) as Array<ActivityLogRow & { community_personas?: { display_name?: string } }>).map((row) => ({
    ...row,
    persona_name: row.community_personas?.display_name,
  }));
}

export async function getUsageSummary(communityId: string, days = 30): Promise<UsageSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('ai_usage_log')
    .select('input_tokens, output_tokens, cost_usd')
    .eq('community_id', communityId)
    .gte('created_at', since);
  if (error || !data) return { total_actions: 0, total_input_tokens: 0, total_output_tokens: 0, total_cost_usd: 0 };
  return {
    total_actions: data.length,
    total_input_tokens: data.reduce((s, r) => s + (r.input_tokens ?? 0), 0),
    total_output_tokens: data.reduce((s, r) => s + (r.output_tokens ?? 0), 0),
    total_cost_usd: data.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0),
  };
}

export async function bootstrapNewbie(communityId: string): Promise<{ ok: boolean; error?: string; postPreview?: string }> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const { data: cfg } = await supabase.from('persona_schedule_config').select('community_id').eq('community_id', communityId).maybeSingle();
  if (!cfg) await ensureScheduleConfig(communityId);

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/residents-mvp`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ community_id: communityId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.error ?? `HTTP ${res.status}` };
  }
  return { ok: true, postPreview: body.post?.content };
}
