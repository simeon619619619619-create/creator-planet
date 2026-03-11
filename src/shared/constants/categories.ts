export const CONTENT_CATEGORIES = [
  { value: 'marketing', labelKey: 'categories.marketing' },
  { value: 'business', labelKey: 'categories.business' },
  { value: 'design', labelKey: 'categories.design' },
  { value: 'video_photo', labelKey: 'categories.videoPhoto' },
  { value: 'personal_development', labelKey: 'categories.personalDevelopment' },
  { value: 'finance', labelKey: 'categories.finance' },
  { value: 'technology', labelKey: 'categories.technology' },
  { value: 'health_fitness', labelKey: 'categories.healthFitness' },
] as const;

export type ContentCategory = typeof CONTENT_CATEGORIES[number]['value'];
