import { supabase } from '../../core/supabase/client';
import { AIConversation, AIMessageRecord, AIContextType } from '../../core/types';

/**
 * Get the most recent conversation for a user and context
 */
export async function getRecentConversation(
  userId: string,
  contextType: AIContextType,
  contextId?: string
): Promise<AIConversation | null> {
  let query = supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('context_type', contextType)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (contextId) {
    query = query.eq('context_id', contextId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error('Error fetching conversation:', error);
    return null;
  }

  return data;
}

/**
 * Save or update a conversation
 */
export async function saveConversation(
  userId: string,
  contextType: AIContextType,
  messages: AIMessageRecord[],
  contextId?: string,
  conversationId?: string,
  tokensUsed: number = 0
): Promise<AIConversation | null> {
  // Generate title from first user message (max 50 chars)
  const firstUserMessage = messages.find(m => m.role === 'user');
  const title = firstUserMessage
    ? firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    : 'AI Conversation';

  const conversationData = {
    user_id: userId,
    context_type: contextType,
    context_id: contextId || null,
    title: title,
    messages: messages,
    tokens_used: tokensUsed,
  };

  let result;

  if (conversationId) {
    // Update existing conversation
    const { data, error } = await supabase
      .from('ai_conversations')
      .update({
        ...conversationData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating conversation:', error);
      return null;
    }
    result = data;
  } else {
    // Create new conversation
    const { data, error } = await supabase
      .from('ai_conversations')
      .insert(conversationData)
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }
    result = data;
  }

  return result;
}

/**
 * Get all conversations for a user
 */
export async function getConversationHistory(
  userId: string,
  contextType?: AIContextType,
  limit: number = 10
): Promise<AIConversation[]> {
  let query = supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (contextType) {
    query = query.eq('context_type', contextType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching conversation history:', error);
    return [];
  }

  return data || [];
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting conversation:', error);
    return false;
  }

  return true;
}
