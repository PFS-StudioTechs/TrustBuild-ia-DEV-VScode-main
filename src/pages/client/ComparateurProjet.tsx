import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Scale, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Projet {
  id: string;
  libelle: string;
  created_at: string;
}

interface DevisInfo {
  id: string;
  numero: string;
  montant_ht: number;
  statut: string;
  objet: string | null;
  artisanNom: string;
}

interface LiaisonItem {
  devis_id: string;
  added_at: string;
  devis_supprime_at: string | null;
  info: DevisInfo | null;
}

const statusColors: Record<string, string> = {
  envoye: "bg-blue-100 text-blue-700",
  accepte: "bg-emerald-100 text-emerald-700",
  refuse: "bg-red-100 text-red-700",
  signe: "bg-emerald-100 text-emerald-700",
};

const statusLabels: Record<string, string> = {
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  signe: "Signé ✓",
};

function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

async function loadArtisanMap(artisanIds: string[]): Promise<Record<string, string>> {
  if (artisanIds.length === 0) return {};
  const { data } = await supabase
    .from("profiles")
    .select("user_id, prenom, nom, raison_sociale")
    .in("user_id", artisanIds);
  return Object.fromEntries(
    (data ?? []).map((p) => [
      p.user_id,
      p.raison_sociale?.trim() || [p.prenom, p.nom].filter(Boolean).join(" ") || "Artisan",
    ])
  );
}

export default function ComparateurProjet() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: projet, isLoading: loadingProjet } = useQuery({
    queryKey: ["client-projet", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_projets")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      return (data ?? null) as Projet | null;
    },
  });

  const { data: clientIds } = useQuery({
    queryKey: ["client-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", user!.id);
      return (data ?? []).map((c) => c.id);
    },
  });

  const ids = clientIds ?? [];

  const { data: liaisons, isLoading: loadingLiaisons } = useQuery({
    queryKey: ["projet-devis", id],
    enabled: !!id,
    queryFn: async (): Promise<LiaisonItem[]> => {
      const { data: links } = await (supabase as any)
        .from("client_projet_devis")
        .select("devis_id, added_at, devis_supprime_at")
        .eq("projet_id", id)
        .order("added_at", { ascending: true });
      const rows = (links ?? []) as { devis_id: string; added_at: string; devis_supprime_at: string | null }[];

      const activeIds = rows.filter((r) => !r.devis_supprime_at).map((r) => r.devis_id);
      let infoMap: Record<string, DevisInfo> = {};
      if (activeIds.length > 0) {
        const { data: devisRows } = await supabase
          .from("devis")
          .select("id, numero, montant_ht, statut, objet, artisan_id")
          .in("id", activeIds);
        const artisanMap = await loadArtisanMap(
          [...new Set((devisRows ?? []).map((d) => d.artisan_id).filter((a): a is string => !!a))]
        );
        infoMap = Object.fromEntries(
          (devisRows ?? []).map((d) => [
            d.id,
            {
              id: d.id,
              numero: d.numero,
              montant_ht: d.montant_ht,
              statut: d.statut,
              objet: d.objet,
              artisanNom: d.artisan_id ? (artisanMap[d.artisan_id] ?? "Artisan") : "Artisan",
            } as DevisInfo,
          ])
        );
      }

      return rows.map((r) => ({
        devis_id: r.devis_id,
        added_at: r.added_at,
        devis_supprime_at: r.devis_supprime_at,
        info: r.devis_supprime_at ? null : (infoMap[r.devis_id] ?? null),
      }));
    },
  });

  const { data: clientDevis, isLoading: loadingClientDevis } = useQuery({
    queryKey: ["client-envoye-devis", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<DevisInfo[]> => {
      const { data: devisRows } = await supabase
        .from("devis")
        .select("id, numero, montant_ht, statut, objet, artisan_id")
        .in("client_id", ids)
        .eq("statut", "envoye")
        .order("created_at", { ascending: false });
      const artisanMap = await loadArtisanMap(
        [...new Set((devisRows ?? []).map((d) => d.artisan_id).filter((a): a is string => !!a))]
      );
      return (devisRows ?? []).map((d) => ({
        id: d.id,
        numero: d.numero,
        montant_ht: d.montant_ht,
        statut: d.statut,
        objet: d.objet,
        artisanNom: d.artisan_id ? (artisanMap[d.artisan_id] ?? "Artisan") : "Artisan",
      }));
    },
  });

  const linkedIds = new Set((liaisons ?? []).map((l) => l.devis_id));
  const addable = (clientDevis ?? []).filter((d) => !linkedIds.has(d.id));

  const addMutation = useMutation({
    mutationFn: async (devisId: string) => {
      const { error } = await (supabase as any)
        .from("client_projet_devis")
        .insert({ projet_id: id, devis_id: devisId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis ajouté au comparatif");
      queryClient.invalidateQueries({ queryKey: ["projet-devis", id] });
    },
    onError: () => { toast.error("Erreur lors de l'ajout"); },
  });

  const removeMutation = useMutation({
    mutationFn: async (devisId: string) => {
      const { error } = await (supabase as any)
        .from("client_projet_devis")
        .delete()
        .eq("projet_id", id)
        .eq("devis_id", devisId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Devis retiré du comparatif");
      queryClient.invalidateQueries({ queryKey: ["projet-devis", id] });
    },
    onError: () => { toast.error("Erreur lors du retrait"); },
  });

  if (loadingProjet) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="h-8 skeleton-shimmer rounded-lg w-1/3" />
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 skeleton-shimmer rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!projet) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="forge-card text-center py-12 space-y-3">
          <Scale className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Projet introuvable</p>
          <p className="text-sm text-muted-foreground">
            Ce projet n'existe pas ou ne vous appartient pas.
          </p>
          <Link to="/espace-client/comparateur" className="inline-block">
            <Button variant="outline" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" /> Retour aux comparatifs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="space-y-3">
        <button
          onClick={() => navigate("/espace-client/comparateur")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Mes comparatifs
        </button>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-h1 font-display font-bold">{projet.libelle}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Créé le {new Date(projet.created_at).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <Button onClick={() => setPickerOpen(true)} className="bg-gradient-to-r from-primary to-primary/90 shadow-forge shrink-0">
            <Plus className="w-4 h-4 mr-1" /> Ajouter un devis
          </Button>
        </div>
      </div>

      {loadingLiaisons && (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-20 skeleton-shimmer rounded-xl" />)}
        </div>
      )}

      {!loadingLiaisons && (liaisons?.length ?? 0) === 0 && (
        <div className="forge-card text-center py-12 space-y-3">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Aucun devis dans ce comparatif</p>
          <p className="text-sm text-muted-foreground">
            Ajoutez les devis que vous souhaitez comparer.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {liaisons?.map((l) => {
          const supprime = !!l.devis_supprime_at;
          return (
            <div
              key={l.devis_id}
              className={cn(
                "forge-card transition-all",
                supprime ? "opacity-60" : "hover:shadow-forge-hover"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {supprime ? (
                    <>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <Badge className="bg-amber-100 text-amber-700 text-xs">Devis retiré par l'artisan</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        Ce devis a été supprimé par l'artisan le{" "}
                        {new Date(l.devis_supprime_at!).toLocaleDateString("fr-FR")}. Il n'est plus consultable.
                      </p>
                    </>
                  ) : l.info ? (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{l.info.numero}</span>
                        <Badge className={cn("text-xs", statusColors[l.info.statut] ?? "bg-muted text-muted-foreground")}>
                          {statusLabels[l.info.statut] ?? l.info.statut}
                        </Badge>
                      </div>
                      {l.info.objet && <p className="text-sm text-muted-foreground mt-0.5 truncate">{l.info.objet}</p>}
                      <p className="text-xs text-muted-foreground mt-1">Artisan : {l.info.artisanNom}</p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Devis indisponible</p>
                  )}
                </div>

                <div className="flex items-start gap-3 shrink-0">
                  {!supprime && l.info && (
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm">{formatEur(l.info.montant_ht)}</div>
                      <div className="text-xs text-muted-foreground">HT</div>
                    </div>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Retirer ce devis du comparatif ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Le devis n'est pas supprimé — il est seulement retiré de ce comparatif.
                          Vous pourrez le rajouter plus tard.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMutation.mutate(l.devis_id)}
                          className="bg-destructive text-destructive-foreground"
                        >
                          Retirer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Ajouter un devis au comparatif</DialogTitle>
          </DialogHeader>

          {loadingClientDevis && (
            <div className="space-y-3">
              {[1, 2].map((i) => <div key={i} className="h-16 skeleton-shimmer rounded-xl" />)}
            </div>
          )}

          {!loadingClientDevis && addable.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="font-medium">Aucun devis disponible à ajouter</p>
              <p className="text-sm text-muted-foreground">
                Seuls les devis que vous avez reçus apparaissent ici. Si un devis manque,
                vérifiez avec votre artisan qu'il l'a bien envoyé à votre adresse email.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {addable.map((d) => (
              <div key={d.id} className="forge-card flex items-center justify-between gap-3 !p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{d.numero}</span>
                    <span className="font-mono text-sm">{formatEur(d.montant_ht)} HT</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">Artisan : {d.artisanNom}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  disabled={addMutation.isPending}
                  onClick={() => addMutation.mutate(d.id)}
                >
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
