import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Scale, FileText, AlertTriangle, Loader2, CheckCircle2, AlertCircle, Info, HelpCircle } from "lucide-react";
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

interface LigneComparee {
  artisan_ref: string;
  designation_origine: string;
  quantite: number;
  unite: string;
  pu_ht: number;
  montant_ht: number;
  tva: number;
  confiance: number;
}

interface PosteCanonique {
  id: string;
  libelle: string;
  categorie: string;
  lignes: LigneComparee[];
  presence: Record<string, boolean>;
  alerte_unite_heterogene: boolean;
  alerte_ecart_prix: boolean;
}

interface Orpheline {
  artisan_ref: string;
  designation_origine: string;
  quantite: number;
  unite: string;
  pu_ht: number;
  montant_ht: number;
  tva: number;
  raison: string;
}

interface SyntheseArtisan {
  artisan_ref: string;
  nb_postes_couverts: number;
  nb_postes_total: number;
  postes_manquants: string[];
}

interface Observation {
  type: string;
  gravite: "haute" | "moyenne" | "basse";
  message: string;
}

interface Comparison {
  version: string;
  demande_id: string;
  nb_devis: number;
  postes_canoniques: PosteCanonique[];
  lignes_orphelines: Orpheline[];
  synthese_par_artisan: SyntheseArtisan[];
  observations: Observation[];
}

type MappingEntry = { devis_id: string; artisan_nom: string; numero_devis: string };
type Mapping = Record<string, MappingEntry>;
interface CompareResult { comparison: Comparison; mapping: Mapping; }

const CONFIANCE_MIN = 0.75;

const obsStyles: Record<Observation["gravite"], string> = {
  haute: "border-l-red-500 bg-red-50 text-red-800",
  moyenne: "border-l-amber-500 bg-amber-50 text-amber-800",
  basse: "border-l-border bg-muted/40 text-foreground",
};

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
        .in("statut", ["envoye", "signe"])
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

  const [result, setResult] = useState<CompareResult | null>(null);

  const activeCount = (liaisons ?? []).filter((l) => !l.devis_supprime_at).length;

  const compareMutation = useMutation({
    mutationFn: async (): Promise<CompareResult> => {
      const { data, error } = await supabase.functions.invoke("compare-devis", {
        body: { projet_id: id },
      });
      if (error) {
        let msg = "Erreur lors de la comparaison";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) msg = body.error;
        } catch { /* corps illisible — message générique */ }
        throw new Error(msg);
      }
      if (!data?.comparison || !data?.mapping) {
        throw new Error("Réponse de comparaison invalide");
      }
      return data as CompareResult;
    },
    onSuccess: (data) => setResult(data),
    onError: (err: any) => { toast.error(err?.message ?? "Erreur lors de la comparaison"); },
  });

  const artisanName = (alias: string) =>
    result?.mapping[alias]?.artisan_nom ?? alias;

  const aliases = result
    ? Object.keys(result.mapping).sort(
        (a, b) =>
          (parseInt(a.replace(/\D/g, ""), 10) || 0) -
          (parseInt(b.replace(/\D/g, ""), 10) || 0)
      )
    : [];

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

      <div className="space-y-4 pt-2 border-t">
        <div className="flex flex-col gap-1">
          <Button
            onClick={() => compareMutation.mutate()}
            disabled={activeCount < 2 || compareMutation.isPending}
            className="bg-gradient-to-r from-primary to-primary/90 shadow-forge w-full sm:w-auto"
          >
            {compareMutation.isPending
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Analyse en cours…</>
              : <><Scale className="w-4 h-4 mr-1.5" /> Comparer les devis</>}
          </Button>
          {activeCount < 2 && (
            <p className="text-xs text-muted-foreground">Ajoutez au moins 2 devis pour comparer.</p>
          )}
        </div>

        {result && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.comparison.synthese_par_artisan.map((s) => {
                const manquants = s.postes_manquants?.length ?? 0;
                return (
                  <div key={s.artisan_ref} className="forge-card space-y-1.5">
                    <div className="font-semibold text-sm">{artisanName(s.artisan_ref)}</div>
                    {result.mapping[s.artisan_ref]?.numero_devis && (
                      <div className="text-xs text-muted-foreground font-mono">{result.mapping[s.artisan_ref].numero_devis}</div>
                    )}
                    <div className="text-sm">
                      <span className="font-mono font-bold">{s.nb_postes_couverts}</span>
                      <span className="text-muted-foreground"> / {s.nb_postes_total} postes chiffrés</span>
                    </div>
                    {manquants > 0 ? (
                      <Badge className="bg-amber-100 text-amber-700 text-xs">
                        {manquants} poste{manquants > 1 ? "s" : ""} non chiffré{manquants > 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Tous les postes chiffrés
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hidden md:block space-y-3">
              <h2 className="text-h2 font-display font-bold">Comparatif par poste</h2>
              <div className="overflow-x-auto forge-card !p-0">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left font-semibold p-3 align-bottom min-w-[180px]">Poste</th>
                      {aliases.map((a) => (
                        <th key={a} className="text-left font-semibold p-3 align-bottom">
                          <div>{artisanName(a)}</div>
                          {result.mapping[a]?.numero_devis && (
                            <div className="text-xs text-muted-foreground font-mono font-normal">{result.mapping[a].numero_devis}</div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.comparison.postes_canoniques.map((poste) => {
                      const incertain = poste.lignes.some((l) => l.confiance < CONFIANCE_MIN);
                      return (
                        <tr key={poste.id} className="border-b last:border-0 align-top">
                          <td className="p-3">
                            <div className="font-medium">{poste.libelle}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {poste.alerte_unite_heterogene && <Badge className="bg-amber-100 text-amber-700 text-[10px]">unités ≠</Badge>}
                              {poste.alerte_ecart_prix && <Badge className="bg-amber-100 text-amber-700 text-[10px]">écart de prix</Badge>}
                              {incertain && <Badge className="bg-orange-100 text-orange-700 text-[10px] gap-0.5"><HelpCircle className="w-2.5 h-2.5" />à vérifier</Badge>}
                            </div>
                          </td>
                          {aliases.map((a) => {
                            const ligne = poste.lignes.find((l) => l.artisan_ref === a);
                            const present = !!poste.presence?.[a] && !!ligne;
                            if (!present) {
                              return <td key={a} className="p-3 bg-red-50 text-red-700 text-xs">non chiffré</td>;
                            }
                            return (
                              <td key={a} className="p-3">
                                <div className="font-mono font-semibold">{formatEur(ligne!.montant_ht)}</div>
                                <div className="text-[11px] text-muted-foreground">{ligne!.quantite} {ligne!.unite} × {formatEur(ligne!.pu_ht)}</div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="md:hidden space-y-3">
              <h2 className="text-h2 font-display font-bold">Comparatif par poste</h2>
              {result.comparison.postes_canoniques.map((poste) => {
                const incertain = poste.lignes.some((l) => l.confiance < CONFIANCE_MIN);
                return (
                  <div key={poste.id} className="forge-card space-y-2">
                    <div className="font-medium">{poste.libelle}</div>
                    <div className="flex flex-wrap gap-1">
                      {poste.alerte_unite_heterogene && <Badge className="bg-amber-100 text-amber-700 text-[10px]">unités ≠</Badge>}
                      {poste.alerte_ecart_prix && <Badge className="bg-amber-100 text-amber-700 text-[10px]">écart de prix</Badge>}
                      {incertain && <Badge className="bg-orange-100 text-orange-700 text-[10px] gap-0.5"><HelpCircle className="w-2.5 h-2.5" />à vérifier</Badge>}
                    </div>
                    <div className="space-y-1.5 pt-1">
                      {aliases.map((a) => {
                        const ligne = poste.lignes.find((l) => l.artisan_ref === a);
                        const present = !!poste.presence?.[a] && !!ligne;
                        return (
                          <div key={a} className="flex items-start justify-between gap-2 text-sm">
                            <span className="text-muted-foreground truncate">{artisanName(a)}</span>
                            {present ? (
                              <span className="text-right shrink-0">
                                <span className="font-mono font-semibold">{formatEur(ligne!.montant_ht)}</span>
                                <span className="block text-[11px] text-muted-foreground">{ligne!.quantite} {ligne!.unite} × {formatEur(ligne!.pu_ht)}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-red-700 bg-red-50 px-1.5 py-0.5 rounded shrink-0">non chiffré</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {result.comparison.lignes_orphelines?.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-h2 font-display font-bold">Proposé par un seul artisan</h2>
                <div className="space-y-2">
                  {result.comparison.lignes_orphelines.map((o, i) => (
                    <div key={i} className="forge-card opacity-70">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{o.designation_origine}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{artisanName(o.artisan_ref)} — {o.raison}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-semibold text-sm">{formatEur(o.montant_ht)}</div>
                          <div className="text-[11px] text-muted-foreground">{o.quantite} {o.unite}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.comparison.observations?.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-h2 font-display font-bold">À retenir</h2>
                <div className="space-y-2">
                  {result.comparison.observations.map((o, i) => {
                    const Icon = o.gravite === "haute" ? AlertCircle : o.gravite === "moyenne" ? AlertTriangle : Info;
                    return (
                      <div key={i} className={cn("border-l-4 rounded-r-lg p-3 text-sm flex gap-2", obsStyles[o.gravite])}>
                        <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{o.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
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
