import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, ChevronDown, ChevronUp, Pencil, Trash2, Lock, Send,
  CheckCircle2, XCircle, Building2, FileText, AlertTriangle,
  Loader2, Users, CreditCard, Wrench, ArrowRight,
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
}

interface Prefixes {
  devis_prefix: string;
  facture_prefix: string;
  avenant_prefix: string;
  acompte_prefix: string;
}

// ─── Helpers ────────────────────────────────────────────────

const statutColors: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  signe: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  refuse: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  en_cours: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

const statutLabels: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  signe: "Signé",
  refuse: "Refusé",
  en_cours: "En cours",
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
  prefixes,
  editDevis,
  preselectedClientId,
  artisanId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clients: Client[];
  prefixes: Prefixes;
  editDevis: DevisRow | null;
  preselectedClientId: string | null;
  artisanId: string;
}) {
  const isLocked = editDevis?.statut === "signe";
  const [clientId, setClientId] = useState(preselectedClientId ?? "");
  const [newClient, setNewClient] = useState({ nom: "", prenom: "", email: "", telephone: "", adresse: "", type: "particulier" });
  const [creatingClient, setCreatingClient] = useState(false);
  const [numero, setNumero] = useState("");
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
      setNumero(`${prefixes.devis_prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`);
      setDateValidite((() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split("T")[0]; })());
      setTva(20);
      setLignes([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
      setCreatingClient(false);
      setNewClient({ nom: "", prenom: "", email: "", telephone: "", adresse: "", type: "particulier" });
    }
  }, [open, editDevis, preselectedClientId, prefixes.devis_prefix]);

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
          .insert({ artisan_id: artisanId, client_id: resolvedClientId, numero, date_validite: dateValidite, tva, montant_ht: montantHT, statut: "brouillon" })
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
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} disabled={isLocked} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">TVA %</Label>
              <Input type="number" value={tva} onChange={(e) => setTva(parseFloat(e.target.value) || 0)} disabled={isLocked} />
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
  artisanId,
  prefixAvenant,
  editAvenant,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  devisId: string;
  artisanId: string;
  prefixAvenant: string;
  editAvenant: Avenant | null;
}) {
  const [numero, setNumero] = useState(`${prefixAvenant}-${String(Date.now()).slice(-4)}`);
  const [description, setDescription] = useState("");
  const [lignes, setLignes] = useState<AvenantLigne[]>([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editAvenant) {
      setNumero(editAvenant.numero ?? "");
      setDescription(editAvenant.description);
      setLignes(editAvenant.lignes?.length ? editAvenant.lignes : [{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
    } else {
      setNumero(`${prefixAvenant}-${String(Date.now()).slice(-4)}`);
      setDescription("");
      setLignes([{ designation: "", quantite: 1, unite: "u", prix_unitaire: 0, tva: 20, ordre: 0 }]);
    }
  }, [open, editAvenant, prefixAvenant]);

  const montantHT = calcMontantHT(lignes);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editAvenant) {
        await supabase.from("avenants").update({ numero, description, montant_ht: montantHT }).eq("id", editAvenant.id);
        await supabase.from("lignes_avenant").delete().eq("avenant_id", editAvenant.id);
        if (lignes.length > 0) {
          await supabase.from("lignes_avenant").insert(
            lignes.map((l, i) => ({ ...l, avenant_id: editAvenant.id, artisan_id: artisanId, ordre: i }))
          );
        }
      } else {
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
          <DialogTitle>{editAvenant ? "Modifier l'avenant" : "Nouvel avenant"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Numéro</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
          </div>
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

// ─── Dialog acompte ─────────────────────────────────────────

function AcompteDialog({
  open,
  onClose,
  onSaved,
  devisId,
  devisMontantHT,
  devisTva,
  artisanId,
  prefixAcompte,
  acomptesExistants,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  devisId: string;
  devisMontantHT: number;
  devisTva: number;
  artisanId: string;
  prefixAcompte: string;
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
      const numero = `${prefixAcompte}-${String(Date.now()).slice(-4)}`;
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

// ─── Carte devis ─────────────────────────────────────────────

function DevisCard({
  devis,
  avenants,
  acomptes,
  factures,
  prefixes,
  artisanId,
  onRefresh,
}: {
  devis: DevisRow;
  avenants: Avenant[];
  acomptes: Acompte[];
  factures: Facture[];
  prefixes: Prefixes;
  artisanId: string;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [avenantOpen, setAvenantOpen] = useState(false);
  const [editAvenant, setEditAvenant] = useState<Avenant | null>(null);
  const [acompteOpen, setAcompteOpen] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);

  const isLocked = devis.statut === "signe";
  const expired = isExpired(devis.date_validite) && !isLocked;
  const montantTTC = calcMontantTTC(devis.montant_ht, devis.tva);
  const devisAvenants = avenants.filter(a => a.devis_id === devis.id);
  const devisAcomptes = acomptes.filter(a => a.devis_id === devis.id);
  const devisFactures = factures.filter(f => f.devis_id === devis.id);
  const totalAcomptes = devisAcomptes.reduce((s, a) => s + a.montant, 0);
  const totalMontantTTC = montantTTC + devisAvenants.reduce((s, a) => s + calcMontantTTC(a.montant_ht, devis.tva), 0);

  const handleChangeStatut = async (statut: string) => {
    await supabase.from("devis").update({ statut }).eq("id", devis.id);
    toast.success(`Statut → ${statutLabels[statut] ?? statut}`);
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
      <div className={`forge-card space-y-0 p-0 overflow-hidden ${expired ? "border-amber-300 dark:border-amber-700" : ""}`}>
        {/* Header de la carte */}
        <div className="flex items-center gap-3 p-4 cursor-pointer" onClick={() => setExpanded(e => !e)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-semibold text-sm">{devis.numero}</span>
              <Badge className={`text-xs ${statutColors[devis.statut] ?? "bg-muted"}`}>
                {isLocked && <Lock className="w-3 h-3 mr-1" />}
                {statutLabels[devis.statut] ?? devis.statut}
              </Badge>
              {expired && (
                <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Expiré
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{new Date(devis.created_at).toLocaleDateString("fr-FR")}</span>
              {devis.date_validite && <span>Valid. {new Date(devis.date_validite).toLocaleDateString("fr-FR")}</span>}
              {devisAvenants.length > 0 && <span>{devisAvenants.length} avenant{devisAvenants.length > 1 ? "s" : ""}</span>}
              {devisAcomptes.length > 0 && <span>{devisAcomptes.length} acompte{devisAcomptes.length > 1 ? "s" : ""}</span>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-semibold font-mono text-sm">{totalMontantTTC.toFixed(2)} €</div>
            <div className="text-xs text-muted-foreground">TTC</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
        </div>

        {/* Contenu étendu */}
        {expanded && (
          <div className="border-t px-4 pb-4 pt-3 space-y-4">
            {/* Actions statut */}
            {!isLocked && (
              <div className="flex gap-2 flex-wrap">
                {devis.statut !== "envoye" && <Button size="sm" variant="outline" onClick={() => handleChangeStatut("envoye")}><Send className="w-3.5 h-3.5 mr-1" /> Marquer envoyé</Button>}
                {devis.statut !== "signe" && <Button size="sm" variant="outline" onClick={() => handleChangeStatut("signe")} className="text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Marquer signé</Button>}
                {devis.statut !== "refuse" && <Button size="sm" variant="outline" onClick={() => handleChangeStatut("refuse")} className="text-destructive"><XCircle className="w-3.5 h-3.5 mr-1" /> Refusé</Button>}
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}><Pencil className="w-3.5 h-3.5 mr-1" /> Modifier</Button>
              </div>
            )}

            {/* Signed devis : actions avancées */}
            {isLocked && (
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
              </div>
            )}

            {/* Lignes du devis */}
            {devis.lignes && devis.lignes.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lignes</p>
                <div className="space-y-1">
                  {devis.lignes.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="truncate max-w-[60%]">{l.designation || <span className="italic text-muted-foreground">—</span>}</span>
                      <span className="font-mono text-muted-foreground">{l.quantite} {l.unite} × {l.prix_unitaire.toFixed(2)} = {(l.quantite * l.prix_unitaire).toFixed(2)} €</span>
                    </div>
                  ))}
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

            <Tabs defaultValue="avenants" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="avenants" className="flex-1 text-xs">
                  <Wrench className="w-3.5 h-3.5 mr-1" /> Avenants ({devisAvenants.length})
                </TabsTrigger>
                <TabsTrigger value="acomptes" className="flex-1 text-xs">
                  <CreditCard className="w-3.5 h-3.5 mr-1" /> Acomptes ({devisAcomptes.length})
                </TabsTrigger>
                <TabsTrigger value="factures" className="flex-1 text-xs">
                  <FileText className="w-3.5 h-3.5 mr-1" /> Factures ({devisFactures.length})
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
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => { setEditAvenant(null); setAvenantOpen(true); }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nouvel avenant
                </Button>
              </TabsContent>

              {/* Acomptes */}
              <TabsContent value="acomptes" className="mt-3 space-y-2">
                {devisAcomptes.length > 0 && (
                  <div className="rounded-lg bg-muted/40 p-2 text-xs flex justify-between">
                    <span className="text-muted-foreground">Total acomptes</span>
                    <span className="font-mono font-semibold">{totalAcomptes.toFixed(2)} € / {totalMontantTTC.toFixed(2)} € TTC</span>
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
                <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setAcompteOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Nouvel acompte
                </Button>
              </TabsContent>

              {/* Factures */}
              <TabsContent value="factures" className="mt-3 space-y-2">
                {devisFactures.length === 0 && <p className="text-xs text-muted-foreground italic">Aucune facture</p>}
                {devisFactures.map(f => (
                  <div key={f.id} className="rounded-lg border p-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-semibold">{f.numero}</span>
                      <p className="text-xs text-muted-foreground">{f.montant_ht.toFixed(2)} € HT — {new Date(f.date_echeance).toLocaleDateString("fr-FR")}</p>
                    </div>
                    <Badge className={`text-xs ${f.statut === "payee" ? "bg-emerald-100 text-emerald-700" : f.statut === "impayee" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground"}`}>
                      {f.statut}
                    </Badge>
                  </div>
                ))}
                {totalAcomptes > 0 && devisFactures.length === 0 && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 p-2 text-xs text-blue-700 dark:text-blue-400">
                    Les acomptes encaissés ({totalAcomptes.toFixed(2)} €) seront déduits de la prochaine facture.
                  </div>
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
        prefixes={prefixes}
        editDevis={devis}
        preselectedClientId={null}
        artisanId={artisanId}
      />
      <AvenantDialog
        open={avenantOpen}
        onClose={() => { setAvenantOpen(false); setEditAvenant(null); }}
        onSaved={onRefresh}
        devisId={devis.id}
        artisanId={artisanId}
        prefixAvenant={prefixes.avenant_prefix}
        editAvenant={editAvenant}
      />
      <AcompteDialog
        open={acompteOpen}
        onClose={() => setAcompteOpen(false)}
        onSaved={onRefresh}
        devisId={devis.id}
        devisMontantHT={devis.montant_ht}
        devisTva={devis.tva}
        artisanId={artisanId}
        prefixAcompte={prefixes.acompte_prefix}
        acomptesExistants={devisAcomptes}
      />
    </>
  );
}

// ─── Page principale ─────────────────────────────────────────

export default function DevisPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [devisList, setDevisList] = useState<DevisRow[]>([]);
  const [avenants, setAvenants] = useState<Avenant[]>([]);
  const [acomptes, setAcomptes] = useState<Acompte[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [prefixes, setPrefixes] = useState<Prefixes>({ devis_prefix: "DEV", facture_prefix: "FAC", avenant_prefix: "AVN", acompte_prefix: "ACP" });
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [statutFilter, setStatutFilter] = useState<string>("tous");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [
      { data: cData },
      { data: dData },
      { data: avData },
      { data: acData },
      { data: fData },
      { data: ldData },
      { data: laData },
      { data: settData },
    ] = await Promise.all([
      supabase.from("clients").select("id,nom,prenom,email,telephone,adresse,type").eq("artisan_id", user.id).order("nom"),
      supabase.from("devis").select("id,numero,statut,montant_ht,tva,date_validite,client_id,chantier_id,created_at").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("avenants").select("id,devis_id,numero,description,montant_ht,statut,date").eq("artisan_id", user.id),
      supabase.from("acomptes").select("id,devis_id,numero,pourcentage,montant,statut,date_echeance,date_encaissement,notes").eq("artisan_id", user.id),
      supabase.from("factures").select("id,devis_id,numero,montant_ht,tva,statut,date_echeance").eq("artisan_id", user.id),
      supabase.from("lignes_devis").select("id,devis_id,designation,quantite,unite,prix_unitaire,tva,ordre").eq("artisan_id", user.id).order("ordre"),
      supabase.from("lignes_avenant").select("id,avenant_id,designation,quantite,unite,prix_unitaire,tva,ordre").eq("artisan_id", user.id).order("ordre"),
      supabase.from("artisan_settings").select("devis_prefix,facture_prefix,avenant_prefix,acompte_prefix").eq("user_id", user.id).single(),
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

    setClients(cData ?? []);
    setDevisList((dData ?? []).map(d => ({
      ...d,
      client: d.client_id ? clientsMap.get(d.client_id) : undefined,
      lignes: lignesMap.get(d.id) ?? [],
    })));
    setAvenants((avData ?? []).map(a => ({ ...a, lignes: lignesAvenantMap.get(a.id) ?? [] })));
    setAcomptes(acData ?? []);
    setFactures(fData ?? []);
    if (settData) {
      setPrefixes({
        devis_prefix: (settData as any).devis_prefix ?? "DEV",
        facture_prefix: (settData as any).facture_prefix ?? "FAC",
        avenant_prefix: (settData as any).avenant_prefix ?? "AVN",
        acompte_prefix: (settData as any).acompte_prefix ?? "ACP",
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filteredDevis = devisList.filter(d => {
    if (selectedClientId && d.client_id !== selectedClientId) return false;
    if (statutFilter !== "tous" && d.statut !== statutFilter) return false;
    return true;
  });

  const clientsWithDevis = clients.filter(c => devisList.some(d => d.client_id === c.id));

  if (!user) return null;

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

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        {/* Filtre client */}
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

        {/* Filtre statut */}
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
          </SelectContent>
        </Select>
      </div>

      {/* Liste devis */}
      {loading ? (
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
              {/* En-tête client si "tous" */}
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
                acomptes={acomptes}
                factures={factures}
                prefixes={prefixes}
                artisanId={user.id}
                onRefresh={loadAll}
              />
            </div>
          ))}
        </div>
      )}

      <DevisDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={loadAll}
        clients={clients}
        prefixes={prefixes}
        editDevis={null}
        preselectedClientId={selectedClientId}
        artisanId={user.id}
      />
    </div>
  );
}
