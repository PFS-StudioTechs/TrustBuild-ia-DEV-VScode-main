import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Bot, FileText, Receipt, CheckCircle, Edit, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { generateDevisPdf, generateFacturePdf } from "@/lib/generatePdf";
import type { Database } from "@/integrations/supabase/types";
import AddressFields from "@/components/ui/AddressFields";

type Devis = Database["public"]["Tables"]["devis"]["Row"];
type Facture = Database["public"]["Tables"]["factures"]["Row"];

const devisStatutLabels: Record<string, string> = { brouillon: "Brouillon", envoye: "Envoyé", signe: "Signé", refuse: "Refusé" };
const factureStatutLabels: Record<string, string> = { brouillon: "Brouillon", envoyee: "Envoyée", payee: "Payée", impayee: "Impayée" };

const devisStatutStyles: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-warning/10 text-warning",
  signe: "bg-success/10 text-success",
  refuse: "bg-destructive/10 text-destructive",
};
const factureStatutStyles: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoyee: "bg-primary/10 text-primary",
  payee: "bg-success/10 text-success",
  impayee: "bg-destructive/10 text-destructive",
};

export default function Documents() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "devis";
  const [devis, setDevis] = useState<Devis[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [chantiers, setChantiers] = useState<{ id: string; nom: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; nom: string }[]>([]);

  // Create devis dialog
  const [createDevisOpen, setCreateDevisOpen] = useState(false);
  const [devisForm, setDevisForm] = useState({
    chantier_id: "", numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_validite: "",
    // Client fields for auto-creation
    client_nom: "", client_email: "", client_telephone: "", client_adresse: "", client_type: "particulier",
    // Chantier fields for auto-creation
    chantier_nom: "", chantier_adresse: "", chantier_date_debut: "", chantier_date_fin_prevue: "",
    use_existing_chantier: true,
  });

  // Create facture dialog
  const [createFactureOpen, setCreateFactureOpen] = useState(false);
  const [factureForm, setFactureForm] = useState({
    devis_id: "", numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_echeance: "", solde_restant: "",
  });

  // Edit / Detail dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editType, setEditType] = useState<"devis" | "facture">("devis");
  const [editDevis, setEditDevis] = useState<Devis | null>(null);
  const [editFacture, setEditFacture] = useState<Facture | null>(null);
  const [editForm, setEditForm] = useState({ montant_ht: "", tva: "", statut: "", date_validite: "", date_echeance: "", solde_restant: "", numero: "", chantier_id: "", facturx_ready: false });

  // Detail view (read then edit)
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<"devis" | "facture">("devis");

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"devis" | "facture">("devis");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // AI
  const [description, setDescription] = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    const [devisRes, facturesRes, chantiersRes, clientsRes] = await Promise.all([
      supabase.from("devis").select("*").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("factures").select("*").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("chantiers").select("id, nom").eq("artisan_id", user.id),
      supabase.from("clients").select("id, nom").eq("artisan_id", user.id),
    ]);
    if (devisRes.data) setDevis(devisRes.data);
    if (facturesRes.data) setFactures(facturesRes.data);
    if (chantiersRes.data) setChantiers(chantiersRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
  };

  useEffect(() => {
    fetchData();
    if (searchParams.get("new") === "devis") {
      setCreateDevisOpen(true);
    }
  }, [user]);

  // Create devis with auto-creation of client + chantier
  const handleCreateDevis = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let chantierId = devisForm.chantier_id;

      if (!devisForm.use_existing_chantier) {
        // Auto-create client if name provided
        let clientId = "";
        if (devisForm.client_nom.trim()) {
          const { data: existingClient } = await supabase.from("clients")
            .select("id").eq("artisan_id", user.id).eq("nom", devisForm.client_nom.trim()).maybeSingle();

          if (existingClient) {
            clientId = existingClient.id;
          } else {
            const { data: newClient, error: clientErr } = await supabase.from("clients").insert({
              artisan_id: user.id,
              nom: devisForm.client_nom.trim(),
              type: devisForm.client_type as "particulier" | "pro",
              email: devisForm.client_email || null,
              telephone: devisForm.client_telephone || null,
              adresse: devisForm.client_adresse || null,
            }).select("id").single();
            if (clientErr) throw clientErr;
            clientId = newClient.id;
            toast.success(`Client "${devisForm.client_nom}" créé automatiquement`);
          }
        }

        if (!clientId) { toast.error("Un client est requis"); setSaving(false); return; }

        // Auto-create chantier
        const { data: newChantier, error: chantierErr } = await supabase.from("chantiers").insert({
          artisan_id: user.id,
          client_id: clientId,
          nom: devisForm.chantier_nom || "Chantier sans nom",
          adresse_chantier: devisForm.chantier_adresse || null,
          date_debut: devisForm.chantier_date_debut || null,
          date_fin_prevue: devisForm.chantier_date_fin_prevue || null,
        }).select("id").single();
        if (chantierErr) throw chantierErr;
        chantierId = newChantier.id;
        toast.success(`Chantier "${devisForm.chantier_nom}" créé automatiquement`);
      }

      if (!chantierId) { toast.error("Un chantier est requis"); setSaving(false); return; }

      const numero = devisForm.numero || `DEV-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("devis").insert({
        artisan_id: user.id,
        chantier_id: chantierId,
        numero,
        montant_ht: parseFloat(devisForm.montant_ht) || 0,
        tva: parseFloat(devisForm.tva) || 20,
        statut: devisForm.statut as any,
        date_validite: devisForm.date_validite || null,
      });
      if (error) throw error;
      toast.success(`Devis ${numero} créé`);
      setCreateDevisOpen(false);
      resetDevisForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la création");
    }
    setSaving(false);
  };

  const resetDevisForm = () => {
    setDevisForm({
      chantier_id: "", numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_validite: "",
      client_nom: "", client_email: "", client_telephone: "", client_adresse: "", client_type: "particulier",
      chantier_nom: "", chantier_adresse: "", chantier_date_debut: "", chantier_date_fin_prevue: "",
      use_existing_chantier: true,
    });
    setAiResult(null);
    setDescription("");
  };

  // Create facture
  const handleCreateFacture = async () => {
    if (!user) return;
    setSaving(true);
    const numero = factureForm.numero || `FAC-${Date.now().toString(36).toUpperCase()}`;
    const montant = parseFloat(factureForm.montant_ht) || 0;
    const { error } = await supabase.from("factures").insert({
      artisan_id: user.id,
      devis_id: factureForm.devis_id,
      numero,
      montant_ht: montant,
      tva: parseFloat(factureForm.tva) || 20,
      statut: factureForm.statut as any,
      date_echeance: factureForm.date_echeance,
      solde_restant: parseFloat(factureForm.solde_restant) || montant,
    });
    if (error) toast.error(error.message);
    else { toast.success(`Facture ${numero} créée`); setCreateFactureOpen(false); fetchData(); }
    setSaving(false);
  };

  // AI generation
  const handleGenerateAI = async () => {
    if (!description) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("call-openai", {
        body: {
          messages: [{
            role: "user",
            content: `Génère un devis détaillé pour les travaux suivants. Fournis les postes de travaux avec quantité, prix unitaire HT et total. Réponds en JSON structuré : { "postes": [{ "designation": "", "quantite": 1, "unite": "u", "prix_unitaire": 0 }], "total_ht": 0 }\n\nDescription : ${description}`,
          }],
        },
      });
      if (error) throw error;
      const content = data?.choices?.[0]?.message?.content;
      setAiResult(content || "Pas de réponse");
      // Try to auto-fill montant
      try {
        const jsonMatch = content?.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.total_ht) setDevisForm(p => ({ ...p, montant_ht: String(parsed.total_ht) }));
        }
      } catch {}
    } catch (err: any) {
      toast.error(err.message || "Erreur IA");
    } finally {
      setAiLoading(false);
    }
  };

  // Edit handlers
  const openEditDevis = (d: Devis) => {
    setEditDevis(d);
    setEditForm({
      montant_ht: String(d.montant_ht), tva: String(d.tva), statut: d.statut,
      date_validite: d.date_validite || "", numero: d.numero, date_echeance: "", solde_restant: "",
      chantier_id: d.chantier_id, facturx_ready: d.facturx_ready,
    });
    setEditType("devis");
    setEditDialogOpen(true);
  };

  const openEditFacture = (f: Facture) => {
    setEditFacture(f);
    setEditForm({
      montant_ht: String(f.montant_ht), tva: String(f.tva), statut: f.statut,
      date_echeance: f.date_echeance, solde_restant: String(f.solde_restant), numero: f.numero, date_validite: "",
      chantier_id: "", facturx_ready: false,
    });
    setEditType("facture");
    setEditDialogOpen(true);
  };

  // Open detail view
  const openDevisDetail = (d: Devis) => {
    setEditDevis(d);
    setEditForm({
      montant_ht: String(d.montant_ht), tva: String(d.tva), statut: d.statut,
      date_validite: d.date_validite || "", numero: d.numero, date_echeance: "", solde_restant: "",
      chantier_id: d.chantier_id, facturx_ready: d.facturx_ready,
    });
    setDetailType("devis");
    setDetailOpen(true);
  };

  const openFactureDetail = (f: Facture) => {
    setEditFacture(f);
    setEditForm({
      montant_ht: String(f.montant_ht), tva: String(f.tva), statut: f.statut,
      date_echeance: f.date_echeance, solde_restant: String(f.solde_restant), numero: f.numero, date_validite: "",
      chantier_id: "", facturx_ready: false,
    });
    setDetailType("facture");
    setDetailOpen(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    if (editType === "devis" && editDevis) {
      const { error } = await supabase.from("devis").update({
        numero: editForm.numero, montant_ht: parseFloat(editForm.montant_ht) || 0,
        tva: parseFloat(editForm.tva) || 20, statut: editForm.statut as any,
        date_validite: editForm.date_validite || null,
      }).eq("id", editDevis.id);
      if (error) toast.error(error.message);
      else { toast.success("Devis modifié"); setEditDialogOpen(false); fetchData(); }
    } else if (editType === "facture" && editFacture) {
      const { error } = await supabase.from("factures").update({
        numero: editForm.numero, montant_ht: parseFloat(editForm.montant_ht) || 0,
        tva: parseFloat(editForm.tva) || 20, statut: editForm.statut as any,
        date_echeance: editForm.date_echeance, solde_restant: parseFloat(editForm.solde_restant) || 0,
      }).eq("id", editFacture.id);
      if (error) toast.error(error.message);
      else { toast.success("Facture modifiée"); setEditDialogOpen(false); fetchData(); }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const table = deleteType === "devis" ? "devis" : "factures";
    const { error } = await supabase.from(table).delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success(`${deleteType === "devis" ? "Devis" : "Facture"} supprimé(e)`); fetchData(); }
    setDeleteDialogOpen(false);
    setDeleteId(null);
  };

  const openTemplatePdf = async (type: "devis" | "facture", id: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf-html`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(type === "devis" ? { type, devis_id: id } : { type, facture_id: id }),
        }
      );
      const data = await resp.json();
      if (!resp.ok || !data.html) throw new Error(data.error ?? "Erreur génération");
      const win = window.open("", "_blank");
      if (win) { win.document.write(data.html); win.document.close(); }
      else toast.error("Autorisez les popups pour ouvrir le PDF");
    } catch (e: any) {
      toast.error("Erreur PDF : " + e.message);
    }
  };

  const downloadDevisPdf = (d: Devis) => {
    openTemplatePdf("devis", d.id);
  };

  const downloadFacturePdf = (f: Facture) => {
    openTemplatePdf("facture", f.id);
  };

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between animate-fade-up flex-wrap gap-2">
        <h1 className="text-h2 font-display">Documents</h1>
        <div className="flex gap-2">
          <Button onClick={() => { resetDevisForm(); setCreateDevisOpen(true); }} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
            <Plus className="w-4 h-4 mr-1" /> Nouveau devis
          </Button>
          <Button variant="outline" onClick={() => { setFactureForm({ devis_id: "", numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_echeance: "", solde_restant: "" }); setCreateFactureOpen(true); }} className="touch-target">
            <Plus className="w-4 h-4 mr-1" /> Nouvelle facture
          </Button>
        </div>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="devis" className="touch-target"><FileText className="w-4 h-4 mr-1" /> Devis</TabsTrigger>
          <TabsTrigger value="factures" className="touch-target"><Receipt className="w-4 h-4 mr-1" /> Factures</TabsTrigger>
        </TabsList>

        <TabsContent value="devis">
          <div className="space-y-2 mt-4">
            {devis.length === 0 && <p className="text-center text-muted-foreground py-12">Aucun devis</p>}
            {devis.map((d) => (
              <div key={d.id} className="forge-card flex items-center justify-between !p-4 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => openDevisDetail(d)}>
                <div>
                  <p className="font-medium">{d.numero}</p>
                  <p className="text-small text-muted-foreground font-mono">{Number(d.montant_ht).toLocaleString("fr-FR")} € HT • TVA {Number(d.tva)}%</p>
                  {d.date_validite && <p className="text-small text-muted-foreground">Validité : {new Date(d.date_validite).toLocaleDateString("fr-FR")}</p>}
                  <p className="text-small text-muted-foreground">Chantier : {chantiers.find(c => c.id === d.chantier_id)?.nom || "—"}</p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadDevisPdf(d)}><Download className="w-4 h-4 text-primary" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteId(d.id); setDeleteType("devis"); setDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  <Badge variant="secondary" className={devisStatutStyles[d.statut] || ""}>{devisStatutLabels[d.statut] || d.statut}</Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="factures">
          <div className="space-y-2 mt-4">
            {factures.length === 0 && <p className="text-center text-muted-foreground py-12">Aucune facture</p>}
            {factures.map((f) => (
              <div key={f.id} className="forge-card flex items-center justify-between !p-4 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => openFactureDetail(f)}>
                <div>
                  <p className="font-medium">{f.numero}</p>
                  <p className="text-small text-muted-foreground font-mono">{Number(f.montant_ht).toLocaleString("fr-FR")} € HT • TVA {Number(f.tva)}%</p>
                  <p className="text-small text-muted-foreground">Échéance : {new Date(f.date_echeance).toLocaleDateString("fr-FR")} • Reste : {Number(f.solde_restant).toLocaleString("fr-FR")} €</p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadFacturePdf(f)}><Download className="w-4 h-4 text-primary" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDeleteId(f.id); setDeleteType("facture"); setDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  <Badge variant="secondary" className={factureStatutStyles[f.statut] || ""}>{factureStatutLabels[f.statut] || f.statut}</Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Devis Dialog */}
      <Dialog open={createDevisOpen} onOpenChange={(o) => { setCreateDevisOpen(o); if (!o) { resetDevisForm(); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Créer un devis</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Toggle: existing chantier or new */}
            <div className="flex gap-2">
              <Button variant={devisForm.use_existing_chantier ? "default" : "outline"} size="sm" onClick={() => setDevisForm(p => ({ ...p, use_existing_chantier: true }))}>
                Chantier existant
              </Button>
              <Button variant={!devisForm.use_existing_chantier ? "default" : "outline"} size="sm" onClick={() => setDevisForm(p => ({ ...p, use_existing_chantier: false }))}>
                Nouveau client + chantier
              </Button>
            </div>

            {devisForm.use_existing_chantier ? (
              <div className="space-y-2">
                <Label>Chantier</Label>
                <Select value={devisForm.chantier_id} onValueChange={(v) => setDevisForm(p => ({ ...p, chantier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{chantiers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium text-foreground">Informations client</p>
                  <div className="space-y-2">
                    <Label>Nom du client</Label>
                    <Input value={devisForm.client_nom} onChange={(e) => setDevisForm(p => ({ ...p, client_nom: e.target.value }))} placeholder="Jean Dupont" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={devisForm.client_email} onChange={(e) => setDevisForm(p => ({ ...p, client_email: e.target.value }))} placeholder="email@..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Téléphone</Label>
                      <Input value={devisForm.client_telephone} onChange={(e) => setDevisForm(p => ({ ...p, client_telephone: e.target.value }))} placeholder="06..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Adresse client *</Label>
                    <AddressFields
                      value={devisForm.client_adresse}
                      onChange={(v) => setDevisForm(p => ({ ...p, client_adresse: v }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={devisForm.client_type} onValueChange={(v) => setDevisForm(p => ({ ...p, client_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="particulier">Particulier</SelectItem>
                        <SelectItem value="pro">Professionnel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium text-foreground">Informations chantier</p>
                  <div className="space-y-2">
                    <Label>Nom du chantier</Label>
                    <Input value={devisForm.chantier_nom} onChange={(e) => setDevisForm(p => ({ ...p, chantier_nom: e.target.value }))} placeholder="Rénovation salle de bain" />
                  </div>
                  <div className="space-y-2">
                    <Label>Adresse du chantier *</Label>
                    <AddressFields
                      value={devisForm.chantier_adresse}
                      onChange={(v) => setDevisForm(p => ({ ...p, chantier_adresse: v }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label>Date début</Label>
                      <Input type="date" value={devisForm.chantier_date_debut} onChange={(e) => setDevisForm(p => ({ ...p, chantier_date_debut: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Date fin prévue</Label>
                      <Input type="date" value={devisForm.chantier_date_fin_prevue} onChange={(e) => setDevisForm(p => ({ ...p, chantier_date_fin_prevue: e.target.value }))} />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Numéro</Label>
                <Input value={devisForm.numero} onChange={(e) => setDevisForm(p => ({ ...p, numero: e.target.value }))} placeholder="Auto-généré" />
              </div>
              <div className="space-y-2">
                <Label>Montant HT (€)</Label>
                <Input type="number" value={devisForm.montant_ht} onChange={(e) => setDevisForm(p => ({ ...p, montant_ht: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>TVA (%)</Label>
                <Input type="number" value={devisForm.tva} onChange={(e) => setDevisForm(p => ({ ...p, tva: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date validité</Label>
                <Input type="date" value={devisForm.date_validite} onChange={(e) => setDevisForm(p => ({ ...p, date_validite: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={devisForm.statut} onValueChange={(v) => setDevisForm(p => ({ ...p, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(devisStatutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* AI assist */}
            <div className="border-t pt-3 space-y-2">
              <Label>Génération IA (optionnel)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Décrivez les travaux pour un chiffrage IA…" rows={3} />
              <Button onClick={handleGenerateAI} disabled={aiLoading || !description} variant="outline" className="w-full">
                <Bot className="w-4 h-4 mr-2" />{aiLoading ? "Génération…" : "Chiffrer avec l'IA"}
              </Button>
              {aiResult && (
                <div className="bg-card rounded-lg p-3 text-sm font-mono whitespace-pre-wrap max-h-40 overflow-y-auto border">
                  {aiResult}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDevisOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateDevis} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Création…" : "Créer le devis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Facture Dialog */}
      <Dialog open={createFactureOpen} onOpenChange={setCreateFactureOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Nouvelle facture</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Devis associé</Label>
              <Select value={factureForm.devis_id} onValueChange={(v) => setFactureForm(p => ({ ...p, devis_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un devis" /></SelectTrigger>
                <SelectContent>{devis.map((d) => <SelectItem key={d.id} value={d.id}>{d.numero} — {Number(d.montant_ht).toLocaleString("fr-FR")} €</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Numéro</Label>
                <Input value={factureForm.numero} onChange={(e) => setFactureForm(p => ({ ...p, numero: e.target.value }))} placeholder="Auto-généré" />
              </div>
              <div className="space-y-2">
                <Label>Montant HT (€)</Label>
                <Input type="number" value={factureForm.montant_ht} onChange={(e) => setFactureForm(p => ({ ...p, montant_ht: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>TVA (%)</Label>
                <Input type="number" value={factureForm.tva} onChange={(e) => setFactureForm(p => ({ ...p, tva: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date d'échéance</Label>
                <Input type="date" value={factureForm.date_echeance} onChange={(e) => setFactureForm(p => ({ ...p, date_echeance: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Solde restant (€)</Label>
                <Input type="number" value={factureForm.solde_restant} onChange={(e) => setFactureForm(p => ({ ...p, solde_restant: e.target.value }))} placeholder="= Montant HT" />
              </div>
              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={factureForm.statut} onValueChange={(v) => setFactureForm(p => ({ ...p, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(factureStatutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFactureOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateFacture} disabled={saving || !factureForm.devis_id || !factureForm.date_echeance} className="bg-primary text-primary-foreground">
              {saving ? "Création…" : "Créer la facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">
              Modifier {editType === "devis" ? `le devis ${editDevis?.numero}` : `la facture ${editFacture?.numero}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Numéro</Label>
              <Input value={editForm.numero} onChange={(e) => setEditForm(p => ({ ...p, numero: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant HT (€)</Label>
                <Input type="number" value={editForm.montant_ht} onChange={(e) => setEditForm(p => ({ ...p, montant_ht: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>TVA (%)</Label>
                <Input type="number" value={editForm.tva} onChange={(e) => setEditForm(p => ({ ...p, tva: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editForm.statut} onValueChange={(v) => setEditForm(p => ({ ...p, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {editType === "devis"
                    ? Object.entries(devisStatutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)
                    : Object.entries(factureStatutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            {editType === "devis" && (
              <div className="space-y-2">
                <Label>Date de validité</Label>
                <Input type="date" value={editForm.date_validite} onChange={(e) => setEditForm(p => ({ ...p, date_validite: e.target.value }))} />
              </div>
            )}
            {editType === "facture" && (
              <>
                <div className="space-y-2">
                  <Label>Date d'échéance</Label>
                  <Input type="date" value={editForm.date_echeance} onChange={(e) => setEditForm(p => ({ ...p, date_echeance: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Solde restant (€)</Label>
                  <Input type="number" value={editForm.solde_restant} onChange={(e) => setEditForm(p => ({ ...p, solde_restant: e.target.value }))} />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="bg-primary text-primary-foreground">Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Voulez-vous vraiment supprimer {deleteType === "devis" ? "ce devis" : "cette facture"} ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Dialog — full view of devis or facture with inline edit */}
      {/*
        Statuts devis : brouillon → envoye (envoi au client) → signe (client accepte) ou refuse (client refuse)
        Changements auto possibles : envoye quand envoyé par email, signe quand signature électronique reçue
        
        Statuts facture : brouillon → envoyee (envoi au client) → payee (paiement total reçu) ou impayee (échéance dépassée sans paiement)
        Changements auto possibles : payee quand solde_restant = 0, impayee quand date_echeance < now() et solde_restant > 0
      */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {detailType === "devis" ? `Devis ${editDevis?.numero || ""}` : `Facture ${editFacture?.numero || ""}`}
            </DialogTitle>
          </DialogHeader>
          {detailType === "devis" && editDevis && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Numéro</p><Input value={editForm.numero} onChange={(e) => setEditForm(p => ({ ...p, numero: e.target.value }))} /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <Select value={editForm.statut} onValueChange={(v) => setEditForm(p => ({ ...p, statut: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(devisStatutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Montant HT (€)</p><Input type="number" value={editForm.montant_ht} onChange={(e) => setEditForm(p => ({ ...p, montant_ht: e.target.value }))} /></div>
                <div><p className="text-xs text-muted-foreground">TVA (%)</p><Input type="number" value={editForm.tva} onChange={(e) => setEditForm(p => ({ ...p, tva: e.target.value }))} /></div>
              </div>
              <div><p className="text-xs text-muted-foreground">Montant TTC</p><p className="font-mono font-semibold text-foreground">{((parseFloat(editForm.montant_ht) || 0) * (1 + (parseFloat(editForm.tva) || 20) / 100)).toLocaleString("fr-FR")} €</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Date de validité</p><Input type="date" value={editForm.date_validite} onChange={(e) => setEditForm(p => ({ ...p, date_validite: e.target.value }))} /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Chantier</p>
                  <Select value={editForm.chantier_id} onValueChange={(v) => setEditForm(p => ({ ...p, chantier_id: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{chantiers.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={editForm.facturx_ready} onChange={(e) => setEditForm(p => ({ ...p, facturx_ready: e.target.checked }))} className="rounded" />
                <span className="text-sm text-muted-foreground">Factur-X ready</span>
              </div>
              <div className="text-xs text-muted-foreground">Créé le {new Date(editDevis.created_at).toLocaleString("fr-FR")} • Modifié le {new Date(editDevis.updated_at).toLocaleString("fr-FR")}</div>
            </div>
          )}
          {detailType === "facture" && editFacture && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Numéro</p><Input value={editForm.numero} onChange={(e) => setEditForm(p => ({ ...p, numero: e.target.value }))} /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Statut</p>
                  <Select value={editForm.statut} onValueChange={(v) => setEditForm(p => ({ ...p, statut: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(factureStatutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Montant HT (€)</p><Input type="number" value={editForm.montant_ht} onChange={(e) => setEditForm(p => ({ ...p, montant_ht: e.target.value }))} /></div>
                <div><p className="text-xs text-muted-foreground">TVA (%)</p><Input type="number" value={editForm.tva} onChange={(e) => setEditForm(p => ({ ...p, tva: e.target.value }))} /></div>
              </div>
              <div><p className="text-xs text-muted-foreground">Montant TTC</p><p className="font-mono font-semibold text-foreground">{((parseFloat(editForm.montant_ht) || 0) * (1 + (parseFloat(editForm.tva) || 20) / 100)).toLocaleString("fr-FR")} €</p></div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Date d'échéance</p><Input type="date" value={editForm.date_echeance} onChange={(e) => setEditForm(p => ({ ...p, date_echeance: e.target.value }))} /></div>
                <div><p className="text-xs text-muted-foreground">Solde restant (€)</p><Input type="number" value={editForm.solde_restant} onChange={(e) => setEditForm(p => ({ ...p, solde_restant: e.target.value }))} /></div>
              </div>
              <div><p className="text-xs text-muted-foreground">Devis associé</p><p className="text-sm">{devis.find(d => d.id === editFacture.devis_id)?.numero || editFacture.devis_id}</p></div>
              <div className="text-xs text-muted-foreground">Créé le {new Date(editFacture.created_at).toLocaleString("fr-FR")} • Modifié le {new Date(editFacture.updated_at).toLocaleString("fr-FR")}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fermer</Button>
            <Button onClick={async () => {
              setSaving(true);
              if (detailType === "devis" && editDevis) {
                const { error } = await supabase.from("devis").update({
                  numero: editForm.numero, montant_ht: parseFloat(editForm.montant_ht) || 0,
                  tva: parseFloat(editForm.tva) || 20, statut: editForm.statut as any,
                  date_validite: editForm.date_validite || null, chantier_id: editForm.chantier_id,
                  facturx_ready: editForm.facturx_ready,
                }).eq("id", editDevis.id);
                if (error) toast.error(error.message);
                else { toast.success("Devis mis à jour"); setDetailOpen(false); fetchData(); }
              } else if (detailType === "facture" && editFacture) {
                const { error } = await supabase.from("factures").update({
                  numero: editForm.numero, montant_ht: parseFloat(editForm.montant_ht) || 0,
                  tva: parseFloat(editForm.tva) || 20, statut: editForm.statut as any,
                  date_echeance: editForm.date_echeance, solde_restant: parseFloat(editForm.solde_restant) || 0,
                }).eq("id", editFacture.id);
                if (error) toast.error(error.message);
                else { toast.success("Facture mise à jour"); setDetailOpen(false); fetchData(); }
              }
              setSaving(false);
            }} disabled={saving} className="bg-primary text-primary-foreground">
              {saving ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
