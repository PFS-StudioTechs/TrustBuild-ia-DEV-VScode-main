-- ============================================================
-- TrustBuild-IA — Comparateur de devis : couche données
-- Tables : client_projets, client_projet_devis
-- Vue     : lignes_devis_client (colonnes sensibles masquées)
-- Trigger : soft-delete sur suppression d'un devis
-- ============================================================

-- 1. Table client_projets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_projets (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  libelle      TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.client_projets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_client_projets_auth_user ON public.client_projets(auth_user_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projets' AND policyname='cp_select') THEN
    CREATE POLICY "cp_select" ON public.client_projets FOR SELECT
      TO authenticated USING (auth_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projets' AND policyname='cp_insert') THEN
    CREATE POLICY "cp_insert" ON public.client_projets FOR INSERT
      TO authenticated WITH CHECK (auth_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projets' AND policyname='cp_update') THEN
    CREATE POLICY "cp_update" ON public.client_projets FOR UPDATE
      TO authenticated
      USING (auth_user_id = auth.uid())
      WITH CHECK (auth_user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projets' AND policyname='cp_delete') THEN
    CREATE POLICY "cp_delete" ON public.client_projets FOR DELETE
      TO authenticated USING (auth_user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_client_projets_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_projets_updated_at ON public.client_projets;
CREATE TRIGGER trg_client_projets_updated_at
  BEFORE UPDATE ON public.client_projets
  FOR EACH ROW EXECUTE FUNCTION public.set_client_projets_updated_at();


-- 2. Table client_projet_devis
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_projet_devis (
  projet_id          UUID        NOT NULL REFERENCES public.client_projets(id) ON DELETE CASCADE,
  devis_id           UUID        NOT NULL REFERENCES public.devis(id),
  added_at           TIMESTAMPTZ DEFAULT NOW(),
  devis_supprime_at  TIMESTAMPTZ NULL,
  PRIMARY KEY (projet_id, devis_id)
);

ALTER TABLE public.client_projet_devis ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cpd_devis ON public.client_projet_devis(devis_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projet_devis' AND policyname='cpd_select') THEN
    CREATE POLICY "cpd_select" ON public.client_projet_devis FOR SELECT
      TO authenticated
      USING (
        projet_id IN (
          SELECT id FROM public.client_projets WHERE auth_user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projet_devis' AND policyname='cpd_insert') THEN
    CREATE POLICY "cpd_insert" ON public.client_projet_devis FOR INSERT
      TO authenticated
      WITH CHECK (
        projet_id IN (
          SELECT id FROM public.client_projets WHERE auth_user_id = auth.uid()
        )
        AND
        devis_id IN (
          SELECT id FROM public.devis
          WHERE client_id IN (
            SELECT id FROM public.clients WHERE auth_user_id = auth.uid()
          )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projet_devis' AND policyname='cpd_delete') THEN
    CREATE POLICY "cpd_delete" ON public.client_projet_devis FOR DELETE
      TO authenticated
      USING (
        projet_id IN (
          SELECT id FROM public.client_projets WHERE auth_user_id = auth.uid()
        )
      );
  END IF;
END $$;


-- 3. Soft-delete trigger sur devis
-- ============================================================
-- BEFORE DELETE : marque les liaisons AVANT que la FK ne soit vérifiée.
CREATE OR REPLACE FUNCTION public.soft_delete_devis_from_projets()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.client_projet_devis
  SET devis_supprime_at = NOW()
  WHERE devis_id = OLD.id
    AND devis_supprime_at IS NULL;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_soft_delete_devis ON public.devis;
CREATE TRIGGER trg_soft_delete_devis
  BEFORE DELETE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.soft_delete_devis_from_projets();


-- 4. Vue lignes_devis_client — cloisonnement colonnes sensibles
-- ============================================================
-- security_invoker=false : s'exécute avec les droits du owner (postgres),
-- contourne ld_select (artisan_id = auth.uid()) qui bloquerait les clients.
-- security_barrier=true  : force l'évaluation du WHERE en premier,
-- empêche le planificateur de réordonner les prédicats.
-- REVOKE/GRANT : anon ne peut structurellement pas accéder à la vue,
-- même si sa définition venait à être altérée.
DROP VIEW IF EXISTS public.lignes_devis_client;
CREATE VIEW public.lignes_devis_client
  WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  ld.id,
  ld.devis_id,
  ld.designation,
  ld.quantite,
  ld.unite,
  ld.prix_unitaire,
  ld.tva,
  ld.ordre,
  ld.section_nom
FROM public.lignes_devis ld
WHERE ld.devis_id IN (
  SELECT d.id
  FROM public.devis d
  WHERE d.client_id IN (
    SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid()
  )
);

REVOKE ALL ON public.lignes_devis_client FROM anon, public;
GRANT SELECT ON public.lignes_devis_client TO authenticated;
