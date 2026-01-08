-- Add client_hidden column to meeting_notes table
ALTER TABLE meeting_notes 
ADD COLUMN client_hidden boolean DEFAULT false;