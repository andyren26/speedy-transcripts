-- AI summary of a transcript, generated on demand from the upload page and
-- cached so each job is summarized (and billed by OpenAI) at most once.
ALTER TABLE public.job_sessions
  ADD COLUMN IF NOT EXISTS summary_content text,
  ADD COLUMN IF NOT EXISTS summary_created_at timestamptz;
