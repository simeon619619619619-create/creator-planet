import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '../../shared/Logo';
import LanguageSwitcher from '../../shared/LanguageSwitcher';
import WorldMap from './components/WorldMap';
import StatsBar from './components/StatsBar';

const TrackingPage: React.FC = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = 'Live Analytics | Founders Club';
    // noindex for fabricated data
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'robots');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', 'noindex, nofollow');

    return () => {
      document.title = 'Founders Club';
      meta?.setAttribute('content', 'index, follow');
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--fc-section,#0A0A0A)]">
      {/* Simple nav */}
      <nav className="fixed top-0 w-full bg-[var(--fc-section,#0A0A0A)]/80 backdrop-blur-md border-b border-[var(--fc-section-border,#1F1F1F)] z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] transition-colors duration-150">
                <ArrowLeft size={20} />
              </Link>
              <Logo variant="light" size="sm" showText={false} />
            </div>
            <div className="flex items-center gap-4">
              <LanguageSwitcher variant="minimal" />
              <Link
                to="/"
                className="text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] transition-colors duration-150 text-sm font-medium"
              >
                {t('common.back')}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="pt-24 pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] px-4 py-2 rounded-full text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
              </span>
              {t('tracking.badge')}
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-[var(--fc-section-text,#FAFAFA)] mb-4">
              {t('tracking.title')}
            </h1>
            <p className="text-lg md:text-xl text-[var(--fc-section-muted,#A0A0A0)] max-w-2xl mx-auto mb-6">
              {t('tracking.subtitle')}
            </p>

            {/* Status bar */}
            <div className="inline-flex items-center gap-2 text-sm text-[#22C55E] font-medium">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
              </span>
              {t('tracking.status')}
            </div>
          </div>

          {/* Stats */}
          <div className="mb-8">
            <StatsBar />
          </div>

          {/* Map */}
          <WorldMap />
        </div>
      </div>
    </div>
  );
};

export default TrackingPage;
