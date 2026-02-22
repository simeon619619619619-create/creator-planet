// Creator Onboarding Feature Exports

// Pages
export { default as CreatorOnboardingPage } from './pages/CreatorOnboardingPage';

// Components
export { default as OnboardingQuestion } from './components/OnboardingQuestion';
export { default as OnboardingProgress } from './components/OnboardingProgress';
export { default as PreviewScreen } from './components/PreviewScreen';
export { default as SummaryScreen } from './components/SummaryScreen';
export { default as InlineSignupForm } from './components/InlineSignupForm';

// Hooks
export { useOnboardingSession } from './hooks/useOnboardingSession';

// Services
export { syncOnboardingData, getCreatorOnboarding, hasCompletedOnboarding } from './onboardingService';

// Data
export { onboardingQuestions, getNicheDisplayName, getPainPointDisplay, getGoalDisplay } from './onboardingQuestions';

// Types
export type {
  OnboardingSession,
  OnboardingAnswers,
  OnboardingQuestion as OnboardingQuestionType,
  OnboardingStep,
  NicheOption,
  StageOption,
  AudienceSizeOption,
  PainPointOption,
  GoalOption,
  ToolOption,
  RevenueGoalOption,
} from './onboardingTypes';
