ALTER TABLE public.ffiec_report_jobs
ADD COLUMN tinyfish_run_id TEXT,
ADD COLUMN tinyfish_streaming_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ffiec_report_jobs_tinyfish_run_id
ON public.ffiec_report_jobs (tinyfish_run_id)
WHERE tinyfish_run_id IS NOT NULL;