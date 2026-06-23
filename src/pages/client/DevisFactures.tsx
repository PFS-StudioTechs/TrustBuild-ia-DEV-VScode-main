import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Receipt, GitBranch, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tab = "devis" | "factures" | "avenants" | "ts";

const statusColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-blue-100 text-blue-700",
  accepte: "bg-emerald-100 text-emerald-700",
  refuse: "bg-red-100 text-red-700",
  paye: "bg-emerald-100 text-emerald-700",
  payee: "bg-emerald-100 text-emerald-700",
  en_attente: "bg-amber-100 text-amber-700",
  signe: "bg-emerald-100 text-emerald-700",
};

const statusLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  paye: "Payé",
  payee: "Payé",
  en_attente: "En attente",
  signe: "Signé ✓",
};

const tabConfig: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "devis", label: "Devis", icon: FileText },
  { id: "factures", label: "Factures", icon: Receipt },
  { id: "avenants", label: "Avenants", icon: GitBranch },
  { id: "ts", label: "Travaux suppl.", icon: Wrench },
];

function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

export default function DevisFactures() {
  const [tab, setTab] = useState<Tab>("devis");

  const { data: clientMeta } = useQuery({
    queryKey: ["client-meta"],
    queryFn: async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? "";
      const { data: clients } = await supabase
        .from("clients")
        .select("id, artisan_id")
        .eq("auth_user_id", userId);
      if (!clients?.length) return { ids: [] as string[], artisanMap: {} as Record<string, string> };
      const artisanIds = [...new Set(clients.map((c) => c.artisan_id).filter((id): id is string => !!id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, prenom, nom")
        .in("id", artisanIds);
      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [p.id, [p.prenom, p.nom].filter(Boolean).join(" ")])
      );
      const artisanMap = Object.fromEntries(
        clients.map((c) => [c.id, c.artisan_id ? (profileMap[c.artisan_id] ?? "Artisan") : "Artisan"])
      );
      return { ids: clients.map((c) => c.id), artisanMap };
    },
  });

  const clientIds = clientMeta?.ids ?? [];
  const artisanMap = clientMeta?.artisanMap ?? {};
  const hasClients = clientIds.length > 0;

  const { data: devis, isLoading: loadingDevis } = useQuery({
    queryKey: ["client-devis", clientIds],
    enabled: hasClients,
    queryFn: async () => {
      const { data } = await supabase
        .from("devis")
        .select("id, numero, statut, montant_ht, created_at, client_id")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false });
      return (data ?? []).map((d) => ({
        ...d,
        montant: d.montant_ht,
        artisanNom: artisanMap[d.client_id] ?? "Artisan",
      }));
    },
  });

  const { data: factures, isLoading: loadingFactures } = useQuery({
    queryKey: ["client-factures", clientIds],
    enabled: hasClients,
    queryFn: async () => {
      const { data } = await supabase
        .from("factures")
        .select("id, numero, statut, montant_ttc, created_at, client_id")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false });
      return (data ?? []).map((f) => ({
        ...f,
        montant: f.montant_ttc,
        artisanNom: artisanMap[f.client_id] ?? "Artisan",
      }));
    },
  });

  const { data: avenants, isLoading: loadingAvenants } = useQuery({
    queryKey: ["client-avenants", clientIds],
    enabled: hasClients,
    queryFn: async () => {
      const { data: devisData } = await supabase
        .from("devis")
        .select("id")
        .in("client_id", clientIds);
      const ids = (devisData ?? []).map((d) => d.id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("avenants")
        .select("id, numero, statut, montant_ht, created_at, description")
        .in("devis_id", ids)
        .order("created_at", { ascending: false });
      return (data ?? []).map((a) => ({ ...a, montant: a.montant_ht, objet: a.description }));
    },
  });

  const { data: ts, isLoading: loadingTs } = useQuery({
    queryKey: ["client-ts", clientIds],
    enabled: hasClients,
    queryFn: async () => {
      const { data: devisData } = await supabase
        .from("devis")
        .select("id")
        .in("client_id", clientIds);
      const ids = (devisData ?? []).map((d) => d.id);
      if (ids.length === 0) return [];
      const { data } = await (supabase as any)
        .from("travaux_supplementaires")
        .select("id, numero, statut, montant_ht, created_at, description")
        .in("devis_id", ids)
        .order("created_at", { ascending: false });
      return (data ?? []).map((t: any) => ({ ...t, montant: t.montant_ht, objet: t.description }));
    },
  });

  const loadingMap: Record<Tab, boolean> = {
    devis: loadingDevis,
    factures: loadingFactures,
    avenants: loadingAvenants,
    ts: loadingTs,
  };

  const itemsMap: Record<Tab, any[]> = {
    devis: devis ?? [],
    factures: factures ?? [],
    avenants: avenants ?? [],
    ts: ts ?? [],
  };

  const isLoading = loadingMap[tab];
  const items = itemsMap[tab];

  const emptyLabels: Record<Tab, string> = {
    devis: "Aucun devis pour l'instant",
    factures: "Aucune facture pour l'instant",
    avenants: "Aucun avenant pour l'instant",
    ts: "Aucun travail supplémentaire pour l'instant",
  };

  const emptySubLabels: Record<Tab, string> = {
    devis: "Vos devis apparaîtront ici dès que votre artisan en créera.",
    factures: "Vos factures apparaîtront ici dès que votre artisan en émettra.",
    avenants: "Les avenants liés à vos devis apparaîtront ici.",
    ts: "Les travaux supplémentaires liés à vos chantiers apparaîtront ici.",
  };

  const emptyIcons: Record<Tab, React.ElementType> = {
    devis: FileText,
    factures: Receipt,
    avenants: GitBranch,
    ts: Wrench,
  };

  const EmptyIcon = emptyIcons[tab];
  const multiArtisan = clientIds.length > 1;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-h1 font-display font-bold">Mes documents</h1>

      <div className="flex gap-1 border-b overflow-x-auto">
        {tabConfig.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
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
          <EmptyIcon className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">{emptyLabels[tab]}</p>
          <p className="text-sm text-muted-foreground">{emptySubLabels[tab]}</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="forge-card hover:shadow-forge-hover transition-all">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{item.numero}</span>
                  {item.statut && (
                    <Badge className={cn("text-xs", statusColors[item.statut] ?? "bg-muted text-muted-foreground")}>
                      {statusLabels[item.statut] ?? item.statut}
                    </Badge>
                  )}
                </div>
                {item.objet && <p className="text-sm text-muted-foreground mt-0.5">{item.objet}</p>}
                {multiArtisan && item.artisanNom && (
                  <p className="text-xs text-muted-foreground mt-1">Artisan : {item.artisanNom}</p>
                )}
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
