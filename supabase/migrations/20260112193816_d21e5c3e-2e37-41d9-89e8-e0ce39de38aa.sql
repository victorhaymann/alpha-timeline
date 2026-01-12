-- Add client_logo_url column to projects table
ALTER TABLE public.projects
ADD COLUMN client_logo_url TEXT NULL;