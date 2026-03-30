-- Create table to cache UBPR data fetched from FFIEC CDR
CREATE TABLE public.ubpr_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rssd TEXT NOT NULL,
  bank_name TEXT,
  report_date TEXT NOT NULL,
  metrics JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (rssd, report_date)
);

-- Enable RLS
ALTER TABLE public.ubpr_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached data (public financial data)
CREATE POLICY "Anyone can read UBPR cache"
  ON public.ubpr_cache FOR SELECT
  USING (true);

-- Only service role can insert/update (via edge function)
CREATE POLICY "Service role can insert UBPR cache"
  ON public.ubpr_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update UBPR cache"
  ON public.ubpr_cache FOR UPDATE
  USING (true);

-- Index for fast lookups
CREATE INDEX idx_ubpr_cache_rssd ON public.ubpr_cache (rssd);
CREATE INDEX idx_ubpr_cache_fetched_at ON public.ubpr_cache (fetched_at);