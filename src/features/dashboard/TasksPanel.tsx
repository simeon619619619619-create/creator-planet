import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Clock, Trash2, Plus, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../core/contexts/AuthContext';
import { DbTask, TaskStatus } from '../../core/supabase/database.types';
import {
  getTasks,
  createTask,
  updateTaskStatus,
  deleteTask,
  formatDueDate,
  isOverdue,
  getTaskStatusColor,
  getTaskStatusLabel,
} from './taskService';

const TasksPanel: React.FC = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<DbTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
  });

  useEffect(() => {
    if (profile?.id) {
      loadTasks();
    }
  }, [profile?.id]);

  const loadTasks = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      // Use profile.id because tasks.creator_id references profiles.id
      const data = await getTasks(profile.id);
      setTasks(data);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id || !newTask.title.trim()) return;

    // Use profile.id because tasks.creator_id references profiles.id
    const task = await createTask(
      profile.id,
      newTask.title,
      newTask.description || undefined,
      newTask.dueDate || undefined
    );

    if (task) {
      setTasks([task, ...tasks]);
      setNewTask({ title: '', description: '', dueDate: '' });
      setShowNewTaskForm(false);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    const success = await updateTaskStatus(taskId, newStatus);
    if (success) {
      setTasks(tasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const success = await deleteTask(taskId);
    if (success) {
      setTasks(tasks.filter(task => task.id !== taskId));
    }
  };

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter(task => task.status === filter);

  const taskCounts = {
    all: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case 'todo':
        return <Circle size={18} className="text-slate-400" />;
      case 'in_progress':
        return <Clock size={18} className="text-blue-500" />;
      case 'done':
        return <CheckCircle2 size={18} className="text-emerald-500" />;
    }
  };

  const getNextStatus = (currentStatus: TaskStatus): TaskStatus => {
    switch (currentStatus) {
      case 'todo':
        return 'in_progress';
      case 'in_progress':
        return 'done';
      case 'done':
        return 'todo';
      default:
        return 'todo';
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-slate-900">{t('creatorDashboard.tasks.title')}</h2>
        <button
          onClick={() => setShowNewTaskForm(!showNewTaskForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          {showNewTaskForm ? (
            <>
              <X size={16} />
              {t('creatorDashboard.tasks.cancel')}
            </>
          ) : (
            <>
              <Plus size={16} />
              {t('creatorDashboard.tasks.newTask')}
            </>
          )}
        </button>
      </div>

      {/* New Task Form */}
      {showNewTaskForm && (
        <form onSubmit={handleCreateTask} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="space-y-3">
            <div>
              <input
                type="text"
                placeholder={t('creatorDashboard.tasks.form.titlePlaceholder')}
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <textarea
                placeholder={t('creatorDashboard.tasks.form.descriptionPlaceholder')}
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={2}
              />
            </div>
            <div>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {t('creatorDashboard.tasks.form.createButton')}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {(['all', 'todo', 'in_progress', 'done'] as const).map((status) => {
          const label = status === 'all'
            ? t('creatorDashboard.tasks.filter.all')
            : status === 'todo'
            ? t('creatorDashboard.tasks.filter.todo')
            : status === 'in_progress'
            ? t('creatorDashboard.tasks.filter.inProgress')
            : t('creatorDashboard.tasks.filter.done');
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                filter === status
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {label} ({taskCounts[status]})
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <div
              key={task.id}
              className="group p-4 rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                {/* Status Icon - clickable to cycle through statuses */}
                <button
                  onClick={() => handleStatusChange(task.id, getNextStatus(task.status))}
                  className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform"
                  title={t('creatorDashboard.tasks.changeStatusTooltip', { status: getTaskStatusLabel(getNextStatus(task.status)) })}
                >
                  {getStatusIcon(task.status)}
                </button>

                {/* Task Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className={`text-sm font-semibold ${
                        task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-900'
                      }`}
                    >
                      {task.title}
                    </h3>
                    <button
                      onClick={() => handleDeleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all"
                      title={t('creatorDashboard.tasks.deleteTooltip')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {task.description && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    {/* Status Badge */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getTaskStatusColor(task.status)}`}>
                      {getTaskStatusLabel(task.status)}
                    </span>

                    {/* Due Date */}
                    {task.due_date && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${
                          isOverdue(task.due_date) && task.status !== 'done'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isOverdue(task.due_date) && task.status !== 'done' && (
                          <AlertCircle size={10} />
                        )}
                        {formatDueDate(task.due_date)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Circle className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">{t('creatorDashboard.tasks.empty.title')}</p>
            <p className="text-xs mt-1">
              {filter === 'all'
                ? t('creatorDashboard.tasks.empty.createFirst')
                : t('creatorDashboard.tasks.empty.noTasksWithStatus', { status: getTaskStatusLabel(filter as TaskStatus).toLowerCase() })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TasksPanel;
