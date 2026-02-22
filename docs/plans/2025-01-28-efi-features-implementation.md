# EFI Course Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add community chatbots, homework system, and student manager for EFI course

**Architecture:** Feature-based folders under `src/features/` with dedicated services. Database tables in Supabase with RLS policies. Points integration via existing `pointsService.ts`.

**Tech Stack:** React + TypeScript, Tailwind CSS, Supabase (Postgres + Storage), Gemini API

---

## Phase 1: Database Schema

### Task 1.1: Create Database Types

**Files:**
- Modify: `src/core/supabase/database.types.ts`

**Step 1: Add chatbot types after line 238**

```typescript
// Community Chatbots
export interface DbCommunityhatbot {
  id: string;
  community_id: string;
  name: string;
  role: 'qa' | 'motivation' | 'support';
  system_prompt: string | null;
  personality: string | null;
  greeting_message: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbChatbotConversation {
  id: string;
  chatbot_id: string;
  user_id: string;
  messages: { role: 'user' | 'model'; text: string; timestamp: string }[];
  created_at: string;
  updated_at: string;
}

// Homework System
export interface DbHomeworkAssignment {
  id: string;
  community_id: string;
  creator_id: string;
  title: string;
  description: string | null;
  max_points: number;
  due_date: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbHomeworkSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  text_response: string | null;
  file_urls: string[];
  status: 'pending' | 'graded';
  points_awarded: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
  graded_by: string | null;
}

export interface DbHomeworkSubmissionWithStudent extends DbHomeworkSubmission {
  student: DbProfile;
}

export interface DbHomeworkAssignmentWithStats extends DbHomeworkAssignment {
  total_submissions: number;
  pending_count: number;
}
```

**Step 2: Verify types compile**

Run: `npm run build 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/core/supabase/database.types.ts
git commit -m "feat: add database types for chatbots and homework"
```

---

### Task 1.2: Create Supabase Tables

**Files:**
- Create: `supabase/migrations/20250128_efi_features.sql`

**Step 1: Create migration file**

```sql
-- Community Chatbots
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

CREATE TABLE chatbot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatbot_id UUID NOT NULL REFERENCES community_chatbots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatbot_id, user_id)
);

-- Homework System
CREATE TABLE homework_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  max_points INTEGER DEFAULT 10 CHECK (max_points >= 1 AND max_points <= 10),
  due_date TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE homework_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  text_response TEXT,
  file_urls JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'graded')),
  points_awarded INTEGER CHECK (points_awarded >= 0 AND points_awarded <= 10),
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  graded_at TIMESTAMPTZ,
  graded_by UUID,
  UNIQUE(assignment_id, student_id)
);

-- Indexes
CREATE INDEX idx_chatbots_community ON community_chatbots(community_id);
CREATE INDEX idx_conversations_chatbot ON chatbot_conversations(chatbot_id);
CREATE INDEX idx_conversations_user ON chatbot_conversations(user_id);
CREATE INDEX idx_assignments_community ON homework_assignments(community_id);
CREATE INDEX idx_assignments_published ON homework_assignments(is_published);
CREATE INDEX idx_submissions_assignment ON homework_submissions(assignment_id);
CREATE INDEX idx_submissions_student ON homework_submissions(student_id);
CREATE INDEX idx_submissions_status ON homework_submissions(status);

-- RLS Policies
ALTER TABLE community_chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_submissions ENABLE ROW LEVEL SECURITY;

-- Chatbots: anyone in community can read active bots
CREATE POLICY "Users can view active chatbots" ON community_chatbots
  FOR SELECT USING (is_active = true);

CREATE POLICY "Creators can manage chatbots" ON community_chatbots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM communities c
      JOIN profiles p ON c.creator_id = p.id
      WHERE c.id = community_id AND p.user_id = auth.uid()
    )
  );

-- Conversations: users can manage their own
CREATE POLICY "Users can manage own conversations" ON chatbot_conversations
  FOR ALL USING (user_id = auth.uid());

-- Assignments: published visible to members, creators can manage all
CREATE POLICY "Members can view published assignments" ON homework_assignments
  FOR SELECT USING (is_published = true);

CREATE POLICY "Creators can manage assignments" ON homework_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = creator_id AND p.user_id = auth.uid()
    )
  );

-- Submissions: students manage own, creators can view/update all in community
CREATE POLICY "Students can manage own submissions" ON homework_submissions
  FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Creators can view community submissions" ON homework_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN communities c ON ha.community_id = c.id
      JOIN profiles p ON c.creator_id = p.id
      WHERE ha.id = assignment_id AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Creators can grade submissions" ON homework_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM homework_assignments ha
      JOIN communities c ON ha.community_id = c.id
      JOIN profiles p ON c.creator_id = p.id
      WHERE ha.id = assignment_id AND p.user_id = auth.uid()
    )
  );
```

**Step 2: Run migration in Supabase dashboard**

Go to Supabase Dashboard → SQL Editor → Paste and run

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add database tables for chatbots and homework"
```

---

## Phase 2: Homework System

### Task 2.1: Create Homework Service

**Files:**
- Create: `src/features/homework/homeworkService.ts`

**Step 1: Create service file**

```typescript
import { supabase } from '../../core/supabase/client';
import {
  DbHomeworkAssignment,
  DbHomeworkSubmission,
  DbHomeworkSubmissionWithStudent,
  DbHomeworkAssignmentWithStats,
} from '../../core/supabase/database.types';
import { awardPoints } from '../community/pointsService';

// === ASSIGNMENTS ===

export async function createAssignment(
  communityId: string,
  creatorId: string,
  title: string,
  description?: string,
  maxPoints: number = 10,
  dueDate?: string
): Promise<DbHomeworkAssignment | null> {
  const { data, error } = await supabase
    .from('homework_assignments')
    .insert({
      community_id: communityId,
      creator_id: creatorId,
      title,
      description,
      max_points: maxPoints,
      due_date: dueDate,
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating assignment:', error);
    return null;
  }
  return data;
}

export async function getAssignments(
  communityId: string,
  includeUnpublished: boolean = false
): Promise<DbHomeworkAssignmentWithStats[]> {
  let query = supabase
    .from('homework_assignments')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (!includeUnpublished) {
    query = query.eq('is_published', true);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching assignments:', error);
    return [];
  }

  // Get submission stats for each assignment
  const assignmentsWithStats = await Promise.all(
    (data || []).map(async (assignment) => {
      const { count: totalCount } = await supabase
        .from('homework_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_id', assignment.id);

      const { count: pendingCount } = await supabase
        .from('homework_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('assignment_id', assignment.id)
        .eq('status', 'pending');

      return {
        ...assignment,
        total_submissions: totalCount || 0,
        pending_count: pendingCount || 0,
      };
    })
  );

  return assignmentsWithStats;
}

export async function updateAssignment(
  assignmentId: string,
  updates: Partial<Pick<DbHomeworkAssignment, 'title' | 'description' | 'max_points' | 'due_date' | 'is_published'>>
): Promise<DbHomeworkAssignment | null> {
  const { data, error } = await supabase
    .from('homework_assignments')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) {
    console.error('Error updating assignment:', error);
    return null;
  }
  return data;
}

export async function deleteAssignment(assignmentId: string): Promise<boolean> {
  const { error } = await supabase
    .from('homework_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) {
    console.error('Error deleting assignment:', error);
    return false;
  }
  return true;
}

// === SUBMISSIONS ===

export async function submitHomework(
  assignmentId: string,
  studentId: string,
  textResponse?: string,
  fileUrls: string[] = []
): Promise<DbHomeworkSubmission | null> {
  const { data, error } = await supabase
    .from('homework_submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      text_response: textResponse,
      file_urls: fileUrls,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error submitting homework:', error);
    return null;
  }
  return data;
}

export async function getSubmissionsForAssignment(
  assignmentId: string
): Promise<DbHomeworkSubmissionWithStudent[]> {
  const { data, error } = await supabase
    .from('homework_submissions')
    .select(`
      *,
      student:profiles!student_id(*)
    `)
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('Error fetching submissions:', error);
    return [];
  }
  return data || [];
}

export async function getStudentSubmissions(
  studentId: string,
  communityId: string
): Promise<(DbHomeworkSubmission & { assignment: DbHomeworkAssignment })[]> {
  const { data, error } = await supabase
    .from('homework_submissions')
    .select(`
      *,
      assignment:homework_assignments!assignment_id(*)
    `)
    .eq('student_id', studentId)
    .eq('assignment.community_id', communityId)
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('Error fetching student submissions:', error);
    return [];
  }
  return data || [];
}

export async function gradeSubmission(
  submissionId: string,
  pointsAwarded: number,
  feedback: string | null,
  graderId: string,
  studentProfileId: string,
  communityId: string
): Promise<DbHomeworkSubmission | null> {
  const { data, error } = await supabase
    .from('homework_submissions')
    .update({
      status: 'graded',
      points_awarded: pointsAwarded,
      feedback,
      graded_at: new Date().toISOString(),
      graded_by: graderId,
    })
    .eq('id', submissionId)
    .select()
    .single();

  if (error) {
    console.error('Error grading submission:', error);
    return null;
  }

  // Award points to student
  if (pointsAwarded > 0) {
    await awardPoints(studentProfileId, communityId, pointsAwarded, 'Homework graded');
  }

  return data;
}

// === FILE UPLOAD ===

export async function uploadHomeworkFile(
  assignmentId: string,
  studentId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'file';
  const fileName = `${assignmentId}/${studentId}/${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from('homework-files')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading file:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('homework-files')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
```

**Step 2: Verify it compiles**

Run: `npm run build 2>&1 | head -20`

**Step 3: Commit**

```bash
git add src/features/homework/
git commit -m "feat: add homework service with CRUD and file upload"
```

---

### Task 2.2: Create Assignment Edit Modal

**Files:**
- Create: `src/features/homework/AssignmentEditModal.tsx`

**Step 1: Create modal component**

```typescript
import React, { useState, useEffect } from 'react';
import { X, Loader2, Calendar, Trash2 } from 'lucide-react';
import { DbHomeworkAssignment } from '../../core/supabase/database.types';

interface AssignmentEditModalProps {
  assignment?: DbHomeworkAssignment | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    title: string;
    description: string;
    maxPoints: number;
    dueDate: string | null;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

export const AssignmentEditModal: React.FC<AssignmentEditModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [maxPoints, setMaxPoints] = useState(10);
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (assignment) {
      setTitle(assignment.title);
      setDescription(assignment.description || '');
      setMaxPoints(assignment.max_points);
      setDueDate(assignment.due_date ? assignment.due_date.split('T')[0] : '');
    } else {
      setTitle('');
      setDescription('');
      setMaxPoints(10);
      setDueDate('');
    }
    setError(null);
  }, [assignment, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        maxPoints,
        dueDate: dueDate || null,
      });
      onClose();
    } catch (err) {
      setError('Failed to save. Please try again.');
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {assignment ? 'Edit Assignment' : 'New Assignment'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Week 1: Brand Identity Exercise"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Instructions
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Describe what students need to do..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max Points (1-10)
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxPoints}
                onChange={(e) => setMaxPoints(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Due Date (optional)
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-slate-50">
          <div>
            {assignment && onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/features/homework/AssignmentEditModal.tsx
git commit -m "feat: add assignment edit modal component"
```

---

### Task 2.3: Create Homework Submission Modal

**Files:**
- Create: `src/features/homework/HomeworkSubmissionModal.tsx`

**Step 1: Create submission modal**

```typescript
import React, { useState } from 'react';
import { X, Loader2, Upload, FileText, Image, Film, Trash2 } from 'lucide-react';
import { DbHomeworkAssignment } from '../../core/supabase/database.types';
import { uploadHomeworkFile } from './homeworkService';

interface HomeworkSubmissionModalProps {
  assignment: DbHomeworkAssignment;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (textResponse: string, fileUrls: string[]) => Promise<void>;
}

export const HomeworkSubmissionModal: React.FC<HomeworkSubmissionModalProps> = ({
  assignment,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [textResponse, setTextResponse] = useState('');
  const [files, setFiles] = useState<{ file: File; url?: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setError(null);

    for (const file of selectedFiles) {
      // Max 50MB per file
      if (file.size > 50 * 1024 * 1024) {
        setError(`File ${file.name} is too large (max 50MB)`);
        continue;
      }
      setFiles((prev) => [...prev, { file }]);
    }
    setIsUploading(false);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (file.type.startsWith('video/')) return <Film className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const handleSubmit = async () => {
    if (!textResponse.trim() && files.length === 0) {
      setError('Please provide a response or upload files');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Upload files first
      const uploadedUrls: string[] = [];
      for (const { file } of files) {
        const url = await uploadHomeworkFile(assignment.id, 'student', file);
        if (url) {
          uploadedUrls.push(url);
        }
      }

      await onSubmit(textResponse.trim(), uploadedUrls);
      onClose();
    } catch (err) {
      setError('Failed to submit. Please try again.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Submit: {assignment.title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {assignment.description && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <h3 className="text-sm font-medium text-slate-700 mb-1">Instructions:</h3>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {assignment.description}
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Your Response
            </label>
            <textarea
              value={textResponse}
              onChange={(e) => setTextResponse(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Write your response here..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Attachments
            </label>

            {files.length > 0 && (
              <div className="space-y-2 mb-3">
                {files.map((f, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      {getFileIcon(f.file)}
                      <span className="text-sm text-slate-700 truncate max-w-[300px]">
                        {f.file.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        ({(f.file.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="p-1 hover:bg-slate-200 rounded"
                    >
                      <Trash2 className="w-4 h-4 text-slate-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 cursor-pointer transition-colors">
              <input
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
              />
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              ) : (
                <>
                  <Upload className="w-5 h-5 text-slate-400" />
                  <span className="text-sm text-slate-500">
                    Click to upload files (images, videos, PDFs, docs)
                  </span>
                </>
              )}
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/features/homework/HomeworkSubmissionModal.tsx
git commit -m "feat: add homework submission modal with file upload"
```

---

### Task 2.4: Create Grading Modal

**Files:**
- Create: `src/features/homework/GradingModal.tsx`

**Step 1: Create grading modal**

```typescript
import React, { useState } from 'react';
import { X, Loader2, FileText, Image, Film, ExternalLink } from 'lucide-react';
import { DbHomeworkSubmissionWithStudent } from '../../core/supabase/database.types';

interface GradingModalProps {
  submission: DbHomeworkSubmissionWithStudent;
  maxPoints: number;
  isOpen: boolean;
  onClose: () => void;
  onGrade: (points: number, feedback: string | null) => Promise<void>;
}

export const GradingModal: React.FC<GradingModalProps> = ({
  submission,
  maxPoints,
  isOpen,
  onClose,
  onGrade,
}) => {
  const [points, setPoints] = useState(maxPoints);
  const [feedback, setFeedback] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getFileIcon = (url: string) => {
    const lower = url.toLowerCase();
    if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/)) return <Image className="w-4 h-4" />;
    if (lower.match(/\.(mp4|webm|mov)$/)) return <Film className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const handleGrade = async () => {
    setIsGrading(true);
    setError(null);
    try {
      await onGrade(points, feedback.trim() || null);
      onClose();
    } catch (err) {
      setError('Failed to grade. Please try again.');
    }
    setIsGrading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Grade Submission</h2>
            <p className="text-sm text-slate-500">
              {submission.student?.full_name || 'Student'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {submission.text_response && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Response:</h3>
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {submission.text_response}
                </p>
              </div>
            </div>
          )}

          {submission.file_urls && submission.file_urls.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Attachments:</h3>
              <div className="space-y-2">
                {submission.file_urls.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    {getFileIcon(url)}
                    <span className="text-sm text-slate-700 truncate flex-1">
                      Attachment {index + 1}
                    </span>
                    <ExternalLink className="w-4 h-4 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Grade:</h3>

            <div className="mb-4">
              <label className="block text-sm text-slate-600 mb-2">
                Points (0-{maxPoints})
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={maxPoints}
                  value={points}
                  onChange={(e) => setPoints(parseInt(e.target.value))}
                  className="flex-1"
                />
                <div className="w-16 text-center">
                  <span className="text-2xl font-bold text-indigo-600">{points}</span>
                  <span className="text-slate-400">/{maxPoints}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-600 mb-1">
                Feedback (optional)
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Great work! Here's what you did well..."
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleGrade}
            disabled={isGrading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isGrading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Grading...
              </>
            ) : (
              `Award ${points} Points`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/features/homework/GradingModal.tsx
git commit -m "feat: add grading modal with points slider"
```

---

### Task 2.5: Create Student Homework Page

**Files:**
- Create: `src/features/homework/HomeworkPage.tsx`

**Step 1: Create student homework page**

```typescript
import React, { useState, useEffect } from 'react';
import { ClipboardList, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { DbHomeworkAssignment, DbHomeworkSubmission } from '../../core/supabase/database.types';
import { getAssignments, getStudentSubmissions, submitHomework } from './homeworkService';
import { HomeworkSubmissionModal } from './HomeworkSubmissionModal';
import { useAuth } from '../../core/auth/AuthContext';

interface HomeworkPageProps {
  communityId: string;
}

export const HomeworkPage: React.FC<HomeworkPageProps> = ({ communityId }) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<DbHomeworkAssignment[]>([]);
  const [submissions, setSubmissions] = useState<Map<string, DbHomeworkSubmission>>(new Map());
  const [selectedAssignment, setSelectedAssignment] = useState<DbHomeworkAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [communityId, user]);

  const loadData = async () => {
    if (!user) return;
    setIsLoading(true);

    const [assignmentList, submissionList] = await Promise.all([
      getAssignments(communityId, false),
      getStudentSubmissions(user.id, communityId),
    ]);

    setAssignments(assignmentList);

    const submissionMap = new Map<string, DbHomeworkSubmission>();
    submissionList.forEach((s) => submissionMap.set(s.assignment_id, s));
    setSubmissions(submissionMap);

    setIsLoading(false);
  };

  const handleSubmit = async (textResponse: string, fileUrls: string[]) => {
    if (!selectedAssignment || !user) return;
    await submitHomework(selectedAssignment.id, user.id, textResponse, fileUrls);
    await loadData();
  };

  const getSubmissionStatus = (assignmentId: string) => {
    const submission = submissions.get(assignmentId);
    if (!submission) return 'not_submitted';
    return submission.status;
  };

  const pendingAssignments = assignments.filter(
    (a) => getSubmissionStatus(a.id) === 'not_submitted'
  );
  const submittedAssignments = assignments.filter(
    (a) => getSubmissionStatus(a.id) !== 'not_submitted'
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="w-8 h-8 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">Homework</h1>
      </div>

      {/* Pending Assignments */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          Pending Assignments ({pendingAssignments.length})
        </h2>
        {pendingAssignments.length === 0 ? (
          <p className="text-slate-500 text-sm">No pending assignments</p>
        ) : (
          <div className="space-y-3">
            {pendingAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white border rounded-xl p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-slate-900">{assignment.title}</h3>
                    {assignment.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                        {assignment.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>Max {assignment.max_points} pts</span>
                      {assignment.due_date && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAssignment(assignment)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                  >
                    Submit
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My Submissions */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          My Submissions ({submittedAssignments.length})
        </h2>
        {submittedAssignments.length === 0 ? (
          <p className="text-slate-500 text-sm">No submissions yet</p>
        ) : (
          <div className="space-y-3">
            {submittedAssignments.map((assignment) => {
              const submission = submissions.get(assignment.id)!;
              const isGraded = submission.status === 'graded';
              return (
                <div
                  key={assignment.id}
                  className="bg-white border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900">{assignment.title}</h3>
                        {isGraded ? (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Graded
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            Pending Review
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        Submitted {new Date(submission.submitted_at).toLocaleDateString()}
                      </p>
                      {isGraded && (
                        <div className="mt-2">
                          <span className="text-lg font-bold text-indigo-600">
                            {submission.points_awarded}
                          </span>
                          <span className="text-slate-400">/{assignment.max_points} pts</span>
                          {submission.feedback && (
                            <p className="text-sm text-slate-600 mt-1 italic">
                              "{submission.feedback}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedAssignment && (
        <HomeworkSubmissionModal
          assignment={selectedAssignment}
          isOpen={!!selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/features/homework/HomeworkPage.tsx
git commit -m "feat: add student homework page with submissions"
```

---

### Task 2.6: Create Creator Homework Management

**Files:**
- Create: `src/features/homework/HomeworkManagement.tsx`

**Step 1: Create creator homework management page**

```typescript
import React, { useState, useEffect } from 'react';
import { Plus, ClipboardList, Users, Eye, EyeOff } from 'lucide-react';
import {
  DbHomeworkAssignmentWithStats,
  DbHomeworkSubmissionWithStudent,
} from '../../core/supabase/database.types';
import {
  getAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  getSubmissionsForAssignment,
  gradeSubmission,
} from './homeworkService';
import { AssignmentEditModal } from './AssignmentEditModal';
import { GradingModal } from './GradingModal';
import { useAuth } from '../../core/auth/AuthContext';

interface HomeworkManagementProps {
  communityId: string;
  creatorProfileId: string;
}

type Tab = 'assignments' | 'submissions';

export const HomeworkManagement: React.FC<HomeworkManagementProps> = ({
  communityId,
  creatorProfileId,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('submissions');
  const [assignments, setAssignments] = useState<DbHomeworkAssignmentWithStats[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<DbHomeworkAssignmentWithStats | null>(null);
  const [submissions, setSubmissions] = useState<DbHomeworkSubmissionWithStudent[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<DbHomeworkSubmissionWithStudent | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<DbHomeworkAssignmentWithStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'graded'>('pending');

  useEffect(() => {
    loadAssignments();
  }, [communityId]);

  useEffect(() => {
    if (selectedAssignment) {
      loadSubmissions(selectedAssignment.id);
    }
  }, [selectedAssignment]);

  const loadAssignments = async () => {
    setIsLoading(true);
    const data = await getAssignments(communityId, true);
    setAssignments(data);
    if (data.length > 0 && !selectedAssignment) {
      setSelectedAssignment(data[0]);
    }
    setIsLoading(false);
  };

  const loadSubmissions = async (assignmentId: string) => {
    const data = await getSubmissionsForAssignment(assignmentId);
    setSubmissions(data);
  };

  const handleCreateAssignment = () => {
    setEditingAssignment(null);
    setIsEditModalOpen(true);
  };

  const handleEditAssignment = (assignment: DbHomeworkAssignmentWithStats) => {
    setEditingAssignment(assignment);
    setIsEditModalOpen(true);
  };

  const handleSaveAssignment = async (data: {
    title: string;
    description: string;
    maxPoints: number;
    dueDate: string | null;
  }) => {
    if (editingAssignment) {
      await updateAssignment(editingAssignment.id, {
        title: data.title,
        description: data.description,
        max_points: data.maxPoints,
        due_date: data.dueDate,
      });
    } else {
      await createAssignment(
        communityId,
        creatorProfileId,
        data.title,
        data.description,
        data.maxPoints,
        data.dueDate || undefined
      );
    }
    await loadAssignments();
  };

  const handleDeleteAssignment = async () => {
    if (!editingAssignment) return;
    await deleteAssignment(editingAssignment.id);
    setIsEditModalOpen(false);
    setSelectedAssignment(null);
    await loadAssignments();
  };

  const handleTogglePublish = async (assignment: DbHomeworkAssignmentWithStats) => {
    await updateAssignment(assignment.id, { is_published: !assignment.is_published });
    await loadAssignments();
  };

  const handleGrade = async (points: number, feedback: string | null) => {
    if (!selectedSubmission || !selectedAssignment || !user) return;
    await gradeSubmission(
      selectedSubmission.id,
      points,
      feedback,
      user.id,
      selectedSubmission.student_id,
      communityId
    );
    await loadSubmissions(selectedAssignment.id);
  };

  const filteredSubmissions = submissions.filter((s) => {
    if (statusFilter === 'all') return true;
    return s.status === statusFilter;
  });

  const totalPending = assignments.reduce((sum, a) => sum + a.pending_count, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Homework</h1>
            {totalPending > 0 && (
              <p className="text-sm text-amber-600">{totalPending} pending reviews</p>
            )}
          </div>
        </div>
        <button
          onClick={handleCreateAssignment}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          New Assignment
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Assignment List */}
        <div className="col-span-4 bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-slate-800 mb-3">Assignments</h2>
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                onClick={() => setSelectedAssignment(assignment)}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedAssignment?.id === assignment.id
                    ? 'bg-indigo-50 border-indigo-200 border'
                    : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 text-sm truncate">
                      {assignment.title}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {assignment.is_published ? (
                        <span className="text-xs text-green-600">Published</span>
                      ) : (
                        <span className="text-xs text-slate-400">Draft</span>
                      )}
                      {assignment.pending_count > 0 && (
                        <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          {assignment.pending_count} pending
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditAssignment(assignment);
                    }}
                    className="p-1 hover:bg-slate-200 rounded text-slate-400"
                  >
                    ···
                  </button>
                </div>
              </div>
            ))}
            {assignments.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No assignments yet
              </p>
            )}
          </div>
        </div>

        {/* Submissions Queue */}
        <div className="col-span-8 bg-white rounded-xl border p-4">
          {selectedAssignment ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-800">
                    {selectedAssignment.title}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selectedAssignment.total_submissions} submissions
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                    className="text-sm border rounded-lg px-2 py-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="graded">Graded</option>
                    <option value="all">All</option>
                  </select>
                  <button
                    onClick={() => handleTogglePublish(selectedAssignment)}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${
                      selectedAssignment.is_published
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {selectedAssignment.is_published ? (
                      <>
                        <EyeOff className="w-3 h-3" /> Unpublish
                      </>
                    ) : (
                      <>
                        <Eye className="w-3 h-3" /> Publish
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="p-4 border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">
                            {submission.student?.full_name || 'Student'}
                          </h3>
                          <p className="text-xs text-slate-500">
                            Submitted {new Date(submission.submitted_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {submission.status === 'pending' ? (
                        <button
                          onClick={() => setSelectedSubmission(submission)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
                        >
                          Grade
                        </button>
                      ) : (
                        <div className="text-right">
                          <span className="text-lg font-bold text-green-600">
                            {submission.points_awarded}
                          </span>
                          <span className="text-slate-400">/{selectedAssignment.max_points}</span>
                        </div>
                      )}
                    </div>
                    {submission.text_response && (
                      <p className="mt-2 text-sm text-slate-600 line-clamp-2">
                        {submission.text_response}
                      </p>
                    )}
                  </div>
                ))}
                {filteredSubmissions.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-8">
                    No {statusFilter === 'all' ? '' : statusFilter} submissions
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500">
              Select an assignment to view submissions
            </div>
          )}
        </div>
      </div>

      <AssignmentEditModal
        assignment={editingAssignment}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSaveAssignment}
        onDelete={editingAssignment ? handleDeleteAssignment : undefined}
      />

      {selectedSubmission && selectedAssignment && (
        <GradingModal
          submission={selectedSubmission}
          maxPoints={selectedAssignment.max_points}
          isOpen={!!selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onGrade={handleGrade}
        />
      )}
    </div>
  );
};
```

**Step 2: Create index export**

Create `src/features/homework/index.ts`:

```typescript
export * from './homeworkService';
export * from './HomeworkPage';
export * from './HomeworkManagement';
export * from './AssignmentEditModal';
export * from './HomeworkSubmissionModal';
export * from './GradingModal';
```

**Step 3: Commit**

```bash
git add src/features/homework/
git commit -m "feat: add creator homework management with submissions queue"
```

---

## Phase 3: Community Chatbots

### Task 3.1: Create Chatbot Service

**Files:**
- Create: `src/features/chatbots/chatbotService.ts`

**Step 1: Create service file**

```typescript
import { supabase } from '../../core/supabase/client';
import { DbCommunityChatbot, DbChatbotConversation } from '../../core/supabase/database.types';

const ROLE_DEFAULTS: Record<string, { personality: string; systemPrompt: string; greeting: string }> = {
  qa: {
    personality: 'Helpful and knowledgeable',
    systemPrompt: 'You are a helpful Q&A assistant for this course. Answer questions clearly and provide examples when helpful.',
    greeting: 'Hi! I\'m here to answer your questions about the course. What would you like to know?',
  },
  motivation: {
    personality: 'Encouraging and supportive',
    systemPrompt: 'You are a motivational coach. Encourage students, celebrate their wins, and help them stay focused on their goals.',
    greeting: 'Hey! I\'m your motivation coach. Ready to crush your goals today?',
  },
  support: {
    personality: 'Patient and solution-oriented',
    systemPrompt: 'You are a technical support assistant. Help students with technical issues, platform questions, and troubleshooting.',
    greeting: 'Hello! Need help with something technical? I\'m here to assist.',
  },
};

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

export async function createChatbot(
  communityId: string,
  name: string,
  role: 'qa' | 'motivation' | 'support',
  customPrompt?: string,
  customPersonality?: string,
  customGreeting?: string
): Promise<DbCommunityChatbot | null> {
  const defaults = ROLE_DEFAULTS[role];

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

export async function updateChatbot(
  chatbotId: string,
  updates: Partial<Pick<DbCommunityChatbot, 'name' | 'system_prompt' | 'personality' | 'greeting_message' | 'is_active'>>
): Promise<DbCommunityChatbot | null> {
  const { data, error } = await supabase
    .from('community_chatbots')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', chatbotId)
    .select()
    .single();

  if (error) {
    console.error('Error updating chatbot:', error);
    return null;
  }
  return data;
}

export async function deleteChatbot(chatbotId: string): Promise<boolean> {
  const { error } = await supabase
    .from('community_chatbots')
    .delete()
    .eq('id', chatbotId);

  if (error) {
    console.error('Error deleting chatbot:', error);
    return false;
  }
  return true;
}

// Conversations
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
    console.error('Error fetching conversation:', error);
    return null;
  }
  return data;
}

export async function saveConversation(
  chatbotId: string,
  userId: string,
  messages: { role: 'user' | 'model'; text: string; timestamp: string }[]
): Promise<boolean> {
  const { error } = await supabase
    .from('chatbot_conversations')
    .upsert({
      chatbot_id: chatbotId,
      user_id: userId,
      messages,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'chatbot_id,user_id',
    });

  if (error) {
    console.error('Error saving conversation:', error);
    return false;
  }
  return true;
}

export function getRoleDefaults(role: string) {
  return ROLE_DEFAULTS[role] || ROLE_DEFAULTS.qa;
}
```

**Step 2: Commit**

```bash
git add src/features/chatbots/
git commit -m "feat: add chatbot service with CRUD and conversation management"
```

---

### Task 3.2: Create Chatbot Edit Modal

**Files:**
- Create: `src/features/chatbots/ChatbotEditModal.tsx`

**Step 1: Create modal**

```typescript
import React, { useState, useEffect } from 'react';
import { X, Loader2, Trash2, Bot } from 'lucide-react';
import { DbCommunityChatbot } from '../../core/supabase/database.types';
import { getRoleDefaults } from './chatbotService';

interface ChatbotEditModalProps {
  chatbot?: DbCommunityChatbot | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    role: 'qa' | 'motivation' | 'support';
    systemPrompt: string;
    personality: string;
    greetingMessage: string;
  }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const ROLE_OPTIONS = [
  { value: 'qa', label: 'Q&A Bot', icon: '🤖' },
  { value: 'motivation', label: 'Motivation Coach', icon: '💪' },
  { value: 'support', label: 'Tech Support', icon: '🛠️' },
];

export const ChatbotEditModal: React.FC<ChatbotEditModalProps> = ({
  chatbot,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'qa' | 'motivation' | 'support'>('qa');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [personality, setPersonality] = useState('');
  const [greetingMessage, setGreetingMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (chatbot) {
      setName(chatbot.name);
      setRole(chatbot.role as 'qa' | 'motivation' | 'support');
      setSystemPrompt(chatbot.system_prompt || '');
      setPersonality(chatbot.personality || '');
      setGreetingMessage(chatbot.greeting_message || '');
    } else {
      const defaults = getRoleDefaults('qa');
      setName('');
      setRole('qa');
      setSystemPrompt(defaults.systemPrompt);
      setPersonality(defaults.personality);
      setGreetingMessage(defaults.greeting);
    }
    setError(null);
  }, [chatbot, isOpen]);

  const handleRoleChange = (newRole: 'qa' | 'motivation' | 'support') => {
    setRole(newRole);
    if (!chatbot) {
      const defaults = getRoleDefaults(newRole);
      setSystemPrompt(defaults.systemPrompt);
      setPersonality(defaults.personality);
      setGreetingMessage(defaults.greeting);
    }
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        role,
        systemPrompt: systemPrompt.trim(),
        personality: personality.trim(),
        greetingMessage: greetingMessage.trim(),
      });
      onClose();
    } catch (err) {
      setError('Failed to save. Please try again.');
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold">
              {chatbot ? 'Edit Chatbot' : 'New Chatbot'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Bot Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="EFI Q&A Bot"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ROLE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleRoleChange(option.value as typeof role)}
                  className={`p-3 rounded-lg border text-center transition-colors ${
                    role === option.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{option.icon}</div>
                  <div className="text-xs font-medium">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Personality
            </label>
            <input
              type="text"
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Friendly and helpful"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              System Prompt
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Instructions for how the bot should behave..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Greeting Message
            </label>
            <textarea
              value={greetingMessage}
              onChange={(e) => setGreetingMessage(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="First message shown to students..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t bg-slate-50">
          <div>
            {chatbot && onDelete && (
              <button
                onClick={onDelete}
                className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium"
              >
                <Trash2 className="w-4 h-4 inline mr-1" />
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/features/chatbots/ChatbotEditModal.tsx
git commit -m "feat: add chatbot edit modal with role presets"
```

---

### Task 3.3: Create Chatbot Conversation Component

**Files:**
- Create: `src/features/chatbots/ChatbotConversation.tsx`

**Step 1: Create conversation component**

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { DbCommunityChatbot } from '../../core/supabase/database.types';
import { getConversation, saveConversation } from './chatbotService';
import { sendMentorMessage } from '../ai-manager/geminiService';
import { useAuth } from '../../core/auth/AuthContext';

interface ChatbotConversationProps {
  chatbot: DbCommunityChatbot;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

export const ChatbotConversation: React.FC<ChatbotConversationProps> = ({ chatbot }) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversation();
  }, [chatbot.id, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversation = async () => {
    if (!user) return;
    setIsLoading(true);
    const conversation = await getConversation(chatbot.id, user.id);
    if (conversation && conversation.messages) {
      setMessages(conversation.messages as Message[]);
    } else if (chatbot.greeting_message) {
      setMessages([{
        role: 'model',
        text: chatbot.greeting_message,
        timestamp: new Date().toISOString(),
      }]);
    }
    setIsLoading(false);
  };

  const handleSend = async () => {
    if (!input.trim() || !user || isSending) return;

    const userMessage: Message = {
      role: 'user',
      text: input.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsSending(true);

    try {
      // Build custom system instruction from chatbot config
      const systemInstruction = `${chatbot.system_prompt || ''}\n\nPersonality: ${chatbot.personality || 'Helpful'}`;

      const response = await sendMentorMessage(
        userMessage.text,
        messages.map(m => ({ role: m.role, text: m.text })),
        undefined,
        false,
        profile?.full_name || 'Student'
      );

      const botMessage: Message = {
        role: 'model',
        text: response,
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...updatedMessages, botMessage];
      setMessages(finalMessages);

      // Save conversation
      await saveConversation(chatbot.id, user.id, finalMessages);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    }

    setIsSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/features/chatbots/ChatbotConversation.tsx
git commit -m "feat: add chatbot conversation component with AI integration"
```

---

### Task 3.4: Create Main Chatbots Page

**Files:**
- Create: `src/features/chatbots/ChatbotsPage.tsx`

**Step 1: Create page with tabs**

```typescript
import React, { useState, useEffect } from 'react';
import { Bot, MessageCircle } from 'lucide-react';
import { DbCommunityChatbot } from '../../core/supabase/database.types';
import { getActiveChatbots } from './chatbotService';
import { ChatbotConversation } from './ChatbotConversation';

interface ChatbotsPageProps {
  communityId: string;
}

const ROLE_ICONS: Record<string, string> = {
  qa: '🤖',
  motivation: '💪',
  support: '🛠️',
};

export const ChatbotsPage: React.FC<ChatbotsPageProps> = ({ communityId }) => {
  const [chatbots, setChatbots] = useState<DbCommunityChatbot[]>([]);
  const [selectedChatbot, setSelectedChatbot] = useState<DbCommunityChatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChatbots();
  }, [communityId]);

  const loadChatbots = async () => {
    setIsLoading(true);
    const data = await getActiveChatbots(communityId);
    setChatbots(data);
    if (data.length > 0) {
      setSelectedChatbot(data[0]);
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (chatbots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <MessageCircle className="w-12 h-12 mb-4 text-slate-300" />
        <p>No AI chatbots available yet</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="bg-white border-b px-4">
        <div className="flex items-center gap-2 py-3">
          <Bot className="w-6 h-6 text-indigo-600" />
          <h1 className="text-lg font-semibold text-slate-900">AI Chat</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 -mb-px">
          {chatbots.map((bot) => (
            <button
              key={bot.id}
              onClick={() => setSelectedChatbot(bot)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                selectedChatbot?.id === bot.id
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{ROLE_ICONS[bot.role] || '🤖'}</span>
              {bot.name}
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-white overflow-hidden">
        {selectedChatbot && (
          <ChatbotConversation key={selectedChatbot.id} chatbot={selectedChatbot} />
        )}
      </div>
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/features/chatbots/ChatbotsPage.tsx
git commit -m "feat: add main chatbots page with tabbed navigation"
```

---

### Task 3.5: Create Chatbot Settings (Creator)

**Files:**
- Create: `src/features/chatbots/ChatbotSettings.tsx`

**Step 1: Create settings component**

```typescript
import React, { useState, useEffect } from 'react';
import { Plus, Bot, ToggleLeft, ToggleRight } from 'lucide-react';
import { DbCommunityChatbot } from '../../core/supabase/database.types';
import { getChatbots, createChatbot, updateChatbot, deleteChatbot } from './chatbotService';
import { ChatbotEditModal } from './ChatbotEditModal';

interface ChatbotSettingsProps {
  communityId: string;
}

const ROLE_ICONS: Record<string, string> = {
  qa: '🤖',
  motivation: '💪',
  support: '🛠️',
};

export const ChatbotSettings: React.FC<ChatbotSettingsProps> = ({ communityId }) => {
  const [chatbots, setChatbots] = useState<DbCommunityChatbot[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChatbot, setEditingChatbot] = useState<DbCommunityChatbot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChatbots();
  }, [communityId]);

  const loadChatbots = async () => {
    setIsLoading(true);
    const data = await getChatbots(communityId);
    setChatbots(data);
    setIsLoading(false);
  };

  const handleCreate = () => {
    setEditingChatbot(null);
    setIsModalOpen(true);
  };

  const handleEdit = (chatbot: DbCommunityChatbot) => {
    setEditingChatbot(chatbot);
    setIsModalOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    role: 'qa' | 'motivation' | 'support';
    systemPrompt: string;
    personality: string;
    greetingMessage: string;
  }) => {
    if (editingChatbot) {
      await updateChatbot(editingChatbot.id, {
        name: data.name,
        system_prompt: data.systemPrompt,
        personality: data.personality,
        greeting_message: data.greetingMessage,
      });
    } else {
      await createChatbot(
        communityId,
        data.name,
        data.role,
        data.systemPrompt,
        data.personality,
        data.greetingMessage
      );
    }
    await loadChatbots();
  };

  const handleDelete = async () => {
    if (!editingChatbot) return;
    await deleteChatbot(editingChatbot.id);
    setIsModalOpen(false);
    await loadChatbots();
  };

  const handleToggleActive = async (chatbot: DbCommunityChatbot) => {
    await updateChatbot(chatbot.id, { is_active: !chatbot.is_active });
    await loadChatbots();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold text-slate-900">AI Chatbots</h2>
        </div>
        {chatbots.length < 3 && (
          <button
            onClick={handleCreate}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Bot
          </button>
        )}
      </div>

      <div className="space-y-3">
        {chatbots.map((bot) => (
          <div
            key={bot.id}
            className="flex items-center justify-between p-4 bg-white border rounded-xl"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{ROLE_ICONS[bot.role]}</span>
              <div>
                <h3 className="font-medium text-slate-900">{bot.name}</h3>
                <p className="text-sm text-slate-500 capitalize">{bot.role} Bot</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleToggleActive(bot)}
                className={`flex items-center gap-1 text-sm ${
                  bot.is_active ? 'text-green-600' : 'text-slate-400'
                }`}
              >
                {bot.is_active ? (
                  <>
                    <ToggleRight className="w-5 h-5" />
                    Active
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-5 h-5" />
                    Inactive
                  </>
                )}
              </button>
              <button
                onClick={() => handleEdit(bot)}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Edit
              </button>
            </div>
          </div>
        ))}

        {chatbots.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <Bot className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>No chatbots configured</p>
            <p className="text-sm">Add up to 3 AI chatbots for your community</p>
          </div>
        )}
      </div>

      <ChatbotEditModal
        chatbot={editingChatbot}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        onDelete={editingChatbot ? handleDelete : undefined}
      />
    </div>
  );
};
```

**Step 2: Create index export**

Create `src/features/chatbots/index.ts`:

```typescript
export * from './chatbotService';
export * from './ChatbotsPage';
export * from './ChatbotSettings';
export * from './ChatbotEditModal';
export * from './ChatbotConversation';
```

**Step 3: Commit**

```bash
git add src/features/chatbots/
git commit -m "feat: add chatbot settings for creators"
```

---

## Phase 4: Integration

### Task 4.1: Add Navigation Items

**Files:**
- Modify: `src/core/constants.ts`
- Modify: `src/shared/Sidebar.tsx`

**Step 1: Add View enum values in constants.ts**

Find the `View` enum and add:

```typescript
export enum View {
  DASHBOARD = 'dashboard',
  COMMUNITY = 'community',
  COURSES = 'courses',
  CALENDAR = 'calendar',
  AI_MANAGER = 'ai_manager',
  HOMEWORK = 'homework',      // Add
  AI_CHAT = 'ai_chat',        // Add
  STUDENT_MANAGER = 'student_manager', // Add
}
```

**Step 2: Add NAV_ITEMS entries**

```typescript
export const NAV_ITEMS = [
  { id: View.DASHBOARD, label: 'Dashboard', icon: 'LayoutDashboard' },
  { id: View.COMMUNITY, label: 'Community', icon: 'Users' },
  { id: View.COURSES, label: 'Classroom', icon: 'GraduationCap' },
  { id: View.HOMEWORK, label: 'Homework', icon: 'ClipboardList' },  // Add
  { id: View.AI_CHAT, label: 'AI Chat', icon: 'Bot' },              // Add
  { id: View.CALENDAR, label: 'Calendar', icon: 'Calendar' },
  { id: View.AI_MANAGER, label: 'AI Success Manager', icon: 'BrainCircuit' },
];

// Creator-only nav items
export const CREATOR_NAV_ITEMS = [
  { id: View.STUDENT_MANAGER, label: 'Student Manager', icon: 'UserCog' }, // Add
];
```

**Step 3: Update Sidebar.tsx iconMap**

Add icons to the iconMap:

```typescript
const iconMap: Record<string, React.ReactNode> = {
  // ... existing icons
  ClipboardList: <ClipboardList className="w-5 h-5" />,
  Bot: <Bot className="w-5 h-5" />,
  UserCog: <UserCog className="w-5 h-5" />,
};
```

Add imports at top:

```typescript
import { ClipboardList, Bot, UserCog } from 'lucide-react';
```

**Step 4: Commit**

```bash
git add src/core/constants.ts src/shared/Sidebar.tsx
git commit -m "feat: add navigation items for homework, AI chat, and student manager"
```

---

### Task 4.2: Add Routes in App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Add imports**

```typescript
import { HomeworkPage, HomeworkManagement } from './features/homework';
import { ChatbotsPage, ChatbotSettings } from './features/chatbots';
import { StudentManagerPage } from './features/student-manager';
```

**Step 2: Add route cases in the main switch**

Find the view rendering switch and add cases:

```typescript
case View.HOMEWORK:
  return isCreator ? (
    <HomeworkManagement
      communityId={selectedCommunity.id}
      creatorProfileId={profile.id}
    />
  ) : (
    <HomeworkPage communityId={selectedCommunity.id} />
  );

case View.AI_CHAT:
  return <ChatbotsPage communityId={selectedCommunity.id} />;

case View.STUDENT_MANAGER:
  return isCreator ? (
    <StudentManagerPage communityId={selectedCommunity.id} />
  ) : null;
```

**Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add routes for homework, AI chat, and student manager"
```

---

### Task 4.3: Create Student Manager Page

**Files:**
- Create: `src/features/student-manager/StudentManagerPage.tsx`
- Create: `src/features/student-manager/studentManagerService.ts`
- Create: `src/features/student-manager/index.ts`

**Step 1: Create service**

```typescript
// studentManagerService.ts
import { supabase } from '../../core/supabase/client';
import { DbProfile, DbPoints } from '../../core/supabase/database.types';
import { awardPoints } from '../community/pointsService';

export interface StudentWithStats {
  profile: DbProfile;
  points: DbPoints | null;
  submissionCount: number;
  gradedCount: number;
}

export async function getStudentsWithStats(communityId: string): Promise<StudentWithStats[]> {
  // Get all members of community
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select(`
      user_id,
      profiles!inner(*)
    `)
    .eq('community_id', communityId);

  if (error || !memberships) {
    console.error('Error fetching members:', error);
    return [];
  }

  const students = await Promise.all(
    memberships.map(async (m: any) => {
      // Get points
      const { data: points } = await supabase
        .from('points')
        .select('*')
        .eq('user_id', m.profiles.id)
        .eq('community_id', communityId)
        .single();

      // Get submission counts
      const { count: submissionCount } = await supabase
        .from('homework_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', m.user_id);

      const { count: gradedCount } = await supabase
        .from('homework_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', m.user_id)
        .eq('status', 'graded');

      return {
        profile: m.profiles,
        points,
        submissionCount: submissionCount || 0,
        gradedCount: gradedCount || 0,
      };
    })
  );

  return students;
}

export async function addBonusPoints(
  profileId: string,
  communityId: string,
  points: number,
  reason: string
): Promise<boolean> {
  const result = await awardPoints(profileId, communityId, points, reason);
  return result !== null;
}
```

**Step 2: Create page component**

```typescript
// StudentManagerPage.tsx
import React, { useState, useEffect } from 'react';
import { Users, Award, Search } from 'lucide-react';
import { getStudentsWithStats, StudentWithStats, addBonusPoints } from './studentManagerService';

interface StudentManagerPageProps {
  communityId: string;
}

export const StudentManagerPage: React.FC<StudentManagerPageProps> = ({ communityId }) => {
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [bonusModal, setBonusModal] = useState<{ student: StudentWithStats } | null>(null);
  const [bonusPoints, setBonusPoints] = useState(5);
  const [bonusReason, setBonusReason] = useState('');

  useEffect(() => {
    loadStudents();
  }, [communityId]);

  const loadStudents = async () => {
    setIsLoading(true);
    const data = await getStudentsWithStats(communityId);
    setStudents(data);
    setIsLoading(false);
  };

  const handleAddBonus = async () => {
    if (!bonusModal) return;
    await addBonusPoints(
      bonusModal.student.profile.id,
      communityId,
      bonusPoints,
      bonusReason || 'Bonus points'
    );
    setBonusModal(null);
    setBonusPoints(5);
    setBonusReason('');
    await loadStudents();
  };

  const filteredStudents = students.filter((s) =>
    s.profile.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900">Student Manager</h1>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Student</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Points</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Level</th>
              <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Submissions</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredStudents.map((student) => (
              <tr key={student.profile.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-sm font-medium text-indigo-600">
                        {student.profile.full_name?.[0] || '?'}
                      </span>
                    </div>
                    <span className="font-medium text-slate-900">
                      {student.profile.full_name || 'Unknown'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-semibold text-indigo-600">
                    {student.points?.total_points || 0}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                    Lvl {student.points?.level || 1}
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-sm text-slate-600">
                  {student.gradedCount}/{student.submissionCount}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setBonusModal({ student })}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg ml-auto"
                  >
                    <Award className="w-4 h-4" />
                    Bonus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bonus Points Modal */}
      {bonusModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">
              Award Bonus to {bonusModal.student.profile.full_name}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Points (1-10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={bonusPoints}
                  onChange={(e) => setBonusPoints(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Reason (optional)
                </label>
                <input
                  type="text"
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Great participation!"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setBonusModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBonus}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Award {bonusPoints} Points
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
```

**Step 3: Create index**

```typescript
// index.ts
export * from './StudentManagerPage';
export * from './studentManagerService';
```

**Step 4: Commit**

```bash
git add src/features/student-manager/
git commit -m "feat: add student manager page with bonus points"
```

---

### Task 4.4: Create Supabase Storage Bucket

**Step 1: In Supabase Dashboard**

1. Go to Storage
2. Create bucket `homework-files`
3. Set to public
4. Add RLS policy: authenticated users can upload

**Step 2: Verify storage works**

Test upload from the app.

---

### Task 4.5: Final Integration Test

**Step 1: Test homework flow**

1. Creator creates assignment
2. Creator publishes assignment
3. Student sees assignment
4. Student submits with text + file
5. Creator sees in queue
6. Creator grades (0-10 points)
7. Student sees grade + feedback
8. Points appear in leaderboard

**Step 2: Test chatbot flow**

1. Creator creates chatbot (Q&A)
2. Creator sets custom prompt
3. Student opens AI Chat
4. Student sends message
5. Bot responds with personality
6. Conversation persists

**Step 3: Test student manager**

1. Creator views student list
2. Creator awards bonus points
3. Student points update

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete EFI features - homework, chatbots, student manager"
```

---

## Summary

| Phase | Tasks | Est. Steps |
|-------|-------|------------|
| 1. Database | Types + Migration | 6 |
| 2. Homework | Service + 5 components | 30 |
| 3. Chatbots | Service + 4 components | 25 |
| 4. Integration | Nav + Routes + Student Manager | 20 |

**Total: ~80 steps**

**Key files created:**
- `src/features/homework/*` (7 files)
- `src/features/chatbots/*` (6 files)
- `src/features/student-manager/*` (3 files)
- `supabase/migrations/20250128_efi_features.sql`
