import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Undo2, Check, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AvoirData {
  facture_id: string;
  facture_numero?: string;
  devis_id?: string;
  description: string;
  montant_ht: number;
}

export function parseAvoirData(text: string): AvoirData | null {
  const match = text.match(/<!--AVOIR_DATA\s*([\s\S]*?)\s*AVOIR_DATA-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export function stripAvoirData(text: string): string {
  return text.replace(/<!--AVOIR_DATA[\s\S]*?AVOIR_DATA-->/g, "").trim();
}

interface Props {
  data: AvoirData;
  onCreated: () => void;
}

export default function AvoirCreationForm({ data, onCreated }: Props) {
  const { user } = useAuth();
  const [description, setDescription] = useState(data.description);
  const [montantHT, setMontantHT] = useState(data.montant_ht);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    if (!data.facture_id) { toast.error("Identifiant de la facture manquant — précisez la facture concernée"); return; }
    if (!description.trim()) { toast.error("La description de l'avoir est obligatoire"); return; }
    if (montantHT <= 0) { toast.error("Le montant de l'avoir doit être positif"); return; }

    setSaving(true);
    try {
      const numero = `AV-${Date.now().toString(36).toUpperCase()}`;

      const { error: avErr } = await supabase
        .from("avoirs")
        .insert({
          artisan_id: user.id,
          facture_id: data.facture_id || null,
          devis_id: data.devis_id || null,
          numero,
          description: description.trim(),
          montant_ht: montantHT,
          tva: 20,
          statut: "brouillon",
        } as any);

      if (avErr) throw new Error(`Avoir: ${avErr.message}`);

      toast.success(`Avoir ${numero} créé !`);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 my-2 animate-fade-up">
      {!data.facture_id && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Aucune facture identifiée — précisez le numéro de facture pour continuer.
        </div>
      )}

      <Card className="border-rose-500/30 bg-rose-500/5">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Undo2 className="w-3.5 h-3.5 text-rose-500" />
            Avoir{data.facture_numero ? ` — facture ${data.facture_numero}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div>
            <Label className="text-[10px]">Description *</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} className="h-8 text-xs" placeholder="Ex : Avoir pour prestation non réalisée" />
          </div>
          <div>
            <Label className="text-[10px]">Montant HT à créditer (€) *</Label>
            <Input
              type="number"
              value={montantHT}
              onChange={e => setMontantHT(parseFloat(e.target.value) || 0)}
              className="h-8 text-xs"
              min={0}
            />
          </div>
          {montantHT > 0 && (
            <div className="pt-1 border-t space-y-0.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>TVA (20%)</span>
                <span>-{(montantHT * 0.2).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-rose-600">
                <span>Total TTC à créditer</span>
                <span>-{(montantHT * 1.2).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={saving || !data.facture_id} className="w-full bg-gradient-to-r from-rose-500 to-pink-600 text-white">
        {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création…</> : <><Check className="w-4 h-4 mr-2" /> Créer l'avoir</>}
      </Button>
    </div>
  );
}
