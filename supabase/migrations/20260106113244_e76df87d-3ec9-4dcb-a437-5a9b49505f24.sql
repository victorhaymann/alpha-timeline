-- Create a function to check if a project has an active public share
CREATE OR REPLACE FUNCTION public.has_public_share(_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_shares
    WHERE project_id = _project_id 
      AND share_type = 'public' 
      AND is_active = true
  )
$$;

-- Update projects policy to allow public share access
DROP POLICY IF EXISTS "PMs can view own projects" ON public.projects;
CREATE POLICY "Users can view accessible projects" ON public.projects
FOR SELECT USING (
  (owner_id = auth.uid()) 
  OR has_project_access(auth.uid(), id)
  OR has_public_share(id)
);

-- Update phases policy to allow public share access
DROP POLICY IF EXISTS "Users can view phases of accessible projects" ON public.phases;
CREATE POLICY "Users can view phases of accessible projects" ON public.phases
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = phases.project_id 
    AND (
      projects.owner_id = auth.uid() 
      OR has_project_access(auth.uid(), projects.id)
      OR has_public_share(projects.id)
    )
  )
);

-- Update tasks policy to allow public share access
DROP POLICY IF EXISTS "Users can view tasks of accessible projects" ON public.tasks;
CREATE POLICY "Users can view tasks of accessible projects" ON public.tasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM phases p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = tasks.phase_id 
    AND (
      pr.owner_id = auth.uid() 
      OR has_project_access(auth.uid(), pr.id)
      OR has_public_share(pr.id)
    )
  )
);

-- Update dependencies policy to allow public share access
DROP POLICY IF EXISTS "Users can view dependencies" ON public.dependencies;
CREATE POLICY "Users can view dependencies" ON public.dependencies
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN phases p ON t.phase_id = p.id
    JOIN projects pr ON p.project_id = pr.id
    WHERE (t.id = dependencies.predecessor_task_id OR t.id = dependencies.successor_task_id)
    AND (
      pr.owner_id = auth.uid() 
      OR has_project_access(auth.uid(), pr.id)
      OR has_public_share(pr.id)
    )
  )
);

-- Update quotations policy to allow public share access
DROP POLICY IF EXISTS "Users can view quotations for accessible projects" ON public.quotations;
CREATE POLICY "Users can view quotations for accessible projects" ON public.quotations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = quotations.project_id 
    AND (
      projects.owner_id = auth.uid() 
      OR has_project_access(auth.uid(), projects.id)
      OR has_public_share(projects.id)
    )
  )
);

-- Update invoices policy to allow public share access
DROP POLICY IF EXISTS "Users can view invoices for accessible projects" ON public.invoices;
CREATE POLICY "Users can view invoices for accessible projects" ON public.invoices
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invoices.project_id 
    AND (
      projects.owner_id = auth.uid() 
      OR has_project_access(auth.uid(), projects.id)
      OR has_public_share(projects.id)
    )
  )
);