-- Create learning_resources table for PM-managed global resources
CREATE TABLE public.learning_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT,
  icon_type TEXT DEFAULT 'book',
  sort_order INTEGER DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.learning_resources ENABLE ROW LEVEL SECURITY;

-- Anyone can view learning resources
CREATE POLICY "Anyone can view learning resources"
  ON public.learning_resources FOR SELECT
  USING (true);

-- Only PMs can manage learning resources
CREATE POLICY "PMs can insert learning resources"
  ON public.learning_resources FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'pm'
  ));

CREATE POLICY "PMs can update learning resources"
  ON public.learning_resources FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'pm'
  ));

CREATE POLICY "PMs can delete learning resources"
  ON public.learning_resources FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'pm'
  ));

-- Trigger for updated_at
CREATE TRIGGER update_learning_resources_updated_at
  BEFORE UPDATE ON public.learning_resources
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();