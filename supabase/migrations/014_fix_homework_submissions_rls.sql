-- Fix homework_submissions RLS policy for student_id
-- Migration: 014_fix_homework_submissions_rls.sql
-- Created: 2026-01-04
--
-- Problem: The "Students can manage own submissions" policy incorrectly
-- compares student_id to auth.uid(), but student_id actually stores
-- profile.id (which differs from auth.uid() for most users).
--
-- This caused homework submissions to fail for students whose
-- profile.id != auth.uid(), and prevented them from viewing their submissions.

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Students can manage own submissions" ON homework_submissions;

-- Create the corrected policy that properly looks up profile.id
CREATE POLICY "Students can manage own submissions" ON homework_submissions
  FOR ALL USING (
    student_id = (
      SELECT p.id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );
