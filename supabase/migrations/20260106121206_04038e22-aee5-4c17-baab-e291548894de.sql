-- Add password_hash column to project_shares table
ALTER TABLE public.project_shares 
ADD COLUMN password_hash TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.project_shares.password_hash IS 'Optional bcrypt hash of password for protected shares';