-- Add cache_key column to ffiec_report_jobs.
-- For market_intel jobs the key is: "<subject_rssd>:<peer_rssd_1>,<peer_rssd_2>,..."
-- (peer RSSDs sorted ascending, comma-separated). NULL for non-market-intel job types.
ALTER TABLE public.ffiec_report_jobs
  ADD COLUMN IF NOT EXISTS cache_key TEXT;

-- Index for the cache lookup pattern:
--   WHERE report_type = 'market_intel'
--     AND cache_key   = $1
--     AND status      = 'completed'
--     AND completed_at > NOW() - INTERVAL '24 hours'
CREATE INDEX IF NOT EXISTS idx_ffiec_report_jobs_cache_key
  ON public.ffiec_report_jobs (cache_key, report_type, status, completed_at)
  WHERE cache_key IS NOT NULL;
