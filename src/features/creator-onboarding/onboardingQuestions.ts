import type { OnboardingQuestion } from './onboardingTypes';

// Questions with static structure - translations are handled via i18n in components
export const onboardingQuestions: OnboardingQuestion[] = [
  {
    id: 'niche',
    title: 'onboarding.questions.niche.title',
    subtitle: 'onboarding.questions.niche.subtitle',
    type: 'single',
    options: [
      { value: 'fitness', label: 'onboarding.questions.niche.options.fitness', icon: 'dumbbell' },
      { value: 'business', label: 'onboarding.questions.niche.options.business', icon: 'briefcase' },
      { value: 'design', label: 'onboarding.questions.niche.options.design', icon: 'palette' },
      { value: 'tech', label: 'onboarding.questions.niche.options.tech', icon: 'code' },
      { value: 'personal_development', label: 'onboarding.questions.niche.options.personal_development', icon: 'brain' },
      { value: 'lifestyle', label: 'onboarding.questions.niche.options.lifestyle', icon: 'heart' },
    ],
    allowOther: true,
    otherFieldId: 'nicheOther',
  },
  {
    id: 'stage',
    title: 'onboarding.questions.stage.title',
    subtitle: 'onboarding.questions.stage.subtitle',
    type: 'single',
    options: [
      {
        value: 'idea_stage',
        label: 'onboarding.questions.stage.options.idea_stage.label',
        description: 'onboarding.questions.stage.options.idea_stage.description',
      },
      {
        value: 'side_hustle',
        label: 'onboarding.questions.stage.options.side_hustle.label',
        description: 'onboarding.questions.stage.options.side_hustle.description',
      },
      {
        value: 'going_fulltime',
        label: 'onboarding.questions.stage.options.going_fulltime.label',
        description: 'onboarding.questions.stage.options.going_fulltime.description',
      },
      {
        value: 'established',
        label: 'onboarding.questions.stage.options.established.label',
        description: 'onboarding.questions.stage.options.established.description',
      },
    ],
  },
  {
    id: 'audienceSize',
    title: 'onboarding.questions.audienceSize.title',
    subtitle: 'onboarding.questions.audienceSize.subtitle',
    type: 'single',
    options: [
      { value: '0_100', label: 'onboarding.questions.audienceSize.options.0_100' },
      { value: '100_1000', label: 'onboarding.questions.audienceSize.options.100_1000' },
      { value: '1000_10000', label: 'onboarding.questions.audienceSize.options.1000_10000' },
      { value: '10000_plus', label: 'onboarding.questions.audienceSize.options.10000_plus' },
    ],
  },
  {
    id: 'painPoint',
    title: 'onboarding.questions.painPoint.title',
    subtitle: 'onboarding.questions.painPoint.subtitle',
    type: 'single',
    options: [
      {
        value: 'too_many_tools',
        label: 'onboarding.questions.painPoint.options.too_many_tools.label',
        description: 'onboarding.questions.painPoint.options.too_many_tools.description',
      },
      {
        value: 'losing_students',
        label: 'onboarding.questions.painPoint.options.losing_students.label',
        description: 'onboarding.questions.painPoint.options.losing_students.description',
      },
      {
        value: 'no_time',
        label: 'onboarding.questions.painPoint.options.no_time.label',
        description: 'onboarding.questions.painPoint.options.no_time.description',
      },
      {
        value: 'tech_overwhelm',
        label: 'onboarding.questions.painPoint.options.tech_overwhelm.label',
        description: 'onboarding.questions.painPoint.options.tech_overwhelm.description',
      },
      {
        value: 'hard_to_track',
        label: 'onboarding.questions.painPoint.options.hard_to_track.label',
        description: 'onboarding.questions.painPoint.options.hard_to_track.description',
      },
    ],
    allowOther: true,
    otherFieldId: 'painPointOther',
  },
  {
    id: 'goal',
    title: 'onboarding.questions.goal.title',
    subtitle: 'onboarding.questions.goal.subtitle',
    type: 'single',
    options: [
      { value: 'launch_course', label: 'onboarding.questions.goal.options.launch_course' },
      { value: 'build_community', label: 'onboarding.questions.goal.options.build_community' },
      { value: 'scale_business', label: 'onboarding.questions.goal.options.scale_business' },
      { value: 'automate', label: 'onboarding.questions.goal.options.automate' },
      { value: 'increase_success', label: 'onboarding.questions.goal.options.increase_success' },
    ],
  },
  {
    id: 'currentTools',
    title: 'onboarding.questions.currentTools.title',
    subtitle: 'onboarding.questions.currentTools.subtitle',
    type: 'multi',
    options: [
      { value: 'none', label: 'onboarding.questions.currentTools.options.none' },
      { value: 'discord', label: 'onboarding.questions.currentTools.options.discord' },
      { value: 'kajabi', label: 'onboarding.questions.currentTools.options.kajabi' },
      { value: 'skool', label: 'onboarding.questions.currentTools.options.skool' },
      { value: 'calendly', label: 'onboarding.questions.currentTools.options.calendly' },
      { value: 'circle', label: 'onboarding.questions.currentTools.options.circle' },
      { value: 'notion', label: 'onboarding.questions.currentTools.options.notion' },
      { value: 'other', label: 'onboarding.questions.currentTools.options.other' },
    ],
  },
  {
    id: 'revenueGoal',
    title: 'onboarding.questions.revenueGoal.title',
    subtitle: 'onboarding.questions.revenueGoal.subtitle',
    type: 'single',
    options: [
      { value: 'under_1k', label: 'onboarding.questions.revenueGoal.options.under_1k' },
      { value: '1k_5k', label: 'onboarding.questions.revenueGoal.options.1k_5k' },
      { value: '5k_10k', label: 'onboarding.questions.revenueGoal.options.5k_10k' },
      { value: '10k_25k', label: 'onboarding.questions.revenueGoal.options.10k_25k' },
      { value: '25k_plus', label: 'onboarding.questions.revenueGoal.options.25k_plus' },
    ],
  },
];

// Helper to get niche display name - uses translation key approach
export const getNicheDisplayName = (niche: string | null, nicheOther: string | null): string => {
  if (!niche) return 'onboarding.niches.default';
  if (niche === 'other' && nicheOther) return nicheOther;
  return `onboarding.niches.${niche}`;
};

// Helper to get niche title - uses translation key approach
export const getNicheTitle = (niche: string | null, nicheOther: string | null): string => {
  if (!niche) return 'onboarding.nicheTitles.default';
  if (niche === 'other' && nicheOther) {
    // Capitalize first letter
    return nicheOther.charAt(0).toUpperCase() + nicheOther.slice(1);
  }
  return `onboarding.nicheTitles.${niche}`;
};

// Helper to get pain point display text - uses translation key approach
export const getPainPointDisplay = (painPoint: string | null, painPointOther: string | null): string => {
  if (!painPoint) return 'onboarding.painPoints.default';
  if (painPoint === 'other' && painPointOther) return painPointOther.toLowerCase();
  return `onboarding.painPoints.${painPoint}`;
};

// Helper to get goal display text - uses translation key approach
export const getGoalDisplay = (goal: string | null): string => {
  if (!goal) return 'onboarding.goals.default';
  return `onboarding.goals.${goal}`;
};

// Helper to get tools replacement message - uses translation key approach
export const getToolsReplacement = (tools: string[]): string[] => {
  // Filter out 'none' and 'other'
  const filteredTools = tools.filter((t) => t !== 'none' && t !== 'other');

  if (filteredTools.length === 0) {
    if (tools.includes('none')) {
      return ['onboarding.tools.none'];
    }
    return ['onboarding.tools.default'];
  }

  return filteredTools.map((t) => `onboarding.tools.${t}`);
};
