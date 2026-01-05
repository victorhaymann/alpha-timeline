-- Allow PMs to delete canonical steps
CREATE POLICY "PMs can delete canonical steps" 
ON public.canonical_steps 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'pm'
  )
);

-- Allow PMs to insert canonical steps
CREATE POLICY "PMs can insert canonical steps" 
ON public.canonical_steps 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'pm'
  )
);

-- Allow PMs to update canonical steps
CREATE POLICY "PMs can update canonical steps" 
ON public.canonical_steps 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'pm'
  )
);