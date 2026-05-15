import { useState, useEffect, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, FileText, Trash2, Plus, Check, Loader2, Users, Building2, Layers, Pencil, Package, Mic } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import AddressFields from "@/components/ui/AddressFields";
import { generateDocumentNumber } from "@/lib/generateDocumentNumber";

export interface DevisData {
  client: {
    id?: string;
    nom: string;
    prenom?: string;
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
    section?: string;
    prix_achat?: number | null;
    marge_pct?: number | null;
  }>;
  client_matches?: Array<{
    id: string;
    nom: string;
    prenom?: string;
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

type LigneState = {
  description: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  section?: string;
  fournisseur_id?: string | null;
  produit_id?: string | null;
  prix_achat?: number | null;
  marge_pct?: number | null;
};

type FournisseurRef = { id: string; nom: string };
type ProduitRef = { id: string; designation: string; reference: string | null; unite: string; prix_achat: number; prix_negocie_valeur: number | null };

const calcPV = (pa: number, marge: number) =>
  marge >= 100 ? pa * 2 : pa === 0 ? 0 : pa / (1 - marge / 100);

const calcMarge = (pv: number, pa: number) =>
  pv <= 0 ? 0 : Math.max(0, ((pv - pa) / pv) * 100);

const parsePrixFromTranscript = (transcript: string): number | null => {
  const cleaned = transcript
    .toLowerCase()
    .replace(/euros?|€/g, "")
    .replace(/virgule/g, ".")
    .replace(/,/g, ".")
    .replace(/\s+/g, "")
    .trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

interface Props {
  data: DevisData;
  onCreated: (devisId?: string) => void;
}

type ChantierOption = { id: string; nom: string };

export default function DevisCreationForm({ data, onCreated }: Props) {
  const { user } = useAuth();

  const [selectedClientId, setSelectedClientId] = useState<string | null>(data.client.id ?? null);
  const [client, setClient] = useState(data.client);
  const [lignes, setLignes] = useState<LigneState[]>(data.lignes ?? []);
  const [saving, setSaving] = useState(false);

  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingSectionValue, setEditingSectionValue] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [showSectionInput, setShowSectionInput] = useState(false);

  const [selectedChantierId, setSelectedChantierId] = useState<string | null>(data.chantier?.id ?? null);
  const [newChantierNom, setNewChantierNom] = useState(data.chantier?.nom ?? "");
  const [chantierOptions, setChantierOptions] = useState<ChantierOption[]>(
    (data.chantier_matches ?? []).map(m => ({ id: m.id, nom: m.nom }))
  );
  const [loadingChantiers, setLoadingChantiers] = useState(false);

  const [fournisseurs, setFournisseurs] = useState<FournisseurRef[]>([]);
  const [produitsCache, setProduitsCache] = useState<Record<string, ProduitRef[]>>({});
  const [pricingOpenIdx, setPricingOpenIdx] = useState<number | null>(null);
  const [listeningIdx, setListeningIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("fournisseurs")
      .select("id, nom")
      .eq("artisan_id", user.id)
      .order("nom")
      .then(({ data: rows }) => setFournisseurs((rows ?? []) as FournisseurRef[]));
  }, [user]);

  const loadProduits = async (fournisseurId: string) => {
    if (produitsCache[fournisseurId]) return;
    const { data: rows } = await (supabase as any)
      .from("produits")
      .select("id, designation, reference, unite, prix_achat, prix_negocie_valeur")
      .eq("artisan_id", user!.id)
      .eq("fournisseur_id", fournisseurId)
      .eq("actif", true)
      .in("statut_import", ["valide", "manuel"])
      .order("designation");
    setProduitsCache(prev => ({ ...prev, [fournisseurId]: (rows ?? []) as ProduitRef[] }));
  };

  const startVoicePA = (idx: number) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Reconnaissance vocale non disponible sur ce navigateur"); return; }
    const recognition = new SR();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListeningIdx(idx);
    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      const prix = parsePrixFromTranscript(transcript);
      if (prix !== null) {
        updateLignePA(idx, prix);
        toast.success(`PA enregistré : ${prix.toFixed(2)} €`);
      } else {
        toast.error(`Prix non reconnu : "${transcript}"`);
      }
      setListeningIdx(null);
    };
    recognition.onerror = () => setListeningIdx(null);
    recognition.onend = () => setListeningIdx(null);
    recognition.start();
  };

  type Match = NonNullable<DevisData["client_matches"]>[number];

  const handleSelectMatch = (match: Match | null) => {
    if (match) {
      setSelectedClientId(match.id);
      setClient(c => ({ ...c, nom: match.nom, prenom: match.prenom ?? "", email: match.email ?? "", type: (match.type as "particulier" | "pro") ?? "particulier" }));
    } else {
      setSelectedClientId(null);
    }
    setSelectedChantierId(null);
    setChantierOptions([]);
  };

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
        const dbIds = new Set(list.map(c => c.id));
        const extra = (data.chantier_matches ?? [])
          .filter(m => !dbIds.has(m.id))
          .map(m => ({ id: m.id, nom: m.nom }));
        const merged = [...list, ...extra];
        setChantierOptions(merged);
        if (!selectedChantierId && data.chantier?.id && merged.some(c => c.id === data.chantier!.id)) {
          setSelectedChantierId(data.chantier.id);
        }
      })
      .finally(() => setLoadingChantiers(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const updateLigne = (i: number, field: string, value: string | number) =>
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const updateLignePV = (i: number, pv: number) => {
    const pa = lignes[i].prix_achat ?? 0;
    const marge = parseFloat(calcMarge(pv, pa).toFixed(2));
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, prix_unitaire: pv, marge_pct: marge } : l));
  };

  const updateLigneMarge = (i: number, marge: number) => {
    const pa = lignes[i].prix_achat ?? 0;
    const pv = parseFloat(calcPV(pa, marge).toFixed(2));
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, marge_pct: marge, prix_unitaire: pv } : l));
  };

  const updateLignePA = (i: number, pa: number) => {
    const marge = lignes[i].marge_pct ?? 30;
    const pv = parseFloat(calcPV(pa, marge).toFixed(2));
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, prix_achat: pa, prix_unitaire: pv } : l));
  };

  const selectFournisseur = (i: number, fournisseurId: string | null) => {
    setLignes(prev => prev.map((l, idx) => idx === i
      ? { ...l, fournisseur_id: fournisseurId, produit_id: null, prix_achat: null }
      : l
    ));
    if (fournisseurId) loadProduits(fournisseurId);
  };

  const selectProduit = (i: number, produit: ProduitRef | null) => {
    if (!produit) {
      setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, produit_id: null, prix_achat: null } : l));
      return;
    }
    const marge = lignes[i].marge_pct ?? 30;
    const prixEffectif = produit.prix_negocie_valeur ?? produit.prix_achat;
    const pv = parseFloat(calcPV(prixEffectif, marge).toFixed(2));
    setLignes(prev => prev.map((l, idx) => idx === i
      ? {
          ...l,
          produit_id: produit.id,
          description: produit.designation,
          unite: produit.unite,
          prix_achat: prixEffectif,
          marge_pct: marge,
          prix_unitaire: pv,
        }
      : l
    ));
  };

  const removeLigne = (i: number) => {
    setLignes(prev => prev.filter((_, idx) => idx !== i));
    if (pricingOpenIdx === i) setPricingOpenIdx(null);
  };

  const lastSection = lignes.length > 0 ? lignes[lignes.length - 1].section : undefined;
  const addLigne = () => setLignes(prev => [...prev, { description: "", quantite: 1, unite: "u", prix_unitaire: 0, section: lastSection }]);

  const addLigneToSection = (section: string) =>
    setLignes(prev => [...prev, { description: "", quantite: 1, unite: "u", prix_unitaire: 0, section }]);

  const renameSection = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setLignes(prev => prev.map(l => l.section === oldName ? { ...l, section: trimmed } : l));
    setEditingSection(null);
  };

  const addSection = () => {
    const trimmed = newSectionName.trim();
    if (!trimmed) return;
    setLignes(prev => [...prev, { description: "", quantite: 1, unite: "u", prix_unitaire: 0, section: trimmed }]);
    setNewSectionName("");
    setShowSectionInput(false);
  };

  const hasSections = lignes.some(l => l.section);
  const totalHT = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
  const totalMargebrute = lignes.reduce((s, l) => {
    if (!l.prix_achat) return s;
    return s + l.quantite * (l.prix_unitaire - l.prix_achat);
  }, 0);

  const handleSubmit = async () => {
    if (!user) return;
    if (!client.nom.trim()) { toast.error("Le nom du client est obligatoire"); return; }

    setSaving(true);
    try {
      let clientId: string | null = selectedClientId;

      if (!clientId) {
        if (client.email?.trim()) {
          const { data: existing } = await supabase
            .from("clients").select("id")
            .eq("artisan_id", user.id).eq("email", client.email.trim()).maybeSingle();
          if (existing) clientId = existing.id;
        }
        if (!clientId && client.nom.trim()) {
          let query = supabase.from("clients").select("id").eq("artisan_id", user.id).eq("nom", client.nom.trim());
          if (client.prenom?.trim()) query = query.eq("prenom", client.prenom.trim());
          const { data: existing } = await query.maybeSingle();
          if (existing) clientId = existing.id;
        }
        if (!clientId) {
          const { data: newClient, error: clErr } = await supabase.from("clients").insert({
            artisan_id: user.id,
            nom: client.nom.trim(),
            prenom: client.prenom?.trim() || null,
            adresse: client.adresse || null,
            email: client.email || null,
            telephone: client.telephone || null,
            type: client.type,
          }).select("id").single();
          if (clErr) throw new Error(`Client: ${clErr.message}`);
          clientId = newClient.id;
        } else {
          await supabase.from("clients").update({
            nom: client.nom.trim(),
            prenom: client.prenom?.trim() || null,
            adresse: client.adresse || null,
            email: client.email || null,
            telephone: client.telephone || null,
          }).eq("id", clientId);
        }
      } else {
        await supabase.from("clients").update({
          adresse: client.adresse || null,
          email: client.email || null,
          telephone: client.telephone || null,
        }).eq("id", clientId);
      }

      let chantierId: string | null = selectedChantierId;

      if (!chantierId && newChantierNom.trim()) {
        const { data: newChantier, error: chErr } = await supabase.from("chantiers").insert({
          artisan_id: user.id,
          client_id: clientId,
          nom: newChantierNom.trim(),
          adresse_chantier: client.adresse || null,
          statut: "en_cours",
        }).select("id").single();
        if (chErr) throw new Error(`Chantier: ${chErr.message}`);
        chantierId = newChantier.id;
      }

      const numero = await generateDocumentNumber(user.id, "devis");
      const dateValidite = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const { data: newDevis, error: devisErr } = await supabase.from("devis").insert({
        artisan_id: user.id,
        client_id: clientId,
        chantier_id: chantierId,
        numero,
        base_numero: numero,
        version: 1,
        montant_ht: totalHT,
        tva: 20,
        statut: "brouillon",
        date_validite: dateValidite,
      } as any).select("id").single();

      if (devisErr) throw new Error(`Devis: ${devisErr.message}`);

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
            section_nom: l.section?.trim() || null,
            fournisseur_id: l.fournisseur_id ?? null,
            produit_id: l.produit_id ?? null,
            prix_achat: l.prix_achat ?? null,
            marge_pct: l.marge_pct ?? null,
          }))
        );
      }

      toast.success(`Devis ${numero} créé !`);
      onCreated(newDevis.id);
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
                  <span className="font-medium">{[match.prenom, match.nom].filter(Boolean).join(" ")}</span>
                  {match.email && <span className={`text-[10px] ${selectedClientId === match.id ? "opacity-80" : "text-muted-foreground"}`}>{match.email}</span>}
                </button>
              ))}
              {matches.length === 0 && data.client.id && (
                <button
                  type="button"
                  onClick={() => selectedClientId ? handleSelectMatch(null) : handleSelectMatch({ id: data.client.id!, nom: data.client.nom, prenom: data.client.prenom, email: data.client.email, type: data.client.type })}
                  className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                    selectedClientId ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                  }`}
                >
                  <span className="font-medium">{[data.client.prenom, data.client.nom].filter(Boolean).join(" ")}</span>
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
              <Label className="text-[10px]">Prénom</Label>
              <Input
                value={client.prenom ?? ""}
                onChange={e => setClient(c => ({ ...c, prenom: e.target.value }))}
                className="h-8 text-xs"
                disabled={!!selectedClientId}
                placeholder="Jean"
              />
            </div>
            <div>
              <Label className="text-[10px]">Nom *</Label>
              <Input
                value={client.nom}
                onChange={e => setClient(c => ({ ...c, nom: e.target.value }))}
                className="h-8 text-xs"
                disabled={!!selectedClientId}
                placeholder="Dupont"
              />
            </div>
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

      <Card className="border-muted">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            Lignes du devis
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 space-y-2">
          {lignes.map((l, i) => {
            const isNewSection = hasSections && l.section && (i === 0 || l.section !== lignes[i - 1].section);
            const isLastOfSection = hasSections && l.section && (i === lignes.length - 1 || l.section !== lignes[i + 1]?.section);
            const pricingOpen = pricingOpenIdx === i;
            const produits = l.fournisseur_id ? (produitsCache[l.fournisseur_id] ?? null) : null;
            const margebrute = (l.prix_achat != null && l.prix_achat > 0)
              ? l.quantite * (l.prix_unitaire - l.prix_achat)
              : null;

            return (
              <Fragment key={i}>
                {isNewSection && (
                  <div className="flex items-center gap-2 pt-1.5">
                    <div className="flex-1 h-px bg-primary/20" />
                    {editingSection === l.section ? (
                      <Input
                        value={editingSectionValue}
                        onChange={e => setEditingSectionValue(e.target.value)}
                        onBlur={() => renameSection(l.section!, editingSectionValue)}
                        onKeyDown={e => {
                          if (e.key === "Enter") renameSection(l.section!, editingSectionValue);
                          if (e.key === "Escape") setEditingSection(null);
                        }}
                        className="h-6 w-32 text-[11px] text-center font-semibold px-2"
                        autoFocus
                      />
                    ) : (
                      <button
                        className="group flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full hover:bg-primary/20 transition-colors"
                        onClick={() => { setEditingSection(l.section!); setEditingSectionValue(l.section!); }}
                        title="Cliquer pour renommer"
                      >
                        <Layers className="w-2.5 h-2.5" />
                        {l.section}
                        <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                    )}
                    <div className="flex-1 h-px bg-primary/20" />
                  </div>
                )}

                <div className={`space-y-1 ${hasSections && l.section ? "pl-2 border-l-2 border-primary/20" : ""}`}>
                  {/* Main row */}
                  <div className="flex gap-1.5 items-end">
                    <div className="flex-1">
                      <Label className="text-[10px]">Description</Label>
                      <Input value={l.description} onChange={e => updateLigne(i, "description", e.target.value)} className="h-7 text-[11px]" />
                    </div>
                    <div className="w-14">
                      <Label className="text-[10px]">Qté</Label>
                      <Input type="number" value={l.quantite} onChange={e => updateLigne(i, "quantite", parseFloat(e.target.value) || 0)} className="h-7 text-[11px]" />
                    </div>
                    <div className="w-20">
                      <Label className="text-[10px]">PV HT (€)</Label>
                      <Input
                        type="number"
                        value={l.prix_unitaire}
                        onChange={e => updateLignePV(i, parseFloat(e.target.value) || 0)}
                        onFocus={e => { if (Number(e.target.value) === 0) e.target.value = ""; }}
                        className="h-7 text-[11px]"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 shrink-0 transition-colors ${pricingOpen ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                      onClick={() => setPricingOpenIdx(pricingOpen ? null : i)}
                      title="Tarification fournisseur"
                    >
                      <Package className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeLigne(i)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Pricing panel */}
                  {pricingOpen && (
                    <div className="bg-muted/30 border border-primary/10 rounded-lg p-2.5 space-y-2">
                      {fournisseurs.length > 0 && (
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <Label className="text-[10px]">Fournisseur</Label>
                            <Select
                              value={l.fournisseur_id ?? ""}
                              onValueChange={v => selectFournisseur(i, v || null)}
                            >
                              <SelectTrigger className="h-7 text-[11px]">
                                <SelectValue placeholder="— choisir —" />
                              </SelectTrigger>
                              <SelectContent>
                                {fournisseurs.map(f => (
                                  <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {l.fournisseur_id && (
                            <div className="flex-1">
                              <Label className="text-[10px]">Produit catalogue</Label>
                              <Select
                                value={l.produit_id ?? ""}
                                onValueChange={v => {
                                  const p = produits?.find(x => x.id === v) ?? null;
                                  selectProduit(i, p);
                                }}
                              >
                                <SelectTrigger className="h-7 text-[11px]">
                                  <SelectValue placeholder={produits === null ? "Chargement…" : "— choisir —"} />
                                </SelectTrigger>
                                <SelectContent>
                                  {produits === null || produits.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">
                                      {produits === null ? "Chargement…" : "Aucun produit validé dans ce catalogue"}
                                    </div>
                                  ) : (
                                    produits.map(p => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.reference ? `[${p.reference}] ` : ""}{p.designation}
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex gap-2 items-end flex-wrap">
                        <div>
                          <Label className="text-[10px]">PA HT (€)</Label>
                          <div className="flex gap-1 items-center">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.prix_achat ?? ""}
                              placeholder="0.00"
                              onChange={e => updateLignePA(i, parseFloat(e.target.value) || 0)}
                              className="h-7 text-[11px] w-20"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              className={`h-7 w-7 shrink-0 transition-all ${listeningIdx === i ? "animate-pulse bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600" : "text-muted-foreground"}`}
                              onClick={() => startVoicePA(i)}
                              title="Dicter le prix d'achat"
                            >
                              <Mic className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="w-24">
                          <Label className="text-[10px]">Marge (%)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="99.9"
                            step="0.1"
                            value={l.marge_pct != null ? l.marge_pct.toFixed(1) : ""}
                            placeholder="30.0"
                            onChange={e => updateLigneMarge(i, parseFloat(e.target.value) || 0)}
                            className="h-7 text-[11px]"
                          />
                        </div>
                        {margebrute !== null && (
                          <p className="text-[10px] text-emerald-600 font-medium pb-1">
                            Marge brute : {margebrute.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {isLastOfSection && (
                  <button
                    className="ml-2 text-[10px] text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5"
                    onClick={() => addLigneToSection(l.section!)}
                  >
                    <Plus className="w-2.5 h-2.5" /> Ligne dans « {l.section} »
                  </button>
                )}
              </Fragment>
            );
          })}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px]" onClick={addLigne}>
              <Plus className="w-3 h-3 mr-1" /> Ajouter une ligne
            </Button>
            {!showSectionInput ? (
              <Button variant="ghost" size="sm" className="h-7 text-[11px] text-primary/70 hover:text-primary" onClick={() => setShowSectionInput(true)}>
                <Layers className="w-3 h-3 mr-1" /> Nouvelle section
              </Button>
            ) : (
              <div className="flex gap-1 flex-1">
                <Input
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") addSection(); if (e.key === "Escape") { setShowSectionInput(false); setNewSectionName(""); } }}
                  placeholder="Nom de la section"
                  className="h-7 text-[11px] flex-1"
                  autoFocus
                />
                <Button size="sm" className="h-7 px-2 text-[11px]" onClick={addSection} disabled={!newSectionName.trim()}>
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t text-xs font-semibold">
            <span>Total HT</span>
            <span>{totalHT.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
          </div>
          {totalMargebrute > 0 && (
            <div className="flex justify-between items-center text-xs text-emerald-600">
              <span>Marge brute totale</span>
              <span>{totalMargebrute.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
            </div>
          )}
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
