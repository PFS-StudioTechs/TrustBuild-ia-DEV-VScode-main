import { useEffect, useState, useCallback, Fragment } from "react";
import { generateDocumentNumber, buildVersionedDevisNumero, NomenclatureSettings } from "@/lib/generateDocumentNumber";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2, Lock, Send,
  CheckCircle2, XCircle, Building2, FileText, AlertTriangle,
  Loader2, Users, CreditCard, Wrench, ArrowRight, Eye, Printer,
  GitBranch, RotateCcw, ClipboardList, Layers,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────

interface Client {
  id: string;
  nom: string;
  prenom: string | null;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  type: string;
}

interface LigneDevis {
  id?: string;
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  tva: number;
  ordre: number;
  section_nom?: string | null;
}

interface DevisRow {
  id: string;
  numero: string;
  statut: string;
  montant_ht: number;
  tva: number;
  date_validite: string | null;
  client_id: string | null;
  chantier_id: string | null;
  created_at: string;
  version: number;
  parent_devis_id: string | null;
  base_numero: string | null;
  client?: Client;
  lignes?: LigneDevis[];
}

interface AvenantLigne {
  id?: string;
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  tva: number;
  ordre: number;
}

interface Avenant {
  id: string;
  devis_id: string;
  numero: string | null;
  description: string;
  montant_ht: number;
  statut: string;
  date: string;
  lignes?: AvenantLigne[];
}

interface Acompte {
  id: string;
  devis_id: string;
  numero: string;
  pourcentage: number | null;
  montant: number;
  statut: string;
  date_echeance: string | null;
  date_encaissement: string | null;
  notes: string | null;
}

interface Facture {
  id: string;
  devis_id: string;
  numero: string;
  montant_ht: number;
  tva: number;
  statut: string;
  date_echeance: string;
  client_id?: string | null;
  solde_restant?: number;
}

interface Avoir {
  id: string;
  devis_id: string;
  numero: string | null;
  description: string;
  montant_ht: number;
  statut: string;
  date: string;
  lignes?: AvenantLigne[];
}

interface TravailSupplementaire {
  id: string;
  devis_id: string;
  artisan_id: string;
  numero: string | null;
  description: string;
  montant_ht: number;
  statut: string;
  date: string;
  client_id?: string | null;
  chantier_id?: string | null;
  date_validite?: string | null;
  lignes?: AvenantLigne[];
}

// ─── Helpers ────────────────────────────────────────────────

const statutColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  signe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  refuse: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  en_cours: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  remplace: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const statutLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  signe: "Signé",
  refuse: "Refusé",
  en_cours: "En cours",
  remplace: "Remplacé",
};

function calcMontantHT(lignes: LigneDevis[]) {
  return lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0);
}

function calcMontantTTC(montant_ht: number, tva: number) {
  return montant_ht * (1 + tva / 100);
}

function isExpired(date_validite: string | null) {
  if (!date_validite) return false;
  return new Date(date_validite) < new Date(new Date().toDateString());
}

// ─── Composant lignes éditables ─────────────────────────────

function LignesEditor({
  lignes,
  onChange,
  disabled,
}: {
  lignes: LigneDevis[];
  onChange: (l: LigneDevis[]) => void;
  disabled?: boolean;
}) {
  const addLigne = () =>
    onChange([...lignes, { designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: lignes.length }]);

  const updateLigne = (i: number, field: keyof LigneDevis, value: string | number) => {
    const updated = lignes.map((l, idx) => (idx === i ? { ...l, [field]: value } : l));
    onChange(updated);
  };

  const removeLigne = (i: number) => onChange(lignes.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {lignes.map((l, i) => (
        <div key={i} className="grid grid-cols-12 gap-1 items-center">
          <Input
            className="col-span-5 text-xs"
            placeholder="Désignation"
            value={l.designation}
            onChange={(e) => updateLigne(i, "designation", e.target.value)}
            disabled={disabled}
          />
          <Input
            className="col-span-2 text-xs"
            type="number"
            placeholder="Qté"
            value={l.quantite}
            onChange={(e) => updateLigne(i, "quantite", parseFloat(e.target.value) || 0)}
            disabled={disabled}
          />
          <Input
            className="col-span-1 text-xs"
            placeholder="u."
            value={l.unite}
            onChange={(e) => updateLigne(i, "unite", e.target.value)}
            disabled={disabled}
          />
          <Input
            className="col-span-2 text-xs"
            type="number"
            placeholder="P.U."
            value={l.prix_unitaire}
            onChange={(e) => updateLigne(i, "prix_unitaire", parseFloat(e.target.value) || 0)}
            disabled={disabled}
          />
          <div className="col-span-1 text-xs text-right font-mono text-muted-foreground">
            {(l.quantite * l.prix_unitaire).toFixed(2)}
          </div>
          {!disabled && (
            <button onClick={() => removeLigne(i)} className="col-span-1 text-destructive hover:opacity-80">
              <Trash2 className="w-3.5 h-3.5 mx-auto" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button type="button" variant="outline" size="sm" onClick={addLigne} className="w-full text-xs">
          <Plus className="w-3.5 h-3.5 mr-1" /> Ajouter une ligne
        </Button>
      )}
    </div>
  );
}

// ─── Dialog création/édition devis ──────────────────────────

function DevisDialog({
  open,
  onClose,
  onSaved,
  clients,
  nomenclatureSettings,
  editDevis,
  preselectedClientId,
  artisanId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clients: Client[];
  nomenclatureSettings: NomenclatureSettings;
  editDevis: DevisRow | null;
  preselectedClientId: string | null;
  artisanId: string;
}) {
  const isLocked = editDevis?.statut === "signe" || editDevis?.statut === "remplace";
  const [clientId, setClientId] = useState(preselectedClientId ?? "");
  const [newClient, setNewClient] = useState({ nom: "", prenom: "", email: "", telephone: "", adresse: "", type: "particulier" });
  const [creatingClient, setCreatingClient] = useState(false);
  const [numero, setNumero] = useState("");
  const [numeroLoading, setNumeroLoading] = useState(false);
  const [dateValidite, setDateValidite] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split("T")[0];
  });
  const [tva, setTva] = useState(20);
  const [lignes, setLignes] = useState<LigneDevis[]>([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editDevis) {
      setClientId(editDevis.client_id ?? "");
      setNumero(editDevis.numero);
      setDateValidite(editDevis.date_validite ?? "");
      setTva(editDevis.tva);
      setLignes(editDevis.lignes?.length ? editDevis.lignes : [{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
    } else {
      setClientId(preselectedClientId ?? "");
      setNumero("");
      setNumeroLoading(true);
      generateDocumentNumber(artisanId, "devis", undefined, nomenclatureSettings)
        .then(n => setNumero(n))
        .catch(() => setNumero("—"))
        .finally(() => setNumeroLoading(false));
      setDateValidite((() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })());
      setTva(20);
      setLignes([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
      setCreatingClient(false);
      setNewClient({ nom: "", prenom: "", email: "", telephone: "", adresse: "", type: "particulier" });
    }
  }, [open, editDevis, preselectedClientId, artisanId, nomenclatureSettings]);

  const filteredClients = clientSearch
    ? clients.filter(c => `${c.nom} ${c.prenom ?? ""}`.toLowerCase().includes(clientSearch.toLowerCase()))
    : clients;

  const montantHT = calcMontantHT(lignes);

  const handleSave = async () => {
    if (!clientId && !creatingClient) { toast.error("Sélectionnez ou créez un client"); return; }
    if (!numero.trim()) { toast.error("Numéro de devis requis"); return; }
    setSaving(true);
    try {
      let resolvedClientId = clientId;

      if (creatingClient) {
        if (!newClient.nom.trim()) throw new Error("Le nom du client est requis");
        const { data: c, error: cErr } = await supabase
          .from("clients")
          .insert({ artisan_id: artisanId, ...newClient })
          .select("id")
          .single();
        if (cErr) throw cErr;
        resolvedClientId = c.id;
      }

      if (editDevis && !isLocked) {
        const { error } = await supabase
          .from("devis")
          .update({ numero, date_validite: dateValidite, tva, montant_ht: montantHT, client_id: resolvedClientId })
          .eq("id", editDevis.id);
        if (error) throw error;

        await supabase.from("lignes_devis").delete().eq("devis_id", editDevis.id);
        if (lignes.length > 0) {
          await supabase.from("lignes_devis").insert(
            lignes.map((l, i) => ({ ...l, devis_id: editDevis.id, artisan_id: artisanId, ordre: i }))
          );
        }
      } else if (!editDevis) {
        const { data: d, error } = await supabase
          .from("devis")
          .insert({ artisan_id: artisanId, client_id: resolvedClientId, numero, base_numero: numero, version: 1, date_validite: dateValidite, tva, montant_ht: montantHT, statut: "brouillon" } as any)
          .select("id")
          .single();
        if (error) throw error;

        if (lignes.length > 0) {
          await supabase.from("lignes_devis").insert(
            lignes.map((l, i) => ({ ...l, devis_id: d.id, artisan_id: artisanId, ordre: i }))
          );
        }
      }

      toast.success(editDevis ? "Devis mis à jour" : "Devis créé");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editDevis ? (isLocked ? "Devis (verrouillé)" : "Modifier le devis") : "Nouveau devis"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Client */}
          {!editDevis && (
            <div className="space-y-2">
              <Label>Client</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={!creatingClient ? "default" : "outline"} onClick={() => setCreatingClient(false)}>
                  <Users className="w-3.5 h-3.5 mr-1" /> Existant
                </Button>
                <Button type="button" size="sm" variant={creatingClient ? "default" : "outline"} onClick={() => setCreatingClient(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nouveau
                </Button>
              </div>
              {!creatingClient ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Rechercher un client..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  <div className="max-h-36 overflow-y-auto border rounded-lg divide-y">
                    {filteredClients.length === 0 && (
                      <p className="text-sm text-muted-foreground p-3">Aucun client trouvé</p>
                    )}
                    {filteredClients.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setClientId(c.id); setClientSearch(""); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${clientId === c.id ? "bg-primary/10 text-primary font-medium" : ""}`}
                      >
                        {c.nom}{c.prenom ? ` ${c.prenom}` : ""} {c.email ? <span className="text-muted-foreground text-xs ml-1">— {c.email}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Nom *</Label><Input value={newClient.nom} onChange={(e) => setNewClient(p => ({ ...p, nom: e.target.value }))} /></div>
                  <div><Label className="text-xs">Prénom</Label><Input value={newClient.prenom} onChange={(e) => setNewClient(p => ({ ...p, prenom: e.target.value }))} /></div>
                  <div><Label className="text-xs">Email</Label><Input value={newClient.email} onChange={(e) => setNewClient(p => ({ ...p, email: e.target.value }))} /></div>
                  <div><Label className="text-xs">Téléphone</Label><Input value={newClient.telephone} onChange={(e) => setNewClient(p => ({ ...p, telephone: e.target.value }))} /></div>
                  <div className="col-span-2"><Label className="text-xs">Adresse</Label><Input value={newClient.adresse} onChange={(e) => setNewClient(p => ({ ...p, adresse: e.target.value }))} /></div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={newClient.type} onValueChange={(v) => setNewClient(p => ({ ...p, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="particulier">Particulier</SelectItem>
                        <SelectItem value="pro">Professionnel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Méta devis */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Numéro</Label>
              <div className="relative">
                <Input value={numeroLoading ? "" : numero} readOnly disabled className="font-mono bg-muted/40" />
                {numeroLoading && (
                  <div className="absolute inset-y-0 left-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Génération…
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TVA %</Label>
              <Select value={String(tva)} onValueChange={(v) => setTva(parseFloat(v))} disabled={isLocked}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5.5">5,5 %</SelectItem>
                  <SelectItem value="10">10 %</SelectItem>
                  <SelectItem value="20">20 %</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Date de validité</Label>
              <Input type="date" value={dateValidite} onChange={(e) => setDateValidite(e.target.value)} disabled={isLocked} />
            </div>
          </div>

          {/* Lignes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lignes</Label>
              <span className="text-xs text-muted-foreground">HT : <strong className="text-foreground">{montantHT.toFixed(2)} €</strong> | TTC : <strong className="text-foreground">{calcMontantTTC(montantHT, tva).toFixed(2)} €</strong></span>
            </div>
            <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground px-0.5">
              <span className="col-span-5">Désignation</span>
              <span className="col-span-2">Qté</span>
              <span className="col-span-1">U.</span>
              <span className="col-span-2">P.U. €</span>
              <span className="col-span-2 text-right">Total</span>
            </div>
            <LignesEditor lignes={lignes} onChange={setLignes} disabled={isLocked} />
          </div>

          {!isLocked && (
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editDevis ? "Enregistrer" : "Créer le devis"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog avenant (lignes uniquement, pas de %) ───────────

function AvenantDialog({
  open,
  onClose,
  onSaved,
  devisId,
  devisNumero,
  artisanId,
  nomenclatureSettings,
  editAvenant,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  devisId: string;
  devisNumero: string;
  artisanId: string;
  nomenclatureSettings: NomenclatureSettings;
  editAvenant: Avenant | null;
}) {
  const [description, setDescription] = useState("");
  const [lignes, setLignes] = useState<AvenantLigne[]>([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editAvenant) {
      setDescription(editAvenant.description);
      setLignes(editAvenant.lignes?.length ? editAvenant.lignes : [{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
    } else {
      setDescription("");
      setLignes([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
    }
  }, [open, editAvenant]);

  const montantHT = calcMontantHT(lignes);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editAvenant) {
        await supabase.from("avenants").update({ description, montant_ht: montantHT }).eq("id", editAvenant.id);
        await supabase.from("lignes_avenant").delete().eq("avenant_id", editAvenant.id);
        if (lignes.length > 0) {
          await supabase.from("lignes_avenant").insert(
            lignes.map((l, i) => ({ ...l, avenant_id: editAvenant.id, artisan_id: artisanId, ordre: i }))
          );
        }
      } else {
        const numero = await generateDocumentNumber(artisanId, "avenant", undefined, nomenclatureSettings);
        const { data: av, error } = await supabase
          .from("avenants")
          .insert({ artisan_id: artisanId, devis_id: devisId, numero, description, montant_ht: montantHT, statut: "brouillon", date: new Date().toISOString().split("T")[0] })
          .select("id")
          .single();
        if (error) throw error;
        if (lignes.length > 0) {
          await supabase.from("lignes_avenant").insert(
            lignes.map((l, i) => ({ ...l, avenant_id: av.id, artisan_id: artisanId, ordre: i }))
          );
        }
      }
      toast.success(editAvenant ? "Avenant mis à jour" : "Avenant créé");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editAvenant ? "Modifier l'avenant" : `Nouvel avenant sur ${devisNumero}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Objet / description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : Ajout éclairage salle de bain" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lignes</Label>
              <span className="text-xs text-muted-foreground">Total HT : <strong className="text-foreground">{montantHT.toFixed(2)} €</strong></span>
            </div>
            <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground">
              <span className="col-span-5">Désignation</span>
              <span className="col-span-2">Qté</span>
              <span className="col-span-1">U.</span>
              <span className="col-span-2">P.U. €</span>
              <span className="col-span-2 text-right">Total</span>
            </div>
            <LignesEditor lignes={lignes} onChange={setLignes} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editAvenant ? "Enregistrer" : "Créer l'avenant"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog avoir (note de crédit, réduction de scope) ──────

function AvoirDialog({
  open,
  onClose,
  onSaved,
  devisId,
  devisNumero,
  artisanId,
  nomenclatureSettings,
  editAvoir,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  devisId: string;
  devisNumero: string;
  artisanId: string;
  nomenclatureSettings: NomenclatureSettings;
  editAvoir: Avoir | null;
}) {
  const [description, setDescription] = useState("");
  const [lignes, setLignes] = useState<AvenantLigne[]>([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editAvoir) {
      setDescription(editAvoir.description);
      setLignes(editAvoir.lignes?.length ? editAvoir.lignes : [{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
    } else {
      setDescription("");
      setLignes([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
    }
  }, [open, editAvoir]);

  const montantHT = calcMontantHT(lignes);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editAvoir) {
        await supabase.from("avoirs").update({ description, montant_ht: montantHT }).eq("id", editAvoir.id);
        await (supabase as any).from("lignes_avoir").delete().eq("avoir_id", editAvoir.id);
        if (lignes.length > 0) {
          await (supabase as any).from("lignes_avoir").insert(
            lignes.map((l, i) => ({ ...l, avoir_id: editAvoir.id, artisan_id: artisanId, ordre: i }))
          );
        }
      } else {
        const numero = await generateDocumentNumber(artisanId, "avoir", undefined, nomenclatureSettings);
        const { data: av, error } = await (supabase as any)
          .from("avoirs")
          .insert({ artisan_id: artisanId, devis_id: devisId, numero, description, montant_ht: montantHT, statut: "brouillon", date: new Date().toISOString().split("T")[0] })
          .select("id")
          .single();
        if (error) throw error;
        if (lignes.length > 0) {
          await (supabase as any).from("lignes_avoir").insert(
            lignes.map((l, i) => ({ ...l, avoir_id: av.id, artisan_id: artisanId, ordre: i }))
          );
        }
      }
      toast.success(editAvoir ? "Avoir mis à jour" : "Avoir créé");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editAvoir ? "Modifier l'avoir" : `Nouvel avoir sur ${devisNumero}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 p-2 text-xs text-amber-700 dark:text-amber-400">
            Un avoir réduit le montant total de la facture finale (ex : poste retiré, remise accordée).
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objet / description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex : Retrait poste peinture" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lignes à déduire</Label>
              <span className="text-xs text-muted-foreground">Déduction HT : <strong className="text-destructive">−{montantHT.toFixed(2)} €</strong></span>
            </div>
            <div className="grid grid-cols-12 gap-1 text-[10px] text-muted-foreground">
              <span className="col-span-5">Désignation</span>
              <span className="col-span-2">Qté</span>
              <span className="col-span-1">U.</span>
              <span className="col-span-2">P.U. €</span>
              <span className="col-span-2 text-right">Total</span>
            </div>
            <LignesEditor lignes={lignes} onChange={setLignes} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editAvoir ? "Enregistrer" : "Créer l'avoir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog création facture ─────────────────────────────────

// ─── Sheet détail facture ────────────────────────────────────────────────────
function FactureCard({
  facture,
  clientNom,
  devisNumero,
  onRefresh,
}: {
  facture: Facture;
  clientNom: string;
  devisNumero: string;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [pdfHtml, setPdfHtml] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [updatingStatut, setUpdatingStatut] = useState(false);
  const [lignes, setLignes] = useState<AvenantLigne[] | null>(null);
  const [lignesLoading, setLignesLoading] = useState(false);

  const montantTTC = facture.montant_ht * (1 + facture.tva / 100);

  const badgeCn = (s: string) =>
    s === "payee" ? "bg-emerald-100 text-emerald-700" :
    s === "impayee" ? "bg-red-100 text-red-700" :
    s === "envoyee" ? "bg-blue-100 text-blue-700" :
    s === "annulee" ? "bg-gray-100 text-gray-400" :
    "bg-muted text-muted-foreground";

  const badgeLabel = (s: string) => ({ payee: "Payée", impayee: "Impayée", envoyee: "Envoyée", brouillon: "Brouillon", annulee: "Annulée" }[s] ?? s);

  const openPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pdfHtml) { setPdfOpen(true); return; }
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf-html", {
        body: { type: "facture", facture_id: facture.id },
      });
      if (error) throw new Error(error.message ?? "Erreur");
      if (!data?.html) throw new Error("Réponse vide");
      setPdfHtml(data.html);
      setPdfOpen(true);
    } catch (err: any) {
      toast.error("Erreur PDF : " + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const loadLignes = async () => {
    if (lignes !== null) return;
    setLignesLoading(true);
    try {
      const { data } = await (supabase as any)
        .from("lignes_facture")
        .select("designation,quantite,unite,prix_unitaire,tva,ordre")
        .eq("facture_id", facture.id)
        .order("ordre");
      setLignes(data ?? []);
    } catch {
      setLignes([]);
    } finally {
      setLignesLoading(false);
    }
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadLignes();
  };

  const changeStatut = async (newStatut: string) => {
    setUpdatingStatut(true);
    try {
      const { error } = await supabase.from("factures").update({ statut: newStatut }).eq("id", facture.id);
      if (error) throw error;
      toast.success("Statut mis à jour");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingStatut(false);
    }
  };

  const deleteFacture = async () => {
    try {
      await (supabase as any).from("lignes_facture").delete().eq("facture_id", facture.id);
      const { error } = await supabase.from("factures").delete().eq("id", facture.id);
      if (error) throw error;
      toast.success(`Facture ${facture.numero} supprimée`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className={`forge-card space-y-0 p-0 overflow-hidden ${facture.statut === "annulee" ? "opacity-60" : ""}`}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={handleExpand}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm">{facture.numero}</span>
              <Badge className={`text-xs ${badgeCn(facture.statut)}`}>{badgeLabel(facture.statut)}</Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {clientNom && <span>{clientNom}</span>}
              {devisNumero && <span>Réf. {devisNumero}</span>}
              {facture.date_echeance && <span>Éch. {new Date(facture.date_echeance).toLocaleDateString("fr-FR")}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold font-mono text-sm">{montantTTC.toFixed(2)} €</div>
            <div className="text-xs text-muted-foreground">TTC</div>
          </div>
          <button
            onClick={openPdf}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Aperçu PDF"
          >
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>

        {/* Contenu étendu */}
        {expanded && (
          <div className="border-t px-4 pb-4 pt-3 space-y-4">
            {/* Actions statut */}
            <div className="flex flex-wrap gap-2">
              {facture.statut === "brouillon" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => changeStatut("envoyee")} disabled={updatingStatut}>
                    <Send className="w-3.5 h-3.5 mr-1.5" /> Marquer envoyée
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette facture ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          La facture {facture.numero} sera supprimée définitivement. Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteFacture} className="bg-destructive text-destructive-foreground">
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              {facture.statut === "envoyee" && (
                <>
                  <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-300" onClick={() => changeStatut("payee")} disabled={updatingStatut}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Marquer payée
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 border-red-300" onClick={() => changeStatut("impayee")} disabled={updatingStatut}>
                    <XCircle className="w-3.5 h-3.5 mr-1.5" /> Marquer impayée
                  </Button>
                </>
              )}
              {(facture.statut === "payee" || facture.statut === "impayee") && (
                <Button size="sm" variant="outline" onClick={() => changeStatut("envoyee")} disabled={updatingStatut}>
                  <ArrowRight className="w-3.5 h-3.5 mr-1.5" /> Remettre en envoyée
                </Button>
              )}
            </div>

            {/* Lignes */}
            {lignesLoading && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {lignes && (
              <div className="space-y-1">
                {lignes.length > 0 && (
                  <>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lignes</p>
                    <div className="space-y-1">
                      {(() => {
                        const hasSections = lignes.some(l => l.section_nom);
                        return lignes.map((l, i) => {
                          const isNewSection = hasSections && l.section_nom && (i === 0 || l.section_nom !== lignes[i - 1].section_nom);
                          return (
                            <Fragment key={i}>
                              {isNewSection && (
                                <div className="flex items-center gap-2 pt-1">
                                  <div className="flex-1 h-px bg-primary/20" />
                                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <Layers className="w-2.5 h-2.5" />{l.section_nom}
                                  </span>
                                  <div className="flex-1 h-px bg-primary/20" />
                                </div>
                              )}
                              <div className={`flex items-center justify-between text-xs ${hasSections && l.section_nom ? "pl-2" : ""}`}>
                                <span className="truncate max-w-[60%]">{l.designation || <span className="italic text-muted-foreground">—</span>}</span>
                                <span className="font-mono text-muted-foreground">{l.quantite} {l.unite} × {l.prix_unitaire.toFixed(2)} = {(l.quantite * l.prix_unitaire).toFixed(2)} €</span>
                              </div>
                            </Fragment>
                          );
                        });
                      })()}
                    </div>
                  </>
                )}
                <div className="flex justify-between text-xs font-semibold border-t pt-1">
                  <span>Total HT</span>
                  <span className="font-mono">{facture.montant_ht.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">TVA {facture.tva}%</span>
                  <span className="font-mono">{(facture.montant_ht * facture.tva / 100).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span>Total TTC</span>
                  <span className="font-mono">{montantTTC.toFixed(2)} €</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* PDF modal centré */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="font-display text-base">{facture.numero}</DialogTitle>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
              const iframe = document.getElementById(`facture-iframe-${facture.id}`) as HTMLIFrameElement | null;
              iframe?.contentWindow?.print();
            }}>
              <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            {pdfHtml ? (
              <iframe
                id={`facture-iframe-${facture.id}`}
                srcDoc={pdfHtml}
                className="w-full bg-white shadow-lg rounded-lg border"
                style={{ minHeight: "1123px" }}
                title="Aperçu facture"
              />
            ) : (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Dialog création facture ──────────────────────────────────────────────────
function FactureDialog({
  open,
  onClose,
  onSaved,
  devisId,
  clientId,
  montantAjusteHT,
  tva,
  acomptesEncaisses,
  artisanId,
  nomenclatureSettings,
  lignesDevis,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  devisId: string;
  clientId: string | null;
  montantAjusteHT: number;
  tva: number;
  acomptesEncaisses: number;
  artisanId: string;
  nomenclatureSettings: NomenclatureSettings;
  lignesDevis: LigneDevis[];
}) {
  const [dateEcheance, setDateEcheance] = useState("");
  const [saving, setSaving] = useState(false);
  const [isPartial, setIsPartial] = useState(false);
  const [montantTTCEditable, setMontantTTCEditable] = useState("");

  const montantTTC = montantAjusteHT * (1 + tva / 100);
  const soldeRestant = Math.max(0, montantTTC - acomptesEncaisses);

  useEffect(() => {
    if (!open) return;
    setDateEcheance("");
    setIsPartial(false);
    setMontantTTCEditable(soldeRestant.toFixed(2));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const montantTTCFinal = isPartial ? (parseFloat(montantTTCEditable.replace(",", ".")) || 0) : soldeRestant;
  const montantHTFinal = montantTTCFinal / (1 + tva / 100);

  const handleSave = async () => {
    if (!dateEcheance) { toast.error("Date d'échéance requise"); return; }
    if (montantTTCFinal <= 0) { toast.error("Le montant doit être supérieur à 0"); return; }
    setSaving(true);
    try {
      const numero = await generateDocumentNumber(artisanId, "facture", undefined, nomenclatureSettings);
      const { data: newFacture, error } = await supabase.from("factures").insert({
        artisan_id: artisanId,
        devis_id: devisId,
        client_id: clientId,
        numero,
        montant_ht: montantHTFinal,
        tva,
        statut: "brouillon",
        date_echeance: dateEcheance,
        solde_restant: montantTTCFinal,
      } as any).select("id").single();
      if (error) throw error;

      // Copier les lignes du devis vers lignes_facture (permet la génération PDF)
      if (newFacture?.id && lignesDevis.length > 0) {
        await (supabase as any).from("lignes_facture").insert(
          lignesDevis.map((l, i) => ({
            facture_id: newFacture.id,
            artisan_id: artisanId,
            designation: l.designation,
            quantite: l.quantite,
            unite: l.unite,
            prix_unitaire: l.prix_unitaire,
            tva: l.tva,
            ordre: l.ordre ?? i + 1,
            section_nom: l.section_nom ?? null,
          }))
        );
      }

      toast.success(`Facture ${numero} créée`);
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Émettre la facture</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Récap montants */}
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Montant ajusté HT</span>
              <span className="font-mono">{montantAjusteHT.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">TVA {tva}%</span>
              <span className="font-mono">{(montantAjusteHT * tva / 100).toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-xs font-semibold border-t pt-1.5">
              <span>Total TTC</span>
              <span className="font-mono">{montantTTC.toFixed(2)} €</span>
            </div>
            {acomptesEncaisses > 0 && (
              <>
                <div className="flex justify-between text-xs text-amber-600">
                  <span>− Acomptes encaissés</span>
                  <span className="font-mono">{acomptesEncaisses.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-primary border-t pt-1.5">
                  <span>Solde à facturer</span>
                  <span className="font-mono">{soldeRestant.toFixed(2)} €</span>
                </div>
              </>
            )}
          </div>

          {/* Choix montant : solde total vs partiel */}
          <div className="space-y-2">
            <p className="text-xs font-semibold">Montant à facturer</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setIsPartial(false); setMontantTTCEditable(soldeRestant.toFixed(2)); }}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors text-left ${!isPartial ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
              >
                Solde total<br /><span className="font-mono font-bold">{soldeRestant.toFixed(2)} €</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPartial(true)}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors text-left ${isPartial ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
              >
                Montant partiel<br /><span className="font-mono font-bold opacity-70">personnalisé</span>
              </button>
            </div>
            {isPartial && (
              <div className="space-y-1">
                <Label className="text-xs">Montant TTC (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={montantTTCEditable}
                  onChange={e => setMontantTTCEditable(e.target.value)}
                  placeholder={`Max : ${montantTTC.toFixed(2)} €`}
                />
                <p className="text-[10px] text-muted-foreground">
                  → HT : {montantHTFinal.toFixed(2)} € · TVA : {(montantTTCFinal - montantHTFinal).toFixed(2)} €
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Date d'échéance *</Label>
            <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Créer la facture — {montantTTCFinal.toFixed(2)} € TTC
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog acompte ─────────────────────────────────────────

function AcompteDialog({
  open,
  onClose,
  onSaved,
  devisId,
  devisMontantHT,
  devisTva,
  artisanId,
  nomenclatureSettings,
  acomptesExistants,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  devisId: string;
  devisMontantHT: number;
  devisTva: number;
  artisanId: string;
  nomenclatureSettings: NomenclatureSettings;
  acomptesExistants: Acompte[];
}) {
  const devisTTC = calcMontantTTC(devisMontantHT, devisTva);
  const totalAcomptesExistants = acomptesExistants.reduce((s, a) => s + a.montant, 0);
  const resteDisponible = devisTTC - totalAcomptesExistants;

  const [pourcentage, setPourcentage] = useState<number | "">(30);
  const [dateEcheance, setDateEcheance] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const montant = pourcentage !== "" ? (devisTTC * pourcentage) / 100 : 0;

  useEffect(() => {
    if (!open) return;
    setPourcentage(30);
    setDateEcheance("");
    setNotes("");
  }, [open]);

  const handleSave = async () => {
    if (!pourcentage || pourcentage <= 0 || pourcentage > 100) {
      toast.error("Pourcentage entre 1 et 100");
      return;
    }
    if (montant > resteDisponible + 0.01) {
      toast.error(`Dépasse le reste disponible (${resteDisponible.toFixed(2)} €)`);
      return;
    }
    setSaving(true);
    try {
      const numero = await generateDocumentNumber(artisanId, "acompte", undefined, nomenclatureSettings);
      const { error } = await supabase.from("acomptes").insert({
        artisan_id: artisanId,
        devis_id: devisId,
        numero,
        pourcentage: Number(pourcentage),
        montant,
        statut: "en_attente",
        date_echeance: dateEcheance || null,
        notes: notes || null,
      });
      if (error) throw error;
      toast.success("Acompte créé");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nouvel acompte</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Devis TTC</span><span className="font-mono">{devisTTC.toFixed(2)} €</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Acomptes existants</span><span className="font-mono text-amber-600">−{totalAcomptesExistants.toFixed(2)} €</span></div>
            <div className="flex justify-between font-medium"><span>Reste disponible</span><span className="font-mono">{resteDisponible.toFixed(2)} €</span></div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Pourcentage %</Label>
            <Input type="number" min={1} max={100} value={pourcentage} onChange={(e) => setPourcentage(e.target.value === "" ? "" : parseFloat(e.target.value))} />
            {pourcentage !== "" && <p className="text-xs text-muted-foreground">= <strong>{montant.toFixed(2)} €</strong> TTC</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date d'échéance</Label>
            <Input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optionnel" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Créer l'acompte
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog Travail Supplémentaire ──────────────────────────

function TsDialog({
  open, onClose, onSaved,
  devisId, devisClientId, devisChantierID, devisNumero,
  artisanId, nomenclatureSettings, editTs,
}: {
  open: boolean; onClose: () => void; onSaved: () => void;
  devisId: string; devisClientId: string | null; devisChantierID: string | null; devisNumero: string;
  artisanId: string; nomenclatureSettings: NomenclatureSettings; editTs: TravailSupplementaire | null;
}) {
  const [description, setDescription] = useState("");
  const [dateValidite, setDateValidite] = useState("");
  const [lignes, setLignes] = useState<AvenantLigne[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editTs) {
      setDescription(editTs.description);
      setDateValidite(editTs.date_validite ?? "");
      setLignes(editTs.lignes ?? []);
    } else {
      setDescription("");
      setDateValidite("");
      setLignes([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
    }
  }, [open, editTs]);

  const montantHT = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);

  const handleSave = async () => {
    if (!description.trim()) { toast.error("Description obligatoire"); return; }
    setSaving(true);
    try {
      if (editTs) {
        const { error } = await (supabase as any).from("travaux_supplementaires").update({
          description,
          montant_ht: montantHT,
          date_validite: dateValidite || null,
        }).eq("id", editTs.id);
        if (error) throw error;
        await (supabase as any).from("lignes_ts").delete().eq("ts_id", editTs.id);
        if (lignes.length > 0) {
          const { error: lErr } = await (supabase as any).from("lignes_ts").insert(
            lignes.map((l, i) => ({ ts_id: editTs.id, artisan_id: artisanId, ...l, ordre: i }))
          );
          if (lErr) throw lErr;
        }
        toast.success("TS mis à jour");
      } else {
        const numero = await generateDocumentNumber(artisanId, "ts", undefined, nomenclatureSettings);
        const { data: tsData, error } = await (supabase as any).from("travaux_supplementaires").insert({
          artisan_id: artisanId,
          devis_id: devisId,
          client_id: devisClientId,
          chantier_id: devisChantierID,
          numero,
          description,
          montant_ht: montantHT,
          statut: "brouillon",
          date: new Date().toISOString().split("T")[0],
          date_validite: dateValidite || null,
        }).select("id").single();
        if (error) throw error;
        if (lignes.length > 0) {
          const { error: lErr } = await (supabase as any).from("lignes_ts").insert(
            lignes.map((l, i) => ({ ts_id: tsData.id, artisan_id: artisanId, ...l, ordre: i }))
          );
          if (lErr) throw lErr;
        }
        toast.success(`TS ${numero} créé`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTs ? "Modifier le TS" : `Nouveau TS sur ${devisNumero}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Description *</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Travaux supplémentaires — détail" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Date de validité</Label>
            <Input type="date" value={dateValidite} onChange={e => setDateValidite(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider">Lignes</Label>
            <LignesEditor lignes={lignes} onChange={setLignes} />
          </div>
          {montantHT > 0 && (
            <div className="rounded-lg bg-muted/40 p-2 text-xs flex justify-between">
              <span className="text-muted-foreground">Total HT</span>
              <span className="font-mono font-semibold">{montantHT.toFixed(2)} €</span>
            </div>
          )}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {editTs ? "Enregistrer" : "Créer le TS"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Carte devis ─────────────────────────────────────────────

function DevisCard({
  devis,
  avenants,
  avoirs,
  acomptes,
  factures,
  ts,
  nomenclatureSettings,
  artisanId,
  onRefresh,
}: {
  devis: DevisRow;
  avenants: Avenant[];
  avoirs: Avoir[];
  acomptes: Acompte[];
  factures: Facture[];
  ts: TravailSupplementaire[];
  nomenclatureSettings: NomenclatureSettings;
  artisanId: string;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [avenantOpen, setAvenantOpen] = useState(false);
  const [editAvenant, setEditAvenant] = useState<Avenant | null>(null);
  const [avoirOpen, setAvoirOpen] = useState(false);
  const [editAvoir, setEditAvoir] = useState<Avoir | null>(null);
  const [acompteOpen, setAcompteOpen] = useState(false);
  const [factureOpen, setFactureOpen] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfHtml, setPdfHtml] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [tsOpen, setTsOpen] = useState(false);
  const [editTs, setEditTs] = useState<TravailSupplementaire | null>(null);
  const [tsFactureTargetId, setTsFactureTargetId] = useState<string | null>(null);
  const [tsFactureDateEcheance, setTsFactureDateEcheance] = useState("");
  const [tsFactureSaving, setTsFactureSaving] = useState(false);
  const [avoirRectifTargetId, setAvoirRectifTargetId] = useState<string | null>(null);
  const [avoirRectifFactureId, setAvoirRectifFactureId] = useState<string>("");
  const [avoirRectifEcheance, setAvoirRectifEcheance] = useState("");
  const [avoirRectifSaving, setAvoirRectifSaving] = useState(false);

  const openDevisPdf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf-html", {
        body: { type: "devis", devis_id: devis.id },
      });
      if (error) throw new Error(error.message ?? "Erreur génération");
      if (!data?.html) throw new Error("Réponse vide de l'edge function");
      setPdfTitle(`Devis ${devis.numero}`);
      setPdfHtml(data.html);
      setPdfOpen(true);
    } catch (err: any) {
      toast.error("Erreur PDF : " + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const isRemplace = devis.statut === "remplace";
  const isLocked = devis.statut === "signe" || isRemplace;

  const handleCreateNouvelleVersion = async () => {
    setCreatingVersion(true);
    try {
      const newVersion = (devis.version ?? 1) + 1;
      const baseNum = devis.base_numero ?? devis.numero;
      const newNumero = buildVersionedDevisNumero(baseNum, newVersion);
      const { error: remErr } = await supabase.from("devis").update({ statut: "remplace" }).eq("id", devis.id);
      if (remErr) throw remErr;

      // Récupère les lignes de la version courante pour les copier
      const { data: lignesSource } = await (supabase as any)
        .from("lignes_devis")
        .select("designation,quantite,unite,prix_unitaire,tva,ordre,section_nom")
        .eq("devis_id", devis.id)
        .order("ordre");

      const dateValidite = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })();
      const montantHT = (lignesSource ?? []).reduce((s: number, l: any) => s + l.quantite * l.prix_unitaire, 0);

      const { data: newDevis, error: createErr } = await supabase.from("devis").insert({
        artisan_id: artisanId,
        client_id: devis.client_id,
        chantier_id: devis.chantier_id,
        numero: newNumero,
        base_numero: baseNum,
        version: newVersion,
        parent_devis_id: devis.id,
        tva: devis.tva,
        montant_ht: montantHT,
        statut: "brouillon",
        date_validite: dateValidite,
      } as any).select("id").single();
      if (createErr) throw createErr;

      if (lignesSource && lignesSource.length > 0) {
        await (supabase as any).from("lignes_devis").insert(
          lignesSource.map((l: any) => ({
            ...l,
            devis_id: newDevis.id,
            artisan_id: artisanId,
          }))
        );
      }

      toast.success(`Version ${newNumero} créée avec ${lignesSource?.length ?? 0} ligne(s) copiée(s)`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setCreatingVersion(false);
    }
  };

  const handleReactiver = async () => {
    setCreatingVersion(true);
    try {
      const baseNum = devis.base_numero ?? devis.numero;
      const { data: siblings } = await supabase
        .from("devis")
        .select("id")
        .eq("artisan_id", artisanId)
        .eq("base_numero" as any, baseNum)
        .neq("id", devis.id)
        .neq("statut", "remplace");
      if (siblings && siblings.length > 0) {
        await supabase.from("devis").update({ statut: "remplace" }).in("id", siblings.map((s: any) => s.id));
      }
      await supabase.from("devis").update({ statut: "brouillon" }).eq("id", devis.id);
      toast.success("Devis réactivé");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setCreatingVersion(false);
    }
  };
  const expired = isExpired(devis.date_validite) && !isLocked;
  const montantTTC = calcMontantTTC(devis.montant_ht, devis.tva);
  const devisAvenants = avenants.filter(a => a.devis_id === devis.id);
  const devisAvoirs = avoirs.filter(a => a.devis_id === devis.id);
  const devisAcomptes = acomptes.filter(a => a.devis_id === devis.id);
  const devisFactures = factures.filter(f => f.devis_id === devis.id);
  const devisTs = ts.filter(t => t.devis_id === devis.id);
  const facturesNonAnnulees = devisFactures.filter(f => f.statut !== "annulee");

  // Calculs ajustés
  const totalAvenantHT = devisAvenants.reduce((s, a) => s + a.montant_ht, 0);
  const totalAvoirHT = devisAvoirs.reduce((s, a) => s + a.montant_ht, 0);
  const montantAjusteHT = devis.montant_ht + totalAvenantHT - totalAvoirHT;
  const montantAjusteTTC = calcMontantTTC(montantAjusteHT, devis.tva);
  const totalAcomptes = devisAcomptes.reduce((s, a) => s + a.montant, 0);
  const acomptesEncaisses = devisAcomptes.filter(a => a.statut === "encaisse").reduce((s, a) => s + a.montant, 0);

  const handleChangeStatut = async (statut: string) => {
    await supabase.from("devis").update({ statut }).eq("id", devis.id);
    toast.success(`Statut → ${statutLabels[statut] ?? statut}`);
    onRefresh();
  };

  const handleDeleteDevis = async () => {
    if (!window.confirm(`Supprimer définitivement le devis ${devis.numero} ?`)) return;
    await supabase.from("lignes_devis").delete().eq("devis_id", devis.id);
    await supabase.from("devis").delete().eq("id", devis.id);
    toast.success(`Devis ${devis.numero} supprimé`);
    onRefresh();
  };

  const handleEncaisserAcompte = async (acompteId: string) => {
    await supabase.from("acomptes").update({ statut: "encaisse", date_encaissement: new Date().toISOString() }).eq("id", acompteId);
    toast.success("Acompte marqué encaissé");
    onRefresh();
  };

  const handleDeleteAvenant = async (id: string) => {
    await supabase.from("avenants").delete().eq("id", id);
    onRefresh();
  };

  const handleSignerTs = async (tsId: string) => {
    await (supabase as any).from("travaux_supplementaires").update({ statut: "signe" }).eq("id", tsId);
    toast.success("TS signé");
    onRefresh();
  };

  const handleDeleteTs = async (tsId: string) => {
    await (supabase as any).from("lignes_ts").delete().eq("ts_id", tsId);
    await (supabase as any).from("travaux_supplementaires").delete().eq("id", tsId);
    onRefresh();
  };

  const handleGenererFactureTS = async (tsItem: TravailSupplementaire) => {
    if (!tsFactureDateEcheance) { toast.error("Date d'échéance requise"); return; }
    setTsFactureSaving(true);
    try {
      const numero = await generateDocumentNumber(artisanId, "facture", undefined, nomenclatureSettings);
      const montantTTCTs = calcMontantTTC(tsItem.montant_ht, devis.tva);
      const { data: newFacture, error } = await supabase.from("factures").insert({
        artisan_id: artisanId,
        devis_id: devis.id,
        client_id: devis.client_id,
        ts_id: tsItem.id,
        numero,
        montant_ht: tsItem.montant_ht,
        tva: devis.tva,
        statut: "brouillon",
        date_echeance: tsFactureDateEcheance,
        solde_restant: montantTTCTs,
      } as any).select("id").single();
      if (error) throw error;
      if (newFacture?.id && tsItem.lignes && tsItem.lignes.length > 0) {
        await (supabase as any).from("lignes_facture").insert(
          tsItem.lignes.map((l, i) => ({
            facture_id: newFacture.id,
            artisan_id: artisanId,
            designation: l.designation,
            quantite: l.quantite,
            unite: l.unite,
            prix_unitaire: l.prix_unitaire,
            tva: l.tva,
            ordre: l.ordre ?? i + 1,
          }))
        );
      }
      await (supabase as any).from("travaux_supplementaires").update({ statut: "facture" }).eq("id", tsItem.id);
      toast.success(`Facture ${numero} générée depuis ${tsItem.numero ?? "TS"}`);
      setTsFactureTargetId(null);
      setTsFactureDateEcheance("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setTsFactureSaving(false);
    }
  };

  const handleEmettreFactureRectif = async (avoirItem: Avoir) => {
    if (!avoirRectifFactureId) { toast.error("Sélectionnez la facture à annuler"); return; }
    if (!avoirRectifEcheance) { toast.error("Date d'échéance requise"); return; }
    setAvoirRectifSaving(true);
    try {
      const { data: lignesOrig } = await (supabase as any)
        .from("lignes_facture")
        .select("designation,quantite,unite,prix_unitaire,tva,ordre")
        .eq("facture_id", avoirRectifFactureId)
        .order("ordre");
      const origFacture = devisFactures.find(f => f.id === avoirRectifFactureId);
      if (!origFacture) throw new Error("Facture introuvable");
      const numero = await generateDocumentNumber(artisanId, "facture", undefined, nomenclatureSettings);
      const newMontantHT = Math.max(0, origFacture.montant_ht - avoirItem.montant_ht);
      const newTTC = calcMontantTTC(newMontantHT, devis.tva);
      const { data: newF, error } = await supabase.from("factures").insert({
        artisan_id: artisanId,
        devis_id: devis.id,
        client_id: devis.client_id,
        avoir_annulation_id: avoirItem.id,
        numero,
        montant_ht: newMontantHT,
        tva: devis.tva,
        statut: "brouillon",
        date_echeance: avoirRectifEcheance,
        solde_restant: newTTC,
      } as any).select("id").single();
      if (error) throw error;
      if (newF?.id && lignesOrig && lignesOrig.length > 0) {
        await (supabase as any).from("lignes_facture").insert(
          lignesOrig.map((l: any, i: number) => ({
            facture_id: newF.id, artisan_id: artisanId,
            designation: l.designation, quantite: l.quantite,
            unite: l.unite, prix_unitaire: l.prix_unitaire,
            tva: l.tva, ordre: l.ordre ?? i + 1,
          }))
        );
      }
      await supabase.from("factures").update({ statut: "annulee" }).eq("id", avoirRectifFactureId);
      await (supabase as any).from("avoirs").update({ facture_remplacante_id: newF.id }).eq("id", avoirItem.id);
      toast.success(`Facture rectificative ${numero} créée`);
      setAvoirRectifTargetId(null);
      setAvoirRectifFactureId("");
      setAvoirRectifEcheance("");
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setAvoirRectifSaving(false);
    }
  };

  const handleCreateChantier = () => {
    const client = devis.client;
    const params = new URLSearchParams({
      from_devis: devis.id,
      client_id: devis.client_id ?? "",
      client_nom: client ? `${client.nom}${client.prenom ? " " + client.prenom : ""}` : "",
      devis_numero: devis.numero,
      devis_montant: String(montantTTC),
    });
    navigate(`/chantiers?${params.toString()}`);
  };

  return (
    <>
      <div className={`forge-card space-y-0 p-0 overflow-hidden ${expired ? "border-amber-300 dark:border-amber-700" : ""} ${isRemplace ? "opacity-60" : ""}`}>
        {/* Header de la carte */}
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm">{devis.numero}</span>
              <Badge className={`text-xs ${statutColors[devis.statut] ?? "bg-muted"}`}>
                {isLocked && <Lock className="w-3 h-3 mr-1" />}
                {statutLabels[devis.statut] ?? devis.statut}
              </Badge>
              {(devis.version ?? 1) > 1 && (
                <Badge className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                  v{devis.version}
                </Badge>
              )}
              {expired && (
                <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Expiré
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              <span>{new Date(devis.created_at).toLocaleDateString("fr-FR")}</span>
              {devis.date_validite && <span>Valid. {new Date(devis.date_validite).toLocaleDateString("fr-FR")}</span>}
              {devisAvenants.length > 0 && <span className="text-emerald-600">+{devisAvenants.length} avenant{devisAvenants.length > 1 ? "s" : ""}</span>}
              {devisAvoirs.length > 0 && <span className="text-amber-600">−{devisAvoirs.length} avoir{devisAvoirs.length > 1 ? "s" : ""}</span>}
              {devisAcomptes.length > 0 && <span>{devisAcomptes.length} acompte{devisAcomptes.length > 1 ? "s" : ""}</span>}
              {devisTs.length > 0 && <span className="text-orange-600">{devisTs.length} TS</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold font-mono text-sm">{montantAjusteTTC.toFixed(2)} €</div>
            <div className="text-xs text-muted-foreground">TTC ajusté</div>
          </div>
          <button
            onClick={openDevisPdf}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Aperçu PDF"
          >
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>

        {/* Contenu étendu */}
        {expanded && (
          <div className="border-t px-4 pb-4 pt-3 space-y-4">
            {/* Actions statut */}
            {isRemplace ? (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Consulter
                </Button>
                <Button size="sm" variant="outline" onClick={handleReactiver} disabled={creatingVersion} className="text-violet-600 border-violet-300">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Réactiver
                </Button>
              </div>
            ) : devis.statut === "signe" ? (
              <div className="flex gap-2 flex-wrap">
                {!devis.chantier_id && (
                  <Button size="sm" onClick={handleCreateChantier} className="bg-primary/90 hover:bg-primary">
                    <Building2 className="w-3.5 h-3.5 mr-1" /> Créer le chantier
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
                {devis.chantier_id && (
                  <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs">
                    <Building2 className="w-3 h-3 mr-1" /> Chantier lié
                  </Badge>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><FileText className="w-3.5 h-3.5 mr-1" /> Voir le devis</Button>
                <Button size="sm" variant="outline" onClick={handleCreateNouvelleVersion} disabled={creatingVersion} className="text-violet-600 border-violet-300">
                  {creatingVersion ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <GitBranch className="w-3.5 h-3.5 mr-1" />}
                  Nouvelle version
                </Button>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {devis.statut !== "envoye" && <Button size="sm" variant="outline" onClick={() => handleChangeStatut("envoye")}><Send className="w-3.5 h-3.5 mr-1" /> Marquer envoyé</Button>}
                {devis.statut !== "signe" && <Button size="sm" variant="outline" onClick={() => handleChangeStatut("signe")} className="text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marquer signé</Button>}
                {devis.statut !== "refuse" && <Button size="sm" variant="outline" onClick={() => handleChangeStatut("refuse")} className="text-destructive"><XCircle className="w-3.5 h-3.5 mr-1" /> Refusé</Button>}
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="w-3.5 h-3.5 mr-1" /> Modifier</Button>
                {devis.statut !== "brouillon" && (
                  <Button size="sm" variant="outline" onClick={handleCreateNouvelleVersion} disabled={creatingVersion} className="text-violet-600 border-violet-300">
                    {creatingVersion ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <GitBranch className="w-3.5 h-3.5 mr-1" />}
                    Nouvelle version
                  </Button>
                )}
                {devis.statut === "brouillon" && (
                  <Button size="sm" variant="outline" onClick={handleDeleteDevis} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                  </Button>
                )}
              </div>
            )}

            {/* Lignes du devis */}
            {devis.lignes && devis.lignes.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lignes</p>
                <div className="space-y-1">
                  {(() => {
                    const hasSections = devis.lignes.some(l => l.section_nom);
                    return devis.lignes.map((l, i) => {
                      const isNewSection = hasSections && l.section_nom && (i === 0 || l.section_nom !== devis.lignes[i - 1].section_nom);
                      return (
                        <Fragment key={i}>
                          {isNewSection && (
                            <div className="flex items-center gap-2 pt-1">
                              <div className="flex-1 h-px bg-primary/20" />
                              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Layers className="w-2.5 h-2.5" />{l.section_nom}
                              </span>
                              <div className="flex-1 h-px bg-primary/20" />
                            </div>
                          )}
                          <div className={`flex items-center justify-between text-xs ${hasSections && l.section_nom ? "pl-2" : ""}`}>
                            <span className="truncate max-w-[60%]">{l.designation || <span className="italic text-muted-foreground">—</span>}</span>
                            <span className="font-mono text-muted-foreground">{l.quantite} {l.unite} × {l.prix_unitaire.toFixed(2)} = {(l.quantite * l.prix_unitaire).toFixed(2)} €</span>
                          </div>
                        </Fragment>
                      );
                    });
                  })()}
                  <div className="flex justify-between text-xs font-semibold border-t pt-1">
                    <span>Total HT</span>
                    <span className="font-mono">{devis.montant_ht.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">TVA {devis.tva}%</span>
                    <span className="font-mono">{(devis.montant_ht * devis.tva / 100).toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total TTC</span>
                    <span className="font-mono">{montantTTC.toFixed(2)} €</span>
                  </div>
                </div>
              </div>
            )}

            {/* Récapitulatif ajusté (si avenant ou avoir) */}
            {(devisAvenants.length > 0 || devisAvoirs.length > 0) && (
              <div className="rounded-lg bg-muted/30 border p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Devis initial TTC</span>
                  <span className="font-mono">{montantTTC.toFixed(2)} €</span>
                </div>
                {devisAvenants.length > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>+ Avenants HT ({devisAvenants.length})</span>
                    <span className="font-mono">+{calcMontantTTC(totalAvenantHT, devis.tva).toFixed(2)} €</span>
                  </div>
                )}
                {devisAvoirs.length > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>− Avoirs HT ({devisAvoirs.length})</span>
                    <span className="font-mono">−{calcMontantTTC(totalAvoirHT, devis.tva).toFixed(2)} €</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold border-t pt-1">
                  <span>= Total ajusté TTC</span>
                  <span className="font-mono">{montantAjusteTTC.toFixed(2)} €</span>
                </div>
              </div>
            )}

            <Tabs defaultValue="avenants" className="w-full">
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="avenants" className="text-xs">
                  <Wrench className="w-3 h-3 mr-1" /> Avenants ({devisAvenants.length})
                </TabsTrigger>
                <TabsTrigger value="avoirs" className="text-xs">
                  <XCircle className="w-3 h-3 mr-1" /> Avoirs ({devisAvoirs.length})
                </TabsTrigger>
                <TabsTrigger value="acomptes" className="text-xs">
                  <CreditCard className="w-3 h-3 mr-1" /> Acomptes ({devisAcomptes.length})
                </TabsTrigger>
                <TabsTrigger value="factures" className="text-xs">
                  <FileText className="w-3 h-3 mr-1" /> Factures ({devisFactures.length})
                </TabsTrigger>
                <TabsTrigger value="ts" className="text-xs">
                  <ClipboardList className="w-3 h-3 mr-1" /> TS ({devisTs.length})
                </TabsTrigger>
              </TabsList>

              {/* Avenants */}
              <TabsContent value="avenants" className="mt-3 space-y-2">
                {devisAvenants.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun avenant</p>}
                {devisAvenants.map(av => (
                  <div key={av.id} className="rounded-lg border p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold">{av.numero || "AVN"}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono">{calcMontantTTC(av.montant_ht, devis.tva).toFixed(2)} € TTC</span>
                        <button onClick={() => { setEditAvenant(av); setAvenantOpen(true); }} className="text-muted-foreground hover:text-foreground p-0.5">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDeleteAvenant(av.id)} className="text-destructive hover:opacity-80 p-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {av.description && <p className="text-xs text-muted-foreground">{av.description}</p>}
                    {av.lignes && av.lignes.length > 0 && (
                      <div className="space-y-0.5 pt-1 border-t">
                        {av.lignes.map((l, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="truncate max-w-[60%]">{l.designation}</span>
                            <span className="font-mono text-muted-foreground">{(l.quantite * l.prix_unitaire).toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {!isRemplace && (
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => { setEditAvenant(null); setAvenantOpen(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Nouvel avenant
                  </Button>
                )}
              </TabsContent>

              {/* Avoirs */}
              <TabsContent value="avoirs" className="mt-3 space-y-2">
                {devisAvoirs.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun avoir</p>}
                {devisAvoirs.map(av => (
                  <div key={av.id} className="rounded-lg border border-amber-200 dark:border-amber-800 p-2 space-y-1 bg-amber-50/50 dark:bg-amber-900/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold">{av.numero || "AVO"}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-amber-600">−{calcMontantTTC(av.montant_ht, devis.tva).toFixed(2)} € TTC</span>
                        {facturesNonAnnulees.length > 0 && (
                          <button
                            onClick={() => {
                              if (avoirRectifTargetId === av.id) { setAvoirRectifTargetId(null); return; }
                              setAvoirRectifTargetId(av.id);
                              setAvoirRectifFactureId(facturesNonAnnulees[facturesNonAnnulees.length - 1].id);
                              setAvoirRectifEcheance("");
                            }}
                            className="text-purple-600 hover:opacity-80 p-0.5"
                            title="Émettre facture rectificative"
                          >
                            <FileText className="w-3 h-3" />
                          </button>
                        )}
                        <button onClick={() => { setEditAvoir(av); setAvoirOpen(true); }} className="text-muted-foreground hover:text-foreground p-0.5">
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button onClick={async () => { await (supabase as any).from("avoirs").delete().eq("id", av.id); onRefresh(); }} className="text-destructive hover:opacity-80 p-0.5">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {av.description && <p className="text-xs text-muted-foreground">{av.description}</p>}
                    {av.lignes && av.lignes.length > 0 && (
                      <div className="space-y-0.5 pt-1 border-t border-amber-200 dark:border-amber-700">
                        {av.lignes.map((l, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="truncate max-w-[60%]">{l.designation}</span>
                            <span className="font-mono text-muted-foreground">−{(l.quantite * l.prix_unitaire).toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {avoirRectifTargetId === av.id && (
                      <div className="mt-2 pt-2 border-t border-amber-300 dark:border-amber-700 space-y-2">
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-400">Facture rectificative</p>
                        {facturesNonAnnulees.length > 1 ? (
                          <div className="space-y-1">
                            <Label className="text-xs">Facture à annuler</Label>
                            <Select value={avoirRectifFactureId} onValueChange={setAvoirRectifFactureId}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {facturesNonAnnulees.map(f => (
                                  <SelectItem key={f.id} value={f.id} className="text-xs">
                                    {f.numero} — {f.montant_ht.toFixed(2)} € HT
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Annule : <strong>{facturesNonAnnulees[0]?.numero}</strong></p>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">Échéance nouvelle facture</Label>
                          <Input type="date" className="h-7 text-xs" value={avoirRectifEcheance} onChange={e => setAvoirRectifEcheance(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 text-xs bg-purple-600 hover:bg-purple-700 text-white" disabled={avoirRectifSaving} onClick={() => handleEmettreFactureRectif(av)}>
                            {avoirRectifSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
                            Émettre
                          </Button>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => setAvoirRectifTargetId(null)}>Annuler</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {!isRemplace && (
                  <Button size="sm" variant="outline" className="w-full text-xs border-amber-300 text-amber-700 hover:bg-amber-50" onClick={() => { setEditAvoir(null); setAvoirOpen(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Nouvel avoir
                  </Button>
                )}
              </TabsContent>

              {/* Acomptes */}
              <TabsContent value="acomptes" className="mt-3 space-y-2">
                {devisAcomptes.length > 0 && (
                  <div className="rounded-lg bg-muted/40 p-2 text-xs flex justify-between">
                    <span className="text-muted-foreground">Total acomptes</span>
                    <span className="font-mono font-semibold">{totalAcomptes.toFixed(2)} € / {montantAjusteTTC.toFixed(2)} € TTC</span>
                  </div>
                )}
                {devisAcomptes.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun acompte</p>}
                {devisAcomptes.map(ac => (
                  <div key={ac.id} className="rounded-lg border p-2 flex items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold">{ac.numero}</span>
                        <Badge className={`text-[10px] ${ac.statut === "encaisse" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                          {ac.statut === "encaisse" ? "Encaissé" : "En attente"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ac.pourcentage}% = <strong className="text-foreground">{ac.montant.toFixed(2)} € TTC</strong>
                        {ac.date_echeance && ` — échéance ${new Date(ac.date_echeance).toLocaleDateString("fr-FR")}`}
                      </p>
                    </div>
                    {ac.statut === "en_attente" && (
                      <Button size="sm" variant="outline" onClick={() => handleEncaisserAcompte(ac.id)} className="text-xs shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Encaissé
                      </Button>
                    )}
                  </div>
                ))}
                {!isRemplace && (
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setAcompteOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Nouvel acompte
                  </Button>
                )}
              </TabsContent>

              {/* Factures */}
              <TabsContent value="factures" className="mt-3 space-y-2">
                {/* Récap pour création facture */}
                <div className="rounded-lg bg-muted/30 border p-2 text-xs space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Montant à facturer TTC</span>
                    <span className="font-mono">{montantAjusteTTC.toFixed(2)} €</span>
                  </div>
                  {acomptesEncaisses > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>− Acomptes encaissés</span>
                      <span className="font-mono">{acomptesEncaisses.toFixed(2)} €</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-primary border-t pt-1">
                    <span>Solde restant</span>
                    <span className="font-mono">{Math.max(0, montantAjusteTTC - acomptesEncaisses).toFixed(2)} €</span>
                  </div>
                </div>

                {devisFactures.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune facture émise</p>}
                {devisFactures.map(f => (
                  <FactureCard
                    key={f.id}
                    facture={f}
                    clientNom={devis.client ? `${devis.client.nom}${devis.client.prenom ? " " + devis.client.prenom : ""}` : ""}
                    devisNumero={devis.numero}
                    onRefresh={onRefresh}
                  />
                ))}
                {!isRemplace && (
                  <Button size="sm" className="w-full text-xs" onClick={() => setFactureOpen(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Émettre la facture
                  </Button>
                )}
              </TabsContent>
              {/* Travaux Supplémentaires */}
              <TabsContent value="ts" className="mt-3 space-y-2">
                {devisTs.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun travail supplémentaire</p>}
                {devisTs.map(t => (
                  <div key={t.id} className="rounded-lg border border-orange-200 dark:border-orange-800 p-2 space-y-1.5 bg-orange-50/40 dark:bg-orange-900/5">
                    <div className="flex items-start justify-between gap-1">
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-mono font-semibold">{t.numero ?? "TS"}</span>
                          <Badge className={`text-[10px] ${t.statut === "facture" ? "bg-blue-100 text-blue-700" : t.statut === "signe" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                            {t.statut === "facture" ? "Facturé" : t.statut === "signe" ? "Signé" : "Brouillon"}
                          </Badge>
                          <span className="text-xs font-mono text-orange-600 ml-auto">{calcMontantTTC(t.montant_ht, devis.tva).toFixed(2)} € TTC</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{t.description}</p>
                        {t.date_validite && <p className="text-[10px] text-muted-foreground">Valid. {new Date(t.date_validite).toLocaleDateString("fr-FR")}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {t.statut === "brouillon" && (
                          <>
                            <button onClick={() => { setEditTs(t); setTsOpen(true); }} className="text-muted-foreground hover:text-foreground p-0.5">
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleSignerTs(t.id)} className="text-emerald-600 hover:opacity-80 p-0.5" title="Marquer signé">
                              <CheckCircle2 className="w-3 h-3" />
                            </button>
                            <button onClick={() => handleDeleteTs(t.id)} className="text-destructive hover:opacity-80 p-0.5">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    {t.lignes && t.lignes.length > 0 && (
                      <div className="space-y-0.5 pt-1 border-t border-orange-200 dark:border-orange-700">
                        {t.lignes.map((l, i) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="truncate max-w-[60%]">{l.designation}</span>
                            <span className="font-mono text-muted-foreground">{(l.quantite * l.prix_unitaire).toFixed(2)} €</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {t.statut === "signe" && (
                      tsFactureTargetId === t.id ? (
                        <div className="flex items-center gap-2 pt-1 border-t border-orange-200">
                          <Input
                            type="date"
                            className="h-7 text-xs flex-1"
                            value={tsFactureDateEcheance}
                            onChange={e => setTsFactureDateEcheance(e.target.value)}
                          />
                          <Button size="sm" className="text-xs h-7 shrink-0" onClick={() => handleGenererFactureTS(t)} disabled={tsFactureSaving}>
                            {tsFactureSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                            Émettre
                          </Button>
                          <button onClick={() => { setTsFactureTargetId(null); setTsFactureDateEcheance(""); }} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full text-xs h-7 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setTsFactureTargetId(t.id)}>
                          <FileText className="w-3 h-3 mr-1" /> Générer la facture
                        </Button>
                      )
                    )}
                  </div>
                ))}
                {!isRemplace && (
                  <Button size="sm" variant="outline" className="w-full text-xs border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => { setEditTs(null); setTsOpen(true); }}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Nouveau TS
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <DevisDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={onRefresh}
        clients={allClients}
        nomenclatureSettings={nomenclatureSettings}
        editDevis={devis}
        preselectedClientId={null}
        artisanId={artisanId}
      />
      <AvenantDialog
        open={avenantOpen}
        onClose={() => { setAvenantOpen(false); setEditAvenant(null); }}
        onSaved={onRefresh}
        devisId={devis.id}
        devisNumero={devis.numero}
        artisanId={artisanId}
        nomenclatureSettings={nomenclatureSettings}
        editAvenant={editAvenant}
      />
      <AcompteDialog
        open={acompteOpen}
        onClose={() => setAcompteOpen(false)}
        onSaved={onRefresh}
        devisId={devis.id}
        devisMontantHT={montantAjusteHT}
        devisTva={devis.tva}
        artisanId={artisanId}
        nomenclatureSettings={nomenclatureSettings}
        acomptesExistants={devisAcomptes}
      />
      <AvoirDialog
        open={avoirOpen}
        onClose={() => { setAvoirOpen(false); setEditAvoir(null); }}
        onSaved={onRefresh}
        devisId={devis.id}
        devisNumero={devis.numero}
        artisanId={artisanId}
        nomenclatureSettings={nomenclatureSettings}
        editAvoir={editAvoir}
      />
      <FactureDialog
        open={factureOpen}
        onClose={() => setFactureOpen(false)}
        onSaved={onRefresh}
        devisId={devis.id}
        clientId={devis.client_id}
        montantAjusteHT={montantAjusteHT}
        tva={devis.tva}
        acomptesEncaisses={acomptesEncaisses}
        artisanId={artisanId}
        nomenclatureSettings={nomenclatureSettings}
        lignesDevis={devis.lignes ?? []}
      />
      <TsDialog
        open={tsOpen}
        onClose={() => { setTsOpen(false); setEditTs(null); }}
        onSaved={onRefresh}
        devisId={devis.id}
        devisClientId={devis.client_id}
        devisChantierID={devis.chantier_id}
        devisNumero={devis.numero}
        artisanId={artisanId}
        nomenclatureSettings={nomenclatureSettings}
        editTs={editTs}
      />

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] p-0 flex flex-col gap-0">
          <DialogHeader className="px-4 py-3 border-b shrink-0 flex flex-row items-center justify-between space-y-0">
            <DialogTitle className="font-display text-base">{pdfTitle}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const iframe = document.getElementById(`pdf-iframe-${devis.id}`) as HTMLIFrameElement | null;
                iframe?.contentWindow?.print();
              }}
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            {pdfHtml ? (
              <iframe
                id={`pdf-iframe-${devis.id}`}
                srcDoc={pdfHtml}
                className="w-full bg-white shadow-lg rounded-lg border"
                style={{ minHeight: "1123px" }}
                title="Aperçu A4"
              />
            ) : (
              <div className="flex items-center justify-center h-40">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page principale ─────────────────────────────────────────

export default function DevisPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [devisList, setDevisList] = useState<DevisRow[]>([]);
  const [avenants, setAvenants] = useState<Avenant[]>([]);
  const [avoirs, setAvoirs] = useState<Avoir[]>([]);
  const [acomptes, setAcomptes] = useState<Acompte[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [tsList, setTsList] = useState<TravailSupplementaire[]>([]);
  const [nomenclatureSettings, setNomenclatureSettings] = useState<NomenclatureSettings>({
    devis_prefix: "D", facture_prefix: "F", avenant_prefix: "Avt",
    acompte_prefix: "Acp", avoir_prefix: "Avoir", ts_prefix: "TS",
    annee_format: 4, numero_digits: 3,
  });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [statutFilter, setStatutFilter] = useState<string>("tous");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageView, setPageView] = useState<"devis" | "factures">("devis");

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [
      { data: cData },
      { data: dData },
      { data: avData },
      { data: avoirData },
      { data: acData },
      { data: fData },
      { data: ldData },
      { data: laData },
      { data: lavoirData },
      { data: settData },
      { data: tsData },
      { data: ltsData },
    ] = await Promise.all([
      supabase.from("clients").select("id,nom,prenom,email,telephone,adresse,type").eq("artisan_id", user.id).order("nom"),
      supabase.from("devis").select("id,numero,statut,montant_ht,tva,date_validite,client_id,chantier_id,created_at,version,parent_devis_id,base_numero,chantiers(client_id)").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("avenants").select("id,devis_id,numero,description,montant_ht,statut,date").eq("artisan_id", user.id),
      (supabase as any).from("avoirs").select("id,devis_id,numero,description,montant_ht,statut,date").eq("artisan_id", user.id),
      supabase.from("acomptes").select("id,devis_id,numero,pourcentage,montant,statut,date_echeance,date_encaissement,notes").eq("artisan_id", user.id),
      supabase.from("factures").select("id,devis_id,numero,montant_ht,tva,statut,date_echeance,client_id,solde_restant").eq("artisan_id", user.id),
      supabase.from("lignes_devis").select("id,devis_id,designation,quantite,unite,prix_unitaire,tva,ordre,section_nom").eq("artisan_id", user.id).order("ordre"),
      supabase.from("lignes_avenant").select("id,avenant_id,designation,quantite,unite,prix_unitaire,tva,ordre").eq("artisan_id", user.id).order("ordre"),
      (supabase as any).from("lignes_avoir").select("id,avoir_id,designation,quantite,unite,prix_unitaire,tva,ordre").eq("artisan_id", user.id).order("ordre"),
      supabase.from("artisan_settings").select("devis_prefix,facture_prefix,avenant_prefix,acompte_prefix,avoir_prefix,ts_prefix,annee_format,numero_digits").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("travaux_supplementaires").select("id,devis_id,artisan_id,numero,description,montant_ht,statut,date,client_id,chantier_id,date_validite").eq("artisan_id", user.id),
      (supabase as any).from("lignes_ts").select("id,ts_id,designation,quantite,unite,prix_unitaire,tva,ordre").eq("artisan_id", user.id).order("ordre"),
    ]);

    const clientsMap = new Map((cData ?? []).map(c => [c.id, c]));
    const lignesMap = new Map<string, LigneDevis[]>();
    (ldData ?? []).forEach(l => {
      const existing = lignesMap.get(l.devis_id) ?? [];
      lignesMap.set(l.devis_id, [...existing, l]);
    });
    const lignesAvenantMap = new Map<string, AvenantLigne[]>();
    (laData ?? []).forEach(l => {
      const existing = lignesAvenantMap.get(l.avenant_id) ?? [];
      lignesAvenantMap.set(l.avenant_id, [...existing, l]);
    });
    const lignesAvoirMap = new Map<string, AvenantLigne[]>();
    (lavoirData ?? []).forEach((l: any) => {
      const existing = lignesAvoirMap.get(l.avoir_id) ?? [];
      lignesAvoirMap.set(l.avoir_id, [...existing, l]);
    });

    setClients(cData ?? []);
    setDevisList((dData ?? []).map((d: any) => {
      const effectiveClientId = d.client_id ?? d.chantiers?.client_id ?? null;
      return {
        ...d,
        client_id: effectiveClientId,
        client: effectiveClientId ? clientsMap.get(effectiveClientId) : undefined,
        lignes: lignesMap.get(d.id) ?? [],
        version: d.version ?? 1,
        parent_devis_id: d.parent_devis_id ?? null,
        base_numero: d.base_numero ?? null,
      };
    }));
    const lignesTsMap = new Map<string, AvenantLigne[]>();
    (ltsData ?? []).forEach((l: any) => {
      const existing = lignesTsMap.get(l.ts_id) ?? [];
      lignesTsMap.set(l.ts_id, [...existing, l]);
    });

    setAvenants((avData ?? []).map(a => ({ ...a, lignes: lignesAvenantMap.get(a.id) ?? [] })));
    setAvoirs((avoirData ?? []).map((a: any) => ({ ...a, lignes: lignesAvoirMap.get(a.id) ?? [] })));
    setAcomptes(acData ?? []);
    setFactures(fData ?? []);
    setTsList((tsData ?? []).map((t: any) => ({ ...t, lignes: lignesTsMap.get(t.id) ?? [] })));
    if (settData) {
      const s = settData as any;
      setNomenclatureSettings({
        devis_prefix:   s.devis_prefix   ?? "D",
        facture_prefix: s.facture_prefix ?? "F",
        avenant_prefix: s.avenant_prefix ?? "Avt",
        acompte_prefix: s.acompte_prefix ?? "Acp",
        avoir_prefix:   s.avoir_prefix   ?? "Avoir",
        ts_prefix:      s.ts_prefix      ?? "TS",
        annee_format:   Number(s.annee_format  ?? 4),
        numero_digits:  Number(s.numero_digits ?? 3),
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, [searchParams]);

  const filteredDevis = devisList.filter(d => {
    if (selectedClientId && d.client_id !== selectedClientId) return false;
    if (statutFilter !== "tous" && d.statut !== statutFilter) return false;
    return true;
  });

  const clientsWithDevis = clients.filter(c => devisList.some(d => d.client_id === c.id));

  if (!user) return null;

  // Enrichissement factures pour la vue page-level
  const facturesEnrichies = factures.map(f => {
    const devisRef = devisList.find(d => d.id === f.devis_id);
    const clientRef = clients.find(c => c.id === (f.client_id ?? devisRef?.client_id));
    return {
      ...f,
      devisNumero: devisRef?.numero ?? "",
      clientNom: clientRef ? `${clientRef.nom}${clientRef.prenom ? " " + clientRef.prenom : ""}` : "",
    };
  });

  const filteredFacturesPage = facturesEnrichies.filter(f => {
    if (selectedClientId) {
      const devisRef = devisList.find(d => d.id === f.devis_id);
      return (f.client_id ?? devisRef?.client_id) === selectedClientId;
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-display">Devis & Factures</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{devisList.length} devis — {factures.length} facture{factures.length > 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-primary to-primary/90 shadow-forge">
          <Plus className="w-4 h-4 mr-1.5" /> Nouveau devis
        </Button>
      </div>

      {/* Onglets Devis / Factures */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setPageView("devis")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageView === "devis" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <FileText className="w-3.5 h-3.5 inline mr-1.5" />Devis ({devisList.length})
        </button>
        <button
          onClick={() => setPageView("factures")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${pageView === "factures" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />Factures ({factures.length})
        </button>
      </div>

      {/* Filtres clients (communs aux deux vues) */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedClientId(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${!selectedClientId ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
          >
            Tous les clients
          </button>
          {clientsWithDevis.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedClientId(c.id === selectedClientId ? null : c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selectedClientId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:text-foreground"}`}
            >
              {c.nom}{c.prenom ? ` ${c.prenom}` : ""}
            </button>
          ))}
        </div>

        {/* Filtre statut (uniquement vue Devis) */}
        {pageView === "devis" && (
          <Select value={statutFilter} onValueChange={setStatutFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous statuts</SelectItem>
              <SelectItem value="brouillon">Brouillon</SelectItem>
              <SelectItem value="envoye">Envoyé</SelectItem>
              <SelectItem value="signe">Signé</SelectItem>
              <SelectItem value="refuse">Refusé</SelectItem>
              <SelectItem value="remplace">Remplacé</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* ── Vue Factures ── */}
      {pageView === "factures" && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-16 rounded-xl" />)}</div>
          ) : filteredFacturesPage.length === 0 ? (
            <div className="forge-card text-center py-12 space-y-3">
              <CreditCard className="w-12 h-12 text-muted-foreground/30 mx-auto" />
              <p className="text-muted-foreground text-sm">Aucune facture{selectedClientId ? " pour ce client" : ""}</p>
            </div>
          ) : (
            filteredFacturesPage.map(f => (
              <FactureCard
                key={f.id}
                facture={f}
                clientNom={(f as any).clientNom ?? ""}
                devisNumero={(f as any).devisNumero ?? ""}
                onRefresh={loadAll}
              />
            ))
          )}
        </div>
      )}

      {/* ── Vue Devis ── */}
      {pageView === "devis" && (loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="skeleton-shimmer h-20 rounded-xl" />)}
        </div>
      ) : filteredDevis.length === 0 ? (
        <div className="forge-card text-center py-12 space-y-3">
          <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">Aucun devis{selectedClientId ? " pour ce client" : ""}</p>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Créer le premier devis
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDevis.map(d => (
            <div key={d.id}>
              {!selectedClientId && d.client && (
                <div className="flex items-center gap-2 mb-1.5 px-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">
                    {d.client.nom}{d.client.prenom ? ` ${d.client.prenom}` : ""}
                  </span>
                </div>
              )}
              <DevisCard
                devis={d}
                avenants={avenants}
                avoirs={avoirs}
                acomptes={acomptes}
                factures={factures}
                ts={tsList}
                nomenclatureSettings={nomenclatureSettings}
                artisanId={user.id}
                onRefresh={loadAll}
              />
            </div>
          ))}
        </div>
      ))}

      <DevisDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={loadAll}
        clients={clients}
        nomenclatureSettings={nomenclatureSettings}
        editDevis={null}
        preselectedClientId={selectedClientId}
        artisanId={user.id}
      />
    </div>
  );
}
