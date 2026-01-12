-- Make project-documents bucket public so logo URLs are accessible
UPDATE storage.buckets 
SET public = true 
WHERE id = 'project-documents';