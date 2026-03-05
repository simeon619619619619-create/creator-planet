import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LogIn, UserPlus, Menu, X } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { Logo } from '../../shared/Logo';

export const PublicNavigation: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A] border-b border-[#1F1F1F]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <Logo variant="light" size="lg" showText={false} />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/communities"
              className="text-sm font-medium text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150"
            >
              {t('publicCommunities.nav.browseCommunities')}
            </Link>

            {user ? (
              <button
                onClick={() => navigate('/app')}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors duration-150"
              >
                {t('publicCommunities.nav.goToDashboard')}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate('/login')}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-150 text-[#FAFAFA] border border-[#1F1F1F] hover:bg-[#151515] hover:border-[#333333]"
                >
                  <LogIn className="w-4 h-4" />
                  {t('publicCommunities.nav.signIn')}
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-[#E0E0E0] transition-colors duration-150"
                >
                  <UserPlus className="w-4 h-4" />
                  {t('publicCommunities.nav.getStarted')}
                </button>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-[#A0A0A0] hover:text-[#FAFAFA] transition-colors duration-150"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0A0A0A] border-t border-[#1F1F1F]">
          <div className="px-4 py-4 space-y-3">
            <Link
              to="/communities"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 text-[#A0A0A0] hover:text-[#FAFAFA] hover:bg-[#151515] rounded-lg transition-colors duration-150"
            >
              {t('publicCommunities.nav.browseCommunities')}
            </Link>

            {user ? (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/app');
                }}
                className="w-full px-4 py-2 bg-white text-black rounded-lg hover:bg-[#E0E0E0] font-medium transition-colors duration-150"
              >
                {t('publicCommunities.nav.goToDashboard')}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full px-4 py-2 border border-[#1F1F1F] text-[#FAFAFA] rounded-lg hover:bg-[#151515] hover:border-[#333333] transition-colors duration-150"
                >
                  {t('publicCommunities.nav.signIn')}
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/signup');
                  }}
                  className="w-full px-4 py-2 bg-white text-black rounded-lg hover:bg-[#E0E0E0] font-medium transition-colors duration-150"
                >
                  {t('publicCommunities.nav.getStarted')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
