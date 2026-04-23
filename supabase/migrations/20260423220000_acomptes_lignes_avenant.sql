-- ============================================================
-- Lignes d'avenant (remplace le montant global unique)
-- Acomptes (avances en % du devis, déduites des factures)
-- ============================================================

-- Lignes d'avenant (structure identique à lignes_devis)
CREATE TABLE IF NOT EXISTS public.lignes_avenant (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  avenant_id    UUID        NOT NULL REFERENCES public.avenants(id) ON DELETE CASCADE,
  artisan_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  designation   TEXT        NOT NULL DEFAULT '',
  quantite      NUMERIC     NOT NULL DEFAULT 1,
  unite         TEXT        NOT NULL DEFAULT 'u',
  prix_unitaire NUMERIC     NOT NULL DEFAULT 0,
  tva           NUMERIC     NOT NULL DEFAULT 20,
  ordre         INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lignes_avenant ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_avenant' AND policyname='la_select') THEN
    CREATE POLICY "la_select" ON public.lignes_avenant FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_avenant' AND policyname='la_insert') THEN
    CREATE POLICY "la_insert" ON public.lignes_avenant FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_avenant' AND policyname='la_update') THEN
    CREATE POLICY "la_update" ON public.lignes_avenant FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lignes_avenant' AND policyname='la_delete') THEN
    CREATE POLICY "la_delete" ON public.lignes_avenant FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;

-- Acomptes : avances % du devis, déduites des factures suivantes
CREATE TABLE IF NOT EXISTS public.acomptes (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  devis_id          UUID        NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  numero            TEXT        NOT NULL DEFAULT '',
  pourcentage       NUMERIC(5,2),
  montant           NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut            TEXT        NOT NULL DEFAULT 'en_attente', -- en_attente | encaisse
  date_echeance     DATE,
  date_encaissement TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.acomptes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='acomptes' AND policyname='acomptes_select') THEN
    CREATE POLICY "acomptes_select" ON public.acomptes FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='acomptes' AND policyname='acomptes_insert') THEN
    CREATE POLICY "acomptes_insert" ON public.acomptes FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='acomptes' AND policyname='acomptes_update') THEN
    CREATE POLICY "acomptes_update" ON public.acomptes FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='acomptes' AND policyname='acomptes_delete') THEN
    CREATE POLICY "acomptes_delete" ON public.acomptes FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acomptes_devis ON public.acomptes(devis_id);
CREATE INDEX IF NOT EXISTS idx_lignes_avenant_avenant ON public.lignes_avenant(avenant_id);
