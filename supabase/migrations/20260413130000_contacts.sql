-- Création de la table contacts
CREATE TABLE IF NOT EXISTS public.contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom          TEXT NOT NULL,
  prenom       TEXT,
  role         TEXT,
  entreprise   TEXT,
  email        TEXT,
  telephone    TEXT,
  adresse      TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes par artisan
CREATE INDEX IF NOT EXISTS contacts_artisan_id_idx ON public.contacts (artisan_id);

-- Trigger updated_at
DROP TRIGGER IF EXISTS contacts_updated_at ON public.contacts;
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='contacts_select') THEN
    CREATE POLICY "contacts_select" ON public.contacts FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='contacts_insert') THEN
    CREATE POLICY "contacts_insert" ON public.contacts FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='contacts_update') THEN
    CREATE POLICY "contacts_update" ON public.contacts FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='contacts' AND policyname='contacts_delete') THEN
    CREATE POLICY "contacts_delete" ON public.contacts FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;
