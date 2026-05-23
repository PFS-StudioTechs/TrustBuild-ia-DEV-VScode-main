ALTER TABLE public.devis
  ADD COLUMN IF NOT EXISTS original_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS original_pdf_generated_at TIMESTAMPTZ;

ALTER TABLE public.avenants
  ADD COLUMN IF NOT EXISTS original_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS original_pdf_generated_at TIMESTAMPTZ;

ALTER TABLE public.travaux_supplementaires
  ADD COLUMN IF NOT EXISTS original_pdf_path TEXT,
  ADD COLUMN IF NOT EXISTS original_pdf_generated_at TIMESTAMPTZ;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents-originaux',
  'documents-originaux',
  false,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "artisan_insert_original_pdf" ON storage.objects;
CREATE POLICY "artisan_insert_original_pdf"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents-originaux'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "artisan_select_original_pdf" ON storage.objects;
CREATE POLICY "artisan_select_original_pdf"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents-originaux'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "artisan_update_original_pdf" ON storage.objects;
CREATE POLICY "artisan_update_original_pdf"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents-originaux'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "artisan_delete_original_pdf" ON storage.objects;
CREATE POLICY "artisan_delete_original_pdf"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents-originaux'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
