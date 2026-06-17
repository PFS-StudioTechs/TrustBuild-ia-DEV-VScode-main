import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "artisan" | "super_admin" | "tester" | "client";

export function useRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setFetchedFor(null);
      return;
    }

    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (cancelled) return;
        setRoles((data || []).map((r) => r.role as AppRole));
        setFetchedFor(user.id);
      });
    return () => { cancelled = true; };
  }, [user]);

  // loading dérivé : tant que les rôles du user courant ne sont pas chargés,
  // on reste loading — évite la fenêtre périmée (roles=[] + loading=false) au login.
  const loading = !!user && fetchedFor !== user.id;

  return {
    roles,
    loading,
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    isArtisan: roles.includes("artisan"),
    isSuperAdmin: roles.includes("super_admin"),
    isTester: roles.includes("tester"),
    isClient: roles.includes("client"),
  };
}
