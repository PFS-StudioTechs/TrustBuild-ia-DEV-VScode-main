import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tab = "devis" | "factures";

const statusColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-blue-100 text-blue-700",
  accepte: "bg-emerald-100 text-emerald-700",
  refuse: "bg-red-100 text-red-700",
  paye: "bg-emerald-100 text-emerald-700",
  en_attente: "bg-amber-100 text-amber-700",
};

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  paye: "Payé",
  en_attente: "En attente",
};

function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

export default function DevisFactures() {
  const [tab, setTab] = useState<Tab>("devis");

  const { data: clientData } = useQuery({
    queryKey: ["client-self"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      return data;
    },
  });

  const { data: devis, isLoading: loadingDevis } = useQuery({
    queryKey: ["client-devis", clientData?.id],
    enabled: !!clientData?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("devis")
        .select("id, numero, statut, montant_ht, created_at, objet")
        .eq("client_id", clientData!.id)
        .order("created_at", { ascending: false });
      return (data ?? []).map((d) => ({ ...d, montant: d.montant_ht }));
    },
  });

  const { data: factures, isLoading: loadingFactures } = useQuery({
    queryKey: ["client-factures", clientData?.id],
    enabled: !!clientData?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("factures")
        .select("id, numero, statut, montant_ttc, created_at, objet")
        .eq("client_id", clientData!.id)
        .order("created_at", { ascending: false });
      return (data ?? []).map((f) => ({ ...f, montant: f.montant_ttc }));
    },
  });

  const isLoading = tab === "devis" ? loadingDevis : loadingFactures;
  const items = tab === "devis" ? (devis ?? []) : (factures ?? []);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-h1 font-display font-bold">Devis & Factures</h1>

      <div className="flex gap-1 border-b">
        {(["devis", "factures"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "devis" ? "Devis" : "Factures"}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 skeleton-shimmer rounded-xl" />)}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="forge-card text-center py-12 space-y-3">
          {tab === "devis" ? <FileText className="w-10 h-10 text-muted-foreground mx-auto" /> : <Receipt className="w-10 h-10 text-muted-foreground mx-auto" />}
          <p className="font-medium">Aucun{tab === "factures" ? "e" : ""} {tab === "devis" ? "devis" : "facture"} pour l'instant</p>
          <p className="text-sm text-muted-foreground">Vos {tab === "devis" ? "devis" : "factures"} apparaîtront ici dès que votre artisan en créera.</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="forge-card hover:shadow-forge-hover transition-all">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{item.numero}</span>
                  <Badge className={cn("text-xs", statusColors[item.statut] ?? "bg-muted text-muted-foreground")}>
                    {statusLabels[item.statut] ?? item.statut}
                  </Badge>
                </div>
                {item.objet && <p className="text-sm text-muted-foreground mt-0.5">{item.objet}</p>}
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-sm">{formatEur(item.montant ?? 0)}</div>
                <div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleDateString("fr-FR")}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
