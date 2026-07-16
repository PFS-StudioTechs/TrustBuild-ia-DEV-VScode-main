import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OffreCatalogue {
  produit_id: string;
  fournisseur_id: string;
  fournisseur_nom: string;
  prix_achat: number;
}

export interface ArticleCatalogue {
  reference: string;
  designation: string;
  unite: string;
  offres: OffreCatalogue[];
  moins_cher_fournisseur_id: string | null;
}

export function useCataloguePartenaires() {
  const [resultats, setResultats] = useState<ArticleCatalogue[]>([]);
  const [loading, setLoading] = useState(false);

  const rechercher = async (q: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("search-catalogue-partenaires", { body: { q } });
    setLoading(false);
    if (error) { setResultats([]); return; }
    setResultats((data?.articles ?? []) as ArticleCatalogue[]);
  };

  return { resultats, loading, rechercher };
}
