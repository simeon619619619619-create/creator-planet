import { supabase } from '../../core/supabase/client';
import { DbTask, TaskStatus } from '../../core/supabase/database.types';

// ============================================================================
// TASKS
// ============================================================================

export async function getTasks(creatorId: string): Promise<DbTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks:', error);
    return [];
  }
  return data || [];
}

export async function getTasksByStatus(
  creatorId: string,
  status: TaskStatus
): Promise<DbTask[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('creator_id', creatorId)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks by status:', error);
    return [];
  }
  return data || [];
}

export async function createTask(
  creatorId: string,
  title: string,
  description?: string,
  dueDate?: string,
  linkedType?: string,
  linkedId?: string
): Promise<DbTask | null> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      creator_id: creatorId,
      title,
      description,
      due_date: dueDate,
      linked_type: linkedType,
      linked_id: linkedId,
      status: 'todo',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating task:', error);
    return null;
  }
  return data;
}

export async function updateTask(
  taskId: string,
  updates: Partial<Omit<DbTask, 'id' | 'creator_id' | 'created_at' | 'updated_at'>>
): Promise<DbTask | null> {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating task:', error);
    return null;
  }
  return data;
}

export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', taskId);

  if (error) {
    console.error('Error updating task status:', error);
    return false;
  }
  return true;
}

export async function deleteTask(taskId: string): Promise<boolean> {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId);

  if (error) {
    console.error('Error deleting task:', error);
    return false;
  }
  return true;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return '';

  const date = new Date(dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const taskDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (taskDate.getTime() === today.getTime()) {
    return 'Today';
  } else if (taskDate.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  } else if (taskDate < today) {
    return 'Overdue';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const date = new Date(dueDate);
  const now = new Date();
  return date < now;
}

export function getTaskStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'todo':
      return 'bg-slate-100 text-slate-700';
    case 'in_progress':
      return 'bg-blue-100 text-blue-700';
    case 'done':
      return 'bg-emerald-100 text-emerald-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function getTaskStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'todo':
      return 'To Do';
    case 'in_progress':
      return 'In Progress';
    case 'done':
      return 'Done';
    default:
      return status;
  }
}
