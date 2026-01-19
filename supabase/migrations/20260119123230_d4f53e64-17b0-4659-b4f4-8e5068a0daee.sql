-- Add column to track when signature was last requested
ALTER TABLE public.rights_agreements 
ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE;