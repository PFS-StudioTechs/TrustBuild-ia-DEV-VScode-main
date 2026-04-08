import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HardHat, TrendingUp, AlertTriangle, ShoppingCart, Bot, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { format, differenceInDays, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

// Types dérivés du schéma Supabase — source unique de vérité
type Chantier = Pick<Database["public"]["Tables"]["chantiers"]["Row"], "id" | "nom" | "statut">;
type Devis = Pick<Database["public"]["Tables"]["devis"]["Row"], "id" | "chantier_id" | "montant_ht" | "statut">;
type Facture = Pick<Database["public"]["Tables"]["factures"]["Row"], "id" | "devis_id" | "artisan_id" | "montant_ht" | "solde_restant" | "statut" | "date_echeance" | "numero" | "created_at">;
type Paiement = Pick<Database["public"]["Tables"]["paiements"]["Row"], "id" | "facture_id" | "montant" | "date">;

export default function Finances() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "chantier";
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [devis, setDevis] = useState<Devis[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const [ch, dv, fa, pa] = await Promise.all([
        supabase.from("chantiers").select("id, nom, statut").eq("artisan_id", user.id),
        supabase.from("devis").select("id, chantier_id, montant_ht, statut").eq("artisan_id", user.id),
        supabase.from("factures").select("id, devis_id, artisan_id, montant_ht, solde_restant, statut, date_echeance, numero, created_at").eq("artisan_id", user.id),
        supabase.from("paiements").select("id, facture_id, montant, date").eq("artisan_id", user.id),
      ]);
      if (ch.data) setChantiers(ch.data);
      if (dv.data) setDevis(dv.data);
      if (fa.data) setFactures(fa.data);
      if (pa.data) setPaiements(pa.data);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const chantierStats = useMemo(() => {
    return chantiers.map(ch => {
      const chDevis = devis.filter(d => d.chantier_id === ch.id);
      const devisIds = chDevis.map(d => d.id);
      const chFactures = factures.filter(f => devisIds.includes(f.devis_id));
      const chPaiements = paiements.filter(p => chFactures.some(f => f.id === p.facture_id));
      const budgetDevis = chDevis.reduce((s, d) => s + Number(d.montant_ht), 0);
      const facture = chFactures.reduce((s, f) => s + Number(f.montant_ht), 0);
      const encaisse = chPaiements.reduce((s, p) => s + Number(p.montant), 0);
      const resteAFacturer = budgetDevis - facture;
      return { ...ch, budgetDevis, facture, encaisse, resteAFacturer, progression: budgetDevis > 0 ? (encaisse / budgetDevis) * 100 : 0 };
    });
  }, [chantiers, devis, factures, paiements]);

  const tresorerieData = useMemo(() => {
    const months: { label: string; encaisse: number; attente: number; retard: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const label = format(d, "MMM yy", { locale: fr });
      const moisPaiements = paiements.filter(p => { const pd = new Date(p.date); return pd >= start && pd <= end; });
      const encaisse = moisPaiements.reduce((s, p) => s + Number(p.montant), 0);
      const moisFactures = factures.filter(f => { const fd = new Date(f.created_at); return fd >= start && fd <= end; });
      const attente = moisFactures.filter(f => f.statut === "envoyee").reduce((s, f) => s + Number(f.solde_restant), 0);
      const retard = moisFactures.filter(f => f.statut === "impayee").reduce((s, f) => s + Number(f.solde_restant), 0);
      months.push({ label, encaisse, attente, retard });
    }
    return months;
  }, [factures, paiements]);

  const totalEncaisse = paiements.reduce((s, p) => s + Number(p.montant), 0);
  const totalAttente = factures.filter(f => f.statut === "envoyee").reduce((s, f) => s + Number(f.solde_restant), 0);
  const totalRetard = factures.filter(f => f.statut === "impayee").reduce((s, f) => s + Number(f.solde_restant), 0);

  const impayes = useMemo(() => {
    return factures
      .filter(f => f.statut === "impayee" && Number(f.solde_restant) > 0)
      .map(f => {
        const jours = differenceInDays(new Date(), new Date(f.date_echeance));
        let couleur: "success" | "warning" | "destructive" = "success";
        if (jours > 30) couleur = "destructive";
        else if (jours > 15) couleur = "warning";
        return { ...f, joursRetard: jours, couleur };
      })
      .sort((a, b) => b.joursRetard - a.joursRetard);
  }, [factures]);

  const handleRelanceJarvis = (factureId: string, numero: string) => {
    toast.info(`Relance Jarvis en préparation pour la facture ${numero}…`);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8 space-y-4 max-w-5xl mx-auto">
        <div className="skeleton-shimmer h-8 w-48 rounded-lg" />
        <div className="skeleton-shimmer h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-h1 font-display animate-fade-up">Suivi financier</h1>

      <Tabs defaultValue={defaultTab} className="animate-fade-up-1">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="chantier" className="touch-target text-xs sm:text-sm gap-1">
            <HardHat className="w-4 h-4 hidden sm:block" /> Par chantier
          </TabsTrigger>
          <TabsTrigger value="tresorerie" className="touch-target text-xs sm:text-sm gap-1">
            <TrendingUp className="w-4 h-4 hidden sm:block" /> Trésorerie
          </TabsTrigger>
          <TabsTrigger value="impayes" className="touch-target text-xs sm:text-sm gap-1">
            <AlertTriangle className="w-4 h-4 hidden sm:block" /> Impayés
          </TabsTrigger>
          <TabsTrigger value="achats" className="touch-target text-xs sm:text-sm gap-1">
            <ShoppingCart className="w-4 h-4 hidden sm:block" /> Achats
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chantier" className="space-y-4 mt-4">
          {chantierStats.length === 0 ? (
            <div className="forge-card text-center py-8"><p className="text-muted-foreground">Aucun chantier trouvé</p></div>
          ) : (
            chantierStats.map(ch => (
              <div key={ch.id} className="forge-card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold text-foreground">{ch.nom}</h3>
                  <Badge variant="secondary" className="text-xs">{ch.statut}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div><p className="text-xs text-muted-foreground">Budget devis</p><p className="font-mono font-semibold text-foreground">{Number(ch.budgetDevis).toLocaleString("fr-FR")} €</p></div>
                  <div><p className="text-xs text-muted-foreground">Facturé</p><p className="font-mono font-semibold text-foreground">{Number(ch.facture).toLocaleString("fr-FR")} €</p></div>
                  <div><p className="text-xs text-muted-foreground">Encaissé</p><p className="font-mono font-semibold text-success">{Number(ch.encaisse).toLocaleString("fr-FR")} €</p></div>
                  <div><p className="text-xs text-muted-foreground">Reste à facturer</p><p className="font-mono font-semibold text-warning">{Number(ch.resteAFacturer).toLocaleString("fr-FR")} €</p></div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground"><span>Progression encaissement</span><span>{Math.round(ch.progression)}%</span></div>
                  <Progress value={ch.progression} className="h-2" />
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="tresorerie" className="space-y-4 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="forge-card text-center"><p className="text-xs text-muted-foreground mb-1">Encaissé</p><p className="text-lg font-mono font-bold text-success">{totalEncaisse.toLocaleString("fr-FR")} €</p></div>
            <div className="forge-card text-center"><p className="text-xs text-muted-foreground mb-1">En attente</p><p className="text-lg font-mono font-bold text-warning">{totalAttente.toLocaleString("fr-FR")} €</p></div>
            <div className="forge-card text-center"><p className="text-xs text-muted-foreground mb-1">En retard</p><p className="text-lg font-mono font-bold text-destructive">{totalRetard.toLocaleString("fr-FR")} €</p></div>
          </div>
          <div className="forge-card">
            <h3 className="font-display font-semibold mb-4">CA sur 12 mois glissants</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tresorerieData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `${v.toLocaleString("fr-FR")} €`} />
                  <Bar dataKey="encaisse" name="Encaissé" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="attente" name="En attente" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="retard" name="En retard" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="forge-card">
            <h3 className="font-display font-semibold mb-2">Prévisionnel</h3>
            <p className="text-sm text-muted-foreground">
              Basé sur les devis signés en cours : <span className="font-mono font-semibold text-primary">
                {devis.filter(d => d.statut === "signe").reduce((s, d) => s + Number(d.montant_ht), 0).toLocaleString("fr-FR")} €
              </span> de CA à venir.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="impayes" className="space-y-4 mt-4">
          {impayes.length === 0 ? (
            <div className="forge-card text-center py-8"><p className="text-muted-foreground">🎉 Aucun impayé — bravo !</p></div>
          ) : (
            <div className="forge-card overflow-hidden p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facture</TableHead>
                    <TableHead>Montant dû</TableHead>
                    <TableHead>Retard</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {impayes.map(f => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-sm">{f.numero}</TableCell>
                      <TableCell className="font-mono font-semibold">{Number(f.solde_restant).toLocaleString("fr-FR")} €</TableCell>
                      <TableCell>
                        <Badge className={f.couleur === "destructive" ? "bg-destructive/10 text-destructive" : f.couleur === "warning" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}>
                          {f.joursRetard}j
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" className="touch-target gap-1 text-xs" onClick={() => handleRelanceJarvis(f.id, f.numero)}>
                          <Bot className="w-3.5 h-3.5" /> Relancer
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="achats" className="space-y-4 mt-4">
          <div className="forge-card text-center py-12">
            <ShoppingCart className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-display font-semibold text-foreground mb-1">Suivi des achats</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Connectez vos fournisseurs dans <strong>Paramètres &gt; Intégrations</strong> pour suivre vos commandes et comparer les prix en temps réel.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
