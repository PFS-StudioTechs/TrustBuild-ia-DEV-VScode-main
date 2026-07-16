import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Loader2, Store } from "lucide-react";
import { useCataloguePartenaires, ArticleCatalogue, OffreCatalogue } from "@/hooks/useCataloguePartenaires";

export default function CatalogueComparateurDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (article: ArticleCatalogue, offre: OffreCatalogue) => void;
}) {
  const { resultats, loading, rechercher } = useCataloguePartenaires();
  const [q, setQ] = useState("");

  const handleOpenChange = (o: boolean) => {
    if (!o) { onClose(); return; }
    setQ("");
    rechercher("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <Store className="w-4 h-4 text-muted-foreground" />
            Catalogues partenaires (simulation)
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Rechercher un article (ex : parquet, câble, ciment…)"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") rechercher(q); }}
            className="pl-7 h-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" className="text-xs" onClick={() => rechercher(q)}>
          Rechercher
        </Button>

        <ScrollArea className="flex-1 -mx-1 px-1">
          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {!loading && resultats.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">Aucun article trouvé.</p>
          )}
          <div className="space-y-2">
            {resultats.map(article => (
              <div key={article.reference} className="border rounded-lg p-2 space-y-1.5">
                <p className="text-xs font-medium">{article.designation}</p>
                <div className="space-y-1">
                  {article.offres.map(offre => (
                    <div key={offre.produit_id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5">
                        {offre.fournisseur_nom}
                        {article.moins_cher_fournisseur_id === offre.fournisseur_id && (
                          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Meilleur prix
                          </Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{offre.prix_achat.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} / {article.unite}</span>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => onSelect(article, offre)}>
                          Ajouter
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
