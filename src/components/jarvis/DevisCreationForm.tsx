import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Building2, FileText, Trash2, Plus, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AddressFields from "@/components/ui/AddressFields";

export interface DevisData {
  client: {
    nom: string;
    adresse: string;
    email: string;
    telephone: string;
    type: "particulier" | "pro";
  };
  chantier: {
    nom: string;
    adresse: string;
    date_debut: string;
    date_fin_prevue: string;
  };
  lignes: Array<{
    description: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
  }>;
}

export function parseDevisData(text: string): DevisData | null {
  const match = text.match(/<!--DEVIS_DATA\s*([\s\S]*?)\s*DEVIS_DATA-->/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export function stripDevisData(text: string): string {
  return text.replace(/<!--DEVIS_DATA[\s\S]*?DEVIS_DATA-->/g, "").trim();
}

interface Props {
  data: DevisData;
  onCreated: () => void;
}

export default function DevisCreationForm({ data, onCreated }: Props) {
  const { user } = useAuth();
  const [client, setClient] = useState(data.client);
  const [chantier, setChantier] = useState(data.chantier);
  const [lignes, setLignes] = useState(data.lignes);
  const [saving, setSaving] = useState(false);

  const updateLigne = (i: number, field: string, value: string | number) => {
    setLignes((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));
  };

  const removeLigne = (i: number) => setLignes((prev) => prev.filter((_, idx) => idx !== i));

  const addLigne = () =>
    setLignes((prev) => [...prev, { description: "", quantite: 1, unite: "u", prix_unitaire: 0 }]);

  const totalHT = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  const handleSubmit = async () => {
    if (!user) return;
    if (!client.nom.trim()) {
      toast.error("Le nom du client est obligatoire");
      return;
    }
    if (!chantier.nom.trim()) {
      toast.error("Le nom du chantier est obligatoire");
      return;
    }

    setSaving(true);
    try {
      // 1. Create client
      const { data: newClient, error: clientErr } = await supabase
        .from("clients")
        .insert({
          artisan_id: user.id,
          nom: client.nom.trim(),
          adresse: client.adresse || null,
          email: client.email || null,
          telephone: client.telephone || null,
          type: client.type,
        })
        .select()
        .single();

      if (clientErr) throw new Error(`Client: ${clientErr.message}`);

      // 2. Create chantier
      const { data: newChantier, error: chantierErr } = await supabase
        .from("chantiers")
        .insert({
          artisan_id: user.id,
          client_id: newClient.id,
          nom: chantier.nom.trim(),
          adresse_chantier: chantier.adresse || null,
          date_debut: chantier.date_debut || null,
          date_fin_prevue: chantier.date_fin_prevue || null,
          statut: "prospect",
        })
        .select()
        .single();

      if (chantierErr) throw new Error(`Chantier: ${chantierErr.message}`);

      // 3. Create devis
      const numero = `DEV-${Date.now().toString(36).toUpperCase()}`;
      const { error: devisErr } = await supabase.from("devis").insert({
        artisan_id: user.id,
        chantier_id: newChantier.id,
        numero,
        montant_ht: totalHT,
        tva: 20,
        statut: "brouillon",
      });

      if (devisErr) throw new Error(`Devis: ${devisErr.message}`);

      toast.success(`Devis ${numero} créé avec succès !`);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 my-2 animate-fade-up">
      {/* Client */}
      <Card className="border-primary/20">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-primary" />
            Client
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Nom *</Label>
              <Input
                value={client.nom}
                onChange={(e) => setClient((c) => ({ ...c, nom: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px]">Type</Label>
              <Select
                value={client.type}
                onValueChange={(v) => setClient((c) => ({ ...c, type: v as "particulier" | "pro" }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="pro">Professionnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Adresse *</Label>
            <AddressFields
              value={client.adresse}
              onChange={(v) => setClient((c) => ({ ...c, adresse: v }))}
              required
              compact
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Téléphone</Label>
              <Input
                value={client.telephone}
                onChange={(e) => setClient((c) => ({ ...c, telephone: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px]">Email</Label>
              <Input
                value={client.email}
                onChange={(e) => setClient((c) => ({ ...c, email: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chantier */}
      <Card className="border-accent/20">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-accent" />
            Chantier
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div>
            <Label className="text-[10px]">Nom du chantier *</Label>
            <Input
              value={chantier.nom}
              onChange={(e) => setChantier((c) => ({ ...c, nom: e.target.value }))}
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-[10px]">Adresse du chantier *</Label>
            <AddressFields
              value={chantier.adresse}
              onChange={(v) => setChantier((c) => ({ ...c, adresse: v }))}
              required
              compact
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Date début</Label>
              <Input
                type="date"
                value={chantier.date_debut}
                onChange={(e) => setChantier((c) => ({ ...c, date_debut: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px]">Date fin prévue</Label>
              <Input
                type="date"
                value={chantier.date_fin_prevue}
                onChange={(e) => setChantier((c) => ({ ...c, date_fin_prevue: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lignes de devis */}
      <Card className="border-muted">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            Lignes du devis
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {lignes.map((l, i) => (
            <div key={i} className="flex gap-1.5 items-end">
              <div className="flex-1">
                <Label className="text-[10px]">Description</Label>
                <Input
                  value={l.description}
                  onChange={(e) => updateLigne(i, "description", e.target.value)}
                  className="h-7 text-[11px]"
                />
              </div>
              <div className="w-14">
                <Label className="text-[10px]">Qté</Label>
                <Input
                  type="number"
                  value={l.quantite}
                  onChange={(e) => updateLigne(i, "quantite", parseFloat(e.target.value) || 0)}
                  className="h-7 text-[11px]"
                />
              </div>
              <div className="w-14">
                <Label className="text-[10px]">P.U. €</Label>
                <Input
                  type="number"
                  value={l.prix_unitaire}
                  onChange={(e) => updateLigne(i, "prix_unitaire", parseFloat(e.target.value) || 0)}
                  className="h-7 text-[11px]"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive"
                onClick={() => removeLigne(i)}
              >
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
          <div className="flex justify-between items-center text-sm font-bold text-primary">
            <span>Total TTC</span>
            <span>{(totalHT * 1.2).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création en cours...</>
        ) : (
          <><Check className="w-4 h-4 mr-2" /> Créer le client, chantier et devis</>
        )}
      </Button>
    </div>
  );
}
