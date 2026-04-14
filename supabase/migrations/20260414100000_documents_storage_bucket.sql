-- ── Bucket "documents" — logos d'entreprise et fichiers devis/facture ──────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10 MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Upload : chaque artisan peut uploader dans son propre dossier
DROP POLICY IF EXISTS "artisan_upload_documents" ON storage.objects;
CREATE POLICY "artisan_upload_documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : publique (les logos doivent être accessibles dans les PDFs)
DROP POLICY IF EXISTS "public_read_documents" ON storage.objects;
CREATE POLICY "public_read_documents"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'documents');

-- Mise à jour : uniquement le propriétaire
DROP POLICY IF EXISTS "artisan_update_documents" ON storage.objects;
CREATE POLICY "artisan_update_documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Suppression : uniquement le propriétaire
DROP POLICY IF EXISTS "artisan_delete_documents" ON storage.objects;
CREATE POLICY "artisan_delete_documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
