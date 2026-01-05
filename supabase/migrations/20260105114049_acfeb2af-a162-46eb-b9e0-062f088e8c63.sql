-- Create task type enum
CREATE TYPE public.task_type AS ENUM ('task', 'milestone', 'meeting');

-- Update projects table with new fields
ALTER TABLE public.projects 
  ADD COLUMN client_name TEXT,
  ADD COLUMN timezone_pm TEXT DEFAULT 'UTC',
  ADD COLUMN timezone_client TEXT DEFAULT 'UTC',
  ADD COLUMN working_days_mask INTEGER DEFAULT 31,  -- Binary: Mon-Fri = 11111 = 31
  ADD COLUMN zoom_link_default TEXT,
  ADD COLUMN default_review_rounds INTEGER DEFAULT 2;

-- Update phases table
ALTER TABLE public.phases
  ADD COLUMN collapsed_by_default BOOLEAN DEFAULT FALSE;

-- Update tasks table with new fields
ALTER TABLE public.tasks
  ADD COLUMN task_type task_type NOT NULL DEFAULT 'task',
  ADD COLUMN client_visible BOOLEAN DEFAULT TRUE,
  ADD COLUMN weight_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN narrative_text TEXT,
  ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create canonical step library table (global, read-only for users)
CREATE TABLE public.canonical_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  task_type task_type NOT NULL DEFAULT 'task',
  default_weight_percent DECIMAL(5,2) DEFAULT 0,
  default_review_rounds INTEGER DEFAULT 0,
  is_optional BOOLEAN DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  category_group TEXT,  -- e.g., 'core', 'immersive_addon'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS but allow all authenticated users to read
ALTER TABLE public.canonical_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view canonical steps" 
ON public.canonical_steps 
FOR SELECT 
TO authenticated
USING (true);

-- Create project_steps junction table to track which steps are included in a project
CREATE TABLE public.project_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  canonical_step_id UUID NOT NULL REFERENCES public.canonical_steps(id) ON DELETE CASCADE,
  is_included BOOLEAN DEFAULT TRUE,
  custom_weight_percent DECIMAL(5,2),
  custom_review_rounds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, canonical_step_id)
);

ALTER TABLE public.project_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PMs can view project steps" 
ON public.project_steps 
FOR SELECT 
USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND (owner_id = auth.uid() OR public.has_project_access(auth.uid(), id)))
);

CREATE POLICY "PMs can manage project steps" 
ON public.project_steps 
FOR ALL 
USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);

-- Update comments table to add authorRole
ALTER TABLE public.comments
  ADD COLUMN author_role TEXT DEFAULT 'pm';

-- Update change_requests table to add authorRole  
ALTER TABLE public.change_requests
  ADD COLUMN author_role TEXT DEFAULT 'pm';

-- Update invites to add status field
ALTER TABLE public.invites
  ADD COLUMN status TEXT DEFAULT 'pending';