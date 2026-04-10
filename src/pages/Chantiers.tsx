import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Calendar, LayoutGrid, List, Trash2, Edit, Users, FileText, Receipt, Download, Loader2 } from "lucide-react";
import AddressFields from "@/components/ui/AddressFields";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { Database } from "@/integrations/supabase/types";

type Chantier = Database["public"]["Tables"]["chantiers"]["Row"];
type ChantierStatut = Database["public"]["Enums"]["chantier_statut"];
type Client = Database["public"]["Tables"]["clients"]["Row"];

const statutLabels: Record<ChantierStatut, string> = {
  prospect: "Prospect",
  en_cours: "En cours",
  termine: "Terminé",
  litige: "Litige",
};

const statutStyles: Record<ChantierStatut, string> = {
  prospect: "bg-muted text-muted-foreground",
  en_cours: "bg-primary/10 text-primary",
  termine: "bg-success/10 text-success",
  litige: "bg-destructive/10 text-destructive",
};

const clientTypeLabels: Record<string, string> = { particulier: "Particulier", pro: "Professionnel" };

function DraggableKanbanCard({ chantier, onClick }: { chantier: Chantier; onClick: (ch: Chantier) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: chantier.id,
    data: { type: "chantier", chantier },
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="forge-card cursor-grab active:cursor-grabbing !p-3 touch-manipulation"
      onPointerUp={(e) => {
        // Only trigger click if no significant drag occurred
        if (!transform || (Math.abs(transform.x) < 5 && Math.abs(transform.y) < 5)) {
          onClick(chantier);
        }
      }}
    >
      <p className="font-medium text-sm">{chantier.nom}</p>
      {chantier.adresse_chantier && (
        <p className="text-small text-muted-foreground flex items-center gap-1 mt-1">
          <MapPin className="w-3 h-3" /> {chantier.adresse_chantier}
        </p>
      )}
      {chantier.date_debut && (
        <p className="text-small text-muted-foreground flex items-center gap-1 mt-1">
          <Calendar className="w-3 h-3" /> {new Date(chantier.date_debut).toLocaleDateString("fr-FR")}
        </p>
      )}
      <Badge variant="secondary" className={`${statutStyles[chantier.statut]} mt-2 text-[10px]`}>{statutLabels[chantier.statut]}</Badge>
    </div>
  );
}

function KanbanColumn({ statut, chantiers: items, onCardClick }: { statut: ChantierStatut; chantiers: Chantier[]; onCardClick: (ch: Chantier) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: statut });

  return (
    <div
      ref={setNodeRef}
      className={`space-y-2 min-h-[120px] p-2 rounded-lg transition-colors ${isOver ? "bg-primary/5 ring-1 ring-primary/20" : ""}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className={`${statutStyles[statut]} animate-badge-in`}>{statutLabels[statut]}</Badge>
        <span className="text-small text-muted-foreground font-mono">{items.length}</span>
      </div>
      {items.map((ch) => (
        <DraggableKanbanCard key={ch.id} chantier={ch} onClick={onCardClick} />
      ))}
      {items.length === 0 && (
        <p className="text-small text-muted-foreground text-center py-8">Aucun chantier</p>
      )}
    </div>
  );
}

export default function Chantiers() {
  const { user } = useAuth();
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeChantier, setActiveChantier] = useState<Chantier | null>(null);

  // Detail dialog
  const [detailChantier, setDetailChantier] = useState<Chantier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailForm, setDetailForm] = useState({ nom: "", client_id: "", adresse_chantier: "", statut: "prospect" as ChantierStatut, date_debut: "", date_fin_prevue: "" });

  const openChantierDetail = (ch: Chantier) => {
    setDetailChantier(ch);
    setDetailForm({
      nom: ch.nom, client_id: ch.client_id, adresse_chantier: ch.adresse_chantier || "",
      statut: ch.statut, date_debut: ch.date_debut || "", date_fin_prevue: ch.date_fin_prevue || "",
    });
    setChantierDevis([]);
    setChantierFactures([]);
    loadChantierDocs(ch.id);
    setDetailOpen(true);
  };

  const handleSaveDetail = async () => {
    if (!detailChantier) return;
    setLoading(true);
    const { error } = await supabase.from("chantiers").update({
      nom: detailForm.nom, client_id: detailForm.client_id, adresse_chantier: detailForm.adresse_chantier || null,
      statut: detailForm.statut, date_debut: detailForm.date_debut || null, date_fin_prevue: detailForm.date_fin_prevue || null,
    }).eq("id", detailChantier.id);
    if (error) toast.error(error.message);
    else { toast.success("Chantier mis à jour"); setDetailOpen(false); fetchData(); }
    setLoading(false);
  };

  // Chantier dialog
  const [chantierDialogOpen, setChantierDialogOpen] = useState(false);
  const [editChantier, setEditChantier] = useState<Chantier | null>(null);
  const [chForm, setChForm] = useState({ nom: "", client_id: "", adresse_chantier: "", statut: "prospect" as ChantierStatut, date_debut: "", date_fin_prevue: "" });

  // Client dialog
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [clForm, setClForm] = useState({ nom: "", type: "particulier" as "particulier" | "pro", adresse: "", telephone: "", email: "" });

  const [loading, setLoading] = useState(false);

  // Devis/Factures dans la fiche chantier
  type DevisRow = { id: string; numero: string; montant_ht: number; tva: number; statut: string; date_validite: string | null; created_at: string };
  type FactureRow = { id: string; numero: string; montant_ht: number; tva: number; statut: string; date_echeance: string; solde_restant: number };
  const [chantierDevis, setChantierDevis] = useState<DevisRow[]>([]);
  const [chantierFactures, setChantierFactures] = useState<FactureRow[]>([]);
  const [chantierDocsLoading, setChantierDocsLoading] = useState(false);
  const [newDevisForm, setNewDevisForm] = useState({ numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_validite: "" });
  const [addDevisOpen, setAddDevisOpen] = useState(false);

  const loadChantierDocs = async (chantierId: string) => {
    setChantierDocsLoading(true);
    const [devisRes, facturesRes] = await Promise.all([
      supabase.from("devis").select("id, numero, montant_ht, tva, statut, date_validite, created_at")
        .eq("chantier_id", chantierId).order("created_at", { ascending: false }),
      supabase.from("factures").select("id, numero, montant_ht, tva, statut, date_echeance, solde_restant")
        .eq("artisan_id", user!.id).order("created_at", { ascending: false }),
    ]);
    const devisIds = (devisRes.data ?? []).map((d: DevisRow) => d.id);
    setChantierDevis((devisRes.data ?? []) as DevisRow[]);
    setChantierFactures(((facturesRes.data ?? []) as FactureRow[]).filter(f => devisIds.includes((f as any).devis_id)));
    setChantierDocsLoading(false);
  };

  const handleAddDevis = async (chantierId: string) => {
    if (!user) return;
    setLoading(true);
    const numero = newDevisForm.numero || `DEV-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("devis").insert({
      artisan_id: user.id,
      chantier_id: chantierId,
      numero,
      montant_ht: parseFloat(newDevisForm.montant_ht) || 0,
      tva: parseFloat(newDevisForm.tva) || 20,
      statut: newDevisForm.statut as any,
      date_validite: newDevisForm.date_validite || null,
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success(`Devis ${numero} créé`);
      setAddDevisOpen(false);
      setNewDevisForm({ numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_validite: "" });
      loadChantierDocs(chantierId);
    }
    setLoading(false);
  };

  const openTemplatePdf = async (type: "devis" | "facture", id: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-pdf-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(type === "devis" ? { type, devis_id: id } : { type, facture_id: id }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.html) throw new Error(data.error ?? "Erreur génération");
      const win = window.open("", "_blank");
      if (win) { win.document.write(data.html); win.document.close(); }
      else toast.error("Autorisez les popups pour ouvrir le PDF");
    } catch (e: any) { toast.error("Erreur PDF : " + e.message); }
  };

  const devisStatutStyles: Record<string, string> = {
    brouillon: "bg-muted text-muted-foreground", envoye: "bg-yellow-500/10 text-yellow-700",
    signe: "bg-green-500/10 text-green-700", refuse: "bg-destructive/10 text-destructive",
  };
  const factureStatutStyles: Record<string, string> = {
    brouillon: "bg-muted text-muted-foreground", envoyee: "bg-primary/10 text-primary",
    payee: "bg-green-500/10 text-green-700", impayee: "bg-destructive/10 text-destructive",
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const fetchData = async () => {
    if (!user) return;
    const [chantiersRes, clientsRes] = await Promise.all([
      supabase.from("chantiers").select("*").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("clients").select("*").eq("artisan_id", user.id).order("nom"),
    ]);
    if (chantiersRes.data) setChantiers(chantiersRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
  };

  useEffect(() => { fetchData(); }, [user]);

  // Chantier CRUD
  const openNewChantier = () => {
    setEditChantier(null);
    setChForm({ nom: "", client_id: "", adresse_chantier: "", statut: "prospect", date_debut: "", date_fin_prevue: "" });
    setChantierDialogOpen(true);
  };

  const openEditChantier = (ch: Chantier) => {
    setEditChantier(ch);
    setChForm({
      nom: ch.nom,
      client_id: ch.client_id,
      adresse_chantier: ch.adresse_chantier || "",
      statut: ch.statut,
      date_debut: ch.date_debut || "",
      date_fin_prevue: ch.date_fin_prevue || "",
    });
    setChantierDialogOpen(true);
  };

  const handleSaveChantier = async () => {
    if (!user) return;
    setLoading(true);
    if (editChantier) {
      const { error } = await supabase.from("chantiers").update({
        nom: chForm.nom || editChantier.nom,
        client_id: chForm.client_id || editChantier.client_id,
        adresse_chantier: chForm.adresse_chantier || null,
        statut: chForm.statut,
        date_debut: chForm.date_debut || null,
        date_fin_prevue: chForm.date_fin_prevue || null,
      }).eq("id", editChantier.id);
      if (error) toast.error(error.message);
      else { toast.success("Chantier modifié"); setChantierDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("chantiers").insert({
        artisan_id: user.id,
        nom: chForm.nom,
        client_id: chForm.client_id,
        adresse_chantier: chForm.adresse_chantier || null,
        statut: chForm.statut,
        date_debut: chForm.date_debut || null,
        date_fin_prevue: chForm.date_fin_prevue || null,
      });
      if (error) toast.error(error.message);
      else { toast.success("Chantier créé"); setChantierDialogOpen(false); fetchData(); }
    }
    setLoading(false);
  };

  const handleDeleteChantier = async (id: string, nom: string) => {
    const { error } = await supabase.from("chantiers").delete().eq("id", id);
    if (error) toast.error("Erreur : " + error.message);
    else { toast.success(`Chantier "${nom}" supprimé`); setChantiers(prev => prev.filter(c => c.id !== id)); }
  };

  // Client CRUD
  const openNewClient = () => {
    setEditClient(null);
    setClForm({ nom: "", type: "particulier", adresse: "", telephone: "", email: "" });
    setClientDialogOpen(true);
  };

  const openEditClient = (cl: Client) => {
    setEditClient(cl);
    setClForm({ nom: cl.nom, type: cl.type, adresse: cl.adresse || "", telephone: cl.telephone || "", email: cl.email || "" });
    setClientDialogOpen(true);
  };

  const handleSaveClient = async () => {
    if (!user) return;
    setLoading(true);
    if (editClient) {
      const { error } = await supabase.from("clients").update({
        nom: clForm.nom || editClient.nom,
        type: clForm.type,
        adresse: clForm.adresse || null,
        telephone: clForm.telephone || null,
        email: clForm.email || null,
      }).eq("id", editClient.id);
      if (error) toast.error(error.message);
      else { toast.success("Client modifié"); setClientDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("clients").insert({
        artisan_id: user.id,
        nom: clForm.nom,
        type: clForm.type,
        adresse: clForm.adresse || null,
        telephone: clForm.telephone || null,
        email: clForm.email || null,
      });
      if (error) toast.error(error.message);
      else { toast.success("Client créé"); setClientDialogOpen(false); fetchData(); }
    }
    setLoading(false);
  };

  const handleDeleteClient = async (id: string, nom: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error("Erreur : " + error.message);
    else { toast.success(`Client "${nom}" supprimé`); setClients(prev => prev.filter(c => c.id !== id)); }
  };

  // Kanban D&D
  const handleDragStart = (event: DragStartEvent) => {
    const ch = chantiers.find(c => c.id === event.active.id);
    if (ch) setActiveChantier(ch);
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveChantier(null);
    const { active, over } = event;
    if (!over) return;

    const chantierId = active.id as string;
    const newStatut = over.id as ChantierStatut;
    const columns: ChantierStatut[] = ["prospect", "en_cours", "termine", "litige"];
    if (!columns.includes(newStatut)) return;

    const chantier = chantiers.find(c => c.id === chantierId);
    if (!chantier || chantier.statut === newStatut) return;

    setChantiers(prev => prev.map(c => c.id === chantierId ? { ...c, statut: newStatut } : c));

    const { error } = await supabase.from("chantiers").update({ statut: newStatut }).eq("id", chantierId);
    if (error) {
      toast.error("Erreur de mise à jour du statut");
      setChantiers(prev => prev.map(c => c.id === chantierId ? { ...c, statut: chantier.statut } : c));
    } else {
      toast.success(`${chantier.nom} → ${statutLabels[newStatut]}`);
    }
  }, [chantiers]);

  const columns: ChantierStatut[] = ["prospect", "en_cours", "termine", "litige"];

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between animate-fade-up flex-wrap gap-2">
        <h1 className="text-h2 font-display">Chantiers</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={openNewClient} className="touch-target">
            <Users className="w-4 h-4 mr-1" /> Nouveau client
          </Button>
          <Button onClick={openNewChantier} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
            <Plus className="w-4 h-4 mr-1" /> Nouveau chantier
          </Button>
        </div>
      </div>

      <Tabs defaultValue="kanban">
        <TabsList className="bg-secondary">
          <TabsTrigger value="kanban" className="touch-target"><LayoutGrid className="w-4 h-4 mr-1" /> Kanban</TabsTrigger>
          <TabsTrigger value="liste" className="touch-target"><List className="w-4 h-4 mr-1" /> Liste</TabsTrigger>
          <TabsTrigger value="clients" className="touch-target"><Users className="w-4 h-4 mr-1" /> Clients</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              {columns.map((col) => (
                <KanbanColumn key={col} statut={col} chantiers={chantiers.filter((c) => c.statut === col)} onCardClick={openChantierDetail} />
              ))}
            </div>
            <DragOverlay>
              {activeChantier ? (
                <div className="forge-card !p-3 shadow-lg rotate-2 opacity-90">
                  <p className="font-medium text-sm">{activeChantier.nom}</p>
                  {activeChantier.adresse_chantier && (
                    <p className="text-small text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3" /> {activeChantier.adresse_chantier}
                    </p>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </TabsContent>

        <TabsContent value="liste">
          <div className="space-y-2 mt-4">
            {chantiers.length === 0 && <p className="text-center text-muted-foreground py-12">Aucun chantier pour le moment</p>}
            {chantiers.map((ch) => (
              <div key={ch.id} className="forge-card flex items-center justify-between !p-4 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => openChantierDetail(ch)}>
                <div>
                  <p className="font-medium">{ch.nom}</p>
                  {ch.adresse_chantier && <p className="text-small text-muted-foreground">{ch.adresse_chantier}</p>}
                  {ch.date_debut && <p className="text-small text-muted-foreground">Début : {new Date(ch.date_debut).toLocaleDateString("fr-FR")}</p>}
                  <p className="text-small text-muted-foreground">Client : {clients.find(c => c.id === ch.client_id)?.nom || "—"}</p>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Badge variant="secondary" className={statutStyles[ch.statut]}>{statutLabels[ch.statut]}</Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce chantier ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible. Le chantier "{ch.nom}" sera définitivement supprimé.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteChantier(ch.id, ch.nom)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="clients">
          <div className="space-y-2 mt-4">
            {clients.length === 0 && <p className="text-center text-muted-foreground py-12">Aucun client pour le moment</p>}
            {clients.map((cl) => (
              <div key={cl.id} className="forge-card flex items-center justify-between !p-4">
                <div>
                  <p className="font-medium">{cl.nom}</p>
                  <p className="text-small text-muted-foreground">{clientTypeLabels[cl.type]}{cl.email ? ` • ${cl.email}` : ""}{cl.telephone ? ` • ${cl.telephone}` : ""}</p>
                  {cl.adresse && <p className="text-small text-muted-foreground">{cl.adresse}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditClient(cl)}>
                    <Edit className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                        <AlertDialogDescription>Le client "{cl.nom}" sera définitivement supprimé.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteClient(cl.id, cl.nom)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Chantier Dialog */}
      <Dialog open={chantierDialogOpen} onOpenChange={setChantierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editChantier ? "Modifier le chantier" : "Nouveau chantier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nom du chantier</Label>
              <Input value={chForm.nom} onChange={(e) => setChForm(p => ({ ...p, nom: e.target.value }))} placeholder="Rénovation cuisine" />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <Select value={chForm.client_id} onValueChange={(v) => setChForm(p => ({ ...p, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Adresse du chantier</Label>
              <AddressFields
                value={chForm.adresse_chantier}
                onChange={(v) => setChForm(p => ({ ...p, adresse_chantier: v }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={chForm.statut} onValueChange={(v) => setChForm(p => ({ ...p, statut: v as ChantierStatut }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(statutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Input type="date" value={chForm.date_debut} onChange={(e) => setChForm(p => ({ ...p, date_debut: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Date de fin prévue</Label>
                <Input type="date" value={chForm.date_fin_prevue} onChange={(e) => setChForm(p => ({ ...p, date_fin_prevue: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChantierDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveChantier} disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Dialog */}
      <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editClient ? "Modifier le client" : "Nouveau client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={clForm.nom} onChange={(e) => setClForm(p => ({ ...p, nom: e.target.value }))} placeholder="Jean Dupont" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={clForm.type} onValueChange={(v) => setClForm(p => ({ ...p, type: v as "particulier" | "pro" }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="particulier">Particulier</SelectItem>
                  <SelectItem value="pro">Professionnel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={clForm.email} onChange={(e) => setClForm(p => ({ ...p, email: e.target.value }))} placeholder="jean@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input value={clForm.telephone} onChange={(e) => setClForm(p => ({ ...p, telephone: e.target.value }))} placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <AddressFields
                value={clForm.adresse}
                onChange={(v) => setClForm(p => ({ ...p, adresse: v }))}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveClient} disabled={loading} className="bg-primary text-primary-foreground">
              {loading ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chantier Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="font-display">{detailChantier?.nom || "Détail du chantier"}</DialogTitle>
          </DialogHeader>
          {detailChantier && (
            <Tabs defaultValue="infos" className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="mx-6 mb-2 grid grid-cols-3 shrink-0">
                <TabsTrigger value="infos" className="text-xs">Infos</TabsTrigger>
                <TabsTrigger value="devis" className="text-xs gap-1">
                  <FileText className="w-3 h-3" /> Devis {chantierDevis.length > 0 && `(${chantierDevis.length})`}
                </TabsTrigger>
                <TabsTrigger value="factures" className="text-xs gap-1">
                  <Receipt className="w-3 h-3" /> Factures {chantierFactures.length > 0 && `(${chantierFactures.length})`}
                </TabsTrigger>
              </TabsList>

              {/* Onglet Infos */}
              <TabsContent value="infos" className="flex-1 overflow-y-auto px-6 space-y-4 mt-0">
                <div className="space-y-2">
                  <Label>Nom du chantier</Label>
                  <Input value={detailForm.nom} onChange={(e) => setDetailForm(p => ({ ...p, nom: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={detailForm.client_id} onValueChange={(v) => setDetailForm(p => ({ ...p, client_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Adresse du chantier</Label>
                  <AddressFields value={detailForm.adresse_chantier} onChange={(v) => setDetailForm(p => ({ ...p, adresse_chantier: v }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={detailForm.statut} onValueChange={(v) => setDetailForm(p => ({ ...p, statut: v as ChantierStatut }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(statutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">Statuts : Prospect → En cours → Terminé ou Litige</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Date de début</Label>
                    <Input type="date" value={detailForm.date_debut} onChange={(e) => setDetailForm(p => ({ ...p, date_debut: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Date de fin prévue</Label>
                    <Input type="date" value={detailForm.date_fin_prevue} onChange={(e) => setDetailForm(p => ({ ...p, date_fin_prevue: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pb-2">Créé le {new Date(detailChantier.created_at).toLocaleString("fr-FR")}</p>
              </TabsContent>

              {/* Onglet Devis */}
              <TabsContent value="devis" className="flex-1 overflow-y-auto px-6 mt-0 pb-4">
                <div className="flex justify-between items-center py-3">
                  <p className="text-sm font-medium">Devis liés à ce chantier</p>
                  <Button size="sm" onClick={() => setAddDevisOpen(true)} className="h-8 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Nouveau devis
                  </Button>
                </div>
                {chantierDocsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : chantierDevis.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">Aucun devis pour ce chantier</p>
                ) : (
                  <div className="space-y-2">
                    {chantierDevis.map(d => (
                      <div key={d.id} className="forge-card !p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{d.numero}</p>
                          <p className="text-xs text-muted-foreground">{Number(d.montant_ht).toLocaleString("fr-FR")} € HT • TVA {Number(d.tva)}%</p>
                          {d.date_validite && <p className="text-xs text-muted-foreground">Validité : {new Date(d.date_validite).toLocaleDateString("fr-FR")}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className={`text-[10px] ${devisStatutStyles[d.statut] || ""}`}>{d.statut}</Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTemplatePdf("devis", d.id)}>
                            <Download className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Onglet Factures */}
              <TabsContent value="factures" className="flex-1 overflow-y-auto px-6 mt-0 pb-4">
                <div className="py-3">
                  <p className="text-sm font-medium">Factures liées à ce chantier</p>
                </div>
                {chantierDocsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : chantierFactures.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">Aucune facture pour ce chantier</p>
                ) : (
                  <div className="space-y-2">
                    {chantierFactures.map(f => (
                      <div key={f.id} className="forge-card !p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{f.numero}</p>
                          <p className="text-xs text-muted-foreground">{Number(f.montant_ht).toLocaleString("fr-FR")} € HT</p>
                          <p className="text-xs text-muted-foreground">Échéance : {new Date(f.date_echeance).toLocaleDateString("fr-FR")} • Reste : {Number(f.solde_restant).toLocaleString("fr-FR")} €</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className={`text-[10px] ${factureStatutStyles[f.statut] || ""}`}>{f.statut}</Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openTemplatePdf("facture", f.id)}>
                            <Download className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Footer always visible */}
              <div className="px-6 py-3 border-t shrink-0 flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Fermer</Button>
                <Button size="sm" onClick={handleSaveDetail} disabled={loading} className="bg-primary text-primary-foreground">
                  {loading ? "Enregistrement…" : "Enregistrer"}
                </Button>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Nouveau devis depuis chantier */}
      <Dialog open={addDevisOpen} onOpenChange={setAddDevisOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Nouveau devis</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Numéro (auto si vide)</Label>
              <Input value={newDevisForm.numero} onChange={e => setNewDevisForm(p => ({ ...p, numero: e.target.value }))} placeholder="DEV-001" />
            </div>
            <div className="space-y-1">
              <Label>Montant HT (€)</Label>
              <Input type="number" value={newDevisForm.montant_ht} onChange={e => setNewDevisForm(p => ({ ...p, montant_ht: e.target.value }))} placeholder="0" />
            </div>
            <div className="space-y-1">
              <Label>TVA (%)</Label>
              <Select value={newDevisForm.tva} onValueChange={v => setNewDevisForm(p => ({ ...p, tva: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="5.5">5,5%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date de validité</Label>
              <Input type="date" value={newDevisForm.date_validite} onChange={e => setNewDevisForm(p => ({ ...p, date_validite: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDevisOpen(false)}>Annuler</Button>
            <Button onClick={() => detailChantier && handleAddDevis(detailChantier.id)} disabled={loading}>
              {loading ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
