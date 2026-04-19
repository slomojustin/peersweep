-- Create ubpr_metrics table for UBPR parser output
CREATE TABLE public.ubpr_metrics (
  id            bigserial PRIMARY KEY,
  rssd          text        NOT NULL,
  report_date   date        NOT NULL,
  metric_code   text        NOT NULL,
  metric_name   text        NOT NULL,
  value         numeric,
  period_type   text        CHECK (period_type IN ('instant', 'duration')),
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ubpr_metrics_rssd_date_code_key UNIQUE (rssd, report_date, metric_code)
);

-- Indexes
CREATE INDEX ubpr_metrics_rssd_idx        ON public.ubpr_metrics (rssd);
CREATE INDEX ubpr_metrics_report_date_idx ON public.ubpr_metrics (report_date);
CREATE INDEX ubpr_metrics_rssd_date_idx   ON public.ubpr_metrics (rssd, report_date);
CREATE INDEX ubpr_metrics_metric_code_idx ON public.ubpr_metrics (metric_code);

-- RLS
ALTER TABLE public.ubpr_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read access"
  ON public.ubpr_metrics
  FOR SELECT
  TO anon, authenticated
  USING (true);
