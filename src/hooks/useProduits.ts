import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Produit {
  id: string;
  artisan_id: string;
  fournisseur_id: string;
  import_id: string | null;
  reference: string | null;
  designation: string;
  unite: string;
  prix_achat: number;
  prix_negocie_valeur: number | null;
  prix_negocie: boolean;
  actif: boolean;
  statut_import: "ia" | "valide" | "manuel";
  created_at: string;
  updated_at: string;
}

export type ProduitUpdate = Pick<Produit, "reference" | "designation" | "unite" | "prix_achat" | "prix_negocie_valeur" | "prix_negocie">;

const db = supabase as any;

export function useProduits() {
  const { user } = useAuth();
  const [produits, setProduits] = useState<Produit[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const fetchProduits = useCallback(async (fournisseurId: string) => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await db
      .from("produits")
      .select("*")
      .eq("artisan_id", user.id)
      .eq("fournisseur_id", fournisseurId)
      .eq("actif", true)
      .order("statut_import")
      .order("designation");
    if (error) toast.error("Erreur lors du chargement du catalogue");
    else setProduits((data as Produit[]) ?? []);
    setLoading(false);
  }, [user]);

  const createProduit = async (fournisseurId: string, fields: ProduitUpdate): Promise<boolean> => {
    if (!user) return false;
    if (fields.reference) {
      const existing = produits.find(p => p.reference?.trim().toLowerCase() === fields.reference!.trim().toLowerCase());
      if (existing) {
        toast.error(`Référence "${fields.reference}" déjà existante — modifiez l'article existant.`);
        return false;
      }
    }
    const { error } = await db.from("produits").insert({
      artisan_id: user.id,
      fournisseur_id: fournisseurId,
      import_id: null,
      ...fields,
      statut_import: "manuel",
      actif: true,
    });
    if (error) { toast.error("Erreur lors de la création"); return false; }
    await fetchProduits(fournisseurId);
    return true;
  };

  const updateProduit = async (id: string, fields: ProduitUpdate): Promise<boolean> => {
    const toSave = {
      ...fields,
      prix_negocie: fields.prix_negocie_valeur != null && fields.prix_negocie_valeur > 0,
      statut_import: "valide",
    };
    const { error } = await db.from("produits").update(toSave).eq("id", id);
    if (error) { toast.error("Erreur lors de la modification"); return false; }
    setProduits(prev => prev.map(p => p.id === id ? { ...p, ...toSave } : p));
    return true;
  };

  const validerProduit = async (id: string): Promise<void> => {
    const { error } = await db.from("produits").update({ statut_import: "valide" }).eq("id", id);
    if (error) { toast.error("Erreur lors de la validation"); return; }
    setProduits(prev => prev.map(p => p.id === id ? { ...p, statut_import: "valide" } : p));
  };

  const validerProduits = async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await db.from("produits").update({ statut_import: "valide" }).in("id", ids);
    if (error) { toast.error("Erreur lors de la validation"); return; }
    setProduits(prev => prev.map(p => ids.includes(p.id) ? { ...p, statut_import: "valide" } : p));
  };

  const deleteProduit = async (id: string): Promise<void> => {
    const { error } = await db.from("produits").update({ actif: false }).eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setProduits(prev => prev.filter(p => p.id !== id));
  };

  const deleteProduits = async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const { error } = await db.from("produits").update({ actif: false }).in("id", ids);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setProduits(prev => prev.filter(p => !ids.includes(p.id)));
  };

  const uploadCatalogue = async (fournisseurId: string, file: File): Promise<void> => {
    if (!user) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    const fichier_type: "csv" | "image" | "pdf" =
      ext === "csv" ? "csv" : file.type.startsWith("image/") ? "image" : "pdf";

    const storagePath = `${user.id}/catalogues/${fournisseurId}/${Date.now()}-${file.name}`;
    setImporting(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from("artisan-documents")
        .upload(storagePath, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data: importRow, error: importError } = await db
        .from("catalogue_imports")
        .insert({ artisan_id: user.id, fournisseur_id: fournisseurId, fichier_url: storagePath, fichier_type, statut: "en_cours" })
        .select("id")
        .single();
      if (importError) throw new Error(importError.message);

      const { data: result, error: fnError } = await supabase.functions.invoke("extract-catalogue", {
        body: { import_id: importRow.id, storage_path: storagePath, fichier_type },
      });
      if (fnError) {
        try { await db.from("catalogue_imports").update({ statut: "erreur" }).eq("id", importRow.id); } catch {}
        throw new Error("L'extraction a échoué. Un administrateur va traiter cet import manuellement et vous contacter.");
      }
      if (result?.error === "catalogue_too_large") {
        throw new Error(`Ce catalogue est trop volumineux (${result.nb_pages} pages, max ${result.max_pages}). Un administrateur va le traiter manuellement et vous contacter.`);
      }

      const nb = result?.nb_produits ?? 0;
      toast.success(`${nb} produit${nb !== 1 ? "s" : ""} extrait${nb !== 1 ? "s" : ""}`);
      await fetchProduits(fournisseurId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'import");
    } finally {
      setImporting(false);
    }
  };

  return { produits, loading, importing, fetchProduits, createProduit, updateProduit, validerProduit, validerProduits, deleteProduit, deleteProduits, uploadCatalogue };
}
