-- Add RLS policies for anonymous users to access public shared projects

-- Allow anonymous users to view projects with active public shares
CREATE POLICY "Anon can view public shared projects" ON projects
  FOR SELECT TO anon
  USING (has_public_share(id));

-- Allow anonymous users to view phases of public shared projects
CREATE POLICY "Anon can view phases of public shared projects" ON phases
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = phases.project_id 
    AND has_public_share(projects.id)
  ));

-- Allow anonymous users to view tasks of public shared projects
CREATE POLICY "Anon can view tasks of public shared projects" ON tasks
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM phases p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = tasks.phase_id 
    AND has_public_share(pr.id)
  ));

-- Allow anonymous users to view dependencies of public shared projects
CREATE POLICY "Anon can view dependencies of public shared projects" ON dependencies
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM tasks t
    JOIN phases p ON t.phase_id = p.id
    JOIN projects pr ON p.project_id = pr.id
    WHERE (t.id = dependencies.predecessor_task_id OR t.id = dependencies.successor_task_id)
    AND has_public_share(pr.id)
  ));

-- Allow anonymous users to view quotations of public shared projects
CREATE POLICY "Anon can view quotations of public shared projects" ON quotations
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = quotations.project_id 
    AND has_public_share(projects.id)
  ));

-- Allow anonymous users to view invoices of public shared projects
CREATE POLICY "Anon can view invoices of public shared projects" ON invoices
  FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = invoices.project_id 
    AND has_public_share(projects.id)
  ));