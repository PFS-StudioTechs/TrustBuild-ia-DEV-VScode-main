import { useLocation, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { FolderOpen, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";
import NouveauProjetDialog from "@/components/client/NouveauProjetDialog";
import { toast } from "sonner";

const tabs = [
  { segment: "nouveau", label: "À venir", path: "/espace-client/projets/nouveau" },
  { segment: "en-cours", label: "En cours", path: "/espace-client/projets/en-cours" },
  { segment: "termine", label: "Terminé", path: "/espace-client/projets/termine" },
];

type ProjetStatutDerive = "a_venir" | "en_cours" | "termine";

interface ProjetAvecStatut {
  id: string;
  libelle: string;
  created_at: string;
  statut: ProjetStatutDerive;
}

function deriveStatut(devisStatuts: string[], facturesStatuts: string[]): ProjetStatutDerive {
  if (devisStatuts.length === 0) return "a_venir";
  const auMoinsUnSigne = devisStatuts.some((s) => s === "signe");
  if (!auMoinsUnSigne) return "a_venir";
  const tousSignes = devisStatuts.every((s) => s === "signe");
  if (tousSignes && facturesStatuts.length > 0 && facturesStatuts.every((s) => s === "payee")) {
    return "termine";
  }
  return "en_cours";
}

export default function MesProjets() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const segment = location.pathname.split("/").pop() ?? "en-cours";
  const activeStatut: ProjetStatutDerive = segment === "nouveau" ? "a_venir" : segment === "termine" ? "termine" : "en_cours";

  const { data: projets, isLoading } = useQuery({
    queryKey: ["client-projets-avec-statut", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ProjetAvecStatut[]> => {
      const { data: projetsData } = await (supabase as any)
        .from("client_projets")
        .select("id, libelle, created_at")
        .eq("auth_user_id", user!.id)
        .order("created_at", { ascending: false });

      const projetsList = (projetsData ?? []) as { id: string; libelle: string; created_at: string }[];
      if (projetsList.length === 0) return [];

      const projetIds = projetsList.map((p) => p.id);
      const { data: liaisons } = await (supabase as any)
        .from("client_projet_devis")
        .select("projet_id, devis_id")
        .in("projet_id", projetIds)
        .is("devis_supprime_at", null);

      const liaisonRows = (liaisons ?? []) as { projet_id: string; devis_id: string }[];
      const devisIds = [...new Set(liaisonRows.map((l) => l.devis_id))];

      const devisMap: Record<string, string> = {};
      const facturesByDevis: Record<string, string[]> = {};

      if (devisIds.length > 0) {
        const { data: devisData } = await supabase
          .from("devis")
          .select("id, statut")
          .in("id", devisIds);
        for (const d of devisData ?? []) devisMap[d.id] = d.statut;

        const { data: facturesData } = await supabase
          .from("factures")
          .select("devis_id, statut")
          .in("devis_id", devisIds);
        for (const f of facturesData ?? []) {
          if (!f.devis_id) continue;
          (facturesByDevis[f.devis_id] ??= []).push(f.statut);
        }
      }

      return projetsList.map((p) => {
        const devisIdsDuProjet = liaisonRows.filter((l) => l.projet_id === p.id).map((l) => l.devis_id);
        const devisStatuts = devisIdsDuProjet.map((id) => devisMap[id]).filter(Boolean);
        const facturesStatuts = devisIdsDuProjet.flatMap((id) => facturesByDevis[id] ?? []);
        return { ...p, statut: deriveStatut(devisStatuts, facturesStatuts) };
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (libelle: string) => {
      const { error } = await (supabase as any)
        .from("client_projets")
        .insert({ auth_user_id: user!.id, libelle });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projet créé");
      queryClient.invalidateQueries({ queryKey: ["client-projets-avec-statut", user?.id] });
    },
    onError: () => { toast.error("Erreur lors de la création"); },
  });

  const handleSave = async (libelle: string): Promise<boolean> => {
    try {
      await createMutation.mutateAsync(libelle);
      return true;
    } catch {
      return false;
    }
  };

  const filtered = (projets ?? []).filter((p) => p.statut === activeStatut);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-display font-bold">Mes projets</h1>
        {segment === "nouveau" && (
          <Button onClick={() => setFormOpen(true)} className="bg-gradient-to-r from-primary to-primary/90 shadow-forge">
            <Plus className="w-4 h-4 mr-1" /> Nouveau projet
          </Button>
        )}
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

      {!isLoading && filtered.length === 0 && (
        <div className="forge-card text-center py-12 space-y-3">
          <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Aucun projet {segment === "nouveau" ? "à venir" : segment === "en-cours" ? "en cours" : "terminé"}</p>
          <p className="text-sm text-muted-foreground">
            {segment === "nouveau"
              ? "Créez un projet pour regrouper vos devis."
              : "Vos projets apparaîtront ici selon l'avancement de vos devis et factures."}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => navigate(`/espace-client/comparateur/${p.id}`)}
            className="forge-card hover:shadow-forge-hover transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{p.libelle}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Créé le {new Date(p.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <Badge variant="outline" className="text-xs shrink-0 ml-2">
                {p.statut === "a_venir" ? "À venir" : p.statut === "en_cours" ? "En cours" : "Terminé"}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <NouveauProjetDialog open={formOpen} onOpenChange={setFormOpen} onSave={handleSave} />
    </div>
  );
}
