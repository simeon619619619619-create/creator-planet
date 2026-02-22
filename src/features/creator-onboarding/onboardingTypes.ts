// Types for creator onboarding flow

export type NicheOption =
  | 'fitness'
  | 'business'
  | 'design'
  | 'tech'
  | 'personal_development'
  | 'lifestyle'
  | 'other';

export type StageOption =
  | 'idea_stage'
  | 'side_hustle'
  | 'going_fulltime'
  | 'established';

export type AudienceSizeOption =
  | '0_100'
  | '100_1000'
  | '1000_10000'
  | '10000_plus';

export type PainPointOption =
  | 'too_many_tools'
  | 'losing_students'
  | 'no_time'
  | 'tech_overwhelm'
  | 'hard_to_track'
  | 'other';

export type GoalOption =
  | 'launch_course'
  | 'build_community'
  | 'scale_business'
  | 'automate'
  | 'increase_success';

export type ToolOption =
  | 'none'
  | 'discord'
  | 'kajabi'
  | 'skool'
  | 'calendly'
  | 'circle'
  | 'notion'
  | 'other';

export type RevenueGoalOption =
  | 'under_1k'
  | '1k_5k'
  | '5k_10k'
  | '10k_25k'
  | '25k_plus';

export interface OnboardingAnswers {
  niche: NicheOption | null;
  nicheOther: string | null;
  stage: StageOption | null;
  audienceSize: AudienceSizeOption | null;
  painPoint: PainPointOption | null;
  painPointOther: string | null;
  goal: GoalOption | null;
  currentTools: ToolOption[];
  revenueGoal: RevenueGoalOption | null;
}

export interface OnboardingSession {
  sessionId: string;
  startedAt: string;
  answers: OnboardingAnswers;
  completedAt: string | null;
}

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

export interface OnboardingQuestion {
  id: keyof OnboardingAnswers;
  title: string;
  subtitle?: string;
  type: 'single' | 'multi' | 'text';
  options: QuestionOption[];
  allowOther?: boolean;
  otherFieldId?: keyof OnboardingAnswers;
}

export type OnboardingStep =
  | 'questions'
  | 'preview'
  | 'summary'
  | 'signup';
