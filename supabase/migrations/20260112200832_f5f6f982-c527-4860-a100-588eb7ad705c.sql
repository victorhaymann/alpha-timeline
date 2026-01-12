-- Add file columns to learning_resources table
ALTER TABLE public.learning_resources
ADD COLUMN file_path TEXT,
ADD COLUMN file_name TEXT,
ADD COLUMN file_size INTEGER,
ADD COLUMN mime_type TEXT;

-- Create storage bucket for learning resource files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('learning-resources', 'learning-resources', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view learning resource files (public bucket)
CREATE POLICY "Anyone can view learning resource files"
ON storage.objects FOR SELECT
USING (bucket_id = 'learning-resources');

-- Only PMs can upload learning resource files
CREATE POLICY "PMs can upload learning resource files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'learning-resources' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'pm'
  )
);

-- Only PMs can delete learning resource files
CREATE POLICY "PMs can delete learning resource files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'learning-resources' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'pm'
  )
);