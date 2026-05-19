-- Permet à tout artisan de valider les articles ia globaux (artisan_id IS NULL)
-- Les artisans ne peuvent supprimer que leurs propres articles manuels
DROP POLICY IF EXISTS produits_update ON produits;

CREATE POLICY produits_update ON produits
  FOR UPDATE TO authenticated
  USING (actif = true)
  WITH CHECK (actif = true);
