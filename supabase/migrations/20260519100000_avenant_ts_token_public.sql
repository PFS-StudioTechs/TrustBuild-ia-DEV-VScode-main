-- token_public + token_expires_at sur avenants et travaux_supplementaires
-- Même pattern que devis (migration 20260514100000_devis_public_access.sql)

ALTER TABLE public.avenants
  ADD COLUMN IF NOT EXISTS token_public      UUID        NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS token_expires_at  TIMESTAMPTZ;

UPDATE public.avenants SET token_public = gen_random_uuid() WHERE token_public IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS avenants_token_public_idx ON public.avenants(token_public);

ALTER TABLE public.travaux_supplementaires
  ADD COLUMN IF NOT EXISTS token_public      UUID        NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS token_expires_at  TIMESTAMPTZ;

UPDATE public.travaux_supplementaires SET token_public = gen_random_uuid() WHERE token_public IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ts_token_public_idx ON public.travaux_supplementaires(token_public);
