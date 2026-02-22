// =============================================================================
// Student Onboarding Questions
// Question definitions and helper functions for student onboarding flow
// =============================================================================

import type {
  StudentOnboardingAnswers,
  InterestOption,
  GoalOption,
  ExperienceOption,
  LearningStyleOption,
  TimeCommitmentOption,
  ChallengeOption,
} from './studentOnboardingTypes';

// =============================================================================
// Question Type (matches creator onboarding structure)
// =============================================================================

export interface StudentOnboardingQuestion {
  id: string;
  title: string;
  subtitle?: string;
  type: 'single' | 'multi' | 'text';
  options: Array<{
    value: string;
    label: string;
    description?: string;
    icon?: string;
  }>;
  allowOther?: boolean;
  otherFieldId?: string;
}

// =============================================================================
// Question Definitions with Translation Keys
// =============================================================================

export const STUDENT_ONBOARDING_QUESTIONS: StudentOnboardingQuestion[] = [
  {
    id: 'interest',
    title: 'studentOnboarding.questions.interest.title',
    subtitle: 'studentOnboarding.questions.interest.subtitle',
    type: 'single',
    options: [
      { value: 'fitness', label: 'studentOnboarding.questions.interest.options.fitness' },
      { value: 'business', label: 'studentOnboarding.questions.interest.options.business' },
      { value: 'design', label: 'studentOnboarding.questions.interest.options.design' },
      { value: 'tech', label: 'studentOnboarding.questions.interest.options.tech' },
      { value: 'personal_development', label: 'studentOnboarding.questions.interest.options.personal_development' },
      { value: 'lifestyle', label: 'studentOnboarding.questions.interest.options.lifestyle' },
    ],
    allowOther: true,
    otherFieldId: 'interestOther',
  },
  {
    id: 'goal',
    title: 'studentOnboarding.questions.goal.title',
    subtitle: 'studentOnboarding.questions.goal.subtitle',
    type: 'single',
    options: [
      {
        value: 'new_career',
        label: 'studentOnboarding.questions.goal.options.new_career.label',
        description: 'studentOnboarding.questions.goal.options.new_career.description',
      },
      {
        value: 'level_up',
        label: 'studentOnboarding.questions.goal.options.level_up.label',
        description: 'studentOnboarding.questions.goal.options.level_up.description',
      },
      {
        value: 'hobby',
        label: 'studentOnboarding.questions.goal.options.hobby.label',
        description: 'studentOnboarding.questions.goal.options.hobby.description',
      },
      {
        value: 'certification',
        label: 'studentOnboarding.questions.goal.options.certification.label',
        description: 'studentOnboarding.questions.goal.options.certification.description',
      },
      {
        value: 'personal_growth',
        label: 'studentOnboarding.questions.goal.options.personal_growth.label',
        description: 'studentOnboarding.questions.goal.options.personal_growth.description',
      },
    ],
  },
  {
    id: 'experience',
    title: 'studentOnboarding.questions.experience.title',
    subtitle: 'studentOnboarding.questions.experience.subtitle',
    type: 'single',
    options: [
      {
        value: 'beginner',
        label: 'studentOnboarding.questions.experience.options.beginner.label',
        description: 'studentOnboarding.questions.experience.options.beginner.description',
      },
      {
        value: 'some',
        label: 'studentOnboarding.questions.experience.options.some.label',
        description: 'studentOnboarding.questions.experience.options.some.description',
      },
      {
        value: 'intermediate',
        label: 'studentOnboarding.questions.experience.options.intermediate.label',
        description: 'studentOnboarding.questions.experience.options.intermediate.description',
      },
      {
        value: 'advanced',
        label: 'studentOnboarding.questions.experience.options.advanced.label',
        description: 'studentOnboarding.questions.experience.options.advanced.description',
      },
    ],
  },
  {
    id: 'learningStyle',
    title: 'studentOnboarding.questions.learningStyle.title',
    subtitle: 'studentOnboarding.questions.learningStyle.subtitle',
    type: 'single',
    options: [
      {
        value: 'self_paced',
        label: 'studentOnboarding.questions.learningStyle.options.self_paced.label',
        description: 'studentOnboarding.questions.learningStyle.options.self_paced.description',
      },
      {
        value: 'community',
        label: 'studentOnboarding.questions.learningStyle.options.community.label',
        description: 'studentOnboarding.questions.learningStyle.options.community.description',
      },
      {
        value: 'mentorship',
        label: 'studentOnboarding.questions.learningStyle.options.mentorship.label',
        description: 'studentOnboarding.questions.learningStyle.options.mentorship.description',
      },
      {
        value: 'hands_on',
        label: 'studentOnboarding.questions.learningStyle.options.hands_on.label',
        description: 'studentOnboarding.questions.learningStyle.options.hands_on.description',
      },
      {
        value: 'mix',
        label: 'studentOnboarding.questions.learningStyle.options.mix.label',
        description: 'studentOnboarding.questions.learningStyle.options.mix.description',
      },
    ],
  },
  {
    id: 'timeCommitment',
    title: 'studentOnboarding.questions.timeCommitment.title',
    subtitle: 'studentOnboarding.questions.timeCommitment.subtitle',
    type: 'single',
    options: [
      { value: 'minimal', label: 'studentOnboarding.questions.timeCommitment.options.minimal' },
      { value: 'moderate', label: 'studentOnboarding.questions.timeCommitment.options.moderate' },
      { value: 'dedicated', label: 'studentOnboarding.questions.timeCommitment.options.dedicated' },
      { value: 'intensive', label: 'studentOnboarding.questions.timeCommitment.options.intensive' },
    ],
  },
  {
    id: 'challenge',
    title: 'studentOnboarding.questions.challenge.title',
    subtitle: 'studentOnboarding.questions.challenge.subtitle',
    type: 'single',
    options: [
      {
        value: 'no_time',
        label: 'studentOnboarding.questions.challenge.options.no_time.label',
        description: 'studentOnboarding.questions.challenge.options.no_time.description',
      },
      {
        value: 'motivation',
        label: 'studentOnboarding.questions.challenge.options.motivation.label',
        description: 'studentOnboarding.questions.challenge.options.motivation.description',
      },
      {
        value: 'overwhelm',
        label: 'studentOnboarding.questions.challenge.options.overwhelm.label',
        description: 'studentOnboarding.questions.challenge.options.overwhelm.description',
      },
      {
        value: 'cost',
        label: 'studentOnboarding.questions.challenge.options.cost.label',
        description: 'studentOnboarding.questions.challenge.options.cost.description',
      },
      {
        value: 'support',
        label: 'studentOnboarding.questions.challenge.options.support.label',
        description: 'studentOnboarding.questions.challenge.options.support.description',
      },
    ],
    allowOther: true,
    otherFieldId: 'challengeOther',
  },
];

// =============================================================================
// Helper Functions
// =============================================================================

export const getEmptyAnswers = (): StudentOnboardingAnswers => ({
  interest: null,
  interestOther: null,
  goal: null,
  experience: null,
  learningStyle: null,
  timeCommitment: null,
  challenge: null,
  challengeOther: null,
});

export const isAnswerComplete = (
  questionId: keyof StudentOnboardingAnswers,
  answers: StudentOnboardingAnswers
): boolean => {
  const question = STUDENT_ONBOARDING_QUESTIONS.find(q => q.id === questionId);
  if (!question) return false;

  const answer = answers[questionId];

  // If no answer, not complete
  if (answer === null || answer === undefined) return false;

  // If "other" is selected, check if the other field has content
  if (answer === 'other' && question.allowOther && question.otherFieldId) {
    const otherValue = answers[question.otherFieldId];
    return typeof otherValue === 'string' && otherValue.trim().length > 0;
  }

  return true;
};

// Get the display title for an interest
export const getInterestTitle = (
  interest: InterestOption | null,
  interestOther: string | null,
  t: (key: string) => string
): string => {
  if (!interest) return t('studentOnboarding.interests.default');
  if (interest === 'other' && interestOther) {
    return interestOther.charAt(0).toUpperCase() + interestOther.slice(1);
  }
  return t(`studentOnboarding.interests.${interest}`);
};

// Get the display text for a goal
export const getGoalText = (
  goal: GoalOption | null,
  t: (key: string) => string
): string => {
  if (!goal) return t('studentOnboarding.goals.default');
  return t(`studentOnboarding.goals.${goal}`);
};

// Get the display text for a challenge
export const getChallengeText = (
  challenge: ChallengeOption | null,
  challengeOther: string | null,
  t: (key: string) => string
): string => {
  if (!challenge) return t('studentOnboarding.challenges.default');
  if (challenge === 'other' && challengeOther) {
    return challengeOther;
  }
  return t(`studentOnboarding.challenges.${challenge}`);
};

// Get the display text for experience level
export const getExperienceText = (
  experience: ExperienceOption | null,
  t: (key: string) => string
): string => {
  if (!experience) return '';
  return t(`studentOnboarding.experience.${experience}`);
};

// Get the display text for learning style
export const getLearningStyleText = (
  learningStyle: LearningStyleOption | null,
  t: (key: string) => string
): string => {
  if (!learningStyle) return '';
  return t(`studentOnboarding.learningStyle.${learningStyle}`);
};

// Get the display text for time commitment
export const getTimeCommitmentText = (
  timeCommitment: TimeCommitmentOption | null,
  t: (key: string) => string
): string => {
  if (!timeCommitment) return '';
  return t(`studentOnboarding.timeCommitment.${timeCommitment}`);
};

// Generate a unique session ID
export const generateSessionId = (): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `student_${timestamp}${random}`;
};
