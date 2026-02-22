import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Sparkles, Shield, Bot, CreditCard, Globe } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { useCommunity } from '../../core/contexts/CommunityContext';
import ProfileSettings from './ProfileSettings';
import CreatorSettings from './CreatorSettings';
import AccountSettings from './AccountSettings';
import { ChatbotSettings } from '../chatbots';
import { BillingSettingsPage } from '../billing';
import LanguageSwitcher from '../../shared/LanguageSwitcher';

type SettingsTab = 'profile' | 'creator' | 'billing' | 'chatbots' | 'account' | 'language';

const LanguageSettings: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">{t('settings.language')}</h2>
        <p className="text-slate-600 text-sm mb-4">
          {t('settings.preferences')}
        </p>
      </div>
      <div className="bg-slate-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-slate-900">{t('settings.language')}</h3>
            <p className="text-sm text-slate-500 mt-1">
              {t('creatorSettings.languageDescription')}
            </p>
          </div>
          <LanguageSwitcher variant="buttons" />
        </div>
      </div>
    </div>
  );
};

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { role } = useAuth();
  const { selectedCommunity } = useCommunity();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  // Check if user can access creator settings
  const canAccessCreatorSettings = role === 'creator' || role === 'superadmin';

  const tabs = [
    {
      id: 'profile' as SettingsTab,
      label: t('common.profile'),
      icon: User,
      visible: true,
    },
    {
      id: 'language' as SettingsTab,
      label: t('settings.language'),
      icon: Globe,
      visible: true,
    },
    {
      id: 'creator' as SettingsTab,
      label: t('creatorSettings.tabs.creator'),
      icon: Sparkles,
      visible: canAccessCreatorSettings,
    },
    {
      id: 'billing' as SettingsTab,
      label: t('settings.billing'),
      icon: CreditCard,
      visible: canAccessCreatorSettings,
    },
    {
      id: 'chatbots' as SettingsTab,
      label: t('creatorSettings.tabs.chatbots'),
      icon: Bot,
      visible: canAccessCreatorSettings && !!selectedCommunity,
    },
    {
      id: 'account' as SettingsTab,
      label: t('settings.account'),
      icon: Shield,
      visible: true,
    },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'language':
        return <LanguageSettings />;
      case 'creator':
        return <CreatorSettings />;
      case 'billing':
        return <BillingSettingsPage />;
      case 'chatbots':
        return selectedCommunity ? (
          <ChatbotSettings communityId={selectedCommunity.id} />
        ) : (
          <div className="text-center py-8 text-slate-500">
            {t('errors.selectCommunity')}
          </div>
        );
      case 'account':
        return <AccountSettings />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">{t('settings.title')}</h1>
        <p className="text-slate-600 mt-1">{t('settings.preferences')}</p>
      </div>

      {/* Tabs and Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-slate-200 bg-slate-50">
          <div className="flex overflow-x-auto">
            {tabs
              .filter((tab) => tab.visible)
              .map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                      ${
                        activeTab === tab.id
                          ? 'border-indigo-600 text-indigo-600 bg-white'
                          : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }
                    `}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 md:p-8">{renderTabContent()}</div>
      </div>
    </div>
  );
};

export default Settings;
