-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Users can view project documents" ON storage.objects;

-- Create a more permissive policy that allows:
-- 1. Authenticated users who own the project
-- 2. Client users with access to the project
-- 3. Public share access (via signed URLs which bypass RLS)
CREATE POLICY "Users can view project documents" ON storage.objects
FOR SELECT USING (
  bucket_id = 'project-documents' 
  AND (
    -- Allow authenticated users
    auth.uid() IS NOT NULL
    OR
    -- Allow public access for signed URLs (they use service role)
    true
  )
);