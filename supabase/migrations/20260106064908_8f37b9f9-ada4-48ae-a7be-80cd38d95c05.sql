-- Add project manager fields to projects table
ALTER TABLE public.projects 
ADD COLUMN pm_name TEXT,
ADD COLUMN pm_email TEXT,
ADD COLUMN pm_whatsapp TEXT;