-- Add check-in meeting settings to projects table
ALTER TABLE public.projects
ADD COLUMN checkin_time text DEFAULT '10:00',
ADD COLUMN checkin_duration integer DEFAULT 30,
ADD COLUMN checkin_timezone text DEFAULT 'UTC',
ADD COLUMN checkin_frequency text DEFAULT 'weekly',
ADD COLUMN checkin_weekday text DEFAULT 'wednesday';