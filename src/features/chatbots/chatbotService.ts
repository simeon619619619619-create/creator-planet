import { supabase } from '../../core/supabase/client';
import { DbCommunityChatbot, DbChatbotConversation } from '../../core/supabase/database.types';

// ============================================================================
// ROLE DEFAULTS - Default settings for each chatbot role
// ============================================================================

export type ChatbotRole = 'qa' | 'motivation' | 'support';

interface RoleDefaults {
  personality: string;
  systemPrompt: string;
  greeting: string;
}

const ROLE_DEFAULTS: Record<ChatbotRole, RoleDefaults> = {
  qa: {
    personality: 'Helpful and knowledgeable',
    systemPrompt:
      'You are a helpful Q&A assistant for this course. Answer questions clearly and provide examples when helpful.',
    greeting: "Hi! I'm here to answer your questions about the course. What would you like to know?",
  },
  motivation: {
    personality: 'Encouraging and supportive',
    systemPrompt:
      'You are a motivational coach. Encourage students, celebrate their wins, and help them stay focused on their goals.',
    greeting: "Hey! I'm your motivation coach. Ready to crush your goals today?",
  },
  support: {
    personality: 'Patient and solution-oriented',
    systemPrompt:
      'You are a technical support assistant. Help students with technical issues, platform questions, and troubleshooting.',
    greeting: "Hello! Need help with something technical? I'm here to assist.",
  },
};

/**
 * Gets the default settings for a chatbot role
 * @param role - The chatbot role
 * @returns The default personality, system prompt, and greeting for the role
 */
export function getRoleDefaults(role: ChatbotRole): RoleDefaults {
  return ROLE_DEFAULTS[role];
}

// ============================================================================
// CHATBOT CRUD Operations
// ============================================================================

/**
 * Gets all chatbots for a community
 * @param communityId - The community's ID
 * @returns Array of chatbots
 */
export async function getChatbots(communityId: string): Promise<DbCommunityChatbot[]> {
  const { data, error } = await supabase
    .from('community_chatbots')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching chatbots:', error);
    return [];
  }

  return data || [];
}

/**
 * Gets only active chatbots for a community
 * @param communityId - The community's ID
 * @returns Array of active chatbots
 */
export async function getActiveChatbots(communityId: string): Promise<DbCommunityChatbot[]> {
  const { data, error } = await supabase
    .from('community_chatbots')
    .select('*')
    .eq('community_id', communityId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching active chatbots:', error);
    return [];
  }

  return data || [];
}

/**
 * Creates a new chatbot for a community
 * @param communityId - The community's ID
 * @param name - The chatbot's display name
 * @param role - The chatbot role (qa, motivation, support)
 * @param customPrompt - Optional custom system prompt (overrides role default)
 * @param customPersonality - Optional custom personality (overrides role default)
 * @param customGreeting - Optional custom greeting (overrides role default)
 * @returns The created chatbot or null if failed
 */
export async function createChatbot(
  communityId: string,
  name: string,
  role: ChatbotRole,
  customPrompt?: string,
  customPersonality?: string,
  customGreeting?: string
): Promise<DbCommunityChatbot | null> {
  const defaults = getRoleDefaults(role);

  const { data, error } = await supabase
    .from('community_chatbots')
    .insert({
      community_id: communityId,
      name,
      role,
      system_prompt: customPrompt || defaults.systemPrompt,
      personality: customPersonality || defaults.personality,
      greeting_message: customGreeting || defaults.greeting,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating chatbot:', error);
    return null;
  }

  return data;
}

/**
 * Updates an existing chatbot
 * @param chatbotId - The chatbot's ID
 * @param updates - Partial chatbot updates
 * @returns The updated chatbot or null if failed
 */
export async function updateChatbot(
  chatbotId: string,
  updates: Partial<
    Pick<DbCommunityChatbot, 'name' | 'role' | 'system_prompt' | 'personality' | 'greeting_message' | 'avatar_url' | 'show_avatar' | 'is_active'>
  >
): Promise<DbCommunityChatbot | null> {
  const { data, error } = await supabase
    .from('community_chatbots')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chatbotId)
    .select()
    .single();

  if (error) {
    console.error('Error updating chatbot:', error);
    return null;
  }

  return data;
}

/**
 * Deletes a chatbot (and all related conversations via cascade)
 * @param chatbotId - The chatbot's ID
 * @returns True if deleted successfully, false otherwise
 */
export async function deleteChatbot(chatbotId: string): Promise<boolean> {
  const { error } = await supabase.from('community_chatbots').delete().eq('id', chatbotId);

  if (error) {
    console.error('Error deleting chatbot:', error);
    return false;
  }

  return true;
}

// ============================================================================
// CONVERSATION Management
// ============================================================================

export type ConversationMessage = {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
};

/**
 * Gets an existing conversation between a user and a chatbot
 * @param chatbotId - The chatbot's ID
 * @param userId - The user's profile ID
 * @returns The conversation or null if not found
 */
export async function getConversation(
  chatbotId: string,
  userId: string
): Promise<DbChatbotConversation | null> {
  const { data, error } = await supabase
    .from('chatbot_conversations')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Error fetching conversation:', error);
  }

  return data || null;
}

/**
 * Saves (upserts) a conversation between a user and a chatbot
 * @param chatbotId - The chatbot's ID
 * @param userId - The user's profile ID
 * @param messages - The array of conversation messages
 * @returns The saved conversation or null if failed
 */
export async function saveConversation(
  chatbotId: string,
  userId: string,
  messages: ConversationMessage[]
): Promise<DbChatbotConversation | null> {
  // Check if conversation exists
  const existing = await getConversation(chatbotId, userId);

  if (existing) {
    // Update existing conversation
    const { data, error } = await supabase
      .from('chatbot_conversations')
      .update({
        messages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating conversation:', error);
      return null;
    }

    return data;
  } else {
    // Create new conversation
    const { data, error } = await supabase
      .from('chatbot_conversations')
      .insert({
        chatbot_id: chatbotId,
        user_id: userId,
        messages,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    return data;
  }
}

// ============================================================================
// SESSION & MESSAGE Management
// ============================================================================

export interface ChatSession {
  id: string;
  chatbot_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'model';
  content: string;
  created_at: string;
}

/**
 * Gets all sessions for a user and chatbot
 * @param chatbotId - The chatbot's ID
 * @param userId - The user's profile ID
 * @returns Array of chat sessions, ordered by updated_at DESC
 */
export async function getUserSessions(chatbotId: string, userId: string): Promise<ChatSession[]> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*')
    .eq('chatbot_id', chatbotId)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching user sessions:', error);
    return [];
  }

  return data || [];
}

/**
 * Creates a new chat session
 * @param chatbotId - The chatbot's ID
 * @param userId - The user's profile ID
 * @returns The created session or null if failed
 */
export async function createSession(chatbotId: string, userId: string): Promise<ChatSession | null> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .insert({
      chatbot_id: chatbotId,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating session:', error);
    return null;
  }

  return data;
}

/**
 * Updates a session's title
 * @param sessionId - The session's ID
 * @param title - The new title
 */
export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from('chat_sessions')
    .update({
      title,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error updating session title:', error);
  }
}

/**
 * Deletes a session (messages cascade delete)
 * @param sessionId - The session's ID
 * @returns True if deleted successfully, false otherwise
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const { error } = await supabase.from('chat_sessions').delete().eq('id', sessionId);

  if (error) {
    console.error('Error deleting session:', error);
    return false;
  }

  return true;
}

/**
 * Gets all messages for a session
 * @param sessionId - The session's ID
 * @returns Array of messages, ordered by created_at ASC
 */
export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching session messages:', error);
    return [];
  }

  return data || [];
}

/**
 * Adds a message to a session
 * @param sessionId - The session's ID
 * @param role - The message role ('user' or 'model')
 * @param content - The message content
 * @returns The created message or null if failed
 */
export async function addMessage(
  sessionId: string,
  role: 'user' | 'model',
  content: string
): Promise<ChatMessage | null> {
  // Insert the message
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      role,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding message:', error);
    return null;
  }

  // Update the session's updated_at timestamp
  const { error: updateError } = await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', sessionId);

  if (updateError) {
    console.error('Error updating session timestamp:', updateError);
  }

  return data;
}

// ============================================================================
// CHATBOT AVATAR Upload
// ============================================================================

/**
 * Upload chatbot avatar image to Supabase Storage
 * @param chatbotId - The chatbot's ID (used as folder name)
 * @param file - The image file to upload
 * @returns The public URL of the uploaded avatar
 */
export async function uploadChatbotAvatar(chatbotId: string, file: File): Promise<string> {
  try {
    // Generate unique filename with timestamp
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `chatbots/${chatbotId}/avatar-${Date.now()}.${fileExt}`;

    // Delete any existing avatar for this chatbot
    const { data: existingFiles } = await supabase.storage
      .from('avatars')
      .list(`chatbots/${chatbotId}`);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map((f) => `chatbots/${chatbotId}/${f.name}`);
      await supabase.storage.from('avatars').remove(filesToDelete);
    }

    // Upload new avatar
    const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (error) {
      console.error('Error uploading chatbot avatar:', error);
      throw error;
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error in uploadChatbotAvatar:', error);
    throw error;
  }
}
