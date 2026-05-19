-- Restreint la modification des produits aux articles manuels de l'artisan uniquement
-- Les articles globaux (ia/valide) ne peuvent être modifiés que par service_role (Cataverif, Edge Functions)
DROP POLICY IF EXISTS produits_update ON produits;

CREATE POLICY produits_update ON produits
  FOR UPDATE TO authenticated
  USING (artisan_id = auth.uid() AND statut_import = 'manuel')
  WITH CHECK (artisan_id = auth.uid() AND statut_import = 'manuel');
