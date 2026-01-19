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
export type TaskType = 'task' | 'milestone' | 'meeting';
export type ChangeRequestStatus = 'pending' | 'approved' | 'rejected';
export type RightsAgreementStatus = 'draft' | 'sent' | 'viewed' | 'signed' | 'declined';
export type UsageCategory = 'digital' | 'paid_media' | 'pos_retail' | 'print' | 'ooh' | 'tv';

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
  client_name: string | null;
  client_logo_url: string | null;
  start_date: string;
  end_date: string;
  status: ProjectStatus;
  owner_id: string;
  buffer_percentage: number;
  default_review_rounds: number;
  timezone_pm: string;
  timezone_client: string;
  working_days_mask: number; // Binary mask: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16 (Mon-Fri = 31)
  zoom_link_default: string | null;
  checkin_time: string | null;
  checkin_duration: number | null;
  checkin_timezone: string | null;
  checkin_frequency: string | null;
  checkin_weekday: string | null;
  pm_name: string | null;
  pm_email: string | null;
  pm_whatsapp: string | null;
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
  collapsed_by_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  phase_id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  status: TaskStatus;
  task_type: TaskType;
  percentage_allocation: number;
  weight_percent: number;
  is_milestone: boolean;
  is_feedback_meeting: boolean;
  client_visible: boolean;
  review_rounds: number;
  narrative_text: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  recurring_dates?: string[]; // For recurring meetings (e.g., weekly calls) - client-side only
}

// Segment types
export type SegmentType = 'work' | 'review';

// Task segment for multi-period tasks
export interface TaskSegment {
  id: string;
  task_id: string;
  start_date: string;
  end_date: string;
  order_index: number;
  segment_type: SegmentType;
  created_at: string;
}

// Extended task type with segments
export interface TaskWithSegments extends Task {
  segments?: TaskSegment[];
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
  status: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  author_role: string;
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
  author_role: string;
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

// Canonical step library (global, read-only)
export interface CanonicalStep {
  id: string;
  phase_category: string;
  name: string;
  description: string | null;
  task_type: TaskType;
  default_weight_percent: number;
  default_review_rounds: number;
  is_optional: boolean;
  sort_order: number;
  category_group: string | null; // 'core' | 'immersive_addon'
  created_at: string;
}

// Project-specific step configuration
export interface ProjectStep {
  id: string;
  project_id: string;
  canonical_step_id: string;
  is_included: boolean;
  custom_weight_percent: number | null;
  custom_review_rounds: number | null;
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

export interface CanonicalStepWithSelection extends CanonicalStep {
  is_included: boolean;
  custom_weight_percent: number | null;
  custom_review_rounds: number | null;
}

// Rights Agreement types
export interface RightsAgreement {
  id: string;
  project_id: string;
  client_name: string;
  client_email: string;
  client_contact_name: string | null;
  agreement_date: string;
  valid_from: string;
  valid_until: string | null;
  status: RightsAgreementStatus;
  docusign_envelope_id: string | null;
  generated_document_path: string | null;
  signed_document_path: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RightsUsageSelection {
  id: string;
  agreement_id: string;
  category: UsageCategory;
  is_paid: boolean;
  geographies: string[];
  period_start: string;
  period_end: string | null;
  created_at: string;
}

// Phase categories for grouping
export const PHASE_CATEGORIES = [
  'Client Check-ins',
  'Pre-Production', 
  'Production',
  'Post-Production',
  'Delivery',
  'Immersive'
] as const;

export type PhaseCategory = typeof PHASE_CATEGORIES[number];

// Phase category colors
export const PHASE_CATEGORY_COLORS: Record<PhaseCategory | string, string> = {
  'Client Check-ins': '#9CA3AF', // Light grey
  'Pre-Production': '#F59E0B', // Amber
  'Production': '#22D3EE',     // Cyan
  'Post-Production': '#10B981', // Green
  'Delivery': '#F97316',       // Orange
  'Immersive': '#EC4899'       // Pink
};

// Phase weights for time allocation (must sum to 100 for active phases)
export const PHASE_WEIGHTS: Record<PhaseCategory, number> = {
  'Client Check-ins': 0, // Check-ins don't consume allocation
  'Pre-Production': 20,
  'Production': 59,
  'Post-Production': 20,
  'Delivery': 1,
  'Immersive': 0, // Add-on, allocated separately
};
