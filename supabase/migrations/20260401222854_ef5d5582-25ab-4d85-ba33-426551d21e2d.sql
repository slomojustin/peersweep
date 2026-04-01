
-- Drop the existing overly permissive INSERT policy on storage.objects for ubpr-reports
DROP POLICY IF EXISTS "Service role can upload UBPR reports" ON storage.objects;

-- Recreate it restricted to service_role only
CREATE POLICY "Service role can upload UBPR reports"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'ubpr-reports');
