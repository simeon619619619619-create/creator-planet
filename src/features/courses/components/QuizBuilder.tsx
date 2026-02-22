// ============================================================================
// QUIZ BUILDER COMPONENT
// Allows creators to add/edit quiz questions and options
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  Check,
  AlertCircle,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { getQuizQuestions, saveQuizData } from '../quizService';

interface QuizOption {
  id?: string;
  option_text: string;
  is_correct: boolean;
  position: number;
}

interface QuizQuestion {
  id?: string;
  question_text: string;
  question_type: 'multiple_choice' | 'free_answer';
  correct_answer: string | null;
  position: number;
  options: QuizOption[];
}

interface QuizBuilderProps {
  lessonId: string;
  onSave?: () => void;
}

// Draft persistence for quiz questions
const QUIZ_DRAFT_PREFIX = 'quiz-draft-';

const saveQuizDraft = (lessonId: string, questions: QuizQuestion[]) => {
  try {
    sessionStorage.setItem(`${QUIZ_DRAFT_PREFIX}${lessonId}`, JSON.stringify(questions));
  } catch (e) {
    console.warn('Failed to save quiz draft:', e);
  }
};

const loadQuizDraft = (lessonId: string): QuizQuestion[] | null => {
  try {
    const stored = sessionStorage.getItem(`${QUIZ_DRAFT_PREFIX}${lessonId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load quiz draft:', e);
    return null;
  }
};

const clearQuizDraft = (lessonId: string) => {
  try {
    sessionStorage.removeItem(`${QUIZ_DRAFT_PREFIX}${lessonId}`);
  } catch (e) {
    console.warn('Failed to clear quiz draft:', e);
  }
};

const MAX_QUESTIONS = 20;
const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;
const MAX_QUESTION_LENGTH = 500;
const MAX_OPTION_LENGTH = 200;

const QuizBuilder: React.FC<QuizBuilderProps> = ({ lessonId, onSave }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const initialLoadDone = useRef(false);

  // Load existing quiz data (check for draft first)
  useEffect(() => {
    async function loadQuiz() {
      setIsLoading(true);

      // Check for unsaved draft first
      const draft = loadQuizDraft(lessonId);
      if (draft && draft.length > 0) {
        setQuestions(draft);
        setHasChanges(true); // Draft means there are unsaved changes
        setIsLoading(false);
        initialLoadDone.current = true;
        return;
      }

      // No draft, load from server
      const data = await getQuizQuestions(lessonId);
      if (data.length > 0) {
        setQuestions(
          data.map((q) => ({
            id: q.id,
            question_text: q.question_text,
            question_type: q.question_type || 'multiple_choice',
            correct_answer: q.correct_answer ?? null,
            position: q.position,
            options: q.options.map((o) => ({
              id: o.id,
              option_text: o.option_text,
              is_correct: o.is_correct,
              position: o.position,
            })),
          }))
        );
      } else {
        // Start with one empty question
        setQuestions([createEmptyQuestion(0)]);
      }
      setIsLoading(false);
      initialLoadDone.current = true;
    }
    loadQuiz();
  }, [lessonId]);

  // Save draft when questions change (only after initial load)
  useEffect(() => {
    if (!initialLoadDone.current || !hasChanges) return;
    saveQuizDraft(lessonId, questions);
  }, [lessonId, questions, hasChanges]);

  function createEmptyQuestion(position: number): QuizQuestion {
    return {
      question_text: '',
      question_type: 'multiple_choice',
      correct_answer: null,
      position,
      options: [
        { option_text: '', is_correct: true, position: 0 },
        { option_text: '', is_correct: false, position: 1 },
      ],
    };
  }

  function addQuestion() {
    if (questions.length >= MAX_QUESTIONS) return;
    setQuestions([...questions, createEmptyQuestion(questions.length)]);
    setHasChanges(true);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    const newQuestions = questions.filter((_, i) => i !== index);
    // Update positions
    newQuestions.forEach((q, i) => (q.position = i));
    setQuestions(newQuestions);
    setHasChanges(true);
  }

  function updateQuestion(index: number, text: string) {
    const newQuestions = [...questions];
    newQuestions[index].question_text = text.slice(0, MAX_QUESTION_LENGTH);
    setQuestions(newQuestions);
    setHasChanges(true);
  }

  function updateQuestionType(
    index: number,
    type: QuizQuestion['question_type']
  ) {
    const newQuestions = [...questions];
    newQuestions[index].question_type = type;
    if (type === 'free_answer') {
      newQuestions[index].correct_answer = newQuestions[index].correct_answer || '';
    } else {
      newQuestions[index].correct_answer = null;
    }
    if (type === 'multiple_choice' && newQuestions[index].options.length < MIN_OPTIONS) {
      newQuestions[index].options = [
        { option_text: '', is_correct: true, position: 0 },
        { option_text: '', is_correct: false, position: 1 },
      ];
    }
    setQuestions(newQuestions);
    setHasChanges(true);
  }

  function updateCorrectAnswer(index: number, value: string) {
    const newQuestions = [...questions];
    newQuestions[index].correct_answer = value.slice(0, MAX_OPTION_LENGTH);
    setQuestions(newQuestions);
    setHasChanges(true);
  }

  function addOption(questionIndex: number) {
    const question = questions[questionIndex];
    if (question.options.length >= MAX_OPTIONS) return;
    const newQuestions = [...questions];
    newQuestions[questionIndex].options.push({
      option_text: '',
      is_correct: false,
      position: question.options.length,
    });
    setQuestions(newQuestions);
    setHasChanges(true);
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    const question = questions[questionIndex];
    if (question.options.length <= MIN_OPTIONS) return;

    const removedOption = question.options[optionIndex];
    const newQuestions = [...questions];
    newQuestions[questionIndex].options = question.options.filter(
      (_, i) => i !== optionIndex
    );
    // Update positions
    newQuestions[questionIndex].options.forEach((o, i) => (o.position = i));

    // If we removed the correct answer, make the first option correct
    if (removedOption.is_correct && newQuestions[questionIndex].options.length > 0) {
      newQuestions[questionIndex].options[0].is_correct = true;
    }

    setQuestions(newQuestions);
    setHasChanges(true);
  }

  function updateOption(questionIndex: number, optionIndex: number, text: string) {
    const newQuestions = [...questions];
    newQuestions[questionIndex].options[optionIndex].option_text = text.slice(
      0,
      MAX_OPTION_LENGTH
    );
    setQuestions(newQuestions);
    setHasChanges(true);
  }

  function setCorrectOption(questionIndex: number, optionIndex: number) {
    const newQuestions = [...questions];
    // Unset all options as correct
    newQuestions[questionIndex].options.forEach((o) => (o.is_correct = false));
    // Set the selected one as correct
    newQuestions[questionIndex].options[optionIndex].is_correct = true;
    setQuestions(newQuestions);
    setHasChanges(true);
  }

  function validateQuiz(): string | null {
    if (questions.length === 0) {
      return 'Add at least one question';
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question_text.trim()) {
        return `Question ${i + 1} is empty`;
      }
      if (q.question_type === 'multiple_choice') {
        if (q.options.length < MIN_OPTIONS) {
          return `Question ${i + 1} needs at least ${MIN_OPTIONS} options`;
        }
        const hasCorrect = q.options.some((o) => o.is_correct);
        if (!hasCorrect) {
          return `Question ${i + 1} needs a correct answer`;
        }
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].option_text.trim()) {
            return `Question ${i + 1}, Option ${j + 1} is empty`;
          }
        }
      } else if (!q.correct_answer?.trim()) {
        return `Question ${i + 1} needs a correct answer`;
      }
    }
    return null;
  }

  async function handleSave() {
    const validationError = validateQuiz();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSaving(true);

    const success = await saveQuizData(lessonId, questions);

    if (success) {
      clearQuizDraft(lessonId); // Clear draft on successful save
      setHasChanges(false);
      onSave?.();
    } else {
      setError('Failed to save quiz. Please try again.');
    }

    setIsSaving(false);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-slate-900">Quiz Questions</h3>
          <span className="text-sm text-slate-500">
            ({questions.length}/{MAX_QUESTIONS})
          </span>
        </div>
        <div className="text-xs text-slate-500">70% required to pass</div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Questions */}
      <div className="space-y-6">
        {questions.map((question, qIndex) => (
          <div
            key={qIndex}
            className="bg-slate-50 rounded-xl p-4 border border-slate-200"
          >
            {/* Question Header */}
            <div className="flex items-start gap-3 mb-4">
              <div className="flex items-center gap-2 text-slate-400 pt-2">
                <GripVertical size={16} />
                <span className="text-sm font-medium text-slate-600">
                  Q{qIndex + 1}
                </span>
              </div>
              <div className="flex-1">
                <textarea
                  value={question.question_text}
                  onChange={(e) => updateQuestion(qIndex, e.target.value)}
                  placeholder="Enter your question..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900"
                  rows={2}
                />
                <div className="text-xs text-slate-400 mt-1 text-right">
                  {question.question_text.length}/{MAX_QUESTION_LENGTH}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => updateQuestionType(qIndex, 'multiple_choice')}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      question.question_type === 'multiple_choice'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    Multiple choice
                  </button>
                  <button
                    type="button"
                    onClick={() => updateQuestionType(qIndex, 'free_answer')}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      question.question_type === 'free_answer'
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    Free answer
                  </button>
                </div>
              </div>
              <button
                onClick={() => removeQuestion(qIndex)}
                disabled={questions.length <= 1}
                className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Remove question"
              >
                <Trash2 size={18} />
              </button>
            </div>

            {question.question_type === 'multiple_choice' ? (
              <div className="ml-10 space-y-2">
                {question.options.map((option, oIndex) => (
                  <div key={oIndex} className="flex items-center gap-2">
                    <button
                      onClick={() => setCorrectOption(qIndex, oIndex)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                        option.is_correct
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-slate-300 hover:border-green-400'
                      }`}
                      title={option.is_correct ? 'Correct answer' : 'Mark as correct'}
                    >
                      {option.is_correct && <Check size={14} />}
                    </button>
                    <input
                      type="text"
                      value={option.option_text}
                      onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                      placeholder={`Option ${oIndex + 1}`}
                      className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 ${
                        option.is_correct
                          ? 'border-green-300 bg-green-50'
                          : 'border-slate-200 bg-white'
                      }`}
                    />
                    <button
                      onClick={() => removeOption(qIndex, oIndex)}
                      disabled={question.options.length <= MIN_OPTIONS}
                      className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="Remove option"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {question.options.length < MAX_OPTIONS && (
                  <button
                    onClick={() => addOption(qIndex)}
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 ml-8"
                  >
                    <Plus size={14} />
                    Add Option
                  </button>
                )}
              </div>
            ) : (
              <div className="ml-10">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Correct answer
                </label>
                <input
                  type="text"
                  value={question.correct_answer || ''}
                  onChange={(e) => updateCorrectAnswer(qIndex, e.target.value)}
                  placeholder="Enter the expected answer..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 bg-white"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Question Button */}
      {questions.length < MAX_QUESTIONS && (
        <button
          onClick={addQuestion}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          Add Question
        </button>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div className="text-sm text-slate-500">
          {hasChanges ? (
            <span className="text-amber-600">Unsaved changes</span>
          ) : (
            'All changes saved'
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Saving...
            </>
          ) : (
            'Save Quiz'
          )}
        </button>
      </div>
    </div>
  );
};

export default QuizBuilder;
