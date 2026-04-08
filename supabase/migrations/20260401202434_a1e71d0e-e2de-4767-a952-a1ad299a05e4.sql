
-- Documents table for file management
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id uuid NOT NULL,
  nom text NOT NULL,
  description text DEFAULT '',
  type_fichier text NOT NULL DEFAULT 'autre',
  taille_octets bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  storage_path text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  chantier_id uuid REFERENCES public.chantiers(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  fournisseur_id uuid REFERENCES public.fournisseurs(id) ON DELETE SET NULL,
  est_archive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own" ON public.documents FOR SELECT TO authenticated
  USING (auth.uid() = artisan_id);
CREATE POLICY "documents_insert_own" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "documents_update_own" ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() = artisan_id);
CREATE POLICY "documents_delete_own" ON public.documents FOR DELETE TO authenticated
  USING (auth.uid() = artisan_id);

-- Trigger for updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Private storage bucket for artisan documents
INSERT INTO storage.buckets (id, name, public) VALUES ('artisan-documents', 'artisan-documents', false);

-- Storage RLS: artisans can only access their own folder
CREATE POLICY "artisan_documents_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'artisan-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "artisan_documents_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artisan-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "artisan_documents_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'artisan-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "artisan_documents_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artisan-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
