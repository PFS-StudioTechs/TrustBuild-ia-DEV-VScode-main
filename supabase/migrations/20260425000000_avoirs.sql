-- ============================================================
-- Avoirs (notes de crédit) liés aux devis
-- Logique : Facture = Devis HT + Avenants HT − Avoirs HT
-- ============================================================

-- Table avoirs
CREATE TABLE IF NOT EXISTS public.avoirs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  devis_id        UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  numero          TEXT NOT NULL,
  description     TEXT,
  montant_ht      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva             NUMERIC(5,2)  NOT NULL DEFAULT 20,
  statut          TEXT NOT NULL DEFAULT 'brouillon',
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table lignes_avoir (postes retirés / réduits)
CREATE TABLE IF NOT EXISTS public.lignes_avoir (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avoir_id        UUID NOT NULL REFERENCES public.avoirs(id) ON DELETE CASCADE,
  artisan_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation     TEXT NOT NULL DEFAULT '',
  quantite        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unite           TEXT NOT NULL DEFAULT 'u',
  prix_unitaire   NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva             NUMERIC(5,2)  NOT NULL DEFAULT 20,
  ordre           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.avoirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lignes_avoir ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'avoirs' AND policyname = 'artisan_own_avoirs') THEN
    CREATE POLICY "artisan_own_avoirs" ON public.avoirs FOR ALL USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lignes_avoir' AND policyname = 'artisan_own_lignes_avoir') THEN
    CREATE POLICY "artisan_own_lignes_avoir" ON public.lignes_avoir FOR ALL USING (artisan_id = auth.uid());
  END IF;
END $$;

-- Préfixe avoir dans les réglages
ALTER TABLE public.artisan_settings
  ADD COLUMN IF NOT EXISTS avoir_prefix TEXT NOT NULL DEFAULT 'AVO';
