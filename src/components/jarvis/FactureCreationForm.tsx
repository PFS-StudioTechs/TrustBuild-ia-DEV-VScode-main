import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, Check, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateDocumentNumber } from "@/lib/generateDocumentNumber";

export interface FactureData {
  devis_id: string;
  devis_numero?: string;
  is_acompte?: boolean;
  lignes: Array<{
    description: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
    section?: string;
  }>;
}

export function parseFactureData(text: string): FactureData | null {
  const match = text.match(/<!--FACTURE_DATA\s*([\s\S]*?)\s*FACTURE_DATA-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export function stripFactureData(text: string): string {
  return text.replace(/<!--FACTURE_DATA[\s\S]*?FACTURE_DATA-->/g, "").trim();
}

interface LigneDevis {
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  tva: number;
  ordre: number;
  section_nom: string | null;
}

interface DevisCtx {
  montantAjusteHT: number;
  tva: number;
  acomptesEncaisses: number;
  lignesDevis: LigneDevis[];
}

interface Props {
  data: FactureData;
  onCreated: (factureId: string) => void;
}

const fmt = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export default function FactureCreationForm({ data, onCreated }: Props) {
  const { user } = useAuth();
  const [ctx, setCtx] = useState<DevisCtx | null>(null);
  const [loadingCtx, setLoadingCtx] = useState(!!data.devis_id);
  const [acompteTTC, setAcompteTTC] = useState("");
  const [dateEcheance, setDateEcheance] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0];
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data.devis_id) { setLoadingCtx(false); return; }
    (async () => {
      try {
        const [devisRes, lignesRes, avenantRes, avoirRes, acompteRes] = await Promise.all([
          supabase.from("devis").select("montant_ht, tva").eq("id", data.devis_id).single(),
          (supabase as any).from("lignes_devis").select("designation,quantite,unite,prix_unitaire,tva,ordre,section_nom").eq("devis_id", data.devis_id).order("ordre"),
          supabase.from("avenants").select("montant_ht").eq("devis_id", data.devis_id),
          (supabase as any).from("avoirs").select("montant_ht").eq("devis_id", data.devis_id),
          supabase.from("acomptes").select("montant, statut").eq("devis_id", data.devis_id),
        ]);
        const devis = devisRes.data;
        if (!devis) return;

        const totalAvenantHT = (avenantRes.data ?? []).reduce((s: number, a: any) => s + Number(a.montant_ht), 0);
        const totalAvoirHT = (avoirRes.data ?? []).reduce((s: number, a: any) => s + Number(a.montant_ht), 0);
        const montantAjusteHT = Number(devis.montant_ht) + totalAvenantHT - totalAvoirHT;
        const acomptesEncaisses = (acompteRes.data ?? [])
          .filter((a: any) => a.statut === "encaisse")
          .reduce((s: number, a: any) => s + Number(a.montant), 0);

        setCtx({ montantAjusteHT, tva: devis.tva, acomptesEncaisses, lignesDevis: lignesRes.data ?? [] });

        // Pour acompte : si Jarvis a fourni un montant TTC dans les lignes, on l'utilise comme suggestion
        if (data.is_acompte && data.lignes.length > 0 && data.lignes[0].prix_unitaire > 0) {
          setAcompteTTC(data.lignes[0].prix_unitaire.toFixed(2));
        }
      } finally {
        setLoadingCtx(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.devis_id]);

  const tva = ctx?.tva ?? 20;
  const montantAjusteHT = ctx?.montantAjusteHT ?? 0;
  const montantAjusteTTC = montantAjusteHT * (1 + tva / 100);
  const acomptesEncaisses = ctx?.acomptesEncaisses ?? 0;
  const soldeTTC = Math.max(0, montantAjusteTTC - acomptesEncaisses);
  const soldeHT = soldeTTC / (1 + tva / 100);

  const acompteTTCNum = parseFloat(acompteTTC.replace(",", ".")) || 0;
  const acompteHTNum = acompteTTCNum / (1 + tva / 100);

  const finalHT = data.is_acompte ? acompteHTNum : soldeHT;
  const finalTTC = data.is_acompte ? acompteTTCNum : soldeTTC;

  const handleSubmit = async () => {
    if (!user) return;
    if (!data.devis_id) { toast.error("Identifiant du devis manquant — précisez le devis à facturer"); return; }
    if (data.is_acompte && acompteTTCNum <= 0) { toast.error("Montant de l'acompte requis"); return; }
    if (!loadingCtx && finalTTC <= 0) { toast.error("Montant à facturer nul"); return; }

    setSaving(true);
    try {
      const numero = await generateDocumentNumber(user.id, "facture");

      const { data: newFacture, error: facErr } = await supabase
        .from("factures")
        .insert({
          artisan_id: user.id,
          devis_id: data.devis_id,
          numero,
          montant_ht: Math.round(finalHT * 100) / 100,
          tva,
          statut: "brouillon",
          solde_restant: Math.round(finalTTC * 100) / 100,
          date_echeance: dateEcheance,
        } as any)
        .select("id")
        .single();

      if (facErr) throw new Error(`Facture: ${facErr.message}`);

      const lignesDevis = ctx?.lignesDevis ?? [];

      if (data.is_acompte) {
        // Ligne unique "Acompte" pour la facture d'acompte
        await (supabase as any).from("lignes_facture").insert([{
          facture_id: newFacture.id,
          artisan_id: user.id,
          designation: `Acompte${data.devis_numero ? ` — ${data.devis_numero}` : ""}`,
          quantite: 1,
          unite: "forfait",
          prix_unitaire: Math.round(acompteHTNum * 100) / 100,
          tva,
          ordre: 1,
        }]);
        // Crée l'enregistrement acompte pour le suivi du solde
        const acompteNumero = await generateDocumentNumber(user.id, "acompte");
        await supabase.from("acomptes").insert({
          artisan_id: user.id,
          devis_id: data.devis_id,
          numero: acompteNumero,
          montant: Math.round(acompteTTCNum * 100) / 100,
          statut: "en_attente",
          date_echeance: dateEcheance,
          notes: `Lié à la facture ${numero}`,
        });
      } else if (lignesDevis.length > 0) {
        // Lignes réelles du devis avec section_nom
        await (supabase as any).from("lignes_facture").insert(
          lignesDevis.map((l, i) => ({
            facture_id: newFacture.id,
            artisan_id: user.id,
            designation: l.designation,
            quantite: l.quantite,
            unite: l.unite,
            prix_unitaire: l.prix_unitaire,
            tva: l.tva,
            ordre: l.ordre ?? i + 1,
            section_nom: l.section_nom ?? null,
          }))
        );
      } else {
        // Fallback : lignes Jarvis si aucune ligne devis trouvée
        const fallback = data.lignes.filter(l => l.description.trim());
        if (fallback.length > 0) {
          await (supabase as any).from("lignes_facture").insert(
            fallback.map((l, i) => ({
              facture_id: newFacture.id,
              artisan_id: user.id,
              designation: l.description,
              quantite: l.quantite,
              unite: l.unite || "u",
              prix_unitaire: l.prix_unitaire,
              tva,
              ordre: i + 1,
            }))
          );
        }
      }

      toast.success(`Facture ${numero} créée !`);
      onCreated(newFacture.id);

      const { data: pdfData, error: pdfErr } = await supabase.functions.invoke("generate-facturx-pdf", {
        body: { facture_id: newFacture.id },
      });
      if (pdfErr || !pdfData?.pdf_base64) {
        toast.warning("PDF FacturX non disponible — la facture a bien été créée.");
      } else {
        const blob = new Blob(
          [Uint8Array.from(atob(pdfData.pdf_base64), (c) => c.charCodeAt(0))],
          { type: "application/pdf" }
        );
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${pdfData.numero ?? numero}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 my-2 animate-fade-up">
      {!data.devis_id && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Aucun devis identifié — précisez le numéro de devis pour continuer.
        </div>
      )}

      {/* Récap financier */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            Facture{data.is_acompte ? " d'acompte" : ""}{data.devis_numero ? ` — devis ${data.devis_numero}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {loadingCtx ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Chargement du contexte financier…
            </div>
          ) : ctx ? (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Montant ajusté HT</span>
                <span className="font-mono">{fmt(montantAjusteHT)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">TVA {tva}%</span>
                <span className="font-mono">{fmt(montantAjusteHT * tva / 100)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold border-t pt-1">
                <span>Total TTC</span>
                <span className="font-mono">{fmt(montantAjusteTTC)}</span>
              </div>
              {acomptesEncaisses > 0 && (
                <>
                  <div className="flex justify-between text-xs text-amber-600">
                    <span>− Acomptes encaissés</span>
                    <span className="font-mono">{fmt(acomptesEncaisses)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-emerald-600 border-t pt-1">
                    <span>Solde restant</span>
                    <span className="font-mono">{fmt(soldeTTC)}</span>
                  </div>
                </>
              )}
              {ctx.lignesDevis.length > 0 && (
                <p className="text-[10px] text-muted-foreground pt-1">
                  {ctx.lignesDevis.length} ligne{ctx.lignesDevis.length > 1 ? "s" : ""} du devis incluse{ctx.lignesDevis.length > 1 ? "s" : ""}
                  {ctx.lignesDevis.some(l => l.section_nom) ? " (avec sections)" : ""}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">Contexte financier non disponible.</p>
          )}
        </CardContent>
      </Card>

      {/* Montant acompte si applicable */}
      {data.is_acompte && (
        <Card className="border-muted">
          <CardContent className="px-3 pb-3 pt-3 space-y-2">
            <Label className="text-[10px]">Montant de l'acompte TTC (€)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={acompteTTC}
              onChange={e => setAcompteTTC(e.target.value)}
              placeholder="Ex : 800.00"
              className="h-7 text-[11px]"
            />
            {acompteTTCNum > 0 && (
              <p className="text-[10px] text-muted-foreground">
                → HT : {fmt(acompteHTNum)} · TVA : {fmt(acompteTTCNum - acompteHTNum)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Date d'échéance */}
      <div className="space-y-1">
        <Label className="text-[10px]">Date d'échéance</Label>
        <Input
          type="date"
          value={dateEcheance}
          onChange={e => setDateEcheance(e.target.value)}
          className="h-7 text-[11px]"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={saving || !data.devis_id || loadingCtx}
        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white"
      >
        {saving
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création…</>
          : <><Check className="w-4 h-4 mr-2" /> Créer la facture{!loadingCtx && finalTTC > 0 ? ` — ${fmt(finalTTC)}` : ""}</>
        }
      </Button>
    </div>
  );
}
