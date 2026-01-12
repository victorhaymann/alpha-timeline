-- Create project_resource_links table for PM-managed links
CREATE TABLE public.project_resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  software_name text NOT NULL,
  file_name text NOT NULL,
  url text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_resource_links ENABLE ROW LEVEL SECURITY;

-- PM can manage links (full CRUD)
CREATE POLICY "PMs can manage resource links"
ON public.project_resource_links FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_resource_links.project_id
      AND p.owner_id = auth.uid()
  )
);

-- Project members can view links
CREATE POLICY "Project members can view resource links"
ON public.project_resource_links FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_resource_links.project_id
      AND (p.owner_id = auth.uid() OR has_project_access(auth.uid(), p.id))
  )
);

-- Public share can view links (read-only)
CREATE POLICY "Public can view resource links via share"
ON public.project_resource_links FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_resource_links.project_id
      AND has_public_share(p.id)
  )
);