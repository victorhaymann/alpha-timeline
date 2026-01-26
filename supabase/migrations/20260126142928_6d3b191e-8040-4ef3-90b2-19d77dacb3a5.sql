-- Step 2: Create is_admin() security definer function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- Step 3: Update RLS policies for projects table
DROP POLICY IF EXISTS "PMs can update own projects" ON public.projects;
DROP POLICY IF EXISTS "PMs can delete own projects" ON public.projects;

CREATE POLICY "PMs and admins can update projects"
ON public.projects FOR UPDATE
USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "PMs and admins can delete projects"
ON public.projects FOR DELETE
USING (owner_id = auth.uid() OR public.is_admin());

-- Update phases policies
DROP POLICY IF EXISTS "PMs can manage phases" ON public.phases;

CREATE POLICY "PMs and admins can manage phases"
ON public.phases FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = phases.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update tasks policies
DROP POLICY IF EXISTS "PMs can manage tasks" ON public.tasks;

CREATE POLICY "PMs and admins can manage tasks"
ON public.tasks FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM phases p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = tasks.phase_id
    AND (pr.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update task_segments policies
DROP POLICY IF EXISTS "PMs can manage segments" ON public.task_segments;

CREATE POLICY "PMs and admins can manage segments"
ON public.task_segments FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN phases p ON t.phase_id = p.id
    JOIN projects pr ON p.project_id = pr.id
    WHERE t.id = task_segments.task_id
    AND (pr.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update dependencies policies
DROP POLICY IF EXISTS "PMs can manage dependencies" ON public.dependencies;

CREATE POLICY "PMs and admins can manage dependencies"
ON public.dependencies FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN phases p ON t.phase_id = p.id
    JOIN projects pr ON p.project_id = pr.id
    WHERE t.id = dependencies.predecessor_task_id
    AND (pr.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update meeting_notes policies
DROP POLICY IF EXISTS "PMs can manage meeting notes for their projects" ON public.meeting_notes;

CREATE POLICY "PMs and admins can manage meeting notes"
ON public.meeting_notes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = meeting_notes.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update invites policies
DROP POLICY IF EXISTS "PMs can create invites" ON public.invites;
DROP POLICY IF EXISTS "PMs can delete invites" ON public.invites;
DROP POLICY IF EXISTS "PMs can view project invites" ON public.invites;

CREATE POLICY "PMs and admins can create invites"
ON public.invites FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invites.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "PMs and admins can delete invites"
ON public.invites FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invites.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "PMs and admins can view invites"
ON public.invites FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invites.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update project_shares policies
DROP POLICY IF EXISTS "PMs can manage project shares" ON public.project_shares;

CREATE POLICY "PMs and admins can manage project shares"
ON public.project_shares FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_shares.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update rights_agreements policies
DROP POLICY IF EXISTS "PMs can manage rights agreements" ON public.rights_agreements;

CREATE POLICY "PMs and admins can manage rights agreements"
ON public.rights_agreements FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = rights_agreements.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update rights_usage_selections policies
DROP POLICY IF EXISTS "PMs can manage usage selections" ON public.rights_usage_selections;

CREATE POLICY "PMs and admins can manage usage selections"
ON public.rights_usage_selections FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM rights_agreements ra
    JOIN projects p ON p.id = ra.project_id
    WHERE ra.id = rights_usage_selections.agreement_id
    AND (p.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update client_documents policies
DROP POLICY IF EXISTS "PMs can manage client documents" ON public.client_documents;

CREATE POLICY "PMs and admins can manage client documents"
ON public.client_documents FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = client_documents.project_id
    AND (p.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update quotations policies
DROP POLICY IF EXISTS "PMs can create quotations" ON public.quotations;
DROP POLICY IF EXISTS "PMs can delete quotations" ON public.quotations;

CREATE POLICY "PMs and admins can create quotations"
ON public.quotations FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = quotations.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "PMs and admins can delete quotations"
ON public.quotations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = quotations.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update invoices policies
DROP POLICY IF EXISTS "PMs can create invoices" ON public.invoices;
DROP POLICY IF EXISTS "PMs can delete invoices" ON public.invoices;

CREATE POLICY "PMs and admins can create invoices"
ON public.invoices FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invoices.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "PMs and admins can delete invoices"
ON public.invoices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invoices.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update project_resource_links policies
DROP POLICY IF EXISTS "PMs can manage resource links" ON public.project_resource_links;

CREATE POLICY "PMs and admins can manage resource links"
ON public.project_resource_links FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_resource_links.project_id
    AND (p.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update project_steps policies
DROP POLICY IF EXISTS "PMs can manage project steps" ON public.project_steps;

CREATE POLICY "PMs and admins can manage project steps"
ON public.project_steps FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = project_steps.project_id
    AND (projects.owner_id = auth.uid() OR public.is_admin())
  )
);

-- Update clients policies
DROP POLICY IF EXISTS "PMs can update their clients" ON public.clients;
DROP POLICY IF EXISTS "PMs can delete their clients" ON public.clients;
DROP POLICY IF EXISTS "PMs can view clients they created" ON public.clients;

CREATE POLICY "PMs and admins can update clients"
ON public.clients FOR UPDATE
USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "PMs and admins can delete clients"
ON public.clients FOR DELETE
USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "PMs and admins can view clients"
ON public.clients FOR SELECT
USING (created_by = auth.uid() OR has_client_access(auth.uid(), id) OR public.is_admin());

-- Step 4: Grant admin role to Victor and Charles
INSERT INTO public.user_roles (user_id, role)
VALUES 
  ('806735de-369f-448c-8afb-5957506048fd', 'admin'),
  ('d3ca7493-9387-4d90-8a76-f4d268762e64', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 5: Create trigger function to auto-assign admin to Romain
CREATE OR REPLACE FUNCTION public.assign_admin_to_thenewface_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the new user's email is romain@thenewface.io
  IF NEW.email = 'romain@thenewface.io' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on profiles table (which is populated when users sign up)
DROP TRIGGER IF EXISTS assign_admin_on_signup ON public.profiles;
CREATE TRIGGER assign_admin_on_signup
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_admin_to_thenewface_team();