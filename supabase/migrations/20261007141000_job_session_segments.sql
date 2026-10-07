-- Per-sentence timestamps from Whisper (response_format=verbose_json), offset to
-- the full video's timeline: [{"start": 3.2, "end": 7.9, "text": "..."}, ...].
-- Powers the timestamped .txt and the .srt subtitle download. Plain
-- subtitle_txt_content stays as-is (the AI summary reads it). NULL for jobs
-- transcribed before this column existed — those download as plain text.
ALTER TABLE public.job_sessions ADD COLUMN IF NOT EXISTS segments jsonb;
