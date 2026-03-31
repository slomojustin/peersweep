CREATE POLICY "No direct client access to FFIEC jobs"
ON public.ffiec_report_jobs
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);