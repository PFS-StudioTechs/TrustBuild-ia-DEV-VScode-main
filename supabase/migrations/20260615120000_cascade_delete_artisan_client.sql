-- Corrige SET NULL → CASCADE sur devis et factures quand la fiche client est supprimée
ALTER TABLE devis
  DROP CONSTRAINT devis_client_id_fkey,
  ADD CONSTRAINT devis_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE factures
  DROP CONSTRAINT factures_client_id_fkey,
  ADD CONSTRAINT factures_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
