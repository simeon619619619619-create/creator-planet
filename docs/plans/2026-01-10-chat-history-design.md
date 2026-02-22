# Chat History Feature Design

**Date:** 2026-01-10
**Status:** Approved

## Overview

Add chat history sidebar to AI Chat, allowing students to view and continue past conversations with chatbots.

## Requirements

- Manual "New Chat" button to start fresh conversations
- First message preview as conversation title (truncated)
- Collapsible left sidebar showing history
- Can continue chatting in past conversations

## Database Schema

### New table: `chat_sessions`
```sql
create table chat_sessions (
  id uuid primary key default gen_random_uuid(),
  chatbot_id uuid not null references community_chatbots(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  title text,  -- First message preview (truncated to ~50 chars)
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_chat_sessions_user_chatbot on chat_sessions(user_id, chatbot_id);
```

### New table: `chat_messages`
```sql
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'model')),
  content text not null,
  created_at timestamptz default now()
);

create index idx_chat_messages_session on chat_messages(session_id);
```

### Migration of existing data
- Each existing `chatbot_conversations` record becomes one `chat_session`
- Messages array expanded into individual `chat_messages` rows
- Old table dropped after migration

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Header: AI Chat                                            │
├─────────────────────────────────────────────────────────────┤
│  Tabs: [💪 сим] [🤖 Q&A Bot] [🛠️ Support]                   │
├────────────────┬────────────────────────────────────────────┤
│ ☰ History      │                                            │
│                │                                            │
│ + New Chat     │         Chat Conversation Area             │
│                │                                            │
│ ┌────────────┐ │                                            │
│ │ How do I...│ │                                            │
│ │ Jan 10     │ │                                            │
│ └────────────┘ │                                            │
│ ┌────────────┐ │                                            │
│ │ What is th.│ │                                            │
│ │ Jan 8      │ │                                            │
│ └────────────┘ │                                            │
│                │                                            │
├────────────────┴────────────────────────────────────────────┤
│  [Message input...]                              [Send]     │
└─────────────────────────────────────────────────────────────┘
```

## Components

### New Components
- `ChatHistorySidebar.tsx` - Collapsible sidebar with session list and "New Chat" button
- `ChatSessionItem.tsx` - Individual session item (title preview + date)

### Modified Components
- `ChatbotsPage.tsx` - Add sidebar state, toggle button, session selection
- `ChatbotConversation.tsx` - Accept sessionId prop, load/save messages by session
- `chatbotService.ts` - Add session CRUD functions

## Service Functions

```typescript
// Session management
getUserSessions(chatbotId: string, userId: string): Promise<ChatSession[]>
createSession(chatbotId: string, userId: string): Promise<ChatSession>
updateSessionTitle(sessionId: string, title: string): Promise<void>
deleteSession(sessionId: string): Promise<boolean>

// Message management
getSessionMessages(sessionId: string): Promise<ChatMessage[]>
addMessage(sessionId: string, role: 'user' | 'model', content: string): Promise<ChatMessage>
```

## Data Flow

### New Chat
1. User clicks "New Chat" → `createSession()`
2. First message sent → `addMessage()` + `updateSessionTitle(truncate(message, 50))`
3. Bot responds → `addMessage()`

### Load Past Chat
1. Click session in sidebar → `getSessionMessages(sessionId)`
2. Display messages, user can continue
3. New messages append to same session

## Implementation Order

1. Database migration (schema + data migration)
2. Service functions in chatbotService.ts
3. ChatHistorySidebar component
4. Integration with ChatbotsPage and ChatbotConversation
5. Testing

## Files Changed

**Create:**
- `src/features/chatbots/ChatHistorySidebar.tsx`
- `supabase/migrations/XXX_chat_sessions.sql`

**Modify:**
- `src/features/chatbots/chatbotService.ts`
- `src/features/chatbots/ChatbotsPage.tsx`
- `src/features/chatbots/ChatbotConversation.tsx`
- `src/core/supabase/database.types.ts`
