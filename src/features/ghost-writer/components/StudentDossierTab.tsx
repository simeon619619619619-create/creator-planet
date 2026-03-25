import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Loader2,
  Utensils,
  Dumbbell,
  Moon,
  Scale,
  Smile,
  Target,
  TrendingUp,
  Filter,
  FileText,
  Calendar,
} from 'lucide-react';
import { getStudentDataPoints } from '../ghostWriterService';
import type { DbStudentDataPoint } from '../ghostWriterTypes';

interface StudentDossierTabProps {
  studentId: string;
  communityId: string;
}

const FIELD_ICONS: Record<string, React.ReactNode> = {
  'Хранене': <Utensils className="w-4 h-4" />,
  'Тренировки': <Dumbbell className="w-4 h-4" />,
  'Сън': <Moon className="w-4 h-4" />,
  'Тегло': <Scale className="w-4 h-4" />,
  'Настроение': <Smile className="w-4 h-4" />,
  'Цели': <Target className="w-4 h-4" />,
  'Напредък': <TrendingUp className="w-4 h-4" />,
};

function getFieldIcon(fieldName: string): React.ReactNode {
  return FIELD_ICONS[fieldName] ?? <FileText className="w-4 h-4" />;
}

const StudentDossierTab: React.FC<StudentDossierTabProps> = ({ studentId, communityId }) => {
  const { t } = useTranslation();
  const [dataPoints, setDataPoints] = useState<DbStudentDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterField, setFilterField] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const points = await getStudentDataPoints(studentId, communityId);
        if (!cancelled) {
          setDataPoints(points);
        }
      } catch (error) {
        console.error('Error loading student data points:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [studentId, communityId]);

  // Group data points by field_name
  const grouped: Record<string, DbStudentDataPoint[]> = {};
  const fieldNames: string[] = [];

  for (const dp of dataPoints) {
    if (!grouped[dp.field_name]) {
      grouped[dp.field_name] = [];
      fieldNames.push(dp.field_name);
    }
    grouped[dp.field_name].push(dp);
  }

  // Apply filter
  const visibleFields = filterField ? fieldNames.filter((f) => f === filterField) : fieldNames;

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[var(--fc-section-text,#FAFAFA)] animate-spin" />
      </div>
    );
  }

  if (dataPoints.length === 0) {
    return (
      <div className="p-12 text-center">
        <FileText className="w-16 h-16 text-[var(--fc-section-muted,#A0A0A0)] mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-[var(--fc-section-muted,#A0A0A0)] mb-2">
          {t('ghostWriter.dossier.emptyTitle', { defaultValue: 'Няма данни' })}
        </h3>
        <p className="text-[var(--fc-section-muted,#666666)] max-w-md mx-auto">
          {t('ghostWriter.dossier.emptyDescription', {
            defaultValue: 'Все още няма събрани данни за този ученик. AI Авторът ще събира информация от разговорите.',
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-[var(--fc-section-muted,#666666)]" />
        <select
          value={filterField}
          onChange={(e) => setFilterField(e.target.value)}
          className="px-3 py-2 border border-[var(--fc-section-border,#1F1F1F)] rounded-lg bg-[var(--fc-section,#0A0A0A)] text-[var(--fc-section-text,#FAFAFA)] text-sm focus:outline-none focus:border-[var(--fc-section-text,#555555)]"
        >
          <option value="">
            {t('ghostWriter.dossier.filterAll', { defaultValue: 'Всички' })}
          </option>
          {fieldNames.map((name) => (
            <option key={name} value={name}>
              {name} ({grouped[name].length})
            </option>
          ))}
        </select>
      </div>

      {/* Sections */}
      {visibleFields.map((fieldName) => (
        <div
          key={fieldName}
          className="bg-[var(--fc-section,#0A0A0A)] border border-[var(--fc-section-border,#1F1F1F)] rounded-xl overflow-hidden"
        >
          {/* Section Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-[var(--fc-section-hover,#151515)] border-b border-[var(--fc-section-border,#1F1F1F)]">
            <span className="text-[var(--fc-section-text,#FAFAFA)]">
              {getFieldIcon(fieldName)}
            </span>
            <h3 className="text-sm font-semibold text-[var(--fc-section-text,#FAFAFA)]">
              {fieldName}
            </h3>
            <span className="ml-auto text-xs text-[var(--fc-section-muted,#666666)]">
              {grouped[fieldName].length}{' '}
              {t('ghostWriter.dossier.entries', { defaultValue: 'записа' })}
            </span>
          </div>

          {/* Timeline Entries */}
          <div className="divide-y divide-[var(--fc-section-border,#1F1F1F)]">
            {grouped[fieldName].map((dp) => (
              <div key={dp.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex items-center gap-1.5 text-[var(--fc-section-muted,#666666)] text-xs whitespace-nowrap pt-0.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(dp.collected_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <p className="text-sm text-[var(--fc-section-text,#FAFAFA)] leading-relaxed">
                  {dp.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StudentDossierTab;
