// =============================================================================
// CHANNEL READ STATUS SERVICE
// =============================================================================
// Tracks when users last viewed channels to show unread indicators

import { supabase } from '../../core/supabase/client';

/**
 * Get unread status for all channels in a community.
 * Returns a Set of channel IDs that have unread posts.
 */
export async function getChannelUnreadStatus(
  communityId: string,
  userProfileId: string
): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('get_channels_with_unread', {
    p_community_id: communityId,
    p_user_profile_id: userProfileId,
  });

  if (error) {
    console.error('Error fetching channel unread status:', error);
    return new Set();
  }

  const unreadChannels = new Set<string>();
  data?.forEach((row: { channel_id: string; has_unread: boolean }) => {
    if (row.has_unread) {
      unreadChannels.add(row.channel_id);
    }
  });

  return unreadChannels;
}

/**
 * Mark a channel as read (update last_read_at to now).
 * Uses upsert to create record if it doesn't exist.
 * @returns true if successful, false if failed
 */
export async function markChannelAsRead(
  channelId: string,
  userProfileId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('channel_read_status')
    .upsert(
      {
        channel_id: channelId,
        user_id: userProfileId,
        last_read_at: new Date().toISOString(),
      },
      {
        onConflict: 'channel_id,user_id',
      }
    );

  if (error) {
    console.error('Error marking channel as read:', error);
    return false;
  }

  return true;
}

/**
 * Get count of channels with unread posts in a community.
 * Useful for showing total unread badge.
 */
export async function getUnreadChannelsCount(
  communityId: string,
  userProfileId: string
): Promise<number> {
  const unreadSet = await getChannelUnreadStatus(communityId, userProfileId);
  return unreadSet.size;
}
