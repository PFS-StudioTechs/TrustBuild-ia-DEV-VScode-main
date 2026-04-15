import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Bot, FileText, Receipt, Trash2, Download, PenLine, CreditCard,
  Send, Eye, Phone, Mail, MapPin, Wrench, FileX, Edit2, Sparkles, Printer, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import AddressFields from "@/components/ui/AddressFields";
import type { Database } from "@/integrations/supabase/types";

// ── Types ─────────────────────────────────────────────────────────────────────
type Devis   = Database["public"]["Tables"]["devis"]["Row"];
type Facture = Database["public"]["Tables"]["factures"]["Row"];
type Avenant = Database["public"]["Tables"]["avenants"]["Row"] & { numero?: string | null };

interface TravauxSupp {
  id: string; artisan_id: string; devis_id: string; numero: string;
  description: string; montant_ht: number; tva: number; statut: string;
  date: string; created_at: string; updated_at: string;
}
interface Avoir {
  id: string; artisan_id: string; facture_id: string | null; devis_id: string | null;
  numero: string; description: string; montant_ht: number; tva: number;
  statut: string; date: string; created_at: string; updated_at: string;
}
interface ClientDetail {
  id: string; nom: string; prenom: string | null;
  email: string | null; telephone: string | null; adresse: string | null; type: string;
}
interface ChantierRow { id: string; nom: string; client_id: string; }

// Ligne de devis / facture
interface LigneForm {
  _key: string;
  designation: string;
  quantite: string;
  unite: string;
  prix_unitaire: string;
  tva: string;
}

const newLigne = (): LigneForm => ({
  _key: Math.random().toString(36).slice(2),
  designation: "", quantite: "1", unite: "u", prix_unitaire: "", tva: "20",
});

function lignesTotal(lignes: LigneForm[]): number {
  return lignes.reduce((s, l) => s + (parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0), 0);
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── LignesEditor component ─────────────────────────────────────────────────────
function LignesEditor({ lignes, onChange }: { lignes: LigneForm[]; onChange: (l: LigneForm[]) => void }) {
  const total = lignesTotal(lignes);
  const upd = (i: number, f: keyof LigneForm, v: string) =>
    onChange(lignes.map((l, j) => (j === i ? { ...l, [f]: v } : l)));

  return (
    <div className="space-y-2">
      {lignes.length > 0 && (
        <div className="grid gap-1 text-[10px] font-medium text-muted-foreground px-0.5"
          style={{ gridTemplateColumns: "1fr 52px 52px 80px 46px 68px 28px" }}>
          <span>Désignation</span>
          <span>Qté</span>
          <span>Unité</span>
          <span>P.U. HT €</span>
          <span>TVA%</span>
          <span className="text-right">Total HT</span>
          <span />
        </div>
      )}
      {lignes.map((l, i) => (
        <div key={l._key} className="grid gap-1 items-center"
          style={{ gridTemplateColumns: "1fr 52px 52px 80px 46px 68px 28px" }}>
          <Input value={l.designation} onChange={(e) => upd(i, "designation", e.target.value)}
            placeholder="Désignation / prestation" className="h-8 text-xs" />
          <Input value={l.quantite} onChange={(e) => upd(i, "quantite", e.target.value)}
            type="number" min="0" step="0.01" className="h-8 text-xs px-1.5" />
          <Input value={l.unite} onChange={(e) => upd(i, "unite", e.target.value)}
            placeholder="u" className="h-8 text-xs px-1.5" />
          <Input value={l.prix_unitaire} onChange={(e) => upd(i, "prix_unitaire", e.target.value)}
            type="number" min="0" step="0.01" placeholder="0" className="h-8 text-xs px-1.5" />
          <Input value={l.tva} onChange={(e) => upd(i, "tva", e.target.value)}
            type="number" min="0" className="h-8 text-xs px-1.5" />
          <span className="text-xs font-mono text-right pr-1 tabular-nums">
            {fmt((parseFloat(l.quantite) || 0) * (parseFloat(l.prix_unitaire) || 0))}
          </span>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onChange(lignes.filter((_, j) => j !== i))}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ))}
      {lignes.length === 0 && (
        <p className="text-xs text-center text-muted-foreground py-4 border border-dashed rounded-lg">
          Aucune ligne — ajoutez des prestations ci-dessous
        </p>
      )}
      <Button size="sm" variant="outline" onClick={() => onChange([...lignes, newLigne()])} className="w-full h-8 text-xs gap-1.5">
        <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
      </Button>
      {lignes.length > 0 && (
        <div className="flex justify-between items-center border-t pt-2 text-sm">
          <span className="text-muted-foreground text-xs">
            {lignes.length} ligne{lignes.length > 1 ? "s" : ""}
          </span>
          <div className="flex gap-4">
            <span className="text-muted-foreground">Total HT :</span>
            <span className="font-mono font-semibold">{fmt(total)} €</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Statuts ──────────────────────────────────────────────────────────────────
const DEVIS_STATUTS: Record<string, string> = {
  brouillon: "Brouillon", envoye: "Envoyé", signe: "Signé",
  en_cours: "En cours", chantier_en_cours: "Chantier en cours",
  termine: "Terminé", refuse: "Refusé",
};
const DEVIS_STYLES: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-warning/10 text-warning",
  signe: "bg-success/10 text-success",
  en_cours: "bg-blue-500/10 text-blue-600",
  chantier_en_cours: "bg-orange-500/10 text-orange-600",
  termine: "bg-teal-500/10 text-teal-600",
  refuse: "bg-destructive/10 text-destructive",
};
const FACTURE_STATUTS: Record<string, string> = {
  brouillon: "Brouillon", envoyee: "Envoyée",
  en_attente_paiement: "En attente de paiement", payee: "Payée",
  refusee: "Refusée", a_modifier: "À modifier", impayee: "Impayée",
};
const FACTURE_STYLES: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoyee: "bg-primary/10 text-primary",
  en_attente_paiement: "bg-warning/10 text-warning",
  payee: "bg-success/10 text-success",
  refusee: "bg-destructive/10 text-destructive",
  a_modifier: "bg-orange-500/10 text-orange-600",
  impayee: "bg-destructive/10 text-destructive",
};
const AVOIR_STATUTS: Record<string, string> = {
  brouillon: "Brouillon", envoye: "Envoyé", valide: "Validé", annule: "Annulé",
};
const AVOIR_STYLES: Record<string, string> = {
  brouillon: "bg-muted text-muted-foreground",
  envoye: "bg-primary/10 text-primary",
  valide: "bg-success/10 text-success",
  annule: "bg-destructive/10 text-destructive",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function clientFullName(c: ClientDetail | undefined) {
  if (!c) return null;
  return [c.prenom, c.nom].filter(Boolean).join(" ");
}

function StatutBadge({ statut, styles, labels }: { statut: string; styles: Record<string, string>; labels: Record<string, string> }) {
  return (
    <Badge variant="secondary" className={`text-[10px] font-medium border-0 ${styles[statut] ?? "bg-muted text-muted-foreground"}`}>
      {labels[statut] ?? statut}
    </Badge>
  );
}

function ClientInfo({ client }: { client: ClientDetail | undefined }) {
  if (!client) return null;
  return (
    <div className="space-y-0.5 mt-1">
      <p className="text-xs font-medium text-foreground">{clientFullName(client)}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {client.email && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Mail className="w-3 h-3 shrink-0" />{client.email}
          </span>
        )}
        {client.telephone && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Phone className="w-3 h-3 shrink-0" />{client.telephone}
          </span>
        )}
        {client.adresse && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate max-w-[200px]">
            <MapPin className="w-3 h-3 shrink-0" />{client.adresse}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Documents() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "devis";

  // Data
  const [devis, setDevis]               = useState<Devis[]>([]);
  const [factures, setFactures]         = useState<Facture[]>([]);
  const [avenants, setAvenants]         = useState<Avenant[]>([]);
  const [travauxSupps, setTravauxSupps] = useState<TravauxSupp[]>([]);
  const [avoirs, setAvoirs]             = useState<Avoir[]>([]);
  const [chantiers, setChantiers]       = useState<ChantierRow[]>([]);
  const [clientsMap, setClientsMap]     = useState<Map<string, ClientDetail>>(new Map());

  // UI
  const [saving, setSaving] = useState(false);

  // Lignes (create forms)
  const [createLignesDevis, setCreateLignesDevis]       = useState<LigneForm[]>([newLigne()]);
  const [createLignesFacture, setCreateLignesFacture]   = useState<LigneForm[]>([newLigne()]);
  // Lignes (detail view — loaded on open)
  const [detailLignes, setDetailLignes]                 = useState<LigneForm[]>([]);
  const [detailLignesLoading, setDetailLignesLoading]   = useState(false);

  // ── Create Devis ──
  const [createDevisOpen, setCreateDevisOpen] = useState(false);
  const [devisForm, setDevisForm] = useState({
    chantier_id: "", numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_validite: "",
    client_nom: "", client_prenom: "", client_email: "", client_telephone: "", client_adresse: "", client_type: "particulier",
    chantier_nom: "", chantier_adresse: "", chantier_date_debut: "", chantier_date_fin_prevue: "",
    use_existing_chantier: true,
  });
  const [aiDesc, setAiDesc]     = useState("");
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ── Create Avenant ──
  const [createAvenantOpen, setCreateAvenantOpen] = useState(false);
  const [avenantForm, setAvenantForm] = useState({ devis_id: "", numero: "", description: "", montant_ht: "", tva: "20", statut: "brouillon", date: "" });

  // ── Create TS ──
  const [createTsOpen, setCreateTsOpen] = useState(false);
  const [tsForm, setTsForm] = useState({ devis_id: "", numero: "", description: "", montant_ht: "", tva: "20", statut: "brouillon", date: "" });

  // ── Create Facture ──
  const [createFactureOpen, setCreateFactureOpen] = useState(false);
  const [factureForm, setFactureForm] = useState({ devis_id: "", numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_echeance: "", solde_restant: "" });

  // ── "Même adresse que client" ──
  const [sameAddressAsClient, setSameAddressAsClient] = useState(false);

  // ── Create Avoir ──
  const [createAvoirOpen, setCreateAvoirOpen] = useState(false);
  const [avoirForm, setAvoirForm] = useState({ facture_id: "", devis_id: "", numero: "", description: "", montant_ht: "", tva: "20", statut: "brouillon", date: "" });

  // ── Edit (generic) ──
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editType, setEditType]   = useState<"devis" | "facture" | "avenant" | "ts" | "avoir">("devis");
  const [editItem, setEditItem]   = useState<any>(null);
  const [editForm, setEditForm]   = useState<any>({});

  // ── Detail view (devis / facture) — kept from original ──
  const [detailOpen, setDetailOpen]   = useState(false);
  const [detailType, setDetailType]   = useState<"devis" | "facture">("devis");
  const [detailItem, setDetailItem]   = useState<any>(null);
  const [detailForm, setDetailForm]   = useState<any>({});

  // ── Delete ──
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; table: string; label: string } | null>(null);

  // ── PDF preview (A4 sheet) ──
  const [pdfPreviewOpen, setPdfPreviewOpen]   = useState(false);
  const [pdfPreviewHtml, setPdfPreviewHtml]   = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState("");
  const [pdfLoading, setPdfLoading]           = useState(false);

  // ── Send (signature / paiement) ──
  const [sendDialog, setSendDialog]   = useState<{ mode: "signature" | "paiement"; docId: string; docType: "devis" | "facture"; docNum: string } | null>(null);
  const [sendEmail, setSendEmail]     = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendLoading, setSendLoading] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = async () => {
    if (!user) return;
    const [devisRes, facturesRes, avenRes, tsRes, avoirRes, chanRes, cliRes] = await Promise.all([
      supabase.from("devis").select("*").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("factures").select("*").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("avenants").select("*").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("travaux_supplementaires").select("*").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("avoirs").select("*").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("chantiers").select("id, nom, client_id").eq("artisan_id", user.id),
      (supabase as any).from("clients").select("id, nom, prenom, email, telephone, adresse, type").eq("artisan_id", user.id),
    ]);
    if (devisRes.data)   setDevis(devisRes.data);
    if (facturesRes.data) setFactures(facturesRes.data);
    if (avenRes.data)    setAvenants(avenRes.data as Avenant[]);
    if (tsRes.data)      setTravauxSupps(tsRes.data as TravauxSupp[]);
    if (avoirRes.data)   setAvoirs(avoirRes.data as Avoir[]);
    if (chanRes.data)    setChantiers(chanRes.data as ChantierRow[]);
    if (cliRes.data) {
      const map = new Map<string, ClientDetail>();
      (cliRes.data as ClientDetail[]).forEach((c) => map.set(c.id, c));
      setClientsMap(map);
    }
  };

  useEffect(() => {
    fetchData();
    if (searchParams.get("new") === "devis") setCreateDevisOpen(true);
  }, [user]);

  // ── Client resolution helpers ──────────────────────────────────────────────
  const getClientForDevis = (devisId: string): ClientDetail | undefined => {
    const d = devis.find((dv) => dv.id === devisId);
    if (!d) return undefined;
    const ch = chantiers.find((c) => c.id === d.chantier_id);
    if (!ch) return undefined;
    return clientsMap.get(ch.client_id);
  };
  const getClientForFacture = (factureId: string): ClientDetail | undefined => {
    const f = factures.find((fa) => fa.id === factureId);
    if (!f) return undefined;
    return getClientForDevis(f.devis_id);
  };
  const getClientForAvenant = (avenantId: string): ClientDetail | undefined => {
    const av = avenants.find((a) => a.id === avenantId);
    if (!av) return undefined;
    return getClientForDevis(av.devis_id);
  };
  const getClientForTs = (tsId: string): ClientDetail | undefined => {
    const ts = travauxSupps.find((t) => t.id === tsId);
    if (!ts) return undefined;
    return getClientForDevis(ts.devis_id);
  };

  // ── PDF — ouvre dans la Sheet A4 intégrée (pas de popup) ─────────────────
  const openTemplatePdf = async (type: "devis" | "facture" | "avenant", id: string) => {
    setPdfLoading(true);
    try {
      const bodyMap: Record<string, unknown> = { type };
      if (type === "devis")    bodyMap.devis_id    = id;
      if (type === "facture")  bodyMap.facture_id  = id;
      if (type === "avenant")  bodyMap.avenant_id  = id;
      const { data, error } = await supabase.functions.invoke("generate-pdf-html", { body: bodyMap });
      if (error) throw new Error(error.message ?? "Erreur génération");
      if (!data?.html) throw new Error("Réponse vide de l'edge function");
      let title = "";
      if (type === "devis")   { const item = devis.find((d) => d.id === id);    title = `Devis ${item?.numero ?? ""}`; }
      if (type === "facture") { const item = factures.find((f) => f.id === id); title = `Facture ${item?.numero ?? ""}`; }
      if (type === "avenant") { const item = avenants.find((a) => a.id === id); title = `Avenant ${item?.numero ?? ""}`; }
      setPdfPreviewTitle(title);
      setPdfPreviewHtml(data.html);
      setPdfPreviewOpen(true);
    } catch (e: any) { toast.error("Erreur PDF : " + e.message); }
    finally { setPdfLoading(false); }
  };

  // ── Lignes helpers ────────────────────────────────────────────────────────
  const dbToLigneForm = (l: any): LigneForm => ({
    _key: l.id,
    designation: l.designation,
    quantite: String(l.quantite),
    unite: l.unite,
    prix_unitaire: String(l.prix_unitaire),
    tva: String(l.tva),
  });

  const loadDetailLignes = async (type: "devis" | "facture", id: string) => {
    setDetailLignesLoading(true);
    const table = type === "devis" ? "lignes_devis" : "lignes_facture";
    const fk    = type === "devis" ? "devis_id"    : "facture_id";
    const { data } = await (supabase as any).from(table).select("*").eq(fk, id).order("ordre");
    setDetailLignes((data ?? []).map(dbToLigneForm));
    setDetailLignesLoading(false);
  };

  const saveLignes = async (type: "devis" | "facture", id: string, lignes: LigneForm[]) => {
    if (!user) return;
    const table = type === "devis" ? "lignes_devis" : "lignes_facture";
    const fk    = type === "devis" ? "devis_id"    : "facture_id";
    // Replace strategy: delete all then insert
    await (supabase as any).from(table).delete().eq(fk, id);
    if (lignes.length === 0) return;
    await (supabase as any).from(table).insert(
      lignes.map((l, i) => ({
        artisan_id:    user.id,
        [fk]:          id,
        designation:   l.designation,
        quantite:      parseFloat(l.quantite)      || 1,
        unite:         l.unite                     || "u",
        prix_unitaire: parseFloat(l.prix_unitaire) || 0,
        tva:           parseFloat(l.tva)           || 20,
        ordre:         i,
      }))
    );
  };

  // Parse AI JSON result → populate lignes
  const importAiLignes = () => {
    if (!aiResult) return;
    try {
      const m = aiResult.match(/\{[\s\S]*\}/);
      if (!m) { toast.error("Format non reconnu"); return; }
      const parsed = JSON.parse(m[0]);
      if (!parsed.postes?.length) { toast.error("Aucun poste dans la réponse IA"); return; }
      const lignes: LigneForm[] = parsed.postes.map((p: any) => ({
        _key:          Math.random().toString(36).slice(2),
        designation:   p.designation   ?? "",
        quantite:      String(p.quantite        ?? 1),
        unite:         p.unite         ?? "u",
        prix_unitaire: String(p.prix_unitaire    ?? 0),
        tva:           String(p.tva             ?? 20),
      }));
      setCreateLignesDevis(lignes);
      toast.success(`${lignes.length} ligne(s) importée(s) depuis l'IA`);
    } catch {
      toast.error("Impossible de parser le résultat IA");
    }
  };

  // ── Send dialog ───────────────────────────────────────────────────────────
  const openSend = (mode: "signature" | "paiement", docType: "devis" | "facture", docId: string) => {
    const docNum = docType === "devis"
      ? devis.find((d) => d.id === docId)?.numero ?? ""
      : factures.find((f) => f.id === docId)?.numero ?? "";
    const client = docType === "devis" ? getClientForDevis(docId) : getClientForFacture(docId);
    const prenom = client?.prenom ?? client?.nom ?? "";
    setSendEmail(client?.email ?? "");
    setSendMessage(
      mode === "signature"
        ? `Bonjour${prenom ? ` ${prenom}` : ""},\n\nVeuillez trouver ci-joint le devis ${docNum} pour signature électronique.\n\nMerci de bien vouloir le signer dès que possible.\n\nCordialement`
        : `Bonjour${prenom ? ` ${prenom}` : ""},\n\nVeuillez trouver ci-joint la facture ${docNum}.\n\nVous pouvez effectuer votre règlement en toute sécurité via le lien ci-dessous.\n\nCordialement`
    );
    setSendDialog({ mode, docId, docType, docNum });
  };

  const handleSend = async () => {
    if (!sendDialog) return;
    if (!sendEmail.trim()) { toast.error("Saisissez l'adresse email du destinataire"); return; }
    setSendLoading(true);
    const subject = sendDialog.mode === "signature"
      ? `Signature électronique — ${sendDialog.docNum}`
      : `Lien de paiement — ${sendDialog.docNum}`;
    window.open(`mailto:${sendEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(sendMessage)}`, "_blank");
    toast.success("Email ouvert dans votre client mail");
    setSendLoading(false);
    setSendDialog(null);
  };

  // ── AI generation ─────────────────────────────────────────────────────────
  const handleGenerateAI = async () => {
    if (!aiDesc) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("call-openai", {
        body: { messages: [{ role: "user", content: `Génère un devis détaillé pour : ${aiDesc}. Réponds en JSON : { "postes": [{ "designation": "", "quantite": 1, "unite": "u", "prix_unitaire": 0 }], "total_ht": 0 }` }] },
      });
      if (error) throw error;
      const content = data?.choices?.[0]?.message?.content;
      setAiResult(content || "Pas de réponse");
      try {
        const m = content?.match(/\{[\s\S]*\}/);
        if (m) { const p = JSON.parse(m[0]); if (p.total_ht) setDevisForm((prev) => ({ ...prev, montant_ht: String(p.total_ht) })); }
      } catch {}
    } catch (e: any) { toast.error(e.message || "Erreur IA"); }
    setAiLoading(false);
  };

  // ── Create handlers ───────────────────────────────────────────────────────
  const handleCreateDevis = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let chantierId = devisForm.chantier_id;
      if (!devisForm.use_existing_chantier) {
        let clientId = "";
        // Lookup by email first (avoid unique constraint), then by name
        if (devisForm.client_email?.trim()) {
          const { data: ex } = await supabase.from("clients").select("id").eq("artisan_id", user.id).eq("email", devisForm.client_email.trim()).maybeSingle();
          if (ex) clientId = ex.id;
        }
        if (!clientId && devisForm.client_nom.trim()) {
          const { data: ex } = await supabase.from("clients").select("id").eq("artisan_id", user.id).eq("nom", devisForm.client_nom.trim()).maybeSingle();
          if (ex) clientId = ex.id;
        }
        if (!clientId && devisForm.client_nom.trim()) {
          const { data: nc, error: ce } = await supabase.from("clients").insert({
            artisan_id: user.id, nom: devisForm.client_nom.trim(),
            type: devisForm.client_type as "particulier" | "pro",
            email: devisForm.client_email || null, telephone: devisForm.client_telephone || null, adresse: devisForm.client_adresse || null,
          }).select("id").single();
          if (ce) throw ce;
          clientId = nc.id;
          toast.success(`Client "${devisForm.client_nom}" créé`);
        }
        if (!clientId) { toast.error("Un client est requis"); setSaving(false); return; }
        const { data: nc, error: che } = await supabase.from("chantiers").insert({
          artisan_id: user.id, client_id: clientId, nom: devisForm.chantier_nom || "Chantier sans nom",
          adresse_chantier: devisForm.chantier_adresse || null, date_debut: devisForm.chantier_date_debut || null,
          date_fin_prevue: devisForm.chantier_date_fin_prevue || null,
        }).select("id").single();
        if (che) throw che;
        chantierId = nc.id;
        toast.success(`Chantier "${devisForm.chantier_nom}" créé`);
      }
      if (!chantierId) { toast.error("Un chantier est requis"); setSaving(false); return; }
      const numero = devisForm.numero || `DEV-${Date.now().toString(36).toUpperCase()}`;
      const montantHt = createLignesDevis.filter(l => l.designation || l.prix_unitaire).length > 0
        ? lignesTotal(createLignesDevis)
        : parseFloat(devisForm.montant_ht) || 0;
      const { data: newDevis, error } = await supabase.from("devis").insert({
        artisan_id: user.id, chantier_id: chantierId, numero,
        montant_ht: montantHt, tva: parseFloat(devisForm.tva) || 20,
        statut: devisForm.statut as any, date_validite: devisForm.date_validite || null,
      }).select("id").single();
      if (error) throw error;
      // Sauvegarder les lignes
      const lignesValides = createLignesDevis.filter(l => l.designation.trim() || parseFloat(l.prix_unitaire) > 0);
      if (lignesValides.length > 0) await saveLignes("devis", newDevis.id, lignesValides);
      toast.success(`Devis ${numero} créé`);
      setCreateDevisOpen(false);
      setCreateLignesDevis([newLigne()]);
      setSameAddressAsClient(false);
      setDevisForm({ chantier_id: "", numero: "", montant_ht: "", tva: "20", statut: "brouillon", date_validite: "", client_nom: "", client_prenom: "", client_email: "", client_telephone: "", client_adresse: "", client_type: "particulier", chantier_nom: "", chantier_adresse: "", chantier_date_debut: "", chantier_date_fin_prevue: "", use_existing_chantier: true });
      setAiResult(null); setAiDesc("");
      fetchData();
    } catch (e: any) { toast.error(e.message || "Erreur lors de la création"); }
    setSaving(false);
  };

  const handleCreateAvenant = async () => {
    if (!user || !avenantForm.devis_id) { toast.error("Sélectionnez un devis"); return; }
    setSaving(true);
    const numero = avenantForm.numero || `AV-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await (supabase as any).from("avenants").insert({
      artisan_id: user.id, devis_id: avenantForm.devis_id, numero,
      description: avenantForm.description, montant_ht: parseFloat(avenantForm.montant_ht) || 0,
      tva: parseFloat(avenantForm.tva) || 20, statut: avenantForm.statut,
      date: avenantForm.date || new Date().toISOString().split("T")[0],
    });
    if (error) toast.error(error.message);
    else { toast.success(`Avenant ${numero} créé`); setCreateAvenantOpen(false); setAvenantForm({ devis_id: "", numero: "", description: "", montant_ht: "", tva: "20", statut: "brouillon", date: "" }); fetchData(); }
    setSaving(false);
  };

  const handleCreateTs = async () => {
    if (!user || !tsForm.devis_id) { toast.error("Sélectionnez un devis"); return; }
    setSaving(true);
    const numero = tsForm.numero || `TS-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await (supabase as any).from("travaux_supplementaires").insert({
      artisan_id: user.id, devis_id: tsForm.devis_id, numero,
      description: tsForm.description, montant_ht: parseFloat(tsForm.montant_ht) || 0,
      tva: parseFloat(tsForm.tva) || 20, statut: tsForm.statut,
      date: tsForm.date || new Date().toISOString().split("T")[0],
    });
    if (error) toast.error(error.message);
    else { toast.success(`TS ${numero} créé`); setCreateTsOpen(false); setTsForm({ devis_id: "", numero: "", description: "", montant_ht: "", tva: "20", statut: "brouillon", date: "" }); fetchData(); }
    setSaving(false);
  };

  const onFactureDevisChange = useCallback(async (devisId: string) => {
    // Find devis to prefill montant
    const d = devis.find((dv) => dv.id === devisId);
    const montant = d ? String(d.montant_ht) : "";
    setFactureForm((p) => ({ ...p, devis_id: devisId, montant_ht: montant, solde_restant: montant }));
    if (!devisId) { setCreateLignesFacture([newLigne()]); return; }
    // Copy lignes from the selected devis
    const { data } = await (supabase as any).from("lignes_devis").select("*").eq("devis_id", devisId).order("ordre");
    if (data && data.length > 0) {
      setCreateLignesFacture(data.map(dbToLigneForm));
    }
  }, [devis]);

  const handleCreateFacture = async () => {
    if (!user) return;
    setSaving(true);
    const numero = factureForm.numero || `FAC-${Date.now().toString(36).toUpperCase()}`;
    const lignesValides = createLignesFacture.filter(l => l.designation.trim() || parseFloat(l.prix_unitaire) > 0);
    const montant = lignesValides.length > 0
      ? lignesTotal(createLignesFacture)
      : parseFloat(factureForm.montant_ht) || 0;
    const { data: newFacture, error } = await supabase.from("factures").insert({
      artisan_id: user.id, devis_id: factureForm.devis_id, numero, montant_ht: montant,
      tva: parseFloat(factureForm.tva) || 20, statut: factureForm.statut as any,
      date_echeance: factureForm.date_echeance, solde_restant: parseFloat(factureForm.solde_restant) || montant,
    }).select("id").single();
    if (error) { toast.error(error.message); setSaving(false); return; }
    if (lignesValides.length > 0) await saveLignes("facture", newFacture.id, lignesValides);
    toast.success(`Facture ${numero} créée`);
    setCreateFactureOpen(false);
    setCreateLignesFacture([newLigne()]);
    fetchData();
    setSaving(false);
  };

  const handleCreateAvoir = async () => {
    if (!user) { return; }
    setSaving(true);
    const numero = avoirForm.numero || `AV-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await (supabase as any).from("avoirs").insert({
      artisan_id: user.id, numero,
      facture_id: avoirForm.facture_id || null, devis_id: avoirForm.devis_id || null,
      description: avoirForm.description, montant_ht: parseFloat(avoirForm.montant_ht) || 0,
      tva: parseFloat(avoirForm.tva) || 20, statut: avoirForm.statut,
      date: avoirForm.date || new Date().toISOString().split("T")[0],
    });
    if (error) toast.error(error.message);
    else { toast.success(`Avoir ${numero} créé`); setCreateAvoirOpen(false); setAvoirForm({ facture_id: "", devis_id: "", numero: "", description: "", montant_ht: "", tva: "20", statut: "brouillon", date: "" }); fetchData(); }
    setSaving(false);
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteDialog) return;
    const { error } = await (supabase as any).from(deleteDialog.table).delete().eq("id", deleteDialog.id);
    if (error) toast.error(error.message);
    else { toast.success(`${deleteDialog.label} supprimé(e)`); fetchData(); }
    setDeleteDialog(null);
  };

  // ── Edit save handler ─────────────────────────────────────────────────────
  const handleSaveEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    let error: any = null;
    if (editType === "devis") {
      ({ error } = await supabase.from("devis").update({
        numero: editForm.numero, montant_ht: parseFloat(editForm.montant_ht) || 0,
        tva: parseFloat(editForm.tva) || 20, statut: editForm.statut as any,
        date_validite: editForm.date_validite || null,
      }).eq("id", editItem.id));
    } else if (editType === "facture") {
      ({ error } = await supabase.from("factures").update({
        numero: editForm.numero, montant_ht: parseFloat(editForm.montant_ht) || 0,
        tva: parseFloat(editForm.tva) || 20, statut: editForm.statut as any,
        date_echeance: editForm.date_echeance, solde_restant: parseFloat(editForm.solde_restant) || 0,
      }).eq("id", editItem.id));
    } else if (editType === "avenant" || editType === "ts") {
      const table = editType === "avenant" ? "avenants" : "travaux_supplementaires";
      ({ error } = await (supabase as any).from(table).update({
        numero: editForm.numero, description: editForm.description,
        montant_ht: parseFloat(editForm.montant_ht) || 0, tva: parseFloat(editForm.tva) || 20,
        statut: editForm.statut, date: editForm.date,
      }).eq("id", editItem.id));
    } else if (editType === "avoir") {
      ({ error } = await (supabase as any).from("avoirs").update({
        numero: editForm.numero, description: editForm.description,
        montant_ht: parseFloat(editForm.montant_ht) || 0, tva: parseFloat(editForm.tva) || 20,
        statut: editForm.statut, date: editForm.date,
      }).eq("id", editItem.id));
    }
    if (error) toast.error(error.message);
    else { toast.success("Modifié avec succès"); setEditDialogOpen(false); fetchData(); }
    setSaving(false);
  };

  // ── Open edit ─────────────────────────────────────────────────────────────
  const openEdit = (type: typeof editType, item: any) => {
    setEditType(type);
    setEditItem(item);
    if (type === "devis") setEditForm({ numero: item.numero, montant_ht: String(item.montant_ht), tva: String(item.tva), statut: item.statut, date_validite: item.date_validite || "" });
    else if (type === "facture") setEditForm({ numero: item.numero, montant_ht: String(item.montant_ht), tva: String(item.tva), statut: item.statut, date_echeance: item.date_echeance || "", solde_restant: String(item.solde_restant) });
    else setEditForm({ numero: item.numero || "", description: item.description || "", montant_ht: String(item.montant_ht), tva: String(item.tva), statut: item.statut, date: item.date || "" });
    setEditDialogOpen(true);
  };

  // ── Open detail (devis/facture full view) ─────────────────────────────────
  const openDetail = (type: "devis" | "facture", item: any) => {
    setDetailType(type);
    setDetailItem(item);
    if (type === "devis") setDetailForm({ numero: item.numero, montant_ht: String(item.montant_ht), tva: String(item.tva), statut: item.statut, date_validite: item.date_validite || "", chantier_id: item.chantier_id, facturx_ready: item.facturx_ready });
    else setDetailForm({ numero: item.numero, montant_ht: String(item.montant_ht), tva: String(item.tva), statut: item.statut, date_echeance: item.date_echeance || "", solde_restant: String(item.solde_restant) });
    setDetailLignes([]);
    loadDetailLignes(type, item.id);
    setDetailOpen(true);
  };

  const handleSaveDetail = async () => {
    if (!detailItem) return;
    setSaving(true);
    // Recalcule montant_ht si des lignes sont présentes
    const lignesValides = detailLignes.filter(l => l.designation.trim() || parseFloat(l.prix_unitaire) > 0);
    const montantHt = lignesValides.length > 0 ? lignesTotal(detailLignes) : parseFloat(detailForm.montant_ht) || 0;
    let error: any = null;
    if (detailType === "devis") {
      ({ error } = await supabase.from("devis").update({
        numero: detailForm.numero, montant_ht: montantHt,
        tva: parseFloat(detailForm.tva) || 20, statut: detailForm.statut as any,
        date_validite: detailForm.date_validite || null, chantier_id: detailForm.chantier_id,
        facturx_ready: detailForm.facturx_ready,
      }).eq("id", detailItem.id));
    } else {
      const solde = lignesValides.length > 0 ? montantHt : parseFloat(detailForm.solde_restant) || 0;
      ({ error } = await supabase.from("factures").update({
        numero: detailForm.numero, montant_ht: montantHt,
        tva: parseFloat(detailForm.tva) || 20, statut: detailForm.statut as any,
        date_echeance: detailForm.date_echeance, solde_restant: solde,
      }).eq("id", detailItem.id));
    }
    if (error) { toast.error(error.message); setSaving(false); return; }
    await saveLignes(detailType, detailItem.id, lignesValides);
    toast.success("Mis à jour");
    setDetailOpen(false);
    fetchData();
    setSaving(false);
  };

  // ── Reusable doc card actions ─────────────────────────────────────────────
  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up flex-wrap gap-2">
        <h1 className="text-h2 font-display">Devis &amp; Factures</h1>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setCreateDevisOpen(true)} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
            <Plus className="w-4 h-4 mr-1" /> Nouveau devis
          </Button>
          <Button variant="outline" onClick={() => setCreateFactureOpen(true)} className="touch-target">
            <Plus className="w-4 h-4 mr-1" /> Nouvelle facture
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-secondary flex-wrap h-auto gap-1">
          <TabsTrigger value="devis" className="touch-target"><FileText className="w-4 h-4 mr-1" /> Devis</TabsTrigger>
          <TabsTrigger value="avenants" className="touch-target"><FileText className="w-4 h-4 mr-1" /> Avenants</TabsTrigger>
          <TabsTrigger value="ts" className="touch-target"><Wrench className="w-4 h-4 mr-1" /> TS</TabsTrigger>
          <TabsTrigger value="factures" className="touch-target"><Receipt className="w-4 h-4 mr-1" /> Factures</TabsTrigger>
          <TabsTrigger value="avoirs" className="touch-target"><FileX className="w-4 h-4 mr-1" /> Avoirs</TabsTrigger>
        </TabsList>

        {/* ── DEVIS ── */}
        <TabsContent value="devis">
          <div className="space-y-2 mt-4">
            {devis.length === 0 && <p className="text-center text-muted-foreground py-12">Aucun devis</p>}
            {devis.map((d) => {
              const client = getClientForDevis(d.id);
              const chantier = chantiers.find((c) => c.id === d.chantier_id);
              return (
                <div key={d.id} className="forge-card !p-4 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => openTemplatePdf("devis", d.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{d.numero}</p>
                        <StatutBadge statut={d.statut} styles={DEVIS_STYLES} labels={DEVIS_STATUTS} />
                        {pdfLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <ClientInfo client={client} />
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-muted-foreground font-mono">{Number(d.montant_ht).toLocaleString("fr-FR")} € HT · TVA {Number(d.tva)}%</p>
                        {chantier && <p className="text-xs text-muted-foreground">Chantier : {chantier.nom}</p>}
                        {d.date_validite && <p className="text-xs text-muted-foreground">Validité : {new Date(d.date_validite).toLocaleDateString("fr-FR")}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={stopProp}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-violet-600" title="Envoyer en signature électronique" onClick={() => openSend("signature", "devis", d.id)}><PenLine className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier les lignes / détail" onClick={() => openDetail("devis", d)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Supprimer" onClick={() => setDeleteDialog({ id: d.id, table: "devis", label: "Devis" })}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setCreateDevisOpen(true)} className="mt-2 w-full">
              <Plus className="w-4 h-4 mr-1" /> Nouveau devis
            </Button>
          </div>
        </TabsContent>

        {/* ── AVENANTS ── */}
        <TabsContent value="avenants">
          <div className="space-y-2 mt-4">
            {avenants.length === 0 && <p className="text-center text-muted-foreground py-12">Aucun avenant</p>}
            {avenants.map((av) => {
              const client = getClientForAvenant(av.id);
              const parentDevis = devis.find((d) => d.id === av.devis_id);
              return (
                <div key={av.id} className="forge-card !p-4 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => openTemplatePdf("avenant", av.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{av.numero || `Avenant du ${new Date(av.date).toLocaleDateString("fr-FR")}`}</p>
                        <StatutBadge statut={av.statut} styles={DEVIS_STYLES} labels={DEVIS_STATUTS} />
                        {pdfLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <ClientInfo client={client} />
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-muted-foreground font-mono">{Number(av.montant_ht).toLocaleString("fr-FR")} € HT</p>
                        {parentDevis && <p className="text-xs text-muted-foreground">Devis parent : {parentDevis.numero}</p>}
                        {av.description && <p className="text-xs text-muted-foreground truncate">{av.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={stopProp}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier" onClick={() => openEdit("avenant", av)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Supprimer" onClick={() => setDeleteDialog({ id: av.id, table: "avenants", label: "Avenant" })}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setCreateAvenantOpen(true)} className="mt-2 w-full">
              <Plus className="w-4 h-4 mr-1" /> Nouvel avenant
            </Button>
          </div>
        </TabsContent>

        {/* ── TS (Travaux Supplémentaires) ── */}
        <TabsContent value="ts">
          <div className="space-y-2 mt-4">
            {travauxSupps.length === 0 && <p className="text-center text-muted-foreground py-12">Aucun travaux supplémentaires</p>}
            {travauxSupps.map((ts) => {
              const client = getClientForTs(ts.id);
              const parentDevis = devis.find((d) => d.id === ts.devis_id);
              return (
                <div key={ts.id} className="forge-card !p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{ts.numero}</p>
                        <StatutBadge statut={ts.statut} styles={DEVIS_STYLES} labels={DEVIS_STATUTS} />
                      </div>
                      <ClientInfo client={client} />
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-muted-foreground font-mono">{Number(ts.montant_ht).toLocaleString("fr-FR")} € HT · TVA {Number(ts.tva)}%</p>
                        {parentDevis && <p className="text-xs text-muted-foreground">Devis parent : {parentDevis.numero}</p>}
                        {ts.description && <p className="text-xs text-muted-foreground truncate">{ts.description}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit("ts", ts)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteDialog({ id: ts.id, table: "travaux_supplementaires", label: "TS" })}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setCreateTsOpen(true)} className="mt-2 w-full">
              <Plus className="w-4 h-4 mr-1" /> Nouveaux travaux supplémentaires
            </Button>
          </div>
        </TabsContent>

        {/* ── FACTURES ── */}
        <TabsContent value="factures">
          <div className="space-y-2 mt-4">
            {factures.length === 0 && <p className="text-center text-muted-foreground py-12">Aucune facture</p>}
            {factures.map((f) => {
              const client = getClientForFacture(f.id);
              const linkedDevis = devis.find((d) => d.id === f.devis_id);
              return (
                <div key={f.id} className="forge-card !p-4 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={() => openTemplatePdf("facture", f.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{f.numero}</p>
                        <StatutBadge statut={f.statut} styles={FACTURE_STYLES} labels={FACTURE_STATUTS} />
                        {pdfLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <ClientInfo client={client} />
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-muted-foreground font-mono">{Number(f.montant_ht).toLocaleString("fr-FR")} € HT · Reste : {Number(f.solde_restant).toLocaleString("fr-FR")} €</p>
                        <p className="text-xs text-muted-foreground">Échéance : {new Date(f.date_echeance).toLocaleDateString("fr-FR")}</p>
                        {linkedDevis && <p className="text-xs text-muted-foreground">Devis : {linkedDevis.numero}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={stopProp}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" title="Envoyer lien paiement sécurisé" onClick={() => openSend("paiement", "facture", f.id)}><CreditCard className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Modifier les lignes / détail" onClick={() => openDetail("facture", f)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Supprimer" onClick={() => setDeleteDialog({ id: f.id, table: "factures", label: "Facture" })}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setCreateFactureOpen(true)} className="mt-2 w-full">
              <Plus className="w-4 h-4 mr-1" /> Nouvelle facture
            </Button>
          </div>
        </TabsContent>

        {/* ── AVOIRS ── */}
        <TabsContent value="avoirs">
          <div className="space-y-2 mt-4">
            {avoirs.length === 0 && <p className="text-center text-muted-foreground py-12">Aucun avoir</p>}
            {avoirs.map((av) => {
              const linkedFacture = factures.find((f) => f.id === av.facture_id);
              const linkedDevis   = devis.find((d) => d.id === av.devis_id);
              return (
                <div key={av.id} className="forge-card !p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{av.numero}</p>
                        <StatutBadge statut={av.statut} styles={AVOIR_STYLES} labels={AVOIR_STATUTS} />
                      </div>
                      <div className="mt-1 space-y-0.5">
                        <p className="text-xs text-muted-foreground font-mono">{Number(av.montant_ht).toLocaleString("fr-FR")} € HT · TVA {Number(av.tva)}%</p>
                        {linkedFacture && <p className="text-xs text-muted-foreground">Facture : {linkedFacture.numero}</p>}
                        {linkedDevis   && <p className="text-xs text-muted-foreground">Devis : {linkedDevis.numero}</p>}
                        {av.description && <p className="text-xs text-muted-foreground truncate">{av.description}</p>}
                        <p className="text-xs text-muted-foreground">Date : {new Date(av.date).toLocaleDateString("fr-FR")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit("avoir", av)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteDialog({ id: av.id, table: "avoirs", label: "Avoir" })}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setCreateAvoirOpen(true)} className="mt-2 w-full">
              <Plus className="w-4 h-4 mr-1" /> Nouvel avoir
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* DIALOGS                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* ── Create Devis ── */}
      <Dialog open={createDevisOpen} onOpenChange={(o) => { setCreateDevisOpen(o); if (!o) { setAiResult(null); setAiDesc(""); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display">Créer un devis</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant={devisForm.use_existing_chantier ? "default" : "outline"} size="sm" onClick={() => setDevisForm((p) => ({ ...p, use_existing_chantier: true }))}>Chantier existant</Button>
              <Button variant={!devisForm.use_existing_chantier ? "default" : "outline"} size="sm" onClick={() => setDevisForm((p) => ({ ...p, use_existing_chantier: false }))}>Nouveau client + chantier</Button>
            </div>
            {devisForm.use_existing_chantier ? (
              <div className="space-y-2">
                <Label>Chantier</Label>
                <Select value={devisForm.chantier_id} onValueChange={(v) => setDevisForm((p) => ({ ...p, chantier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>{chantiers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium">Informations client</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label>Prénom</Label><Input value={devisForm.client_prenom} onChange={(e) => setDevisForm((p) => ({ ...p, client_prenom: e.target.value }))} placeholder="Jean" /></div>
                    <div className="space-y-1"><Label>Nom</Label><Input value={devisForm.client_nom} onChange={(e) => setDevisForm((p) => ({ ...p, client_nom: e.target.value }))} placeholder="Dupont" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label>Email</Label><Input type="email" value={devisForm.client_email} onChange={(e) => setDevisForm((p) => ({ ...p, client_email: e.target.value }))} placeholder="email@..." /></div>
                    <div className="space-y-1"><Label>Téléphone</Label><Input value={devisForm.client_telephone} onChange={(e) => setDevisForm((p) => ({ ...p, client_telephone: e.target.value }))} placeholder="06..." /></div>
                  </div>
                  <div className="space-y-1"><Label>Adresse client *</Label><AddressFields value={devisForm.client_adresse} onChange={(v) => setDevisForm((p) => ({ ...p, client_adresse: v }))} required /></div>
                  <div className="space-y-1"><Label>Type</Label>
                    <Select value={devisForm.client_type} onValueChange={(v) => setDevisForm((p) => ({ ...p, client_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="particulier">Particulier</SelectItem><SelectItem value="pro">Professionnel</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
                  <p className="text-sm font-medium">Informations chantier</p>
                  <div className="space-y-1"><Label>Nom du chantier</Label><Input value={devisForm.chantier_nom} onChange={(e) => setDevisForm((p) => ({ ...p, chantier_nom: e.target.value }))} placeholder="Rénovation salle de bain" /></div>
                  <div className="flex items-center gap-2 py-1">
                    <Checkbox
                      id="same-addr"
                      checked={sameAddressAsClient}
                      onCheckedChange={(checked) => {
                        const v = checked === true;
                        setSameAddressAsClient(v);
                        if (v) setDevisForm((p) => ({ ...p, chantier_adresse: p.client_adresse }));
                      }}
                    />
                    <label htmlFor="same-addr" className="text-xs text-muted-foreground cursor-pointer select-none">
                      Même adresse que le client
                    </label>
                  </div>
                  <div className="space-y-1"><Label>Adresse du chantier *</Label><AddressFields value={devisForm.chantier_adresse} onChange={(v) => { setSameAddressAsClient(false); setDevisForm((p) => ({ ...p, chantier_adresse: v })); }} required /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1"><Label>Date début</Label><Input type="date" value={devisForm.chantier_date_debut} onChange={(e) => setDevisForm((p) => ({ ...p, chantier_date_debut: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Date fin prévue</Label><Input type="date" value={devisForm.chantier_date_fin_prevue} onChange={(e) => setDevisForm((p) => ({ ...p, chantier_date_fin_prevue: e.target.value }))} /></div>
                  </div>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Numéro</Label><Input value={devisForm.numero} onChange={(e) => setDevisForm((p) => ({ ...p, numero: e.target.value }))} placeholder="Auto-généré" /></div>
              <div className="space-y-1"><Label>Date validité</Label><Input type="date" value={devisForm.date_validite} onChange={(e) => setDevisForm((p) => ({ ...p, date_validite: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>TVA par défaut (%)</Label><Input type="number" value={devisForm.tva} onChange={(e) => setDevisForm((p) => ({ ...p, tva: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Statut</Label>
                <Select value={devisForm.statut} onValueChange={(v) => setDevisForm((p) => ({ ...p, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(DEVIS_STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Lignes du devis */}
            <div className="space-y-2">
              <Label>Lignes du devis</Label>
              <LignesEditor lignes={createLignesDevis} onChange={setCreateLignesDevis} />
            </div>

            {/* Montant global si aucune ligne */}
            {createLignesDevis.filter(l => l.designation.trim() || l.prix_unitaire).length === 0 && (
              <div className="space-y-1">
                <Label>Montant HT global (€) <span className="text-muted-foreground text-xs">— si pas de lignes détaillées</span></Label>
                <Input type="number" value={devisForm.montant_ht} onChange={(e) => setDevisForm((p) => ({ ...p, montant_ht: e.target.value }))} placeholder="0" />
              </div>
            )}

            <div className="border-t pt-3 space-y-2">
              <Label>Génération IA des lignes (optionnel)</Label>
              <Textarea value={aiDesc} onChange={(e) => setAiDesc(e.target.value)} placeholder="Décrivez les travaux : rénovation salle de bain, pose carrelage 20m², peinture…" rows={3} />
              <div className="flex gap-2">
                <Button onClick={handleGenerateAI} disabled={aiLoading || !aiDesc} variant="outline" className="flex-1">
                  <Bot className="w-4 h-4 mr-2" />{aiLoading ? "Génération…" : "Chiffrer avec l'IA"}
                </Button>
                {aiResult && (
                  <Button onClick={importAiLignes} variant="default" className="flex-1 bg-primary gap-1.5">
                    <Sparkles className="w-4 h-4" /> Importer les lignes
                  </Button>
                )}
              </div>
              {aiResult && <div className="bg-card rounded-lg p-3 text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto border text-muted-foreground">{aiResult}</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDevisOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateDevis} disabled={saving} className="bg-primary text-primary-foreground">{saving ? "Création…" : "Créer le devis"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Avenant ── */}
      <Dialog open={createAvenantOpen} onOpenChange={setCreateAvenantOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nouvel avenant</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Devis associé *</Label>
              <Select value={avenantForm.devis_id} onValueChange={(v) => setAvenantForm((p) => ({ ...p, devis_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un devis" /></SelectTrigger>
                <SelectContent>{devis.map((d) => <SelectItem key={d.id} value={d.id}>{d.numero}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Numéro</Label><Input value={avenantForm.numero} onChange={(e) => setAvenantForm((p) => ({ ...p, numero: e.target.value }))} placeholder="Auto-généré" /></div>
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={avenantForm.date} onChange={(e) => setAvenantForm((p) => ({ ...p, date: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={avenantForm.description} onChange={(e) => setAvenantForm((p) => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Montant HT (€)</Label><Input type="number" value={avenantForm.montant_ht} onChange={(e) => setAvenantForm((p) => ({ ...p, montant_ht: e.target.value }))} /></div>
              <div className="space-y-1"><Label>TVA (%)</Label><Input type="number" value={avenantForm.tva} onChange={(e) => setAvenantForm((p) => ({ ...p, tva: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Statut</Label>
              <Select value={avenantForm.statut} onValueChange={(v) => setAvenantForm((p) => ({ ...p, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DEVIS_STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAvenantOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateAvenant} disabled={saving} className="bg-primary text-primary-foreground">{saving ? "Création…" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create TS ── */}
      <Dialog open={createTsOpen} onOpenChange={setCreateTsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Travaux supplémentaires</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Devis associé *</Label>
              <Select value={tsForm.devis_id} onValueChange={(v) => setTsForm((p) => ({ ...p, devis_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un devis" /></SelectTrigger>
                <SelectContent>{devis.map((d) => <SelectItem key={d.id} value={d.id}>{d.numero}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Numéro</Label><Input value={tsForm.numero} onChange={(e) => setTsForm((p) => ({ ...p, numero: e.target.value }))} placeholder="Auto-généré" /></div>
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={tsForm.date} onChange={(e) => setTsForm((p) => ({ ...p, date: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={tsForm.description} onChange={(e) => setTsForm((p) => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Montant HT (€)</Label><Input type="number" value={tsForm.montant_ht} onChange={(e) => setTsForm((p) => ({ ...p, montant_ht: e.target.value }))} /></div>
              <div className="space-y-1"><Label>TVA (%)</Label><Input type="number" value={tsForm.tva} onChange={(e) => setTsForm((p) => ({ ...p, tva: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Statut</Label>
              <Select value={tsForm.statut} onValueChange={(v) => setTsForm((p) => ({ ...p, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DEVIS_STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateTsOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateTs} disabled={saving} className="bg-primary text-primary-foreground">{saving ? "Création…" : "Créer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Facture ── */}
      <Dialog open={createFactureOpen} onOpenChange={setCreateFactureOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nouvelle facture</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Devis associé *</Label>
              <Select value={factureForm.devis_id} onValueChange={onFactureDevisChange}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un devis" /></SelectTrigger>
                <SelectContent>{devis.map((d) => <SelectItem key={d.id} value={d.id}>{d.numero} — {Number(d.montant_ht).toLocaleString("fr-FR")} €</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Numéro</Label><Input value={factureForm.numero} onChange={(e) => setFactureForm((p) => ({ ...p, numero: e.target.value }))} placeholder="Auto-généré" /></div>
              <div className="space-y-1"><Label>Date d'échéance *</Label><Input type="date" value={factureForm.date_echeance} onChange={(e) => setFactureForm((p) => ({ ...p, date_echeance: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>TVA par défaut (%)</Label><Input type="number" value={factureForm.tva} onChange={(e) => setFactureForm((p) => ({ ...p, tva: e.target.value }))} /></div>
              <div className="space-y-1"><Label>Statut</Label>
                <Select value={factureForm.statut} onValueChange={(v) => setFactureForm((p) => ({ ...p, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(FACTURE_STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Lignes de la facture */}
            <div className="space-y-2">
              <Label>Lignes de la facture</Label>
              <LignesEditor lignes={createLignesFacture} onChange={setCreateLignesFacture} />
            </div>

            {/* Montant global si aucune ligne */}
            {createLignesFacture.filter(l => l.designation.trim() || l.prix_unitaire).length === 0 && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Montant HT (€)</Label><Input type="number" value={factureForm.montant_ht} onChange={(e) => setFactureForm((p) => ({ ...p, montant_ht: e.target.value }))} /></div>
                <div className="space-y-1"><Label>Solde restant (€)</Label><Input type="number" value={factureForm.solde_restant} onChange={(e) => setFactureForm((p) => ({ ...p, solde_restant: e.target.value }))} placeholder="= Montant HT" /></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateFactureOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateFacture} disabled={saving || !factureForm.devis_id || !factureForm.date_echeance} className="bg-primary text-primary-foreground">{saving ? "Création…" : "Créer la facture"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Avoir ── */}
      <Dialog open={createAvoirOpen} onOpenChange={setCreateAvoirOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Nouvel avoir</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Numéro</Label><Input value={avoirForm.numero} onChange={(e) => setAvoirForm((p) => ({ ...p, numero: e.target.value }))} placeholder="Auto-généré" /></div>
              <div className="space-y-1"><Label>Date</Label><Input type="date" value={avoirForm.date} onChange={(e) => setAvoirForm((p) => ({ ...p, date: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Facture liée (optionnel)</Label>
              <Select value={avoirForm.facture_id} onValueChange={(v) => setAvoirForm((p) => ({ ...p, facture_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent><SelectItem value="">Aucune</SelectItem>{factures.map((f) => <SelectItem key={f.id} value={f.id}>{f.numero}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Devis lié (optionnel)</Label>
              <Select value={avoirForm.devis_id} onValueChange={(v) => setAvoirForm((p) => ({ ...p, devis_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent><SelectItem value="">Aucun</SelectItem>{devis.map((d) => <SelectItem key={d.id} value={d.id}>{d.numero}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Description</Label><Textarea value={avoirForm.description} onChange={(e) => setAvoirForm((p) => ({ ...p, description: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>Montant HT (€)</Label><Input type="number" value={avoirForm.montant_ht} onChange={(e) => setAvoirForm((p) => ({ ...p, montant_ht: e.target.value }))} /></div>
              <div className="space-y-1"><Label>TVA (%)</Label><Input type="number" value={avoirForm.tva} onChange={(e) => setAvoirForm((p) => ({ ...p, tva: e.target.value }))} /></div>
            </div>
            <div className="space-y-1"><Label>Statut</Label>
              <Select value={avoirForm.statut} onValueChange={(v) => setAvoirForm((p) => ({ ...p, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(AVOIR_STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateAvoirOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateAvoir} disabled={saving} className="bg-primary text-primary-foreground">{saving ? "Création…" : "Créer l'avoir"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit (generic) ── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Modifier {editType === "devis" ? "le devis" : editType === "facture" ? "la facture" : editType === "avenant" ? "l'avenant" : editType === "ts" ? "le TS" : "l'avoir"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(editType === "devis" || editType === "facture" || editType === "avenant" || editType === "ts" || editType === "avoir") && (
              <>
                <div className="space-y-1"><Label>Numéro</Label><Input value={editForm.numero ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, numero: e.target.value }))} /></div>
                {(editType === "avenant" || editType === "ts" || editType === "avoir") && (
                  <>
                    <div className="space-y-1"><Label>Description</Label><Textarea value={editForm.description ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, description: e.target.value }))} rows={2} /></div>
                    <div className="space-y-1"><Label>Date</Label><Input type="date" value={editForm.date ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, date: e.target.value }))} /></div>
                  </>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label>Montant HT (€)</Label><Input type="number" value={editForm.montant_ht ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, montant_ht: e.target.value }))} /></div>
                  <div className="space-y-1"><Label>TVA (%)</Label><Input type="number" value={editForm.tva ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, tva: e.target.value }))} /></div>
                </div>
                {editType === "facture" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Date échéance</Label><Input type="date" value={editForm.date_echeance ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, date_echeance: e.target.value }))} /></div>
                    <div className="space-y-1"><Label>Solde restant (€)</Label><Input type="number" value={editForm.solde_restant ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, solde_restant: e.target.value }))} /></div>
                  </div>
                )}
                {editType === "devis" && (
                  <div className="space-y-1"><Label>Date validité</Label><Input type="date" value={editForm.date_validite ?? ""} onChange={(e) => setEditForm((p: any) => ({ ...p, date_validite: e.target.value }))} /></div>
                )}
                <div className="space-y-1"><Label>Statut</Label>
                  <Select value={editForm.statut ?? ""} onValueChange={(v) => setEditForm((p: any) => ({ ...p, statut: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(editType === "facture" ? FACTURE_STATUTS : editType === "avoir" ? AVOIR_STATUTS : DEVIS_STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={saving} className="bg-primary text-primary-foreground">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Devis / Facture ── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {detailType === "devis" ? `Devis ${detailItem?.numero}` : `Facture ${detailItem?.numero}`}
            </DialogTitle>
          </DialogHeader>
          {detailItem && (
            <div className="space-y-4">
              {/* Client recap */}
              {(() => {
                const client = detailType === "devis" ? getClientForDevis(detailItem.id) : getClientForFacture(detailItem.id);
                return client ? (
                  <div className="p-3 bg-muted/40 rounded-lg space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</p>
                    <p className="text-sm font-medium">{clientFullName(client)}</p>
                    {client.email    && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</p>}
                    {client.telephone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{client.telephone}</p>}
                    {client.adresse  && <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{client.adresse}</p>}
                  </div>
                ) : null;
              })()}
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Numéro</p><Input value={detailForm.numero ?? ""} onChange={(e) => setDetailForm((p: any) => ({ ...p, numero: e.target.value }))} /></div>
                <div><p className="text-xs text-muted-foreground">Statut</p>
                  <Select value={detailForm.statut ?? ""} onValueChange={(v) => setDetailForm((p: any) => ({ ...p, statut: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(detailType === "devis" ? DEVIS_STATUTS : FACTURE_STATUTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Montant HT (€)</p><Input type="number" value={detailForm.montant_ht ?? ""} onChange={(e) => setDetailForm((p: any) => ({ ...p, montant_ht: e.target.value }))} /></div>
                <div><p className="text-xs text-muted-foreground">TVA (%)</p><Input type="number" value={detailForm.tva ?? ""} onChange={(e) => setDetailForm((p: any) => ({ ...p, tva: e.target.value }))} /></div>
              </div>
              <div><p className="text-xs text-muted-foreground">Montant TTC</p><p className="font-mono font-semibold">{((parseFloat(detailForm.montant_ht) || 0) * (1 + (parseFloat(detailForm.tva) || 20) / 100)).toLocaleString("fr-FR")} €</p></div>
              {detailType === "devis" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Date de validité</p><Input type="date" value={detailForm.date_validite ?? ""} onChange={(e) => setDetailForm((p: any) => ({ ...p, date_validite: e.target.value }))} /></div>
                  <div><p className="text-xs text-muted-foreground">Chantier</p>
                    <Select value={detailForm.chantier_id ?? ""} onValueChange={(v) => setDetailForm((p: any) => ({ ...p, chantier_id: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{chantiers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              {detailType === "facture" && (
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Date d'échéance</p><Input type="date" value={detailForm.date_echeance ?? ""} onChange={(e) => setDetailForm((p: any) => ({ ...p, date_echeance: e.target.value }))} /></div>
                  <div><p className="text-xs text-muted-foreground">Solde restant (€)</p><Input type="number" value={detailForm.solde_restant ?? ""} onChange={(e) => setDetailForm((p: any) => ({ ...p, solde_restant: e.target.value }))} /></div>
                </div>
              )}
              {/* Lignes éditables */}
              <div className="space-y-2">
                <Label>Lignes</Label>
                {detailLignesLoading
                  ? <p className="text-xs text-muted-foreground text-center py-3">Chargement des lignes…</p>
                  : <LignesEditor lignes={detailLignes} onChange={setDetailLignes} />
                }
              </div>

              <div className="text-xs text-muted-foreground">
                Créé le {new Date(detailItem.created_at).toLocaleString("fr-FR")} · Modifié le {new Date(detailItem.updated_at).toLocaleString("fr-FR")}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetailOpen(false)}>Fermer</Button>
            {detailItem && (
              <Button variant="outline" disabled={pdfLoading} onClick={() => openTemplatePdf(detailType, detailItem.id)}>
                {pdfLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />} Aperçu A4
              </Button>
            )}
            <Button onClick={handleSaveDetail} disabled={saving} className="bg-primary text-primary-foreground">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Send (Signature / Paiement) ── */}
      <Dialog open={!!sendDialog} onOpenChange={(o) => !o && setSendDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {sendDialog?.mode === "signature"
                ? <><PenLine className="w-5 h-5 text-violet-600" /> Envoyer en signature électronique</>
                : <><CreditCard className="w-5 h-5 text-emerald-600" /> Envoyer le lien de paiement</>}
            </DialogTitle>
            <DialogDescription>{sendDialog?.docNum}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <FileText className="w-8 h-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{sendDialog?.docNum}</p>
                <p className="text-xs text-muted-foreground">{sendDialog?.mode === "signature" ? "Devis" : "Facture"}</p>
              </div>
              {sendDialog && (
                <Button size="sm" variant="outline" onClick={() => openTemplatePdf(sendDialog.docType, sendDialog.docId)} className="shrink-0 gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Aperçu PDF
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Email du destinataire <span className="text-destructive">*</span></Label>
              <Input type="email" value={sendEmail} onChange={(e) => setSendEmail(e.target.value)} placeholder="client@exemple.fr" />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={sendMessage} onChange={(e) => setSendMessage(e.target.value)} rows={5} className="text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialog(null)}>Annuler</Button>
            <Button
              onClick={handleSend}
              disabled={sendLoading || !sendEmail.trim()}
              className={sendDialog?.mode === "signature" ? "bg-violet-600 hover:bg-violet-700 text-white gap-2" : "bg-emerald-600 hover:bg-emerald-700 text-white gap-2"}
            >
              <Send className="w-4 h-4" />
              {sendLoading ? "Préparation…" : sendDialog?.mode === "signature" ? "Envoyer pour signature" : "Envoyer le lien"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── A4 PDF Preview Sheet ── */}
      <Sheet open={pdfPreviewOpen} onOpenChange={setPdfPreviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-3xl p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b shrink-0 flex flex-row items-center justify-between">
            <SheetTitle className="font-display text-base">{pdfPreviewTitle}</SheetTitle>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const iframe = document.getElementById("pdf-preview-iframe") as HTMLIFrameElement | null;
                iframe?.contentWindow?.print();
              }}
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer / PDF
            </Button>
          </SheetHeader>
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            {pdfPreviewHtml ? (
              <iframe
                id="pdf-preview-iframe"
                srcDoc={pdfPreviewHtml}
                className="w-full bg-white shadow-lg rounded-lg border"
                style={{ minHeight: "1123px" }}
                title="Aperçu A4"
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
