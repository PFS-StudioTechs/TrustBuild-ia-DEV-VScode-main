-- Normalise les emails existants en minuscules pour cohérence
UPDATE clients SET email = lower(email) WHERE email IS NOT NULL;

-- Contrainte d'unicité (artisan_id, email) insensible à la casse
-- Index partiel : NULL autorisé (plusieurs clients sans email pour un même artisan)
CREATE UNIQUE INDEX IF NOT EXISTS clients_artisan_email_unique
  ON clients (artisan_id, lower(email))
  WHERE email IS NOT NULL;
