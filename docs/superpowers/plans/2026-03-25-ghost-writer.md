# AI Ghost Writer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an AI agent that writes posts and DMs invisibly from the creator's account, with persona onboarding, scheduled posts, auto-reply, proactive outreach, and student data collection.

**Architecture:** New `ghost-writer` feature module following existing patterns. Ghost Writer config stored per-community. Gemini generates content using a persona prompt built from creator Q&A. Edge functions handle scheduled posts and auto-replies. UI lives as a new tab in the existing AI Manager page.

**Tech Stack:** React + TypeScript (frontend), Supabase (DB + Edge Functions + RLS), Gemini API (AI), Supabase cron via pg_cron (scheduling)

**Spec:** `docs/superpowers/specs/2026-03-25-ghost-writer-design.md`

---

## File Structure

### New Files
```
src/features/ghost-writer/
  ghostWriterService.ts          — CRUD for config, schedules, drafts, data points
  ghostWriterTypes.ts            — TypeScript types for all ghost writer tables
  ghostWriterAI.ts               — Gemini functions: generatePost, generateReply, extractData
  ghostWriterOnboarding.ts       — Onboarding questions and persona prompt builder
  components/
    GhostWriterTab.tsx           — Main tab in AI Manager (chat + status panel)
    GhostWriterStatusPanel.tsx   — Toggles, stats, next scheduled post
    GhostWriterDraftsList.tsx    — Pending drafts for approval
    StudentDossierTab.tsx        — Data points timeline per student

supabase/functions/
  ghost-writer-post/index.ts     — Cron: generate and publish/draft posts
  ghost-writer-reply/index.ts    — Webhook: auto-reply to student DMs
  ghost-writer-proactive/index.ts — Cron: proactive DM triggers
```

### Modified Files
```
src/features/ai-manager/AiSuccessManager.tsx    — Add 'ai-author' tab
src/features/student-manager/StudentManagerPage.tsx — Add 'dossier' tab
src/core/supabase/database.types.ts             — Add ghost writer types
src/features/community/communityService.ts      — Add updateCommunity for button_color (already done)
supabase/migrations/                            — New migration file
```

---

## Task 1: Database Schema & Types

**Files:**
- Create: `supabase/migrations/20260325_ghost_writer.sql`
- Modify: `src/core/supabase/database.types.ts`
- Create: `src/features/ghost-writer/ghostWriterTypes.ts`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Ghost Writer Config (one per community)
CREATE TABLE IF NOT EXISTS public.ghost_writer_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  persona_prompt TEXT DEFAULT '',
  persona_answers JSONB DEFAULT '[]'::jsonb,
  data_collection_fields JSONB DEFAULT '[]'::jsonb,
  auto_reply_enabled BOOLEAN DEFAULT false,
  approval_mode TEXT DEFAULT 'preview' CHECK (approval_mode IN ('preview', 'auto')),
  post_schedule_description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id)
);

-- Ghost Writer Schedules
CREATE TABLE IF NOT EXISTS public.ghost_writer_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES public.ghost_writer_config(id) ON DELETE CASCADE,
  schedule_cron TEXT NOT NULL DEFAULT '0 9 * * *',
  channel_id UUID NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  post_type TEXT DEFAULT 'motivation' CHECK (post_type IN ('motivation', 'tip', 'question', 'recap', 'custom')),
  topic_hints TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ghost Writer Drafts
CREATE TABLE IF NOT EXISTS public.ghost_writer_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.ghost_writer_schedules(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  channel_id UUID NOT NULL REFERENCES public.community_channels(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- Student Data Points
CREATE TABLE IF NOT EXISTS public.student_data_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  value TEXT NOT NULL,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  source_conversation_id UUID REFERENCES public.direct_conversations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ghost Writer DM Log
CREATE TABLE IF NOT EXISTS public.ghost_writer_dm_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto_reply', 'proactive_new_student', 'proactive_inactive', 'proactive_at_risk', 'proactive_scheduled')),
  message_content TEXT NOT NULL,
  data_extracted JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gw_config_community ON public.ghost_writer_config(community_id);
CREATE INDEX IF NOT EXISTS idx_gw_schedules_community ON public.ghost_writer_schedules(community_id);
CREATE INDEX IF NOT EXISTS idx_gw_drafts_community_status ON public.ghost_writer_drafts(community_id, status);
CREATE INDEX IF NOT EXISTS idx_student_data_student ON public.student_data_points(student_id, community_id);
CREATE INDEX IF NOT EXISTS idx_student_data_field ON public.student_data_points(community_id, field_name);
CREATE INDEX IF NOT EXISTS idx_gw_dm_log_community ON public.ghost_writer_dm_log(community_id);

-- RLS Policies
ALTER TABLE public.ghost_writer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_writer_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_writer_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_data_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_writer_dm_log ENABLE ROW LEVEL SECURITY;

-- Config: creator only
CREATE POLICY "gw_config_creator_all" ON public.ghost_writer_config
  FOR ALL TO authenticated
  USING (creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Schedules: creator only (via config)
CREATE POLICY "gw_schedules_creator_all" ON public.ghost_writer_schedules
  FOR ALL TO authenticated
  USING (config_id IN (SELECT id FROM public.ghost_writer_config WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())))
  WITH CHECK (config_id IN (SELECT id FROM public.ghost_writer_config WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

-- Drafts: creator only
CREATE POLICY "gw_drafts_creator_all" ON public.ghost_writer_drafts
  FOR ALL TO authenticated
  USING (community_id IN (SELECT community_id FROM public.ghost_writer_config WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())))
  WITH CHECK (community_id IN (SELECT community_id FROM public.ghost_writer_config WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

-- Student data: creator reads all, student reads own
CREATE POLICY "student_data_creator_read" ON public.student_data_points
  FOR SELECT TO authenticated
  USING (
    community_id IN (SELECT id FROM public.communities WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
    OR student_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "student_data_service_insert" ON public.student_data_points
  FOR INSERT TO authenticated
  WITH CHECK (
    community_id IN (SELECT id FROM public.communities WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  );

-- DM Log: creator only
CREATE POLICY "gw_dm_log_creator_read" ON public.ghost_writer_dm_log
  FOR SELECT TO authenticated
  USING (community_id IN (SELECT id FROM public.communities WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "gw_dm_log_service_insert" ON public.ghost_writer_dm_log
  FOR INSERT TO authenticated
  WITH CHECK (community_id IN (SELECT id FROM public.communities WHERE creator_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid())));
```

- [ ] **Step 2: Run migration on remote DB**

```bash
npx supabase db query --linked < supabase/migrations/20260325_ghost_writer.sql
```

- [ ] **Step 3: Create TypeScript types**

Create `src/features/ghost-writer/ghostWriterTypes.ts` with interfaces matching all 5 tables.

- [ ] **Step 4: Add types to database.types.ts**

Add `GhostWriterConfig`, `GhostWriterSchedule`, `GhostWriterDraft`, `StudentDataPoint`, `GhostWriterDmLog` imports/references.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/ src/features/ghost-writer/ src/core/supabase/database.types.ts
git commit -m "feat(ghost-writer): add database schema, migration, and types"
```

---

## Task 2: Ghost Writer Service (CRUD)

**Files:**
- Create: `src/features/ghost-writer/ghostWriterService.ts`

- [ ] **Step 1: Implement config CRUD**

Functions:
- `getGhostWriterConfig(communityId)` — fetch config for community
- `createGhostWriterConfig(communityId, creatorId)` — create initial config
- `updateGhostWriterConfig(configId, updates)` — update persona, toggles, fields
- `toggleGhostWriter(configId, isActive)` — master on/off

- [ ] **Step 2: Implement schedule CRUD**

Functions:
- `getSchedules(communityId)` — list all schedules
- `createSchedule(communityId, configId, channelId, cron, postType, topicHints)` — add schedule
- `updateSchedule(scheduleId, updates)` — modify schedule
- `deleteSchedule(scheduleId)` — remove schedule

- [ ] **Step 3: Implement drafts management**

Functions:
- `getPendingDrafts(communityId)` — list drafts with status 'pending'
- `approveDraft(draftId)` — set status to 'approved', call createPost, set published_at
- `rejectDraft(draftId)` — set status to 'rejected'
- `createDraft(communityId, channelId, content, scheduleId?)` — create pending draft

- [ ] **Step 4: Implement student data points**

Functions:
- `getStudentDataPoints(studentId, communityId, fieldName?, limit?)` — fetch data timeline
- `saveDataPoints(studentId, communityId, points: {field, value}[], conversationId?)` — batch insert
- `getDataCollectionSummary(communityId)` — aggregate stats per field

- [ ] **Step 5: Implement DM log**

Functions:
- `logGhostDM(communityId, studentId, conversationId, triggerType, content, dataExtracted?)` — insert log entry
- `getGhostDMLog(communityId, limit?)` — recent DM activity

- [ ] **Step 6: Commit**

```bash
git add src/features/ghost-writer/ghostWriterService.ts
git commit -m "feat(ghost-writer): add service layer with CRUD for all tables"
```

---

## Task 3: Onboarding Questions & Persona Builder

**Files:**
- Create: `src/features/ghost-writer/ghostWriterOnboarding.ts`

- [ ] **Step 1: Define onboarding questions array**

Array of 15 questions with `id`, `question` (Bulgarian), `type` (text | choice | multi-choice), `options` (if choice), `category` (style | content | schedule | data).

Example questions:
1. Как се обръщаш към учениците си? (ти/вие/по име)
2. Опиши стила си на писане с 3 думи
3. Какъв тон предпочиташ? (мотивиращ/приятелски/строг/образователен)
4. Има ли фрази/изрази, които често използваш?
5. Какви теми обикновено обсъждаш с учениците?
6. Има ли теми, които НЕ трябва да се засягат?
7. Как обикновено поздравяваш?
8. Как завършваш съобщенията си?
9. Колко дълги да са постовете? (кратко 2-3 изр. / средно / дълго)
10. Какви данни искаш да събираш от учениците? (хранене, тренировки, сън, тегло, настроение...)
11. Колко често искаш да постваш? (всеки ден / 3 пъти седмично / веднъж седмично)
12. В колко часа да се публикуват постовете?
13. Искаш ли да преглеждаш постовете преди публикуване или да се публикуват автоматично?
14. Искаш ли ботът да отговаря автоматично на лични съобщения от студенти?
15. Как реагираш когато ученик споделя проблем? (съчувствие/практичен съвет/мотивация)

- [ ] **Step 2: Build persona prompt generator**

Function `buildPersonaPrompt(answers: Record<string, string>)` that takes the Q&A answers and generates a detailed system prompt. The prompt must include:
- Never reveal you are an AI, even if directly asked
- Use the creator's name, style, phrases
- Stay on approved topics, avoid forbidden ones
- Match tone and message length preferences
- Data collection instructions for specified fields

- [ ] **Step 3: Build schedule parser**

Function `parseScheduleFromAnswers(answers)` that converts natural language ("всеки ден в 9:00") to cron expressions.

- [ ] **Step 4: Commit**

```bash
git add src/features/ghost-writer/ghostWriterOnboarding.ts
git commit -m "feat(ghost-writer): add onboarding questions and persona prompt builder"
```

---

## Task 4: AI Generation Functions

**Files:**
- Create: `src/features/ghost-writer/ghostWriterAI.ts`

- [ ] **Step 1: Implement generateGhostPost**

Takes `config` (persona_prompt, community context, recent posts, schedule topic) → calls Gemini via existing ai-chat edge function pattern → returns generated post text.

- [ ] **Step 2: Implement generateGhostReply**

Takes `config` (persona_prompt) + `studentContext` (profile, data points, health) + `messageHistory` (last 20 DMs) → generates reply as creator → returns text.

- [ ] **Step 3: Implement generateProactiveMessage**

Takes `config` + `studentContext` + `triggerType` (new_student, inactive, at_risk) → generates personalized outreach message → returns text.

- [ ] **Step 4: Implement extractDataPoints**

Takes `config` (data_collection_fields) + `studentMessage` (text) → uses Gemini to extract structured data → returns `{field, value}[]` or empty array.

- [ ] **Step 5: Commit**

```bash
git add src/features/ghost-writer/ghostWriterAI.ts
git commit -m "feat(ghost-writer): add Gemini AI generation functions"
```

---

## Task 5: Edge Functions

**Files:**
- Create: `supabase/functions/ghost-writer-post/index.ts`
- Create: `supabase/functions/ghost-writer-reply/index.ts`
- Create: `supabase/functions/ghost-writer-proactive/index.ts`

- [ ] **Step 1: Create ghost-writer-post edge function**

Triggered by cron. For each active community with schedules due:
1. Load ghost_writer_config + schedule
2. Load context (recent 5 posts, community stats)
3. Call Gemini to generate post
4. If approval_mode = 'preview': save as draft
5. If approval_mode = 'auto': call createPost with creator_id, save draft as published

- [ ] **Step 2: Create ghost-writer-reply edge function**

Triggered when student DM arrives (via database webhook on direct_messages insert):
1. Check if ghost_writer_config.auto_reply_enabled for that community
2. Load persona_prompt + student context + conversation history
3. Generate reply via Gemini
4. Insert into direct_messages with sender = creator_profile_id
5. Extract data points from student's message, save to student_data_points
6. Log in ghost_writer_dm_log

- [ ] **Step 3: Create ghost-writer-proactive edge function**

Triggered hourly by cron:
1. For each active community, check triggers:
   - New students (joined in last 24h, no DM from creator yet)
   - Inactive students (no activity for 3+ days)
   - At-risk students (risk_score > 60 from student_health)
2. Generate personalized message for each
3. Send DM from creator_profile_id
4. Log in ghost_writer_dm_log

- [ ] **Step 4: Deploy edge functions**

```bash
npx supabase functions deploy ghost-writer-post --no-verify-jwt
npx supabase functions deploy ghost-writer-reply --no-verify-jwt
npx supabase functions deploy ghost-writer-proactive --no-verify-jwt
```

- [ ] **Step 5: Set up database webhook for auto-reply**

Create a Supabase database webhook that triggers ghost-writer-reply when a new row is inserted into direct_messages where the sender is not the creator.

- [ ] **Step 6: Set up cron jobs**

Using pg_cron or Supabase cron dashboard:
- ghost-writer-post: check every 15 minutes for due schedules
- ghost-writer-proactive: run every hour

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/ghost-writer-post/ supabase/functions/ghost-writer-reply/ supabase/functions/ghost-writer-proactive/
git commit -m "feat(ghost-writer): add edge functions for posts, replies, and proactive DMs"
```

---

## Task 6: UI — Ghost Writer Tab in AI Manager

**Files:**
- Create: `src/features/ghost-writer/components/GhostWriterTab.tsx`
- Create: `src/features/ghost-writer/components/GhostWriterStatusPanel.tsx`
- Create: `src/features/ghost-writer/components/GhostWriterDraftsList.tsx`
- Modify: `src/features/ai-manager/AiSuccessManager.tsx`

- [ ] **Step 1: Create GhostWriterStatusPanel**

Compact panel showing:
- Master toggle (is_active)
- Auto-reply toggle
- Approval mode selector (preview/auto)
- Next scheduled post time
- Stats: posts this month, DM replies this month

- [ ] **Step 2: Create GhostWriterDraftsList**

List of pending drafts with:
- Preview of content (truncated)
- Target channel name
- Created timestamp
- Approve / Edit / Reject buttons
- Approve calls ghostWriterService.approveDraft → createPost

- [ ] **Step 3: Create GhostWriterTab**

Main component combining:
- Status panel at top
- Chat interface (reuse AI Manager chat pattern) for:
  - Onboarding Q&A flow (if no config exists)
  - Settings modification ("Промени тона ми")
  - Draft review ("Одобри поста" / "Промени го")
  - On-demand post requests ("Напиши пост за X")
- Drafts list below chat
- Uses `conversationService` with `context_type = 'ghost_writer'`

- [ ] **Step 4: Add tab to AiSuccessManager.tsx**

Modify line 24: `useState<'chat' | 'report' | 'ai-author'>('chat')`

Add tab button following existing pattern (lines 394-407). Add conditional render for `activeTab === 'ai-author'` → `<GhostWriterTab />`.

Only visible to creators (role === 'creator' || role === 'superadmin').

- [ ] **Step 5: Add i18n keys**

Add Bulgarian and English translations for all ghost writer UI strings in `src/i18n/bg.json` and `src/i18n/en.json`.

- [ ] **Step 6: Commit**

```bash
git add src/features/ghost-writer/components/ src/features/ai-manager/AiSuccessManager.tsx src/i18n/
git commit -m "feat(ghost-writer): add AI Author tab in AI Manager with chat, status panel, and drafts"
```

---

## Task 7: UI — Student Dossier Tab

**Files:**
- Create: `src/features/ghost-writer/components/StudentDossierTab.tsx`
- Modify: `src/features/student-manager/StudentManagerPage.tsx`

- [ ] **Step 1: Create StudentDossierTab**

Component that receives `studentId` and `communityId` props:
- Fetches student_data_points for this student
- Groups by field_name
- Displays as timeline with date, value, source link
- Filter by field_name dropdown
- Empty state if no data collected yet

- [ ] **Step 2: Integrate into StudentManagerPage**

Add `'dossier'` to TabType. When a student is selected and dossier tab is active, render `<StudentDossierTab studentId={selected.id} communityId={communityId} />`.

Add tab button: "Досие" with clipboard/document icon.

- [ ] **Step 3: Add i18n keys**

Add translations for dossier UI strings.

- [ ] **Step 4: Commit**

```bash
git add src/features/ghost-writer/components/StudentDossierTab.tsx src/features/student-manager/StudentManagerPage.tsx src/i18n/
git commit -m "feat(ghost-writer): add student dossier tab in Student Manager"
```

---

## Task 8: Integration & Testing

**Files:**
- All ghost-writer files
- Modify: `src/features/ghost-writer/index.ts` (barrel export)

- [ ] **Step 1: Create barrel export**

```typescript
// src/features/ghost-writer/index.ts
export { GhostWriterTab } from './components/GhostWriterTab';
export { StudentDossierTab } from './components/StudentDossierTab';
export * from './ghostWriterService';
export * from './ghostWriterTypes';
```

- [ ] **Step 2: End-to-end manual test — Onboarding**

1. Log in as creator → AI Manager → AI Author tab
2. Click "Активирай" → Bot asks questions
3. Answer all 15 questions → Bot shows persona preview
4. Approve → Config saved in DB

- [ ] **Step 3: End-to-end manual test — Post generation**

1. Set approval_mode = 'preview'
2. Trigger post generation (manual or wait for cron)
3. Draft appears in drafts list
4. Approve → Post appears in community feed from creator's name

- [ ] **Step 4: End-to-end manual test — Auto-reply**

1. Enable auto_reply
2. Log in as student → send DM to creator
3. Bot responds within seconds from creator's account
4. Check student_data_points for extracted data
5. Check ghost_writer_dm_log for entry

- [ ] **Step 5: Build and deploy**

```bash
npm run build
git push myfork main
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(ghost-writer): complete integration and barrel exports"
```
