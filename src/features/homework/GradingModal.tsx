import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Loader2, FileText, Image, Film, ExternalLink, File } from 'lucide-react';
import { DbHomeworkSubmissionWithStudent } from '../../core/supabase/database.types';

interface GradingModalProps {
  submission: DbHomeworkSubmissionWithStudent;
  maxPoints: number;
  isOpen: boolean;
  onClose: () => void;
  onGrade: (points: number, feedback: string | null) => Promise<void>;
}

/**
 * Returns appropriate icon based on file URL extension
 */
const getFileIcon = (url: string) => {
  const extension = url.split('.').pop()?.toLowerCase() || '';
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
  const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv'];
  const documentExtensions = ['pdf', 'doc', 'docx', 'txt'];

  if (imageExtensions.includes(extension)) {
    return <Image size={16} className="text-[#A0A0A0]" />;
  }
  if (videoExtensions.includes(extension)) {
    return <Film size={16} className="text-[#FAFAFA]" />;
  }
  if (documentExtensions.includes(extension)) {
    return <FileText size={16} className="text-[#EF4444]" />;
  }
  return <File size={16} className="text-[#666666]" />;
};

/**
 * Extracts filename from URL
 */
const getFileName = (url: string, fallback: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const segments = pathname.split('/');
    return segments[segments.length - 1] || fallback;
  } catch {
    return url.split('/').pop() || fallback;
  }
};

const GradingModal: React.FC<GradingModalProps> = ({
  submission,
  maxPoints,
  isOpen,
  onClose,
  onGrade,
}) => {
  const { t } = useTranslation();
  const [points, setPoints] = useState<number>(
    submission.points_awarded ?? Math.round(maxPoints * 0.8)
  );
  const [feedback, setFeedback] = useState<string>(submission.feedback || '');
  const [isGrading, setIsGrading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const studentName = submission.student?.full_name || submission.student?.email || t('homeworkManagement.gradingModal.unknownStudent');
  const submittedDate = new Date(submission.submitted_at).toLocaleString();

  const handleGrade = async () => {
    setErrorMessage(null);
    setIsGrading(true);

    try {
      await onGrade(points, feedback.trim() || null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t('homeworkManagement.gradingModal.errorGradeFailed')
      );
      setIsGrading(false);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPoints(parseInt(e.target.value, 10));
  };

  // Calculate percentage for gradient styling
  const percentage = maxPoints > 0 ? (points / maxPoints) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#0A0A0A] rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1F1F1F]">
          <h3 className="text-lg font-semibold text-[#FAFAFA]">{t('homeworkManagement.gradingModal.title')}</h3>
          <button
            onClick={onClose}
            disabled={isGrading}
            className="p-1 hover:bg-[#1F1F1F] rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-[#666666]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Student Info */}
          <div className="bg-[#0A0A0A] rounded-lg p-4">
            <div className="flex items-center gap-3">
              {submission.student?.avatar_url ? (
                <img
                  src={submission.student.avatar_url}
                  alt={studentName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#1F1F1F] flex items-center justify-center">
                  <span className="text-[#FAFAFA] font-medium text-sm">
                    {studentName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h4 className="font-medium text-[#FAFAFA]">{studentName}</h4>
                <p className="text-xs text-[#666666]">{t('homeworkManagement.gradingModal.submittedLabel', { date: submittedDate })}</p>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] px-4 py-2 rounded-lg text-sm">
              {errorMessage}
            </div>
          )}

          {/* Student's Text Response */}
          {submission.text_response && (
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
                {t('homeworkManagement.gradingModal.studentResponseLabel')}
              </label>
              <div className="bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-4">
                <p className="text-sm text-[#A0A0A0] whitespace-pre-wrap">
                  {submission.text_response}
                </p>
              </div>
            </div>
          )}

          {/* Attached Files */}
          {submission.file_urls && submission.file_urls.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-2">
                {t('homeworkManagement.gradingModal.attachedFilesLabel')}
              </label>
              <div className="space-y-2">
                {submission.file_urls.map((url, index) => (
                  <a
                    key={index}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg hover:bg-[#1F1F1F] transition-colors group"
                  >
                    {getFileIcon(url)}
                    <span className="flex-1 text-sm text-[#A0A0A0] truncate">
                      {getFileName(url, t('homeworkManagement.gradingModal.fileDefaultName'))}
                    </span>
                    <ExternalLink
                      size={16}
                      className="text-[#666666] group-hover:text-[#FAFAFA] transition-colors"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* No Content Message */}
          {!submission.text_response && (!submission.file_urls || submission.file_urls.length === 0) && (
            <div className="bg-[#EAB308]/10 border border-[#EAB308]/20 text-[#EAB308] px-4 py-3 rounded-lg text-sm">
              {t('homeworkManagement.gradingModal.noContentWarning')}
            </div>
          )}

          {/* Grade Section */}
          <div className="border-t border-[#1F1F1F] pt-4">
            <label className="block text-sm font-medium text-[#A0A0A0] mb-3">
              {t('homeworkManagement.gradingModal.gradeLabel')}
            </label>

            {/* Points Display */}
            <div className="flex items-center justify-center mb-4">
              <div className="text-center">
                <span className="text-4xl font-bold text-[#FAFAFA]">{points}</span>
                <span className="text-2xl text-[#666666] ml-1">/ {maxPoints}</span>
                <p className="text-xs text-[#666666] mt-1">{t('homeworkManagement.gradingModal.pointsLabel')}</p>
              </div>
            </div>

            {/* Points Slider */}
            <div className="relative mb-6">
              <input
                type="range"
                min="0"
                max={maxPoints}
                value={points}
                onChange={handleSliderChange}
                className="w-full h-2 bg-[#1F1F1F] rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${percentage}%, #e2e8f0 ${percentage}%, #e2e8f0 100%)`,
                }}
              />
              <div className="flex justify-between text-xs text-[#666666] mt-1">
                <span>0</span>
                <span>{maxPoints}</span>
              </div>
            </div>

            {/* Feedback Textarea */}
            <div>
              <label className="block text-sm font-medium text-[#A0A0A0] mb-1">
                {t('homeworkManagement.gradingModal.feedbackLabel')} <span className="text-[#666666] font-normal">{t('homeworkManagement.gradingModal.feedbackOptional')}</span>
              </label>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="w-full px-4 py-3 border border-[#1F1F1F] rounded-lg focus:ring-1 focus:ring-white/10 focus:border-[#555555] h-24 resize-none"
                placeholder={t('homeworkManagement.gradingModal.feedbackPlaceholder')}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[#1F1F1F]">
          <button
            onClick={onClose}
            disabled={isGrading}
            className="flex-1 px-4 py-2 border border-[#1F1F1F] rounded-lg hover:bg-[#0A0A0A] font-medium text-[#A0A0A0] disabled:opacity-50"
          >
            {t('homeworkManagement.gradingModal.cancelButton')}
          </button>
          <button
            onClick={handleGrade}
            disabled={isGrading}
            className="flex-1 bg-[#22C55E] text-white px-4 py-2 rounded-lg hover:bg-[#22C55E]/90 disabled:opacity-50 font-medium flex items-center justify-center gap-2"
          >
            {isGrading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('homeworkManagement.gradingModal.grading')}
              </>
            ) : (
              t('homeworkManagement.gradingModal.awardPointsButton', { points })
            )}
          </button>
        </div>
      </div>

      {/* Custom slider thumb styles */}
      <style>{`
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        .slider-thumb::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
};

export default GradingModal;
