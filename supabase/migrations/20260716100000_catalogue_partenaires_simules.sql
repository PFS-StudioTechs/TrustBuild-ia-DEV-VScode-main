-- ================================================================
-- Catalogue partenaires simulé (Castor, Merlin)
-- Fixtures en attendant l'intégration des vraies API fournisseurs.
-- Réutilise le schéma global existant (catalogue_fournisseurs + produits,
-- artisan_id NULL = article global, cf. migration 20260519100000).
-- ================================================================

INSERT INTO catalogue_fournisseurs (nom, nom_normalise, ville)
VALUES ('Castor', 'CASTOR', ''), ('Merlin', 'MERLIN', '')
ON CONFLICT (nom_normalise, ville) DO NOTHING;

INSERT INTO produits (artisan_id, fournisseur_id, reference, designation, unite, prix_achat, actif, statut_import)
SELECT NULL, cf.id, v.reference, v.designation, v.unite, v.prix_achat, true, 'valide'
FROM (VALUES
  -- Articles présents chez les deux fournisseurs (référence partagée = comparaison de prix possible)
  ('CASTOR', 'BTP-001', 'Parquet chêne massif 14mm',                'm2', 42.90),
  ('MERLIN', 'BTP-001', 'Parquet chêne massif 14mm',                'm2', 39.50),
  ('CASTOR', 'BTP-002', 'Carrelage grès cérame 60x60',               'm2', 24.50),
  ('MERLIN', 'BTP-002', 'Carrelage grès cérame 60x60',               'm2', 22.90),
  ('CASTOR', 'BTP-003', 'Peinture acrylique mate blanche 10L',       'u',  68.00),
  ('MERLIN', 'BTP-003', 'Peinture acrylique mate blanche 10L',       'u',  71.50),
  ('CASTOR', 'BTP-004', 'Plaque de plâtre BA13 2.5x1.2m',            'u',  9.80),
  ('MERLIN', 'BTP-004', 'Plaque de plâtre BA13 2.5x1.2m',            'u',  8.95),
  ('CASTOR', 'BTP-005', 'Laine de verre isolant 100mm (rouleau 10m2)','u', 34.90),
  ('MERLIN', 'BTP-005', 'Laine de verre isolant 100mm (rouleau 10m2)','u', 36.20),
  ('CASTOR', 'BTP-006', 'Tube PVC évacuation Ø100 (2m)',             'u',  12.40),
  ('MERLIN', 'BTP-006', 'Tube PVC évacuation Ø100 (2m)',             'u',  11.90),
  ('CASTOR', 'BTP-007', 'Câble électrique 3G1.5mm2 (100m)',          'u',  45.00),
  ('MERLIN', 'BTP-007', 'Câble électrique 3G1.5mm2 (100m)',          'u',  47.50),
  ('CASTOR', 'BTP-008', 'Disjoncteur différentiel 30mA 40A',         'u',  38.90),
  ('MERLIN', 'BTP-008', 'Disjoncteur différentiel 30mA 40A',         'u',  35.00),
  ('CASTOR', 'BTP-009', 'Robinet mitigeur évier cuisine',            'u',  89.90),
  ('MERLIN', 'BTP-009', 'Robinet mitigeur évier cuisine',            'u',  94.00),
  ('CASTOR', 'BTP-010', 'Colle carrelage sac 25kg',                  'u',  14.90),
  ('MERLIN', 'BTP-010', 'Colle carrelage sac 25kg',                  'u',  13.50),
  ('CASTOR', 'BTP-011', 'Vis à bois inox 4x40 (boîte 200)',          'u',  8.90),
  ('MERLIN', 'BTP-011', 'Vis à bois inox 4x40 (boîte 200)',          'u',  9.40),
  ('CASTOR', 'BTP-012', 'Perceuse visseuse sans fil 18V',            'u',  129.00),
  ('MERLIN', 'BTP-012', 'Perceuse visseuse sans fil 18V',            'u',  119.90),
  ('CASTOR', 'BTP-013', 'Parpaing creux 20x20x50',                   'u',  1.85),
  ('MERLIN', 'BTP-013', 'Parpaing creux 20x20x50',                   'u',  1.70),
  ('CASTOR', 'BTP-014', 'Fenêtre PVC double vitrage 100x100',        'u',  245.00),
  ('MERLIN', 'BTP-014', 'Fenêtre PVC double vitrage 100x100',        'u',  259.00),
  ('CASTOR', 'BTP-015', 'Ciment gris sac 35kg',                      'u',  7.50),
  ('MERLIN', 'BTP-015', 'Ciment gris sac 35kg',                      'u',  6.90),
  -- Articles exclusifs Castor
  ('CASTOR', 'CAS-101', 'Escabeau alu 5 marches',                    'u',  79.90),
  ('CASTOR', 'CAS-102', 'Peinture façade siloxane 15L',               'u', 145.00),
  ('CASTOR', 'CAS-103', 'Radiateur électrique 1500W',                 'u', 189.00),
  ('CASTOR', 'CAS-104', 'Volet roulant alu motorisé',                 'u', 320.00),
  ('CASTOR', 'CAS-105', 'Store banne 3x2m manuel',                    'u', 410.00),
  -- Articles exclusifs Merlin
  ('MERLIN', 'MER-201', 'Chauffe-eau électrique 200L',                'u', 399.00),
  ('MERLIN', 'MER-202', 'Terrasse composite bois (lame 2.4m)',        'u',  28.50),
  ('MERLIN', 'MER-203', 'Portail aluminium coulissant 3.5m',          'u', 890.00),
  ('MERLIN', 'MER-204', 'Douche à l''italienne kit complet',          'u', 349.00),
  ('MERLIN', 'MER-205', 'Meuble sous vasque 80cm',                    'u', 175.00)
) AS v(fournisseur_code, reference, designation, unite, prix_achat)
JOIN catalogue_fournisseurs cf ON cf.nom_normalise = v.fournisseur_code
WHERE NOT EXISTS (
  SELECT 1 FROM produits p
  WHERE p.fournisseur_id = cf.id AND p.reference = v.reference AND p.artisan_id IS NULL
);
