-- Auto matching is on by default; members can still switch it off in filters
ALTER TABLE public.user_preferences ALTER COLUMN auto_next SET DEFAULT true;
UPDATE public.user_preferences SET auto_next = true WHERE auto_next = false;