// =============================================================================
// SURVEY TYPES
// Type definitions for the surveys feature
// =============================================================================

export type SurveyQuestionType =
  | 'text'           // Free text input
  | 'single_choice'  // Radio buttons (one answer)
  | 'multi_choice'   // Checkboxes (multiple answers)
  | 'number'         // Numeric input
  | 'scale';         // 1-10 rating scale

export type SurveyAttachmentType =
  | 'standalone'       // Independent survey
  | 'course_intake'    // Required before course access
  | 'community_intake'; // Required when joining community

// =============================================================================
// Database Types
// =============================================================================

export interface Survey {
  id: string;
  creator_id: string;
  community_id: string | null;
  title: string;
  description: string | null;
  attachment_type: SurveyAttachmentType;
  attached_course_id: string | null;
  is_published: boolean;
  is_required: boolean;
  allow_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface SurveySection {
  id: string;
  survey_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  created_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  section_id: string | null;
  question_text: string;
  question_type: SurveyQuestionType;
  options: string[] | null;
  is_required: boolean;
  allow_other: boolean;
  placeholder: string | null;
  min_value: number | null;
  max_value: number | null;
  sort_order: number;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  student_id: string;
  is_complete: boolean;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyAnswer {
  id: string;
  response_id: string;
  question_id: string;
  answer_value: string | string[]; // Depends on question type
  other_value: string | null;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// Extended Types (with joins)
// =============================================================================

export interface SurveyWithDetails extends Survey {
  sections: SurveySection[];
  questions: SurveyQuestion[];
  response_count?: number;
  attached_course?: {
    id: string;
    title: string;
  } | null;
  community?: {
    id: string;
    name: string;
  } | null;
}

export interface SurveyResponseWithDetails extends SurveyResponse {
  student: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email?: string;
  };
  answers: SurveyAnswer[];
}

// =============================================================================
// Form Types (for creating/editing)
// =============================================================================

export interface SurveyFormData {
  title: string;
  description: string;
  attachment_type: SurveyAttachmentType;
  attached_course_id: string | null;
  community_id: string | null;
  is_required: boolean;
  allow_edit: boolean;
}

export interface SectionFormData {
  title: string;
  description: string;
}

export interface QuestionFormData {
  question_text: string;
  question_type: SurveyQuestionType;
  section_id: string | null;
  options: string[];
  is_required: boolean;
  allow_other: boolean;
  placeholder: string;
  min_value: number | null;
  max_value: number | null;
}

export interface AnswerFormData {
  question_id: string;
  answer_value: string | string[];
  other_value: string | null;
}

// =============================================================================
// CSV Export Types
// =============================================================================

export interface SurveyExportRow {
  student_name: string;
  student_email: string;
  submitted_at: string;
  [questionKey: string]: string; // Dynamic columns for each question
}

// =============================================================================
// Pending Survey Types (for student dashboard widget)
// =============================================================================

export interface PendingSurvey {
  id: string;           // survey_response id
  survey_id: string;
  survey_title: string;
  survey_description: string | null;
  community_id: string | null;
  community_name: string | null;
  created_at: string;   // when the survey was sent to the student
}
