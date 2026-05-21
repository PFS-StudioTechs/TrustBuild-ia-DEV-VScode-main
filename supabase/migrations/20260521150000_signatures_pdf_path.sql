ALTER TABLE devis_signatures
  ADD COLUMN IF NOT EXISTS pdf_signed_path TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documents-signes', 'documents-signes', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "artisan_select_signed_pdf" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents-signes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
