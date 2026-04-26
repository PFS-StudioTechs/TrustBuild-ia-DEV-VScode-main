import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, FileText, Trash2, Plus, Check, Loader2, Users, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AddressFields from "@/components/ui/AddressFields";

export interface DevisData {
  client: {
    id?: string;
    nom: string;
    adresse: string;
    email: string;
    telephone: string;
    type: "particulier" | "pro";
  };
  chantier?: {
    id?: string;
    nom: string;
    adresse?: string;
    date_debut?: string;
    date_fin_prevue?: string;
  } | null;
  lignes: Array<{
    description: string;
    quantite: number;
    unite: string;
    prix_unitaire: number;
  }>;
  client_matches?: Array<{
    id: string;
    nom: string;
    email: string;
    type: string;
  }>;
  chantier_matches?: Array<{
    id: string;
    nom: string;
    client_id?: string;
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

type ChantierOption = { id: string; nom: string };

export default function DevisCreationForm({ data, onCreated }: Props) {
  const { user } = useAuth();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(data.client.id ?? null);
  const [client, setClient] = useState(data.client);
  const [lignes, setLignes] = useState(data.lignes);
  const [saving, setSaving] = useState(false);

  // Chantier state
  const [selectedChantierId, setSelectedChantierId] = useState<string | null>(data.chantier?.id ?? null);
  const [newChantierNom, setNewChantierNom] = useState(data.chantier?.nom ?? "");
  const [chantierOptions, setChantierOptions] = useState<ChantierOption[]>(
    (data.chantier_matches ?? []).map(m => ({ id: m.id, nom: m.nom }))
  );
  const [loadingChantiers, setLoadingChantiers] = useState(false);

  type Match = NonNullable<DevisData["client_matches"]>[number];

  const handleSelectMatch = (match: Match | null) => {
    if (match) {
      setSelectedClientId(match.id);
      setClient(c => ({ ...c, nom: match.nom, email: match.email ?? "", type: (match.type as "particulier" | "pro") ?? "particulier" }));
    } else {
      setSelectedClientId(null);
      setClient({ ...data.client, id: undefined });
    }
    // Reset chantier selection when client changes
    setSelectedChantierId(null);
    setChantierOptions([]);
  };

  // Load chantiers from DB when a client is selected
  useEffect(() => {
    if (!selectedClientId || !user) {
      setChantierOptions((data.chantier_matches ?? []).map(m => ({ id: m.id, nom: m.nom })));
      return;
    }
    setLoadingChantiers(true);
    supabase
      .from("chantiers")
      .select("id, nom")
      .eq("artisan_id", user.id)
      .eq("client_id", selectedClientId)
      .in("statut", ["prospect", "en_cours"])
      .order("nom")
      .then(({ data: dbChantiers }) => {
        const list: ChantierOption[] = dbChantiers ?? [];
        // Merge Jarvis matches not already in DB result
        const dbIds = new Set(list.map(c => c.id));
        const extra = (data.chantier_matches ?? [])
          .filter(m => !dbIds.has(m.id))
          .map(m => ({ id: m.id, nom: m.nom }));
        const merged = [...list, ...extra];
        setChantierOptions(merged);
        // Auto-select if Jarvis already identified a chantier
        if (!selectedChantierId && data.chantier?.id && merged.some(c => c.id === data.chantier!.id)) {
          setSelectedChantierId(data.chantier.id);
        }
      })
      .finally(() => setLoadingChantiers(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const updateLigne = (i: number, field: string, value: string | number) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const removeLigne = (i: number) => setLignes(prev => prev.filter((_, idx) => idx !== i));
  const addLigne = () => setLignes(prev => [...prev, { description: "", quantite: 1, unite: "u", prix_unitaire: 0 }]);

  const totalHT = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  const handleSubmit = async () => {
    if (!user) return;
    if (!client.nom.trim()) { toast.error("Le nom du client est obligatoire"); return; }

    setSaving(true);
    try {
      // 1. Résoudre le client
      let clientId: string | null = selectedClientId;

      if (!clientId) {
        if (client.email?.trim()) {
          const { data: existing } = await supabase
            .from("clients").select("id")
            .eq("artisan_id", user.id).eq("email", client.email.trim()).maybeSingle();
          if (existing) clientId = existing.id;
        }
        if (!clientId && client.nom.trim()) {
          const { data: existing } = await supabase
            .from("clients").select("id")
            .eq("artisan_id", user.id).eq("nom", client.nom.trim()).maybeSingle();
          if (existing) clientId = existing.id;
        }
        if (!clientId) {
          const { data: newClient, error: clErr } = await supabase.from("clients").insert({
            artisan_id: user.id,
            nom: client.nom.trim(),
            adresse: client.adresse || null,
            email: client.email || null,
            telephone: client.telephone || null,
            type: client.type,
          }).select("id").single();
          if (clErr) throw new Error(`Client: ${clErr.message}`);
          clientId = newClient.id;
        }
      } else {
        await supabase.from("clients").update({
          adresse: client.adresse || null,
          email: client.email || null,
          telephone: client.telephone || null,
        }).eq("id", clientId);
      }

      // 2. Résoudre le chantier
      let chantierId: string | null = selectedChantierId;

      if (!chantierId && newChantierNom.trim()) {
        const { data: newChantier, error: chErr } = await supabase.from("chantiers").insert({
          artisan_id: user.id,
          client_id: clientId,
          nom: newChantierNom.trim(),
          adresse: client.adresse || null,
          statut: "en_cours",
        }).select("id").single();
        if (chErr) throw new Error(`Chantier: ${chErr.message}`);
        chantierId = newChantier.id;
      }

      // 3. Créer le devis
      const numero = `DEV-${Date.now().toString(36).toUpperCase()}`;
      const dateValidite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: newDevis, error: devisErr } = await supabase.from("devis").insert({
        artisan_id: user.id,
        client_id: clientId,
        chantier_id: chantierId,
        numero,
        montant_ht: totalHT,
        tva: 20,
        statut: "brouillon",
        date_validite: dateValidite,
      }).select("id").single();

      if (devisErr) throw new Error(`Devis: ${devisErr.message}`);

      // 4. Insérer les lignes
      const lignesValides = lignes.filter(l => l.description.trim() || l.prix_unitaire > 0);
      if (lignesValides.length > 0) {
        await (supabase as any).from("lignes_devis").insert(
          lignesValides.map((l, i) => ({
            devis_id: newDevis.id,
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

      toast.success(`Devis ${numero} créé !`);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    } finally {
      setSaving(false);
    }
  };

  const matches = data.client_matches ?? [];
  const hasMatches = matches.length > 0 || !!data.client.id;

  return (
    <div className="space-y-3 my-2 animate-fade-up">

      {/* Sélection client existant */}
      {hasMatches && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-accent" />
              Clients existants correspondants
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-2">
            <p className="text-[10px] text-muted-foreground">Sélectionnez un client existant ou créez-en un nouveau :</p>
            <div className="flex flex-wrap gap-1.5">
              {matches.map(match => (
                <button
                  key={match.id}
                  type="button"
                  onClick={() => handleSelectMatch(selectedClientId === match.id ? null : match)}
                  className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                    selectedClientId === match.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/50"
                  }`}
                >
                  <span className="font-medium">{match.nom}</span>
                  {match.email && <span className={`text-[10px] ${selectedClientId === match.id ? "opacity-80" : "text-muted-foreground"}`}>{match.email}</span>}
                </button>
              ))}
              {/* Cas où Jarvis a mis client.id directement sans client_matches */}
              {matches.length === 0 && data.client.id && (
                <button
                  type="button"
                  onClick={() => selectedClientId ? handleSelectMatch(null) : handleSelectMatch({ id: data.client.id!, nom: data.client.nom, email: data.client.email, type: data.client.type })}
                  className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                    selectedClientId ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                  }`}
                >
                  <span className="font-medium">{data.client.nom}</span>
                  {data.client.email && <span className="text-[10px] opacity-70">{data.client.email}</span>}
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSelectMatch(null)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                  !selectedClientId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary/50"
                }`}
              >
                <Plus className="w-3 h-3" /> Nouveau client
              </button>
            </div>
            {selectedClientId && (
              <p className="text-[10px] text-primary font-medium">✓ Client existant sélectionné</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fiche client */}
      <Card className="border-primary/20">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5 text-primary" />
            Client {selectedClientId && <span className="text-[10px] font-normal text-muted-foreground">(existant)</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Nom *</Label>
              <Input
                value={client.nom}
                onChange={e => setClient(c => ({ ...c, nom: e.target.value }))}
                className="h-8 text-xs"
                disabled={!!selectedClientId}
              />
            </div>
            <div>
              <Label className="text-[10px]">Type</Label>
              <Select
                value={client.type}
                onValueChange={v => setClient(c => ({ ...c, type: v as "particulier" | "pro" }))}
                disabled={!!selectedClientId}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="pro">Professionnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Adresse</Label>
            <AddressFields value={client.adresse} onChange={v => setClient(c => ({ ...c, adresse: v }))} compact autoNormalize={!!data.client.adresse} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Téléphone</Label>
              <Input value={client.telephone} onChange={e => setClient(c => ({ ...c, telephone: e.target.value }))} className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px]">Email</Label>
              <Input value={client.email} onChange={e => setClient(c => ({ ...c, email: e.target.value }))} className="h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chantier */}
      <Card className="border-amber-500/20">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-amber-500" />
            Chantier
            {loadingChantiers && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground ml-1" />}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {chantierOptions.length > 0 && (
            <>
              <p className="text-[10px] text-muted-foreground">Associer à un chantier existant ou en créer un nouveau :</p>
              <div className="flex flex-wrap gap-1.5">
                {chantierOptions.map(ch => (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => setSelectedChantierId(selectedChantierId === ch.id ? null : ch.id)}
                    className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                      selectedChantierId === ch.id
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-background border-border hover:border-amber-400/60"
                    }`}
                  >
                    <span className="font-medium">{ch.nom}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedChantierId(null)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                    !selectedChantierId
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-background border-border hover:border-amber-400/60"
                  }`}
                >
                  <Plus className="w-3 h-3" /> Nouveau chantier
                </button>
              </div>
            </>
          )}
          {!selectedChantierId && (
            <div>
              {chantierOptions.length > 0 && <Label className="text-[10px]">Nom du nouveau chantier</Label>}
              <Input
                value={newChantierNom}
                onChange={e => setNewChantierNom(e.target.value)}
                placeholder={chantierOptions.length === 0 ? "Nom du chantier (optionnel)" : "Ex : Rénovation salle de bain"}
                className="h-8 text-xs"
              />
            </div>
          )}
          {selectedChantierId && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">✓ Chantier existant sélectionné</p>
          )}
        </CardContent>
      </Card>

      {/* Lignes du devis */}
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

      <Button onClick={handleSubmit} disabled={saving} className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground">
        {saving ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création en cours…</>
        ) : (
          <><Check className="w-4 h-4 mr-2" /> {selectedClientId ? "Créer le devis" : "Créer le client et le devis"}</>
        )}
      </Button>
    </div>
  );
}
