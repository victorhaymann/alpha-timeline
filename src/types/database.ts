/**
 * VFX Timeline Pro - Database Types
 * 
 * MVP Scope:
 * - Wizard → Schedule Engine → Gantt+Calendar → Client Portal → Exports → Integrations (placeholders)
 * 
 * This file contains TypeScript types matching our Supabase schema
 */

export type UserRole = 'pm' | 'client';
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'completed' | 'blocked';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string;
  status: ProjectStatus;
  owner_id: string;
  buffer_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  percentage_allocation: number;
  order_index: number;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  phase_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TaskStatus;
  percentage_allocation: number;
  is_milestone: boolean;
  is_feedback_meeting: boolean;
  review_rounds: number;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface Dependency {
  id: string;
  predecessor_task_id: string;
  successor_task_id: string;
  lag_days: number;
  created_at: string;
}

export interface Invite {
  id: string;
  project_id: string;
  email: string;
  role: UserRole;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ChangeRequest {
  id: string;
  project_id: string;
  task_id: string | null;
  user_id: string;
  title: string;
  description: string;
  status: ChangeRequestStatus;
  response: string | null;
  responded_at: string | null;
  created_at: string;
}

export interface AttachmentLink {
  id: string;
  task_id: string;
  url: string;
  title: string | null;
  created_by: string;
  created_at: string;
}

export interface StepTemplate {
  id: string;
  name: string;
  description: string | null;
  default_percentage: number;
  category: string | null;
  is_milestone: boolean;
  is_feedback_meeting: boolean;
  default_review_rounds: number;
  owner_id: string;
  created_at: string;
}

// Extended types with relations
export interface PhaseWithTasks extends Phase {
  tasks: Task[];
}

export interface ProjectWithPhases extends Project {
  phases: PhaseWithTasks[];
}

export interface TaskWithDependencies extends Task {
  dependencies: Dependency[];
  dependents: Dependency[];
}
