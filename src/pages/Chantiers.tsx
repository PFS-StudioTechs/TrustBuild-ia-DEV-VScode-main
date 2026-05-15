import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { usePersistedTab } from "@/hooks/usePersistedTab";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Calendar, LayoutGrid, List, Trash2, Edit, Users, FileText, Receipt, Download, Loader2, Mic, Pencil, Eye, Printer, X, FilePlus, Percent } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = usePersistedTab("tab_chantiers", "kanban");

  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // PDF Sheet preview
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState("");
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  // Nouvelle facture depuis chantier
  const [addFactureOpen, setAddFactureOpen] = useState(false);
  const [newFactureForm, setNewFactureForm] = useState({ devis_id: "", date_echeance: "", tva: "20" });
  const [newFactureSaving, setNewFactureSaving] = useState(false);

  // Nouvel avenant depuis chantier
  const [addAvenantOpen, setAddAvenantOpen] = useState(false);
  const [newAvenantForm, setNewAvenantForm] = useState({ devis_id: "", description: "", montant_ht: "", tva: "20", date: "", mode: "montant" as "montant" | "pourcentage", pourcentage: "" });
  const [newAvenantSaving, setNewAvenantSaving] = useState(false);

  // Lignes pour nouveau devis depuis chantier
  type LigneDevis = { _key: string; designation: string; quantite: string; prix_unitaire: string; unite: string };
  const [newDevisLignes, setNewDevisLignes] = useState<LigneDevis[]>([]);
  const mkLigne = (): LigneDevis => ({ _key: String(Date.now() + Math.random()), designation: "", quantite: "1", prix_unitaire: "0", unite: "u" });
  const [activeChantier, setActiveChantier] = useState<Chantier | null>(null);

  // Detail dialog
  const [detailChantier, setDetailChantier] = useState<Chantier | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEditMode, setDetailEditMode] = useState(false);
  const [detailForm, setDetailForm] = useState({ nom: "", client_id: "", adresse_chantier: "", statut: "prospect" as ChantierStatut, date_debut: "", date_fin_prevue: "", description: "" });

  // Micro pour description
  const [descRecording, setDescRecording] = useState(false);
  const descMediaRef = useRef<MediaRecorder | null>(null);
  const descChunksRef = useRef<Blob[]>([]);

  const startDescRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      descChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) descChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(descChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          const data = await resp.json();
          if (data.text) setDetailForm(p => ({ ...p, description: (p.description ? p.description + " " : "") + data.text }));
          else toast.error("Aucun texte détecté");
        } catch { toast.error("Erreur de transcription"); }
      };
      mr.start();
      descMediaRef.current = mr;
      setDescRecording(true);
    } catch { toast.error("Impossible d'accéder au microphone"); }
  };

  const stopDescRecording = () => {
    if (descMediaRef.current?.state === "recording") {
      descMediaRef.current.stop();
      setDescRecording(false);
    }
  };

  const openChantierDetail = (ch: Chantier) => {
    setDetailChantier(ch);
    setDetailEditMode(false);
    setDetailForm({
      nom: ch.nom, client_id: ch.client_id, adresse_chantier: ch.adresse_chantier || "",
      statut: ch.statut, date_debut: ch.date_debut || "", date_fin_prevue: ch.date_fin_prevue || "",
      description: (ch as any).description || "",
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
      description: detailForm.description || null,
    } as any).eq("id", detailChantier.id);
    if (error) toast.error(error.message);
    else { toast.success("Chantier mis à jour"); setDetailEditMode(false); fetchData(); }
    setLoading(false);
  };

  // Chantier dialog
  const [chantierDialogOpen, setChantierDialogOpen] = useState(false);
  const [editChantier, setEditChantier] = useState<Chantier | null>(null);
  const [chForm, setChForm] = useState({ nom: "", client_id: "", adresse_chantier: "", statut: "prospect" as ChantierStatut, date_debut: "", date_fin_prevue: "" });
  const [chantierUseNewClient, setChantierUseNewClient] = useState(false);
  const [chantierNewClient, setChantierNewClient] = useState({ nom: "", email: "", telephone: "", type: "particulier" as "particulier" | "pro", adresse: "", siret: "" });

  // Client dialog
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [clForm, setClForm] = useState({ nom: "", type: "particulier" as "particulier" | "pro", adresse: "", telephone: "", email: "", siret: "" });

  const [loading, setLoading] = useState(false);

  // Préremplissage depuis un devis signé
  const [fromDevisInfo, setFromDevisInfo] = useState<{ devisNumero: string; devisMontant: string; clientNom: string } | null>(null);

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
    const lignesValides = newDevisLignes.filter(l => l.designation.trim() || parseFloat(l.prix_unitaire) > 0);
    const montantHt = lignesValides.length > 0
      ? lignesValides.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0)
      : parseFloat(newDevisForm.montant_ht) || 0;
    const { data: newDevis, error } = await supabase.from("devis").insert({
      artisan_id: user.id,
      chantier_id: chantierId,
      numero,
      montant_ht: montantHt,
      tva: parseFloat(newDevisForm.tva) || 20,
      statut: newDevisForm.statut as any,
      date_validite: newDevisForm.date_validite || null,
    }).select("id").single();
    if (error) { toast.error(error.message); }
    else {
      // Sauvegarde des lignes dans lignes_devis
      if (lignesValides.length > 0) {
        await (supabase as any).from("lignes_devis").insert(
          lignesValides.map((l, i) => ({
            devis_id: newDevis.id,
            designation: l.designation,
            quantite: parseFloat(l.quantite) || 1,
            unite: l.unite || "u",
            prix_unitaire: parseFloat(l.prix_unitaire) || 0,
            tva: parseFloat(newDevisForm.tva) || 20,
            ordre: i + 1,
          }))
        );
      }
      toast.success(`Devis ${numero} créé`);
      setAddDevisOpen(false);
      setNewDevisForm({ numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_validite: "" });
      setNewDevisLignes([]);
      loadChantierDocs(chantierId);
    }
    setLoading(false);
  };

  const handleAddFacture = async (chantierId: string) => {
    if (!user || !newFactureForm.devis_id || !newFactureForm.date_echeance) {
      toast.error("Sélectionnez un devis et une date d'échéance");
      return;
    }
    setNewFactureSaving(true);
    const linkedDevis = chantierDevis.find(d => d.id === newFactureForm.devis_id);
    const montant = linkedDevis ? Number(linkedDevis.montant_ht) : 0;
    const numero = `FAC-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("factures").insert({
      artisan_id: user.id,
      devis_id: newFactureForm.devis_id,
      numero,
      montant_ht: montant,
      tva: parseFloat(newFactureForm.tva) || 20,
      statut: "brouillon" as any,
      date_echeance: newFactureForm.date_echeance,
      solde_restant: montant,
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success(`Facture ${numero} créée`);
      setAddFactureOpen(false);
      setNewFactureForm({ devis_id: "", date_echeance: "", tva: "20" });
      loadChantierDocs(chantierId);
    }
    setNewFactureSaving(false);
  };

  const computeAvenantMontantChantier = () => {
    if (newAvenantForm.mode === "pourcentage") {
      const d = chantierDevis.find(dv => dv.id === newAvenantForm.devis_id);
      return d ? Number(d.montant_ht) * (parseFloat(newAvenantForm.pourcentage) || 0) / 100 : 0;
    }
    return parseFloat(newAvenantForm.montant_ht) || 0;
  };

  const handleAddAvenant = async () => {
    if (!user || !newAvenantForm.devis_id) { toast.error("Sélectionnez un devis"); return; }
    setNewAvenantSaving(true);
    const numero = `AV-${Date.now().toString(36).toUpperCase()}`;
    const montant = computeAvenantMontantChantier();
    const { error } = await (supabase as any).from("avenants").insert({
      artisan_id: user.id, devis_id: newAvenantForm.devis_id, numero,
      description: newAvenantForm.description, montant_ht: montant,
      tva: parseFloat(newAvenantForm.tva) || 20, statut: "brouillon",
      date: newAvenantForm.date || new Date().toISOString().split("T")[0],
    });
    if (error) { toast.error(error.message); }
    else {
      toast.success(`Avenant ${numero} créé`);
      setAddAvenantOpen(false);
      setNewAvenantForm({ devis_id: "", description: "", montant_ht: "", tva: "20", date: "", mode: "montant", pourcentage: "" });
    }
    setNewAvenantSaving(false);
  };

  const openTemplatePdf = async (type: "devis" | "facture", id: string) => {
    setPdfLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-pdf-html", {
        body: type === "devis" ? { type, devis_id: id } : { type, facture_id: id },
      });
      if (error) throw new Error(error.message ?? "Erreur génération");
      if (!data?.html) throw new Error("Réponse vide");
      const item = type === "devis"
        ? chantierDevis.find(d => d.id === id)
        : chantierFactures.find(f => f.id === id);
      setPdfPreviewTitle(type === "devis" ? `Devis ${item?.numero ?? ""}` : `Facture ${item?.numero ?? ""}`);
      setPdfPreviewHtml(data.html);
      setPdfPreviewOpen(true);
    } catch (e: any) { toast.error("Erreur PDF : " + e.message); }
    finally { setPdfLoading(false); }
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

  // Ouvre automatiquement le formulaire depuis ?new=1 ou depuis un devis signé (?from_devis=...)
  useEffect(() => {
    if (!user) return;
    const fromDevis = searchParams.get("from_devis");
    if (fromDevis) {
      const clientId = searchParams.get("client_id") ?? "";
      const clientNom = searchParams.get("client_nom") ?? "";
      const devisNumero = searchParams.get("devis_numero") ?? "";
      const devisMontant = searchParams.get("devis_montant") ?? "";
      setEditChantier(null);
      setChForm({
        nom: devisNumero ? `Chantier ${devisNumero}` : "",
        client_id: clientId,
        adresse_chantier: "",
        statut: "en_cours",
        date_debut: new Date().toISOString().split("T")[0],
        date_fin_prevue: "",
      });
      setChantierUseNewClient(false);
      setChantierNewClient({ nom: "", email: "", telephone: "", type: "particulier", adresse: "", siret: "" });
      setFromDevisInfo({ devisNumero, devisMontant, clientNom });
      setChantierDialogOpen(true);
      navigate("/chantiers", { replace: true });
    } else if (searchParams.get("new") === "1") {
      openNewChantier();
      navigate("/chantiers", { replace: true });
    }
  }, [searchParams, user]);

  // Chantier CRUD
  const openNewChantier = () => {
    setEditChantier(null);
    setChForm({ nom: "", client_id: "", adresse_chantier: "", statut: "prospect", date_debut: "", date_fin_prevue: "" });
    setChantierUseNewClient(false);
    setChantierNewClient({ nom: "", email: "", telephone: "", type: "particulier", adresse: "", siret: "" });
    setFromDevisInfo(null);
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
    try {
      let clientId = chForm.client_id;

      // Créer un nouveau client si demandé
      if (!editChantier && chantierUseNewClient) {
        if (!chantierNewClient.nom.trim()) { toast.error("Le nom du client est obligatoire"); setLoading(false); return; }
        if (!chantierNewClient.email.trim()) { toast.error("L'email du client est obligatoire"); setLoading(false); return; }
        if (!chantierNewClient.telephone.trim()) { toast.error("Le téléphone du client est obligatoire"); setLoading(false); return; }
        if (!chantierNewClient.adresse.trim()) { toast.error("L'adresse du client est obligatoire"); setLoading(false); return; }
        if (chantierNewClient.type === "pro" && !chantierNewClient.siret.trim()) { toast.error("Le SIRET est obligatoire pour un professionnel"); setLoading(false); return; }
        const { data: newCl, error: clErr } = await supabase.from("clients").insert({
          artisan_id: user.id,
          nom: chantierNewClient.nom.trim(),
          type: chantierNewClient.type,
          email: chantierNewClient.email.trim() || null,
          telephone: chantierNewClient.telephone.trim() || null,
          adresse: chantierNewClient.adresse.trim() || null,
          ...(chantierNewClient.siret.trim() ? { siret: chantierNewClient.siret.trim() } : {}),
        }).select("id").single();
        if (clErr) throw clErr;
        clientId = newCl.id;
        toast.success(`Client "${chantierNewClient.nom}" créé`);
      }

      if (!clientId) { toast.error("Sélectionnez ou créez un client"); setLoading(false); return; }

      if (editChantier) {
        const { error } = await supabase.from("chantiers").update({
          nom: chForm.nom || editChantier.nom, client_id: clientId,
          adresse_chantier: chForm.adresse_chantier || null, statut: chForm.statut,
          date_debut: chForm.date_debut || null, date_fin_prevue: chForm.date_fin_prevue || null,
        }).eq("id", editChantier.id);
        if (error) throw error;
        toast.success("Chantier modifié");
      } else {
        const { error } = await supabase.from("chantiers").insert({
          artisan_id: user.id, nom: chForm.nom, client_id: clientId,
          adresse_chantier: chForm.adresse_chantier || null, statut: chForm.statut,
          date_debut: chForm.date_debut || null, date_fin_prevue: chForm.date_fin_prevue || null,
        });
        if (error) throw error;
        toast.success("Chantier créé");
      }
      setChantierDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Erreur");
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
    setClForm({ nom: "", type: "particulier", adresse: "", telephone: "", email: "", siret: "" });
    setClientDialogOpen(true);
  };

  const openEditClient = (cl: Client) => {
    setEditClient(cl);
    setClForm({ nom: cl.nom, type: cl.type, adresse: cl.adresse || "", telephone: cl.telephone || "", email: cl.email || "", siret: (cl as any).siret || "" });
    setClientDialogOpen(true);
  };

  const handleSaveClient = async () => {
    if (!user) return;
    // Validation champs obligatoires
    if (!clForm.nom.trim()) { toast.error("Le nom est obligatoire"); return; }
    if (!clForm.email.trim()) { toast.error("L'email est obligatoire"); return; }
    if (!clForm.telephone.trim()) { toast.error("Le téléphone est obligatoire"); return; }
    if (!clForm.adresse.trim()) { toast.error("L'adresse est obligatoire"); return; }

    // Vérif unicité email (côté client, avant envoi)
    const emailQuery = supabase.from("clients").select("id").eq("artisan_id", user.id).eq("email", clForm.email.trim());
    if (editClient) emailQuery.neq("id", editClient.id);
    const { data: existingEmail } = await emailQuery.maybeSingle();
    if (existingEmail) { toast.error("Un client avec cet email existe déjà"); return; }

    // Vérif unicité SIRET si renseigné
    if (clForm.siret.trim()) {
      const siretQuery = supabase.from("clients").select("id").eq("artisan_id", user.id).eq("siret" as any, clForm.siret.trim());
      if (editClient) siretQuery.neq("id", editClient.id);
      const { data: existingSiret } = await siretQuery.maybeSingle();
      if (existingSiret) { toast.error("Un client avec ce SIRET existe déjà"); return; }
    }

    setLoading(true);
    if (editClient) {
      const { error } = await supabase.from("clients").update({
        nom: clForm.nom,
        type: clForm.type,
        adresse: clForm.adresse,
        telephone: clForm.telephone,
        email: clForm.email,
        siret: clForm.siret || null,
      } as any).eq("id", editClient.id);
      if (error) toast.error(error.message);
      else { toast.success("Client modifié"); setClientDialogOpen(false); fetchData(); }
    } else {
      const { error } = await supabase.from("clients").insert({
        artisan_id: user.id,
        nom: clForm.nom,
        type: clForm.type,
        adresse: clForm.adresse,
        telephone: clForm.telephone,
        email: clForm.email,
        siret: clForm.siret || null,
      } as any);
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                  <p className="text-small text-muted-foreground">Client : {(() => { const cl = clients.find(c => c.id === ch.client_id); return cl ? [cl.prenom, cl.nom].filter(Boolean).join(" ") : "—"; })()}</p>
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
                        <AlertDialogDescription>Le client "{[cl.prenom, cl.nom].filter(Boolean).join(" ")}" sera définitivement supprimé.</AlertDialogDescription>
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
      <Dialog open={chantierDialogOpen} onOpenChange={(o) => { setChantierDialogOpen(o); if (!o) setFromDevisInfo(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editChantier ? "Modifier le chantier" : "Nouveau chantier"}</DialogTitle>
          </DialogHeader>
          {fromDevisInfo && (
            <div className="flex items-start gap-2 text-sm bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              <FileText className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-primary">Lancé depuis le devis {fromDevisInfo.devisNumero}</p>
                <p className="text-xs text-muted-foreground">
                  Client : {fromDevisInfo.clientNom || "—"} • Montant TTC : {Number(fromDevisInfo.devisMontant).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                </p>
              </div>
            </div>
          )}
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nom du chantier</Label>
              <Input value={chForm.nom} onChange={(e) => setChForm(p => ({ ...p, nom: e.target.value }))} placeholder="Rénovation cuisine" />
            </div>
            {/* Toggle client existant / nouveau */}
            {!editChantier && (
              <div className="space-y-3">
                <div className="flex rounded-lg border overflow-hidden text-sm">
                  <button className={`flex-1 py-2 transition-colors ${!chantierUseNewClient ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    onClick={() => setChantierUseNewClient(false)}>Client existant</button>
                  <button className={`flex-1 py-2 transition-colors ${chantierUseNewClient ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    onClick={() => setChantierUseNewClient(true)}>Nouveau client</button>
                </div>
                {!chantierUseNewClient ? (
                  <Select value={chForm.client_id} onValueChange={(v) => setChForm(p => ({ ...p, client_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{[c.prenom, c.nom].filter(Boolean).join(" ")}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border/50">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Informations du nouveau client</p>
                    <div className="space-y-1">
                      <Label className="text-xs">Nom <span className="text-destructive">*</span></Label>
                      <Input value={chantierNewClient.nom} onChange={e => setChantierNewClient(p => ({ ...p, nom: e.target.value }))} placeholder="Jean Dupont" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select value={chantierNewClient.type} onValueChange={v => setChantierNewClient(p => ({ ...p, type: v as "particulier" | "pro" }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="particulier">Particulier</SelectItem>
                          <SelectItem value="pro">Professionnel</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Email <span className="text-destructive">*</span></Label>
                      <Input type="email" value={chantierNewClient.email} onChange={e => setChantierNewClient(p => ({ ...p, email: e.target.value }))} placeholder="jean@email.com" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Téléphone <span className="text-destructive">*</span></Label>
                      <Input value={chantierNewClient.telephone} onChange={e => setChantierNewClient(p => ({ ...p, telephone: e.target.value }))} placeholder="06 12 34 56 78" />
                    </div>
                    {chantierNewClient.type === "pro" && (
                      <div className="space-y-1">
                        <Label className="text-xs">SIRET <span className="text-destructive">*</span></Label>
                        <Input value={chantierNewClient.siret} onChange={e => setChantierNewClient(p => ({ ...p, siret: e.target.value }))} placeholder="12345678901234" maxLength={14} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">Adresse <span className="text-destructive">*</span></Label>
                      <AddressFields value={chantierNewClient.adresse} onChange={v => setChantierNewClient(p => ({ ...p, adresse: v }))} required />
                    </div>
                  </div>
                )}
              </div>
            )}
            {editChantier && (
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={chForm.client_id} onValueChange={(v) => setChForm(p => ({ ...p, client_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{[c.prenom, c.nom].filter(Boolean).join(" ")}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Adresse du chantier</Label>
              <AddressFields value={chForm.adresse_chantier} onChange={(v) => setChForm(p => ({ ...p, adresse_chantier: v }))} required />
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={chForm.statut} onValueChange={(v) => setChForm(p => ({ ...p, statut: v as ChantierStatut }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(statutLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
          <div className="space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input value={clForm.nom} onChange={(e) => setClForm(p => ({ ...p, nom: e.target.value }))} placeholder="Jean Dupont" required />
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
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={clForm.email} onChange={(e) => setClForm(p => ({ ...p, email: e.target.value }))} placeholder="jean@email.com" required />
            </div>
            <div className="space-y-2">
              <Label>Téléphone <span className="text-destructive">*</span></Label>
              <Input value={clForm.telephone} onChange={(e) => setClForm(p => ({ ...p, telephone: e.target.value }))} placeholder="06 12 34 56 78" required />
            </div>
            <div className="space-y-2">
              <Label>SIRET {clForm.type === "pro" && <span className="text-destructive">*</span>}</Label>
              <Input value={clForm.siret} onChange={(e) => setClForm(p => ({ ...p, siret: e.target.value }))} placeholder="12345678901234" maxLength={14} />
              <p className="text-[10px] text-muted-foreground">14 chiffres — obligatoire pour les professionnels</p>
            </div>
            <div className="space-y-2">
              <Label>Adresse <span className="text-destructive">*</span></Label>
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
              <TabsContent value="infos" className="flex-1 overflow-y-auto px-6 mt-0 pb-4">
                {!detailEditMode ? (
                  /* Vue lecture */
                  <div className="space-y-3 pt-2">
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setDetailEditMode(true)}>
                        <Pencil className="w-3 h-3" /> Modifier
                      </Button>
                    </div>
                    {[
                      { label: "Client", value: (() => { const cl = clients.find(c => c.id === detailChantier.client_id); return cl ? [cl.prenom, cl.nom].filter(Boolean).join(" ") : "—"; })() },
                      { label: "Adresse", value: detailForm.adresse_chantier || "—" },
                      { label: "Statut", value: statutLabels[detailChantier.statut] },
                      { label: "Début", value: detailChantier.date_debut ? new Date(detailChantier.date_debut).toLocaleDateString("fr-FR") : "—" },
                      { label: "Fin prévue", value: detailChantier.date_fin_prevue ? new Date(detailChantier.date_fin_prevue).toLocaleDateString("fr-FR") : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex gap-3">
                        <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">{label}</span>
                        <span className="text-sm">{value}</span>
                      </div>
                    ))}
                    <div className="flex gap-3">
                      <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">Description</span>
                      <span className="text-sm whitespace-pre-wrap">{detailForm.description || <span className="text-muted-foreground italic">Aucune description</span>}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground pt-2">Créé le {new Date(detailChantier.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                ) : (
                  /* Vue édition */
                  <div className="space-y-4 pt-2">
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
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Description du chantier</Label>
                        <Button type="button" size="icon" variant="outline"
                          className={`h-7 w-7 transition-all ${descRecording ? "animate-pulse bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600" : ""}`}
                          onClick={descRecording ? stopDescRecording : startDescRecording}
                          title={descRecording ? "Arrêter l'enregistrement" : "Dicter la description"}>
                          <Mic className="w-3 h-3" />
                        </Button>
                      </div>
                      <Textarea
                        value={detailForm.description}
                        onChange={(e) => setDetailForm(p => ({ ...p, description: e.target.value }))}
                        placeholder="Décrivez les travaux, contraintes, matériaux…"
                        rows={4}
                        className="resize-none text-sm"
                      />
                      {descRecording && <p className="text-xs text-destructive animate-pulse">🎙 Enregistrement en cours… cliquez sur le micro pour arrêter</p>}
                    </div>
                  </div>
                )}
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
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Nouvel avenant" onClick={() => { setNewAvenantForm(p => ({ ...p, devis_id: d.id })); setAddAvenantOpen(true); }}>
                            <FilePlus className="w-3.5 h-3.5" />
                          </Button>
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
                <div className="flex justify-between items-center py-3">
                  <p className="text-sm font-medium">Factures liées à ce chantier</p>
                  <Button size="sm" onClick={() => { setNewFactureForm({ devis_id: chantierDevis[0]?.id || "", date_echeance: "", tva: "20" }); setAddFactureOpen(true); }} className="h-8 text-xs gap-1">
                    <Plus className="w-3 h-3" /> Nouvelle facture
                  </Button>
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

              {/* Footer */}
              <div className="px-6 py-3 border-t shrink-0 flex justify-end gap-2">
                {detailEditMode ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setDetailEditMode(false)}>Annuler</Button>
                    <Button size="sm" onClick={handleSaveDetail} disabled={loading} className="bg-primary text-primary-foreground">
                      {loading ? "Enregistrement…" : "Enregistrer"}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setDetailOpen(false)}>Fermer</Button>
                )}
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Nouveau devis depuis chantier */}
      <Dialog open={addDevisOpen} onOpenChange={(o) => { setAddDevisOpen(o); if (!o) setNewDevisLignes([]); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Nouveau devis</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Numéro (auto si vide)</Label>
                <Input value={newDevisForm.numero} onChange={e => setNewDevisForm(p => ({ ...p, numero: e.target.value }))} placeholder="DEV-001" />
              </div>
              <div className="space-y-1">
                <Label>Date de validité</Label>
                <Input type="date" value={newDevisForm.date_validite} onChange={e => setNewDevisForm(p => ({ ...p, date_validite: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <Label>Statut</Label>
                <Select value={newDevisForm.statut} onValueChange={v => setNewDevisForm(p => ({ ...p, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brouillon">Brouillon</SelectItem>
                    <SelectItem value="envoye">Envoyé</SelectItem>
                    <SelectItem value="signe">Signé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Lignes du devis */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Prestations</Label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setNewDevisLignes(p => [...p, mkLigne()])}>
                  <Plus className="w-3 h-3 mr-1" /> Ajouter
                </Button>
              </div>
              {newDevisLignes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2 text-center">Aucune prestation — ou renseignez un montant HT global ci-dessous</p>
              ) : (
                <div className="space-y-2">
                  {newDevisLignes.map((l, i) => (
                    <div key={l._key} className="grid grid-cols-[1fr_auto_auto_auto] gap-1.5 items-end">
                      <div>
                        <Label className="text-[10px]">Désignation</Label>
                        <Input value={l.designation} onChange={e => setNewDevisLignes(p => p.map((x, j) => j === i ? { ...x, designation: e.target.value } : x))} className="h-7 text-xs" placeholder="Pose carrelage…" />
                      </div>
                      <div className="w-14">
                        <Label className="text-[10px]">Qté</Label>
                        <Input type="number" value={l.quantite} onChange={e => setNewDevisLignes(p => p.map((x, j) => j === i ? { ...x, quantite: e.target.value } : x))} className="h-7 text-xs" />
                      </div>
                      <div className="w-20">
                        <Label className="text-[10px]">P.U. €</Label>
                        <Input type="number" value={l.prix_unitaire} onChange={e => setNewDevisLignes(p => p.map((x, j) => j === i ? { ...x, prix_unitaire: e.target.value } : x))} className="h-7 text-xs" />
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive self-end" onClick={() => setNewDevisLignes(p => p.filter((_, j) => j !== i))}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-semibold border-t pt-2">
                    <span>Total HT</span>
                    <span>{newDevisLignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</span>
                  </div>
                </div>
              )}
              {newDevisLignes.length === 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Montant HT global (si pas de lignes)</Label>
                  <Input type="number" value={newDevisForm.montant_ht} onChange={e => setNewDevisForm(p => ({ ...p, montant_ht: e.target.value }))} placeholder="0" />
                </div>
              )}
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

      {/* Nouvelle facture depuis chantier */}
      <Dialog open={addFactureOpen} onOpenChange={setAddFactureOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Nouvelle facture</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Devis associé *</Label>
              <Select value={newFactureForm.devis_id} onValueChange={v => setNewFactureForm(p => ({ ...p, devis_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un devis" /></SelectTrigger>
                <SelectContent>{chantierDevis.map(d => <SelectItem key={d.id} value={d.id}>{d.numero} — {Number(d.montant_ht).toLocaleString("fr-FR")} €</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date d'échéance *</Label>
              <Input type="date" value={newFactureForm.date_echeance} onChange={e => setNewFactureForm(p => ({ ...p, date_echeance: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>TVA (%)</Label>
              <Select value={newFactureForm.tva} onValueChange={v => setNewFactureForm(p => ({ ...p, tva: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0%</SelectItem>
                  <SelectItem value="5.5">5,5%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="20">20%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Le montant HT sera repris du devis sélectionné.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddFactureOpen(false)}>Annuler</Button>
            <Button onClick={() => detailChantier && handleAddFacture(detailChantier.id)} disabled={newFactureSaving || !newFactureForm.devis_id || !newFactureForm.date_echeance}>
              {newFactureSaving ? "Création…" : "Créer la facture"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nouvel avenant depuis chantier */}
      <Dialog open={addAvenantOpen} onOpenChange={(open) => { if (!open) setNewAvenantForm({ devis_id: "", description: "", montant_ht: "", tva: "20", date: "", mode: "montant", pourcentage: "" }); setAddAvenantOpen(open); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Nouvel avenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Devis associé *</Label>
              <Select value={newAvenantForm.devis_id} onValueChange={v => setNewAvenantForm(p => ({ ...p, devis_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un devis" /></SelectTrigger>
                <SelectContent>{chantierDevis.map(d => <SelectItem key={d.id} value={d.id}>{d.numero} — {Number(d.montant_ht).toLocaleString("fr-FR")} €</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={newAvenantForm.date} onChange={e => setNewAvenantForm(p => ({ ...p, date: e.target.value }))} /></div>
              <div className="space-y-1"><Label>TVA (%)</Label>
                <Select value={newAvenantForm.tva} onValueChange={v => setNewAvenantForm(p => ({ ...p, tva: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5.5">5,5%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="20">20%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={newAvenantForm.description} onChange={e => setNewAvenantForm(p => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="space-y-1">
              <Label>Type de montant</Label>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={newAvenantForm.mode === "montant" ? "default" : "outline"} onClick={() => setNewAvenantForm(p => ({ ...p, mode: "montant" }))}>
                  Montant fixe (€)
                </Button>
                <Button type="button" size="sm" variant={newAvenantForm.mode === "pourcentage" ? "default" : "outline"} onClick={() => setNewAvenantForm(p => ({ ...p, mode: "pourcentage" }))}>
                  <Percent className="w-3 h-3 mr-1" /> % du devis
                </Button>
              </div>
            </div>
            {newAvenantForm.mode === "montant" ? (
              <div className="space-y-1"><Label>Montant HT (€)</Label><Input type="number" value={newAvenantForm.montant_ht} onChange={e => setNewAvenantForm(p => ({ ...p, montant_ht: e.target.value }))} /></div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Pourcentage (%)</Label>
                  <Input type="number" min="0" max="100" value={newAvenantForm.pourcentage} onChange={e => setNewAvenantForm(p => ({ ...p, pourcentage: e.target.value }))} placeholder="ex: 10" />
                </div>
                <div className="space-y-1">
                  <Label>Montant HT calculé</Label>
                  <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-sm font-mono">
                    {computeAvenantMontantChantier().toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAvenantOpen(false)}>Annuler</Button>
            <Button onClick={handleAddAvenant} disabled={newAvenantSaving || !newAvenantForm.devis_id}>
              {newAvenantSaving ? "Création…" : "Créer l'avenant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet PDF preview */}
      <Sheet open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
        <SheetContent side="bottom" className="h-[95vh] flex flex-col p-0">
          <SheetHeader className="px-4 py-3 border-b flex flex-row items-center justify-between shrink-0">
            <SheetTitle className="font-display text-sm">{pdfPreviewTitle}</SheetTitle>
            <div className="flex items-center gap-2">
              {pdfLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs"
                onClick={() => { const iframe = document.getElementById("ch-pdf-iframe") as HTMLIFrameElement; iframe?.contentWindow?.print(); }}>
                <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
              </Button>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-auto bg-gray-100">
            <iframe id="ch-pdf-iframe" srcDoc={pdfPreviewHtml} className="w-full border-0" style={{ minHeight: "1123px" }} title={pdfPreviewTitle} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
