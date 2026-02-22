import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, MessageSquare, MoreHorizontal, Image as ImageIcon, Smile, Send, Plus, Users, Loader2, Trophy, Star, Zap, Pin, Trash2, Copy, Flag, Edit3, X, Settings, GripVertical, LogOut, MessageCircle, Menu, Hash, Award } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { useCommunity } from '../../core/contexts/CommunityContext';
import {
  getChannels,
  getPosts,
  createPost,
  createCommunity,
  updateCommunity,
  toggleLike,
  joinCommunity,
  getMembership,
  seedDefaultChannels,
  getComments,
  createComment,
  deletePost,
  togglePinPost,
  uploadPostImage,
  createChannel,
  updateChannel,
  deleteChannel,
  getChannelsByGroup,
} from './communityService';
import { getChannelUnreadStatus, markChannelAsRead } from './channelReadService';
import UserProfilePopup from './UserProfilePopup';
import { GroupFolderSection, GroupManager, GroupMemberAssigner } from './components';
import CommunityPricingSettings from './components/CommunityPricingSettings';
import LeaveCommunityModal from './components/LeaveCommunityModal';
import PendingSurveyBanner from '../surveys/components/PendingSurveyBanner';
import {
  getUserPoints,
  getCommunityLeaderboard,
  awardPoints,
  getLevelProgress,
  getPointsForNextLevel,
} from './pointsService';
import { getGroupsWithCounts, getUserGroupsInCommunity } from './groupService';
import type { DbCommunityChannel, DbPostWithAuthor, DbPoints, DbPostCommentWithAuthor, ChannelsByGroup, DbCommunityGroupWithCount } from '../../core/supabase/database.types';
import { TeamSection, ChatPanel } from '../direct-messages/components';
import TeamSettingsTab from '../direct-messages/pages/TeamSettingsTab';
import { getTeamMembersWithUnread, isTeamMember } from '../direct-messages/dmService';
import type { TeamMemberWithProfile, DbCommunityTeamMember } from '../direct-messages/dmTypes';
import { useCommunityLimitCheck } from '../billing/hooks/useLimitCheck';
import UpgradePrompt from '../billing/components/UpgradePrompt';

interface CommunityHubProps {
  showCreateModal?: boolean;
  onCloseCreateModal?: () => void;
}

const CommunityHub: React.FC<CommunityHubProps> = ({ showCreateModal = false, onCloseCreateModal }) => {
  const { t } = useTranslation();
  const { user, profile, role } = useAuth();
  const { communities, selectedCommunity, setSelectedCommunity, isLoading: communitiesLoading, refreshCommunities } = useCommunity();

  // Plan limit check for creators
  const communityLimit = useCommunityLimitCheck();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  // State
  const [channels, setChannels] = useState<DbCommunityChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<DbCommunityChannel | null>(null);
  const [posts, setPosts] = useState<DbPostWithAuthor[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isPostingLoading, setIsPostingLoading] = useState(false);
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');
  const [isMember, setIsMember] = useState(false);

  // Gamification state
  const [userPoints, setUserPoints] = useState<DbPoints | null>(null);
  const [leaderboard, setLeaderboard] = useState<(DbPoints & { user: { full_name: string; avatar_url: string | null; role: string } })[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Comment state
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [postComments, setPostComments] = useState<Map<string, DbPostCommentWithAuthor[]>>(new Map());
  const [newComment, setNewComment] = useState<Map<string, string>>(new Map());
  const [loadingComments, setLoadingComments] = useState<Set<string>>(new Set());
  const [submittingComment, setSubmittingComment] = useState(false);

  // Profile popup state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  // Post menu state
  const [openMenuPostId, setOpenMenuPostId] = useState<string | null>(null);

  // Channel management state
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<DbCommunityChannel | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelGroupId, setChannelGroupId] = useState<string | null>(null);
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [showChannelMenu, setShowChannelMenu] = useState<string | null>(null);

  // Community settings state
  const [showPricingSettings, setShowPricingSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'team'>('general');
  const [editingCommunityName, setEditingCommunityName] = useState('');
  const [isSavingCommunityName, setIsSavingCommunityName] = useState(false);

  // Group management state
  const [channelsByGroup, setChannelsByGroup] = useState<ChannelsByGroup | null>(null);
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<DbCommunityGroupWithCount[]>([]);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [selectedGroupForAssign, setSelectedGroupForAssign] = useState<string | null>(null);

  // Channel unread tracking state
  const [unreadChannelIds, setUnreadChannelIds] = useState<Set<string>>(new Set());

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Leave community modal state
  const [showLeaveCommunityModal, setShowLeaveCommunityModal] = useState(false);
  const [showCommunityMenu, setShowCommunityMenu] = useState(false);
  const communityMenuRef = useRef<HTMLDivElement>(null);

  // Direct messaging state
  const [teamMembers, setTeamMembers] = useState<TeamMemberWithProfile[]>([]);
  const [selectedTeamMember, setSelectedTeamMember] = useState<TeamMemberWithProfile | null>(null);
  const [currentUserTeamMember, setCurrentUserTeamMember] = useState<DbCommunityTeamMember | null>(null);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [creatorChatTargetId, setCreatorChatTargetId] = useState<string | null>(null);

  // Give Points modal state
  const [showGivePointsModal, setShowGivePointsModal] = useState(false);
  const [givePointsTarget, setGivePointsTarget] = useState<{ profileId: string; name: string } | null>(null);
  const [givePointsAmount, setGivePointsAmount] = useState(5);
  const [givePointsReason, setGivePointsReason] = useState('');
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);

  // URL params for deep linking (e.g., ?openChat=<teamMemberId>)
  const [searchParams, setSearchParams] = useSearchParams();

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Image upload and emoji picker state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Computed values
  const isOwner = profile?.id === selectedCommunity?.creator_id;

  // Handle external showCreateModal prop
  useEffect(() => {
    if (showCreateModal) {
      // Check limit before showing create modal
      if (!communityLimit.allowed && !communityLimit.loading) {
        setShowUpgradePrompt(true);
        onCloseCreateModal?.();
      } else {
        setShowCreateCommunity(true);
      }
    }
  }, [showCreateModal, communityLimit.allowed, communityLimit.loading, onCloseCreateModal]);

  // Load channels when community changes
  useEffect(() => {
    if (selectedCommunity) {
      loadChannels(selectedCommunity.id);
      loadChannelsByGroup();
      checkMembership(selectedCommunity.id);
      loadUserPoints(selectedCommunity.id);
      loadLeaderboard(selectedCommunity.id);
      loadTeamMembers(selectedCommunity.id);
      loadChannelUnreadStatus(selectedCommunity.id);
    }
  }, [selectedCommunity, user]);

  // Load channel unread status
  const loadChannelUnreadStatus = async (communityId: string) => {
    if (!profile?.id) return;
    try {
      const unread = await getChannelUnreadStatus(communityId, profile.id);
      setUnreadChannelIds(unread);
    } catch (error) {
      console.error('Error loading channel unread status:', error);
    }
  };

  // Load posts when channel changes and mark as read
  useEffect(() => {
    if (selectedChannel) {
      loadPosts(selectedChannel.id);
      // Mark channel as read - only update UI state if database write succeeds
      if (profile?.id) {
        const channelId = selectedChannel.id;
        const profileId = profile.id;
        (async () => {
          const success = await markChannelAsRead(channelId, profileId);
          if (success) {
            setUnreadChannelIds(prev => {
              const next = new Set(prev);
              next.delete(channelId);
              return next;
            });
          }
        })();
      }
    }
  }, [selectedChannel, profile?.id]);

  // Close channel menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowChannelMenu(null);
    if (showChannelMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showChannelMenu]);

  // Close community menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowCommunityMenu(false);
    if (showCommunityMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showCommunityMenu]);

  // Handle openChat URL param for deep linking to DM conversations
  useEffect(() => {
    const openChatId = searchParams.get('openChat');
    if (openChatId && teamMembers.length > 0) {
      // Find the team member by ID
      const teamMember = teamMembers.find(m => m.id === openChatId);
      if (teamMember) {
        // Open the chat panel with this team member
        setSelectedTeamMember(teamMember);
        setShowChatPanel(true);
        setSelectedChannel(null);
        // Clear the param from URL to avoid re-opening on refresh
        setSearchParams({}, { replace: true });
      }
    }
  }, [searchParams, teamMembers, setSearchParams]);

  // Handle openCreatorChat URL param for creator-student direct conversations
  useEffect(() => {
    const openCreatorChatId = searchParams.get('openCreatorChat');
    if (openCreatorChatId && selectedCommunity && profile) {
      // Determine who's chatting with whom
      if (openCreatorChatId === 'creator') {
        // Student wants to chat with creator
        setCreatorChatTargetId(selectedCommunity.creator_id);
      } else {
        // Creator wants to chat with specific student
        setCreatorChatTargetId(openCreatorChatId);
      }
      setSelectedTeamMember(null); // Clear team member selection
      setShowChatPanel(true);
      setSelectedChannel(null);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, selectedCommunity, profile, setSearchParams]);

  const loadChannels = async (communityId: string) => {
    const channelList = await getChannels(communityId);
    setChannels(channelList);

    // Auto-select first channel (usually "General")
    if (channelList.length > 0) {
      setSelectedChannel(channelList[0]);
    } else {
      setSelectedChannel(null);
      setPosts([]);
    }
  };

  const loadPosts = async (channelId: string) => {
    const postList = await getPosts(channelId);
    setPosts(postList);
  };

  const checkMembership = async (communityId: string) => {
    if (!user) return;
    const membership = await getMembership(user.id, communityId);
    setIsMember(!!membership);
  };

  const loadUserPoints = async (communityId: string) => {
    if (!user) return;
    const points = await getUserPoints(user.id, communityId);
    setUserPoints(points);
  };

  const loadLeaderboard = async (communityId: string) => {
    const topMembers = await getCommunityLeaderboard(communityId, 10);
    setLeaderboard(topMembers);
  };

  const loadTeamMembers = async (communityId: string) => {
    if (!profile?.id) return;

    // Load team members with unread counts
    const members = await getTeamMembersWithUnread(communityId, profile.id);
    setTeamMembers(members);

    // Check if current user is a team member
    const userTeamMember = await isTeamMember(communityId, profile.id);
    setCurrentUserTeamMember(userTeamMember);
  };

  const handleSelectTeamMember = (member: TeamMemberWithProfile) => {
    setSelectedTeamMember(member);
    setShowChatPanel(true);
    // Clear channel selection when opening chat
    setSelectedChannel(null);
  };

  const handleCloseChatPanel = () => {
    setShowChatPanel(false);
    setSelectedTeamMember(null);
    setCreatorChatTargetId(null);
    // Re-select first channel when closing chat
    if (channelsByGroup?.global && channelsByGroup.global.length > 0) {
      setSelectedChannel(channelsByGroup.global[0]);
    }
  };

  const loadChannelsByGroup = async () => {
    if (!selectedCommunity || !user?.id) return;

    // Get user's groups in this community
    const userGroups = await getUserGroupsInCommunity(selectedCommunity.id, user.id);
    const groupIds = userGroups.map((g) => g.id);
    setUserGroupIds(groupIds);

    // Get channels organized by group (owners see all group channels)
    const organized = await getChannelsByGroup(selectedCommunity.id, groupIds, isOwner);
    setChannelsByGroup(organized);

    // For owners, load all groups with counts
    if (isOwner) {
      const allGroups = await getGroupsWithCounts(selectedCommunity.id);
      setGroups(allGroups);
    }

    // Auto-select first channel if none selected
    if (!selectedChannel) {
      if (organized.global.length > 0) {
        setSelectedChannel(organized.global[0]);
      } else if (organized.groups.length > 0 && organized.groups[0].channels.length > 0) {
        setSelectedChannel(organized.groups[0].channels[0]);
      }
    }
  };

  const handleCreateCommunity = async () => {
    if (!user || !newCommunityName.trim()) return;

    // Check plan limit before creating
    if (!communityLimit.allowed) {
      setShowCreateCommunity(false);
      setShowUpgradePrompt(true);
      return;
    }

    const community = await createCommunity(user.id, newCommunityName.trim());
    if (community) {
      // Seed default channels
      await seedDefaultChannels(community.id);

      // Auto-join as admin
      await joinCommunity(user.id, community.id, 'admin');

      // Refresh communities in context (will auto-select the new one)
      await refreshCommunities();
      setNewCommunityName('');
      setShowCreateCommunity(false);
      onCloseCreateModal?.();
    }
  };

  const handleCloseCreateModal = () => {
    setShowCreateCommunity(false);
    setNewCommunityName('');
    onCloseCreateModal?.();
  };

  // Channel management handlers
  const handleOpenChannelModal = (channel?: DbCommunityChannel, presetGroupId?: string | null) => {
    if (channel) {
      setEditingChannel(channel);
      setChannelName(channel.name);
      setChannelDescription(channel.description || '');
      setChannelGroupId(channel.group_id || null);
    } else {
      setEditingChannel(null);
      setChannelName('');
      setChannelDescription('');
      // Use preset group ID when creating channel from a group folder
      setChannelGroupId(presetGroupId ?? null);
    }
    setShowChannelModal(true);
    setShowChannelMenu(null);
  };

  const handleCloseChannelModal = () => {
    setShowChannelModal(false);
    setEditingChannel(null);
    setChannelName('');
    setChannelDescription('');
    setChannelGroupId(null);
  };

  const handleSaveChannel = async () => {
    if (!selectedCommunity || !channelName.trim()) return;

    setIsSavingChannel(true);
    try {
      if (editingChannel) {
        // Update existing channel
        const updated = await updateChannel(editingChannel.id, {
          name: channelName.trim(),
          description: channelDescription.trim() || undefined,
          group_id: channelGroupId,
        });
        if (updated) {
          setChannels(prev => prev.map(c => c.id === updated.id ? updated : c));
          if (selectedChannel?.id === updated.id) {
            setSelectedChannel(updated);
          }
        }
      } else {
        // Create new channel
        const position = channels.length;
        const newCh = await createChannel(
          selectedCommunity.id,
          channelName.trim(),
          channelDescription.trim() || undefined,
          position,
          channelGroupId
        );
        if (newCh) {
          setChannels(prev => [...prev, newCh]);
        }
      }
      handleCloseChannelModal();
      // Refresh the grouped channels sidebar
      await loadChannelsByGroup();
    } finally {
      setIsSavingChannel(false);
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!window.confirm(t('communityHub.confirm.deleteChannel'))) {
      return;
    }

    const success = await deleteChannel(channelId);
    if (success) {
      setChannels(prev => prev.filter(c => c.id !== channelId));
      // If deleted channel was selected, select the first remaining channel
      if (selectedChannel?.id === channelId) {
        const remaining = channels.filter(c => c.id !== channelId);
        setSelectedChannel(remaining[0] || null);
      }
    }
    setShowChannelMenu(null);
  };

  const handleCreatePost = async () => {
    if (!user || !selectedChannel || !selectedCommunity || !profile) return;
    // Must have either text content or an image
    if (!newPost.trim() && !pendingImage) return;

    setIsPostingLoading(true);
    try {
      let imageUrl: string | null = null;

      // Upload image if present
      if (pendingImage) {
        setIsUploadingImage(true);
        imageUrl = await uploadPostImage(pendingImage, selectedChannel.id);
        setIsUploadingImage(false);
      }

      const post = await createPost(selectedChannel.id, user.id, newPost.trim(), imageUrl);
      if (post) {
        setNewPost('');
        setPendingImage(null);
        setPendingImagePreview(null);
        // Reload posts to get the full post with author
        await loadPosts(selectedChannel.id);
      }
    } finally {
      setIsPostingLoading(false);
      setIsUploadingImage(false);
    }
  };

  const handleToggleLike = async (postId: string, currentlyLiked: boolean, authorId: string) => {
    if (!user || !selectedCommunity) return;

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          user_has_liked: !currentlyLiked,
          likes_count: currentlyLiked ? (p.likes_count || 1) - 1 : (p.likes_count || 0) + 1,
        };
      }
      return p;
    }));

    await toggleLike(postId, user.id, currentlyLiked, authorId, selectedCommunity.id);
  };

  const handleJoinCommunity = async () => {
    if (!user || !selectedCommunity) return;
    const membership = await joinCommunity(user.id, selectedCommunity.id);
    if (membership) {
      setIsMember(true);
    }
  };

  const handleToggleComments = async (postId: string) => {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }

    setExpandedPostId(postId);

    // Load comments if not already loaded
    if (!postComments.has(postId)) {
      setLoadingComments(prev => new Set(prev).add(postId));
      const comments = await getComments(postId);
      setPostComments(prev => new Map(prev).set(postId, comments));
      setLoadingComments(prev => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleSubmitComment = async (postId: string) => {
    if (!user || !selectedCommunity) return;
    const commentText = newComment.get(postId)?.trim();
    if (!commentText) return;

    setSubmittingComment(true);
    try {
      const comment = await createComment(postId, user.id, commentText, selectedCommunity.id);
      if (comment) {
        // Clear input
        setNewComment(prev => {
          const next = new Map(prev);
          next.delete(postId);
          return next;
        });

        // Reload comments
        const comments = await getComments(postId);
        setPostComments(prev => new Map(prev).set(postId, comments));

        // Update comment count in post
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, comments_count: (p.comments_count || 0) + 1 }
            : p
        ));

        // Reload user points and leaderboard
        await loadUserPoints(selectedCommunity.id);
        await loadLeaderboard(selectedCommunity.id);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCommentInputChange = (postId: string, value: string) => {
    setNewComment(prev => new Map(prev).set(postId, value));
  };

  const handleOpenProfile = (profileId: string) => {
    setSelectedProfileId(profileId);
    setShowProfilePopup(true);
    // Close leaderboard modal when opening profile to prevent stacked modals
    setShowLeaderboard(false);
  };

  const handleCloseProfile = () => {
    setShowProfilePopup(false);
    setSelectedProfileId(null);
  };

  // Check if current user can award points (is owner or team member)
  const canAwardPoints = isOwner || currentUserTeamMember !== null;

  // Give Points handlers
  const handleOpenGivePoints = (profileId: string, name: string) => {
    setGivePointsTarget({ profileId, name });
    setGivePointsAmount(5);
    setGivePointsReason('');
    setShowGivePointsModal(true);
  };

  const handleCloseGivePoints = () => {
    if (!isAwardingPoints) {
      setShowGivePointsModal(false);
      setGivePointsTarget(null);
    }
  };

  const handleAwardPoints = async () => {
    if (!givePointsTarget || !selectedCommunity || givePointsAmount < 1 || givePointsAmount > 100) return;

    setIsAwardingPoints(true);
    try {
      const result = await awardPoints(
        givePointsTarget.profileId,
        selectedCommunity.id,
        givePointsAmount,
        givePointsReason || t('communityHub.givePoints.defaultReason')
      );

      if (result) {
        // Refresh leaderboard and user points
        await loadLeaderboard(selectedCommunity.id);
        await loadUserPoints(selectedCommunity.id);
        handleCloseGivePoints();
      }
    } catch (error) {
      console.error('Error awarding points:', error);
    } finally {
      setIsAwardingPoints(false);
    }
  };

  // Post menu handlers
  const handleToggleMenu = (postId: string) => {
    setOpenMenuPostId(prev => prev === postId ? null : postId);
  };

  const handleCloseMenu = () => {
    setOpenMenuPostId(null);
  };

  const handlePinPost = async (postId: string, currentlyPinned: boolean) => {
    const success = await togglePinPost(postId, currentlyPinned);
    if (success) {
      // Optimistic update
      setPosts(prev => prev.map(p =>
        p.id === postId ? { ...p, is_pinned: !currentlyPinned } : p
      ));
      // Reload posts to get proper ordering
      if (selectedChannel) {
        await loadPosts(selectedChannel.id);
      }
    }
    handleCloseMenu();
  };

  const handleDeletePost = (postId: string) => {
    setPostToDelete(postId);
    setShowDeleteModal(true);
    handleCloseMenu();
  };

  const confirmDeletePost = async () => {
    if (!postToDelete) return;

    setIsDeleting(true);
    const success = await deletePost(postToDelete);
    if (success) {
      setPosts(prev => prev.filter(p => p.id !== postToDelete));
    }
    setIsDeleting(false);
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const cancelDeletePost = () => {
    setShowDeleteModal(false);
    setPostToDelete(null);
  };

  const handleCopyPostLink = (postId: string) => {
    const url = `${window.location.origin}/community/post/${postId}`;
    navigator.clipboard.writeText(url);
    handleCloseMenu();
  };

  const handleReportPost = (postId: string) => {
    // For now, just show an alert - can be expanded later
    alert(t('communityHub.alert.reportSubmitted'));
    handleCloseMenu();
  };

  const isCreator = role === 'creator' || role === 'superadmin';

  // Common emojis for quick picker
  const commonEmojis = ['😀', '😂', '❤️', '👍', '🎉', '🔥', '💪', '🙌', '✨', '👏', '🚀', '💯', '🤔', '😊', '🙏', '💡'];

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPendingImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    setPendingImage(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = () => {
    setPendingImage(null);
    setPendingImagePreview(null);
  };

  const handleEmojiClick = (emoji: string) => {
    setNewPost(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t('communityHub.time.justNow');
    if (diffMins < 60) return diffMins === 1 ? t('communityHub.time.minuteAgo', { count: 1 }) : t('communityHub.time.minutesAgo', { count: diffMins });
    if (diffHours < 24) return diffHours === 1 ? t('communityHub.time.hourAgo', { count: 1 }) : t('communityHub.time.hoursAgo', { count: diffHours });
    if (diffDays < 7) return diffDays === 1 ? t('communityHub.time.dayAgo', { count: 1 }) : t('communityHub.time.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  // Show loading state
  if (communitiesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Show empty state if no communities
  if (communities.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-12">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('communityHub.emptyState.noCommunitiesTitle')}</h2>
          <p className="text-slate-500 mb-6">
            {role === 'creator'
              ? t('communityHub.emptyState.creatorPrompt')
              : t('communityHub.emptyState.studentPrompt')
            }
          </p>
          {role === 'creator' && (
            <button
              onClick={() => {
                if (!communityLimit.allowed) {
                  setShowUpgradePrompt(true);
                } else {
                  setShowCreateCommunity(true);
                }
              }}
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 inline-flex items-center gap-2"
            >
              <Plus size={20} />
              {t('communityHub.buttons.createCommunity')}
            </button>
          )}
        </div>

        {/* Create Community Modal */}
        {showCreateCommunity && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">{t('communityHub.modal.createCommunity.title')}</h3>
              <input
                type="text"
                value={newCommunityName}
                onChange={(e) => setNewCommunityName(e.target.value)}
                placeholder={t('communityHub.modal.createCommunity.namePlaceholder')}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleCloseCreateModal}
                  className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  {t('communityHub.buttons.cancel')}
                </button>
                <button
                  onClick={handleCreateCommunity}
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                >
                  {t('communityHub.buttons.create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 lg:p-6 h-full flex gap-6">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-4 left-4 z-40 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        aria-label="Open channels"
      >
        <Hash size={20} />
        {selectedChannel && <span className="text-sm font-medium max-w-[100px] truncate">{selectedChannel.name}</span>}
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Channels Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 shrink-0
        transform transition-transform duration-200 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="bg-white rounded-none lg:rounded-xl shadow-sm border-r lg:border border-slate-100 p-4 h-full lg:h-auto lg:sticky lg:top-6 overflow-y-auto">
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-1 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
          {/* Community Selector */}
          {communities.length > 1 && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <select
                value={selectedCommunity?.id || ''}
                onChange={(e) => {
                  const comm = communities.find(c => c.id === e.target.value);
                  setSelectedCommunity(comm || null);
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              >
                {communities.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedCommunity && (
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900 truncate">{selectedCommunity.name}</h2>
                {isOwner ? (
                  <button
                    onClick={() => {
                      setEditingCommunityName(selectedCommunity.name);
                      setShowPricingSettings(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title={t('communityHub.tooltip.communitySettings')}
                  >
                    <Settings size={16} />
                  </button>
                ) : isMember && (
                  <div className="relative" ref={communityMenuRef}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCommunityMenu(!showCommunityMenu);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {showCommunityMenu && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50">
                        <button
                          onClick={() => {
                            setShowCommunityMenu(false);
                            setShowLeaveCommunityModal(true);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <LogOut size={14} />
                          {t('communityHub.buttons.leaveCommunity')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User Points Display */}
          {isMember && userPoints && (
            <div className="mb-4 pb-4 border-b border-slate-100">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-semibold text-slate-700">{t('communityHub.points.yourLevel')}</span>
                  </div>
                  <span className="text-lg font-bold text-indigo-600">{userPoints.level}</span>
                </div>
                <div className="mb-1">
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>{userPoints.total_points} {t('communityHub.points.pointsSuffix')}</span>
                    <span>{getPointsForNextLevel(userPoints.level)} {t('communityHub.points.ptsSuffix')}</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${getLevelProgress(userPoints.total_points, userPoints.level)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Channel Folders */}
          {channelsByGroup && (
            <div className="space-y-1">
              {/* Global Section */}
              <GroupFolderSection
                channels={channelsByGroup.global}
                selectedChannelId={selectedChannel?.id || null}
                isOwner={isOwner}
                unreadChannelIds={unreadChannelIds}
                onSelectChannel={(ch) => {
                  setSelectedChannel(ch);
                  setIsMobileSidebarOpen(false);
                }}
                onEditChannel={(ch) => handleOpenChannelModal(ch)}
                onDeleteChannel={handleDeleteChannel}
                onAddChannel={() => handleOpenChannelModal()}
              />

              {/* Group Sections */}
              {channelsByGroup.groups.map(({ group, channels: groupChannels }) => (
                <GroupFolderSection
                  key={group.id}
                  group={group}
                  channels={groupChannels}
                  selectedChannelId={selectedChannel?.id || null}
                  isOwner={isOwner}
                  memberCount={groups.find((g) => g.id === group.id)?.member_count}
                  unreadChannelIds={unreadChannelIds}
                  onSelectChannel={(ch) => {
                    setSelectedChannel(ch);
                    setIsMobileSidebarOpen(false);
                  }}
                  onEditChannel={(ch) => handleOpenChannelModal(ch)}
                  onDeleteChannel={handleDeleteChannel}
                  onAddChannel={() => handleOpenChannelModal(undefined, group.id)}
                />
              ))}
            </div>
          )}

          {/* Team Section - Direct Messaging */}
          {isMember && teamMembers.length > 0 && (
            <TeamSection
              teamMembers={teamMembers}
              onSelectTeamMember={(member) => {
                handleSelectTeamMember(member);
                setIsMobileSidebarOpen(false);
              }}
              selectedTeamMemberId={selectedTeamMember?.id}
            />
          )}

          {/* Manage Groups button (owner only) */}
          {isOwner && (
            <button
              onClick={() => setShowGroupManager(true)}
              className="w-full mt-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-2"
            >
              <Users size={16} />
              {t('communityHub.buttons.manageGroups')}
            </button>
          )}

          {/* Leaderboard button */}
          {isMember && (
            <button
              onClick={() => setShowLeaderboard(true)}
              className="w-full mt-4 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg flex items-center gap-2 font-medium"
            >
              <Trophy size={16} />
              {t('communityHub.buttons.leaderboard')}
            </button>
          )}

          {/* Create Community button for creators */}
          {role === 'creator' && (
            <button
              onClick={() => {
                if (!communityLimit.allowed) {
                  setShowUpgradePrompt(true);
                } else {
                  setShowCreateCommunity(true);
                }
              }}
              className="w-full mt-2 px-3 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-2"
            >
              <Plus size={16} />
              {t('communityHub.buttons.newCommunity')}
            </button>
          )}
        </div>
      </div>

      {/* Feed / Chat Panel */}
      <div className="flex-1 space-y-6">
        {/* Chat Panel - shown when team member or creator chat target is selected */}
        {showChatPanel && (selectedTeamMember || creatorChatTargetId) && selectedCommunity && profile && (
          <ChatPanel
            communityId={selectedCommunity.id}
            currentUserProfileId={profile.id}
            selectedTeamMember={selectedTeamMember}
            creatorChatTargetId={creatorChatTargetId}
            viewMode={isOwner || (currentUserTeamMember && currentUserTeamMember.profile_id === profile.id) ? 'inbox' : 'chat'}
            isCreator={isOwner}
            isCurrentUserTeamMember={!!currentUserTeamMember}
            currentUserTeamMemberId={currentUserTeamMember?.id}
            onClose={handleCloseChatPanel}
          />
        )}

        {/* Regular Feed (hidden when chat panel is open) */}
        {!showChatPanel && (
          <>
        {/* Pending Survey Banner (for members with incomplete surveys) */}
        {isMember && selectedCommunity && profile && role !== 'creator' && (
          <PendingSurveyBanner
            studentId={profile.id}
            communityId={selectedCommunity.id}
          />
        )}

        {/* Join Banner (for non-members) */}
        {!isMember && selectedCommunity && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-indigo-900 font-medium">{t('communityHub.joinBanner.title')}</p>
              <p className="text-indigo-700 text-sm">{t('communityHub.joinBanner.subtitle')}</p>
            </div>
            <button
              onClick={handleJoinCommunity}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              {t('communityHub.buttons.joinCommunity')}
            </button>
          </div>
        )}

        {/* Create Post */}
        {isMember && selectedChannel && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
            <div className="flex gap-4">
              <img
                src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=6366f1&color=fff`}
                className="w-10 h-10 rounded-full object-cover"
                alt={t('communityHub.createPost.meAlt')}
              />
              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder={t('communityHub.createPost.placeholder')}
                  className="w-full bg-slate-50 border-none rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 resize-none h-24"
                />

                {/* Image Preview */}
                {pendingImagePreview && (
                  <div className="relative mt-3 inline-block">
                    <img
                      src={pendingImagePreview}
                      alt={t('communityHub.createPost.imagePreviewAlt')}
                      className="max-h-48 rounded-lg border border-slate-200"
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full hover:bg-slate-700 transition-colors"
                      title={t('communityHub.tooltip.removeImage')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center mt-3">
                  <div className="flex gap-2 relative">
                    {/* Hidden file input for image upload */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={handleImageClick}
                      className={`p-2 rounded-full transition-colors ${pendingImage ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      title={t('communityHub.tooltip.addImage')}
                    >
                      <ImageIcon size={20} />
                    </button>
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className={`p-2 rounded-full transition-colors ${showEmojiPicker ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      title={t('communityHub.tooltip.addEmoji')}
                    >
                      <Smile size={20} />
                    </button>

                    {/* Emoji Picker - Compact popover above the button */}
                    {showEmojiPicker && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowEmojiPicker(false)} />
                        <div
                          className="absolute z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-3"
                          style={{
                            bottom: 'calc(100% + 8px)',
                            left: '0',
                            width: '280px'
                          }}
                        >
                          <div className="grid grid-cols-8 gap-1">
                            {commonEmojis.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleEmojiClick(emoji)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-md transition-colors text-xl leading-none"
                              >
                                <span role="img" aria-label="emoji">{emoji}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  <button
                    onClick={handleCreatePost}
                    disabled={(!newPost.trim() && !pendingImage) || isPostingLoading}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPostingLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {isUploadingImage ? t('communityHub.loading.uploading') : t('communityHub.loading.posting')}
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        {t('communityHub.buttons.post')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Posts */}
        <div className="space-y-4">
          {posts.length === 0 && selectedChannel && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">{t('communityHub.emptyState.noPostsInChannel')}</p>
              {isMember && <p className="text-slate-400 text-sm mt-1">{t('communityHub.emptyState.beFirstToPost')}</p>}
            </div>
          )}

          {posts.map(post => (
            <div key={post.id} className={`bg-white rounded-xl shadow-sm border p-5 ${post.is_pinned ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
              <div className="flex justify-between items-start">
                <div className="flex gap-3">
                  <button
                    onClick={() => post.author?.id && handleOpenProfile(post.author.id)}
                    className="shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-full"
                  >
                    <img
                      src={post.author?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.full_name || 'User')}&background=6366f1&color=fff`}
                      className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer"
                      alt={post.author?.full_name || 'User'}
                    />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => post.author?.id && handleOpenProfile(post.author.id)}
                        className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                      >
                        {post.author?.full_name || 'Anonymous'}
                      </button>
                      {post.author?.role === 'creator' && (
                        <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{t('communityHub.badges.creator')}</span>
                      )}
                      {post.author?.role === 'superadmin' && (
                        <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{t('communityHub.badges.admin')}</span>
                      )}
                      {post.is_pinned && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                          <Pin size={10} /> {t('communityHub.badges.pinned')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{formatTimestamp(post.created_at)}</p>
                  </div>
                </div>

                {/* Post Menu */}
                <div className="relative">
                  <button
                    onClick={() => handleToggleMenu(post.id)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <MoreHorizontal size={20} />
                  </button>

                  {/* Dropdown Menu */}
                  {openMenuPostId === post.id && (
                    <>
                      {/* Backdrop to close menu */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={handleCloseMenu}
                      />
                      <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20 min-w-[160px]">
                        {/* Copy Link - Available to everyone */}
                        <button
                          onClick={() => handleCopyPostLink(post.id)}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Copy size={16} />
                          {t('communityHub.postMenu.copyLink')}
                        </button>

                        {/* Creator-only options */}
                        {isCreator && (
                          <>
                            <button
                              onClick={() => handlePinPost(post.id, post.is_pinned || false)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Pin size={16} />
                              {post.is_pinned ? t('communityHub.postMenu.unpinPost') : t('communityHub.postMenu.pinPost')}
                            </button>
                            <div className="border-t border-slate-100 my-1" />
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={16} />
                              {t('communityHub.postMenu.deletePost')}
                            </button>
                          </>
                        )}

                        {/* Report - Available to non-creators */}
                        {!isCreator && (
                          <button
                            onClick={() => handleReportPost(post.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            <Flag size={16} />
                            {t('communityHub.postMenu.report')}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Post Content */}
              {post.content && (
                <div className="mt-4 text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </div>
              )}

              {/* Post Image */}
              {post.image_url && (
                <div className="mt-4">
                  <img
                    src={post.image_url}
                    alt={t('communityHub.alt.postImage')}
                    className="max-w-full rounded-lg border border-slate-200 cursor-pointer hover:opacity-95 transition-opacity"
                    onClick={() => window.open(post.image_url!, '_blank')}
                  />
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-50 flex gap-6">
                <button
                  onClick={() => handleToggleLike(post.id, post.user_has_liked || false, post.author_id)}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    post.user_has_liked
                      ? 'text-rose-500'
                      : 'text-slate-500 hover:text-rose-500'
                  }`}
                >
                  <Heart size={18} fill={post.user_has_liked ? 'currentColor' : 'none'} />
                  {post.likes_count || 0}
                </button>
                <button
                  onClick={() => handleToggleComments(post.id)}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    expandedPostId === post.id
                      ? 'text-indigo-600'
                      : 'text-slate-500 hover:text-indigo-600'
                  }`}
                >
                  <MessageSquare size={18} /> {post.comments_count || 0}
                </button>
              </div>

              {/* Comments Section */}
              {expandedPostId === post.id && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  {/* Loading state */}
                  {loadingComments.has(post.id) && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                    </div>
                  )}

                  {/* Comments list */}
                  {!loadingComments.has(post.id) && postComments.get(post.id) && (
                    <div className="space-y-3 mb-4">
                      {postComments.get(post.id)?.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-2">{t('communityHub.emptyState.noCommentsYet')}</p>
                      ) : (
                        postComments.get(post.id)?.map(comment => (
                          <div key={comment.id} className="flex gap-3">
                            <button
                              onClick={() => comment.author?.id && handleOpenProfile(comment.author.id)}
                              className="shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-full"
                            >
                              <img
                                src={comment.author?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author?.full_name || 'User')}&background=6366f1&color=fff`}
                                className="w-8 h-8 rounded-full object-cover hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer"
                                alt={comment.author?.full_name || 'User'}
                              />
                            </button>
                            <div className="flex-1 bg-slate-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <button
                                  onClick={() => comment.author?.id && handleOpenProfile(comment.author.id)}
                                  className="text-sm font-medium text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                                >
                                  {comment.author?.full_name || 'Anonymous'}
                                </button>
                                <span className="text-xs text-slate-400">{formatTimestamp(comment.created_at)}</span>
                              </div>
                              <p className="text-sm text-slate-700">{comment.content}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Comment input */}
                  {isMember && (
                    <div className="flex gap-3">
                      <img
                        src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}&background=6366f1&color=fff`}
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                        alt={t('communityHub.createPost.meAlt')}
                      />
                      <div className="flex-1 flex gap-2">
                        <input
                          type="text"
                          value={newComment.get(post.id) || ''}
                          onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment(post.id)}
                          placeholder={t('communityHub.comments.placeholder')}
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => handleSubmitComment(post.id)}
                          disabled={!newComment.get(post.id)?.trim() || submittingComment}
                          className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingComment ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Send size={16} />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        </>
        )}
      </div>

      {/* Create Community Modal */}
      {showCreateCommunity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">{t('communityHub.modal.createCommunity.title')}</h3>
            <input
              type="text"
              value={newCommunityName}
              onChange={(e) => setNewCommunityName(e.target.value)}
              placeholder={t('communityHub.modal.createCommunity.namePlaceholder')}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCloseCreateModal}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                {t('communityHub.buttons.cancel')}
              </button>
              <button
                onClick={handleCreateCommunity}
                disabled={!newCommunityName.trim()}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {t('communityHub.buttons.create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Channel Create/Edit Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {editingChannel ? t('communityHub.modal.channel.editTitle') : t('communityHub.modal.channel.createTitle')}
              </h3>
              <button
                onClick={handleCloseChannelModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('communityHub.modal.channel.nameLabel')}
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder={t('communityHub.modal.channel.namePlaceholder')}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoFocus
                />
                <p className="text-xs text-slate-500 mt-1">
                  {t('communityHub.modal.channel.namePreview', { channelName: channelName.toLowerCase().replace(/ /g, '-') || 'channel-name' })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {t('communityHub.modal.channel.descriptionLabel')} <span className="text-slate-400 font-normal">{t('communityHub.modal.channel.descriptionOptional')}</span>
                </label>
                <textarea
                  value={channelDescription}
                  onChange={(e) => setChannelDescription(e.target.value)}
                  placeholder={t('communityHub.modal.channel.descriptionPlaceholder')}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none h-20"
                />
              </div>
              {/* Group Selector */}
              {isOwner && groups.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {t('communityHub.modal.channel.visibleToLabel')}
                  </label>
                  <select
                    value={channelGroupId || ''}
                    onChange={(e) => setChannelGroupId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">{t('communityHub.modal.channel.allMembersOption')}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.member_count} {t('communityHub.modal.channel.membersSuffix')})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    {t('communityHub.modal.channel.visibilityHint')}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCloseChannelModal}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                {t('communityHub.buttons.cancel')}
              </button>
              <button
                onClick={handleSaveChannel}
                disabled={!channelName.trim() || isSavingChannel}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSavingChannel ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('communityHub.loading.saving')}
                  </>
                ) : editingChannel ? t('communityHub.buttons.saveChanges') : t('communityHub.buttons.createChannel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Popup */}
      {selectedProfileId && (
        <UserProfilePopup
          profileId={selectedProfileId}
          isOpen={showProfilePopup}
          onClose={handleCloseProfile}
        />
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-2 rounded-lg">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{t('communityHub.modal.leaderboard.title')}</h3>
                    <p className="text-sm text-slate-500">{t('communityHub.modal.leaderboard.subtitle')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6">
              {leaderboard.length === 0 ? (
                <div className="text-center py-12">
                  <Trophy className="w-16 h-16 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">{t('communityHub.emptyState.noMembersWithPoints')}</p>
                  <p className="text-sm text-slate-400 mt-1">{t('communityHub.emptyState.beFirstToEarnPoints')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((member, index) => {
                    const isCurrentUser = user?.id === member.user_id;
                    const rankColors = [
                      'from-amber-400 to-amber-600', // 1st place
                      'from-slate-300 to-slate-500', // 2nd place
                      'from-orange-400 to-orange-600', // 3rd place
                    ];
                    const rankColor = index < 3 ? rankColors[index] : 'from-slate-200 to-slate-400';

                    return (
                      <div
                        key={member.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${
                          isCurrentUser
                            ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-200'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br ${rankColor} text-white font-bold text-sm shrink-0`}>
                          {index + 1}
                        </div>

                        <button
                          onClick={() => handleOpenProfile(member.user_id)}
                          className="shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 rounded-full"
                        >
                          <img
                            src={member.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user.full_name)}&background=6366f1&color=fff`}
                            className="w-10 h-10 rounded-full object-cover hover:ring-2 hover:ring-indigo-300 transition-all cursor-pointer"
                            alt={member.user.full_name}
                          />
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleOpenProfile(member.user_id)}
                              className="font-semibold text-slate-900 truncate hover:text-indigo-600 transition-colors cursor-pointer"
                            >
                              {member.user.full_name}
                              {isCurrentUser && <span className="text-indigo-600 ml-1">{t('communityHub.modal.leaderboard.you')}</span>}
                            </button>
                            {member.user.role === 'creator' && (
                              <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">{t('communityHub.badges.creator')}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{t('communityHub.modal.leaderboard.level')} {member.level}</span>
                            <span className="text-xs text-slate-300">•</span>
                            <span className="text-xs text-slate-500">{member.total_points} {t('communityHub.points.pointsSuffix')}</span>
                          </div>
                        </div>

                        {index < 3 && (
                          <Star className={`w-5 h-5 ${index === 0 ? 'text-amber-500' : index === 1 ? 'text-slate-400' : 'text-orange-500'}`} fill="currentColor" />
                        )}

                        {/* Give Points button for creators/team members */}
                        {canAwardPoints && !isCurrentUser && (
                          <button
                            onClick={() => handleOpenGivePoints(member.user_id, member.user.full_name)}
                            className="ml-2 p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title={t('communityHub.givePoints.buttonTitle')}
                          >
                            <Award className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Give Points Modal */}
      {showGivePointsModal && givePointsTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-2 rounded-lg">
                    <Award className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{t('communityHub.givePoints.title')}</h3>
                    <p className="text-sm text-slate-500">{givePointsTarget.name}</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseGivePoints}
                  disabled={isAwardingPoints}
                  className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Points amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('communityHub.givePoints.amountLabel')}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={givePointsAmount}
                    onChange={(e) => setGivePointsAmount(Number(e.target.value))}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="w-16 text-center">
                    <span className="text-2xl font-bold text-amber-600">{givePointsAmount}</span>
                  </div>
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>1</span>
                  <span>100</span>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  {t('communityHub.givePoints.reasonLabel')}
                  <span className="text-slate-400 font-normal ml-1">{t('communityHub.givePoints.optional')}</span>
                </label>
                <textarea
                  value={givePointsReason}
                  onChange={(e) => setGivePointsReason(e.target.value)}
                  placeholder={t('communityHub.givePoints.reasonPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 flex gap-3">
              <button
                onClick={handleCloseGivePoints}
                disabled={isAwardingPoints}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {t('communityHub.givePoints.cancelButton')}
              </button>
              <button
                onClick={handleAwardPoints}
                disabled={isAwardingPoints || givePointsAmount < 1}
                className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAwardingPoints ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('communityHub.givePoints.awarding')}
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    {t('communityHub.givePoints.awardButton', { points: givePointsAmount })}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Community Settings Modal */}
      {showPricingSettings && selectedCommunity && isOwner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{t('communityHub.modal.communitySettings.title')}</h3>
                  <p className="text-sm text-slate-500">{t('communityHub.modal.communitySettings.subtitle')}</p>
                </div>
                <button
                  onClick={() => {
                    setShowPricingSettings(false);
                    setSettingsTab('general');
                  }}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={20} />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex gap-4 mt-4 border-b border-slate-200 -mb-6 -mx-6 px-6">
                <button
                  onClick={() => setSettingsTab('general')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    settingsTab === 'general'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t('communityHub.modal.communitySettings.tabs.general')}
                </button>
                <button
                  onClick={() => setSettingsTab('team')}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    settingsTab === 'team'
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t('communityHub.modal.communitySettings.tabs.team')}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
              {settingsTab === 'general' ? (
                <div className="p-6 space-y-6">
                  {/* Community Name Section */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      {t('communityHub.modal.communitySettings.nameLabel')}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingCommunityName}
                        onChange={(e) => setEditingCommunityName(e.target.value)}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder={t('communityHub.modal.communitySettings.namePlaceholder')}
                      />
                      <button
                        onClick={async () => {
                          if (!editingCommunityName.trim() || editingCommunityName === selectedCommunity.name) return;
                          setIsSavingCommunityName(true);
                          const updated = await updateCommunity(selectedCommunity.id, { name: editingCommunityName.trim() });
                          if (updated) {
                            await refreshCommunities();
                          }
                          setIsSavingCommunityName(false);
                        }}
                        disabled={isSavingCommunityName || !editingCommunityName.trim() || editingCommunityName === selectedCommunity.name}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      >
                        {isSavingCommunityName ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          t('communityHub.buttons.save')
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-slate-200" />

                  {/* Pricing Settings */}
                  <CommunityPricingSettings
                    communityId={selectedCommunity.id}
                    onSaved={() => {
                      setShowPricingSettings(false);
                      setSettingsTab('general');
                      refreshCommunities();
                    }}
                    onDeleted={() => {
                      setShowPricingSettings(false);
                      setSettingsTab('general');
                      setSelectedCommunity(null);
                      refreshCommunities();
                    }}
                  />
                </div>
              ) : (
                <TeamSettingsTab />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group Manager Modal */}
      {showGroupManager && selectedCommunity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
            {selectedGroupForAssign ? (
              <GroupMemberAssigner
                communityId={selectedCommunity.id}
                groupId={selectedGroupForAssign}
                onBack={() => setSelectedGroupForAssign(null)}
              />
            ) : (
              <GroupManager
                communityId={selectedCommunity.id}
                onSelectGroup={setSelectedGroupForAssign}
                onClose={() => {
                  setShowGroupManager(false);
                  loadChannelsByGroup(); // Refresh after changes
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Delete Post Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-center text-slate-900 mb-2">
              {t('communityHub.modal.deletePost.title')}
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              {t('communityHub.modal.deletePost.message')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelDeletePost}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-slate-700 transition-colors disabled:opacity-50"
              >
                {t('communityHub.buttons.cancel')}
              </button>
              <button
                onClick={confirmDeletePost}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('communityHub.loading.deleting')}
                  </>
                ) : (
                  t('communityHub.buttons.delete')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Community Modal */}
      {showLeaveCommunityModal && selectedCommunity && user && (
        <LeaveCommunityModal
          isOpen={showLeaveCommunityModal}
          onClose={() => setShowLeaveCommunityModal(false)}
          communityId={selectedCommunity.id}
          communityName={selectedCommunity.name}
          userId={user.id}
          onLeaveSuccess={() => {
            // Refresh communities list and clear selection
            refreshCommunities();
            setSelectedCommunity(null);
            setIsMember(false);
          }}
        />
      )}

      {/* Upgrade prompt for community limit */}
      {showUpgradePrompt && (
        <UpgradePrompt
          reason="community_limit"
          currentUsage={{
            current: communityLimit.current,
            max: communityLimit.max,
          }}
          onClose={() => setShowUpgradePrompt(false)}
        />
      )}
    </div>
  );
};

export default CommunityHub;
