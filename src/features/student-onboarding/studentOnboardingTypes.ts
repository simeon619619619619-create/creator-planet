// =============================================================================
// Student Onboarding Types
// Type definitions for the student onboarding questionnaire flow
// =============================================================================

// Interest/Topic Options - What they want to learn
export type InterestOption =
  | 'fitness'
  | 'business'
  | 'design'
  | 'tech'
  | 'personal_development'
  | 'lifestyle'
  | 'other';

// Goal Options - Why they want to learn
export type GoalOption =
  | 'new_career'        // Start a completely new career path
  | 'level_up'          // Improve existing skills
  | 'hobby'             // Learn something for fun
  | 'certification'     // Get certified/credentialed
  | 'personal_growth';  // Self-improvement

// Experience Level Options
export type ExperienceOption =
  | 'beginner'          // Just starting out
  | 'some'              // Tried a few things
  | 'intermediate'      // Know the basics well
  | 'advanced';         // Looking to master

// Learning Style Options
export type LearningStyleOption =
  | 'self_paced'        // Video courses at my own pace
  | 'community'         // Learning with others, discussions
  | 'mentorship'        // Direct guidance from experts
  | 'hands_on'          // Project-based, practical
  | 'mix';              // Combination of all

// Time Commitment Options (weekly)
export type TimeCommitmentOption =
  | 'minimal'           // Under 2 hours/week
  | 'moderate'          // 2-5 hours/week
  | 'dedicated'         // 5-10 hours/week
  | 'intensive';        // 10+ hours/week

// Challenge Options - What's held them back
export type ChallengeOption =
  | 'no_time'           // No time
  | 'motivation'        // Start but don't finish
  | 'overwhelm'         // Don't know where to start
  | 'cost'              // Courses cost too much
  | 'support'           // No one to help when stuck
  | 'other';

// Complete answers type
export interface StudentOnboardingAnswers {
  interest: InterestOption | null;
  interestOther: string | null;
  goal: GoalOption | null;
  experience: ExperienceOption | null;
  learningStyle: LearningStyleOption | null;
  timeCommitment: TimeCommitmentOption | null;
  challenge: ChallengeOption | null;
  challengeOther: string | null;
}

// Session type for localStorage persistence
export interface StudentOnboardingSession {
  sessionId: string;
  startedAt: string;
  answers: StudentOnboardingAnswers;
  completedAt: string | null;
}

// Step types
export type StudentOnboardingStep = 'questions' | 'preview' | 'summary' | 'signup';
