import React, { useState, useEffect } from 'react';
import { X, Loader2, Users, TrendingUp, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { getCourseAnalytics, CourseAnalytics } from '../courseService';

interface CourseAnalyticsPanelProps {
  courseId: string;
  courseName: string;
  isOpen: boolean;
  onClose: () => void;
}

const CourseAnalyticsPanel: React.FC<CourseAnalyticsPanelProps> = ({
  courseId,
  courseName,
  isOpen,
  onClose,
}) => {
  const [analytics, setAnalytics] = useState<CourseAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLessons, setExpandedLessons] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAnalytics();
    }
  }, [isOpen, courseId]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    const data = await getCourseAnalytics(courseId);
    setAnalytics(data);
    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-3xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Course Analytics</h3>
            <p className="text-sm text-slate-500">{courseName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : analytics ? (
            <div className="space-y-6">
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-indigo-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-indigo-600 mb-1">
                    <Users size={18} />
                    <span className="text-sm font-medium">Enrolled</span>
                  </div>
                  <p className="text-2xl font-bold text-indigo-900">{analytics.enrolledCount}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-emerald-600 mb-1">
                    <TrendingUp size={18} />
                    <span className="text-sm font-medium">Completion</span>
                  </div>
                  <p className="text-2xl font-bold text-emerald-900">{analytics.completionRate}%</p>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-purple-600 mb-1">
                    <Activity size={18} />
                    <span className="text-sm font-medium">Active (7d)</span>
                  </div>
                  <p className="text-2xl font-bold text-purple-900">{analytics.activeStudents}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-amber-600 mb-1">
                    <TrendingUp size={18} />
                    <span className="text-sm font-medium">Avg Progress</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">{analytics.averageProgress}%</p>
                </div>
              </div>

              {/* Lesson Completion Rates */}
              <div className="bg-slate-50 rounded-xl p-4">
                <button
                  onClick={() => setExpandedLessons(!expandedLessons)}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <h4 className="font-semibold text-slate-900">Lesson Completion Rates</h4>
                  {expandedLessons ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {analytics.lessonCompletionRates.length === 0 ? (
                  <p className="text-sm text-slate-500">No lessons in this course yet</p>
                ) : (
                  <div className={`space-y-2 ${!expandedLessons ? 'max-h-40 overflow-hidden' : ''}`}>
                    {analytics.lessonCompletionRates.map((lesson) => (
                      <div key={lesson.lessonId} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 truncate">
                            {lesson.lessonTitle}
                          </p>
                          <p className="text-xs text-slate-500">{lesson.moduleName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all"
                              style={{ width: `${lesson.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-slate-600 w-10 text-right">
                            {lesson.completionRate}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Student Progress */}
              <div className="bg-slate-50 rounded-xl p-4">
                <button
                  onClick={() => setExpandedStudents(!expandedStudents)}
                  className="w-full flex items-center justify-between mb-3"
                >
                  <h4 className="font-semibold text-slate-900">Student Progress</h4>
                  {expandedStudents ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {analytics.studentProgress.length === 0 ? (
                  <p className="text-sm text-slate-500">No students enrolled yet</p>
                ) : (
                  <div className={`space-y-3 ${!expandedStudents ? 'max-h-48 overflow-hidden' : ''}`}>
                    {analytics.studentProgress
                      .sort((a, b) => b.progressPercent - a.progressPercent)
                      .map((student) => {
                        const isInactive = student.lastActivityAt
                          ? new Date(student.lastActivityAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                          : true;

                        return (
                          <div
                            key={student.userId}
                            className="flex items-center gap-3 bg-white rounded-lg p-3 border border-slate-100"
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                              {student.avatarUrl ? (
                                <img
                                  src={student.avatarUrl}
                                  alt={student.userName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-semibold text-slate-500">
                                  {student.userName.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 truncate flex items-center gap-2">
                                {student.userName}
                                {isInactive && (
                                  <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                    Inactive
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                {student.completedLessons}/{student.totalLessons} lessons
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    student.progressPercent >= 80
                                      ? 'bg-emerald-500'
                                      : student.progressPercent >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-slate-400'
                                  }`}
                                  style={{ width: `${student.progressPercent}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-600 w-10 text-right">
                                {student.progressPercent}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-center text-slate-500 py-12">Failed to load analytics</p>
          )}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium text-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseAnalyticsPanel;
