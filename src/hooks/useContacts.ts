import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Contact {
  id: string;
  artisan_id: string;
  nom: string;
  prenom: string | null;
  role: string | null;
  entreprise: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  notes: string | null;
  site_web: string | null;
  created_at: string;
  updated_at: string;
}

export type ContactForm = Omit<Contact, "id" | "artisan_id" | "created_at" | "updated_at">;

export const emptyContactForm = (): ContactForm => ({
  nom: "",
  prenom: "",
  role: "",
  entreprise: "",
  email: "",
  telephone: "",
  adresse: "",
  notes: "",
  site_web: "",
});

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("contacts")
      .select("*")
      .eq("artisan_id", user.id)
      .order("nom");
    if (error) toast.error("Erreur lors du chargement des contacts");
    else setContacts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (form: ContactForm): Promise<boolean> => {
    if (!user) return false;
    const { error } = await (supabase as any).from("contacts").insert({
      artisan_id: user.id,
      nom: form.nom.trim(),
      prenom: form.prenom?.trim() || null,
      role: form.role?.trim() || null,
      entreprise: form.entreprise?.trim() || null,
      email: form.email?.trim() || null,
      telephone: form.telephone?.trim() || null,
      adresse: form.adresse?.trim() || null,
      notes: form.notes?.trim() || null,
      site_web: form.site_web?.trim() || null,
    });
    if (error) { toast.error("Erreur lors de l'ajout du contact"); return false; }
    toast.success("Contact ajouté");
    await fetch();
    return true;
  };

  const update = async (id: string, form: ContactForm): Promise<boolean> => {
    const { error } = await (supabase as any).from("contacts").update({
      nom: form.nom.trim(),
      prenom: form.prenom?.trim() || null,
      role: form.role?.trim() || null,
      entreprise: form.entreprise?.trim() || null,
      email: form.email?.trim() || null,
      telephone: form.telephone?.trim() || null,
      adresse: form.adresse?.trim() || null,
      notes: form.notes?.trim() || null,
      site_web: form.site_web?.trim() || null,
    }).eq("id", id);
    if (error) { toast.error("Erreur lors de la modification"); return false; }
    toast.success("Contact mis à jour");
    await fetch();
    return true;
  };

  const remove = async (id: string): Promise<boolean> => {
    const { error } = await (supabase as any).from("contacts").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); return false; }
    toast.success("Contact supprimé");
    setContacts(prev => prev.filter(c => c.id !== id));
    return true;
  };

  return { contacts, loading, refresh: fetch, add, update, remove };
}
