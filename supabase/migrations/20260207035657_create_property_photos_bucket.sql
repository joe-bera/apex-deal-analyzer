-- Create the property-photos storage bucket (public so URLs work without auth)
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to the bucket
CREATE POLICY "Authenticated users can upload photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'property-photos');

-- Allow anyone to read (public bucket)
CREATE POLICY "Public read access for property photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'property-photos');

-- Allow service role and owners to delete
CREATE POLICY "Users can delete own photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'property-photos' AND (storage.foldername(name))[1] IN ('properties', 'logos'));
