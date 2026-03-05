import { supabase } from '../../core/supabase/client';

export interface NotificationPreferences {
  push_enabled: boolean;
  dm_messages: boolean;
  event_created: boolean;
  event_reminder: boolean;
  course_new_lesson: boolean;
  course_enrollment: boolean;
  community_new_post: boolean;
  community_comment_reply: boolean;
}

export async function getNotificationPreferences(
  profileId: string
): Promise<NotificationPreferences | null> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select(
      'push_enabled, dm_messages, event_created, event_reminder, course_new_lesson, course_enrollment, community_new_post, community_comment_reply'
    )
    .eq('profile_id', profileId)
    .single();

  if (error) {
    console.error('Failed to fetch notification preferences:', error);
    return null;
  }

  return data;
}

export async function updateNotificationPreferences(
  profileId: string,
  prefs: Partial<NotificationPreferences>
): Promise<boolean> {
  const { error } = await supabase
    .from('notification_preferences')
    .update(prefs)
    .eq('profile_id', profileId);

  if (error) {
    console.error('Failed to update notification preferences:', error);
    return false;
  }

  return true;
}
