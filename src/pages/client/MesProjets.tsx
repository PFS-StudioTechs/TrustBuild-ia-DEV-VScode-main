import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "À venir", path: "/espace-client/projets/nouveau" },
  { label: "En cours", path: "/espace-client/projets/en-cours" },
  { label: "Terminé", path: "/espace-client/projets/termine" },
];

const statusMap: Record<string, string> = {
  nouveau: "prospect",
  "en-cours": "en_cours",
  termine: "termine",
};

export default function MesProjets() {
  const location = useLocation();
  const navigate = useNavigate();
  const segment = location.pathname.split("/").pop() ?? "en-cours";
  const status = statusMap[segment] ?? "en_cours";

  const { data: clientIds } = useQuery({
    queryKey: ["client-ids"],
    queryFn: async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? "";
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", userId);
      return (data ?? []).map((c) => c.id);
    },
  });

  const ids = clientIds ?? [];

  const { data: chantiers, isLoading } = useQuery({
    queryKey: ["client-chantiers", ids, status],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("chantiers")
        .select("id, nom, adresse, statut, date_debut, date_fin_prevue")
        .in("client_id", ids)
        .eq("statut", status)
        .order("date_debut", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-display font-bold">Mes projets</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const active = location.pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 skeleton-shimmer rounded-xl" />)}
        </div>
      )}

      {!isLoading && chantiers?.length === 0 && (
        <div className="forge-card text-center py-12 space-y-3">
          <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Aucun projet {segment === "nouveau" ? "à venir" : segment === "en-cours" ? "en cours" : "terminé"}</p>
          <p className="text-sm text-muted-foreground">Vos chantiers apparaîtront ici dès que votre artisan les aura créés.</p>
        </div>
      )}

      <div className="space-y-3">
        {chantiers?.map((c) => (
          <div key={c.id} className="forge-card hover:shadow-forge-hover transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{c.nom}</h3>
                {c.adresse && <p className="text-sm text-muted-foreground mt-0.5">{c.adresse}</p>}
              </div>
              <Badge variant="outline" className="text-xs shrink-0 ml-2">
                {c.statut === "en_cours" ? "En cours" : c.statut === "planification" ? "Planification" : "Terminé"}
              </Badge>
            </div>
            {(c.date_debut || c.date_fin_prevue) && (
              <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                {c.date_debut && <span>Début : {new Date(c.date_debut).toLocaleDateString("fr-FR")}</span>}
                {c.date_fin_prevue && <span>Fin prévue : {new Date(c.date_fin_prevue).toLocaleDateString("fr-FR")}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
