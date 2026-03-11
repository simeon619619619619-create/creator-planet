import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PlayCircle, FileText, CheckCircle, ChevronRight, ChevronDown, Plus, GraduationCap, Loader2, BookOpen, Pencil, BarChart3, ArrowUp, ArrowDown, MessageCircle, HelpCircle, X, Sparkles, Menu, GripVertical, Star } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAuth } from '../../core/contexts/AuthContext';
import { useCommunity } from '../../core/contexts/CommunityContext';
import { getCourseInstructor } from '../direct-messages/teamService';
import type { TeamMemberWithProfile } from '../direct-messages/dmTypes';
import { Avatar } from '../../shared/Avatar';
import { getBadgeType } from '../direct-messages/dmTypes';
import { getCourseProof } from '../../shared/courseProof';
import type { CourseVoter } from '../../shared/courseProof';

// ============================================================================
// MODAL STATE PERSISTENCE
// Preserves which modal is open when user switches tabs or auth token refreshes
// ============================================================================
interface ModalState {
  lessonModal?: { moduleId: string; lessonId: string | null };
  moduleModal?: { courseId: string; moduleId: string | null };
  courseModal?: { courseId: string };
  // Also persist the selected course so we can restore the view
  selectedCourseId?: string;
}

const MODAL_STATE_KEY = 'course-lms-modal-state';

const saveModalState = (state: ModalState | null) => {
  try {
    if (state && Object.keys(state).length > 0) {
      sessionStorage.setItem(MODAL_STATE_KEY, JSON.stringify(state));
    } else {
      sessionStorage.removeItem(MODAL_STATE_KEY);
    }
  } catch (e) {
    console.warn('Failed to save modal state:', e);
  }
};

const loadModalState = (): ModalState | null => {
  try {
    const stored = sessionStorage.getItem(MODAL_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load modal state:', e);
    return null;
  }
};

const clearModalState = () => {
  try {
    sessionStorage.removeItem(MODAL_STATE_KEY);
  } catch (e) {
    console.warn('Failed to clear modal state:', e);
  }
};
import {
  getCreatorCourses,
  getEnrolledCourses,
  getAvailableCourses,
  getCourseWithDetails,
  createCourse,
  enrollInCourse,
  markLessonComplete,
  markLessonIncomplete,
  formatDuration,
  reorderModules,
  reorderLessons,
  reorderCourses,
  CourseWithModules,
  ModuleWithLessons,
  LessonWithProgress,
} from './courseService';
import { DbCourse, DbModule, DbLesson } from '../../core/supabase/database.types';
import { supabase } from '../../core/supabase/client';
import CourseAiHelper from './CourseAiHelper';
import CourseEditModal from './components/CourseEditModal';
import ModuleEditModal from './components/ModuleEditModal';
import LessonEditModal from './components/LessonEditModal';
import CourseAnalyticsPanel from './components/CourseAnalyticsPanel';
import CoursePurchaseModal from './components/CoursePurchaseModal';
import CourseEnrollButton from './components/CourseEnrollButton';
import VideoPlayer from './components/VideoPlayer';
import QuizPlayer from './components/QuizPlayer';
import { useCourseLimitCheck, UpgradePrompt } from '../billing';

// ============================================================================
// SORTABLE COURSE CARD COMPONENT
// ============================================================================
interface SortableCourseCardProps {
  course: CourseWithModules;
  isCreator: boolean;
  communityMembers: CourseVoter[];
  onSelect: (course: CourseWithModules) => void;
  onEdit: (course: CourseWithModules) => void;
  onShowAnalytics: (courseId: string) => void;
  t: (key: string) => string;
}

const SortableCourseCard: React.FC<SortableCourseCardProps> = ({
  course,
  isCreator,
  communityMembers,
  onSelect,
  onEdit,
  onShowAnalytics,
  t,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: course.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden hover:border-[#333333] transition-colors group relative"
    >
      {/* Drag handle - only for creators */}
      {isCreator && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-3 left-3 z-10 p-2 bg-[#0A0A0A]/90 hover:bg-[#0A0A0A] rounded-lg transition-colors cursor-grab active:cursor-grabbing"
          title={t('courseLms.tooltip.dragToReorder')}
        >
          <GripVertical size={16} className="text-[#666666]" />
        </button>
      )}

      <div
        className="relative h-48 overflow-hidden bg-[#1F1F1F] cursor-pointer"
        onClick={() => onSelect(course)}
      >
        {course.thumbnail_url ? (
          <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-white/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute bottom-4 left-4 text-white">
          <span className={`text-xs font-semibold px-2 py-1 rounded mb-2 inline-block ${course.is_published ? 'bg-[#22C55E]' : 'bg-[#EAB308]'}`}>
            {course.is_published ? t('courseLms.courseCard.published') : t('courseLms.courseCard.draft')}
          </span>
          <h3 className="font-bold text-lg">{course.title}</h3>
          {/* Rating & voter avatars */}
          {(() => {
            const proof = getCourseProof(course.id, communityMembers);
            return (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={12}
                      className={
                        star <= Math.round(proof.rating)
                          ? 'text-[#EAB308] fill-[#EAB308]'
                          : 'text-white/30'
                      }
                    />
                  ))}
                  <span className="text-xs text-white/70 ml-0.5">
                    {proof.rating}
                  </span>
                </div>
                {proof.displayVoters.length > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <div className="flex -space-x-1.5">
                      {proof.displayVoters.map((voter, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border border-black/60 overflow-hidden bg-[#1F1F1F] flex-shrink-0"
                          title={voter.full_name}
                        >
                          {voter.avatar_url ? (
                            <img src={voter.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="flex items-center justify-center w-full h-full text-[9px] text-white/50 font-medium">
                              {voter.full_name.charAt(0)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <span className="text-[11px] text-white/50">
                      +{proof.votes - proof.displayVoters.length}
                    </span>
                  </>
                )}
              </div>
            );
          })()}
        </div>
        {/* Creator action buttons */}
        {isCreator && (
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(course);
              }}
              className="p-2 bg-[#0A0A0A]/90 hover:bg-[#0A0A0A] rounded-lg transition-colors"
              title={t('courseLms.tooltip.editCourse')}
            >
              <Pencil size={16} className="text-[#A0A0A0]" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShowAnalytics(course.id);
              }}
              className="p-2 bg-[#0A0A0A]/90 hover:bg-[#0A0A0A] rounded-lg transition-colors"
              title={t('courseLms.tooltip.viewAnalytics')}
            >
              <BarChart3 size={16} className="text-[#A0A0A0]" />
            </button>
          </div>
        )}
      </div>
      <div className="p-4 cursor-pointer" onClick={() => onSelect(course)}>
        <p className="text-[#A0A0A0] text-sm line-clamp-2">{course.description || t('courseLms.courseCard.noDescription')}</p>
        <div className="mt-4 pt-4 border-t border-[#1F1F1F] flex justify-between items-center">
          <span className="text-xs text-[#666666]">
            {course.modules.length} Module{course.modules.length !== 1 ? 's' : ''} · {totalLessons} Lesson{totalLessons !== 1 ? 's' : ''}
          </span>
          {course.progress_percent !== undefined && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-[#1F1F1F] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#22C55E] transition-all"
                  style={{ width: `${course.progress_percent}%` }}
                />
              </div>
              <span className="text-xs text-[#666666]">{course.progress_percent}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CourseLMS: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile, role } = useAuth();
  const { selectedCommunity } = useCommunity();
  const [searchParams, setSearchParams] = useSearchParams();

  // Plan limits check for course creation
  const courseLimit = useCourseLimitCheck();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false);

  // State
  const [courses, setCourses] = useState<CourseWithModules[]>([]);
  const [availableCourses, setAvailableCourses] = useState<DbCourse[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithModules | null>(null);
  const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<LessonWithProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState<string | null>(null);

  // Creator mode state
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');

  // Course editing modals
  const [editingCourse, setEditingCourse] = useState<DbCourse | null>(null);
  const [showAnalytics, setShowAnalytics] = useState<string | null>(null);

  // Module editing
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState<DbModule | null>(null);
  const [moduleForCourse, setModuleForCourse] = useState<string>('');

  // Lesson editing
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<DbLesson | null>(null);
  const [lessonForModule, setLessonForModule] = useState<string>('');

  // Course purchase
  const [purchasingCourse, setPurchasingCourse] = useState<DbCourse | null>(null);

  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Course instructor (for "Message Instructor" button)
  const [courseInstructor, setCourseInstructor] = useState<TeamMemberWithProfile | null>(null);
  const navigate = useNavigate();

  // Community members for social proof voter avatars
  const [communityMembers, setCommunityMembers] = useState<CourseVoter[]>([]);

  // DnD sensors for course reordering
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle course drag end - reorder courses
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = courses.findIndex(c => c.id === active.id);
    const newIndex = courses.findIndex(c => c.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update the UI
    const reorderedCourses = arrayMove(courses, oldIndex, newIndex);
    setCourses(reorderedCourses);

    // Persist the new order to the database
    const courseOrders = reorderedCourses.map((course, index) => ({
      id: course.id,
      display_order: index,
    }));

    const success = await reorderCourses(courseOrders);
    if (!success) {
      // Revert on failure
      setCourses(courses);
      console.error('Failed to reorder courses');
    }
  }, [courses]);

  // Handle payment success URL param (from 3DS redirect)
  useEffect(() => {
    const paymentSuccess = searchParams.get('payment');
    if (paymentSuccess === 'success') {
      setShowPaymentSuccess(true);
      // Clear URL params
      setSearchParams({});
      // Refresh courses to show enrollment
      loadCourses();
      // Auto-hide after 6 seconds
      setTimeout(() => setShowPaymentSuccess(false), 6000);
    }
  }, [searchParams, setSearchParams]);

  // Reset selected course when community changes
  useEffect(() => {
    // Clear course selection when switching communities to prevent showing
    // courses that don't belong to the newly selected community
    setSelectedCourse(null);
    setActiveModuleId(null);
    setActiveLesson(null);
  }, [selectedCommunity]);

  // Load courses on mount and when community changes
  useEffect(() => {
    loadCourses();
  }, [user, profile, role, selectedCommunity]);

  // Fetch community members for social proof voter avatars
  useEffect(() => {
    if (!selectedCommunity) {
      setCommunityMembers([]);
      return;
    }
    (async () => {
      const { data: members } = await supabase
        .from('memberships')
        .select('user_id, profiles!memberships_user_id_fkey(full_name, avatar_url)')
        .eq('community_id', selectedCommunity.id);

      const voters: CourseVoter[] = [];
      members?.forEach((m: any) => {
        const p = m.profiles;
        if (p?.full_name) voters.push({ full_name: p.full_name, avatar_url: p.avatar_url });
      });
      setCommunityMembers(voters);
    })();
  }, [selectedCommunity]);

  // Restore modal state on mount (after tab switch or auth refresh)
  useEffect(() => {
    const savedState = loadModalState();
    if (savedState) {
      if (savedState.lessonModal) {
        setLessonForModule(savedState.lessonModal.moduleId);
        // editingLesson will be null for create mode, which is correct
        // The form data is restored from sessionStorage by LessonEditModal
        setShowLessonModal(true);
      }
      if (savedState.moduleModal) {
        setModuleForCourse(savedState.moduleModal.courseId);
        setShowModuleModal(true);
      }
    }
  }, []); // Only run once on mount

  // Restore selected course when courses are loaded (needed for modal to be visible)
  useEffect(() => {
    // Only run when courses have loaded and we don't already have a selected course
    if (courses.length > 0 && !selectedCourse) {
      const savedState = loadModalState();
      if (savedState?.selectedCourseId) {
        const courseToRestore = courses.find(c => c.id === savedState.selectedCourseId);
        if (courseToRestore) {
          setSelectedCourse(courseToRestore);
          // Also restore active module if possible
          if (courseToRestore.modules.length > 0) {
            setActiveModuleId(courseToRestore.modules[0].id);
          }
        }
      }
    }
  }, [courses, selectedCourse]); // Run when courses load

  // Load instructor info when course is selected (for students to message)
  useEffect(() => {
    const loadInstructor = async () => {
      if (selectedCourse && role !== 'creator' && role !== 'superadmin') {
        const instructor = await getCourseInstructor(selectedCourse.id);
        setCourseInstructor(instructor);
      } else {
        setCourseInstructor(null);
      }
    };
    loadInstructor();
  }, [selectedCourse, role]);

  const handleMessageInstructor = () => {
    if (courseInstructor && selectedCommunity) {
      // Navigate to community with chat open for this team member
      navigate(`/community?openChat=${courseInstructor.id}`);
    }
  };

  const loadCourses = async () => {
    if (!user || !profile) return;
    setIsLoading(true);

    try {
      let courseList: CourseWithModules[] = [];

      if (role === 'creator' || role === 'superadmin') {
        // Creators see their own courses filtered by selected community
        // Use profile.id because courses.creator_id references profiles.id
        const creatorCourses = await getCreatorCourses(profile!.id);
        // Filter by selected community - only show courses for the selected community
        const filteredCourses = selectedCommunity
          ? creatorCourses.filter(c => c.community_id === selectedCommunity.id)
          : []; // Don't show courses if no community is selected
        // Get full details for each course
        for (const course of filteredCourses) {
          const details = await getCourseWithDetails(course.id, profile!.id);
          if (details) courseList.push(details);
        }
      } else {
        // Students see enrolled courses filtered by selected community
        // Use profile.id because enrollments.user_id references profiles.id
        const allEnrolledCourses = await getEnrolledCourses(profile!.id);
        // Filter by selected community if one is selected
        courseList = selectedCommunity
          ? allEnrolledCourses.filter(c => c.community_id === selectedCommunity.id)
          : []; // Don't show courses if no community is selected

        // Also load available courses to enroll in, filtered by selected community
        const allAvailable = await getAvailableCourses(profile!.id);
        const filteredAvailable = selectedCommunity
          ? allAvailable.filter(c => c.community_id === selectedCommunity.id)
          : [];
        setAvailableCourses(filteredAvailable);
      }

      setCourses(courseList);
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async (courseId: string) => {
    if (!user || !profile) return;
    setIsEnrolling(courseId);

    try {
      // Use profile.id because enrollments.user_id references profiles.id
      const enrollment = await enrollInCourse(profile.id, courseId);
      if (enrollment) {
        // Reload courses to show the newly enrolled course
        await loadCourses();
      }
    } catch (error) {
      console.error('Error enrolling in course:', error);
    } finally {
      setIsEnrolling(null);
    }
  };

  // Handle course purchase (for paid courses)
  const handlePurchaseCourse = (course: DbCourse) => {
    setPurchasingCourse(course);
  };

  const handlePurchaseSuccess = async () => {
    // Close modal and reload courses
    setPurchasingCourse(null);
    await loadCourses();
  };

  const handleSelectCourse = (course: CourseWithModules) => {
    setSelectedCourse(course);
    if (course.modules.length > 0) {
      setActiveModuleId(course.modules[0].id);
      if (course.modules[0].lessons.length > 0) {
        setActiveLesson(course.modules[0].lessons[0]);
      }
    }
  };

  const handleCreateCourse = async () => {
    if (!user || !profile || !newCourseName.trim()) return;

    // Pass the profile ID (not user.id) because courses.creator_id references profiles.id
    const course = await createCourse(
      profile.id,
      newCourseName.trim(),
      newCourseDescription.trim() || undefined,
      undefined, // thumbnailUrl
      selectedCommunity?.id // communityId - associates course with the creator's selected community
    );
    if (course) {
      // Reload courses to get the new one with details
      await loadCourses();
      setNewCourseName('');
      setNewCourseDescription('');
      setShowCreateCourse(false);
    }
  };

  // Handler for opening the create course modal with limit check
  const handleOpenCreateCourse = () => {
    // Check if creator has reached their course limit
    if (!courseLimit.allowed) {
      setShowUpgradePrompt(true);
      return;
    }
    setShowCreateCourse(true);
  };

  const handleToggleComplete = async (lesson: LessonWithProgress) => {
    if (!user || !profile) return;

    setIsUpdating(true);
    try {
      // Use profile.id because lesson_progress.user_id references profiles.id
      if (lesson.is_completed) {
        await markLessonIncomplete(profile.id, lesson.id);
      } else {
        await markLessonComplete(profile.id, lesson.id);
      }

      // Reload the course to get updated progress
      if (selectedCourse) {
        const updated = await getCourseWithDetails(selectedCourse.id, profile.id);
        if (updated) {
          setSelectedCourse(updated);
          // Update the active lesson reference
          const updatedLesson = updated.modules
            .flatMap(m => m.lessons)
            .find(l => l.id === lesson.id);
          if (updatedLesson) {
            setActiveLesson(updatedLesson);
          }
        }
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Course editing handlers
  const handleCourseEditSave = async (updatedCourse: DbCourse) => {
    setEditingCourse(null);
    await loadCourses();
  };

  const handleCourseDelete = async () => {
    setEditingCourse(null);
    await loadCourses();
  };

  // Module handlers
  const handleAddModule = (courseId: string) => {
    setModuleForCourse(courseId);
    setEditingModule(null);
    setShowModuleModal(true);
    // Persist modal state for tab switching (include selectedCourseId so view is restored too)
    saveModalState({
      moduleModal: { courseId, moduleId: null },
      selectedCourseId: selectedCourse?.id
    });
  };

  const handleEditModule = (module: DbModule) => {
    setModuleForCourse(module.course_id);
    setEditingModule(module);
    setShowModuleModal(true);
    // Persist modal state for tab switching (include selectedCourseId so view is restored too)
    saveModalState({
      moduleModal: { courseId: module.course_id, moduleId: module.id },
      selectedCourseId: selectedCourse?.id
    });
  };

  const handleModuleSave = async (savedModule: DbModule) => {
    setShowModuleModal(false);
    setEditingModule(null);
    clearModalState(); // Clear persisted state on successful save
    // Reload the selected course to get updated modules
    if (selectedCourse) {
      const updated = await getCourseWithDetails(selectedCourse.id, profile?.id);
      if (updated) setSelectedCourse(updated);
    }
  };

  const handleModuleDelete = async () => {
    setShowModuleModal(false);
    setEditingModule(null);
    clearModalState(); // Clear persisted state on delete
    if (selectedCourse) {
      const updated = await getCourseWithDetails(selectedCourse.id, profile?.id);
      if (updated) setSelectedCourse(updated);
    }
  };

  // Lesson handlers
  const handleAddLesson = (moduleId: string) => {
    setLessonForModule(moduleId);
    setEditingLesson(null);
    setShowLessonModal(true);
    // Persist modal state for tab switching (include selectedCourseId so view is restored too)
    saveModalState({
      lessonModal: { moduleId, lessonId: null },
      selectedCourseId: selectedCourse?.id
    });
  };

  const handleEditLesson = (lesson: DbLesson) => {
    setLessonForModule(lesson.module_id);
    setEditingLesson(lesson);
    setShowLessonModal(true);
    // Persist modal state for tab switching (include selectedCourseId so view is restored too)
    saveModalState({
      lessonModal: { moduleId: lesson.module_id, lessonId: lesson.id },
      selectedCourseId: selectedCourse?.id
    });
  };

  const handleLessonSave = async (savedLesson: DbLesson) => {
    setShowLessonModal(false);
    setEditingLesson(null);
    clearModalState(); // Clear persisted state on successful save
    if (selectedCourse) {
      const updated = await getCourseWithDetails(selectedCourse.id, profile?.id);
      if (updated) setSelectedCourse(updated);
    }
  };

  const handleLessonDelete = async () => {
    setShowLessonModal(false);
    setEditingLesson(null);
    setActiveLesson(null);
    clearModalState(); // Clear persisted state on delete
    if (selectedCourse) {
      const updated = await getCourseWithDetails(selectedCourse.id, profile?.id);
      if (updated) setSelectedCourse(updated);
    }
  };

  // Reorder handlers
  const handleMoveModule = async (moduleId: string, direction: 'up' | 'down') => {
    if (!selectedCourse) return;
    const modules = [...selectedCourse.modules];
    const index = modules.findIndex(m => m.id === moduleId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === modules.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [modules[index], modules[newIndex]] = [modules[newIndex], modules[index]];

    // Update positions
    const moduleOrders = modules.map((m, i) => ({ id: m.id, position: i }));
    await reorderModules(moduleOrders);

    // Reload
    const updated = await getCourseWithDetails(selectedCourse.id, profile?.id);
    if (updated) setSelectedCourse(updated);
  };

  const handleMoveLesson = async (lessonId: string, moduleId: string, direction: 'up' | 'down') => {
    if (!selectedCourse) return;
    const module = selectedCourse.modules.find(m => m.id === moduleId);
    if (!module) return;

    const lessons = [...module.lessons];
    const index = lessons.findIndex(l => l.id === lessonId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === lessons.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [lessons[index], lessons[newIndex]] = [lessons[newIndex], lessons[index]];

    // Update positions
    const lessonOrders = lessons.map((l, i) => ({ id: l.id, position: i }));
    await reorderLessons(lessonOrders);

    // Reload
    const updated = await getCourseWithDetails(selectedCourse.id, profile?.id);
    if (updated) setSelectedCourse(updated);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#FAFAFA]" />
      </div>
    );
  }

  // Show empty state for enrolled courses - but show available courses if any
  if (!selectedCourse && courses.length === 0) {
    // For students with available courses, show them
    if (role !== 'creator' && role !== 'superadmin' && availableCourses.length > 0) {
      return (
        <div className="max-w-7xl mx-auto p-6">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#FAFAFA] mb-2">{t('courseLms.pageTitle.myLearning')}</h1>
            <p className="text-[#666666]">{t('courseLms.emptyState.notEnrolledYet')}</p>
          </div>

          <h2 className="text-lg font-semibold text-[#FAFAFA] mb-4">{t('courseLms.section.availableCourses')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {availableCourses.map(course => (
              <div
                key={course.id}
                className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden"
              >
                <div className="relative h-48 overflow-hidden bg-[#1F1F1F]">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <BookOpen className="w-16 h-16 text-white/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="absolute bottom-4 left-4 text-white">
                    <h3 className="font-bold text-lg">{course.title}</h3>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[#A0A0A0] text-sm line-clamp-2 mb-4">{course.description || t('courseLms.courseCard.noDescription')}</p>
                  <CourseEnrollButton
                    course={course}
                    isEnrolling={isEnrolling === course.id}
                    onEnroll={() => handleEnroll(course.id)}
                    onPurchase={() => handlePurchaseCourse(course)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default empty state (no available courses or creator mode)
    return (
      <div className="max-w-2xl mx-auto p-6 text-center">
        <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-12">
          <GraduationCap className="w-16 h-16 text-[#666666] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">
            {!selectedCommunity
              ? t('courseLms.emptyState.selectCommunity')
              : role === 'creator'
                ? t('courseLms.emptyState.noCoursesYet')
                : t('courseLms.emptyState.notEnrolledInAnyCourses')
            }
          </h2>
          <p className="text-[#666666] mb-6">
            {!selectedCommunity
              ? t('courseLms.emptyState.selectCommunityDescription')
              : role === 'creator'
                ? t('courseLms.emptyState.createFirstCourse')
                : t('courseLms.emptyState.joinCommunityToAccess')
            }
          </p>
          {role === 'creator' && selectedCommunity && (
            <button
              onClick={handleOpenCreateCourse}
              className="bg-white text-black px-6 py-3 rounded-lg font-medium hover:bg-[#E0E0E0] inline-flex items-center gap-2"
            >
              <Plus size={20} />
              {t('courseLms.button.createCourse')}
            </button>
          )}
        </div>

        {/* Create Course Modal */}
        {showCreateCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#0A0A0A] rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">{t('courseLms.button.createCourse')}</h3>
              {selectedCommunity ? (
                <p className="text-sm text-[#666666] mb-4">
                  {t('courseLms.communityInfo.courseWillBeAddedTo')} <span className="font-medium text-[#A0A0A0]">{selectedCommunity.name}</span>
                </p>
              ) : (
                <p className="text-sm text-[#EAB308] mb-4">
                  {t('courseLms.communityInfo.selectCommunityFirstToCreate')}
                </p>
              )}
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder={t('courseLms.createCourseModal.courseTitle')}
                className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] mb-3"
                disabled={!selectedCommunity}
              />
              <textarea
                value={newCourseDescription}
                onChange={(e) => setNewCourseDescription(e.target.value)}
                placeholder={t('courseLms.createCourseModal.courseDescription')}
                className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] h-24 resize-none"
                disabled={!selectedCommunity}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setShowCreateCourse(false)}
                  className="flex-1 px-4 py-2 border border-[#1F1F1F] rounded-lg hover:bg-[#0A0A0A]"
                >
                  {t('courseLms.button.cancel')}
                </button>
                <button
                  onClick={handleCreateCourse}
                  disabled={!selectedCommunity}
                  className="flex-1 bg-white text-black px-4 py-2 rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('courseLms.button.create')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!selectedCourse) {
    // Course Listing View
    return (
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        {/* Payment Success Banner */}
        {showPaymentSuccess && (
          <div className="mb-6 animate-in slide-in-from-top duration-300">
            <div className="bg-[#22C55E]/10 border border-[#22C55E]/30 text-[#FAFAFA] px-6 py-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-[#0A0A0A]/20 rounded-full p-2">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-semibold text-lg">{t('courseLms.payment.successTitle')}</p>
                  <p className="text-[#22C55E] text-sm">{t('courseLms.payment.successMessage')}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPaymentSuccess(false)}
                className="p-2 hover:bg-[#0A0A0A]/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-[#FAFAFA]">
              {role === 'creator' ? t('courseLms.pageTitle.myCourses') : t('courseLms.pageTitle.myLearning')}
            </h1>
            {selectedCommunity && (
              <p className="text-sm text-[#666666] mt-1">
                {t('courseLms.communityInfo.showingCoursesFor')} <span className="font-medium text-[#A0A0A0]">{selectedCommunity.name}</span>
              </p>
            )}
          </div>
          {role === 'creator' && (
            <button
              onClick={handleOpenCreateCourse}
              className="bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-[#E0E0E0] inline-flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Plus size={18} />
              {t('courseLms.button.newCourse')}
            </button>
          )}
        </div>

        {/* Enrolled Courses */}
        <h2 className="text-lg font-semibold text-[#FAFAFA] mb-4">
          {role === 'creator' || role === 'superadmin' ? t('courseLms.section.yourCourses') : t('courseLms.section.continueLearning')}
        </h2>
        {(role === 'creator' || role === 'superadmin') ? (
          // Creator view with drag-and-drop reordering
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={courses.map(c => c.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map(course => (
                  <SortableCourseCard
                    key={course.id}
                    course={course}
                    isCreator={true}
                    communityMembers={communityMembers}
                    onSelect={handleSelectCourse}
                    onEdit={setEditingCourse}
                    onShowAnalytics={setShowAnalytics}
                    t={t}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          // Student view without drag-and-drop
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map(course => {
              const totalLessons = course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
              return (
                <div
                  key={course.id}
                  className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden hover:border-[#333333] transition-colors group"
                >
                  <div
                    className="relative h-48 overflow-hidden bg-[#1F1F1F] cursor-pointer"
                    onClick={() => handleSelectCourse(course)}
                  >
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" decoding="async" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-16 h-16 text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute bottom-4 left-4 text-white">
                      <span className={`text-xs font-semibold px-2 py-1 rounded mb-2 inline-block ${course.is_published ? 'bg-[#22C55E]' : 'bg-[#EAB308]'}`}>
                        {course.is_published ? t('courseLms.courseCard.published') : t('courseLms.courseCard.draft')}
                      </span>
                      <h3 className="font-bold text-lg">{course.title}</h3>
                    </div>
                  </div>
                  <div className="p-4 cursor-pointer" onClick={() => handleSelectCourse(course)}>
                    <p className="text-[#A0A0A0] text-sm line-clamp-2">{course.description || t('courseLms.courseCard.noDescription')}</p>
                    <div className="mt-4 pt-4 border-t border-[#1F1F1F] flex justify-between items-center">
                      <span className="text-xs text-[#666666]">
                        {course.modules.length} Module{course.modules.length !== 1 ? 's' : ''} · {totalLessons} Lesson{totalLessons !== 1 ? 's' : ''}
                      </span>
                      {course.progress_percent !== undefined && (
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-2 bg-[#1F1F1F] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#22C55E] transition-all"
                              style={{ width: `${course.progress_percent}%` }}
                            />
                          </div>
                          <span className="text-xs text-[#666666]">{course.progress_percent}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Available Courses for Students */}
        {role !== 'creator' && role !== 'superadmin' && availableCourses.length > 0 && (
          <>
            <h2 className="text-lg font-semibold text-[#FAFAFA] mt-10 mb-4">{t('courseLms.section.availableCourses')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableCourses.map(course => (
                <div
                  key={course.id}
                  className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] overflow-hidden"
                >
                  <div className="relative h-48 overflow-hidden bg-[#1F1F1F]">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt={course.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <BookOpen className="w-16 h-16 text-white/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40" />
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="font-bold text-lg">{course.title}</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-[#A0A0A0] text-sm line-clamp-2 mb-4">{course.description || t('courseLms.courseCard.noDescription')}</p>
                    <CourseEnrollButton
                      course={course}
                      isEnrolling={isEnrolling === course.id}
                      onEnroll={() => handleEnroll(course.id)}
                      onPurchase={() => handlePurchaseCourse(course)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Create Course Modal */}
        {showCreateCourse && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#0A0A0A] rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">{t('courseLms.button.createCourse')}</h3>
              {selectedCommunity ? (
                <p className="text-sm text-[#666666] mb-4">
                  {t('courseLms.communityInfo.courseWillBeAddedTo')} <span className="font-medium text-[#A0A0A0]">{selectedCommunity.name}</span>
                </p>
              ) : (
                <p className="text-sm text-[#EAB308] mb-4">
                  {t('courseLms.communityInfo.selectCommunityFirstToCreate')}
                </p>
              )}
              <input
                type="text"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder={t('courseLms.createCourseModal.courseTitle')}
                className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] mb-3"
                autoFocus
                disabled={!selectedCommunity}
              />
              <textarea
                value={newCourseDescription}
                onChange={(e) => setNewCourseDescription(e.target.value)}
                placeholder={t('courseLms.createCourseModal.courseDescription')}
                className="w-full px-4 py-2 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] h-24 resize-none"
                disabled={!selectedCommunity}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowCreateCourse(false);
                    setNewCourseName('');
                    setNewCourseDescription('');
                  }}
                  className="flex-1 px-4 py-2 border border-[#1F1F1F] rounded-lg hover:bg-[#0A0A0A]"
                >
                  {t('courseLms.button.cancel')}
                </button>
                <button
                  onClick={handleCreateCourse}
                  disabled={!newCourseName.trim() || !selectedCommunity}
                  className="flex-1 bg-white text-black px-4 py-2 rounded-lg hover:bg-[#E0E0E0] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('courseLms.button.create')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Course Edit Modal */}
        {editingCourse && (
          <CourseEditModal
            course={editingCourse}
            isOpen={!!editingCourse}
            onClose={() => setEditingCourse(null)}
            onSave={handleCourseEditSave}
            onDelete={handleCourseDelete}
          />
        )}

        {/* Course Analytics Panel */}
        {showAnalytics && (
          <CourseAnalyticsPanel
            courseId={showAnalytics}
            courseName={courses.find(c => c.id === showAnalytics)?.title || 'Course'}
            isOpen={!!showAnalytics}
            onClose={() => setShowAnalytics(null)}
          />
        )}
      </div>
    );
  }

  // Course Player View
  return (
    <div className="flex h-[calc(100dvh-64px)] overflow-hidden">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={() => setIsMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-20 left-4 z-40 bg-white text-black p-3 rounded-full hover:bg-[#E0E0E0] transition-colors shadow-lg"
        aria-label="Open course menu"
      >
        <Menu size={24} />
      </button>

      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-80 bg-[#0A0A0A] border-r border-[#1F1F1F] overflow-y-auto flex flex-col min-h-0
        transform transition-transform duration-200 ease-in-out
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 border-b border-[#1F1F1F] sticky top-0 bg-[#0A0A0A] z-10">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedCourse(null);
                setIsMobileSidebarOpen(false);
              }}
              className="text-xs font-semibold text-[#666666] hover:text-[#FAFAFA] block"
            >
              {t('courseLms.button.backToCourses')}
            </button>
            <button
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden p-1 text-[#666666] hover:text-[#A0A0A0]"
            >
              <X size={20} />
            </button>
          </div>
          <h2 className="font-bold text-[#FAFAFA] leading-tight">{selectedCourse.title}</h2>
          {selectedCourse.progress_percent !== undefined && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-2 bg-[#1F1F1F] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#22C55E] transition-all"
                  style={{ width: `${selectedCourse.progress_percent}%` }}
                />
              </div>
              <span className="text-xs text-[#666666]">{selectedCourse.progress_percent}%</span>
            </div>
          )}
        </div>

        <div className="flex-1 py-2">
          {/* Add Module Button for Creators */}
          {(role === 'creator' || role === 'superadmin') && (
            <button
              onClick={() => handleAddModule(selectedCourse.id)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-[#FAFAFA] hover:bg-[#1F1F1F] transition-colors"
            >
              <Plus size={16} />
              {t('courseLms.module.addModule')}
            </button>
          )}

          {selectedCourse.modules.length === 0 ? (
            <div className="p-4 text-center text-[#666666]">
              <p className="text-sm">{t('courseLms.module.noModulesYet')}</p>
              {(role === 'creator' || role === 'superadmin') && (
                <p className="text-xs mt-1">{t('courseLms.module.addModulesToBuild')}</p>
              )}
            </div>
          ) : (
            selectedCourse.modules.map((module, moduleIndex) => (
              <div key={module.id} className="mb-1">
                <div className="flex items-center bg-[#0A0A0A] hover:bg-[#1F1F1F] transition-colors">
                  <button
                    onClick={() => setActiveModuleId(activeModuleId === module.id ? null : module.id)}
                    className="flex-1 flex items-center justify-between px-4 py-3"
                  >
                    <span className="font-semibold text-sm text-[#A0A0A0]">{module.title}</span>
                    {activeModuleId === module.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  {/* Module actions for creators */}
                  {(role === 'creator' || role === 'superadmin') && (
                    <div className="flex items-center gap-1 pr-2">
                      <button
                        onClick={() => handleMoveModule(module.id, 'up')}
                        disabled={moduleIndex === 0}
                        className="p-1 text-[#666666] hover:text-[#A0A0A0] disabled:opacity-30"
                        title={t('courseLms.tooltip.moveUp')}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => handleMoveModule(module.id, 'down')}
                        disabled={moduleIndex === selectedCourse.modules.length - 1}
                        className="p-1 text-[#666666] hover:text-[#A0A0A0] disabled:opacity-30"
                        title={t('courseLms.tooltip.moveDown')}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        onClick={() => handleEditModule(module)}
                        className="p-1 text-[#666666] hover:text-[#FAFAFA]"
                        title={t('courseLms.tooltip.editModule')}
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {activeModuleId === module.id && (
                  <div className="bg-[#0A0A0A]">
                    {/* Add Lesson Button for Creators */}
                    {(role === 'creator' || role === 'superadmin') && (
                      <button
                        onClick={() => handleAddLesson(module.id)}
                        className="w-full flex items-center gap-2 px-6 py-2 text-xs text-[#FAFAFA] hover:bg-[#1F1F1F] transition-colors border-l-4 border-transparent"
                      >
                        <Plus size={14} />
                        {t('courseLms.lesson.addLesson')}
                      </button>
                    )}

                    {module.lessons.length === 0 ? (
                      <div className="px-6 py-3 text-xs text-[#666666]">
                        {t('courseLms.lesson.noLessonsInModule')}
                      </div>
                    ) : (
                      module.lessons.map((lesson, lessonIndex) => (
                        <div
                          key={lesson.id}
                          className={`flex items-center border-l-4 transition-colors
                            ${activeLesson?.id === lesson.id
                              ? 'border-white bg-[#1F1F1F]/50'
                              : 'border-transparent hover:bg-[#0A0A0A]'}
                          `}
                        >
                          <button
                            onClick={() => {
                              setActiveLesson(lesson);
                              setIsMobileSidebarOpen(false);
                            }}
                            className="flex-1 flex items-center gap-3 px-6 py-3 text-left"
                          >
                            <div className={`shrink-0 ${lesson.is_completed ? 'text-[#22C55E]' : 'text-[#666666]'}`}>
                              {lesson.is_completed ? (
                                <CheckCircle size={16} />
                              ) : lesson.type === 'video' ? (
                                <PlayCircle size={16} />
                              ) : lesson.type === 'quiz' ? (
                                <HelpCircle size={16} />
                              ) : (
                                <FileText size={16} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium ${activeLesson?.id === lesson.id ? 'text-[#FAFAFA]' : 'text-[#A0A0A0]'}`}>
                                {lesson.title}
                              </p>
                              {lesson.duration_minutes && (
                                <span className="text-xs text-[#666666]">
                                  {formatDuration(lesson.duration_minutes)}
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Lesson actions for creators */}
                          {(role === 'creator' || role === 'superadmin') && (
                            <div className="flex items-center gap-1 pr-3">
                              <button
                                onClick={() => handleMoveLesson(lesson.id, module.id, 'up')}
                                disabled={lessonIndex === 0}
                                className="p-1 text-[#666666] hover:text-[#A0A0A0] disabled:opacity-30"
                                title={t('courseLms.tooltip.moveUp')}
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button
                                onClick={() => handleMoveLesson(lesson.id, module.id, 'down')}
                                disabled={lessonIndex === module.lessons.length - 1}
                                className="p-1 text-[#666666] hover:text-[#A0A0A0] disabled:opacity-30"
                                title={t('courseLms.tooltip.moveDown')}
                              >
                                <ArrowDown size={12} />
                              </button>
                              <button
                                onClick={() => handleEditLesson(lesson)}
                                className="p-1 text-[#666666] hover:text-[#FAFAFA]"
                                title={t('courseLms.tooltip.editLesson')}
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-[#0A0A0A] overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-32 min-h-0">
        {activeLesson ? (
          <div className="max-w-4xl mx-auto">
            {activeLesson.type === 'quiz' ? (
              <div className="bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] p-4 lg:p-6">
                <QuizPlayer
                  lessonId={activeLesson.id}
                  lessonTitle={activeLesson.title}
                  userId={profile?.id || ''}
                  onComplete={(passed) => {
                    if (passed && !activeLesson.is_completed) {
                      handleToggleComplete(activeLesson);
                    }
                  }}
                />
              </div>
            ) : (
              <div className="aspect-video bg-[#0A0A0A] rounded-xl overflow-hidden relative flex items-center justify-center">
                {activeLesson.type === 'video' ? (
                  <VideoPlayer
                    key={activeLesson.id}
                    url={activeLesson.content_url || ''}
                    title={activeLesson.title}
                  />
                ) : activeLesson.content_url ? (
                  <iframe
                    src={activeLesson.content_url}
                    className="w-full h-full"
                    title={activeLesson.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <div className="text-center text-white">
                    <FileText size={64} className="mx-auto mb-4 opacity-80" />
                    <p className="font-medium">{t('courseLms.lessonPlayer.resourceTextContent')}</p>
                    <p className="text-sm text-white/60 mt-2">{t('courseLms.lessonPlayer.noContentUrl')}</p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 lg:mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-xl lg:text-2xl font-bold text-[#FAFAFA]">{activeLesson.title}</h1>
                <p className="text-sm lg:text-base text-[#666666] mt-1">
                  {t('courseLms.lessonPlayer.module')} {selectedCourse.modules.find(m => m.lessons.some(l => l.id === activeLesson.id))?.title}
                </p>
              </div>
              {activeLesson.type === 'quiz' ? (
                // For quiz lessons, show status badge only (completion is tied to passing)
                activeLesson.is_completed && (
                  <div className="flex items-center justify-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 bg-[#22C55E]/10 text-[#22C55E] rounded-lg font-medium">
                    <CheckCircle size={20} />
                    {t('courseLms.button.completed')}
                  </div>
                )
              ) : (
                <button
                  onClick={() => handleToggleComplete(activeLesson)}
                  disabled={isUpdating}
                  className={`
                    flex items-center justify-center gap-2 px-4 lg:px-6 py-2.5 lg:py-3 rounded-lg font-medium transition-colors w-full sm:w-auto
                    ${activeLesson.is_completed
                      ? 'bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20'
                      : 'bg-white text-black hover:bg-[#E0E0E0]'}
                    ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  {isUpdating ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : activeLesson.is_completed ? (
                    <>
                      <CheckCircle size={20} /> {t('courseLms.button.completed')}
                    </>
                  ) : (
                    t('courseLms.button.markAsComplete')
                  )}
                </button>
              )}
            </div>

            {activeLesson.description && (
              <div className="mt-6 lg:mt-8 bg-[#0A0A0A] p-4 lg:p-6 rounded-xl border border-[#1F1F1F]">
                <h3 className="font-bold text-base lg:text-lg mb-3 lg:mb-4">{t('courseLms.section.lessonNotes')}</h3>
                <p className="text-sm lg:text-base text-[#A0A0A0] leading-relaxed whitespace-pre-wrap">
                  {activeLesson.description}
                </p>
              </div>
            )}

            {/* Instructor Section - only for students */}
            {courseInstructor && courseInstructor.is_messageable && role !== 'creator' && role !== 'superadmin' && (
              <div className="mt-6 lg:mt-8 bg-[#0A0A0A] p-4 lg:p-6 rounded-xl border border-[#1F1F1F]">
                <h3 className="font-bold text-base lg:text-lg mb-3 lg:mb-4">{t('directMessages.course.instructor')}</h3>
                <div className="flex items-center gap-4">
                  <Avatar
                    src={courseInstructor.profile?.avatar_url}
                    name={courseInstructor.profile?.full_name || t('directMessages.teamCard.unknownMember')}
                    size="lg"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#FAFAFA]">
                        {courseInstructor.profile?.full_name || t('directMessages.teamCard.unknownMember')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        getBadgeType(courseInstructor.role) === 'guest'
                          ? 'bg-[#EAB308]/10 text-[#EAB308]'
                          : 'bg-[#1F1F1F] text-[#FAFAFA]'
                      }`}>
                        {t(`directMessages.badge.${getBadgeType(courseInstructor.role)}`)}
                      </span>
                    </div>
                    <p className="text-sm text-[#666666]">
                      {courseInstructor.title || t(`directMessages.roles.${courseInstructor.role}`)}
                    </p>
                  </div>
                  <button
                    onClick={handleMessageInstructor}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] transition-colors"
                  >
                    <MessageCircle size={18} />
                    {t('directMessages.course.messageInstructor')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-[#666666]">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t('courseLms.lesson.selectLessonToStart')}</p>
            </div>
          </div>
        )}
      </div>

      {/* AI Helper for Students - only show when viewing a course */}
      {selectedCourse && role !== 'creator' && role !== 'superadmin' && (
        <CourseAiHelper
          courseId={selectedCourse.id}
          currentLesson={activeLesson ? { id: activeLesson.id, title: activeLesson.title } : null}
          currentModule={activeModuleId ? selectedCourse.modules.find(m => m.id === activeModuleId)?.title : null}
        />
      )}

      {/* Module Edit Modal */}
      {showModuleModal && (
        <ModuleEditModal
          module={editingModule}
          courseId={moduleForCourse}
          isOpen={showModuleModal}
          onClose={() => {
            setShowModuleModal(false);
            setEditingModule(null);
            clearModalState(); // Clear persisted state when modal is closed
          }}
          onSave={handleModuleSave}
          onDelete={editingModule ? handleModuleDelete : undefined}
        />
      )}

      {/* Lesson Edit Modal */}
      {showLessonModal && (
        <LessonEditModal
          lesson={editingLesson}
          moduleId={lessonForModule}
          isOpen={showLessonModal}
          onClose={() => {
            setShowLessonModal(false);
            setEditingLesson(null);
            clearModalState(); // Clear persisted state when modal is closed
          }}
          onSave={handleLessonSave}
          onDelete={editingLesson ? handleLessonDelete : undefined}
        />
      )}

      {/* Course Edit Modal (for listing view) */}
      {editingCourse && (
        <CourseEditModal
          course={editingCourse}
          isOpen={!!editingCourse}
          onClose={() => setEditingCourse(null)}
          onSave={handleCourseEditSave}
          onDelete={handleCourseDelete}
        />
      )}

      {/* Course Analytics Panel */}
      {showAnalytics && (
        <CourseAnalyticsPanel
          courseId={showAnalytics}
          courseName={courses.find(c => c.id === showAnalytics)?.title || 'Course'}
          isOpen={!!showAnalytics}
          onClose={() => setShowAnalytics(null)}
        />
      )}

      {/* Upgrade Prompt for Course Limit */}
      {showUpgradePrompt && (
        <UpgradePrompt
          reason="course_limit"
          onClose={() => setShowUpgradePrompt(false)}
          currentUsage={{
            current: courseLimit.current,
            max: courseLimit.max,
          }}
        />
      )}

      {/* Course Purchase Modal */}
      {purchasingCourse && user && (
        <CoursePurchaseModal
          course={purchasingCourse}
          isOpen={!!purchasingCourse}
          onClose={() => setPurchasingCourse(null)}
          onSuccess={handlePurchaseSuccess}
          buyerId={user.id}
        />
      )}
    </div>
  );
};

export default CourseLMS;
