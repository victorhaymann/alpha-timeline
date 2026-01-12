-- Storage policies: PM can upload
CREATE POLICY "PM can upload client documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-documents' AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
      AND p.owner_id = auth.uid()
  )
);

-- Storage policies: PM can update
CREATE POLICY "PM can update client documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-documents' AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
      AND p.owner_id = auth.uid()
  )
);

-- Storage policies: PM can delete
CREATE POLICY "PM can delete client documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-documents' AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
      AND p.owner_id = auth.uid()
  )
);

-- Storage policies: Authenticated users can view if they have project access
CREATE POLICY "Project members can view client documents storage"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-documents' AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
      AND (p.owner_id = auth.uid() OR has_project_access(auth.uid(), p.id))
  )
);

-- Storage policies: Anonymous can view via public share
CREATE POLICY "Public can view client documents storage via share"
ON storage.objects FOR SELECT TO anon
USING (
  bucket_id = 'client-documents' AND
  EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id::text = (storage.foldername(storage.objects.name))[1]
      AND has_public_share(p.id)
  )
);

-- Clients can upload to storage
CREATE POLICY "Clients can upload client documents storage"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-documents' AND
  EXISTS (
    SELECT 1 FROM client_users cu
    JOIN clients c ON cu.client_id = c.id
    JOIN projects p ON p.client_id = c.id
    WHERE cu.user_id = auth.uid()
      AND p.id::text = (storage.foldername(storage.objects.name))[1]
  )
);