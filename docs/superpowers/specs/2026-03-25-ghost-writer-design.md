# AI Ghost Writer — Design Spec

## Overview

AI agent embedded in the AI Manager that acts as the creator's "virtual double." It writes community posts, replies to student DMs, proactively messages students, and collects structured data — all invisibly from the creator's account.

**Key constraint:** Students must never know they're talking to a bot, even when directly asked.

## Modules

### Module 1: Ghost Writer Profile (Persona)

On activation, the bot asks the creator 10-20 questions via the AI Manager chat to build a persona:

- Communication style (formal/casual/motivating)
- Typical phrases, greetings, sign-offs
- Topics they care about
- Topics to avoid
- How they address students (ти/вие, by name, nicknames)
- Brand voice examples
- Data they want to collect from students (nutrition, training, sleep, weight, mood, etc.)
- Post frequency preferences
- Whether to auto-publish or preview first
- Whether to auto-reply to DMs

The answers are stored in `ghost_writer_config`. A system prompt (`persona_prompt`) is generated from the answers and used in all AI interactions.

The creator can modify settings at any time through the chat: "Change my tone to more formal", "Stop asking students about nutrition", "Add a field for stress levels".

### Module 2: Auto Posts

The creator tells the bot their posting schedule via the AI Manager chat: "I want a motivational post every morning at 9:00".

The bot generates posts using Gemini with the persona prompt + community context (recent posts, member activity, trending topics).

Two approval modes:
- **Preview**: Post saved as draft, creator gets notification in AI Manager, approves/edits/rejects in chat
- **Auto**: Published directly from the creator's account

Posts are saved with `author_id = creator_profile_id` — indistinguishable from manual posts.

### Module 3: Auto DM & Data Collection

**Auto-reply:** When a student sends a DM to the creator and auto-reply is enabled, the bot responds using the persona + student dossier + conversation history. The message is sent as `sender_profile_id = creator_profile_id`.

**Proactive messages:** On triggers (new student joined, student inactive for X days, at-risk student, scheduled check-in), the bot initiates DMs from the creator's account.

**Data collection:** During conversations, the bot extracts structured data points based on `data_collection_fields` and saves them to `student_data_points`. For example, if the student says "Днес ядох салата и пиле", the bot extracts `{ field: "хранене", value: "салата и пиле" }`.

**Student dossier:** Creators see collected data in Student Manager — a new "Досие" tab per student showing a timeline of all data points.

## Database Schema

### ghost_writer_config

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| community_id | UUID FK → communities | One config per community |
| creator_id | UUID FK → profiles | The creator whose identity the bot uses |
| persona_prompt | TEXT | Generated system prompt for Gemini |
| persona_answers | JSONB | Raw Q&A from onboarding (for re-editing) |
| data_collection_fields | JSONB | Array of field names: `["хранене", "тренировки", "сън"]` |
| auto_reply_enabled | BOOLEAN DEFAULT false | Whether bot auto-replies to student DMs |
| approval_mode | TEXT DEFAULT 'preview' | 'preview' or 'auto' |
| post_schedule_description | TEXT | Natural language schedule: "Всяка сутрин в 9:00" |
| is_active | BOOLEAN DEFAULT false | Master on/off switch |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS:** Only the creator (creator_id) can read/write their config.

### ghost_writer_schedules

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| community_id | UUID FK → communities | |
| config_id | UUID FK → ghost_writer_config | |
| schedule_cron | TEXT | Cron expression: "0 9 * * *" |
| channel_id | UUID FK → community_channels | Target channel for posts |
| post_type | TEXT | 'motivation', 'tip', 'question', 'recap', 'custom' |
| topic_hints | TEXT | Additional instructions: "Focus on morning routines" |
| is_active | BOOLEAN DEFAULT true | |
| last_run_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

**RLS:** Only the creator can manage schedules.

### ghost_writer_drafts

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| community_id | UUID FK → communities | |
| schedule_id | UUID FK → ghost_writer_schedules, nullable | Null if manually triggered |
| content | TEXT | Generated post content |
| image_url | TEXT, nullable | Optional generated/suggested image |
| channel_id | UUID FK → community_channels | Target channel |
| status | TEXT DEFAULT 'pending' | 'pending', 'approved', 'rejected', 'published' |
| created_at | TIMESTAMPTZ | |
| published_at | TIMESTAMPTZ, nullable | When actually posted |

**RLS:** Only the creator can view/manage drafts.

### student_data_points

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| student_id | UUID FK → profiles | The student this data belongs to |
| community_id | UUID FK → communities | |
| field_name | TEXT | "хранене", "тегло", "настроение", "тренировка" |
| value | TEXT | Extracted value |
| collected_at | TIMESTAMPTZ | When the data was shared |
| source_conversation_id | UUID FK → direct_conversations, nullable | Which DM it came from |
| created_at | TIMESTAMPTZ | |

**RLS:** Creator of the community can read all data points. Students can read only their own.

### ghost_writer_dm_log

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| community_id | UUID FK → communities | |
| student_id | UUID FK → profiles | |
| conversation_id | UUID FK → direct_conversations | |
| trigger_type | TEXT | 'auto_reply', 'proactive_new_student', 'proactive_inactive', 'proactive_at_risk', 'proactive_scheduled' |
| message_content | TEXT | What the bot sent |
| data_extracted | JSONB, nullable | Any data points extracted from the exchange |
| created_at | TIMESTAMPTZ | |

**RLS:** Only the creator can view the log.

## Flows

### Flow 1: Onboarding

```
Creator opens AI Manager → Sees new "AI Автор" tab →
Clicks "Активирай" → Bot starts asking questions one by one →
Q1: "Как се обръщаш към учениците си?" →
Q2: "Опиши стила си на писане с 3 думи" →
... (10-20 questions) →
Bot generates persona_prompt → Shows preview: "Ето как ще пиша от твое име: [пример пост]" →
Creator approves → ghost_writer_config saved → is_active = true
```

### Flow 2: Scheduled Post

```
Cron trigger fires → Load ghost_writer_config for community →
Build context: persona_prompt + recent 5 posts + community stats + schedule topic_hints →
Gemini generates post →
IF approval_mode = 'preview':
  Save to ghost_writer_drafts (status: pending) →
  Show in AI Manager chat: "Ето предложение за пост: [content]. Одобряваш ли?" →
  Creator says "да" / "промени X" / "не" →
  If approved: createPost(channelId, creatorProfileId, content) → status = published
IF approval_mode = 'auto':
  createPost(channelId, creatorProfileId, content) directly →
  Log in ghost_writer_drafts (status: published)
```

### Flow 3: Auto-reply DM

```
Student sends DM to creator → Check ghost_writer_config.auto_reply_enabled →
IF enabled:
  Load: persona_prompt + student profile + student_data_points history +
        last 20 messages in conversation + student_health data →
  Gemini generates reply as creator →
  sendMessage(conversationId, creatorProfileId, reply) →
  Extract data points from student's message →
  Save to student_data_points if any found →
  Log in ghost_writer_dm_log
IF disabled:
  Normal flow — creator sees unread message
```

### Flow 4: Proactive DM

```
Trigger fires (new student / inactive 3+ days / at-risk / scheduled) →
Load ghost_writer_config + student context →
Gemini generates personalized message →
getOrCreateCreatorConversation(communityId, creatorProfileId, studentProfileId) →
sendMessage(conversationId, creatorProfileId, message) →
Log in ghost_writer_dm_log (trigger_type) →
If student replies → Flow 3 handles the response
```

## UI Changes

### AI Manager — New "AI Автор" Tab

Located within the existing AI Manager page. Contains:

1. **Chat interface** — Same as existing AI Manager chat but with ghost writer context. Used for:
   - Initial onboarding (Q&A)
   - Modifying settings ("Промени тона ми")
   - Reviewing drafts ("Одобри / Промени / Отхвърли")
   - Requesting on-demand posts ("Напиши пост за утрешната тренировка")

2. **Status panel** (sidebar or top bar):
   - Master toggle: AI Автор ON/OFF
   - Auto-reply toggle: ON/OFF
   - Approval mode: Preview / Auto
   - Next scheduled post: "Утре, 9:00 — мотивация"
   - Stats: "12 поста този месец, 45 DM отговора"

3. **Drafts queue** — List of pending drafts awaiting approval

4. **Schedule overview** — Visual list of scheduled post types and times

### Student Manager — New "Досие" Tab

Per-student view showing:
- Timeline of collected data points grouped by field
- Example: "Хранене: салата и пиле (15 март), пица (14 март), ..."
- Filterable by field name and date range
- Source link to the conversation where data was collected

### No Changes for Students

Students see:
- Regular posts in the community feed (author = creator)
- Regular DMs from the creator (sender = creator)
- No AI badges, no bot indicators, no "powered by" text

## Technical Implementation

### Gemini Integration

Extends existing `geminiService.ts` with new functions:
- `generateGhostPost(config, context)` — Generate a community post
- `generateGhostReply(config, studentContext, messageHistory)` — Generate a DM reply
- `generateProactiveMessage(config, studentContext, triggerType)` — Generate outreach message
- `extractDataPoints(config, message)` — Extract structured data from student message

All functions use the `persona_prompt` from `ghost_writer_config` as the system instruction.

### Edge Functions

New Supabase Edge Functions:
- `ghost-writer-post` — Called by cron to generate and publish/draft posts
- `ghost-writer-reply` — Called when a student DM arrives (via database webhook or realtime trigger)
- `ghost-writer-proactive` — Called by cron to check for proactive DM triggers

### Cron Setup

Via `vercel.json` or Supabase cron:
- Post schedule: Configurable per community (from `ghost_writer_schedules.schedule_cron`)
- Proactive DM check: Every hour, scans for trigger conditions (new students, inactive, at-risk)

### Security

- Ghost writer config is creator-only (RLS)
- All messages sent with `creator_profile_id` — no separate bot identity
- Student data points: creator can read all, student reads own only
- DM log: creator-only access
- The persona_prompt explicitly includes instruction to never reveal AI nature

## Out of Scope (v1)

- Image generation for posts (text only in v1)
- Voice/audio messages
- Multi-language auto-detection (uses community's default language)
- A/B testing of post styles
- Integration with external scheduling tools
