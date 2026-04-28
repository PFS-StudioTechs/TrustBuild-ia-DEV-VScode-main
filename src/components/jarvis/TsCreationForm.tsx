import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Trash2, Plus, Check, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateDocumentNumber } from "@/lib/generateDocumentNumber";

export interface TsData {
  devis_id: string;
  devis_numero?: string;
  description: string;
  lignes: Array<{
    description: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
  }>;
}

export function parseTsData(text: string): TsData | null {
  const match = text.match(/<!--TS_DATA\s*([\s\S]*?)\s*TS_DATA-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export function stripTsData(text: string): string {
  return text.replace(/<!--TS_DATA[\s\S]*?TS_DATA-->/g, "").trim();
}

interface Props {
  data: TsData;
  onCreated: (tsId: string) => void;
}

export default function TsCreationForm({ data, onCreated }: Props) {
  const { user } = useAuth();
  const [description, setDescription] = useState(data.description);
  const [lignes, setLignes] = useState(data.lignes);
  const [saving, setSaving] = useState(false);

  const updateLigne = (i: number, field: string, value: string | number) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, idx) => idx !== i));
  const addLigne = () => setLignes(prev => [...prev, { description: "", quantite: 1, unite: "u", prix_unitaire: 0 }]);

  const totalHT = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  const handleSubmit = async () => {
    if (!user) return;
    if (!data.devis_id) { toast.error("Identifiant du devis manquant — précisez le devis concerné"); return; }
    if (!description.trim()) { toast.error("La description des TS est obligatoire"); return; }

    setSaving(true);
    try {
      const numero = await generateDocumentNumber(user.id, "ts");

      const { data: newTs, error: tsErr } = await (supabase as any)
        .from("travaux_supplementaires")
        .insert({
          artisan_id: user.id,
          devis_id: data.devis_id,
          numero,
          description: description.trim(),
          montant_ht: totalHT,
          statut: "brouillon",
          date: new Date().toISOString().split("T")[0],
        })
        .select("id")
        .single();

      if (tsErr) throw new Error(`TS: ${tsErr.message}`);

      const lignesValides = lignes.filter(l => l.description.trim() || l.prix_unitaire > 0);
      if (lignesValides.length > 0) {
        await (supabase as any).from("lignes_ts").insert(
          lignesValides.map((l, i) => ({
            ts_id: newTs.id,
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

      toast.success(`TS ${numero} créé !`);
      onCreated(newTs.id);
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

      <Card className="border-orange-500/30 bg-orange-500/5">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-orange-500" />
            Travaux supplémentaires{data.devis_numero ? ` — devis ${data.devis_numero}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div>
            <Label className="text-[10px]">Description *</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} className="h-8 text-xs" placeholder="Ex : Remplacement siphon de sol demandé par le client" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-muted">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
            Lignes des TS
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
                <Input type="number" value={l.prix_unitaire} onChange={e => updateLigne(i, "prix_unitaire", parseFloat(e.target.value) || 0)} className="h-7 text-[11px]" />
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
            <span>Total HT TS</span>
            <span className="text-orange-600">
              +{totalHT.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
            </span>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={saving || !data.devis_id} className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white">
        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création…</> : <><Check className="w-4 h-4 mr-2" /> Créer les travaux supplémentaires</>}
      </Button>
    </div>
  );
}
