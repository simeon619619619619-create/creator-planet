import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  TrendingUp,
  ArrowRight,
  Twitter,
  Youtube,
  Instagram,
  Menu,
  X,
  Sparkles,
  Users,
  BookOpen,
  Dumbbell,
  Briefcase,
  Palette,
  Code,
  Heart,
  DollarSign,
  Globe,
  ChevronRight,
  Flame,
  Star,
  GraduationCap,
  MessageSquare
} from 'lucide-react';
import { supabase } from '../core/supabase/client';
import { Logo } from '../shared/Logo';
import LanguageSwitcher from '../shared/LanguageSwitcher';

// ============================================================================
// TYPES
// ============================================================================

interface Category {
  id: string;
  name: string;
  icon: React.ElementType;
  image: string;
  count?: number;
}

interface TrendingTopic {
  id: string;
  name: string;
  icon?: React.ElementType;
}

interface FeaturedCommunity {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  member_count: number;
  creator_name: string;
}

// ============================================================================
// DATA
// ============================================================================

const categories: Category[] = [
  {
    id: 'courses',
    name: 'Courses',
    icon: BookOpen,
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=300&fit=crop',
  },
  {
    id: 'coaching',
    name: 'Coaching',
    icon: Users,
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop',
  },
  {
    id: 'fitness',
    name: 'Fitness',
    icon: Dumbbell,
    image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=300&fit=crop',
  },
  {
    id: 'business',
    name: 'Business',
    icon: Briefcase,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop',
  },
  {
    id: 'design',
    name: 'Design',
    icon: Palette,
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop',
  },
  {
    id: 'development',
    name: 'Development',
    icon: Code,
    image: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&h=300&fit=crop',
  },
];

const trendingTopics: TrendingTopic[] = [
  { id: 'aiAutomation', name: 'AI & Automation', icon: Sparkles },
  { id: 'personalBranding', name: 'Personal Branding' },
  { id: 'socialMediaGrowth', name: 'Social Media Growth' },
  { id: 'ecommerce', name: 'E-commerce' },
  { id: 'cryptoWeb3', name: 'Crypto & Web3' },
  { id: 'contentCreation', name: 'Content Creation' },
  { id: 'freelancing', name: 'Freelancing' },
  { id: 'mindset', name: 'Mindset' },
];

// ============================================================================
// COMPONENTS
// ============================================================================

// Compact Category Card
const CategoryCard: React.FC<{
  category: Category;
  translatedName: string;
  onClick: () => void;
}> = ({ category, translatedName, onClick }) => (
  <button
    onClick={onClick}
    className="group relative w-full aspect-[16/10] rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-1 focus:ring-offset-[#0A0A0A]"
  >
    <img
      src={category.image}
      alt={translatedName}
      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 brightness-[0.35] group-hover:brightness-[0.25]"
    />
    <div className="absolute inset-0 bg-black/40" />
    <div className="absolute inset-0 bg-black/50" />
    <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-[#1F1F1F] flex items-center justify-center">
        <category.icon className="text-white" size={16} />
      </div>
      <span className="text-white font-semibold text-sm">{translatedName}</span>
      <ChevronRight className="text-white/60 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-150" size={16} />
    </div>
  </button>
);

// Featured Community Card
const FeaturedCommunityCard: React.FC<{
  community: FeaturedCommunity;
  onClick: () => void;
}> = ({ community, onClick }) => (
  <button
    onClick={onClick}
    className="group flex items-center gap-3 p-3 rounded-xl bg-[#1F1F1F]/40 hover:bg-[#1F1F1F]/70 border border-[#1F1F1F] hover:border-[#333333] transition-all duration-150 text-left w-full"
  >
    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#1F1F1F]">
      {community.image_url ? (
        <img src={community.image_url} alt={community.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-white font-bold">
          {community.name.charAt(0)}
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <h4 className="text-[#FAFAFA] font-semibold text-sm truncate group-hover:text-white transition-colors duration-150">
        {community.name}
      </h4>
      <p className="text-[#666666] text-xs truncate">{community.creator_name}</p>
    </div>
    <div className="flex items-center gap-1 text-[#666666] text-xs">
      <Users size={12} />
      <span>{community.member_count}</span>
    </div>
  </button>
);

// Trending Pill
const TrendingPill: React.FC<{
  topic: TrendingTopic;
  translatedName: string;
  onClick: () => void;
}> = ({ topic, translatedName, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1F1F1F]/50 hover:bg-[#333333]/70 border border-[#1F1F1F] hover:border-[#333333] text-[#A0A0A0] hover:text-white text-xs font-medium transition-all duration-150 whitespace-nowrap"
  >
    {topic.icon ? (
      <topic.icon size={12} className="text-[#A0A0A0]" />
    ) : (
      <Search size={12} className="text-[#666666]" />
    )}
    {translatedName}
  </button>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const WhopLandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [featuredCommunities, setFeaturedCommunities] = useState<FeaturedCommunity[]>([]);
  const [stats, setStats] = useState({ communities: 0, members: 0, creators: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Fetch real data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch featured communities with member counts
        const { data: communities, error: commError } = await supabase
          .from('communities')
          .select(`
            id,
            name,
            description,
            thumbnail_url,
            profiles!communities_creator_id_fkey (
              full_name
            )
          `)
          .eq('is_public', true)
          .limit(6);

        if (commError) throw commError;

        // Fetch member counts for each community
        const communitiesWithCounts = await Promise.all(
          (communities || []).map(async (comm) => {
            const { count } = await supabase
              .from('memberships')
              .select('*', { count: 'exact', head: true })
              .eq('community_id', comm.id);

            return {
              id: comm.id,
              name: comm.name,
              description: comm.description || '',
              image_url: comm.thumbnail_url,
              member_count: count || 0,
              creator_name: (comm.profiles as any)?.full_name || 'Creator',
            };
          })
        );

        setFeaturedCommunities(communitiesWithCounts);

        // Fetch stats
        const { count: totalCommunities } = await supabase
          .from('communities')
          .select('*', { count: 'exact', head: true })
          .eq('is_public', true);

        const { count: totalMembers } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true });

        const { count: totalCreators } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'creator');

        setStats({
          communities: totalCommunities || 0,
          members: totalMembers || 0,
          creators: totalCreators || 0,
        });
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/communities?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate('/communities');
    }
  };

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/communities?category=${categoryId}`);
  };

  const handleTrendingClick = (topic: string) => {
    navigate(`/communities?search=${encodeURIComponent(topic)}`);
  };

  const handleCommunityClick = (communityId: string) => {
    navigate(`/community/${communityId}`);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Navigation - Compact */}
      <nav className="fixed top-0 w-full z-50 bg-[#0A0A0A]/90 backdrop-blur-lg border-b border-[#1F1F1F]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            {/* Logo */}
            <button onClick={() => navigate('/')} className="flex items-center">
              <Logo variant="light" size="md" showText={false} />
            </button>

            {/* Trending Topics - Desktop */}
            <div className="hidden lg:flex items-center gap-1.5 overflow-x-auto max-w-2xl">
              <div className="flex items-center gap-1 px-2 text-[#A0A0A0] font-medium text-xs">
                <TrendingUp size={12} />
                <span>{t('whopLanding.trending')}</span>
              </div>
              {trendingTopics.slice(0, 6).map((topic) => (
                <TrendingPill key={topic.id} topic={topic} translatedName={t(`whopLanding.trendingTopics.${topic.id}`)} onClick={() => handleTrendingClick(topic.name)} />
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <LanguageSwitcher variant="minimal" className="text-[#A0A0A0]" />
              <button onClick={() => navigate('/login')} className="hidden sm:block px-3 py-1.5 text-[#A0A0A0] hover:text-white text-sm font-medium transition-colors duration-150">
                {t('whopLanding.signIn')}
              </button>
              <button onClick={() => navigate('/onboarding/creator')} className="hidden sm:flex px-4 py-1.5 bg-white hover:bg-[#E0E0E0] text-black rounded-lg text-sm font-semibold transition-colors duration-150">
                {t('whopLanding.createBusiness')}
              </button>
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-1.5 text-[#A0A0A0] hover:text-white">
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-[#1F1F1F] px-4 py-4">
            <div className="flex flex-wrap gap-1.5 mb-4">
              {trendingTopics.map((topic) => (
                <TrendingPill key={topic.id} topic={topic} translatedName={t(`whopLanding.trendingTopics.${topic.id}`)} onClick={() => { handleTrendingClick(topic.name); setMobileMenuOpen(false); }} />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate('/login')} className="flex-1 py-2 text-center text-[#A0A0A0] rounded-lg hover:bg-[#1F1F1F] text-sm transition-colors duration-150">
                {t('whopLanding.signIn')}
              </button>
              <button onClick={() => navigate('/onboarding/creator')} className="flex-1 py-2 bg-white text-black rounded-lg text-sm font-semibold hover:bg-[#E0E0E0] transition-colors duration-150">
                {t('whopLanding.createBusiness')}
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-14">
        {/* Hero - Compact */}
        <section className="px-4 py-6 md:py-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
              {/* Left: Logo + Tagline */}
              <div className="flex items-center gap-3">
                <Logo variant="light" size="lg" showText={false} />
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-[#FAFAFA]">Founders Club</h1>
                  <p className="text-[#A0A0A0] text-sm">{t('whopLanding.tagline')}</p>
                </div>
              </div>

              {/* Right: Stats - Only show if we have real data */}
              {(stats.communities > 0 || stats.creators > 0 || stats.members > 0) && (
                <div className="flex items-center gap-6 text-center">
                  <div>
                    <div className="text-xl font-bold text-[#FAFAFA]">{stats.communities}</div>
                    <div className="text-xs text-[#666666]">{stats.communities === 1 ? t('whopLanding.community') : t('whopLanding.communities')}</div>
                  </div>
                  <div className="w-px h-8 bg-[#1F1F1F]" />
                  <div>
                    <div className="text-xl font-bold text-[#FAFAFA]">{stats.creators}</div>
                    <div className="text-xs text-[#666666]">{stats.creators === 1 ? t('whopLanding.creator') : t('whopLanding.creators')}</div>
                  </div>
                  <div className="w-px h-8 bg-[#1F1F1F]" />
                  <div>
                    <div className="text-xl font-bold text-[#FAFAFA]">{stats.members}</div>
                    <div className="text-xs text-[#666666]">{stats.members === 1 ? t('whopLanding.member') : t('whopLanding.members')}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="max-w-2xl">
              <div className="flex items-center bg-[#0A0A0A] rounded-xl border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150 overflow-hidden">
                <div className="pl-4 pr-2">
                  <Search className="text-[#666666]" size={18} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('whopLanding.searchPlaceholder')}
                  className="flex-1 py-3 pr-2 bg-transparent text-[#FAFAFA] placeholder-[#666666] focus:outline-none text-sm"
                />
                <button type="submit" className="m-1.5 px-4 py-1.5 bg-white hover:bg-[#E0E0E0] text-black rounded-lg text-sm font-semibold transition-colors duration-150">
                  {t('whopLanding.search')}
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Main Grid Layout */}
        <section className="px-4 pb-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-4">
              {/* Left Column: Categories */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-[#A0A0A0] flex items-center gap-2">
                    <Flame size={14} className="text-[#FAFAFA]" />
                    {t('whopLanding.browseCategories')}
                  </h2>
                  <button onClick={() => navigate('/communities')} className="text-xs text-[#A0A0A0] hover:text-[#FAFAFA] flex items-center gap-1 transition-colors duration-150">
                    {t('whopLanding.viewAll')} <ArrowRight size={12} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categories.map((category) => (
                    <CategoryCard key={category.id} category={category} translatedName={t(`whopLanding.categories.${category.id}`)} onClick={() => handleCategoryClick(category.id)} />
                  ))}
                </div>
              </div>

              {/* Right Column: Featured Communities */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-[#A0A0A0] flex items-center gap-2">
                    <Star size={14} className="text-[#EAB308]" />
                    {t('whopLanding.featuredCommunities')}
                  </h2>
                </div>
                <div className="space-y-2">
                  {isLoading ? (
                    // Loading skeleton
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-[#1F1F1F]/40 animate-pulse">
                        <div className="w-12 h-12 rounded-xl bg-[#1F1F1F]" />
                        <div className="flex-1">
                          <div className="h-4 bg-[#1F1F1F] rounded w-24 mb-1" />
                          <div className="h-3 bg-[#1F1F1F]/50 rounded w-16" />
                        </div>
                      </div>
                    ))
                  ) : featuredCommunities.length > 0 ? (
                    featuredCommunities.slice(0, 5).map((community) => (
                      <FeaturedCommunityCard
                        key={community.id}
                        community={community}
                        onClick={() => handleCommunityClick(community.id)}
                      />
                    ))
                  ) : (
                    // Empty state when no communities exist
                    <div className="text-center py-6 px-4">
                      <Sparkles className="w-8 h-8 text-[#A0A0A0] mx-auto mb-3" />
                      <p className="text-sm text-[#A0A0A0]">
                        {t('whopLanding.communitiesBeingCreated')}
                      </p>
                      <button
                        onClick={() => navigate('/signup')}
                        className="mt-3 text-xs text-[#FAFAFA] hover:text-white font-medium transition-colors duration-150"
                      >
                        {t('whopLanding.beFirstToCreate')}
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => navigate('/communities')}
                    className="w-full py-2 text-center text-xs text-[#A0A0A0] hover:text-[#FAFAFA] bg-[#1F1F1F]/30 hover:bg-[#1F1F1F]/50 rounded-lg transition-colors duration-150"
                  >
                    {t('whopLanding.exploreAllCommunities')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Row - Compact */}
        <section className="px-4 py-6 border-t border-[#1F1F1F]">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: BookOpen, titleKey: 'launchCourses', descKey: 'launchCoursesDesc' },
                { icon: MessageSquare, titleKey: 'buildCommunities', descKey: 'buildCommunitiesDesc' },
                { icon: GraduationCap, titleKey: 'teachCoach', descKey: 'teachCoachDesc' },
                { icon: DollarSign, titleKey: 'getPaid', descKey: 'getPaidDesc' },
              ].map((feature) => (
                <div key={feature.titleKey} className="group flex items-start gap-3 p-3 rounded-xl bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#333333] transition-colors duration-150">
                  <div className="w-10 h-10 rounded-lg bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                    <feature.icon className="text-[#FAFAFA]" size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#FAFAFA]">{t(`whopLanding.features.${feature.titleKey}`)}</h3>
                    <p className="text-xs text-[#A0A0A0]">{t(`whopLanding.features.${feature.descKey}`)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <button
                onClick={() => navigate('/onboarding/creator')}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white hover:bg-[#E0E0E0] text-black rounded-xl font-semibold text-sm transition-all duration-150 group"
              >
                {t('whopLanding.startBuildingFree')}
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-150" />
              </button>
              <button
                onClick={() => navigate('/communities')}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA] rounded-xl font-semibold text-sm transition-all duration-150"
              >
                {t('whopLanding.browseCommunities')}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Minimal */}
      <footer className="relative z-10 border-t border-[#1F1F1F]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-xs text-[#666666]">
              <div className="flex items-center gap-1.5">
                <Logo variant="light" size="md" showText={false} />
                <span>{t('whopLanding.copyright')}</span>
              </div>
              <span className="hidden md:inline">•</span>
              <div className="flex items-center gap-1">
                <Globe size={12} />
                {t('whopLanding.madeIn')} <Heart size={10} className="text-[#EF4444] fill-[#EF4444] mx-0.5" /> {t('whopLanding.inBulgaria')}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/explore')} className="text-xs text-[#A0A0A0] hover:text-white transition-colors duration-150">{t('whopLanding.explore')}</button>
              <button onClick={() => navigate('/pricing')} className="text-xs text-[#A0A0A0] hover:text-white transition-colors duration-150">{t('whopLanding.pricing')}</button>
              <a href="#" className="text-xs text-[#A0A0A0] hover:text-white transition-colors duration-150">{t('whopLanding.privacy')}</a>
              <a href="#" className="text-xs text-[#A0A0A0] hover:text-white transition-colors duration-150">{t('whopLanding.terms')}</a>
              <div className="flex gap-2 ml-2">
                {[Youtube, Twitter, Instagram].map((Icon, i) => (
                  <a key={i} href="#" className="w-7 h-7 rounded-lg bg-[#1F1F1F] hover:bg-[#333333] flex items-center justify-center text-[#A0A0A0] hover:text-white transition-colors duration-150">
                    <Icon size={14} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WhopLandingPage;
