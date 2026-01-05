-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Create client_users table to link users to clients
CREATE TABLE public.client_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id, user_id)
);

-- Enable RLS on client_users
ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Add client_id to projects table
ALTER TABLE public.projects ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_client_users_user_id ON public.client_users(user_id);
CREATE INDEX idx_client_users_client_id ON public.client_users(client_id);

-- Function to check if user has access to a client (is PM creator or a client user)
CREATE OR REPLACE FUNCTION public.has_client_access(_user_id UUID, _client_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients WHERE id = _client_id AND created_by = _user_id
    UNION
    SELECT 1 FROM public.client_users WHERE client_id = _client_id AND user_id = _user_id
  )
$$;

-- RLS Policies for clients table
CREATE POLICY "PMs can view clients they created"
ON public.clients FOR SELECT
USING (created_by = auth.uid() OR has_client_access(auth.uid(), id));

CREATE POLICY "PMs can create clients"
ON public.clients FOR INSERT
WITH CHECK (created_by = auth.uid() AND has_role(auth.uid(), 'pm'));

CREATE POLICY "PMs can update their clients"
ON public.clients FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "PMs can delete their clients"
ON public.clients FOR DELETE
USING (created_by = auth.uid());

-- RLS Policies for client_users table
CREATE POLICY "PMs can view client users for their clients"
ON public.client_users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_users.client_id 
    AND clients.created_by = auth.uid()
  )
  OR user_id = auth.uid()
);

CREATE POLICY "PMs can add users to their clients"
ON public.client_users FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_users.client_id 
    AND clients.created_by = auth.uid()
  )
);

CREATE POLICY "PMs can remove users from their clients"
ON public.client_users FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.clients 
    WHERE clients.id = client_users.client_id 
    AND clients.created_by = auth.uid()
  )
);

-- Update trigger for clients
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();