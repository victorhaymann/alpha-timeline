-- Add SignWell document ID to rights_agreements
ALTER TABLE public.rights_agreements 
ADD COLUMN signwell_document_id TEXT;