-- Job progress (0–100) reported by the EC2 worker, shown on the upload page.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS progress smallint NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.jobs ADD CONSTRAINT jobs_progress_range CHECK (progress BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Jobs that already finished are 100%.
UPDATE public.jobs SET progress = 100 WHERE status = 'done' AND progress <> 100;
