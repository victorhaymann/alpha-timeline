
-- Create staff_categories table
CREATE TABLE public.staff_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.staff_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as staff_members)
CREATE POLICY "PMs can view own categories or admin all"
  ON public.staff_categories FOR SELECT
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "PMs can create categories"
  ON public.staff_categories FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "PMs can update own categories or admin all"
  ON public.staff_categories FOR UPDATE
  USING (created_by = auth.uid() OR is_admin());

CREATE POLICY "PMs can delete own categories or admin all"
  ON public.staff_categories FOR DELETE
  USING (created_by = auth.uid() OR is_admin());

-- Add category_id to staff_members
ALTER TABLE public.staff_members
  ADD COLUMN category_id uuid REFERENCES public.staff_categories(id) ON DELETE SET NULL;

-- Seed categories (using a placeholder created_by that will be updated by the first PM who logs in)
-- We use a function to seed with the first admin user
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT user_id INTO admin_id FROM public.user_roles WHERE role = 'pm' LIMIT 1;
  END IF;
  IF admin_id IS NOT NULL THEN
    INSERT INTO public.staff_categories (name, created_by) VALUES
      ('3D Artist', admin_id),
      ('3D Asset', admin_id),
      ('3D Scan', admin_id),
      ('AI Artists', admin_id),
      ('Animator', admin_id),
      ('Artistic Direction', admin_id),
      ('Bank Assets', admin_id),
      ('Color Grader', admin_id),
      ('Compositing', admin_id),
      ('Executive Production', admin_id),
      ('Modeling & Texturing', admin_id),
      ('Models', admin_id),
      ('Motion Designer', admin_id),
      ('Other', admin_id),
      ('Photograph', admin_id),
      ('Rendering', admin_id),
      ('Simulation Work', admin_id),
      ('Sound Designer', admin_id),
      ('UI Designer Unreal', admin_id),
      ('Unreal Developer', admin_id),
      ('VFX', admin_id),
      ('Video Editor', admin_id),
      ('Web Developer', admin_id)
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;
