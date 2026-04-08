
-- Create api_configurations table
CREATE TABLE public.api_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_name TEXT NOT NULL,
  vault_secret_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  environment TEXT NOT NULL DEFAULT 'dev' CHECK (environment IN ('dev', 'prod')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_configurations ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read active configurations
CREATE POLICY "Authenticated users can view active configs"
  ON public.api_configurations
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- No direct insert/update/delete from client — managed via admin or migrations only

-- Timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_api_configurations_updated_at
  BEFORE UPDATE ON public.api_configurations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
