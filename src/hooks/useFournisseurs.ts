import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Fournisseur {
  id: string;
  artisan_id: string;
  nom: string;
  nom_contact: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  siret: string | null;
  categorie: string | null;
  notes: string | null;
  api_config_id: string | null;
  created_at: string;
  updated_at: string;
}

export type FournisseurForm = Omit<Fournisseur, "id" | "artisan_id" | "api_config_id" | "created_at" | "updated_at">;

const emptyForm = (): FournisseurForm => ({
  nom: "",
  nom_contact: "",
  email: "",
  telephone: "",
  adresse: "",
  siret: "",
  categorie: "",
  notes: "",
});

export function useFournisseurs() {
  const { user } = useAuth();
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("fournisseurs")
      .select("*")
      .eq("artisan_id", user.id)
      .order("nom");
    if (error) toast.error("Erreur lors du chargement des fournisseurs");
    else setFournisseurs((data as Fournisseur[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (form: FournisseurForm): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase.from("fournisseurs").insert({
      artisan_id: user.id,
      nom: form.nom.trim(),
      nom_contact: form.nom_contact?.trim() || null,
      email: form.email?.trim() || null,
      telephone: form.telephone?.trim() || null,
      adresse: form.adresse?.trim() || null,
      siret: form.siret?.trim() || null,
      categorie: form.categorie?.trim() || null,
      notes: form.notes?.trim() || null,
    });
    if (error) { toast.error("Erreur lors de l'ajout du fournisseur"); return false; }
    toast.success("Fournisseur ajouté");
    await fetch();
    return true;
  };

  const update = async (id: string, form: FournisseurForm): Promise<boolean> => {
    const { error } = await supabase.from("fournisseurs").update({
      nom: form.nom.trim(),
      nom_contact: form.nom_contact?.trim() || null,
      email: form.email?.trim() || null,
      telephone: form.telephone?.trim() || null,
      adresse: form.adresse?.trim() || null,
      siret: form.siret?.trim() || null,
      categorie: form.categorie?.trim() || null,
      notes: form.notes?.trim() || null,
    }).eq("id", id);
    if (error) { toast.error("Erreur lors de la modification"); return false; }
    toast.success("Fournisseur mis à jour");
    await fetch();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("fournisseurs").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); return false; }
    toast.success("Fournisseur supprimé");
    setFournisseurs(prev => prev.filter(f => f.id !== id));
    return true;
  };

  return { fournisseurs, loading, refresh: fetch, add, update, remove, emptyForm };
}
