import { supabase } from '../../core/supabase/client';
import { DbCourse, DbProfile } from '../../core/supabase/database.types';

// ============================================================================
// TYPES
// ============================================================================

export interface PublicCourse {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number;
  is_free: boolean;
  creator: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
  enrolled_count: number;
  rating: number | null;
  created_at: string;
}

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

// Default categories for the landing page
export const COURSE_CATEGORIES: CourseCategory[] = [
  { id: '1', name: 'Development', slug: 'development' },
  { id: '2', name: 'Business', slug: 'business' },
  { id: '3', name: 'Design', slug: 'design' },
  { id: '4', name: 'Marketing', slug: 'marketing' },
  { id: '5', name: 'Personal Development', slug: 'personal-development' },
  { id: '6', name: 'Finance', slug: 'finance' },
  { id: '7', name: 'Health & Fitness', slug: 'health-fitness' },
  { id: '8', name: 'Music', slug: 'music' },
];

// ============================================================================
// PUBLIC COURSE FETCHING (No Auth Required)
// ============================================================================

/**
 * Get all published courses for the public landing page
 * This does not require authentication
 */
export async function getPublicCourses(): Promise<PublicCourse[]> {
  try {
    // Fetch all published courses with creator info
    // Only show courses that belong to a community (filter out orphans)
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        created_at,
        creator_id
      `)
      .eq('is_published', true)
      .not('community_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching public courses:', error);
      return [];
    }

    if (!courses || courses.length === 0) {
      return [];
    }

    // Get creator IDs for fetching profiles
    const creatorIds = [...new Set(courses.map(c => c.creator_id))];

    // Fetch creator profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, avatar_url')
      .in('user_id', creatorIds);

    // Create a map of user_id to profile for quick lookup
    const profileMap = new Map<string, DbProfile>();
    profiles?.forEach(p => {
      profileMap.set(p.user_id, p as DbProfile);
    });

    // Get enrollment counts for each course
    const { data: enrollmentCounts } = await supabase
      .from('enrollments')
      .select('course_id')
      .in('course_id', courses.map(c => c.id));

    // Count enrollments per course
    const countMap = new Map<string, number>();
    enrollmentCounts?.forEach(e => {
      const count = countMap.get(e.course_id) || 0;
      countMap.set(e.course_id, count + 1);
    });

    // Transform to PublicCourse format
    const publicCourses: PublicCourse[] = courses.map(course => {
      const creatorProfile = profileMap.get(course.creator_id);

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        price: 0, // Default to free for now (can be extended with pricing table)
        is_free: true, // Default to free for now
        creator: creatorProfile ? {
          id: creatorProfile.user_id,
          full_name: creatorProfile.full_name || 'Unknown Creator',
          avatar_url: creatorProfile.avatar_url,
        } : null,
        enrolled_count: countMap.get(course.id) || 0,
        rating: null, // Can be extended with ratings table
        created_at: course.created_at,
      };
    });

    return publicCourses;
  } catch (error) {
    console.error('Error in getPublicCourses:', error);
    return [];
  }
}

/**
 * Search courses by title or description
 */
export async function searchCourses(query: string): Promise<PublicCourse[]> {
  if (!query.trim()) {
    return getPublicCourses();
  }

  try {
    // Only show courses that belong to a community (filter out orphans)
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        created_at,
        creator_id
      `)
      .eq('is_published', true)
      .not('community_id', 'is', null)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error searching courses:', error);
      return [];
    }

    if (!courses || courses.length === 0) {
      return [];
    }

    // Get creator profiles
    const creatorIds = [...new Set(courses.map(c => c.creator_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, avatar_url')
      .in('user_id', creatorIds);

    const profileMap = new Map<string, DbProfile>();
    profiles?.forEach(p => {
      profileMap.set(p.user_id, p as DbProfile);
    });

    // Get enrollment counts
    const { data: enrollmentCounts } = await supabase
      .from('enrollments')
      .select('course_id')
      .in('course_id', courses.map(c => c.id));

    const countMap = new Map<string, number>();
    enrollmentCounts?.forEach(e => {
      const count = countMap.get(e.course_id) || 0;
      countMap.set(e.course_id, count + 1);
    });

    return courses.map(course => {
      const creatorProfile = profileMap.get(course.creator_id);

      return {
        id: course.id,
        title: course.title,
        description: course.description,
        thumbnail_url: course.thumbnail_url,
        price: 0,
        is_free: true,
        creator: creatorProfile ? {
          id: creatorProfile.user_id,
          full_name: creatorProfile.full_name || 'Unknown Creator',
          avatar_url: creatorProfile.avatar_url,
        } : null,
        enrolled_count: countMap.get(course.id) || 0,
        rating: null,
        created_at: course.created_at,
      };
    });
  } catch (error) {
    console.error('Error in searchCourses:', error);
    return [];
  }
}

/**
 * Get total number of learners across all courses
 */
export async function getTotalLearnersCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error counting learners:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getTotalLearnersCount:', error);
    return 0;
  }
}

/**
 * Get featured/popular courses (top enrolled)
 */
export async function getFeaturedCourses(limit: number = 8): Promise<PublicCourse[]> {
  const courses = await getPublicCourses();

  // Sort by enrollment count (popularity)
  return courses
    .sort((a, b) => b.enrolled_count - a.enrolled_count)
    .slice(0, limit);
}
