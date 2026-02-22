# EFI Course Features Design

**Date:** 2025-01-28
**Status:** Approved
**Author:** Claude + User

---

## Overview

New features for EFI course community enabling:
1. **Community AI Chatbots** - 2-3 role-based bots (Q&A, Motivation, Support) configurable by creator
2. **Homework System** - Standalone assignment/submission area with file + text uploads
3. **Creator Dashboard** - Submissions Queue + Student Manager with manual point control
4. **Student View** - Points per assignment, feedback, leaderboard ranking

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chatbot type | Role-based (Q&A, Motivation, Support) | Clear purposes, easier to configure |
| Creator control | Medium - custom prompts, personality, channel placement | Balance of power and simplicity |
| Homework structure | Standalone section (not per-lesson) | Decoupled from LMS, flexible |
| Submission types | Files + text field | Covers most use cases without complexity |
| Grading | Custom 0-10 points + feedback | Simple but flexible scoring |
| Student visibility | Detailed - points per assignment, feedback, leaderboard | Motivates engagement |
| Creator dashboard | Two views - Submissions Queue + Student Manager | Complete control |
| Chatbot UI | Dedicated page with tabs | Clean, discoverable, mobile-friendly |

---

## Database Schema

### New Tables

```sql
-- Creator-configurable chatbots per community
CREATE TABLE community_chatbots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('qa', 'motivation', 'support')),
  system_prompt TEXT,
  personality TEXT,
  greeting_message TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat history with community bots
CREATE TABLE chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID NOT NULL REFERENCES community_chatbots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatbot_id, user_id)
);

-- Homework assignments created by creator
CREATE TABLE homework_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT,
  max_points INTEGER DEFAULT 10,
  due_date TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student submissions
CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id),
  text_response TEXT,
  file_urls JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'graded')),
  points_awarded INTEGER CHECK (points_awarded >= 0 AND points_awarded <= 10),
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES users(id),
  UNIQUE(assignment_id, student_id)
);

-- Indexes for performance
CREATE INDEX idx_chatbots_community ON community_chatbots(community_id);
CREATE INDEX idx_conversations_chatbot ON chatbot_conversations(chatbot_id);
CREATE INDEX idx_conversations_user ON chatbot_conversations(user_id);
CREATE INDEX idx_assignments_community ON homework_assignments(community_id);
CREATE INDEX idx_submissions_assignment ON homework_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON homework_submissions(student_id);
CREATE INDEX idx_submissions_status ON homework_submissions(status);
```

### Existing Tables Used

- `memberships.points` - Community points (updated when homework graded)
- `users` - Student/creator profiles
- `communities` - Parent container

---

## UI Components

### Creator Side

#### A) Chatbot Management (Settings → AI Chatbots)
- List of configured bots with name, role, active status
- Add/Edit modal: name, role dropdown, system prompt, personality, greeting, active toggle
- Max 3 bots per community

#### B) Homework Management (Sidebar → Homework)
- Published assignments list with submission counts
- Draft assignments with publish button
- Create/Edit modal: title, description (rich text), max points, due date, publish toggle

#### C) Creator Dashboard (two-view toggle)
- **Submissions Queue**: Filter by assignment/status, grade with 0-10 slider + feedback
- **Student Manager**: Table with name, total points, submissions count, add bonus points

### Student Side

#### A) AI Chat Section (Sidebar → AI Chat)
- Tabs for each active bot
- Chat interface with message history
- Greeting message on first open

#### B) Homework Section (Sidebar → Homework)
- Pending assignments with due dates
- My submissions with status (Pending/Graded), points, feedback preview

#### C) Submission Modal
- Assignment instructions display
- Text response textarea
- File upload (multiple files: images, PDFs, videos)
- Submit button

#### D) Points Display
- Total points in sidebar/profile
- Per-assignment breakdown
- Leaderboard rank

---

## File Structure

```
src/features/
├── chatbots/
│   ├── ChatbotsPage.tsx
│   ├── ChatbotConversation.tsx
│   ├── ChatbotSettings.tsx
│   ├── ChatbotEditModal.tsx
│   └── chatbotService.ts
│
├── homework/
│   ├── HomeworkPage.tsx
│   ├── HomeworkSubmissionModal.tsx
│   ├── HomeworkManagement.tsx
│   ├── AssignmentEditModal.tsx
│   ├── SubmissionsQueue.tsx
│   ├── GradingModal.tsx
│   └── homeworkService.ts
│
├── student-manager/
│   ├── StudentManagerPage.tsx
│   ├── StudentTable.tsx
│   ├── StudentDetailModal.tsx
│   └── studentManagerService.ts
```

### Files to Modify

- `Sidebar.tsx` - Add nav items
- `CommunityHub.tsx` - Add routes
- `database.types.ts` - Add types
- `geminiService.ts` - Chatbot prompts

---

## Implementation Order

1. **Database** - Create Supabase migrations for all tables
2. **Homework System** - Core feature for EFI
3. **Student Manager** - Creator dashboard for grading/points
4. **Community Chatbots** - AI features last (builds on existing geminiService)

---

## Data Flow

```
Homework Flow:
Creator creates assignment → Publishes →
Students see in Homework section → Submit (files + text) →
Status: "pending" → Creator reviews in Submissions Queue →
Awards 0-10 points + feedback → Status: "graded" →
Points added to membership.points → Leaderboard updates

Chatbot Flow:
Creator configures bot (name, prompt, personality) →
Student opens AI Chat → Selects bot tab →
Sends message → geminiService processes with bot's system prompt →
Response displayed → Conversation saved to chatbot_conversations
```
