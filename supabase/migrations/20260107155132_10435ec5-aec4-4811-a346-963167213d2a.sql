-- Add segment_type column to task_segments table
-- Allows segments to be either 'work' (default) or 'review' (client review period)
ALTER TABLE task_segments 
ADD COLUMN segment_type TEXT DEFAULT 'work' CHECK (segment_type IN ('work', 'review'));