-- Delete stale UBPR scrape job rows
DELETE FROM public.ffiec_report_jobs WHERE report_type IN ('ubpr_metrics', 'ubpr_pdf', 'ubpr_bulk');

-- Update report_type constraint to only allow market_intel
ALTER TABLE public.ffiec_report_jobs
  DROP CONSTRAINT ffiec_report_jobs_report_type_check;

ALTER TABLE public.ffiec_report_jobs
  ADD CONSTRAINT ffiec_report_jobs_report_type_check
  CHECK (report_type = ANY (ARRAY['market_intel'::text]));

-- Drop legacy UBPR tables
DROP TABLE IF EXISTS public.ubpr_cache CASCADE;
DROP TABLE IF EXISTS public.ubpr_data CASCADE;
