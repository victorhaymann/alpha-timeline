-- Add deliverables field to rights_agreements
ALTER TABLE public.rights_agreements
ADD COLUMN deliverables TEXT DEFAULT 'As per Quotation';