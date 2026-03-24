import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, Users } from 'lucide-react';
import { useRecommendedCourses } from '../../courses/hooks/useRecommendedCourses';
import { Avatar } from '../../../shared/Avatar';

interface RecommendedCoursesProps {
  profileId: string | undefined;
}

const SkeletonCard: React.FC = () => (
  <div className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl border border-[var(--fc-border,#1F1F1F)] overflow-hidden animate-pulse min-w-[240px] flex-shrink-0">
    <div className="h-32 bg-[var(--fc-section-hover,#1F1F1F)]" />
    <div className="p-4 space-y-3">
      <div className="h-4 bg-[var(--fc-section-hover,#1F1F1F)] rounded w-3/4" />
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-[var(--fc-section-hover,#1F1F1F)]" />
        <div className="h-3 bg-[var(--fc-section-hover,#1F1F1F)] rounded w-1/2" />
      </div>
      <div className="h-3 bg-[var(--fc-section-hover,#1F1F1F)] rounded w-1/3" />
    </div>
  </div>
);

const RecommendedCourses: React.FC<RecommendedCoursesProps> = ({ profileId }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: courses, isLoading } = useRecommendedCourses(profileId);

  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-bold text-[var(--fc-text,#FAFAFA)] mb-4">{t('recommendations.title')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!courses || courses.length === 0) {
    return null;
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-[var(--fc-text,#FAFAFA)] mb-4">{t('recommendations.title')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => (
          <button
            key={course.id}
            onClick={() => navigate(course.community_id ? `/community/${course.community_id}` : '/courses')}
            className="bg-[var(--fc-surface,#0A0A0A)] rounded-xl border border-[var(--fc-border,#1F1F1F)] overflow-hidden text-left hover:border-[#333333] transition-colors group"
          >
            {course.thumbnail_url ? (
              <img
                src={course.thumbnail_url}
                alt={course.title}
                className="w-full h-32 object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="w-full h-32 bg-[var(--fc-section-hover,#1F1F1F)] flex items-center justify-center">
                <BookOpen size={32} className="text-[var(--fc-muted,#666666)]" />
              </div>
            )}
            <div className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--fc-text,#FAFAFA)] line-clamp-2 group-hover:text-white transition-colors">
                {course.title}
              </h3>
              <div className="flex items-center gap-2">
                <Avatar src={course.creator_avatar} name={course.creator_name} size="xs" />
                <span className="text-xs text-[var(--fc-muted,#A0A0A0)] truncate">{course.creator_name}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-[var(--fc-muted,#666666)]">
                <Users size={12} />
                <span>{t('recommendations.enrolled_other', { count: course.enrollment_count })}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default RecommendedCourses;
