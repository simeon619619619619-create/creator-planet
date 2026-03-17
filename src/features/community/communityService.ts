import { supabase } from '../../core/supabase/client';
import {
  DbCommunity,
  DbCommunityChannel,
  DbCommunityChannelWithGroup,
  DbCommunityGroup,
  ChannelsByGroup,
  DbPost,
  DbPostWithAuthor,
  DbPostComment,
  DbPostCommentWithAuthor,
  DbMembership,
  MembershipRole,
} from '../../core/supabase/database.types';

// ============================================================================
// COMMUNITIES
// ============================================================================

export async function getCommunities(): Promise<DbCommunity[]> {
  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching communities:', error);
    return [];
  }
  return data || [];
}

export async function getCreatorCommunities(userId: string): Promise<DbCommunity[]> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for creator communities:', profileError);
    return [];
  }

  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .eq('creator_id', profile.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching creator communities:', error);
    return [];
  }
  return data || [];
}

export async function getMemberCommunities(userId: string): Promise<DbCommunity[]> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for member communities:', profileError);
    return [];
  }

  const { data, error } = await supabase
    .from('memberships')
    .select('community:communities(*)')
    .eq('user_id', profile.id);

  if (error) {
    console.error('Error fetching member communities:', error);
    return [];
  }

  // Extract communities from the join result
  return data?.map((m: any) => m.community).filter(Boolean) || [];
}

export async function createCommunity(
  userId: string,
  name: string,
  description?: string,
  isPublic: boolean = true
): Promise<DbCommunity | null> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for community creation:', profileError);
    return null;
  }

  const { data, error } = await supabase
    .from('communities')
    .insert({
      creator_id: profile.id,
      name,
      description,
      is_public: isPublic,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating community:', error);
    return null;
  }
  return data;
}

export async function updateCommunity(
  communityId: string,
  updates: Partial<Pick<DbCommunity, 'name' | 'description' | 'thumbnail_url' | 'is_public' | 'category'>>
): Promise<DbCommunity | null> {
  const { data, error } = await supabase
    .from('communities')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', communityId)
    .select()
    .single();

  if (error) {
    console.error('Error updating community:', error);
    return null;
  }
  return data;
}

export async function uploadCommunityThumbnail(
  communityId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${communityId}/thumbnail-${Date.now()}.${fileExt}`;

  // Upload new thumbnail
  const { data, error } = await supabase.storage
    .from('community-thumbnails')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading community thumbnail:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('community-thumbnails')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ============================================================================
// CHANNELS
// ============================================================================

export async function getChannels(communityId: string): Promise<DbCommunityChannel[]> {
  const { data, error } = await supabase
    .from('community_channels')
    .select('*')
    .eq('community_id', communityId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching channels:', error);
    return [];
  }
  return data || [];
}

/**
 * Get channels with group info for a community
 * Includes group_id and group details
 */
export async function getChannelsWithGroups(
  communityId: string
): Promise<DbCommunityChannelWithGroup[]> {
  const { data, error } = await supabase
    .from('community_channels')
    .select(`
      *,
      group:community_groups(*)
    `)
    .eq('community_id', communityId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching channels with groups:', error);
    return [];
  }

  return (data || []).map((ch: any) => ({
    ...ch,
    group: ch.group || null,
  }));
}

/**
 * Get channels organized by group for sidebar display
 * Returns global channels and group-specific channels (including empty groups)
 * @param isOwner - If true, shows all groups (for community owners)
 */
export async function getChannelsByGroup(
  communityId: string,
  userGroupIds: string[],
  isOwner: boolean = false
): Promise<ChannelsByGroup> {
  // Fetch all channels
  const channels = await getChannelsWithGroups(communityId);

  // Fetch all groups for the community
  const { data: allGroups } = await supabase
    .from('community_groups')
    .select('*')
    .eq('community_id', communityId)
    .order('position', { ascending: true });

  const global: DbCommunityChannel[] = [];
  const groupsMap = new Map<string, { group: DbCommunityGroup; channels: DbCommunityChannel[] }>();

  // Initialize groups map with all visible groups (empty channels array)
  // Owners see all groups, members see only their groups
  for (const group of allGroups || []) {
    if (isOwner || userGroupIds.includes(group.id)) {
      groupsMap.set(group.id, {
        group,
        channels: [],
      });
    }
  }

  // Attach channels to their groups
  for (const channel of channels) {
    if (!channel.group_id) {
      // Global channel
      global.push(channel);
    } else {
      // Group-specific channel - add to group if visible
      const existing = groupsMap.get(channel.group_id);
      if (existing) {
        existing.channels.push(channel);
      }
    }
  }

  // Sort groups by position
  const groups = Array.from(groupsMap.values()).sort(
    (a, b) => a.group.position - b.group.position
  );

  return { global, groups };
}

export async function createChannel(
  communityId: string,
  name: string,
  description?: string,
  position: number = 0,
  groupId?: string | null
): Promise<DbCommunityChannel | null> {
  const { data, error } = await supabase
    .from('community_channels')
    .insert({
      community_id: communityId,
      name,
      description,
      position,
      group_id: groupId || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating channel:', error);
    return null;
  }
  return data;
}

export async function updateChannel(
  channelId: string,
  updates: { name?: string; description?: string; position?: number; group_id?: string | null }
): Promise<DbCommunityChannel | null> {
  const { data, error } = await supabase
    .from('community_channels')
    .update(updates)
    .eq('id', channelId)
    .select()
    .single();

  if (error) {
    console.error('Error updating channel:', error);
    return null;
  }
  return data;
}

export async function deleteChannel(channelId: string): Promise<boolean> {
  // First delete all posts in this channel
  const { error: postsError } = await supabase
    .from('posts')
    .delete()
    .eq('channel_id', channelId);

  if (postsError) {
    console.error('Error deleting channel posts:', postsError);
    return false;
  }

  // Then delete the channel
  const { error } = await supabase
    .from('community_channels')
    .delete()
    .eq('id', channelId);

  if (error) {
    console.error('Error deleting channel:', error);
    return false;
  }
  return true;
}

export async function reorderChannels(
  channelIds: string[]
): Promise<boolean> {
  // Update positions based on array order
  const updates = channelIds.map((id, index) =>
    supabase
      .from('community_channels')
      .update({ position: index })
      .eq('id', id)
  );

  const results = await Promise.all(updates);
  const hasError = results.some(r => r.error);

  if (hasError) {
    console.error('Error reordering channels');
    return false;
  }
  return true;
}

// ============================================================================
// MEMBERSHIPS
// ============================================================================

/**
 * Check if a community requires an access code
 */
export async function getCommunityAccessCode(communityId: string): Promise<string | null> {
  const { data } = await supabase
    .from('communities')
    .select('access_code')
    .eq('id', communityId)
    .single();
  return (data as any)?.access_code || null;
}

export async function joinCommunity(
  userId: string,
  communityId: string,
  role: MembershipRole = 'member',
  accessCode?: string
): Promise<DbMembership | null> {
  // Check access code if community has one (skip for admin role - creator joining own community)
  if (role === 'member') {
    const requiredCode = await getCommunityAccessCode(communityId);
    if (requiredCode && accessCode !== requiredCode) {
      console.error('Invalid access code');
      throw new Error('INVALID_ACCESS_CODE');
    }
  }

  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for join community:', profileError);
    return null;
  }

  const { data, error } = await supabase
    .from('memberships')
    .insert({
      user_id: profile.id,
      community_id: communityId,
      role,
    })
    .select()
    .single();

  if (error) {
    console.error('Error joining community:', error);
    return null;
  }
  return data;
}

export async function getMembership(
  userId: string,
  communityId: string
): Promise<DbMembership | null> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  const { data, error } = await supabase
    .from('memberships')
    .select('*')
    .eq('user_id', profile.id)
    .eq('community_id', communityId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching membership:', error);
  }
  return data || null;
}

/**
 * Extended membership details including payment/subscription info
 */
export interface MembershipDetails {
  id: string;
  user_id: string;
  community_id: string;
  role: MembershipRole;
  joined_at: string;
  payment_status: string | null;
  stripe_subscription_id: string | null;
  paid_at: string | null;
  expires_at: string | null;
  is_creator: boolean;
  community_name: string;
  pricing_type: string;
}

/**
 * Get detailed membership info including subscription status
 */
export async function getMembershipDetails(
  userId: string,
  communityId: string
): Promise<MembershipDetails | null> {
  // First, get the profile ID for this user
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Get membership with community info
  const { data, error } = await supabase
    .from('memberships')
    .select(`
      *,
      community:communities(name, creator_id, pricing_type)
    `)
    .eq('user_id', profile.id)
    .eq('community_id', communityId)
    .single();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching membership details:', error);
    }
    return null;
  }

  const community = (data as any).community;

  return {
    id: data.id,
    user_id: data.user_id,
    community_id: data.community_id,
    role: data.role,
    joined_at: data.joined_at,
    payment_status: data.payment_status || null,
    stripe_subscription_id: data.stripe_subscription_id || null,
    paid_at: data.paid_at || null,
    expires_at: data.expires_at || null,
    is_creator: community?.creator_id === profile.id,
    community_name: community?.name || 'Unknown',
    pricing_type: community?.pricing_type || 'free',
  };
}

/**
 * Leave a community (delete membership)
 * @returns Object with success status and optional error message
 */
export async function leaveCommunity(
  userId: string,
  communityId: string
): Promise<{ success: boolean; error?: string; requiresSubscriptionCancel?: boolean }> {
  // First, get the profile ID for this user
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return { success: false, error: 'User profile not found' };
  }

  // Get membership details to check if user is creator or has active subscription
  const membershipDetails = await getMembershipDetails(userId, communityId);

  if (!membershipDetails) {
    return { success: false, error: 'Membership not found' };
  }

  // Prevent creator from leaving their own community
  if (membershipDetails.is_creator) {
    return { success: false, error: 'Creators cannot leave their own community. Delete the community instead.' };
  }

  // Check if there's an active subscription that needs to be canceled first
  if (membershipDetails.stripe_subscription_id && membershipDetails.payment_status === 'paid') {
    // Return flag indicating subscription needs to be canceled via Stripe portal
    return {
      success: false,
      error: 'Active subscription must be canceled first',
      requiresSubscriptionCancel: true
    };
  }

  // Delete the membership
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('user_id', profile.id)
    .eq('community_id', communityId);

  if (error) {
    console.error('Error leaving community:', error);
    return { success: false, error: 'Failed to leave community' };
  }

  // Clean up related data (group assignments)
  await supabase
    .from('community_group_members')
    .delete()
    .eq('member_id', profile.id);

  return { success: true };
}

// ============================================================================
// POSTS
// ============================================================================

export async function getPosts(channelId: string): Promise<DbPostWithAuthor[]> {
  // First get posts with authors - pinned posts first, then by date
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select(`
      *,
      author:profiles!author_id(*)
    `)
    .eq('channel_id', channelId)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (postsError) {
    console.error('Error fetching posts:', postsError);
    return [];
  }

  // Get like counts for all posts
  const postIds = posts?.map(p => p.id) || [];

  if (postIds.length === 0) return [];

  // Get likes count
  const { data: likes } = await supabase
    .from('post_likes')
    .select('post_id')
    .in('post_id', postIds);

  // Get comments count
  const { data: comments } = await supabase
    .from('post_comments')
    .select('post_id')
    .in('post_id', postIds);

  // Get current user's likes (need to lookup profile.id from auth user)
  const { data: { user } } = await supabase.auth.getUser();
  let userLikes: { post_id: string }[] | null = [];
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      const { data } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', profile.id)
        .in('post_id', postIds);
      userLikes = data;
    }
  }

  // Combine the data
  const likesMap = new Map<string, number>();
  const commentsMap = new Map<string, number>();
  const userLikesSet = new Set(userLikes?.map(l => l.post_id) || []);

  likes?.forEach(l => {
    likesMap.set(l.post_id, (likesMap.get(l.post_id) || 0) + 1);
  });

  comments?.forEach(c => {
    commentsMap.set(c.post_id, (commentsMap.get(c.post_id) || 0) + 1);
  });

  return posts?.map(post => ({
    ...post,
    likes_count: likesMap.get(post.id) || 0,
    comments_count: commentsMap.get(post.id) || 0,
    user_has_liked: userLikesSet.has(post.id),
  })) || [];
}

export async function createPost(
  channelId: string,
  userId: string,
  content: string,
  imageUrl?: string | null
): Promise<DbPost | null> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for create post:', profileError);
    return null;
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      channel_id: channelId,
      author_id: profile.id,
      content,
      image_url: imageUrl || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating post:', error);
    return null;
  }
  return data;
}

export async function uploadPostImage(file: File, channelId: string): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${channelId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { data, error } = await supabase.storage
    .from('post-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading image:', error);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('post-images')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function deletePost(postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId);

  if (error) {
    console.error('Error deleting post:', error);
    return false;
  }
  return true;
}

export async function pinPost(postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('posts')
    .update({ is_pinned: true })
    .eq('id', postId);

  if (error) {
    console.error('Error pinning post:', error);
    return false;
  }
  return true;
}

export async function unpinPost(postId: string): Promise<boolean> {
  const { error } = await supabase
    .from('posts')
    .update({ is_pinned: false })
    .eq('id', postId);

  if (error) {
    console.error('Error unpinning post:', error);
    return false;
  }
  return true;
}

export async function togglePinPost(postId: string, currentlyPinned: boolean): Promise<boolean> {
  if (currentlyPinned) {
    return unpinPost(postId);
  } else {
    return pinPost(postId);
  }
}

// ============================================================================
// LIKES
// ============================================================================

export async function likePost(
  postId: string,
  userId: string,
  authorId?: string,
  communityId?: string
): Promise<boolean> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for like post:', profileError);
    return false;
  }

  const { error } = await supabase
    .from('post_likes')
    .insert({
      post_id: postId,
      user_id: profile.id,
    });

  if (error) {
    console.error('Error liking post:', error);
    return false;
  }

  return true;
}

export async function unlikePost(postId: string, userId: string): Promise<boolean> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for unlike post:', profileError);
    return false;
  }

  const { error } = await supabase
    .from('post_likes')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', profile.id);

  if (error) {
    console.error('Error unliking post:', error);
    return false;
  }
  return true;
}

export async function toggleLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean,
  authorId?: string,
  communityId?: string
): Promise<boolean> {
  if (currentlyLiked) {
    return unlikePost(postId, userId);
  } else {
    return likePost(postId, userId, authorId, communityId);
  }
}

// ============================================================================
// COMMENTS
// ============================================================================

export async function getComments(postId: string): Promise<DbPostCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select(`
      *,
      author:profiles!author_id(*)
    `)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
  return data || [];
}

export async function createComment(
  postId: string,
  userId: string,
  content: string,
  communityId?: string
): Promise<DbPostComment | null> {
  // First, get the profile ID for this user (FK references profiles.id, not user_id)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for create comment:', profileError);
    return null;
  }

  const { data, error } = await supabase
    .from('post_comments')
    .insert({
      post_id: postId,
      author_id: profile.id,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating comment:', error);
    return null;
  }

  return data;
}

export async function deleteComment(commentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('post_comments')
    .delete()
    .eq('id', commentId);

  if (error) {
    console.error('Error deleting comment:', error);
    return false;
  }
  return true;
}

// ============================================================================
// SEED DATA (for initial setup)
// ============================================================================

export async function seedDefaultChannels(communityId: string): Promise<void> {
  const defaultChannels = [
    { name: 'General', description: 'General discussions', position: 0 },
    { name: 'Wins', description: 'Share your wins!', position: 1 },
    { name: 'Help Needed', description: 'Ask for help here', position: 2 },
    { name: 'Announcements', description: 'Important announcements', position: 3 },
    { name: 'Introductions', description: 'Introduce yourself', position: 4 },
  ];

  for (const channel of defaultChannels) {
    await createChannel(communityId, channel.name, channel.description, channel.position);
  }
}

// ============================================================================
// PUBLIC COMMUNITY ACCESS (No Auth Required - for landing pages)
// ============================================================================

import type {
  CommunityListItem,
  ChannelPreview,
  PostPreview,
  CreatorPublicProfile,
  CommunityPublicData,
} from '../../core/types';

/**
 * Get a public community by ID
 * Returns null if community doesn't exist or is not public
 */
export async function getPublicCommunity(communityId: string): Promise<DbCommunity | null> {
  const { data, error } = await supabase
    .from('communities')
    .select('*')
    .eq('id', communityId)
    .eq('is_public', true)
    .single();

  if (error) {
    console.error('Error fetching public community:', error);
    return null;
  }
  return data;
}

/**
 * Get all public communities with member counts
 * For the communities directory
 */
export async function getPublicCommunities(): Promise<CommunityListItem[]> {
  const { data, error } = await supabase
    .from('communities')
    .select(`
      id,
      name,
      description,
      thumbnail_url,
      pricing_type,
      price_cents,
      category,
      created_at,
      creator:profiles!creator_id(id, full_name, avatar_url)
    `)
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching public communities:', error);
    return [];
  }

  // Get member counts for all communities
  const communityIds = data?.map((c: any) => c.id) || [];
  const memberCounts = await getCommunityMemberCounts(communityIds);

  return data?.map((community: any) => ({
    id: community.id,
    name: community.name,
    description: community.description,
    thumbnail_url: community.thumbnail_url,
    memberCount: memberCounts.get(community.id) || 0,
    pricing_type: community.pricing_type || 'free',
    price_cents: community.price_cents || 0,
    category: community.category || null,
    creator: {
      id: community.creator?.id || '',
      full_name: community.creator?.full_name || 'Unknown',
      avatar_url: community.creator?.avatar_url || null,
    },
  })) || [];
}

/**
 * Get member count for a single community
 */
export async function getCommunityMemberCount(communityId: string): Promise<number> {
  const { count, error } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('community_id', communityId);

  if (error) {
    console.error('Error fetching member count:', error);
    return 0;
  }
  return count || 0;
}

/**
 * Get member counts for multiple communities (batch)
 */
async function getCommunityMemberCounts(communityIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (communityIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('memberships')
    .select('community_id')
    .in('community_id', communityIds);

  if (error) {
    console.error('Error fetching member counts:', error);
    return counts;
  }

  // Count memberships per community
  data?.forEach((m: any) => {
    counts.set(m.community_id, (counts.get(m.community_id) || 0) + 1);
  });

  return counts;
}

/**
 * Get channel preview for a public community
 * Returns channel names and post counts (no content)
 */
export async function getPublicChannelPreview(communityId: string): Promise<ChannelPreview[]> {
  const { data, error } = await supabase
    .from('community_channels')
    .select('id, name, description')
    .eq('community_id', communityId)
    .order('position', { ascending: true });

  if (error) {
    console.error('Error fetching channel preview:', error);
    return [];
  }

  // Get post counts per channel
  const channelIds = data?.map((c: any) => c.id) || [];
  const postCounts = await getChannelPostCounts(channelIds);

  return data?.map((channel: any) => ({
    id: channel.id,
    name: channel.name,
    description: channel.description,
    postCount: postCounts.get(channel.id) || 0,
  })) || [];
}

/**
 * Get post counts for multiple channels (batch)
 */
async function getChannelPostCounts(channelIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (channelIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('posts')
    .select('channel_id')
    .in('channel_id', channelIds);

  if (error) {
    console.error('Error fetching post counts:', error);
    return counts;
  }

  data?.forEach((p: any) => {
    counts.set(p.channel_id, (counts.get(p.channel_id) || 0) + 1);
  });

  return counts;
}

/**
 * Get preview of recent posts for a public community
 * Returns limited, sanitized content for unauthenticated viewing
 */
export async function getPublicPostsPreview(
  communityId: string,
  limit: number = 5
): Promise<PostPreview[]> {
  // First get channels for this community
  const { data: channels } = await supabase
    .from('community_channels')
    .select('id')
    .eq('community_id', communityId);

  if (!channels || channels.length === 0) return [];

  const channelIds = channels.map((c: any) => c.id);

  // Get recent posts from these channels
  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      content,
      created_at,
      author:profiles!author_id(full_name, avatar_url)
    `)
    .in('channel_id', channelIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching post preview:', error);
    return [];
  }

  // Get likes and comments counts
  const postIds = posts?.map((p: any) => p.id) || [];
  const [likes, comments] = await Promise.all([
    getPostLikeCounts(postIds),
    getPostCommentCounts(postIds),
  ]);

  return posts?.map((post: any) => ({
    id: post.id,
    content: truncateContent(post.content, 200),
    author: {
      full_name: post.author?.full_name || 'Unknown',
      avatar_url: post.author?.avatar_url || null,
    },
    created_at: post.created_at,
    likes_count: likes.get(post.id) || 0,
    comments_count: comments.get(post.id) || 0,
  })) || [];
}

/**
 * Get like counts for multiple posts (batch)
 */
async function getPostLikeCounts(postIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (postIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id')
    .in('post_id', postIds);

  if (error) {
    console.error('Error fetching like counts:', error);
    return counts;
  }

  data?.forEach((l: any) => {
    counts.set(l.post_id, (counts.get(l.post_id) || 0) + 1);
  });

  return counts;
}

/**
 * Get comment counts for multiple posts (batch)
 */
async function getPostCommentCounts(postIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (postIds.length === 0) return counts;

  const { data, error } = await supabase
    .from('post_comments')
    .select('post_id')
    .in('post_id', postIds);

  if (error) {
    console.error('Error fetching comment counts:', error);
    return counts;
  }

  data?.forEach((c: any) => {
    counts.set(c.post_id, (counts.get(c.post_id) || 0) + 1);
  });

  return counts;
}

/**
 * Get creator's public profile for community display
 */
export async function getCreatorPublicProfile(creatorId: string): Promise<CreatorPublicProfile | null> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, bio')
    .eq('id', creatorId)
    .single();

  if (profileError) return null;

  const { data: creatorProfile } = await supabase
    .from('creator_profiles')
    .select('brand_name, bio')
    .eq('creator_id', creatorId)
    .single();

  return {
    full_name: profile?.full_name || 'Unknown',
    avatar_url: profile?.avatar_url || null,
    brand_name: creatorProfile?.brand_name || null,
    // Landing page "About Me" uses only creator_profiles.bio (the marketing biography)
    bio: creatorProfile?.bio || null,
  };
}

/**
 * Get complete public data for a community landing page
 */
export async function getCommunityPublicData(communityId: string): Promise<CommunityPublicData | null> {
  // Get community
  const community = await getPublicCommunity(communityId);
  if (!community) return null;

  // Get all related data in parallel
  const [memberCount, channelPreviews, recentPosts, creator] = await Promise.all([
    getCommunityMemberCount(communityId),
    getPublicChannelPreview(communityId),
    getPublicPostsPreview(communityId, 5),
    getCreatorPublicProfile(community.creator_id),
  ]);

  if (!creator) return null;

  return {
    community: {
      id: community.id,
      name: community.name,
      description: community.description,
      thumbnail_url: community.thumbnail_url,
      is_public: community.is_public,
      created_at: community.created_at,
      pricing_type: community.pricing_type || 'free',
      price_cents: community.price_cents || 0,
      monthly_price_cents: community.monthly_price_cents || 0,
      currency: community.currency || 'EUR',
      vsl_url: community.vsl_url || null,
      access_type: community.access_type || 'open',
      tbi_enabled: community.tbi_enabled || false,
    },
    memberCount,
    channelPreviews,
    recentPosts,
    creator,
  };
}

// Helper function to truncate content
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

// ============================================================================
// USER PROFILE POPUP
// ============================================================================

/**
 * Extended profile data for the profile popup
 */
export interface UserProfilePopupData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  bio: string | null;
  joined_at: string;
  postsCount: number;
  commentsCount: number;
}

/**
 * Get user profile data for the popup by profile ID
 * Includes profile info and contribution stats
 * Uses profiles.bio (casual bio) for all users - shown in community member popups
 */
export async function getUserProfileForPopup(profileId: string): Promise<UserProfilePopupData | null> {
  // Get basic profile info including bio (for community member popups)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, created_at, bio, email, phone')
    .eq('id', profileId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for popup:', profileError);
    return null;
  }

  // Get posts count
  const { count: postsCount } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', profileId);

  // Get comments count
  const { count: commentsCount } = await supabase
    .from('post_comments')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', profileId);

  return {
    id: profile.id,
    full_name: profile.full_name || 'Unknown User',
    avatar_url: profile.avatar_url,
    role: profile.role,
    bio: profile.bio || null,
    email: (profile as any).email || null,
    phone: (profile as any).phone || null,
    joined_at: profile.created_at,
    postsCount: postsCount || 0,
    commentsCount: commentsCount || 0,
  };
}

// ============================================================================
// COMMUNITY VSL (VIDEO SALES LETTER)
// ============================================================================

const MAX_VSL_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_VSL_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

/**
 * Upload a VSL video for a community
 * @param communityId The community to upload the VSL for
 * @param file The video file to upload
 * @param onProgress Optional progress callback (0-100)
 * @returns The public URL of the uploaded video, or null on failure
 */
export async function uploadCommunityVSL(
  communityId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<string | null> {
  // Validate file type
  if (!ALLOWED_VSL_TYPES.includes(file.type)) {
    console.error('Invalid VSL file type:', file.type);
    return null;
  }

  // Validate file size
  if (file.size > MAX_VSL_SIZE) {
    console.error('VSL file too large:', file.size, 'max:', MAX_VSL_SIZE);
    return null;
  }

  // Generate unique filename
  const ext = file.name.split('.').pop() || 'mp4';
  const filename = `${communityId}/vsl-${Date.now()}.${ext}`;

  // Upload to storage
  const { data, error } = await supabase.storage
    .from('community-vsl')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading VSL:', error);
    return null;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('community-vsl')
    .getPublicUrl(data.path);

  const vslUrl = urlData.publicUrl;

  // Update community with VSL URL
  const { error: updateError } = await supabase
    .from('communities')
    .update({ vsl_url: vslUrl })
    .eq('id', communityId);

  if (updateError) {
    console.error('Error updating community with VSL URL:', updateError);
    return null;
  }

  return vslUrl;
}

/**
 * Delete the VSL video for a community
 */
export async function deleteCommunityVSL(communityId: string): Promise<boolean> {
  // First get the current VSL URL to extract the path
  const { data: community, error: fetchError } = await supabase
    .from('communities')
    .select('vsl_url')
    .eq('id', communityId)
    .single();

  if (fetchError || !community?.vsl_url) {
    console.error('Error fetching community VSL:', fetchError);
    return false;
  }

  // Extract path from URL (format: .../community-vsl/communityId/filename)
  const url = new URL(community.vsl_url);
  const pathParts = url.pathname.split('/community-vsl/');
  if (pathParts.length < 2) {
    console.error('Invalid VSL URL format');
    return false;
  }
  const storagePath = pathParts[1];

  // Delete from storage
  const { error: deleteError } = await supabase.storage
    .from('community-vsl')
    .remove([storagePath]);

  if (deleteError) {
    console.error('Error deleting VSL from storage:', deleteError);
    // Continue to clear the URL even if storage delete fails
  }

  // Clear VSL URL from community
  const { error: updateError } = await supabase
    .from('communities')
    .update({ vsl_url: null })
    .eq('id', communityId);

  if (updateError) {
    console.error('Error clearing community VSL URL:', updateError);
    return false;
  }

  return true;
}

/**
 * Delete a community permanently after confirmation
 * Uses the delete_community_safely database function which:
 * - Verifies the caller is the community creator
 * - Requires confirmation name to match community name
 * - Handles CASCADE deletion of related data
 */
export async function deleteCommunity(
  communityId: string,
  confirmationName: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('delete_community_safely', {
    p_community_id: communityId,
    p_confirmation_name: confirmationName,
  });

  if (error) {
    console.error('Error deleting community:', error);
    return { success: false, error: error.message };
  }

  // The RPC returns a JSONB object with success/error fields
  if (data && typeof data === 'object') {
    return {
      success: data.success === true,
      error: data.error || undefined,
    };
  }

  return { success: false, error: 'Unexpected response from server' };
}

// ============================================================================
// COMMUNITY APPLICATIONS (Gated Access)
// ============================================================================

import type {
  CommunityApplication,
  ApplicationWithApplicant,
  ApplicationStatus,
} from './communityTypes';

/**
 * Apply to join a gated community
 * @param userId - auth.users.id
 * @param communityId - community to apply to
 * @param message - optional intro message
 */
export async function applyToCommunity(
  userId: string,
  communityId: string,
  message?: string
): Promise<CommunityApplication | null> {
  // Get profile ID from auth user ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Error fetching profile for application:', profileError);
    return null;
  }

  const { data, error } = await supabase
    .from('community_applications')
    .insert({
      community_id: communityId,
      user_id: profile.id,
      message: message || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating application:', error);
    return null;
  }

  return data;
}

/**
 * Get a user's application for a specific community
 * @param userId - auth.users.id
 * @param communityId - community to check
 */
export async function getApplication(
  userId: string,
  communityId: string
): Promise<CommunityApplication | null> {
  // Get profile ID from auth user ID
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  const { data, error } = await supabase
    .from('community_applications')
    .select('*')
    .eq('community_id', communityId)
    .eq('user_id', profile.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching application:', error);
  }

  return data || null;
}

/**
 * Get all applications for a specific community (for creators)
 * @param communityId - community to get applications for
 * @param status - optional status filter
 */
export async function getCommunityApplications(
  communityId: string,
  status?: ApplicationStatus
): Promise<ApplicationWithApplicant[]> {
  let query = supabase
    .from('community_applications')
    .select(`
      *,
      applicant:profiles!user_id(id, full_name, avatar_url)
    `)
    .eq('community_id', communityId)
    .order('applied_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching community applications:', error);
    return [];
  }

  return (data || []).map((app: any) => ({
    ...app,
    applicant: app.applicant || { id: app.user_id, full_name: 'Unknown', avatar_url: null },
  }));
}

/**
 * Get all pending applications across all communities owned by a creator
 * @param creatorId - profile.id of the creator
 */
export async function getCreatorApplications(
  creatorId: string
): Promise<ApplicationWithApplicant[]> {
  // Get all communities owned by this creator
  const { data: communities, error: commError } = await supabase
    .from('communities')
    .select('id, name')
    .eq('creator_id', creatorId);

  if (commError || !communities || communities.length === 0) {
    return [];
  }

  const communityIds = communities.map(c => c.id);
  const communityMap = new Map(communities.map(c => [c.id, c.name]));

  // Get pending applications for these communities
  const { data, error } = await supabase
    .from('community_applications')
    .select(`
      *,
      applicant:profiles!user_id(id, full_name, avatar_url)
    `)
    .in('community_id', communityIds)
    .eq('status', 'pending')
    .order('applied_at', { ascending: false });

  if (error) {
    console.error('Error fetching creator applications:', error);
    return [];
  }

  return (data || []).map((app: any) => ({
    ...app,
    applicant: app.applicant || { id: app.user_id, full_name: 'Unknown', avatar_url: null },
    community: {
      id: app.community_id,
      name: communityMap.get(app.community_id) || 'Unknown',
    },
  }));
}

/**
 * Get count of pending applications for a creator
 * @param creatorId - profile.id of the creator
 */
export async function getPendingApplicationsCount(
  creatorId: string
): Promise<number> {
  // Get all communities owned by this creator
  const { data: communities, error: commError } = await supabase
    .from('communities')
    .select('id')
    .eq('creator_id', creatorId);

  if (commError || !communities || communities.length === 0) {
    return 0;
  }

  const communityIds = communities.map(c => c.id);

  // Count pending applications
  const { count, error } = await supabase
    .from('community_applications')
    .select('*', { count: 'exact', head: true })
    .in('community_id', communityIds)
    .eq('status', 'pending');

  if (error) {
    console.error('Error counting pending applications:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Approve an application - creates membership and updates application status
 * @param applicationId - the application to approve
 * @param reviewerId - profile.id of the creator approving
 */
export async function approveApplication(
  applicationId: string,
  reviewerId: string
): Promise<boolean> {
  // Use the database function to handle approval atomically
  // This bypasses RLS issues with the SECURITY DEFINER function
  const { error } = await supabase.rpc('approve_community_application', {
    p_application_id: applicationId,
    p_reviewer_id: reviewerId,
  });

  if (error) {
    console.error('Error approving application:', error);
    return false;
  }

  return true;
}

/**
 * Reject an application
 * @param applicationId - the application to reject
 * @param reviewerId - profile.id of the creator rejecting
 */
export async function rejectApplication(
  applicationId: string,
  reviewerId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('community_applications')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewerId,
    })
    .eq('id', applicationId);

  if (error) {
    console.error('Error rejecting application:', error);
    return false;
  }

  return true;
}

/**
 * Update community access type
 * @param communityId - the community to update
 * @param accessType - 'open' or 'gated'
 */
export async function updateCommunityAccessType(
  communityId: string,
  accessType: 'open' | 'gated'
): Promise<boolean> {
  const { error } = await supabase
    .from('communities')
    .update({ access_type: accessType })
    .eq('id', communityId);

  if (error) {
    console.error('Error updating community access type:', error);
    return false;
  }

  return true;
}

// ============================================================================
// STUDENT PROGRESS (for profile popup)
// ============================================================================

export interface StudentHomeworkProgress {
  id: string;
  title: string;
  submittedAt: string;
  status: 'pending' | 'graded';
  pointsAwarded: number | null;
  maxPoints: number;
}

export interface StudentLessonProgress {
  id: string;
  title: string;
  courseName: string;
  completedAt: string;
}

export interface ProgressEventAttendance {
  id: string;
  title: string;
  eventDate: string;
  attended: boolean;
}

export interface StudentProgressData {
  homework: StudentHomeworkProgress[];
  lessons: StudentLessonProgress[];
  events: ProgressEventAttendance[];
  stats: {
    totalHomework: number;
    gradedHomework: number;
    totalLessons: number;
    completedLessons: number;
    totalEvents: number;
    attendedEvents: number;
  };
}

/**
 * Get a student's progress in a community
 * Includes homework submissions, completed lessons, and event attendance
 * @param studentProfileId - The student's profile ID
 * @param communityId - The community ID
 */
export async function getStudentProgressInCommunity(
  studentProfileId: string,
  communityId: string
): Promise<StudentProgressData> {
  const result: StudentProgressData = {
    homework: [],
    lessons: [],
    events: [],
    stats: {
      totalHomework: 0,
      gradedHomework: 0,
      totalLessons: 0,
      completedLessons: 0,
      totalEvents: 0,
      attendedEvents: 0,
    },
  };

  // 1. Get homework submissions for this community
  const { data: submissions } = await supabase
    .from('homework_submissions')
    .select(`
      id,
      submitted_at,
      status,
      points_awarded,
      assignment:homework_assignments!assignment_id(
        id,
        title,
        max_points,
        community_id
      )
    `)
    .eq('student_id', studentProfileId);

  if (submissions) {
    const communitySubmissions = submissions.filter(
      (sub) => (sub.assignment as any)?.community_id === communityId
    );

    result.homework = communitySubmissions.map((sub) => ({
      id: sub.id,
      title: (sub.assignment as any)?.title || 'Unknown',
      submittedAt: sub.submitted_at,
      status: sub.status as 'pending' | 'graded',
      pointsAwarded: sub.points_awarded,
      maxPoints: (sub.assignment as any)?.max_points || 0,
    }));

    result.stats.totalHomework = result.homework.length;
    result.stats.gradedHomework = result.homework.filter(h => h.status === 'graded').length;
  }

  // 2. Get completed lessons from courses linked to this community
  const { data: courses } = await supabase
    .from('courses')
    .select('id, title')
    .eq('community_id', communityId);

  if (courses && courses.length > 0) {
    const courseIds = courses.map(c => c.id);
    const courseMap = new Map(courses.map(c => [c.id, c.title]));

    // Get modules for these courses
    const { data: modules } = await supabase
      .from('modules')
      .select('id, course_id')
      .in('course_id', courseIds);

    if (modules && modules.length > 0) {
      const moduleIds = modules.map(m => m.id);
      const moduleCourseMap = new Map(modules.map(m => [m.id, m.course_id]));

      // Get lessons
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, title, module_id')
        .in('module_id', moduleIds);

      if (lessons && lessons.length > 0) {
        const lessonIds = lessons.map(l => l.id);

        // Get progress for this student
        const { data: progress } = await supabase
          .from('lesson_progress')
          .select('lesson_id, completed_at')
          .eq('user_id', studentProfileId)
          .in('lesson_id', lessonIds)
          .not('completed_at', 'is', null);

        result.stats.totalLessons = lessons.length;
        result.stats.completedLessons = progress?.length || 0;

        if (progress) {
          result.lessons = progress.map((p) => {
            const lesson = lessons.find(l => l.id === p.lesson_id);
            const courseId = lesson ? moduleCourseMap.get(lesson.module_id) : null;
            return {
              id: p.lesson_id,
              title: lesson?.title || 'Unknown',
              courseName: courseId ? courseMap.get(courseId) || 'Unknown' : 'Unknown',
              completedAt: p.completed_at!,
            };
          });
        }
      }
    }
  }

  // 3. Get event attendance for community events
  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_time')
    .eq('community_id', communityId);

  if (events && events.length > 0) {
    const eventIds = events.map(e => e.id);

    const { data: attendance } = await supabase
      .from('event_attendees')
      .select('event_id, attended')
      .eq('user_id', studentProfileId)
      .in('event_id', eventIds);

    result.stats.totalEvents = events.length;

    if (attendance) {
      result.stats.attendedEvents = attendance.filter(a => a.attended).length;

      result.events = attendance.map((a) => {
        const event = events.find(e => e.id === a.event_id);
        return {
          id: a.event_id,
          title: event?.title || 'Unknown',
          eventDate: event?.start_time || '',
          attended: a.attended || false,
        };
      });
    }
  }

  return result;
}
