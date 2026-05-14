-- ============================================================
-- Extension des statuts devis / factures
-- + tables travaux_supplementaires et avoirs
-- + champ numero sur avenants
-- ============================================================

-- Nouveaux statuts devis (utilisés aussi par avenants et TS)
ALTER TYPE devis_statut ADD VALUE IF NOT EXISTS 'en_cours';
ALTER TYPE devis_statut ADD VALUE IF NOT EXISTS 'chantier_en_cours';
ALTER TYPE devis_statut ADD VALUE IF NOT EXISTS 'termine';

-- Nouveaux statuts factures
ALTER TYPE facture_statut ADD VALUE IF NOT EXISTS 'en_attente_paiement';
ALTER TYPE facture_statut ADD VALUE IF NOT EXISTS 'refusee';
ALTER TYPE facture_statut ADD VALUE IF NOT EXISTS 'a_modifier';

-- Numéro sur avenants (ex : AV-001)
ALTER TABLE public.avenants
  ADD COLUMN IF NOT EXISTS numero TEXT;

-- ============================================================
-- Table travaux_supplementaires (TS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.travaux_supplementaires (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  devis_id      UUID        NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  numero        TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  montant_ht    NUMERIC     NOT NULL DEFAULT 0,
  tva           NUMERIC     NOT NULL DEFAULT 20,
  statut        TEXT        NOT NULL DEFAULT 'brouillon',
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.travaux_supplementaires ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='travaux_supplementaires' AND policyname='ts_select') THEN
    CREATE POLICY "ts_select" ON public.travaux_supplementaires FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='travaux_supplementaires' AND policyname='ts_insert') THEN
    CREATE POLICY "ts_insert" ON public.travaux_supplementaires FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='travaux_supplementaires' AND policyname='ts_update') THEN
    CREATE POLICY "ts_update" ON public.travaux_supplementaires FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='travaux_supplementaires' AND policyname='ts_delete') THEN
    CREATE POLICY "ts_delete" ON public.travaux_supplementaires FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;

-- ============================================================
-- Table avoirs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.avoirs (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  facture_id    UUID        REFERENCES public.factures(id) ON DELETE SET NULL,
  devis_id      UUID        REFERENCES public.devis(id) ON DELETE SET NULL,
  numero        TEXT        NOT NULL,
  description   TEXT        NOT NULL DEFAULT '',
  montant_ht    NUMERIC     NOT NULL DEFAULT 0,
  tva           NUMERIC     NOT NULL DEFAULT 20,
  statut        TEXT        NOT NULL DEFAULT 'brouillon',
  date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.avoirs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='avoirs' AND policyname='avoirs_select') THEN
    CREATE POLICY "avoirs_select" ON public.avoirs FOR SELECT USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='avoirs' AND policyname='avoirs_insert') THEN
    CREATE POLICY "avoirs_insert" ON public.avoirs FOR INSERT WITH CHECK (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='avoirs' AND policyname='avoirs_update') THEN
    CREATE POLICY "avoirs_update" ON public.avoirs FOR UPDATE USING (artisan_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='avoirs' AND policyname='avoirs_delete') THEN
    CREATE POLICY "avoirs_delete" ON public.avoirs FOR DELETE USING (artisan_id = auth.uid());
  END IF;
END $$;
