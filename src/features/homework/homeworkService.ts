import { supabase } from '../../core/supabase/client';
import {
  DbHomeworkAssignment,
  DbHomeworkSubmission,
  DbHomeworkAssignmentWithStats,
  DbHomeworkSubmissionWithStudent,
  DbProfile,
} from '../../core/supabase/database.types';
import { awardPoints } from '../community/pointsService';

// ============================================================================
// HOMEWORK ASSIGNMENTS - CRUD Operations
// ============================================================================

/**
 * Creates a new homework assignment
 * @param communityId - The community's ID
 * @param creatorId - The creator's profile ID
 * @param title - Assignment title
 * @param description - Optional assignment description
 * @param maxPoints - Optional maximum points (default: 100)
 * @param dueDate - Optional due date
 * @returns The created assignment or null if failed
 */
export async function createAssignment(
  communityId: string,
  creatorId: string,
  title: string,
  description?: string,
  maxPoints?: number,
  dueDate?: string
): Promise<DbHomeworkAssignment | null> {
  const { data, error } = await supabase
    .from('homework_assignments')
    .insert({
      community_id: communityId,
      creator_id: creatorId,
      title,
      description: description || null,
      max_points: maxPoints ?? 100,
      due_date: dueDate || null,
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

/**
 * Gets all assignments for a community with submission stats
 * @param communityId - The community's ID
 * @param includeUnpublished - Whether to include unpublished assignments (default: false)
 * @returns Array of assignments with stats
 */
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

  const { data: assignments, error } = await query;

  if (error) {
    console.error('Error fetching assignments:', error);
    return [];
  }

  if (!assignments || assignments.length === 0) {
    return [];
  }

  // Get submission counts for each assignment
  const assignmentIds = assignments.map((a) => a.id);
  const { data: submissions, error: submissionsError } = await supabase
    .from('homework_submissions')
    .select('assignment_id, status')
    .in('assignment_id', assignmentIds);

  if (submissionsError) {
    console.error('Error fetching submission stats:', submissionsError);
    // Return assignments without stats
    return assignments.map((a) => ({
      ...a,
      total_submissions: 0,
      pending_count: 0,
    }));
  }

  // Calculate stats for each assignment
  const statsMap = new Map<string, { total: number; pending: number }>();
  assignmentIds.forEach((id) => statsMap.set(id, { total: 0, pending: 0 }));

  (submissions || []).forEach((sub) => {
    const stats = statsMap.get(sub.assignment_id);
    if (stats) {
      stats.total++;
      if (sub.status === 'pending') {
        stats.pending++;
      }
    }
  });

  return assignments.map((a) => ({
    ...a,
    total_submissions: statsMap.get(a.id)?.total || 0,
    pending_count: statsMap.get(a.id)?.pending || 0,
  }));
}

/**
 * Updates an existing assignment
 * @param assignmentId - The assignment's ID
 * @param updates - Partial assignment updates
 * @returns The updated assignment or null if failed
 */
export async function updateAssignment(
  assignmentId: string,
  updates: Partial<Pick<DbHomeworkAssignment, 'title' | 'description' | 'max_points' | 'due_date' | 'is_published'>>
): Promise<DbHomeworkAssignment | null> {
  const { data, error } = await supabase
    .from('homework_assignments')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', assignmentId)
    .select()
    .single();

  if (error) {
    console.error('Error updating assignment:', error);
    return null;
  }

  return data;
}

/**
 * Deletes an assignment (and all related submissions via cascade)
 * @param assignmentId - The assignment's ID
 * @returns True if deleted successfully, false otherwise
 */
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

// ============================================================================
// HOMEWORK SUBMISSIONS
// ============================================================================

/**
 * Submits homework for an assignment
 * @param assignmentId - The assignment's ID
 * @param studentId - The student's profile ID
 * @param textResponse - Optional text response
 * @param fileUrls - Optional array of file URLs
 * @returns The created submission or null if failed
 */
export async function submitHomework(
  assignmentId: string,
  studentId: string,
  textResponse?: string,
  fileUrls?: string[]
): Promise<DbHomeworkSubmission | null> {
  // Check if student already submitted
  const { data: existing, error: existingError } = await supabase
    .from('homework_submissions')
    .select('id')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .single();

  if (existing && !existingError) {
    console.error('Student has already submitted this assignment');
    return null;
  }

  const { data, error } = await supabase
    .from('homework_submissions')
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      text_response: textResponse || null,
      file_urls: fileUrls || [],
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

/**
 * Gets all submissions for an assignment with student profile
 * @param assignmentId - The assignment's ID
 * @returns Array of submissions with student info
 */
export async function getSubmissionsForAssignment(
  assignmentId: string
): Promise<DbHomeworkSubmissionWithStudent[]> {
  // First, fetch submissions
  const { data: submissions, error: submissionsError } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .order('submitted_at', { ascending: false });

  if (submissionsError) {
    console.error('Error fetching submissions:', submissionsError);
    return [];
  }

  if (!submissions || submissions.length === 0) {
    return [];
  }

  // Get unique student IDs (these are profile.id values, NOT auth user IDs)
  const studentIds = [...new Set(submissions.map((s) => s.student_id))];

  // Fetch profiles by their primary key (id), not user_id
  // student_id in homework_submissions references profiles.id
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, user_id, full_name, avatar_url, email, role')
    .in('id', studentIds);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
  }

  // Create a map of profile.id to profile
  const profileMap = new Map(
    (profiles || []).map((p) => [p.id, p])
  );

  // Combine submissions with student profiles
  return submissions.map((sub) => ({
    ...sub,
    student: profileMap.get(sub.student_id) as DbProfile | undefined,
  })) as DbHomeworkSubmissionWithStudent[];
}

/**
 * Gets all submissions by a student in a community with assignment info
 * @param studentId - The student's profile ID
 * @param communityId - The community's ID
 * @returns Array of submissions with assignment info
 */
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
    .eq('student_id', studentId);

  if (error) {
    console.error('Error fetching student submissions:', error);
    return [];
  }

  // Filter by community and transform
  return (data || [])
    .filter((sub) => {
      const assignment = sub.assignment as unknown as DbHomeworkAssignment;
      return assignment && assignment.community_id === communityId;
    })
    .map((sub) => ({
      ...sub,
      assignment: sub.assignment as unknown as DbHomeworkAssignment,
    }));
}

/**
 * Grades a submission and awards points to the student
 * @param submissionId - The submission's ID
 * @param pointsAwarded - Points to award
 * @param feedback - Optional feedback text
 * @param graderId - The grader's profile ID
 * @param studentProfileId - The student's profile ID (for awarding points)
 * @param communityId - The community's ID (for awarding points)
 * @returns The updated submission or null if failed
 */
export async function gradeSubmission(
  submissionId: string,
  pointsAwarded: number,
  feedback: string | null,
  graderId: string,
  studentProfileId: string,
  communityId: string
): Promise<DbHomeworkSubmission | null> {
  // Update the submission
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

  // Award points to the student
  if (pointsAwarded > 0) {
    await awardPoints(
      studentProfileId,
      communityId,
      pointsAwarded,
      `Homework graded: ${pointsAwarded} points`
    );
  }

  return data;
}

// ============================================================================
// FILE UPLOAD
// ============================================================================

/**
 * Uploads a homework file to storage
 * @param assignmentId - The assignment's ID
 * @param studentId - The student's profile ID
 * @param file - The file to upload
 * @returns The public URL of the uploaded file or null if failed
 */
export async function uploadHomeworkFile(
  assignmentId: string,
  studentId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${assignmentId}/${studentId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('homework-files')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('homework-files')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Gets a single assignment by ID
 * @param assignmentId - The assignment's ID
 * @returns The assignment or null if not found
 */
export async function getAssignmentById(
  assignmentId: string
): Promise<DbHomeworkAssignment | null> {
  const { data, error } = await supabase
    .from('homework_assignments')
    .select('*')
    .eq('id', assignmentId)
    .single();

  if (error) {
    console.error('Error fetching assignment:', error);
    return null;
  }

  return data;
}

/**
 * Gets a student's submission for a specific assignment
 * @param assignmentId - The assignment's ID
 * @param studentId - The student's profile ID
 * @returns The submission or null if not found
 */
export async function getStudentSubmissionForAssignment(
  assignmentId: string,
  studentId: string
): Promise<DbHomeworkSubmission | null> {
  const { data, error } = await supabase
    .from('homework_submissions')
    .select('*')
    .eq('assignment_id', assignmentId)
    .eq('student_id', studentId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching submission:', error);
  }

  return data || null;
}
