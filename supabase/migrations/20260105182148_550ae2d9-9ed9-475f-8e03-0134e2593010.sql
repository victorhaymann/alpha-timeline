-- Create project_shares table for public and invite-based sharing
CREATE TABLE public.project_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  share_type TEXT NOT NULL CHECK (share_type IN ('public', 'invite')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- PMs can manage shares for their projects
CREATE POLICY "PMs can manage project shares"
ON public.project_shares
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = project_shares.project_id
  AND projects.owner_id = auth.uid()
));

-- Anyone can view active shares (needed for public access)
CREATE POLICY "Anyone can view active shares"
ON public.project_shares
FOR SELECT
USING (is_active = true);

-- Create share_invites table to track email invites for a share
CREATE TABLE public.share_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES public.project_shares(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(share_id, email)
);

-- Enable RLS
ALTER TABLE public.share_invites ENABLE ROW LEVEL SECURITY;

-- PMs can manage share invites
CREATE POLICY "PMs can manage share invites"
ON public.share_invites
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.project_shares ps
  JOIN public.projects p ON ps.project_id = p.id
  WHERE ps.id = share_invites.share_id
  AND p.owner_id = auth.uid()
));

-- Users can view invites for their email
CREATE POLICY "Users can view their invites"
ON public.share_invites
FOR SELECT
USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));