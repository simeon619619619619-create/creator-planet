import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'dropdown' | 'buttons' | 'minimal';
  className?: string;
}

const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ 
  variant = 'dropdown',
  className = ''
}) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'en', label: 'EN', fullName: t('languages.en') },
    { code: 'bg', label: 'BG', fullName: t('languages.bg') }
  ];

  const currentLanguage = languages.find(l => l.code === i18n.language) || languages[0];

  const changeLanguage = (langCode: string) => {
    i18n.changeLanguage(langCode);
    localStorage.setItem('i18nextLng', langCode);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'buttons') {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => changeLanguage(lang.code)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              i18n.language === lang.code
                ? 'bg-[#151515] text-[#FAFAFA] border border-[#333333]'
                : 'bg-transparent text-[#A0A0A0] border border-[var(--fc-border,#1F1F1F)] hover:text-[#FAFAFA] hover:bg-[#151515]'
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <button
        onClick={() => changeLanguage(i18n.language === 'en' ? 'bg' : 'en')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#A0A0A0] hover:text-[#FAFAFA] hover:bg-[#151515] transition-colors ${className}`}
        title={t('settings.language')}
      >
        <Globe size={16} />
        <span>{currentLanguage.label}</span>
      </button>
    );
  }

  // Default dropdown variant with click behavior
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#A0A0A0] hover:text-[#FAFAFA] hover:bg-[#151515] transition-colors"
      >
        <Globe size={16} />
        <span>{currentLanguage.label}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-[var(--fc-surface,#0A0A0A)] rounded-lg border border-[var(--fc-border,#1F1F1F)] z-50 py-1">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-[#151515] transition-colors ${
                i18n.language === lang.code ? 'bg-[#151515] text-[#FAFAFA]' : 'text-[#A0A0A0]'
              }`}
            >
              <span className="font-medium w-6">{lang.label}</span>
              <span className="flex-1">{lang.fullName}</span>
              {i18n.language === lang.code && (
                <Check size={16} className="text-[#FAFAFA]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
