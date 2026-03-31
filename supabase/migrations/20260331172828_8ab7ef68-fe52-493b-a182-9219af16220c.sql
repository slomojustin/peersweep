INSERT INTO storage.buckets (id, name, public) VALUES ('ubpr-reports', 'ubpr-reports', true);

CREATE POLICY "UBPR reports are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'ubpr-reports');

CREATE POLICY "Service role can upload UBPR reports"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ubpr-reports');