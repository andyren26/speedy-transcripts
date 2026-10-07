-- Stuck-job handling: a job that can't finish ends as 'failed' with a reason
-- the user can read, instead of sitting at its last progress forever.
-- Set by worker.py (errors it can catch) or by the Lambda distributor's sweep
-- (the Fargate task died without reporting). Failed jobs are never charged.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('pending', 'downloading', 'transcribe', 'done', 'insufficient_credits', 'failed'));
