-- Auto-assign tester role when admin or super_admin is assigned
CREATE OR REPLACE FUNCTION public.handle_admin_role_tester()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Quand on assigne admin ou super_admin, ajouter aussi tester
  IF NEW.role IN ('admin', 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.user_id, 'tester')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_admin_role_assigned_add_tester
  AFTER INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_admin_role_tester();

-- Assigner tester à tous les admins et super_admins existants
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'tester'::app_role
FROM public.user_roles
WHERE role IN ('admin', 'super_admin')
ON CONFLICT DO NOTHING;
