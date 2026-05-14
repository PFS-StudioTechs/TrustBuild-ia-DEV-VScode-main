-- Crée le bucket pour les fichiers de la base de connaissances
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-documents',
  'knowledge-documents',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Politique : un artisan peut uploader dans son propre dossier (user_id/...)
DROP POLICY IF EXISTS "artisan_upload_knowledge" ON storage.objects;
CREATE POLICY "artisan_upload_knowledge"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Politique : un artisan peut lire ses propres fichiers
DROP POLICY IF EXISTS "artisan_read_knowledge" ON storage.objects;
CREATE POLICY "artisan_read_knowledge"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'knowledge-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Politique : un artisan peut supprimer ses propres fichiers
DROP POLICY IF EXISTS "artisan_delete_knowledge" ON storage.objects;
CREATE POLICY "artisan_delete_knowledge"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'knowledge-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
