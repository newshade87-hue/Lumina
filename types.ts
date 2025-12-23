
export enum Importance {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum TaskStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  DROPPED = 'Dropped',
  CANCELLED = 'Cancelled'
}

export type ThemeId = 'onyx' | 'quartz' | 'midnight' | 'forest' | 'matrix' | 'arcade' | 'nebula';

export interface Task {
  id: string;
  text: string;
  completed: boolean; // Keeping for backward compatibility
  status: TaskStatus;
  importance: Importance;
  createdAt: number;
  reminderAt?: number;
  dueDate?: number;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  tasks: Task[];
  category?: string;
  tags: string[];
  isArchived?: boolean;
}

export interface AIResult {
  summary: string;
  keywords: string[];
  sentiment: string;
  relatedConcepts: string[];
  suggestedTasks: Array<{
    text: string;
    importance: Importance;
  }>;
}
