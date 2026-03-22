import { supabase } from '../../core/supabase/client';
import * as tus from 'tus-js-client';
import {
  DbCourse,
  DbModule,
  DbLesson,
  DbEnrollment,
  DbLessonProgress,
  EnrollmentStatus,
  LessonType,
} from '../../core/supabase/database.types';
import { hasPassedQuiz } from './quizService';

// Threshold for using resumable uploads (6MB as recommended by Supabase)
const RESUMABLE_UPLOAD_THRESHOLD = 6 * 1024 * 1024;

// ============================================================================
// TYPES
// ============================================================================

export interface CourseWithModules extends DbCourse {
  modules: ModuleWithLessons[];
  enrollment?: DbEnrollment;
  progress_percent?: number;
}

export interface ModuleWithLessons extends DbModule {
  lessons: LessonWithProgress[];
}

export interface LessonWithProgress extends DbLesson {
  progress?: DbLessonProgress;
  is_completed?: boolean;
}

// ============================================================================
// COURSES
// ============================================================================

export async function getCourses(): Promise<DbCourse[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching courses:', error);
    return [];
  }
  return data || [];
}

export async function getCreatorCourses(creatorId: string): Promise<DbCourse[]> {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('creator_id', creatorId)
    .order('display_order', { ascending: true });

  if (error) {
    console.error('Error fetching creator courses:', error);
    return [];
  }
  return data || [];
}

/**
 * Reorder courses by updating their display_order values
 */
export async function reorderCourses(
  courseOrders: { id: string; display_order: number }[]
): Promise<boolean> {
  const results = await Promise.all(
    courseOrders.map(({ id, display_order }) =>
      supabase.from('courses').update({ display_order }).eq('id', id)
    )
  );

  return results.every(r => !r.error);
}

export async function getEnrolledCourses(userId: string): Promise<CourseWithModules[]> {
  // Get enrollments with full course->module->lesson tree in ONE query
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select(`
      *,
      course:courses(
        *,
        modules(
          *,
          lessons(*)
        )
      )
    `)
    .eq('user_id', userId)
    .in('status', ['active', 'completed']);

  if (enrollmentError) {
    console.error('Error fetching enrollments:', enrollmentError);
    return [];
  }

  if (!enrollments || enrollments.length === 0) return [];

  // Collect ALL lesson IDs across all courses
  const allLessonIds: string[] = [];
  for (const enrollment of enrollments) {
    const course = enrollment.course as any;
    if (!course?.modules) continue;
    for (const mod of course.modules) {
      for (const lesson of mod.lessons || []) {
        allLessonIds.push(lesson.id);
      }
    }
  }

  // ONE batch progress query for all lessons
  let progressMap = new Map<string, DbLessonProgress>();
  if (allLessonIds.length > 0) {
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', userId)
      .in('lesson_id', allLessonIds);

    (progress || []).forEach(p => {
      progressMap.set(p.lesson_id, p);
    });
  }

  // Assemble CourseWithModules in memory
  const courses: CourseWithModules[] = [];
  for (const enrollment of enrollments) {
    const course = enrollment.course as any;
    if (!course) continue;

    const modules: ModuleWithLessons[] = (course.modules || [])
      .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
      .map((mod: any) => ({
        ...mod,
        lessons: (mod.lessons || [])
          .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
          .map((lesson: any) => {
            const prog = progressMap.get(lesson.id);
            return {
              ...lesson,
              progress: prog || undefined,
              is_completed: prog?.completed_at != null,
            };
          }),
      }));

    // Calculate progress percentage
    const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);
    const completedLessons = modules.reduce(
      (sum, m) => sum + m.lessons.filter(l => l.is_completed).length,
      0
    );
    const progressPercent = totalLessons > 0
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    courses.push({
      ...course,
      modules,
      enrollment,
      progress_percent: progressPercent,
    });
  }

  return courses;
}

/**
 * Get courses available to a student (from communities they're a member of, but not yet enrolled)
 */
export async function getAvailableCourses(userId: string): Promise<DbCourse[]> {
  // Get communities the user is a member of
  const { data: memberships, error: membershipError } = await supabase
    .from('memberships')
    .select('community_id')
    .eq('user_id', userId);

  if (membershipError) {
    console.error('Error fetching memberships:', membershipError);
    return [];
  }

  const communityIds = memberships?.map(m => m.community_id) || [];
  if (communityIds.length === 0) return [];

  // Get courses the user is already enrolled in
  const { data: enrollments, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('course_id')
    .eq('user_id', userId);

  if (enrollmentError) {
    console.error('Error fetching enrollments:', enrollmentError);
    return [];
  }

  const enrolledCourseIds = enrollments?.map(e => e.course_id) || [];

  // Get published courses from user's communities that they're not enrolled in
  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('*')
    .in('community_id', communityIds)
    .eq('is_published', true)
    .order('created_at', { ascending: false });

  if (coursesError) {
    console.error('Error fetching available courses:', coursesError);
    return [];
  }

  // Filter out already enrolled courses client-side (safer than string interpolation)
  const enrolledSet = new Set(enrolledCourseIds);
  return (courses || []).filter(course => !enrolledSet.has(course.id));
}

export async function getCourseWithDetails(courseId: string, userId?: string): Promise<CourseWithModules | null> {
  // Get course
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('*')
    .eq('id', courseId)
    .single();

  if (courseError || !course) {
    console.error('Error fetching course:', courseError);
    return null;
  }

  // Get modules
  const { data: modules, error: modulesError } = await supabase
    .from('modules')
    .select('*')
    .eq('course_id', courseId)
    .order('position', { ascending: true });

  if (modulesError) {
    console.error('Error fetching modules:', modulesError);
    return { ...course, modules: [] };
  }

  // Get all lessons for all modules
  const moduleIds = modules?.map(m => m.id) || [];
  const { data: lessons, error: lessonsError } = moduleIds.length > 0 ? await supabase
    .from('lessons')
    .select('*')
    .in('module_id', moduleIds)
    .order('position', { ascending: true }) : { data: [], error: null };

  if (lessonsError) {
    console.error('Error fetching lessons:', lessonsError);
  }

  // Get progress if user is provided
  let progressMap = new Map<string, DbLessonProgress>();
  if (userId && lessons && lessons.length > 0) {
    const lessonIds = lessons.map(l => l.id);
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('*')
      .eq('user_id', userId)
      .in('lesson_id', lessonIds);

    progress?.forEach(p => {
      progressMap.set(p.lesson_id, p);
    });
  }

  // Build the course with modules and lessons
  const modulesWithLessons: ModuleWithLessons[] = (modules || []).map(module => ({
    ...module,
    lessons: (lessons || [])
      .filter(l => l.module_id === module.id)
      .map(lesson => ({
        ...lesson,
        progress: progressMap.get(lesson.id),
        is_completed: progressMap.get(lesson.id)?.completed_at != null,
      })),
  }));

  // Calculate overall progress
  const totalLessons = modulesWithLessons.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedLessons = modulesWithLessons.reduce(
    (acc, m) => acc + m.lessons.filter(l => l.is_completed).length,
    0
  );
  const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return {
    ...course,
    modules: modulesWithLessons,
    progress_percent: progressPercent,
  };
}

export async function createCourse(
  creatorId: string,
  title: string,
  description?: string,
  thumbnailUrl?: string,
  communityId?: string
): Promise<DbCourse | null> {
  const { data, error } = await supabase
    .from('courses')
    .insert({
      creator_id: creatorId,
      title,
      description,
      thumbnail_url: thumbnailUrl,
      community_id: communityId,
      is_published: false,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating course:', error);
    return null;
  }
  return data;
}

export async function publishCourse(courseId: string): Promise<boolean> {
  const { error } = await supabase
    .from('courses')
    .update({ is_published: true })
    .eq('id', courseId);

  if (error) {
    console.error('Error publishing course:', error);
    return false;
  }
  return true;
}

export async function unpublishCourse(courseId: string): Promise<boolean> {
  const { error } = await supabase
    .from('courses')
    .update({ is_published: false })
    .eq('id', courseId);

  if (error) {
    console.error('Error unpublishing course:', error);
    return false;
  }
  return true;
}

export async function updateCourse(
  courseId: string,
  updates: Partial<Pick<DbCourse, 'title' | 'description' | 'thumbnail_url' | 'is_published' | 'category'>>
): Promise<DbCourse | null> {
  const { data, error } = await supabase
    .from('courses')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', courseId)
    .select()
    .single();

  if (error) {
    console.error('Error updating course:', error);
    return null;
  }
  return data;
}

export async function deleteCourse(courseId: string): Promise<boolean> {
  // Note: This should cascade delete modules, lessons, enrollments via DB constraints
  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', courseId);

  if (error) {
    console.error('Error deleting course:', error);
    return false;
  }
  return true;
}

export async function uploadCourseThumbnail(
  courseId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${courseId}/thumbnail-${Date.now()}.${fileExt}`;

  // Upload new thumbnail
  const { data, error } = await supabase.storage
    .from('course-thumbnails')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading thumbnail:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('course-thumbnails')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ============================================================================
// MODULES
// ============================================================================

export async function createModule(
  courseId: string,
  title: string,
  description?: string,
  position?: number
): Promise<DbModule | null> {
  // If no position provided, get the next available position
  const finalPosition = position ?? await getNextModulePosition(courseId);

  const { data, error } = await supabase
    .from('modules')
    .insert({
      course_id: courseId,
      title,
      description,
      position: finalPosition,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating module:', error);
    return null;
  }
  return data;
}

export async function updateModule(
  moduleId: string,
  updates: Partial<Pick<DbModule, 'title' | 'description' | 'unlock_type' | 'unlock_value' | 'position' | 'thumbnail_url'>>
): Promise<DbModule | null> {
  const { data, error } = await supabase
    .from('modules')
    .update(updates)
    .eq('id', moduleId)
    .select()
    .single();

  if (error) {
    console.error('Error updating module:', error);
    return null;
  }
  return data;
}

export async function uploadModuleThumbnail(
  moduleId: string,
  file: File
): Promise<string | null> {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `modules/${moduleId}/thumbnail-${Date.now()}.${fileExt}`;

  // Upload new thumbnail (reusing course-thumbnails bucket)
  const { data, error } = await supabase.storage
    .from('course-thumbnails')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading module thumbnail:', error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('course-thumbnails')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export async function deleteModule(moduleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('modules')
    .delete()
    .eq('id', moduleId);

  if (error) {
    console.error('Error deleting module:', error);
    return false;
  }
  return true;
}

export async function getNextModulePosition(courseId: string): Promise<number> {
  const { data } = await supabase
    .from('modules')
    .select('position')
    .eq('course_id', courseId)
    .order('position', { ascending: false })
    .limit(1);

  return (data?.[0]?.position ?? -1) + 1;
}

export async function reorderModules(
  moduleOrders: { id: string; position: number }[]
): Promise<boolean> {
  // Batch update positions
  const results = await Promise.all(
    moduleOrders.map(({ id, position }) =>
      supabase.from('modules').update({ position }).eq('id', id)
    )
  );

  return results.every(r => !r.error);
}

// ============================================================================
// LESSONS
// ============================================================================

export async function createLesson(
  moduleId: string,
  title: string,
  type: LessonType = 'video',
  description?: string,
  contentUrl?: string,
  position?: number,
  durationMinutes?: number
): Promise<DbLesson | null> {
  // If no position provided, get the next available position
  const finalPosition = position ?? await getNextLessonPosition(moduleId);

  const { data, error } = await supabase
    .from('lessons')
    .insert({
      module_id: moduleId,
      title,
      type,
      description,
      content_url: contentUrl,
      position: finalPosition,
      duration_minutes: durationMinutes,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating lesson:', error);
    return null;
  }
  return data;
}

export async function updateLesson(
  lessonId: string,
  updates: Partial<Pick<DbLesson, 'title' | 'description' | 'type' | 'content_url' | 'position' | 'duration_minutes'>>
): Promise<DbLesson | null> {
  const { data, error } = await supabase
    .from('lessons')
    .update(updates)
    .eq('id', lessonId)
    .select()
    .single();

  if (error) {
    console.error('Error updating lesson:', error);
    return null;
  }
  return data;
}

// Map MIME types to file extensions for proper video naming
const MIME_TO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogg',
  'video/quicktime': 'mov',
  'video/x-m4v': 'm4v'
};

/**
 * Progress callback type for video uploads
 */
export type UploadProgressCallback = (progress: number) => void;

/**
 * Extract project ID from Supabase URL
 * URL format: https://project-id.supabase.co
 */
function getProjectId(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const match = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : '';
}

/**
 * Upload a video file for a lesson using resumable uploads for large files
 * Files > 6MB use TUS protocol for reliable uploads
 * Files <= 6MB use standard upload for simplicity
 *
 * @param lessonId The lesson ID to associate the video with
 * @param file The video file to upload (MP4, WebM, etc.)
 * @param onProgress Optional callback for upload progress (0-100)
 * @returns The public URL of the uploaded video, or null on error
 */
export async function uploadLessonVideo(
  lessonId: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string | null> {
  // Use MIME type to determine extension, fallback to file name extension
  const fileExt = MIME_TO_EXT[file.type] ||
    file.name.split('.').pop()?.toLowerCase() ||
    'mp4';
  const fileName = `${lessonId}/video-${Date.now()}.${fileExt}`;
  const bucketName = 'lesson-videos';

  // For small files (< 6MB), use standard upload
  if (file.size < RESUMABLE_UPLOAD_THRESHOLD) {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Error uploading lesson video:', error);
      return null;
    }

    // Report 100% progress for small files
    onProgress?.(100);

    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  }

  // For large files (>= 6MB), use TUS resumable upload
  return new Promise((resolve) => {
    const projectId = getProjectId();
    if (!projectId) {
      console.error('Could not extract project ID from Supabase URL');
      resolve(null);
      return;
    }

    // Get the auth session for the upload
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        console.error('No auth session for video upload');
        resolve(null);
        return;
      }

      const upload = new tus.Upload(file, {
        // Use direct storage hostname for better large file upload performance
        // See: https://supabase.com/docs/guides/storage/uploads/resumable-uploads
        endpoint: `https://${projectId}.supabase.co/storage/v1/upload/resumable`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          'x-upsert': 'true', // Allow overwriting existing files
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: bucketName,
          objectName: fileName,
          contentType: file.type,
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // 6MB chunks
        onError: (error) => {
          console.error('TUS upload error:', error);
          resolve(null);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
          onProgress?.(percentage);
        },
        onSuccess: () => {
          // Construct the public URL
          const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);

          resolve(urlData.publicUrl);
        },
      });

      // Check for previous uploads to resume
      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length > 0) {
          // Resume the most recent upload
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        // Start the upload
        upload.start();
      });
    });
  });
}

/**
 * Delete a video file from storage
 * @param videoUrl The public URL of the video to delete
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteLessonVideo(videoUrl: string): Promise<boolean> {
  // Extract the path from the public URL
  // URL format: https://xxx.supabase.co/storage/v1/object/public/lesson-videos/lessonId/video-xxx.mp4
  try {
    const url = new URL(videoUrl);
    const pathMatch = url.pathname.match(/\/lesson-videos\/(.+)$/);
    if (!pathMatch || !pathMatch[1]) {
      console.error('Invalid lesson video URL:', videoUrl);
      return false;
    }

    const filePath = pathMatch[1];
    const { error } = await supabase.storage
      .from('lesson-videos')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting lesson video:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error parsing video URL:', e);
    return false;
  }
}

export async function deleteLesson(lessonId: string): Promise<boolean> {
  // First, check if lesson has an uploaded video that needs cleanup
  const { data: lesson } = await supabase
    .from('lessons')
    .select('content_url')
    .eq('id', lessonId)
    .single();

  // Delete video file from storage if it's a Supabase upload
  if (lesson?.content_url?.includes('lesson-videos')) {
    await deleteLessonVideo(lesson.content_url);
  }

  // Then delete the lesson from database
  const { error } = await supabase
    .from('lessons')
    .delete()
    .eq('id', lessonId);

  if (error) {
    console.error('Error deleting lesson:', error);
    return false;
  }
  return true;
}

export async function getNextLessonPosition(moduleId: string): Promise<number> {
  const { data } = await supabase
    .from('lessons')
    .select('position')
    .eq('module_id', moduleId)
    .order('position', { ascending: false })
    .limit(1);

  return (data?.[0]?.position ?? -1) + 1;
}

export async function reorderLessons(
  lessonOrders: { id: string; position: number }[]
): Promise<boolean> {
  const results = await Promise.all(
    lessonOrders.map(({ id, position }) =>
      supabase.from('lessons').update({ position }).eq('id', id)
    )
  );

  return results.every(r => !r.error);
}

// ============================================================================
// ENROLLMENTS
// ============================================================================

export async function enrollInCourse(userId: string, courseId: string): Promise<DbEnrollment | null> {
  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      user_id: userId,
      course_id: courseId,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error enrolling in course:', error);
    return null;
  }
  return data;
}

export async function getEnrollment(userId: string, courseId: string): Promise<DbEnrollment | null> {
  const { data, error } = await supabase
    .from('enrollments')
    .select('*')
    .eq('user_id', userId)
    .eq('course_id', courseId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching enrollment:', error);
  }
  return data || null;
}

// ============================================================================
// LESSON PROGRESS
// ============================================================================

export async function markLessonComplete(userId: string, lessonId: string): Promise<boolean> {
  // Upsert progress
  const { error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      progress_percent: 100,
      completed_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,lesson_id',
    });

  if (error) {
    console.error('Error marking lesson complete:', error);
    return false;
  }
  return true;
}

export async function markLessonIncomplete(userId: string, lessonId: string): Promise<boolean> {
  const { error } = await supabase
    .from('lesson_progress')
    .update({
      progress_percent: 0,
      completed_at: null,
    })
    .eq('user_id', userId)
    .eq('lesson_id', lessonId);

  if (error) {
    console.error('Error marking lesson incomplete:', error);
    return false;
  }
  return true;
}

export async function updateLessonProgress(
  userId: string,
  lessonId: string,
  progressPercent: number
): Promise<boolean> {
  const completed = progressPercent >= 100;

  const { error } = await supabase
    .from('lesson_progress')
    .upsert({
      user_id: userId,
      lesson_id: lessonId,
      progress_percent: progressPercent,
      completed_at: completed ? new Date().toISOString() : null,
    }, {
      onConflict: 'user_id,lesson_id',
    });

  if (error) {
    console.error('Error updating lesson progress:', error);
    return false;
  }
  return true;
}

// ============================================================================
// COURSE PURCHASE & ENROLLMENT
// ============================================================================

/**
 * Complete enrollment after successful payment
 * This is called when a paid course purchase succeeds
 */
export async function completeCoursePurchase(
  userId: string,
  courseId: string,
  paymentIntentId: string
): Promise<DbEnrollment | null> {
  // First check if already enrolled
  const existing = await getEnrollment(userId, courseId);
  if (existing) {
    console.log('User already enrolled in course');
    return existing;
  }

  // Create enrollment with payment reference in metadata
  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      user_id: userId,
      course_id: courseId,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error completing course purchase:', error);
    return null;
  }

  return data;
}

/**
 * Check if a course requires payment
 * For now, we check if the course has a price_cents field > 0
 * This will be expanded when the database schema includes course pricing
 */
export function courseRequiresPayment(course: DbCourse & { price_cents?: number }): boolean {
  return (course.price_cents ?? 0) > 0;
}

/**
 * Get course price in cents (for payment intent)
 * Returns 0 for free courses
 */
export function getCoursePrice(course: DbCourse & { price_cents?: number }): number {
  return course.price_cents ?? 0;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatDuration(minutes: number | null): string {
  if (!minutes) return '';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}`;
  }
  return `${mins}:00`;
}

// ============================================================================
// COURSE ANALYTICS
// ============================================================================

export interface CourseAnalytics {
  enrolledCount: number;
  completionRate: number;
  activeStudents: number;
  averageProgress: number;
  lessonCompletionRates: LessonCompletionRate[];
  studentProgress: StudentProgressEntry[];
}

export interface LessonCompletionRate {
  lessonId: string;
  lessonTitle: string;
  moduleName: string;
  completionRate: number;
  completedCount: number;
}

export interface StudentProgressEntry {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  enrolledAt: string;
  progressPercent: number;
  lastActivityAt: string | null;
  completedLessons: number;
  totalLessons: number;
}

export async function getCourseAnalytics(courseId: string): Promise<CourseAnalytics> {
  // Get enrollments with profile data
  const { data: enrollments, count: enrolledCount } = await supabase
    .from('enrollments')
    .select('*, profiles!user_id(full_name, avatar_url)', { count: 'exact' })
    .eq('course_id', courseId);

  // Get modules for this course
  const { data: modules } = await supabase
    .from('modules')
    .select('id, title')
    .eq('course_id', courseId);

  const moduleIds = modules?.map(m => m.id) || [];
  const moduleMap = new Map(modules?.map(m => [m.id, m.title]) || []);

  // Get lessons for this course
  const { data: lessons } = moduleIds.length > 0
    ? await supabase
        .from('lessons')
        .select('id, title, module_id')
        .in('module_id', moduleIds)
    : { data: [] };

  const lessonIds = lessons?.map(l => l.id) || [];

  // Get all lesson progress for this course
  const { data: progress } = lessonIds.length > 0
    ? await supabase
        .from('lesson_progress')
        .select('*')
        .in('lesson_id', lessonIds)
    : { data: [] };

  // Calculate completion rate
  const completedEnrollments = enrollments?.filter(e => e.status === 'completed').length || 0;
  const totalEnrolled = enrolledCount || 0;
  const completionRate = totalEnrolled > 0 ? Math.round((completedEnrollments / totalEnrolled) * 100) : 0;

  // Calculate per-lesson completion rates
  const lessonCompletionRates: LessonCompletionRate[] = (lessons || []).map(lesson => {
    const completedCount = progress?.filter(p =>
      p.lesson_id === lesson.id && p.completed_at
    ).length || 0;

    return {
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      moduleName: moduleMap.get(lesson.module_id) || 'Unknown Module',
      completionRate: totalEnrolled > 0 ? Math.round((completedCount / totalEnrolled) * 100) : 0,
      completedCount,
    };
  });

  // Build student progress list
  const studentProgress: StudentProgressEntry[] = (enrollments || []).map(enrollment => {
    const profile = enrollment.profiles as { full_name?: string; avatar_url?: string } | null;
    const userProgress = progress?.filter(p => p.user_id === enrollment.user_id) || [];
    const completedLessons = userProgress.filter(p => p.completed_at).length;
    const lastActivity = userProgress.reduce((latest, p) => {
      const updatedAt = new Date(p.updated_at);
      return updatedAt > latest ? updatedAt : latest;
    }, new Date(0));

    return {
      userId: enrollment.user_id,
      userName: profile?.full_name || 'Unknown',
      avatarUrl: profile?.avatar_url || null,
      enrolledAt: enrollment.enrolled_at,
      progressPercent: lessonIds.length > 0 ? Math.round((completedLessons / lessonIds.length) * 100) : 0,
      lastActivityAt: lastActivity.getTime() > 0 ? lastActivity.toISOString() : null,
      completedLessons,
      totalLessons: lessonIds.length,
    };
  });

  // Calculate active students (activity in last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeStudents = studentProgress.filter(s => {
    const lastActivity = s.lastActivityAt ? new Date(s.lastActivityAt) : null;
    return lastActivity && lastActivity > sevenDaysAgo;
  }).length;

  // Calculate average progress
  const averageProgress = studentProgress.length > 0
    ? Math.round(studentProgress.reduce((sum, s) => sum + s.progressPercent, 0) / studentProgress.length)
    : 0;

  return {
    enrolledCount: totalEnrolled,
    completionRate,
    activeStudents,
    averageProgress,
    lessonCompletionRates,
    studentProgress,
  };
}

// ============================================================================
// MODULE UNLOCK CHECK
// ============================================================================

/**
 * Check if a module is unlocked for a user based on unlock_type
 */
export async function isModuleUnlocked(
  module: DbModule,
  userId: string,
  previousModule?: ModuleWithLessons | null
): Promise<boolean> {
  // First module is always unlocked
  if (!previousModule) return true;

  switch (module.unlock_type) {
    case 'immediate':
      return true;

    case 'date':
      if (!module.unlock_value) return true;
      return new Date() >= new Date(module.unlock_value);

    case 'progress':
      if (!module.unlock_value) return true;
      const requiredProgress = parseInt(module.unlock_value, 10);
      if (isNaN(requiredProgress)) return true;
      const moduleProgress = await getModuleProgressPercent(previousModule.id, userId);
      return moduleProgress >= requiredProgress;

    case 'quiz':
      if (!module.unlock_value) return true;
      return hasPassedQuiz(module.unlock_value, userId);

    default:
      return true;
  }
}

/**
 * Get progress percentage for a module
 */
async function getModuleProgressPercent(moduleId: string, userId: string): Promise<number> {
  // Get lessons in module
  const { data: lessons, error: lessonsError } = await supabase
    .from('lessons')
    .select('id')
    .eq('module_id', moduleId);

  if (lessonsError || !lessons || lessons.length === 0) return 0;

  const lessonIds = lessons.map(l => l.id);

  // Get completed lessons
  const { data: progress, error: progressError } = await supabase
    .from('lesson_progress')
    .select('lesson_id')
    .eq('user_id', userId)
    .in('lesson_id', lessonIds)
    .not('completed_at', 'is', null);

  if (progressError) return 0;

  const completedCount = progress?.length || 0;
  return Math.round((completedCount / lessons.length) * 100);
}

/**
 * Get module unlock status for all modules in a course
 * Batches all DB queries upfront instead of querying per-module
 */
export async function getModulesUnlockStatus(
  modules: ModuleWithLessons[],
  userId: string
): Promise<Map<string, boolean>> {
  const unlockStatus = new Map<string, boolean>();
  if (modules.length === 0) return unlockStatus;

  // Collect all lesson IDs across all modules (for progress-based unlock checks)
  const allLessonIds: string[] = [];
  for (const mod of modules) {
    for (const lesson of mod.lessons || []) {
      allLessonIds.push(lesson.id);
    }
  }

  // Collect quiz lesson IDs needed for quiz-based unlock checks
  const quizLessonIds: string[] = [];
  for (const mod of modules) {
    if (mod.unlock_type === 'quiz' && mod.unlock_value) {
      quizLessonIds.push(mod.unlock_value);
    }
  }

  // Batch query 1: All completed lesson progress (for progress-based unlocks)
  const completedLessonIds = new Set<string>();
  if (allLessonIds.length > 0) {
    const { data: progress } = await supabase
      .from('lesson_progress')
      .select('lesson_id')
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .in('lesson_id', allLessonIds);

    (progress || []).forEach(p => completedLessonIds.add(p.lesson_id));
  }

  // Batch query 2: All passed quiz attempts (for quiz-based unlocks)
  const passedQuizLessonIds = new Set<string>();
  if (quizLessonIds.length > 0) {
    const { data: quizAttempts } = await supabase
      .from('quiz_attempts')
      .select('lesson_id')
      .eq('user_id', userId)
      .eq('passed', true)
      .in('lesson_id', quizLessonIds);

    (quizAttempts || []).forEach(a => passedQuizLessonIds.add(a.lesson_id));
  }

  // Evaluate unlock status in memory
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];

    // First module is always unlocked
    if (i === 0) {
      unlockStatus.set(mod.id, true);
      continue;
    }

    const previousModule = modules[i - 1];

    switch (mod.unlock_type) {
      case 'immediate':
        unlockStatus.set(mod.id, true);
        break;

      case 'date':
        if (!mod.unlock_value) {
          unlockStatus.set(mod.id, true);
        } else {
          unlockStatus.set(mod.id, new Date() >= new Date(mod.unlock_value));
        }
        break;

      case 'progress': {
        if (!mod.unlock_value) {
          unlockStatus.set(mod.id, true);
          break;
        }
        const requiredProgress = parseInt(mod.unlock_value, 10);
        if (isNaN(requiredProgress)) {
          unlockStatus.set(mod.id, true);
          break;
        }
        // Calculate previous module progress from pre-fetched data
        const prevLessons = previousModule.lessons || [];
        if (prevLessons.length === 0) {
          unlockStatus.set(mod.id, true);
          break;
        }
        const completedCount = prevLessons.filter(l => completedLessonIds.has(l.id)).length;
        const progressPercent = Math.round((completedCount / prevLessons.length) * 100);
        unlockStatus.set(mod.id, progressPercent >= requiredProgress);
        break;
      }

      case 'quiz':
        if (!mod.unlock_value) {
          unlockStatus.set(mod.id, true);
        } else {
          unlockStatus.set(mod.id, passedQuizLessonIds.has(mod.unlock_value));
        }
        break;

      default:
        unlockStatus.set(mod.id, true);
        break;
    }
  }

  return unlockStatus;
}
