import { useQuery } from '@tanstack/react-query';
import {
  getEnrolledCourses,
  getCreatorCourses,
  getCourseWithDetails,
  CourseWithModules,
} from '../courseService';
import { DbCourse } from '../../../core/supabase/database.types';

export function useEnrolledCourses(userId: string | undefined) {
  return useQuery<CourseWithModules[]>({
    queryKey: ['courses', 'enrolled', userId],
    queryFn: () => getEnrolledCourses(userId!),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatorCourses(creatorId: string | undefined) {
  return useQuery<DbCourse[]>({
    queryKey: ['courses', 'creator', creatorId],
    queryFn: () => getCreatorCourses(creatorId!),
    enabled: !!creatorId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCourseDetails(courseId: string | undefined, userId?: string) {
  return useQuery<CourseWithModules | null>({
    queryKey: ['courses', 'details', courseId, userId],
    queryFn: () => getCourseWithDetails(courseId!, userId),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });
}
