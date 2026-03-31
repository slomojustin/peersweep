CREATE TABLE public.ffiec_report_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rssd TEXT NOT NULL,
  bank_name TEXT,
  report_type TEXT NOT NULL DEFAULT 'ubpr',
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT,
  result_pdf_url TEXT,
  result_metrics JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT ffiec_report_jobs_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT ffiec_report_jobs_report_type_check CHECK (report_type IN ('ubpr_metrics', 'ubpr_pdf'))
);

ALTER TABLE public.ffiec_report_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create FFIEC jobs"
ON public.ffiec_report_jobs
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can read FFIEC jobs"
ON public.ffiec_report_jobs
FOR SELECT
USING (true);

CREATE POLICY "Service role can update FFIEC jobs"
ON public.ffiec_report_jobs
FOR UPDATE
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE INDEX idx_ffiec_report_jobs_status_created_at
ON public.ffiec_report_jobs (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_ffiec_report_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_ffiec_report_jobs_updated_at
BEFORE UPDATE ON public.ffiec_report_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_ffiec_report_jobs_updated_at();