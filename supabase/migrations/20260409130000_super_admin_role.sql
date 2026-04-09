-- Add super_admin to the role enum
-- Policies are applied in migration 20260409140000_super_admin_policies.sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
