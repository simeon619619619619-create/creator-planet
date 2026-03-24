// =============================================================================
// SURVEY BUILDER
// Creator-facing component for building surveys
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Save,
  Eye,
  Settings,
  Type,
  List,
  CheckSquare,
  Hash,
  Star,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type {
  SurveyWithDetails,
  SurveySection,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyAttachmentType,
  QuestionFormData,
  SectionFormData,
} from '../surveyTypes';
import {
  createSection,
  updateSection,
  deleteSection,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  updateSurvey,
} from '../surveyService';

// =============================================================================
// Question Type Icons & Labels
// =============================================================================

const questionTypeConfig: Record<
  SurveyQuestionType,
  { icon: React.ElementType; label: string; description: string }
> = {
  text: {
    icon: Type,
    label: 'surveys.questionTypes.text',
    description: 'surveys.questionTypes.textDesc',
  },
  single_choice: {
    icon: List,
    label: 'surveys.questionTypes.singleChoice',
    description: 'surveys.questionTypes.singleChoiceDesc',
  },
  multi_choice: {
    icon: CheckSquare,
    label: 'surveys.questionTypes.multiChoice',
    description: 'surveys.questionTypes.multiChoiceDesc',
  },
  number: {
    icon: Hash,
    label: 'surveys.questionTypes.number',
    description: 'surveys.questionTypes.numberDesc',
  },
  scale: {
    icon: Star,
    label: 'surveys.questionTypes.scale',
    description: 'surveys.questionTypes.scaleDesc',
  },
};

// =============================================================================
// Question Editor Component
// =============================================================================

interface QuestionEditorProps {
  question: SurveyQuestion;
  onUpdate: (questionId: string, data: Partial<QuestionFormData>) => Promise<void>;
  onDelete: (questionId: string) => Promise<void>;
  isLoading: boolean;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  onUpdate,
  onDelete,
  isLoading,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [localQuestion, setLocalQuestion] = useState(question);
  const [options, setOptions] = useState<string[]>(question.options || []);
  const [newOption, setNewOption] = useState('');

  const TypeIcon = questionTypeConfig[question.question_type].icon;

  const handleSave = async () => {
    await onUpdate(question.id, {
      question_text: localQuestion.question_text,
      is_required: localQuestion.is_required,
      allow_other: localQuestion.allow_other,
      placeholder: localQuestion.placeholder || '',
      options,
    });
  };

  const addOption = () => {
    if (newOption.trim()) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const hasChoices = question.question_type === 'single_choice' || question.question_type === 'multi_choice';

  return (
    <div className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--fc-section,#0A0A0A)]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <GripVertical className="w-4 h-4 text-[var(--fc-section-muted,#666666)] cursor-grab" />
        <div className="w-8 h-8 bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg flex items-center justify-center">
          <TypeIcon className="w-4 h-4 text-[var(--fc-section-text,#FAFAFA)]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--fc-section-text,#FAFAFA)] truncate">
            {question.question_text || t('surveys.builder.untitledQuestion')}
          </p>
          <p className="text-xs text-[var(--fc-section-muted,#666666)]">
            {t(questionTypeConfig[question.question_type].label)}
            {question.is_required && (
              <span className="ml-2 text-[#EF4444]">*</span>
            )}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(question.id);
          }}
          className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded"
          disabled={isLoading}
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-[var(--fc-section-muted,#666666)]" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--fc-section-muted,#666666)]" />
        )}
      </div>

      {/* Expanded Editor */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[var(--fc-section-border,#1F1F1F)] space-y-4">
          {/* Question Text */}
          <div className="pt-4">
            <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
              {t('surveys.builder.questionText')}
            </label>
            <input
              type="text"
              value={localQuestion.question_text}
              onChange={(e) =>
                setLocalQuestion({ ...localQuestion, question_text: e.target.value })
              }
              className="w-full px-3 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
              placeholder={t('surveys.builder.questionPlaceholder')}
            />
          </div>

          {/* Options for choice questions */}
          {hasChoices && (
            <div>
              <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-2">
                {t('surveys.builder.options')}
              </label>
              <div className="space-y-2">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-[var(--fc-section-hover,#1F1F1F)] rounded text-center text-sm text-[var(--fc-section-muted,#A0A0A0)] flex items-center justify-center">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => {
                        const newOptions = [...options];
                        newOptions[index] = e.target.value;
                        setOptions(newOptions);
                      }}
                      className="flex-1 px-3 py-1.5 text-sm border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
                    />
                    <button
                      onClick={() => removeOption(index)}
                      className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-[var(--fc-section-hover,#1F1F1F)] rounded text-center text-sm text-[var(--fc-section-muted,#666666)] flex items-center justify-center">
                    +
                  </span>
                  <input
                    type="text"
                    value={newOption}
                    onChange={(e) => setNewOption(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addOption()}
                    className="flex-1 px-3 py-1.5 text-sm border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
                    placeholder={t('surveys.builder.addOption')}
                  />
                  <button
                    onClick={addOption}
                    className="px-3 py-1.5 text-sm bg-[var(--fc-section-hover,#1F1F1F)] text-[var(--fc-section-muted,#A0A0A0)] rounded-lg hover:bg-[var(--fc-section-hover,#151515)]"
                  >
                    {t('common.add')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Placeholder for text/number */}
          {(question.question_type === 'text' || question.question_type === 'number') && (
            <div>
              <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                {t('surveys.builder.placeholder')}
              </label>
              <input
                type="text"
                value={localQuestion.placeholder || ''}
                onChange={(e) =>
                  setLocalQuestion({ ...localQuestion, placeholder: e.target.value })
                }
                className="w-full px-3 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[var(--fc-section-text,#555555)]"
                placeholder={t('surveys.builder.placeholderHint')}
              />
            </div>
          )}

          {/* Settings */}
          <div className="flex items-center gap-6 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={localQuestion.is_required}
                onChange={(e) =>
                  setLocalQuestion({ ...localQuestion, is_required: e.target.checked })
                }
                className="w-4 h-4 text-[var(--fc-section-text,#FAFAFA)] border-[var(--fc-section-border,#1F1F1F)] rounded focus:ring-white/10"
              />
              <span className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">{t('surveys.builder.required')}</span>
            </label>
            {hasChoices && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localQuestion.allow_other}
                  onChange={(e) =>
                    setLocalQuestion({ ...localQuestion, allow_other: e.target.checked })
                  }
                  className="w-4 h-4 text-[var(--fc-section-text,#FAFAFA)] border-[var(--fc-section-border,#1F1F1F)] rounded focus:ring-white/10"
                />
                <span className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">{t('surveys.builder.allowOther')}</span>
              </label>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-4 py-2 bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] text-sm font-medium rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)] disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t('common.save')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Section Editor Component
// =============================================================================

interface SectionEditorProps {
  section: SurveySection;
  questions: SurveyQuestion[];
  onUpdateSection: (sectionId: string, data: Partial<SectionFormData>) => Promise<void>;
  onDeleteSection: (sectionId: string) => Promise<void>;
  onUpdateQuestion: (questionId: string, data: Partial<QuestionFormData>) => Promise<void>;
  onDeleteQuestion: (questionId: string) => Promise<void>;
  onAddQuestion: (sectionId: string, type: SurveyQuestionType) => Promise<void>;
  isLoading: boolean;
}

const SectionEditor: React.FC<SectionEditorProps> = ({
  section,
  questions,
  onUpdateSection,
  onDeleteSection,
  onUpdateQuestion,
  onDeleteQuestion,
  onAddQuestion,
  isLoading,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [localSection, setLocalSection] = useState(section);
  const [showQuestionTypeMenu, setShowQuestionTypeMenu] = useState(false);

  const handleSaveSection = async () => {
    await onUpdateSection(section.id, {
      title: localSection.title,
      description: localSection.description || '',
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl border border-[var(--fc-section-border,#1F1F1F)] overflow-hidden">
      {/* Section Header */}
      <div className="px-4 py-3 bg-[var(--fc-section-hover,#1F1F1F)] border-b border-[var(--fc-section-border,#1F1F1F)]">
        {isEditing ? (
          <div className="space-y-2">
            <input
              type="text"
              value={localSection.title}
              onChange={(e) => setLocalSection({ ...localSection, title: e.target.value })}
              className="w-full px-3 py-2 text-sm font-semibold border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10"
              placeholder={t('surveys.builder.sectionTitle')}
            />
            <textarea
              value={localSection.description || ''}
              onChange={(e) => setLocalSection({ ...localSection, description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10"
              placeholder={t('surveys.builder.sectionDescription')}
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveSection}
                disabled={isLoading}
                className="px-3 py-1.5 text-sm bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)] disabled:opacity-50"
              >
                {t('common.save')}
              </button>
              <button
                onClick={() => {
                  setLocalSection(section);
                  setIsEditing(false);
                }}
                className="px-3 py-1.5 text-sm text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#151515)] rounded-lg"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 flex-1 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <GripVertical className="w-4 h-4 text-[var(--fc-section-muted,#666666)] cursor-grab" />
              <div>
                <h3 className="font-semibold text-[var(--fc-section-text,#FAFAFA)]">{section.title}</h3>
                {section.description && (
                  <p className="text-sm text-[var(--fc-section-muted,#666666)]">{section.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--fc-section-muted,#666666)] px-2 py-1 bg-[var(--fc-section-hover,#1F1F1F)] rounded">
                {t('surveys.questions', { count: questions.length })}
              </span>
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#151515)] rounded"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDeleteSection(section.id)}
                disabled={isLoading}
                className="p-1.5 text-[var(--fc-section-muted,#666666)] hover:text-[#EF4444] hover:bg-[#EF4444]/10 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-[var(--fc-section-muted,#666666)]" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--fc-section-muted,#666666)]" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section Content - Questions List */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {questions.map((question) => (
            <QuestionEditor
              key={question.id}
              question={question}
              onUpdate={onUpdateQuestion}
              onDelete={onDeleteQuestion}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}

      {/* Add Question Button - Always visible at section footer */}
      <div className="px-4 pb-4 relative">
        <button
          onClick={() => setShowQuestionTypeMenu(!showQuestionTypeMenu)}
          disabled={isLoading}
          className="w-full py-3 border-2 border-dashed border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-[var(--fc-section-muted,#666666)] hover:border-[#333333] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          {t('surveys.builder.addQuestion')}
        </button>

        {showQuestionTypeMenu && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg z-10 p-2 grid grid-cols-2 gap-1">
            {(Object.keys(questionTypeConfig) as SurveyQuestionType[]).map((type) => {
              const config = questionTypeConfig[type];
              const Icon = config.icon;
              return (
                <button
                  key={type}
                  onClick={() => {
                    onAddQuestion(section.id, type);
                    setShowQuestionTypeMenu(false);
                  }}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-lg hover:bg-[var(--fc-section-hover,#151515)] hover:text-[var(--fc-section-text,#FAFAFA)] disabled:opacity-50"
                >
                  <Icon className="w-4 h-4" />
                  {t(config.label)}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Main Survey Builder Component
// =============================================================================

interface SurveyBuilderProps {
  survey: SurveyWithDetails;
  onSurveyUpdate: () => void;
  onClose: () => void;
}

const SurveyBuilder: React.FC<SurveyBuilderProps> = ({
  survey,
  onSurveyUpdate,
  onClose,
}) => {
  const { t } = useTranslation();
  const [sections, setSections] = useState<SurveySection[]>(survey.sections || []);
  const [questions, setQuestions] = useState<SurveyQuestion[]>(survey.questions || []);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUnsectionedQuestionTypeMenu, setShowUnsectionedQuestionTypeMenu] = useState(false);
  const [surveySettings, setSurveySettings] = useState({
    title: survey.title,
    description: survey.description || '',
    is_required: survey.is_required,
    allow_edit: survey.allow_edit,
  });

  // Get questions for a section
  const getSectionQuestions = (sectionId: string) =>
    questions.filter((q) => q.section_id === sectionId).sort((a, b) => a.sort_order - b.sort_order);

  // Get unsectioned questions
  const unsectionedQuestions = questions
    .filter((q) => !q.section_id)
    .sort((a, b) => a.sort_order - b.sort_order);

  // Add section
  const handleAddSection = async () => {
    setIsLoading(true);
    try {
      const newSection = await createSection(survey.id, {
        title: t('surveys.builder.newSection'),
        description: '',
      }, sections.length);
      setSections([...sections, newSection]);
    } catch (error) {
      console.error('Failed to create section:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update section
  const handleUpdateSection = async (sectionId: string, data: Partial<SectionFormData>) => {
    setIsLoading(true);
    try {
      const updated = await updateSection(sectionId, data);
      setSections(sections.map((s) => (s.id === sectionId ? updated : s)));
    } catch (error) {
      console.error('Failed to update section:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete section
  const handleDeleteSection = async (sectionId: string) => {
    if (!confirm(t('surveys.builder.deleteSectionConfirm'))) return;
    setIsLoading(true);
    try {
      await deleteSection(sectionId);
      setSections(sections.filter((s) => s.id !== sectionId));
      // Questions in this section become unsectioned
      setQuestions(questions.map((q) => (q.section_id === sectionId ? { ...q, section_id: null } : q)));
    } catch (error) {
      console.error('Failed to delete section:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Add question
  const handleAddQuestion = async (sectionId: string | null, type: SurveyQuestionType) => {
    setIsLoading(true);
    try {
      const sectionQuestions = sectionId ? getSectionQuestions(sectionId) : unsectionedQuestions;
      const newQuestion = await createQuestion(
        survey.id,
        {
          question_text: '',
          question_type: type,
          section_id: sectionId,
          options: [],
          is_required: false,
          allow_other: false,
          placeholder: '',
          min_value: null,
          max_value: null,
        },
        sectionQuestions.length
      );
      setQuestions([...questions, newQuestion]);
    } catch (error) {
      console.error('Failed to create question:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Update question
  const handleUpdateQuestion = async (questionId: string, data: Partial<QuestionFormData>) => {
    setIsLoading(true);
    try {
      const updated = await updateQuestion(questionId, data);
      setQuestions(questions.map((q) => (q.id === questionId ? updated : q)));
    } catch (error) {
      console.error('Failed to update question:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm(t('surveys.builder.deleteQuestionConfirm'))) return;
    setIsLoading(true);
    try {
      await deleteQuestion(questionId);
      setQuestions(questions.filter((q) => q.id !== questionId));
    } catch (error) {
      console.error('Failed to delete question:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save survey settings
  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      await updateSurvey(survey.id, surveySettings);
      onSurveyUpdate();
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to update survey:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Publish survey
  const handlePublish = async () => {
    if (questions.length === 0) {
      alert(t('surveys.builder.noQuestionsError'));
      return;
    }
    setIsLoading(true);
    try {
      await updateSurvey(survey.id, { is_published: !survey.is_published });
      onSurveyUpdate();
    } catch (error) {
      console.error('Failed to toggle publish:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--fc-section-hover,#1F1F1F)]">
      {/* Header */}
      <div className="bg-[var(--fc-section,#0A0A0A)] border-b border-[var(--fc-section-border,#1F1F1F)] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 text-[var(--fc-section-muted,#666666)] hover:text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)]">{survey.title}</h1>
              <p className="text-sm text-[var(--fc-section-muted,#666666)]">
                {t('surveys.questions', { count: questions.length })} •{' '}
                {t('surveys.sections', { count: sections.length })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(true)}
              className="px-3 py-2 text-sm text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              {t('surveys.builder.settings')}
            </button>
            <button
              onClick={handlePublish}
              disabled={isLoading}
              className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 ${
                survey.is_published
                  ? 'bg-[#EAB308]/10 text-[#EAB308] hover:bg-[#EAB308]/20'
                  : 'bg-[#22C55E] text-white hover:bg-[#22C55E]/80'
              }`}
            >
              <Eye className="w-4 h-4" />
              {survey.is_published ? t('surveys.builder.unpublish') : t('surveys.builder.publish')}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Unsectioned Questions */}
        {(unsectionedQuestions.length > 0 || sections.length > 0) && (
          <div className="space-y-3">
            {unsectionedQuestions.length > 0 && (
              <h2 className="text-sm font-medium text-[var(--fc-section-muted,#666666)] uppercase tracking-wide">
                {t('surveys.builder.generalQuestions')}
              </h2>
            )}
            {unsectionedQuestions.map((question) => (
              <QuestionEditor
                key={question.id}
                question={question}
                onUpdate={handleUpdateQuestion}
                onDelete={handleDeleteQuestion}
                isLoading={isLoading}
              />
            ))}
            {/* Add Unsectioned Question Button - visible when sections exist */}
            {sections.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowUnsectionedQuestionTypeMenu(!showUnsectionedQuestionTypeMenu)}
                  disabled={isLoading}
                  className="w-full py-3 border-2 border-dashed border-[var(--fc-section-border,#1F1F1F)] rounded-lg text-[var(--fc-section-muted,#666666)] hover:border-[#333333] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {t('surveys.builder.addQuestion')}
                </button>

                {showUnsectionedQuestionTypeMenu && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-lg z-10 p-2 grid grid-cols-2 gap-1">
                    {(Object.keys(questionTypeConfig) as SurveyQuestionType[]).map((type) => {
                      const config = questionTypeConfig[type];
                      const Icon = config.icon;
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            handleAddQuestion(null, type);
                            setShowUnsectionedQuestionTypeMenu(false);
                          }}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-3 py-2 text-left text-sm rounded-lg hover:bg-[var(--fc-section-hover,#151515)] hover:text-[var(--fc-section-text,#FAFAFA)] disabled:opacity-50"
                        >
                          <Icon className="w-4 h-4" />
                          {t(config.label)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sections */}
        {sections.map((section) => (
          <SectionEditor
            key={section.id}
            section={section}
            questions={getSectionQuestions(section.id)}
            onUpdateSection={handleUpdateSection}
            onDeleteSection={handleDeleteSection}
            onUpdateQuestion={handleUpdateQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onAddQuestion={handleAddQuestion}
            isLoading={isLoading}
          />
        ))}

        {/* Add Section / Question Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleAddSection}
            disabled={isLoading}
            className="flex-1 py-4 border-2 border-dashed border-[var(--fc-section-border,#1F1F1F)] rounded-xl text-[var(--fc-section-muted,#666666)] hover:border-[#333333] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            {t('surveys.builder.addSection')}
          </button>
          {sections.length === 0 && (
            <button
              onClick={() => handleAddQuestion(null, 'text')}
              disabled={isLoading}
              className="flex-1 py-4 border-2 border-dashed border-[var(--fc-section-border,#1F1F1F)] rounded-xl text-[var(--fc-section-muted,#666666)] hover:border-[#333333] hover:text-[var(--fc-section-text,#FAFAFA)] hover:bg-[var(--fc-section-hover,#151515)] transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('surveys.builder.addQuestion')}
            </button>
          )}
        </div>

        {/* Empty State */}
        {questions.length === 0 && sections.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-[var(--fc-section-muted,#A0A0A0)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--fc-section-text,#FAFAFA)] mb-2">
              {t('surveys.builder.emptyTitle')}
            </h3>
            <p className="text-[var(--fc-section-muted,#666666)] max-w-md mx-auto">
              {t('surveys.builder.emptyDescription')}
            </p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-[var(--fc-section,#0A0A0A)] rounded-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-[var(--fc-section-text,#FAFAFA)] mb-4">
              {t('surveys.builder.surveySettings')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('surveys.builder.surveyTitle')}
                </label>
                <input
                  type="text"
                  value={surveySettings.title}
                  onChange={(e) => setSurveySettings({ ...surveySettings, title: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--fc-section-muted,#A0A0A0)] mb-1">
                  {t('surveys.builder.surveyDescription')}
                </label>
                <textarea
                  value={surveySettings.description}
                  onChange={(e) => setSurveySettings({ ...surveySettings, description: e.target.value })}
                  className="w-full px-3 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg focus:ring-1 focus:ring-white/10"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surveySettings.is_required}
                    onChange={(e) => setSurveySettings({ ...surveySettings, is_required: e.target.checked })}
                    className="w-4 h-4 text-[var(--fc-section-text,#FAFAFA)] border-[var(--fc-section-border,#1F1F1F)] rounded focus:ring-white/10"
                  />
                  <span className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">{t('surveys.builder.surveyRequired')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={surveySettings.allow_edit}
                    onChange={(e) => setSurveySettings({ ...surveySettings, allow_edit: e.target.checked })}
                    className="w-4 h-4 text-[var(--fc-section-text,#FAFAFA)] border-[var(--fc-section-border,#1F1F1F)] rounded focus:ring-white/10"
                  />
                  <span className="text-sm text-[var(--fc-section-muted,#A0A0A0)]">{t('surveys.builder.allowEdit')}</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-sm text-[var(--fc-section-muted,#A0A0A0)] hover:bg-[var(--fc-section-hover,#1F1F1F)] rounded-lg"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSaveSettings}
                disabled={isLoading}
                className="px-4 py-2 text-sm bg-[var(--fc-text,white)] text-[var(--fc-surface,black)] font-medium rounded-lg hover:bg-[var(--fc-button-hover,#E0E0E0)] disabled:opacity-50"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyBuilder;
