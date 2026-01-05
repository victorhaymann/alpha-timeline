-- Create meeting_notes table to persist meeting agenda notes
CREATE TABLE public.meeting_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  meeting_date DATE NOT NULL,
  general_notes TEXT DEFAULT '',
  task_notes JSONB DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, meeting_date)
);

-- Enable RLS
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "PMs can manage meeting notes for their projects"
ON public.meeting_notes
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = meeting_notes.project_id
  AND projects.owner_id = auth.uid()
));

CREATE POLICY "Users with project access can view meeting notes"
ON public.meeting_notes
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = meeting_notes.project_id
  AND (projects.owner_id = auth.uid() OR has_project_access(auth.uid(), projects.id))
));

-- Add trigger for updated_at
CREATE TRIGGER update_meeting_notes_updated_at
BEFORE UPDATE ON public.meeting_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();