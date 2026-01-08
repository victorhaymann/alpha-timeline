-- Create function to sync task dates from its segments
CREATE OR REPLACE FUNCTION public.sync_task_dates_from_segments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_task_id uuid;
  min_start date;
  max_end date;
BEGIN
  -- Determine which task to sync based on operation
  IF TG_OP = 'DELETE' THEN
    target_task_id := OLD.task_id;
  ELSE
    target_task_id := NEW.task_id;
  END IF;

  -- Calculate min/max dates from all segments for this task
  SELECT MIN(start_date), MAX(end_date)
  INTO min_start, max_end
  FROM task_segments
  WHERE task_id = target_task_id;

  -- Update the parent task if segments exist
  IF min_start IS NOT NULL AND max_end IS NOT NULL THEN
    UPDATE tasks
    SET start_date = min_start, end_date = max_end
    WHERE id = target_task_id
      AND (start_date IS DISTINCT FROM min_start OR end_date IS DISTINCT FROM max_end);
  END IF;

  -- Return appropriate value based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Create trigger to sync task dates after segment changes
DROP TRIGGER IF EXISTS sync_task_dates_on_segment_change ON task_segments;
CREATE TRIGGER sync_task_dates_on_segment_change
  AFTER INSERT OR UPDATE OR DELETE ON task_segments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_task_dates_from_segments();