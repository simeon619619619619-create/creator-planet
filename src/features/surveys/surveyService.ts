// =============================================================================
// SURVEY SERVICE
// Database operations for surveys feature
// =============================================================================

import { supabase } from '../../core/supabase/client';
import type {
  Survey,
  SurveySection,
  SurveyQuestion,
  SurveyResponse,
  SurveyAnswer,
  SurveyWithDetails,
  SurveyResponseWithDetails,
  SurveyFormData,
  SectionFormData,
  QuestionFormData,
  AnswerFormData,
  SurveyExportRow,
  PendingSurvey,
} from './surveyTypes';

// =============================================================================
// SURVEY CRUD
// =============================================================================

/**
 * Get all surveys for a creator
 */
export async function getCreatorSurveys(creatorId: string): Promise<SurveyWithDetails[]> {
  const { data, error } = await supabase
    .from('surveys')
    .select(`
      *,
      sections:survey_sections(*, questions:survey_questions(*)),
      questions:survey_questions(*),
      attached_course:courses!attached_course_id(id, title),
      community:communities!community_id(id, name)
    `)
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Get response counts
  const surveysWithCounts = await Promise.all(
    (data || []).map(async (survey) => {
      const { count } = await supabase
        .from('survey_responses')
        .select('*', { count: 'exact', head: true })
        .eq('survey_id', survey.id)
        .eq('is_complete', true);

      return {
        ...survey,
        response_count: count || 0,
      };
    })
  );

  return surveysWithCounts as SurveyWithDetails[];
}

/**
 * Get a single survey with all details
 */
export async function getSurvey(surveyId: string): Promise<SurveyWithDetails | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select(`
      *,
      sections:survey_sections(*),
      questions:survey_questions(*),
      attached_course:courses!attached_course_id(id, title),
      community:communities!community_id(id, name)
    `)
    .eq('id', surveyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  // Sort sections and questions
  const survey = data as SurveyWithDetails;
  survey.sections = (survey.sections || []).sort((a, b) => a.sort_order - b.sort_order);
  survey.questions = (survey.questions || []).sort((a, b) => a.sort_order - b.sort_order);

  return survey;
}

/**
 * Create a new survey
 */
export async function createSurvey(
  creatorId: string,
  formData: SurveyFormData
): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .insert({
      creator_id: creatorId,
      title: formData.title,
      description: formData.description || null,
      attachment_type: formData.attachment_type,
      attached_course_id: formData.attached_course_id,
      community_id: formData.community_id,
      is_required: formData.is_required,
      allow_edit: formData.allow_edit,
      is_published: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a survey
 */
export async function updateSurvey(
  surveyId: string,
  formData: Partial<SurveyFormData & { is_published: boolean }>
): Promise<Survey> {
  const { data, error } = await supabase
    .from('surveys')
    .update({
      ...formData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', surveyId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a survey
 */
export async function deleteSurvey(surveyId: string): Promise<void> {
  const { error } = await supabase.from('surveys').delete().eq('id', surveyId);
  if (error) throw error;
}

// =============================================================================
// SECTION CRUD
// =============================================================================

/**
 * Create a new section
 */
export async function createSection(
  surveyId: string,
  formData: SectionFormData,
  sortOrder: number
): Promise<SurveySection> {
  const { data, error } = await supabase
    .from('survey_sections')
    .insert({
      survey_id: surveyId,
      title: formData.title,
      description: formData.description || null,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a section
 */
export async function updateSection(
  sectionId: string,
  formData: Partial<SectionFormData & { sort_order: number }>
): Promise<SurveySection> {
  const { data, error } = await supabase
    .from('survey_sections')
    .update(formData)
    .eq('id', sectionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a section
 */
export async function deleteSection(sectionId: string): Promise<void> {
  const { error } = await supabase.from('survey_sections').delete().eq('id', sectionId);
  if (error) throw error;
}

// =============================================================================
// QUESTION CRUD
// =============================================================================

/**
 * Create a new question
 */
export async function createQuestion(
  surveyId: string,
  formData: QuestionFormData,
  sortOrder: number
): Promise<SurveyQuestion> {
  const { data, error } = await supabase
    .from('survey_questions')
    .insert({
      survey_id: surveyId,
      section_id: formData.section_id,
      question_text: formData.question_text,
      question_type: formData.question_type,
      options: formData.options.length > 0 ? formData.options : null,
      is_required: formData.is_required,
      allow_other: formData.allow_other,
      placeholder: formData.placeholder || null,
      min_value: formData.min_value,
      max_value: formData.max_value,
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a question
 */
export async function updateQuestion(
  questionId: string,
  formData: Partial<QuestionFormData & { sort_order: number }>
): Promise<SurveyQuestion> {
  const updateData: Record<string, unknown> = { ...formData };
  if (formData.options !== undefined) {
    updateData.options = formData.options.length > 0 ? formData.options : null;
  }

  const { data, error } = await supabase
    .from('survey_questions')
    .update(updateData)
    .eq('id', questionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a question
 */
export async function deleteQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.from('survey_questions').delete().eq('id', questionId);
  if (error) throw error;
}

/**
 * Reorder questions
 */
export async function reorderQuestions(
  questions: { id: string; sort_order: number }[]
): Promise<void> {
  const updates = questions.map(({ id, sort_order }) =>
    supabase.from('survey_questions').update({ sort_order }).eq('id', id)
  );

  await Promise.all(updates);
}

// =============================================================================
// RESPONSE & ANSWER MANAGEMENT
// =============================================================================

/**
 * Get or create a response for a student
 */
export async function getOrCreateResponse(
  surveyId: string,
  studentId: string
): Promise<SurveyResponse> {
  // Try to get existing response
  const { data: existing } = await supabase
    .from('survey_responses')
    .select('*')
    .eq('survey_id', surveyId)
    .eq('student_id', studentId)
    .single();

  if (existing) return existing;

  // Create new response
  const { data, error } = await supabase
    .from('survey_responses')
    .insert({
      survey_id: surveyId,
      student_id: studentId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Save an answer
 */
export async function saveAnswer(
  responseId: string,
  answerData: AnswerFormData
): Promise<SurveyAnswer> {
  const { data, error } = await supabase
    .from('survey_answers')
    .upsert(
      {
        response_id: responseId,
        question_id: answerData.question_id,
        answer_value: answerData.answer_value,
        other_value: answerData.other_value,
      },
      {
        onConflict: 'response_id,question_id',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Submit a completed response
 */
export async function submitResponse(responseId: string): Promise<SurveyResponse> {
  const { data, error } = await supabase
    .from('survey_responses')
    .update({
      is_complete: true,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', responseId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all responses for a survey (creator view)
 */
export async function getSurveyResponses(
  surveyId: string
): Promise<SurveyResponseWithDetails[]> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select(`
      *,
      student:profiles!student_id(id, full_name, avatar_url),
      answers:survey_answers(*)
    `)
    .eq('survey_id', surveyId)
    .eq('is_complete', true)
    .order('submitted_at', { ascending: false });

  if (error) throw error;
  return (data || []) as SurveyResponseWithDetails[];
}

/**
 * Get a student's response with answers
 */
export async function getStudentResponse(
  surveyId: string,
  studentId: string
): Promise<SurveyResponseWithDetails | null> {
  const { data, error } = await supabase
    .from('survey_responses')
    .select(`
      *,
      student:profiles!student_id(id, full_name, avatar_url),
      answers:survey_answers(*)
    `)
    .eq('survey_id', surveyId)
    .eq('student_id', studentId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as SurveyResponseWithDetails;
}

// =============================================================================
// CSV EXPORT
// =============================================================================

/**
 * Export survey responses to CSV format
 */
export async function exportSurveyResponses(surveyId: string): Promise<string> {
  // Get survey with questions
  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error('Survey not found');

  // Get all responses
  const responses = await getSurveyResponses(surveyId);

  // Build CSV headers
  const headers = [
    'Student Name',
    'Submitted At',
    ...survey.questions.map((q) => q.question_text),
  ];

  // Build CSV rows
  const rows: SurveyExportRow[] = responses.map((response) => {
    const row: SurveyExportRow = {
      student_name: response.student.full_name,
      student_email: '', // Not included in query for privacy
      submitted_at: response.submitted_at
        ? new Date(response.submitted_at).toLocaleString()
        : '',
    };

    // Add answers for each question
    survey.questions.forEach((question) => {
      const answer = response.answers.find((a) => a.question_id === question.id);
      if (answer) {
        const value = answer.answer_value;
        if (Array.isArray(value)) {
          row[question.question_text] = value.join(', ');
        } else {
          row[question.question_text] = String(value);
        }
        if (answer.other_value) {
          row[question.question_text] += ` (Other: ${answer.other_value})`;
        }
      } else {
        row[question.question_text] = '';
      }
    });

    return row;
  });

  // Convert to CSV string
  const escapeCsvValue = (val: string): string => {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const csvLines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) =>
      [
        row.student_name,
        row.submitted_at,
        ...survey.questions.map((q) => row[q.question_text] || ''),
      ]
        .map(escapeCsvValue)
        .join(',')
    ),
  ];

  return csvLines.join('\n');
}

/**
 * Download CSV file
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a student has completed a required survey
 */
export async function hasCompletedSurvey(
  surveyId: string,
  studentId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('survey_responses')
    .select('is_complete')
    .eq('survey_id', surveyId)
    .eq('student_id', studentId)
    .eq('is_complete', true)
    .single();

  return !!data;
}

/**
 * Get intake survey for a course
 */
export async function getCourseIntakeSurvey(courseId: string): Promise<Survey | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('attached_course_id', courseId)
    .eq('attachment_type', 'course_intake')
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

/**
 * Get intake survey for a community
 */
export async function getCommunityIntakeSurvey(communityId: string): Promise<Survey | null> {
  const { data, error } = await supabase
    .from('surveys')
    .select('*')
    .eq('community_id', communityId)
    .eq('attachment_type', 'community_intake')
    .eq('is_published', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

// =============================================================================
// SEND SURVEY TO MEMBERS
// =============================================================================

/**
 * Member info for survey sending
 */
export interface SurveyMemberInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
  hasResponse: boolean;
}

/**
 * Get community members who can receive a survey
 * Returns members who don't have a survey_response for this survey yet
 */
export async function getCommunityMembersForSurvey(
  communityId: string,
  surveyId: string
): Promise<SurveyMemberInfo[]> {
  // Get all community members with their profile info
  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships')
    .select(`
      user_id,
      profile:profiles!user_id(id, full_name, avatar_url)
    `)
    .eq('community_id', communityId);

  if (membershipsError) throw membershipsError;

  // Get existing survey responses for this survey
  const { data: existingResponses, error: responsesError } = await supabase
    .from('survey_responses')
    .select('student_id')
    .eq('survey_id', surveyId);

  if (responsesError) throw responsesError;

  // Create a set of student IDs who already have responses
  const respondedStudentIds = new Set(
    (existingResponses || []).map((r) => r.student_id)
  );

  // Map memberships to member info, marking who has already responded
  return (memberships || [])
    .filter((m: any) => m.profile) // Filter out any without profile
    .map((m: any) => ({
      id: m.profile.id,
      full_name: m.profile.full_name || 'Unknown',
      avatar_url: m.profile.avatar_url,
      hasResponse: respondedStudentIds.has(m.profile.id),
    }));
}

/**
 * Send a survey to selected members
 * Creates survey_response records with is_complete=false for each member
 * Skips members who already have a response (prevents duplicates)
 */
export async function sendSurveyToMembers(
  surveyId: string,
  memberIds: string[]
): Promise<{ sent: number; skipped: number }> {
  if (memberIds.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  // First check which members already have responses
  const { data: existingResponses, error: checkError } = await supabase
    .from('survey_responses')
    .select('student_id')
    .eq('survey_id', surveyId)
    .in('student_id', memberIds);

  if (checkError) throw checkError;

  const existingStudentIds = new Set(
    (existingResponses || []).map((r) => r.student_id)
  );

  // Filter out members who already have responses
  const newMemberIds = memberIds.filter((id) => !existingStudentIds.has(id));

  if (newMemberIds.length === 0) {
    return { sent: 0, skipped: memberIds.length };
  }

  // Create survey_response records for new members
  const responseRecords = newMemberIds.map((studentId) => ({
    survey_id: surveyId,
    student_id: studentId,
    is_complete: false,
  }));

  const { error: insertError } = await supabase
    .from('survey_responses')
    .insert(responseRecords);

  if (insertError) throw insertError;

  return {
    sent: newMemberIds.length,
    skipped: memberIds.length - newMemberIds.length,
  };
}

// =============================================================================
// STUDENT PENDING SURVEYS
// =============================================================================

/**
 * Get pending (incomplete) surveys for a student in a specific community
 * Used to show banner prompting students to complete surveys
 */
export async function getStudentPendingSurveysForCommunity(
  studentId: string,
  communityId: string
): Promise<PendingSurvey[]> {
  // Query survey_responses where student has incomplete responses
  // and join with surveys that belong to this community
  const { data, error } = await supabase
    .from('survey_responses')
    .select(`
      id,
      survey_id,
      created_at,
      survey:surveys!survey_id(
        id,
        title,
        description,
        community_id,
        community:communities!community_id(id, name)
      )
    `)
    .eq('student_id', studentId)
    .eq('is_complete', false);

  if (error) throw error;

  // Filter to only surveys for this community and map to PendingSurvey type
  const pendingSurveys: PendingSurvey[] = (data || [])
    .filter((r: any) => r.survey?.community_id === communityId)
    .map((r: any) => ({
      id: r.id,
      survey_id: r.survey_id,
      survey_title: r.survey?.title || 'Untitled Survey',
      survey_description: r.survey?.description || null,
      community_id: r.survey?.community_id || null,
      community_name: r.survey?.community?.name || null,
      created_at: r.created_at,
    }));

  return pendingSurveys;
}

/**
 * Get all pending surveys for a student (across all communities)
 * Used for the student dashboard widget
 */
export async function getStudentPendingSurveys(studentId: string): Promise<PendingSurvey[]> {
  // Fetch pending survey responses and the student's active memberships in parallel
  const [responsesResult, membershipsResult] = await Promise.all([
    supabase
      .from('survey_responses')
      .select(`
        id,
        survey_id,
        created_at,
        survey:surveys!survey_id(
          id,
          title,
          description,
          community_id,
          community:communities!community_id(id, name)
        )
      `)
      .eq('student_id', studentId)
      .eq('is_complete', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('memberships')
      .select('community_id')
      .eq('user_id', studentId),
  ]);

  if (responsesResult.error) throw responsesResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const memberCommunityIds = new Set(
    (membershipsResult.data ?? []).map((m: any) => m.community_id)
  );

  // Only show surveys for communities the student is a member of
  return (responsesResult.data || [])
    .filter((r: any) => r.survey?.community_id && memberCommunityIds.has(r.survey.community_id))
    .map((r: any) => ({
      id: r.id,
      survey_id: r.survey_id,
      survey_title: r.survey?.title || 'Untitled Survey',
      survey_description: r.survey?.description || null,
      community_id: r.survey?.community_id || null,
      community_name: r.survey?.community?.name || null,
      created_at: r.created_at,
    }));
}
