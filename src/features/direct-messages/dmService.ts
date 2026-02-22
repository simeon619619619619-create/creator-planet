// ============================================================================
// DIRECT MESSAGING - SERVICE FUNCTIONS
// CRUD operations for team members, conversations, and messages
// ============================================================================

import { supabase } from '../../core/supabase/client';
import type {
  DbCommunityTeamMember,
  TeamMemberWithProfile,
  DbDirectConversation,
  ConversationWithDetails,
  DbDirectMessage,
  MessageWithSender,
} from './dmTypes';

// ============================================================================
// TEAM MEMBERS
// ============================================================================

/**
 * Get all team members for a community (with profile info)
 */
export async function getTeamMembers(communityId: string): Promise<TeamMemberWithProfile[]> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select(`
      *,
      profile:profiles(*)
    `)
    .eq('community_id', communityId)
    .eq('invite_status', 'accepted')
    .eq('is_messageable', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching team members:', error);
    return [];
  }

  return (data || []) as TeamMemberWithProfile[];
}

/**
 * Get team members with unread counts for a specific user
 */
export async function getTeamMembersWithUnread(
  communityId: string,
  userProfileId: string
): Promise<TeamMemberWithProfile[]> {
  // First get team members
  const teamMembers = await getTeamMembers(communityId);

  // Then get unread counts from conversations
  const { data: conversations, error } = await supabase
    .from('direct_conversations')
    .select('team_member_id, unread_count_student')
    .eq('community_id', communityId)
    .eq('student_profile_id', userProfileId);

  if (error) {
    console.error('Error fetching conversation unread counts:', error);
    return teamMembers;
  }

  // Map unread counts to team members
  const unreadMap = new Map<string, number>();
  conversations?.forEach(conv => {
    unreadMap.set(conv.team_member_id, conv.unread_count_student);
  });

  return teamMembers.map(tm => ({
    ...tm,
    unread_count: unreadMap.get(tm.id) || 0,
  }));
}

/**
 * Check if current user is a team member in this community
 */
export async function isTeamMember(
  communityId: string,
  userProfileId: string
): Promise<DbCommunityTeamMember | null> {
  const { data, error } = await supabase
    .from('community_team_members')
    .select('*')
    .eq('community_id', communityId)
    .eq('profile_id', userProfileId)
    .eq('invite_status', 'accepted')
    .single();

  if (error) {
    // Not found is expected for non-team members
    if (error.code !== 'PGRST116') {
      console.error('Error checking team membership:', error);
    }
    return null;
  }

  return data;
}

// ============================================================================
// CONVERSATIONS
// ============================================================================

/**
 * Get or create a conversation between a student and team member
 */
export async function getOrCreateConversation(
  communityId: string,
  studentProfileId: string,
  teamMemberId: string
): Promise<DbDirectConversation | null> {
  // Try to find existing conversation
  const { data: existing, error: findError } = await supabase
    .from('direct_conversations')
    .select('*')
    .eq('community_id', communityId)
    .eq('student_profile_id', studentProfileId)
    .eq('team_member_id', teamMemberId)
    .single();

  if (existing) {
    return existing;
  }

  // Create new conversation if not found
  if (findError?.code === 'PGRST116') {
    const { data: newConv, error: createError } = await supabase
      .from('direct_conversations')
      .insert({
        community_id: communityId,
        student_profile_id: studentProfileId,
        team_member_id: teamMemberId,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating conversation:', createError);
      return null;
    }

    return newConv;
  }

  console.error('Error finding conversation:', findError);
  return null;
}

/**
 * Helper: Batch fetch last messages for multiple conversations
 * Reduces N+1 queries to a single query
 */
async function batchFetchLastMessages(
  conversationIds: string[]
): Promise<Map<string, DbDirectMessage>> {
  if (conversationIds.length === 0) return new Map();

  // Fetch last message for all conversations in a single query
  // Order by created_at DESC so first occurrence per conversation_id is the latest
  const { data: allMessages, error } = await supabase
    .from('direct_messages')
    .select('*')
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error batch fetching last messages:', error);
    return new Map();
  }

  // Build map of conversation_id -> last_message (first occurrence is latest due to ordering)
  const lastMessageMap = new Map<string, DbDirectMessage>();
  allMessages?.forEach(msg => {
    if (!lastMessageMap.has(msg.conversation_id)) {
      lastMessageMap.set(msg.conversation_id, msg);
    }
  });

  return lastMessageMap;
}

/**
 * Get all conversations for a team member (their inbox)
 */
export async function getTeamMemberConversations(
  teamMemberId: string
): Promise<ConversationWithDetails[]> {
  const { data, error } = await supabase
    .from('direct_conversations')
    .select(`
      *,
      student:profiles!direct_conversations_student_profile_id_fkey(*),
      team_member:community_team_members!direct_conversations_team_member_id_fkey(
        *,
        profile:profiles(*)
      )
    `)
    .eq('team_member_id', teamMemberId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching team member conversations:', error);
    return [];
  }

  // Batch fetch last messages (single query instead of N+1)
  const conversationIds = (data || []).map(c => c.id);
  const lastMessageMap = await batchFetchLastMessages(conversationIds);

  return (data || []).map(conv => ({
    ...conv,
    last_message: lastMessageMap.get(conv.id) || null,
  })) as ConversationWithDetails[];
}

/**
 * Get all conversations for a student in a community
 */
export async function getStudentConversations(
  communityId: string,
  studentProfileId: string
): Promise<ConversationWithDetails[]> {
  const { data, error } = await supabase
    .from('direct_conversations')
    .select(`
      *,
      student:profiles!direct_conversations_student_profile_id_fkey(*),
      team_member:community_team_members!direct_conversations_team_member_id_fkey(
        *,
        profile:profiles(*)
      )
    `)
    .eq('community_id', communityId)
    .eq('student_profile_id', studentProfileId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching student conversations:', error);
    return [];
  }

  return (data || []) as ConversationWithDetails[];
}

/**
 * Get all conversations in a community (for creator oversight)
 */
export async function getCommunityConversations(
  communityId: string,
  teamMemberId?: string
): Promise<ConversationWithDetails[]> {
  let query = supabase
    .from('direct_conversations')
    .select(`
      *,
      student:profiles!direct_conversations_student_profile_id_fkey(*),
      team_member:community_team_members!direct_conversations_team_member_id_fkey(
        *,
        profile:profiles(*)
      )
    `)
    .eq('community_id', communityId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (teamMemberId) {
    query = query.eq('team_member_id', teamMemberId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching community conversations:', error);
    return [];
  }

  // Batch fetch last messages (single query instead of N+1)
  const conversationIds = (data || []).map(c => c.id);
  const lastMessageMap = await batchFetchLastMessages(conversationIds);

  return (data || []).map(conv => ({
    ...conv,
    last_message: lastMessageMap.get(conv.id) || null,
  })) as ConversationWithDetails[];
}

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * Get messages for a conversation (with pagination)
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select(`
      *,
      sender:profiles!direct_messages_sender_profile_id_fkey(*)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  // Reverse to show oldest first (for display)
  return ((data || []) as MessageWithSender[]).reverse();
}

/**
 * Send a message in a conversation
 */
export async function sendMessage(
  conversationId: string,
  senderProfileId: string,
  content: string
): Promise<MessageWithSender | null> {
  // Insert message
  const { data: message, error: msgError } = await supabase
    .from('direct_messages')
    .insert({
      conversation_id: conversationId,
      sender_profile_id: senderProfileId,
      content: content.trim(),
    })
    .select(`
      *,
      sender:profiles!direct_messages_sender_profile_id_fkey(*)
    `)
    .single();

  if (msgError) {
    console.error('Error sending message:', msgError);
    return null;
  }

  // Update conversation's last_message_at
  // Note: unread counts are handled by database trigger (update_conversation_unread_count)
  const { data: conv } = await supabase
    .from('direct_conversations')
    .select('student_profile_id, team_member_id, creator_profile_id')
    .eq('id', conversationId)
    .single();

  if (conv) {
    await supabase
      .from('direct_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  }

  return message as MessageWithSender;
}

/**
 * Mark messages as read and reset unread count
 * Works for both team member and creator conversations
 */
export async function markConversationAsRead(
  conversationId: string,
  readerProfileId: string
): Promise<void> {
  // Get conversation to determine role
  const { data: conv } = await supabase
    .from('direct_conversations')
    .select('student_profile_id, team_member_id, creator_profile_id')
    .eq('id', conversationId)
    .single();

  if (!conv) return;

  const isStudent = conv.student_profile_id === readerProfileId;
  const isCreator = conv.creator_profile_id === readerProfileId;

  // Determine which unread count to reset
  let updateData: Record<string, number>;
  let senderToMark: string | null = null;

  if (isStudent) {
    updateData = { unread_count_student: 0 };
    // Mark messages from the other participant as read
    if (conv.creator_profile_id) {
      senderToMark = conv.creator_profile_id;
    } else if (conv.team_member_id) {
      const { data: teamMember } = await supabase
        .from('community_team_members')
        .select('profile_id')
        .eq('id', conv.team_member_id)
        .single();
      senderToMark = teamMember?.profile_id || null;
    }
  } else if (isCreator) {
    updateData = { unread_count_creator: 0 };
    senderToMark = conv.student_profile_id;
  } else {
    // Team member reading
    updateData = { unread_count_team: 0 };
    senderToMark = conv.student_profile_id;
  }

  await supabase
    .from('direct_conversations')
    .update(updateData)
    .eq('id', conversationId);

  if (senderToMark) {
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_profile_id', senderToMark)
      .is('read_at', null);
  }
}

/**
 * Get total unread count for a user across all conversations in a community
 */
export async function getTotalUnreadCount(
  communityId: string,
  userProfileId: string,
  isTeamMember: boolean
): Promise<number> {
  if (isTeamMember) {
    // Get team member's ID first
    const { data: teamMember } = await supabase
      .from('community_team_members')
      .select('id')
      .eq('community_id', communityId)
      .eq('profile_id', userProfileId)
      .single();

    if (!teamMember) return 0;

    const { data } = await supabase
      .from('direct_conversations')
      .select('unread_count_team')
      .eq('team_member_id', teamMember.id);

    return (data || []).reduce((sum, c) => sum + (c.unread_count_team || 0), 0);
  } else {
    const { data } = await supabase
      .from('direct_conversations')
      .select('unread_count_student')
      .eq('community_id', communityId)
      .eq('student_profile_id', userProfileId);

    return (data || []).reduce((sum, c) => sum + (c.unread_count_student || 0), 0);
  }
}

// ============================================================================
// ADDITIONAL CONVERSATION FUNCTIONS
// ============================================================================

/**
 * Get a single conversation by ID with full details
 */
export async function getConversation(
  conversationId: string
): Promise<ConversationWithDetails | null> {
  // Fetch conversation and last message in parallel
  const [convResult, lastMessageMap] = await Promise.all([
    supabase
      .from('direct_conversations')
      .select(`
        *,
        student:profiles!direct_conversations_student_profile_id_fkey(*),
        team_member:community_team_members!direct_conversations_team_member_id_fkey(
          *,
          profile:profiles(*)
        )
      `)
      .eq('id', conversationId)
      .single(),
    batchFetchLastMessages([conversationId]),
  ]);

  if (convResult.error) {
    console.error('Error fetching conversation:', convResult.error);
    return null;
  }

  return {
    ...convResult.data,
    last_message: lastMessageMap.get(conversationId) || null,
  } as ConversationWithDetails;
}

/**
 * Get all conversations for a user (inbox view)
 * Works for both students and team members
 */
export async function getConversations(
  profileId: string
): Promise<ConversationWithDetails[]> {
  // Check if user is a team member in any community
  const { data: teamMemberships } = await supabase
    .from('community_team_members')
    .select('id')
    .eq('profile_id', profileId)
    .eq('invite_status', 'accepted');

  const teamMemberIds = teamMemberships?.map(tm => tm.id) || [];

  // Get conversations where user is student OR team member
  let query = supabase
    .from('direct_conversations')
    .select(`
      *,
      student:profiles!direct_conversations_student_profile_id_fkey(*),
      team_member:community_team_members!direct_conversations_team_member_id_fkey(
        *,
        profile:profiles(*)
      )
    `)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  // Build OR condition: student_profile_id = profileId OR team_member_id IN teamMemberIds
  if (teamMemberIds.length > 0) {
    query = query.or(`student_profile_id.eq.${profileId},team_member_id.in.(${teamMemberIds.join(',')})`);
  } else {
    query = query.eq('student_profile_id', profileId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conversations:', error);
    return [];
  }

  // Batch fetch last messages (single query instead of N+1)
  const conversationIds = (data || []).map(c => c.id);
  const lastMessageMap = await batchFetchLastMessages(conversationIds);

  return (data || []).map(conv => ({
    ...conv,
    last_message: lastMessageMap.get(conv.id) || null,
  })) as ConversationWithDetails[];
}

/**
 * Check if user can send messages in a conversation
 * Creator oversight is read-only, but creator's OWN conversations allow sending
 */
export async function canSendMessage(
  conversationId: string,
  profileId: string
): Promise<boolean> {
  const { data: conversation } = await supabase
    .from('direct_conversations')
    .select(`
      student_profile_id,
      creator_profile_id,
      team_member:community_team_members!direct_conversations_team_member_id_fkey(
        profile_id
      )
    `)
    .eq('id', conversationId)
    .single();

  if (!conversation) return false;

  // Check if user is the student
  if (conversation.student_profile_id === profileId) {
    return true;
  }

  // Check if user is the creator (their own direct conversation)
  if (conversation.creator_profile_id === profileId) {
    return true;
  }

  // Check if user is the team member
  const teamMember = conversation.team_member as unknown as { profile_id: string | null } | null;
  if (teamMember?.profile_id === profileId) {
    return true;
  }

  // User is neither participant (could be creator with oversight - read-only)
  return false;
}

/**
 * Get message count for a conversation (for pagination)
 */
export async function getMessageCount(conversationId: string): Promise<number> {
  const { count, error } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('conversation_id', conversationId);

  if (error) {
    console.error('Error fetching message count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get paginated messages with total count (for chat thread)
 */
export async function getMessagesWithPagination(
  conversationId: string,
  limit: number = 50,
  offset: number = 0
): Promise<{ messages: MessageWithSender[]; total: number; hasMore: boolean }> {
  const [messages, total] = await Promise.all([
    getMessages(conversationId, limit, offset),
    getMessageCount(conversationId),
  ]);

  return {
    messages,
    total,
    hasMore: offset + limit < total,
  };
}

// ============================================================================
// CREATOR DIRECT MESSAGING
// ============================================================================

/**
 * Get or create a conversation between a creator and a student
 */
export async function getOrCreateCreatorConversation(
  communityId: string,
  creatorProfileId: string,
  studentProfileId: string
): Promise<DbDirectConversation | null> {
  // Try to find existing conversation
  const { data: existing, error: findError } = await supabase
    .from('direct_conversations')
    .select('*')
    .eq('community_id', communityId)
    .eq('creator_profile_id', creatorProfileId)
    .eq('student_profile_id', studentProfileId)
    .single();

  if (existing) {
    return existing;
  }

  // Create new conversation if not found
  if (findError?.code === 'PGRST116') {
    const { data: newConv, error: createError } = await supabase
      .from('direct_conversations')
      .insert({
        community_id: communityId,
        creator_profile_id: creatorProfileId,
        student_profile_id: studentProfileId,
        team_member_id: null, // Explicitly null for creator conversations
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating creator conversation:', createError);
      return null;
    }

    return newConv;
  }

  console.error('Error finding creator conversation:', findError);
  return null;
}

/**
 * Get all creator-to-student conversations for a creator (their DM inbox)
 */
export async function getCreatorConversations(
  creatorProfileId: string,
  communityId?: string
): Promise<ConversationWithDetails[]> {
  let query = supabase
    .from('direct_conversations')
    .select(`
      *,
      student:profiles!direct_conversations_student_profile_id_fkey(*),
      creator:profiles!direct_conversations_creator_profile_id_fkey(*)
    `)
    .eq('creator_profile_id', creatorProfileId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (communityId) {
    query = query.eq('community_id', communityId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching creator conversations:', error);
    return [];
  }

  // Batch fetch last messages (single query instead of N+1)
  const conversationIds = (data || []).map(c => c.id);
  const lastMessageMap = await batchFetchLastMessages(conversationIds);

  return (data || []).map(conv => ({
    ...conv,
    team_member: null, // Creator conversations don't have team members
    last_message: lastMessageMap.get(conv.id) || null,
  })) as ConversationWithDetails[];
}

/**
 * Get all conversations for a student (both team member AND creator conversations)
 */
export async function getStudentAllConversations(
  communityId: string,
  studentProfileId: string
): Promise<ConversationWithDetails[]> {
  const { data, error } = await supabase
    .from('direct_conversations')
    .select(`
      *,
      student:profiles!direct_conversations_student_profile_id_fkey(*),
      team_member:community_team_members!direct_conversations_team_member_id_fkey(
        *,
        profile:profiles(*)
      ),
      creator:profiles!direct_conversations_creator_profile_id_fkey(*)
    `)
    .eq('community_id', communityId)
    .eq('student_profile_id', studentProfileId)
    .order('last_message_at', { ascending: false, nullsFirst: false });

  if (error) {
    console.error('Error fetching student all conversations:', error);
    return [];
  }

  // Batch fetch last messages (single query instead of N+1)
  const conversationIds = (data || []).map(c => c.id);
  const lastMessageMap = await batchFetchLastMessages(conversationIds);

  return (data || []).map(conv => ({
    ...conv,
    last_message: lastMessageMap.get(conv.id) || null,
  })) as ConversationWithDetails[];
}

/**
 * Mark a creator conversation as read
 */
export async function markCreatorConversationAsRead(
  conversationId: string,
  readerProfileId: string
): Promise<void> {
  // Get conversation to determine role
  const { data: conv } = await supabase
    .from('direct_conversations')
    .select('student_profile_id, creator_profile_id')
    .eq('id', conversationId)
    .single();

  if (!conv || !conv.creator_profile_id) return;

  const isStudent = conv.student_profile_id === readerProfileId;

  // Reset the appropriate unread count
  const updateData = isStudent
    ? { unread_count_student: 0 }
    : { unread_count_creator: 0 };

  await supabase
    .from('direct_conversations')
    .update(updateData)
    .eq('id', conversationId);

  // Mark unread messages as read
  const senderToMark = isStudent ? conv.creator_profile_id : conv.student_profile_id;

  if (senderToMark) {
    await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_profile_id', senderToMark)
      .is('read_at', null);
  }
}

/**
 * Get unread count for creator's direct conversations
 */
export async function getCreatorUnreadCount(
  creatorProfileId: string,
  communityId?: string
): Promise<number> {
  let query = supabase
    .from('direct_conversations')
    .select('unread_count_creator')
    .eq('creator_profile_id', creatorProfileId);

  if (communityId) {
    query = query.eq('community_id', communityId);
  }

  const { data } = await query;

  return (data || []).reduce((sum, c) => sum + (c.unread_count_creator || 0), 0);
}
