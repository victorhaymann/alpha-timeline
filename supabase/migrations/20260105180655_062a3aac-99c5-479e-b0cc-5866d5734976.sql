-- Create storage bucket for project documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false);

-- Storage policies for project documents
CREATE POLICY "Users can upload project documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view project documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-documents' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete own project documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-documents' AND
  auth.uid() IS NOT NULL
);

-- Create quotations table
CREATE TABLE public.quotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on quotations
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;

-- Quotations policies
CREATE POLICY "Users can view quotations for accessible projects"
ON public.quotations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = quotations.project_id
    AND (projects.owner_id = auth.uid() OR has_project_access(auth.uid(), projects.id))
  )
);

CREATE POLICY "PMs can create quotations"
ON public.quotations FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = quotations.project_id
    AND projects.owner_id = auth.uid()
  )
);

CREATE POLICY "PMs can delete quotations"
ON public.quotations FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = quotations.project_id
    AND projects.owner_id = auth.uid()
  )
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Invoices policies
CREATE POLICY "Users can view invoices for accessible projects"
ON public.invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invoices.project_id
    AND (projects.owner_id = auth.uid() OR has_project_access(auth.uid(), projects.id))
  )
);

CREATE POLICY "PMs can create invoices"
ON public.invoices FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invoices.project_id
    AND projects.owner_id = auth.uid()
  )
);

CREATE POLICY "PMs can delete invoices"
ON public.invoices FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM projects
    WHERE projects.id = invoices.project_id
    AND projects.owner_id = auth.uid()
  )
);