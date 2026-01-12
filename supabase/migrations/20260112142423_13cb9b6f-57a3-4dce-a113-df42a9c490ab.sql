-- Add timer fields to current_auction table
ALTER TABLE public.current_auction 
ADD COLUMN timer_duration INTEGER NOT NULL DEFAULT 30,
ADD COLUMN timer_started_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;