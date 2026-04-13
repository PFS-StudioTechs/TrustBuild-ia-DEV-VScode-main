-- ============================================================
-- Tables de lignes pour devis et factures
-- (désignation, quantité, unité, prix unitaire, TVA)
-- ============================================================

-- Lignes de devis
CREATE TABLE IF NOT EXISTS public.lignes_devis (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  devis_id      UUID        NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  designation   TEXT        NOT NULL DEFAULT '',
  quantite      NUMERIC     NOT NULL DEFAULT 1,
  unite         TEXT        NOT NULL DEFAULT 'u',
  prix_unitaire NUMERIC     NOT NULL DEFAULT 0,
  tva           NUMERIC     NOT NULL DEFAULT 20,
  ordre         INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lignes_devis ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_devis' AND policyname='ld_select') THEN
    CREATE POLICY "ld_select" ON public.lignes_devis FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_devis' AND policyname='ld_insert') THEN
    CREATE POLICY "ld_insert" ON public.lignes_devis FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_devis' AND policyname='ld_update') THEN
    CREATE POLICY "ld_update" ON public.lignes_devis FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_devis' AND policyname='ld_delete') THEN
    CREATE POLICY "ld_delete" ON public.lignes_devis FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;

-- Lignes de facture
CREATE TABLE IF NOT EXISTS public.lignes_facture (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facture_id    UUID        NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  designation   TEXT        NOT NULL DEFAULT '',
  quantite      NUMERIC     NOT NULL DEFAULT 1,
  unite         TEXT        NOT NULL DEFAULT 'u',
  prix_unitaire NUMERIC     NOT NULL DEFAULT 0,
  tva           NUMERIC     NOT NULL DEFAULT 20,
  ordre         INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lignes_facture ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_facture' AND policyname='lf_select') THEN
    CREATE POLICY "lf_select" ON public.lignes_facture FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_facture' AND policyname='lf_insert') THEN
    CREATE POLICY "lf_insert" ON public.lignes_facture FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_facture' AND policyname='lf_update') THEN
    CREATE POLICY "lf_update" ON public.lignes_facture FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_facture' AND policyname='lf_delete') THEN
    CREATE POLICY "lf_delete" ON public.lignes_facture FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;
