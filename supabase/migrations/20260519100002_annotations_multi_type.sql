-- Extension devis_annotations pour supporter avenants et TS
-- Ajout doc_type + doc_id ; devis_id devient nullable (rétro-compat devis existants)

ALTER TABLE devis_annotations
  ADD COLUMN IF NOT EXISTS doc_type TEXT NOT NULL DEFAULT 'devis',
  ADD COLUMN IF NOT EXISTS doc_id   UUID;

-- Remplir doc_id depuis devis_id pour les annotations existantes
UPDATE devis_annotations SET doc_id = devis_id WHERE doc_id IS NULL AND devis_id IS NOT NULL;

-- Rendre devis_id nullable (les annotations avenant/ts n'ont pas de devis_id)
ALTER TABLE devis_annotations
  ALTER COLUMN devis_id DROP NOT NULL;

-- Index pour requêtes par doc_type + doc_id
CREATE INDEX IF NOT EXISTS devis_annotations_doc_idx ON devis_annotations(doc_type, doc_id);

-- Mise à jour politique RLS artisan : inclure avenants et TS
DROP POLICY IF EXISTS "artisan_select_annotations" ON devis_annotations;
CREATE POLICY "artisan_select_annotations" ON devis_annotations
  FOR SELECT
  USING (
    (doc_type = 'devis' AND EXISTS (
      SELECT 1 FROM devis
      WHERE devis.id = devis_annotations.doc_id
        AND devis.artisan_id = auth.uid()
    ))
    OR
    (doc_type = 'avenant' AND EXISTS (
      SELECT 1 FROM avenants
      WHERE avenants.id = devis_annotations.doc_id
        AND avenants.artisan_id = auth.uid()
    ))
    OR
    (doc_type = 'ts' AND EXISTS (
      SELECT 1 FROM travaux_supplementaires
      WHERE travaux_supplementaires.id = devis_annotations.doc_id
        AND travaux_supplementaires.artisan_id = auth.uid()
    ))
  );
