import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Power, MessageSquare, Eye, Zap, Bot, Settings2, Clock, Shield,
  ChevronDown, ChevronUp, Save, Loader2, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../../core/contexts/AuthContext';
import { useCommunity } from '../../../core/contexts/CommunityContext';
import {
  getGhostWriterConfig,
  createGhostWriterConfig,
  updateGhostWriterConfig,
  toggleGhostWriter,
  getSchedules,
} from '../ghostWriterService';
import {
  GHOST_WRITER_QUESTIONS,
  buildPersonaPrompt,
  extractConfigFromAnswers,
  parseScheduleFromAnswers,
} from '../ghostWriterOnboarding';
import type { DbGhostWriterConfig, DbGhostWriterSchedule, GhostWriterApprovalMode } from '../ghostWriterTypes';

const GhostWriterSettings: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { selectedCommunity } = useCommunity();

  const [config, setConfig] = useState<DbGhostWriterConfig | null>(null);
  const [schedules, setSchedules] = useState<DbGhostWriterSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Onboarding state
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [onboardingAnswers, setOnboardingAnswers] = useState<Record<string, string | string[]>>({});

  // Edit states
  const [showPersonaEditor, setShowPersonaEditor] = useState(false);
  const [editablePersona, setEditablePersona] = useState('');

  const communityId = selectedCommunity?.id;
  const creatorProfileId = profile?.id;

  const loadConfig = useCallback(async () => {
    if (!communityId) return;
    setIsLoading(true);
    const cfg = await getGhostWriterConfig(communityId);
    setConfig(cfg);
    if (cfg) {
      setEditablePersona(cfg.persona_prompt || '');
      const sch = await getSchedules(communityId);
      setSchedules(sch);
    }
    if (!cfg || !cfg.persona_prompt) {
      setIsOnboarding(true);
      setCurrentQuestionIndex(0);
    }
    setIsLoading(false);
  }, [communityId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Onboarding handlers
  const handleOnboardingSelect = async (answer: string | string[]) => {
    const currentQ = GHOST_WRITER_QUESTIONS[currentQuestionIndex];
    const newAnswers = { ...onboardingAnswers, [currentQ.id]: answer };
    setOnboardingAnswers(newAnswers);

    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < GHOST_WRITER_QUESTIONS.length) {
      setCurrentQuestionIndex(nextIndex);
    } else {
      await completeOnboarding(newAnswers);
    }
  };

  const [textInput, setTextInput] = useState('');
  const [multiSelect, setMultiSelect] = useState<string[]>([]);

  const completeOnboarding = async (answers: Record<string, string | string[]>) => {
    if (!communityId || !creatorProfileId || !profile?.full_name) return;
    setIsSaving(true);

    const personaPrompt = buildPersonaPrompt(profile.full_name, answers);
    const configValues = extractConfigFromAnswers(answers);
    const schedule = parseScheduleFromAnswers(answers);

    let cfg = config;
    if (!cfg) {
      cfg = await createGhostWriterConfig(communityId, creatorProfileId);
    }

    if (cfg) {
      const updated = await updateGhostWriterConfig(cfg.id, {
        persona_prompt: personaPrompt,
        persona_answers: Object.entries(answers).map(([k, v]) => ({ question: k, answer: v })),
        approval_mode: configValues.approval_mode,
        auto_reply_enabled: configValues.auto_reply_enabled,
        data_collection_fields: configValues.data_collection_fields,
        post_schedule_description: schedule.description,
        is_active: true,
      });
      if (updated) {
        setConfig(updated);
        setEditablePersona(updated.persona_prompt || '');
      }
    }

    setIsOnboarding(false);
    setIsSaving(false);
  };

  // Config update handlers
  const handleToggleActive = async (isActive: boolean) => {
    if (!config) return;
    const updated = await toggleGhostWriter(config.id, isActive);
    if (updated) setConfig(updated);
  };

  const handleToggleAutoReply = async (enabled: boolean) => {
    if (!config) return;
    const updated = await updateGhostWriterConfig(config.id, { auto_reply_enabled: enabled });
    if (updated) setConfig(updated);
  };

  const handleChangeApprovalMode = async (mode: GhostWriterApprovalMode) => {
    if (!config) return;
    const updated = await updateGhostWriterConfig(config.id, { approval_mode: mode });
    if (updated) setConfig(updated);
  };

  const handleSavePersona = async () => {
    if (!config) return;
    setIsSaving(true);
    const updated = await updateGhostWriterConfig(config.id, { persona_prompt: editablePersona });
    if (updated) setConfig(updated);
    setIsSaving(false);
    setShowPersonaEditor(false);
  };

  const handleResetOnboarding = () => {
    setIsOnboarding(true);
    setCurrentQuestionIndex(0);
    setOnboardingAnswers({});
    setTextInput('');
    setMultiSelect([]);
  };

  if (!communityId || !creatorProfileId) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--fc-section-muted,#666666)]">
        <p className="text-sm">Избери общност, за да настроиш бота.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-[var(--fc-section-muted,#666666)]" size={24} />
      </div>
    );
  }

  // Onboarding wizard
  if (isOnboarding) {
    const currentQ = GHOST_WRITER_QUESTIONS[currentQuestionIndex];
    const progress = ((currentQuestionIndex) / GHOST_WRITER_QUESTIONS.length) * 100;

    return (
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full p-6">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bot size={20} className="text-[var(--fc-section-text,#FAFAFA)]" />
                <span className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                  Настройка на бота
                </span>
              </div>
              <span className="text-xs text-[var(--fc-section-muted,#666666)]">
                {currentQuestionIndex + 1} / {GHOST_WRITER_QUESTIONS.length}
              </span>
            </div>
            <div className="w-full bg-[var(--fc-section-hover,#1F1F1F)] rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-[#22C55E] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Question card */}
          <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-6">
            <p className="text-lg font-medium text-[var(--fc-section-text,#FAFAFA)] mb-6">
              {currentQ.question}
            </p>

            {currentQ.type === 'choice' && currentQ.options ? (
              <div className="space-y-2">
                {currentQ.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleOnboardingSelect(option)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section-hover,#151515)] text-[var(--fc-section-text,#FAFAFA)] hover:border-[var(--fc-section-muted,#555555)] transition-colors text-sm"
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : currentQ.type === 'multi-choice' && currentQ.options ? (
              <div className="space-y-2">
                {currentQ.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setMultiSelect((prev) =>
                        prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
                      );
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                      multiSelect.includes(option)
                        ? 'border-[#22C55E] bg-[#22C55E]/10 text-[#22C55E]'
                        : 'border-[var(--fc-section-border,#1F1F1F)] bg-[var(--fc-section-hover,#151515)] text-[var(--fc-section-text,#FAFAFA)] hover:border-[var(--fc-section-muted,#555555)]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if (multiSelect.length > 0) {
                      handleOnboardingSelect(multiSelect);
                      setMultiSelect([]);
                    }
                  }}
                  disabled={multiSelect.length === 0}
                  className="mt-4 w-full px-4 py-3 rounded-lg bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] font-medium text-sm disabled:opacity-50 transition-colors"
                >
                  Продължи ({multiSelect.length} избрани)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && textInput.trim()) {
                      handleOnboardingSelect(textInput.trim());
                      setTextInput('');
                    }
                  }}
                  placeholder="Напиши отговор..."
                  className="w-full bg-[var(--fc-section-hover,#151515)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-4 py-3 text-[var(--fc-section-text,#FAFAFA)] placeholder:text-[var(--fc-section-muted,#666666)] focus:border-[var(--fc-section-muted,#555555)] focus:ring-1 focus:ring-white/10 focus:outline-none text-sm"
                />
                <button
                  onClick={() => {
                    if (textInput.trim()) {
                      handleOnboardingSelect(textInput.trim());
                      setTextInput('');
                    }
                  }}
                  disabled={!textInput.trim()}
                  className="w-full px-4 py-3 rounded-lg bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] font-medium text-sm disabled:opacity-50 transition-colors"
                >
                  Продължи
                </button>
              </div>
            )}
          </div>

          {isSaving && (
            <div className="mt-6 flex items-center justify-center gap-2 text-[var(--fc-section-muted,#A0A0A0)]">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Запазване на настройките...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Settings panel (after onboarding)
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--fc-section-hover,#1F1F1F)] flex items-center justify-center">
              <Bot size={20} className="text-[var(--fc-section-text,#FAFAFA)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--fc-section-text,#FAFAFA)]">
                Настройки на бота
              </h2>
              <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                {selectedCommunity?.name}
              </p>
            </div>
          </div>
        </div>

        {/* Master toggle */}
        <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power size={18} className={config?.is_active ? 'text-[#22C55E]' : 'text-[var(--fc-section-muted,#666666)]'} />
              <div>
                <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                  AI Бот
                </p>
                <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                  {config?.is_active ? 'Ботът е активен и пише от твое име' : 'Ботът е изключен'}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleActive(!config?.is_active)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config?.is_active ? 'bg-[#22C55E]' : 'bg-[var(--fc-section-border,#1F1F1F)]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config?.is_active ? 'translate-x-[22px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Auto-reply */}
        <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare size={18} className={config?.auto_reply_enabled ? 'text-[#3B82F6]' : 'text-[var(--fc-section-muted,#666666)]'} />
              <div>
                <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                  Авто-отговор на съобщения
                </p>
                <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                  Ботът отговаря автоматично на лични съобщения от студенти
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleAutoReply(!config?.auto_reply_enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                config?.auto_reply_enabled ? 'bg-[#3B82F6]' : 'bg-[var(--fc-section-border,#1F1F1F)]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  config?.auto_reply_enabled ? 'translate-x-[22px]' : 'translate-x-[3px]'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Proactive messages info */}
        <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={18} className={config?.is_active ? 'text-[#EAB308]' : 'text-[var(--fc-section-muted,#666666)]'} />
              <div>
                <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                  Проактивни съобщения
                </p>
                <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                  Ботът пише на нови, неактивни и рискови студенти автоматично
                </p>
              </div>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-md ${
              config?.is_active
                ? 'bg-[#22C55E]/10 text-[#22C55E]'
                : 'bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#666666)]'
            }`}>
              {config?.is_active ? 'Активно' : 'Изключено'}
            </span>
          </div>
        </div>

        {/* Approval mode */}
        <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <Shield size={18} className="text-[var(--fc-section-muted,#A0A0A0)]" />
            <div>
              <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                Одобряване на постове
              </p>
              <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                Как да се публикуват генерираните постове
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleChangeApprovalMode('preview')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                config?.approval_mode === 'preview'
                  ? 'border-[var(--fc-section-text,#FAFAFA)] bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)]'
                  : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#666666)] hover:border-[var(--fc-section-muted,#555555)]'
              }`}
            >
              <Eye size={16} />
              Преглед преди публикуване
            </button>
            <button
              onClick={() => handleChangeApprovalMode('auto')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all border ${
                config?.approval_mode === 'auto'
                  ? 'border-[var(--fc-section-text,#FAFAFA)] bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-text,#FAFAFA)]'
                  : 'border-[var(--fc-section-border,#1F1F1F)] text-[var(--fc-section-muted,#666666)] hover:border-[var(--fc-section-muted,#555555)]'
              }`}
            >
              <Zap size={16} />
              Автоматично
            </button>
          </div>
        </div>

        {/* Schedule info */}
        {config?.post_schedule_description && (
          <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-5">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-[var(--fc-section-muted,#A0A0A0)]" />
              <div>
                <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                  График на постове
                </p>
                <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                  {config.post_schedule_description}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Persona prompt editor */}
        <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-5">
          <button
            onClick={() => setShowPersonaEditor(!showPersonaEditor)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <Settings2 size={18} className="text-[var(--fc-section-muted,#A0A0A0)]" />
              <div className="text-left">
                <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                  Персона на бота
                </p>
                <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                  Инструкции как ботът да пише от твое име
                </p>
              </div>
            </div>
            {showPersonaEditor ? (
              <ChevronUp size={16} className="text-[var(--fc-section-muted,#666666)]" />
            ) : (
              <ChevronDown size={16} className="text-[var(--fc-section-muted,#666666)]" />
            )}
          </button>

          {showPersonaEditor && (
            <div className="mt-4 space-y-3">
              <textarea
                value={editablePersona}
                onChange={(e) => setEditablePersona(e.target.value)}
                rows={10}
                className="w-full bg-[var(--fc-section-hover,#151515)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg px-4 py-3 text-[var(--fc-section-text,#FAFAFA)] text-sm leading-relaxed focus:border-[var(--fc-section-muted,#555555)] focus:ring-1 focus:ring-white/10 focus:outline-none resize-y"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setEditablePersona(config?.persona_prompt || '');
                    setShowPersonaEditor(false);
                  }}
                  className="px-4 py-2 text-sm text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] transition-colors"
                >
                  Отказ
                </button>
                <button
                  onClick={handleSavePersona}
                  disabled={isSaving || editablePersona === config?.persona_prompt}
                  className="flex items-center gap-2 px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Запази
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reset onboarding */}
        <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RotateCcw size={18} className="text-[var(--fc-section-muted,#A0A0A0)]" />
              <div>
                <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)]">
                  Преминаване на настройката отново
                </p>
                <p className="text-xs text-[var(--fc-section-muted,#666666)]">
                  Започни отначало 15-те въпроса за персоната на бота
                </p>
              </div>
            </div>
            <button
              onClick={handleResetOnboarding}
              className="px-4 py-2 text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] hover:text-[var(--fc-section-text,#FAFAFA)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg hover:border-[var(--fc-section-muted,#555555)] transition-colors"
            >
              Нулиране
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GhostWriterSettings;
