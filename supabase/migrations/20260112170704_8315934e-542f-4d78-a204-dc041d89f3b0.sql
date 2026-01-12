-- Create the client-documents storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-documents', 'client-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create client_documents table
CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category text NOT NULL,
  name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- PM can manage documents for their projects
CREATE POLICY "PMs can manage client documents"
ON public.client_documents FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = client_documents.project_id
      AND p.owner_id = auth.uid()
  )
);

-- Users with project access can view documents
CREATE POLICY "Project members can view client documents"
ON public.client_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = client_documents.project_id
      AND (p.owner_id = auth.uid() OR has_project_access(auth.uid(), p.id))
  )
);

-- Clients can upload documents (INSERT only)
CREATE POLICY "Clients can upload client documents"
ON public.client_documents FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN clients c ON cu.client_id = c.id
    JOIN projects p ON p.client_id = c.id
    WHERE cu.user_id = auth.uid()
      AND p.id = client_documents.project_id
  )
);

-- Public share access (read-only)
CREATE POLICY "Public can view client documents via share"
ON public.client_documents FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = client_documents.project_id
      AND has_public_share(p.id)
  )
);

-- Anonymous users can upload via share link
CREATE POLICY "Share link users can upload client documents"
ON public.client_documents FOR INSERT TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = client_documents.project_id
      AND has_public_share(p.id)
  )
);

-- Add missing storage policy for anonymous uploads via share link
CREATE POLICY "Anonymous can upload client documents via share"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'client-documents' AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND has_public_share(p.id)
  )
);

-- Add anonymous read access for client documents bucket via share
CREATE POLICY "Anonymous can view client documents via share"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'client-documents' AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND has_public_share(p.id)
  )
);