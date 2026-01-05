-- Create enum types for roles and statuses
CREATE TYPE public.user_role AS ENUM ('pm', 'client');
CREATE TYPE public.project_status AS ENUM ('draft', 'active', 'completed', 'archived');
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'review', 'completed', 'blocked');
CREATE TYPE public.change_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'pm',
  UNIQUE(user_id, role)
);

-- Projects table
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status project_status NOT NULL DEFAULT 'draft',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buffer_percentage INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Phases table (major project phases)
CREATE TABLE public.phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  percentage_allocation DECIMAL(5,2) NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id UUID NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  status task_status NOT NULL DEFAULT 'pending',
  percentage_allocation DECIMAL(5,2) NOT NULL DEFAULT 0,
  is_milestone BOOLEAN DEFAULT FALSE,
  is_feedback_meeting BOOLEAN DEFAULT FALSE,
  review_rounds INTEGER DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dependencies table
CREATE TABLE public.dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  successor_task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  lag_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(predecessor_task_id, successor_task_id)
);

-- Project invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments table
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Change requests table
CREATE TABLE public.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status change_request_status NOT NULL DEFAULT 'pending',
  response TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attachment links table (no file uploads, just links)
CREATE TABLE public.attachment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step templates table (pre-registered steps for wizard)
CREATE TABLE public.step_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  default_percentage DECIMAL(5,2) DEFAULT 0,
  category TEXT,
  is_milestone BOOLEAN DEFAULT FALSE,
  is_feedback_meeting BOOLEAN DEFAULT FALSE,
  default_review_rounds INTEGER DEFAULT 0,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.step_templates ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check project access (owner or invited)
CREATE OR REPLACE FUNCTION public.has_project_access(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND owner_id = _user_id
    UNION
    SELECT 1 FROM public.invites 
    WHERE project_id = _project_id 
      AND email = (SELECT email FROM public.profiles WHERE id = _user_id)
      AND accepted_at IS NOT NULL
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Projects policies
CREATE POLICY "PMs can view own projects" ON public.projects FOR SELECT USING (owner_id = auth.uid() OR public.has_project_access(auth.uid(), id));
CREATE POLICY "PMs can create projects" ON public.projects FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "PMs can update own projects" ON public.projects FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "PMs can delete own projects" ON public.projects FOR DELETE USING (owner_id = auth.uid());

-- Phases policies
CREATE POLICY "Users can view phases of accessible projects" ON public.phases FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND (owner_id = auth.uid() OR public.has_project_access(auth.uid(), id)))
);
CREATE POLICY "PMs can manage phases" ON public.phases FOR ALL USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);

-- Tasks policies
CREATE POLICY "Users can view tasks of accessible projects" ON public.tasks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.phases p 
    JOIN public.projects pr ON p.project_id = pr.id 
    WHERE p.id = phase_id AND (pr.owner_id = auth.uid() OR public.has_project_access(auth.uid(), pr.id))
  )
);
CREATE POLICY "PMs can manage tasks" ON public.tasks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.phases p 
    JOIN public.projects pr ON p.project_id = pr.id 
    WHERE p.id = phase_id AND pr.owner_id = auth.uid()
  )
);

-- Dependencies policies
CREATE POLICY "Users can view dependencies" ON public.dependencies FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.phases p ON t.phase_id = p.id
    JOIN public.projects pr ON p.project_id = pr.id
    WHERE (t.id = predecessor_task_id OR t.id = successor_task_id)
    AND (pr.owner_id = auth.uid() OR public.has_project_access(auth.uid(), pr.id))
  )
);
CREATE POLICY "PMs can manage dependencies" ON public.dependencies FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.phases p ON t.phase_id = p.id
    JOIN public.projects pr ON p.project_id = pr.id
    WHERE t.id = predecessor_task_id AND pr.owner_id = auth.uid()
  )
);

-- Invites policies
CREATE POLICY "PMs can view project invites" ON public.invites FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);
CREATE POLICY "PMs can create invites" ON public.invites FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);
CREATE POLICY "PMs can delete invites" ON public.invites FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);

-- Comments policies
CREATE POLICY "Users can view comments on accessible tasks" ON public.comments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.phases p ON t.phase_id = p.id
    JOIN public.projects pr ON p.project_id = pr.id
    WHERE t.id = task_id AND (pr.owner_id = auth.uid() OR public.has_project_access(auth.uid(), pr.id))
  )
);
CREATE POLICY "Users can create comments" ON public.comments FOR INSERT WITH CHECK (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.phases p ON t.phase_id = p.id
    JOIN public.projects pr ON p.project_id = pr.id
    WHERE t.id = task_id AND (pr.owner_id = auth.uid() OR public.has_project_access(auth.uid(), pr.id))
  )
);

-- Change requests policies
CREATE POLICY "Users can view change requests" ON public.change_requests FOR SELECT USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);
CREATE POLICY "Users can create change requests" ON public.change_requests FOR INSERT WITH CHECK (
  user_id = auth.uid() AND public.has_project_access(auth.uid(), project_id)
);
CREATE POLICY "PMs can update change requests" ON public.change_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
);

-- Attachment links policies
CREATE POLICY "Users can view attachment links" ON public.attachment_links FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.phases p ON t.phase_id = p.id
    JOIN public.projects pr ON p.project_id = pr.id
    WHERE t.id = task_id AND (pr.owner_id = auth.uid() OR public.has_project_access(auth.uid(), pr.id))
  )
);
CREATE POLICY "Users can create attachment links" ON public.attachment_links FOR INSERT WITH CHECK (
  created_by = auth.uid()
);

-- Step templates policies
CREATE POLICY "Users can view own templates" ON public.step_templates FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Users can manage own templates" ON public.step_templates FOR ALL USING (owner_id = auth.uid());

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name');
  
  -- Default to PM role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'pm');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_phases_updated_at BEFORE UPDATE ON public.phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();