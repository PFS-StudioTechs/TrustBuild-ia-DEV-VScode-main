-- ============================================================
-- Vues cloisonnées client : lignes_avenant et lignes_ts
-- Pattern identique à lignes_devis_client (20260617100000)
-- ============================================================

-- 1. Vue lignes_avenant_client
-- ============================================================
DROP VIEW IF EXISTS public.lignes_avenant_client;
CREATE VIEW public.lignes_avenant_client
  WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  la.id,
  la.avenant_id,
  la.designation,
  la.quantite,
  la.unite,
  la.prix_unitaire,
  la.tva,
  la.ordre,
  la.section_nom
FROM public.lignes_avenant la
WHERE la.avenant_id IN (
  SELECT a.id
  FROM public.avenants a
  WHERE a.devis_id IN (
    SELECT d.id
    FROM public.devis d
    WHERE d.client_id IN (
      SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid()
    )
  )
);

REVOKE ALL ON public.lignes_avenant_client FROM anon, public;
GRANT SELECT ON public.lignes_avenant_client TO authenticated;


-- 2. Vue lignes_ts_client
-- ============================================================
DROP VIEW IF EXISTS public.lignes_ts_client;
CREATE VIEW public.lignes_ts_client
  WITH (security_invoker = false, security_barrier = true)
AS
SELECT
  lt.id,
  lt.ts_id,
  lt.designation,
  lt.quantite,
  lt.unite,
  lt.prix_unitaire,
  lt.tva,
  lt.ordre,
  lt.section_nom
FROM public.lignes_ts lt
WHERE lt.ts_id IN (
  SELECT t.id
  FROM public.travaux_supplementaires t
  WHERE t.devis_id IN (
    SELECT d.id
    FROM public.devis d
    WHERE d.client_id IN (
      SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid()
    )
  )
);

REVOKE ALL ON public.lignes_ts_client FROM anon, public;
GRANT SELECT ON public.lignes_ts_client TO authenticated;
