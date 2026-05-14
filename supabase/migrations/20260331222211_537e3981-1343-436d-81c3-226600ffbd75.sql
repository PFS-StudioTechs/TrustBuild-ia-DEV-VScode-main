
-- =====================
-- ENUMS
-- =====================
CREATE TYPE public.client_type AS ENUM ('particulier', 'pro');
CREATE TYPE public.chantier_statut AS ENUM ('prospect', 'en_cours', 'termine', 'litige');
CREATE TYPE public.devis_statut AS ENUM ('brouillon', 'envoye', 'signe', 'refuse');
CREATE TYPE public.facture_statut AS ENUM ('brouillon', 'envoyee', 'payee', 'impayee');
CREATE TYPE public.automation_statut AS ENUM ('pending', 'approved', 'sent');
CREATE TYPE public.plan_abonnement AS ENUM ('gratuit', 'starter', 'pro', 'enterprise');

-- =====================
-- PROFILES
-- =====================
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL DEFAULT '',
  prenom TEXT NOT NULL DEFAULT '',
  siret TEXT,
  logo_url TEXT,
  plan_abonnement public.plan_abonnement NOT NULL DEFAULT 'gratuit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- ARTISAN_SETTINGS
-- =====================
CREATE TABLE public.artisan_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  coordonnees_bancaires JSONB NOT NULL DEFAULT '{}',
  signature_electronique_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.artisan_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select_own" ON public.artisan_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "settings_insert_own" ON public.artisan_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "settings_update_own" ON public.artisan_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_artisan_settings_updated_at BEFORE UPDATE ON public.artisan_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- CLIENTS
-- =====================
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  email TEXT,
  telephone TEXT,
  adresse TEXT,
  type public.client_type NOT NULL DEFAULT 'particulier',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_select_own" ON public.clients FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "clients_insert_own" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "clients_update_own" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "clients_delete_own" ON public.clients FOR DELETE TO authenticated USING (auth.uid() = artisan_id);

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- FOURNISSEURS
-- =====================
CREATE TABLE public.fournisseurs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  contact TEXT,
  api_config_id UUID REFERENCES public.api_configurations(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.fournisseurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fournisseurs_select_own" ON public.fournisseurs FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "fournisseurs_insert_own" ON public.fournisseurs FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "fournisseurs_update_own" ON public.fournisseurs FOR UPDATE TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "fournisseurs_delete_own" ON public.fournisseurs FOR DELETE TO authenticated USING (auth.uid() = artisan_id);

CREATE TRIGGER update_fournisseurs_updated_at BEFORE UPDATE ON public.fournisseurs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- CHANTIERS
-- =====================
CREATE TABLE public.chantiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  adresse_chantier TEXT,
  statut public.chantier_statut NOT NULL DEFAULT 'prospect',
  date_debut DATE,
  date_fin_prevue DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chantiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chantiers_select_own" ON public.chantiers FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "chantiers_insert_own" ON public.chantiers FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "chantiers_update_own" ON public.chantiers FOR UPDATE TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "chantiers_delete_own" ON public.chantiers FOR DELETE TO authenticated USING (auth.uid() = artisan_id);

CREATE TRIGGER update_chantiers_updated_at BEFORE UPDATE ON public.chantiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- DEVIS
-- =====================
CREATE TABLE public.devis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id UUID NOT NULL REFERENCES public.chantiers(id) ON DELETE CASCADE,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  montant_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  statut public.devis_statut NOT NULL DEFAULT 'brouillon',
  date_validite DATE,
  facturx_ready BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "devis_select_own" ON public.devis FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "devis_insert_own" ON public.devis FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "devis_update_own" ON public.devis FOR UPDATE TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "devis_delete_own" ON public.devis FOR DELETE TO authenticated USING (auth.uid() = artisan_id);

CREATE TRIGGER update_devis_updated_at BEFORE UPDATE ON public.devis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- AVENANTS
-- =====================
CREATE TABLE public.avenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  montant_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  statut public.devis_statut NOT NULL DEFAULT 'brouillon',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.avenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avenants_select_own" ON public.avenants FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "avenants_insert_own" ON public.avenants FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "avenants_update_own" ON public.avenants FOR UPDATE TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "avenants_delete_own" ON public.avenants FOR DELETE TO authenticated USING (auth.uid() = artisan_id);

CREATE TRIGGER update_avenants_updated_at BEFORE UPDATE ON public.avenants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- FACTURES
-- =====================
CREATE TABLE public.factures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  devis_id UUID NOT NULL REFERENCES public.devis(id) ON DELETE CASCADE,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  montant_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  date_echeance DATE NOT NULL,
  statut public.facture_statut NOT NULL DEFAULT 'brouillon',
  solde_restant NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.factures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "factures_select_own" ON public.factures FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "factures_insert_own" ON public.factures FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "factures_update_own" ON public.factures FOR UPDATE TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "factures_delete_own" ON public.factures FOR DELETE TO authenticated USING (auth.uid() = artisan_id);

CREATE TRIGGER update_factures_updated_at BEFORE UPDATE ON public.factures FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- PAIEMENTS
-- =====================
CREATE TABLE public.paiements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  facture_id UUID NOT NULL REFERENCES public.factures(id) ON DELETE CASCADE,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  montant NUMERIC(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  mode TEXT NOT NULL DEFAULT 'virement',
  reference_transaction TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paiements_select_own" ON public.paiements FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "paiements_insert_own" ON public.paiements FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);

CREATE INDEX idx_paiements_facture ON public.paiements(facture_id);

-- =====================
-- AUTOMATION_LOGS
-- =====================
CREATE TABLE public.automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type_action TEXT NOT NULL,
  payload_input JSONB NOT NULL DEFAULT '{}',
  payload_output JSONB NOT NULL DEFAULT '{}',
  statut public.automation_statut NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_select_own" ON public.automation_logs FOR SELECT TO authenticated USING (auth.uid() = artisan_id);
CREATE POLICY "automation_insert_own" ON public.automation_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = artisan_id);
CREATE POLICY "automation_update_own" ON public.automation_logs FOR UPDATE TO authenticated USING (auth.uid() = artisan_id);

CREATE TRIGGER update_automation_logs_updated_at BEFORE UPDATE ON public.automation_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================
-- INDEXES
-- =====================
CREATE INDEX idx_profiles_user ON public.profiles(user_id);
CREATE INDEX idx_clients_artisan ON public.clients(artisan_id);
CREATE INDEX idx_fournisseurs_artisan ON public.fournisseurs(artisan_id);
CREATE INDEX idx_chantiers_artisan ON public.chantiers(artisan_id);
CREATE INDEX idx_chantiers_client ON public.chantiers(client_id);
CREATE INDEX idx_devis_chantier ON public.devis(chantier_id);
CREATE INDEX idx_devis_artisan ON public.devis(artisan_id);
CREATE INDEX idx_avenants_devis ON public.avenants(devis_id);
CREATE INDEX idx_factures_devis ON public.factures(devis_id);
CREATE INDEX idx_factures_artisan ON public.factures(artisan_id);
CREATE INDEX idx_automation_artisan ON public.automation_logs(artisan_id);
