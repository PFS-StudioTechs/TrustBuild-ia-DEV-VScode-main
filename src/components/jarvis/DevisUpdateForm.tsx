import { useState, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FilePen, Trash2, Plus, Check, Loader2, AlertTriangle, Layers, Percent, ArrowRight, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface DevisUpdateOperation {
  type: "delete" | "update_section" | "update";
  ligne_id: string;
  section_nom?: string;
  changes?: {
    designation?: string;
    quantite?: number;
    prix_unitaire?: number;
    unite?: string;
    section_nom?: string;
  };
}

export interface DevisUpdateData {
  devis_id: string;
  devis_numero?: string;
  tva?: number;
  lignes: Array<{
    description: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
    section?: string;
  }>;
  operations?: DevisUpdateOperation[];
}

export function parseDevisUpdateData(text: string): DevisUpdateData | null {
  const match = text.match(/<!--DEVIS_UPDATE_DATA\s*([\s\S]*?)\s*DEVIS_UPDATE_DATA-->/);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

export function stripDevisUpdateData(text: string): string {
  return text.replace(/<!--DEVIS_UPDATE_DATA[\s\S]*?DEVIS_UPDATE_DATA-->/g, "").trim();
}

interface Props {
  data: DevisUpdateData;
  onCreated: () => void;
}

export default function DevisUpdateForm({ data, onCreated }: Props) {
  const { user } = useAuth();
  const [lignes, setLignes] = useState(data.lignes ?? []);
  const [saving, setSaving] = useState(false);

  const updateLigne = (i: number, field: string, value: string | number) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, idx) => idx !== i));
  const addLigne = () => setLignes(prev => [...prev, { description: "", quantite: 1, unite: "u", prix_unitaire: 0 }]);

  const totalHT = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  const operations = data.operations ?? [];
  const hasTva = data.tva !== undefined;
  const hasOps = operations.length > 0;
  const lignesValides = lignes.filter(l => l.description.trim());
  const hasAnything = hasTva || hasOps || lignesValides.length > 0;

  const handleSubmit = async () => {
    if (!user) return;
    if (!data.devis_id) { toast.error("Identifiant du devis manquant"); return; }
    if (!hasAnything) { toast.error("Aucune modification à effectuer"); return; }

    setSaving(true);
    try {
      // 1. TVA change
      if (hasTva) {
        await (supabase as any)
          .from("devis")
          .update({ tva: data.tva })
          .eq("id", data.devis_id);
      }

      // 2. Operations on existing lines
      for (const op of operations) {
        if (op.type === "delete") {
          await (supabase as any).from("lignes_devis").delete().eq("id", op.ligne_id);
        } else if (op.type === "update_section") {
          await (supabase as any)
            .from("lignes_devis")
            .update({ section_nom: op.section_nom?.trim() || null })
            .eq("id", op.ligne_id);
        } else if (op.type === "update" && op.changes) {
          const updates: Record<string, unknown> = {};
          if (op.changes.designation !== undefined) updates.designation = op.changes.designation;
          if (op.changes.quantite !== undefined) updates.quantite = op.changes.quantite;
          if (op.changes.prix_unitaire !== undefined) updates.prix_unitaire = op.changes.prix_unitaire;
          if (op.changes.unite !== undefined) updates.unite = op.changes.unite;
          if (op.changes.section_nom !== undefined) updates.section_nom = op.changes.section_nom?.trim() || null;
          if (Object.keys(updates).length > 0) {
            await (supabase as any).from("lignes_devis").update(updates).eq("id", op.ligne_id);
          }
        }
      }

      // 3. Add new lines
      if (lignesValides.length > 0) {
        const { data: existingLignes } = await (supabase as any)
          .from("lignes_devis")
          .select("ordre")
          .eq("devis_id", data.devis_id)
          .order("ordre", { ascending: false })
          .limit(1);

        const maxOrdre = existingLignes?.[0]?.ordre ?? 0;

        await (supabase as any).from("lignes_devis").insert(
          lignesValides.map((l, i) => ({
            devis_id: data.devis_id,
            artisan_id: user.id,
            designation: l.description,
            quantite: l.quantite,
            unite: l.unite || "u",
            prix_unitaire: l.prix_unitaire,
            tva: data.tva ?? 20,
            ordre: maxOrdre + i + 1,
            section_nom: l.section?.trim() || null,
          }))
        );
      }

      // Recalculate montant_ht
      const { data: allLignes } = await (supabase as any)
        .from("lignes_devis")
        .select("quantite, prix_unitaire")
        .eq("devis_id", data.devis_id);

      const newMontantHT = (allLignes ?? []).reduce(
        (s: number, l: { quantite: number; prix_unitaire: number }) => s + l.quantite * l.prix_unitaire,
        0
      );

      await (supabase as any)
        .from("devis")
        .update({ montant_ht: Math.round(newMontantHT * 100) / 100 })
        .eq("id", data.devis_id);

      const parts: string[] = [];
      if (hasTva) parts.push(`TVA → ${data.tva}%`);
      if (operations.filter(o => o.type === "delete").length > 0)
        parts.push(`${operations.filter(o => o.type === "delete").length} ligne(s) supprimée(s)`);
      if (operations.filter(o => o.type !== "delete").length > 0)
        parts.push(`${operations.filter(o => o.type !== "delete").length} ligne(s) modifiée(s)`);
      if (lignesValides.length > 0)
        parts.push(`${lignesValides.length} ligne(s) ajoutée(s)`);

      toast.success(parts.join(" · ") + " — devis mis à jour !");
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour");
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

      <Card className="border-blue-500/30 bg-blue-500/5">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <FilePen className="w-3.5 h-3.5 text-blue-600" />
            Modification — devis{data.devis_numero ? ` ${data.devis_numero}` : ""} (brouillon)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-3">

          {/* TVA change */}
          {hasTva && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-xs">
              <Percent className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-indigo-700 dark:text-indigo-400 font-medium">
                Changement de TVA : <ArrowRight className="w-3 h-3 inline mx-0.5" /> {data.tva}%
              </span>
            </div>
          )}

          {/* Operations on existing lines */}
          {hasOps && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Opérations sur lignes existantes</p>
              {operations.map((op, i) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg border text-xs">
                  {op.type === "delete" && (
                    <><Trash2 className="w-3 h-3 text-destructive shrink-0" /><span className="text-destructive">Suppression ligne</span></>
                  )}
                  {op.type === "update_section" && (
                    <><Layers className="w-3 h-3 text-blue-600 shrink-0" /><span>Déplacement vers section <strong>{op.section_nom || "—"}</strong></span></>
                  )}
                  {op.type === "update" && (
                    <><Pencil className="w-3 h-3 text-amber-600 shrink-0" /><span>Modification de ligne</span></>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* New lines to add */}
          {(() => {
            const hasSections = lignes.some(l => l.section);
            return lignes.length > 0 ? (
              <div className="space-y-1.5">
                {lignes.length > 0 && <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Nouvelles lignes à ajouter</p>}
                {lignes.map((l, i) => {
                  const isNewSection = hasSections && l.section && (i === 0 || l.section !== lignes[i - 1].section);
                  return (
                    <Fragment key={i}>
                      {isNewSection && (
                        <div className="flex items-center gap-2 pt-1.5">
                          <div className="flex-1 h-px bg-blue-500/30" />
                          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Layers className="w-2.5 h-2.5" />{l.section}
                          </span>
                          <div className="flex-1 h-px bg-blue-500/30" />
                        </div>
                      )}
                      <div className={`flex gap-1.5 items-end ${hasSections && l.section ? "pl-2 border-l-2 border-blue-500/30" : ""}`}>
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
                    </Fragment>
                  );
                })}
              </div>
            ) : null;
          })()}

          <Button variant="outline" size="sm" className="w-full h-7 text-[11px]" onClick={addLigne}>
            <Plus className="w-3 h-3 mr-1" /> Ajouter une ligne
          </Button>

          {lignesValides.length > 0 && (
            <div className="flex justify-between items-center pt-1 border-t text-xs font-semibold">
              <span>Total ajouté HT</span>
              <span className="text-blue-600">
                +{totalHT.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={saving || !data.devis_id || !hasAnything} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        {saving
          ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mise à jour…</>
          : <><Check className="w-4 h-4 mr-2" /> Appliquer les modifications</>
        }
      </Button>
    </div>
  );
}
