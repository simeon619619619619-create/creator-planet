// ============================================================================
// DIRECT MESSAGING - TYPE DEFINITIONS
// Types for team members and direct messaging feature
// ============================================================================

import type { DbProfile } from '../../core/supabase/database.types';

// Team member roles
export type TeamMemberRole = 'lecturer' | 'assistant' | 'guest_expert';
export type InviteStatus = 'pending' | 'accepted';

// Community team member
export interface DbCommunityTeamMember {
  id: string;
  community_id: string;
  profile_id: string | null;
  role: TeamMemberRole;
  title: string | null;
  bio: string | null;
  is_messageable: boolean;
  invited_email: string | null;
  invite_status: InviteStatus;
  invite_token: string | null;
  invite_expires_at: string | null;
  invite_created_at: string | null;
  created_at: string;
  updated_at: string;
}

// Team member with profile info (for display)
export interface TeamMemberWithProfile extends DbCommunityTeamMember {
  profile: DbProfile | null;
  unread_count?: number;
}

// Direct conversation between student and team member OR creator
export interface DbDirectConversation {
  id: string;
  community_id: string;
  student_profile_id: string;
  // Either team_member_id OR creator_profile_id is set (never both)
  team_member_id: string | null;
  creator_profile_id: string | null;
  last_message_at: string | null;
  unread_count_student: number;
  unread_count_team: number;
  unread_count_creator: number;
  created_at: string;
}

// Conversation with nested data for display
export interface ConversationWithDetails extends DbDirectConversation {
  student: DbProfile | null;
  team_member: TeamMemberWithProfile | null;
  // For creator-to-student conversations
  creator: DbProfile | null;
  last_message?: DbDirectMessage | null;
}

// Direct message
export interface DbDirectMessage {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

// Message with sender info for display
export interface MessageWithSender extends DbDirectMessage {
  sender: DbProfile | null;
}

// View mode for the chat panel
export type ChatViewMode = 'chat' | 'inbox' | 'conversation_view';

// Props for chat-related components
export interface ChatState {
  selectedTeamMember: TeamMemberWithProfile | null;
  selectedConversation: ConversationWithDetails | null;
  viewMode: ChatViewMode;
}

// ============================================================================
// TEAM MANAGEMENT TYPES
// ============================================================================

/**
 * Input for inviting a new team member by email
 */
export interface InviteTeamMemberInput {
  email: string;
  role: TeamMemberRole;
  title?: string;
  bio?: string;
  is_messageable?: boolean;
}

/**
 * Input for updating an existing team member
 */
export interface UpdateTeamMemberInput {
  role?: TeamMemberRole;
  title?: string;
  bio?: string;
  is_messageable?: boolean;
}

/**
 * Input for promoting an existing community member to team
 */
export interface PromoteToTeamInput {
  profile_id: string;
  role: TeamMemberRole;
  title?: string;
  bio?: string;
  is_messageable?: boolean;
}

/**
 * Badge type for team/guest visual distinction
 */
export type TeamBadgeType = 'team' | 'guest';

/**
 * Get badge type from role
 */
export function getBadgeType(role: TeamMemberRole): TeamBadgeType {
  return role === 'guest_expert' ? 'guest' : 'team';
}

/**
 * Role display configuration for UI
 */
export interface RoleDisplayConfig {
  key: TeamMemberRole;
  labelKey: string;
  descriptionKey: string;
  badgeType: TeamBadgeType;
}

/**
 * All role configurations for UI display
 */
export const TEAM_ROLE_CONFIGS: RoleDisplayConfig[] = [
  {
    key: 'lecturer',
    labelKey: 'team.roles.lecturer',
    descriptionKey: 'team.roles.lecturerDescription',
    badgeType: 'team',
  },
  {
    key: 'assistant',
    labelKey: 'team.roles.assistant',
    descriptionKey: 'team.roles.assistantDescription',
    badgeType: 'team',
  },
  {
    key: 'guest_expert',
    labelKey: 'team.roles.guest_expert',
    descriptionKey: 'team.roles.guestExpertDescription',
    badgeType: 'guest',
  },
];

// ============================================================================
// INBOX & CHAT THREAD TYPES
// ============================================================================

/**
 * Inbox item for listing conversations (student or team member view)
 */
export interface InboxItem {
  id: string;
  conversationId: string;
  communityId: string;
  communityName: string;
  // The other participant
  participantId: string;
  participantName: string;
  participantAvatarUrl: string | null;
  participantRole: TeamMemberRole | 'student' | 'creator';
  participantTitle: string | null;
  // Message preview
  lastMessageContent: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  // Unread state
  unreadCount: number;
  hasUnread: boolean;
  // Timestamps
  createdAt: string;
}

/**
 * Chat thread for displaying a full conversation
 */
export interface ChatThread {
  conversation: ConversationWithDetails;
  messages: MessageWithSender[];
  // Pagination
  hasMore: boolean;
  nextOffset: number;
}

/**
 * Service result type for operations
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Team member display info for sidebar
 */
export interface TeamMemberDisplay {
  id: string;
  profileId: string | null;
  communityId: string;
  role: TeamMemberRole;
  title: string | null;
  bio: string | null;
  isMessageable: boolean;
  inviteStatus: InviteStatus;
  invitedEmail: string | null;
  // From profile (or fallback for pending invites)
  fullName: string;
  avatarUrl: string | null;
  email: string | null;
  // Derived
  badgeType: TeamBadgeType;
  hasUnread: boolean;
  unreadCount: number;
}

/**
 * Creator's view of a team member's inbox
 */
export interface TeamMemberInboxView {
  teamMember: TeamMemberWithProfile;
  conversations: InboxItem[];
  totalConversations: number;
}

/**
 * Creator's read-only view of a conversation
 */
export interface ConversationOversightView {
  conversation: ConversationWithDetails;
  messages: MessageWithSender[];
  isReadOnly: boolean;
}

/**
 * Unread counts summary
 */
export interface UnreadSummary {
  totalUnread: number;
  byTeamMember: Record<string, number>;
  byCommunity: Record<string, number>;
}
