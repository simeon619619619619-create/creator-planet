-- Content category enum shared by courses and communities
CREATE TYPE public.content_category AS ENUM (
  'marketing',
  'business',
  'design',
  'video_photo',
  'personal_development',
  'finance',
  'technology',
  'health_fitness'
);

-- Add category column to courses
ALTER TABLE public.courses ADD COLUMN category public.content_category;

-- Add category column to communities
ALTER TABLE public.communities ADD COLUMN category public.content_category;

-- Index for filtering
CREATE INDEX idx_courses_category ON public.courses (category) WHERE category IS NOT NULL;
CREATE INDEX idx_communities_category ON public.communities (category) WHERE category IS NOT NULL;
