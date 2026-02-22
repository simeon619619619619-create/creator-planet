import React from 'react';
import { useTranslation } from 'react-i18next';
import { PublicNavigation } from './PublicNavigation';
import { Link } from 'react-router-dom';
import { Twitter, Github, Mail } from 'lucide-react';
import { Logo } from '../../shared/Logo';

interface PublicLayoutProps {
  children: React.ReactNode;
  showNavigation?: boolean;
  showFooter?: boolean;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({
  children,
  showNavigation = true,
  showFooter = true,
}) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      {showNavigation && <PublicNavigation />}

      <main className={showNavigation ? 'pt-16' : ''}>
        {children}
      </main>

      {showFooter && (
        <footer className="bg-slate-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Brand */}
              <div className="col-span-1 md:col-span-2">
                <div className="mb-4">
                  <Logo variant="light" size="lg" showText={false} />
                </div>
                <p className="text-slate-400 text-sm max-w-md">
                  {t('publicCommunities.footer.description')}
                </p>
              </div>

              {/* Links */}
              <div>
                <h4 className="font-semibold mb-4">{t('publicCommunities.footer.platform')}</h4>
                <ul className="space-y-2 text-sm text-slate-400">
                  <li>
                    <Link to="/communities" className="hover:text-white transition-colors">
                      {t('publicCommunities.footer.browseCommunities')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/signup" className="hover:text-white transition-colors">
                      {t('publicCommunities.footer.getStarted')}
                    </Link>
                  </li>
                  <li>
                    <Link to="/login" className="hover:text-white transition-colors">
                      {t('publicCommunities.footer.signIn')}
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Social */}
              <div>
                <h4 className="font-semibold mb-4">{t('publicCommunities.footer.connect')}</h4>
                <div className="flex items-center gap-3">
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <Twitter className="w-5 h-5" />
                  </a>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <Github className="w-5 h-5" />
                  </a>
                  <a
                    href="mailto:hello@creatorclub.app"
                    className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
              <p>{t('publicCommunities.footer.copyright', { year: new Date().getFullYear() })}</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};
