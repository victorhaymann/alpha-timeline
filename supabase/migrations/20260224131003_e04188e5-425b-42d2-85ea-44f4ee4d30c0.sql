
-- Staff members table (resources, not users)
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  role_title text,
  skills text[] NOT NULL DEFAULT '{}',
  softwares text[] NOT NULL DEFAULT '{}',
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- PMs can manage their own staff, admins can manage all
CREATE POLICY "PMs can view own staff or admin all"
  ON public.staff_members FOR SELECT
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "PMs can create staff"
  ON public.staff_members FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "PMs can update own staff or admin all"
  ON public.staff_members FOR UPDATE
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "PMs can delete own staff or admin all"
  ON public.staff_members FOR DELETE
  USING (created_by = auth.uid() OR is_admin());

-- Auto-update updated_at
CREATE TRIGGER update_staff_members_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Phase staff assignments table
CREATE TABLE public.phase_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (phase_id, staff_id)
);

ALTER TABLE public.phase_staff_assignments ENABLE ROW LEVEL SECURITY;

-- Access follows project access pattern
CREATE POLICY "Users can view phase staff for accessible projects"
  ON public.phase_staff_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM phases p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = phase_staff_assignments.phase_id
    AND (pr.owner_id = auth.uid() OR has_project_access(auth.uid(), pr.id) OR is_admin())
  ));

CREATE POLICY "PMs and admins can manage phase staff"
  ON public.phase_staff_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM phases p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = phase_staff_assignments.phase_id
    AND (pr.owner_id = auth.uid() OR is_admin())
  ));
