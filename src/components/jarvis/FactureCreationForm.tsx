import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, Trash2, Plus, Check, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateDocumentNumber } from "@/lib/generateDocumentNumber";

export interface FactureData {
  devis_id: string;
  devis_numero?: string;
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

interface Props {
  data: FactureData;
  onCreated: (factureId: string) => void;
}

export default function FactureCreationForm({ data, onCreated }: Props) {
  const { user } = useAuth();
  const [lignes, setLignes] = useState(data.lignes);
  const [saving, setSaving] = useState(false);

  const updateLigne = (i: number, field: string, value: string | number) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, idx) => idx !== i));
  const addLigne = () => setLignes(prev => [...prev, { description: "", quantite: 1, unite: "u", prix_unitaire: 0 }]);

  const totalHT = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  const handleSubmit = async () => {
    if (!user) return;
    if (!data.devis_id) { toast.error("Identifiant du devis manquant — précisez le devis à facturer"); return; }

    setSaving(true);
    try {
      const numero = await generateDocumentNumber(user.id, "facture");

      const { data: newFacture, error: facErr } = await supabase
        .from("factures")
        .insert({
          artisan_id: user.id,
          devis_id: data.devis_id,
          numero,
          montant_ht: totalHT,
          tva: 20,
          statut: "brouillon",
          date_emission: new Date().toISOString().split("T")[0],
          date_echeance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        } as any)
        .select("id")
        .single();

      if (facErr) throw new Error(`Facture: ${facErr.message}`);

      const lignesValides = lignes.filter(l => l.description.trim() || l.prix_unitaire > 0);
      if (lignesValides.length > 0) {
        await (supabase as any).from("lignes_facture").insert(
          lignesValides.map((l, i) => ({
            facture_id: newFacture.id,
            artisan_id: user.id,
            designation: l.description,
            quantite: l.quantite,
            unite: l.unite || "u",
            prix_unitaire: l.prix_unitaire,
            tva: 20,
            ordre: i + 1,
          }))
        );
      }

      toast.success(`Facture ${numero} créée !`);
      onCreated(newFacture.id);
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

      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            Facture{data.devis_numero ? ` — devis ${data.devis_numero}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-2">
          <p className="text-[10px] text-muted-foreground">Vérifiez et ajustez les lignes à facturer :</p>
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
            Lignes de la facture
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {lignes.map((l, i) => (
            <div key={i} className="flex gap-1.5 items-end">
              <div className="flex-1">
                <Label className="text-[10px]">Description</Label>
                <Input value={l.description} onChange={e => updateLigne(i, "description", e.target.value)} className="h-7 text-[11px]" />
              </div>
              <div className="w-14">
                <Label className="text-[10px]">Qté</Label>
                <Input type="number" value={l.quantite} onChange={e => updateLigne(i, "quantite", parseFloat(e.target.value) || 0)} className="h-7 text-[11px]" />
              </div>
              <div className="w-14">
                <Label className="text-[10px]">P.U. €</Label>
                <Input type="number" value={l.prix_unitaire} onChange={e => updateLigne(i, "prix_unitaire", parseFloat(e.target.value) || 0)} onFocus={e => { if (Number(e.target.value) === 0) e.target.value = ""; }} className="h-7 text-[11px]" />
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeLigne(i)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-full h-7 text-[11px]" onClick={addLigne}>
            <Plus className="w-3 h-3 mr-1" /> Ajouter une ligne
          </Button>
          <div className="flex justify-between items-center pt-2 border-t text-xs font-semibold">
            <span>Total HT</span>
            <span>{totalHT.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span>TVA (20%)</span>
            <span>{(totalHT * 0.2).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-emerald-600">
            <span>Total TTC</span>
            <span>{(totalHT * 1.2).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={saving || !data.devis_id} className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création…</> : <><Check className="w-4 h-4 mr-2" /> Créer la facture</>}
      </Button>
    </div>
  );
}
