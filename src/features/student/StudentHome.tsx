import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Loader2,
  Users,
  Sparkles,
  BookOpen,
  Compass,
  ChevronRight,
  ArrowRight,
  Gift,
  CreditCard,
  Repeat
} from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { getMemberCommunities, getPublicCommunities } from '../community/communityService';
import { getEnrolledCourses } from '../courses/courseService';
import PendingSurveysWidget from '../surveys/components/PendingSurveysWidget';
import RecommendedCourses from '../dashboard/components/RecommendedCourses';
import type { DbCommunity, DbCourse } from '../../core/supabase/database.types';
import type { CommunityListItem } from '../../core/types';

interface StudentHomeProps {
  onNavigate: (view: string) => void;
}

const StudentHome: React.FC<StudentHomeProps> = ({ onNavigate }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, profile } = useAuth();

  // State
  const [myCommunities, setMyCommunities] = useState<DbCommunity[]>([]);
  const [discoverCommunities, setDiscoverCommunities] = useState<CommunityListItem[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<DbCourse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        // Load communities user is a member of
        const memberCommunities = await getMemberCommunities(user.id);
        setMyCommunities(memberCommunities);

        // Load public communities for discovery
        const publicCommunities = await getPublicCommunities();
        // Filter out communities user is already a member of
        const memberIds = new Set(memberCommunities.map(c => c.id));
        const toDiscover = publicCommunities.filter(c => !memberIds.has(c.id));
        setDiscoverCommunities(toDiscover);

        // Load enrolled courses
        const courses = await getEnrolledCourses(user.id);
        setEnrolledCourses(courses);
      } catch (error) {
        console.error('Error loading student data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Filter discover communities by search
  const filteredDiscoverCommunities = discoverCommunities.filter((community) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      community.name.toLowerCase().includes(query) ||
      community.description?.toLowerCase().includes(query) ||
      community.creator.full_name.toLowerCase().includes(query)
    );
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-[#FAFAFA] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Welcome Header */}
      <div className="bg-[#0A0A0A] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          <h1 className="text-2xl md:text-3xl font-bold">
            {t('studentHome.welcome.title', { firstName: profile?.full_name?.split(' ')[0] || 'Student' })}
          </h1>
          <p className="mt-2 text-sm md:text-base text-[#A0A0A0]">
            {t('studentHome.welcome.subtitle')}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
        {/* Quick Stats — 3 columns on mobile, compact */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
          <div className="bg-[#0A0A0A] rounded-xl p-3 md:p-6 border border-[#1F1F1F]">
            <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-1 md:gap-3">
              <div className="p-2 md:p-3 bg-[#1F1F1F] rounded-lg shrink-0">
                <Users className="w-4 h-4 md:w-6 md:h-6 text-[#FAFAFA]" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold text-[#FAFAFA]">{myCommunities.length}</p>
                <p className="text-[10px] md:text-sm text-[#A0A0A0] truncate">{t('studentHome.stats.communitiesJoined')}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0A0A0A] rounded-xl p-3 md:p-6 border border-[#1F1F1F]">
            <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-1 md:gap-3">
              <div className="p-2 md:p-3 bg-[#22C55E]/10 rounded-lg shrink-0">
                <BookOpen className="w-4 h-4 md:w-6 md:h-6 text-[#22C55E]" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold text-[#FAFAFA]">{enrolledCourses.length}</p>
                <p className="text-[10px] md:text-sm text-[#A0A0A0] truncate">{t('studentHome.stats.coursesEnrolled')}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#0A0A0A] rounded-xl p-3 md:p-6 border border-[#1F1F1F]">
            <div className="flex flex-col items-center text-center md:flex-row md:items-center md:text-left gap-1 md:gap-3">
              <div className="p-2 md:p-3 bg-[#1F1F1F] rounded-lg shrink-0">
                <Compass className="w-4 h-4 md:w-6 md:h-6 text-[#FAFAFA]" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold text-[#FAFAFA]">{discoverCommunities.length}</p>
                <p className="text-[10px] md:text-sm text-[#A0A0A0] truncate">{t('studentHome.stats.communitiesToExplore')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Surveys Widget */}
        {profile?.id && (
          <div className="mb-8">
            <PendingSurveysWidget studentId={profile.id} />
          </div>
        )}

        {/* My Communities Section */}
        {myCommunities.length > 0 && (
          <section className="mb-8 md:mb-10">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg md:text-xl font-semibold text-[#FAFAFA]">{t('studentHome.myCommunities.title')}</h2>
              <button
                onClick={() => onNavigate('community')}
                className="text-sm text-[#FAFAFA] hover:text-[#A0A0A0] font-medium flex items-center gap-1"
              >
                {t('studentHome.myCommunities.viewAll')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0">
              {myCommunities.slice(0, 3).map((community) => (
                <div
                  key={community.id}
                  onClick={() => onNavigate('community')}
                  className="min-w-[72vw] md:min-w-0 snap-start bg-[#0A0A0A] rounded-xl p-5 border border-[#1F1F1F] hover:border-[#333333] transition-all cursor-pointer shrink-0 md:shrink"
                >
                  <div className="flex items-start gap-3">
                    {community.thumbnail_url ? (
                      <img
                        src={community.thumbnail_url}
                        alt={community.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-[#1F1F1F] flex items-center justify-center text-white font-bold text-lg">
                        {community.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[#FAFAFA] truncate">{community.name}</h3>
                      <p className="text-sm text-[#666666] line-clamp-2 mt-1">
                        {community.description || 'A great community to be part of'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Continue Learning Section — horizontal scroll on mobile */}
        {enrolledCourses.length > 0 && (
          <section className="mb-8 md:mb-10">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h2 className="text-lg md:text-xl font-semibold text-[#FAFAFA]">{t('studentHome.continueLearning.title')}</h2>
              <button
                onClick={() => onNavigate('courses')}
                className="text-sm text-[#FAFAFA] hover:text-[#A0A0A0] font-medium flex items-center gap-1"
              >
                {t('studentHome.continueLearning.viewAll')} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {/* Mobile: horizontal scroll, Desktop: grid */}
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:overflow-visible md:pb-0">
              {enrolledCourses.slice(0, 6).map((course) => (
                <div
                  key={course.id}
                  onClick={() => onNavigate('courses')}
                  className="min-w-[72vw] md:min-w-0 snap-start bg-[#0A0A0A] rounded-xl overflow-hidden border border-[#1F1F1F] hover:border-[#333333] transition-all cursor-pointer shrink-0 md:shrink"
                >
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.title}
                      className="w-full h-32 object-cover"
                    />
                  ) : (
                    <div className="w-full h-32 bg-[#151515] flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-white/80" />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-[#FAFAFA] truncate">{course.title}</h3>
                    <p className="text-sm text-[#666666] line-clamp-2 mt-1">
                      {course.description || 'Continue your learning journey'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recommended Courses */}
        <div className="mb-8 md:mb-10">
          <RecommendedCourses profileId={profile?.id} />
        </div>

        {/* Discover Communities Section */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-[#FAFAFA]">{t('studentHome.discoverCommunities.title')}</h2>
              <p className="text-xs md:text-sm text-[#A0A0A0] mt-1">
                {t('studentHome.discoverCommunities.subtitle')}
              </p>
            </div>
            <button
              onClick={() => navigate('/communities')}
              className="text-sm text-[#FAFAFA] hover:text-[#A0A0A0] font-medium flex items-center gap-1"
            >
              {t('studentHome.discoverCommunities.browseAll')} <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666666]" />
              <input
                type="text"
                placeholder={t('studentHome.discoverCommunities.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg text-[#FAFAFA] placeholder-[#666666] focus:outline-none focus:ring-1 focus:ring-white/10 focus:border-[#555555]"
              />
            </div>
          </div>

          {/* Communities Grid */}
          {filteredDiscoverCommunities.length === 0 ? (
            <div className="text-center py-12 bg-[#0A0A0A] rounded-xl border border-[#1F1F1F]">
              <Sparkles className="w-12 h-12 text-[#A0A0A0] mx-auto" />
              <h3 className="mt-4 text-lg font-semibold text-[#FAFAFA]">
                {searchQuery ? t('studentHome.discoverCommunities.noResultsTitle') : t('studentHome.discoverCommunities.allCaughtUpTitle')}
              </h3>
              <p className="mt-2 text-[#A0A0A0]">
                {searchQuery
                  ? t('studentHome.discoverCommunities.noResultsSubtitle')
                  : t('studentHome.discoverCommunities.allCaughtUpSubtitle')}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 text-[#FAFAFA] hover:text-[#A0A0A0] font-medium"
                >
                  {t('studentHome.discoverCommunities.clearSearch')}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDiscoverCommunities.slice(0, 6).map((community) => {
                const isFree = community.pricing_type === 'free' || community.price_cents === 0;
                const isMonthly = community.pricing_type === 'monthly';
                const priceDisplay = isFree
                  ? t('studentHome.pricing.free')
                  : `€${(community.price_cents / 100).toFixed(2)}${isMonthly ? t('studentHome.pricing.monthly') : ''}`;

                return (
                  <div
                    key={community.id}
                    onClick={() => navigate(`/community/${community.id}`)}
                    className="bg-[#0A0A0A] rounded-xl overflow-hidden border border-[#1F1F1F] hover:border-[#333333] transition-all cursor-pointer group"
                  >
                    <div className="relative">
                      <img
                        src={community.thumbnail_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(community.name)}&background=6366f1&color=fff&size=400`}
                        alt={community.name}
                        className="w-full h-32 object-cover"
                      />
                      {/* Pricing Badge */}
                      <div className={`absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                        isFree
                          ? 'bg-[#22C55E] text-white'
                          : 'bg-[#0A0A0A] text-[#FAFAFA]'
                      }`}>
                        {isFree ? (
                          <Gift className="w-3 h-3" />
                        ) : isMonthly ? (
                          <Repeat className="w-3 h-3" />
                        ) : (
                          <CreditCard className="w-3 h-3" />
                        )}
                        {priceDisplay}
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[#FAFAFA] truncate">{community.name}</h3>
                          <p className="text-sm text-[#666666] mt-1">
                            {t('studentHome.communityCard.by', { creatorName: community.creator.full_name })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[#666666] bg-[#1F1F1F] px-2 py-1 rounded-full">
                          <Users className="w-3 h-3" />
                          {community.memberCount}
                        </div>
                      </div>
                      <p className="text-sm text-[#A0A0A0] line-clamp-2 mt-2">
                        {community.description || 'Join this community to learn and connect'}
                      </p>
                      <button className="mt-3 w-full py-2 bg-[#151515] text-[#FAFAFA] rounded-lg font-medium text-sm hover:bg-[#1F1F1F] transition-colors group-hover:bg-white group-hover:text-black">
                        {t('studentHome.communityCard.viewCommunity')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Show More Button */}
          {filteredDiscoverCommunities.length > 6 && (
            <div className="text-center mt-6">
              <button
                onClick={() => navigate('/communities')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] transition-colors"
              >
                <Compass className="w-5 h-5" />
                {t('studentHome.exploreButton', { count: filteredDiscoverCommunities.length })}
              </button>
            </div>
          )}
        </section>

        {/* Empty State - No communities at all */}
        {myCommunities.length === 0 && discoverCommunities.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-[#1F1F1F] rounded-full flex items-center justify-center mx-auto mb-6">
              <Compass className="w-10 h-10 text-[#FAFAFA]" />
            </div>
            <h2 className="text-2xl font-bold text-[#FAFAFA]">{t('studentHome.emptyState.title')}</h2>
            <p className="mt-2 text-[#A0A0A0] max-w-md mx-auto">
              {t('studentHome.emptyState.subtitle')}
            </p>
            <button
              onClick={() => navigate('/communities')}
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-white text-black rounded-lg font-medium hover:bg-[#E0E0E0] transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              {t('studentHome.emptyState.browseButton')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentHome;
