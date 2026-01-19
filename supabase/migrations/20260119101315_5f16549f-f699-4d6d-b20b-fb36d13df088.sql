-- Create rights_agreements table
CREATE TABLE public.rights_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_contact_name TEXT,
  agreement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_from DATE NOT NULL,
  valid_until DATE, -- NULL = perpetual
  status TEXT NOT NULL DEFAULT 'draft', -- draft, sent, viewed, signed, declined
  docusign_envelope_id TEXT,
  generated_document_path TEXT,
  signed_document_path TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rights_usage_selections table
CREATE TABLE public.rights_usage_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES public.rights_agreements(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- digital, paid_media, pos_retail, print, ooh, tv
  is_paid BOOLEAN NOT NULL DEFAULT false,
  geographies TEXT[] NOT NULL DEFAULT '{}',
  period_start DATE NOT NULL,
  period_end DATE, -- NULL = perpetual
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rights_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rights_usage_selections ENABLE ROW LEVEL SECURITY;

-- RLS policies for rights_agreements
CREATE POLICY "PMs can manage rights agreements"
ON public.rights_agreements
FOR ALL
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = rights_agreements.project_id
  AND projects.owner_id = auth.uid()
));

CREATE POLICY "Project members can view rights agreements"
ON public.rights_agreements
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = rights_agreements.project_id
  AND (projects.owner_id = auth.uid() OR has_project_access(auth.uid(), projects.id))
));

CREATE POLICY "Public can view rights agreements via share"
ON public.rights_agreements
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects
  WHERE projects.id = rights_agreements.project_id
  AND has_public_share(projects.id)
));

-- RLS policies for rights_usage_selections
CREATE POLICY "PMs can manage usage selections"
ON public.rights_usage_selections
FOR ALL
USING (EXISTS (
  SELECT 1 FROM rights_agreements ra
  JOIN projects p ON p.id = ra.project_id
  WHERE ra.id = rights_usage_selections.agreement_id
  AND p.owner_id = auth.uid()
));

CREATE POLICY "Project members can view usage selections"
ON public.rights_usage_selections
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM rights_agreements ra
  JOIN projects p ON p.id = ra.project_id
  WHERE ra.id = rights_usage_selections.agreement_id
  AND (p.owner_id = auth.uid() OR has_project_access(auth.uid(), p.id))
));

CREATE POLICY "Public can view usage selections via share"
ON public.rights_usage_selections
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM rights_agreements ra
  JOIN projects p ON p.id = ra.project_id
  WHERE ra.id = rights_usage_selections.agreement_id
  AND has_public_share(p.id)
));

-- Create updated_at trigger for rights_agreements
CREATE TRIGGER update_rights_agreements_updated_at
BEFORE UPDATE ON public.rights_agreements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create private storage bucket for rights agreements
INSERT INTO storage.buckets (id, name, public)
VALUES ('rights-agreements', 'rights-agreements', false);

-- Storage policies for rights-agreements bucket
CREATE POLICY "PMs can upload rights documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'rights-agreements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "PMs can view their rights documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'rights-agreements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "PMs can update their rights documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'rights-agreements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "PMs can delete their rights documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'rights-agreements'
  AND auth.uid()::text = (storage.foldername(name))[1]
);