-- Create task_segments table for multi-period tasks
CREATE TABLE public.task_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_segments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view segments of accessible tasks
CREATE POLICY "Users can view segments of accessible tasks"
  ON public.task_segments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tasks t
    JOIN phases p ON t.phase_id = p.id
    JOIN projects pr ON p.project_id = pr.id
    WHERE t.id = task_segments.task_id
    AND (pr.owner_id = auth.uid() OR has_project_access(auth.uid(), pr.id) OR has_public_share(pr.id))
  ));

-- Policy: Anon can view segments of public shared projects
CREATE POLICY "Anon can view segments of public shared projects"
  ON public.task_segments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM tasks t
    JOIN phases p ON t.phase_id = p.id
    JOIN projects pr ON p.project_id = pr.id
    WHERE t.id = task_segments.task_id
    AND has_public_share(pr.id)
  ));

-- Policy: PMs can manage segments
CREATE POLICY "PMs can manage segments"
  ON public.task_segments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM tasks t
    JOIN phases p ON t.phase_id = p.id
    JOIN projects pr ON p.project_id = pr.id
    WHERE t.id = task_segments.task_id AND pr.owner_id = auth.uid()
  ));