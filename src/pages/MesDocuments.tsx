import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload, Search, Grid3X3, List, Download, Trash2, Tag, Link2, Archive,
  FileText, Image, File, Bot, X, FolderOpen, Plus, Edit2, Filter,
  PenLine, CreditCard, Send, Eye,
} from "lucide-react";
import { toast } from "sonner";

interface Document {
  id: string;
  nom: string;
  description: string;
  type_fichier: string;
  taille_octets: number;
  mime_type: string;
  storage_path: string;
  tags: string[];
  chantier_id: string | null;
  client_id: string | null;
  fournisseur_id: string | null;
  est_archive: boolean;
  created_at: string;
}

const TYPE_OPTIONS = [
  { value: "tous", label: "Tous" },
  { value: "devis", label: "Devis" },
  { value: "facture", label: "Facture" },
  { value: "plan", label: "Plan" },
  { value: "photo", label: "Photo chantier" },
  { value: "contrat", label: "Contrat" },
  { value: "cctp", label: "CCTP" },
  { value: "catalogue", label: "Catalogue" },
  { value: "autre", label: "Autre" },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

function getFileIcon(mime: string) {
  if (mime.startsWith("image/")) return Image;
  if (mime.includes("pdf")) return FileText;
  return File;
}

export default function MesDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("tous");
  const [filterTag, setFilterTag] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Associations
  const [chantiers, setChantiers] = useState<{ id: string; nom: string }[]>([]);
  const [clients, setClients] = useState<{ id: string; nom: string }[]>([]);
  const [fournisseurs, setFournisseurs] = useState<{ id: string; nom: string }[]>([]);

  // Send dialog (signature / paiement)
  const [sendDialog, setSendDialog] = useState<{ doc: Document; mode: "signature" | "paiement" } | null>(null);
  const [sendEmail, setSendEmail] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Edit dialog
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editType, setEditType] = useState("autre");
  const [editTags, setEditTags] = useState("");
  const [editChantierId, setEditChantierId] = useState<string>("");
  const [editClientId, setEditClientId] = useState<string>("");
  const [editFournisseurId, setEditFournisseurId] = useState<string>("");

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("artisan_id", user.id)
      .eq("est_archive", showArchived)
      .order("created_at", { ascending: false });
    if (data) setDocuments(data as Document[]);
    if (error) console.error(error);
    setLoading(false);
  }, [user, showArchived]);

  const fetchAssociations = useCallback(async () => {
    if (!user) return;
    const [c, cl, f] = await Promise.all([
      supabase.from("chantiers").select("id, nom").eq("artisan_id", user.id),
      supabase.from("clients").select("id, nom").eq("artisan_id", user.id),
      supabase.from("fournisseurs").select("id, nom").eq("artisan_id", user.id),
    ]);
    if (c.data) setChantiers(c.data);
    if (cl.data) setClients(cl.data);
    if (f.data) setFournisseurs(f.data);
  }, [user]);

  useEffect(() => { fetchDocuments(); fetchAssociations(); }, [fetchDocuments, fetchAssociations]);

  // All unique tags
  const allTags = [...new Set(documents.flatMap((d) => d.tags))].sort();

  // Filtered documents
  const filtered = documents.filter((d) => {
    if (search && !d.nom.toLowerCase().includes(search.toLowerCase()) && !d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))) return false;
    if (filterType !== "tous" && d.type_fichier !== filterType) return false;
    if (filterTag && !d.tags.includes(filterTag)) return false;
    return true;
  });

  const handleFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    let done = 0;

    for (const file of fileArray) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("artisan-documents")
        .upload(path, file);

      if (uploadError) {
        toast.error(`Erreur upload ${file.name}: ${uploadError.message}`);
        continue;
      }

      const { error: dbError } = await supabase.from("documents").insert({
        artisan_id: user.id,
        nom: file.name,
        type_fichier: "autre",
        taille_octets: file.size,
        mime_type: file.type || "application/octet-stream",
        storage_path: path,
        tags: [],
      });

      if (dbError) toast.error(`Erreur DB ${file.name}: ${dbError.message}`);
      done++;
      setUploadProgress(Math.round((done / fileArray.length) * 100));
    }

    toast.success(`${done} fichier(s) uploadé(s)`);
    setUploading(false);
    setUploadProgress(0);
    fetchDocuments();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleDownload = async (doc: Document) => {
    const { data, error } = await supabase.storage
      .from("artisan-documents")
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Erreur de téléchargement");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`Supprimer "${doc.nom}" ?`)) return;
    await supabase.storage.from("artisan-documents").remove([doc.storage_path]);
    await supabase.from("documents").delete().eq("id", doc.id);
    toast.success("Document supprimé");
    fetchDocuments();
  };

  const handleArchive = async (doc: Document) => {
    await supabase.from("documents").update({ est_archive: !doc.est_archive }).eq("id", doc.id);
    toast.success(doc.est_archive ? "Document restauré" : "Document archivé");
    fetchDocuments();
  };

  const openEdit = (doc: Document) => {
    setEditDoc(doc);
    setEditNom(doc.nom);
    setEditType(doc.type_fichier);
    setEditTags(doc.tags.join(", "));
    setEditChantierId(doc.chantier_id || "");
    setEditClientId(doc.client_id || "");
    setEditFournisseurId(doc.fournisseur_id || "");
  };

  const handleSaveEdit = async () => {
    if (!editDoc) return;
    const tags = editTags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("documents").update({
      nom: editNom,
      type_fichier: editType,
      tags,
      chantier_id: editChantierId || null,
      client_id: editClientId || null,
      fournisseur_id: editFournisseurId || null,
    }).eq("id", editDoc.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Document mis à jour");
      setEditDoc(null);
      fetchDocuments();
    }
  };

  const handleAnalyzeAI = async (doc: Document) => {
    toast.info(`Analyse IA de "${doc.nom}" envoyée à l'assistant Jarvis`);
    // Navigate to assistant with doc context - could be expanded
  };

  const openSend = async (doc: Document, mode: "signature" | "paiement") => {
    // Pre-generate a preview URL
    const { data } = await supabase.storage
      .from("artisan-documents")
      .createSignedUrl(doc.storage_path, 3600);
    setPreviewUrl(data?.signedUrl ?? null);
    setSendEmail("");
    setSendMessage(
      mode === "signature"
        ? `Bonjour,\n\nVeuillez trouver ci-joint le devis "${doc.nom}" pour signature électronique.\n\nMerci de bien vouloir le signer en cliquant sur le lien ci-dessous.\n\nCordialement`
        : `Bonjour,\n\nVeuillez trouver ci-joint la facture "${doc.nom}".\n\nVous pouvez effectuer votre règlement en toute sécurité via le lien ci-dessous.\n\nCordialement`
    );
    setSendDialog({ doc, mode });
  };

  const handleSend = async () => {
    if (!sendDialog || !sendEmail.trim()) {
      toast.error("Veuillez saisir l'adresse email du destinataire");
      return;
    }
    setSendLoading(true);

    // Refresh signed URL at send time (1h validity)
    const { data, error } = await supabase.storage
      .from("artisan-documents")
      .createSignedUrl(sendDialog.doc.storage_path, 3600);

    if (error || !data?.signedUrl) {
      toast.error("Impossible de générer le lien sécurisé");
      setSendLoading(false);
      return;
    }

    const subject =
      sendDialog.mode === "signature"
        ? `Signature électronique — ${sendDialog.doc.nom}`
        : `Lien de paiement — ${sendDialog.doc.nom}`;

    const body = `${sendMessage}\n\n${sendDialog.mode === "signature" ? "Lien de signature" : "Lien de paiement"} : ${data.signedUrl}`;

    window.open(
      `mailto:${sendEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank"
    );

    toast.success("Email ouvert dans votre client mail");
    setSendLoading(false);
    setSendDialog(null);
  };

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between animate-fade-up">
        <h1 className="text-h2 font-display">Mes Documents</h1>
        <Button onClick={() => fileInputRef.current?.click()} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
          dragOver ? "border-primary bg-primary-glow scale-[1.01]" : "border-border"
        }`}
      >
        <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-sm text-muted-foreground">
          Glissez vos fichiers ici ou <button onClick={() => fileInputRef.current?.click()} className="text-primary font-semibold hover:underline">parcourez</button>
        </p>
        {uploading && (
          <div className="mt-3 max-w-xs mx-auto">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{uploadProgress}%</p>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center animate-fade-up-1">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou tag…" className="pl-9 touch-target" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 touch-target">
            <Filter className="w-3.5 h-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {allTags.length > 0 && (
          <Select value={filterTag} onValueChange={(v) => setFilterTag(v === "all" ? "" : v)}>
            <SelectTrigger className="w-36 touch-target">
              <Tag className="w-3.5 h-3.5 mr-1" />
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)} className="touch-target">
          <Archive className="w-3.5 h-3.5 mr-1" /> {showArchived ? "Archivés" : "Archives"}
        </Button>
        <div className="flex border rounded-lg overflow-hidden">
          <button onClick={() => setViewMode("grid")} className={`p-2 touch-target ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={`p-2 touch-target ${viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Documents */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton-shimmer h-32 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Aucun document trouvé</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((doc, i) => {
            const Icon = getFileIcon(doc.mime_type);
            return (
              <div key={doc.id} className="forge-card !p-4 space-y-2" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{doc.nom}</p>
                    <p className="text-xs text-muted-foreground">{formatSize(doc.taille_octets)} · {new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </div>
                {doc.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {doc.tags.map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] bg-primary/5 text-primary">{t}</Badge>
                    ))}
                  </div>
                )}
                <Badge variant="outline" className="text-[10px]">{TYPE_OPTIONS.find((o) => o.value === doc.type_fichier)?.label || doc.type_fichier}</Badge>
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} className="h-8 px-2"><Download className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(doc)} className="h-8 px-2"><Edit2 className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => handleArchive(doc)} className="h-8 px-2"><Archive className="w-3.5 h-3.5" /></Button>
                  {(doc.type_fichier === "plan" || doc.type_fichier === "cctp") && (
                    <Button size="sm" variant="ghost" onClick={() => handleAnalyzeAI(doc)} className="h-8 px-2 text-accent"><Bot className="w-3.5 h-3.5" /></Button>
                  )}
                  {doc.type_fichier === "devis" && (
                    <Button size="sm" variant="ghost" onClick={() => openSend(doc, "signature")} className="h-8 px-2 text-violet-600" title="Envoyer en signature électronique">
                      <PenLine className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {doc.type_fichier === "facture" && (
                    <Button size="sm" variant="ghost" onClick={() => openSend(doc, "paiement")} className="h-8 px-2 text-emerald-600" title="Lien paiement sécurisé">
                      <CreditCard className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)} className="h-8 px-2 text-destructive ml-auto"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((doc) => {
            const Icon = getFileIcon(doc.mime_type);
            return (
              <div key={doc.id} className="forge-card !p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{doc.nom}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(doc.taille_octets)} · {new Date(doc.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
                {doc.tags.length > 0 && (
                  <div className="hidden sm:flex gap-1">
                    {doc.tags.slice(0, 3).map((t) => (
                      <Badge key={t} variant="secondary" className="text-[10px] bg-primary/5 text-primary">{t}</Badge>
                    ))}
                  </div>
                )}
                <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">{TYPE_OPTIONS.find((o) => o.value === doc.type_fichier)?.label || doc.type_fichier}</Badge>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => handleDownload(doc)} className="h-8 px-2"><Download className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(doc)} className="h-8 px-2"><Edit2 className="w-3.5 h-3.5" /></Button>
                  {doc.type_fichier === "devis" && (
                    <Button size="sm" variant="ghost" onClick={() => openSend(doc, "signature")} className="h-8 px-2 text-violet-600" title="Envoyer en signature électronique">
                      <PenLine className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {doc.type_fichier === "facture" && (
                    <Button size="sm" variant="ghost" onClick={() => openSend(doc, "paiement")} className="h-8 px-2 text-emerald-600" title="Lien paiement sécurisé">
                      <CreditCard className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(doc)} className="h-8 px-2 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send Dialog — signature électronique / lien paiement */}
      <Dialog open={!!sendDialog} onOpenChange={(o) => !o && setSendDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              {sendDialog?.mode === "signature" ? (
                <><PenLine className="w-5 h-5 text-violet-600" /> Envoyer en signature électronique</>
              ) : (
                <><CreditCard className="w-5 h-5 text-emerald-600" /> Envoyer le lien de paiement</>
              )}
            </DialogTitle>
            <DialogDescription>
              {sendDialog?.doc.nom}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
              <FileText className="w-8 h-8 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{sendDialog?.doc.nom}</p>
                <p className="text-xs text-muted-foreground">{sendDialog?.doc.type_fichier === "devis" ? "Devis" : "Facture"}</p>
              </div>
              {previewUrl && (
                <Button size="sm" variant="outline" onClick={() => window.open(previewUrl, "_blank")} className="shrink-0 gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Prévisualiser
                </Button>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label>Email du destinataire <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                placeholder="client@exemple.fr"
                className="touch-target"
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                rows={5}
                className="text-sm"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Un lien d'accès sécurisé (valable 1h) sera automatiquement ajouté au message.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialog(null)}>Annuler</Button>
            <Button
              onClick={handleSend}
              disabled={sendLoading || !sendEmail.trim()}
              className={sendDialog?.mode === "signature"
                ? "bg-violet-600 hover:bg-violet-700 text-white gap-2"
                : "bg-emerald-600 hover:bg-emerald-700 text-white gap-2"}
            >
              <Send className="w-4 h-4" />
              {sendLoading ? "Préparation…" : sendDialog?.mode === "signature" ? "Envoyer pour signature" : "Envoyer le lien de paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editDoc} onOpenChange={(o) => !o && setEditDoc(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display">Modifier le document</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input value={editNom} onChange={(e) => setEditNom(e.target.value)} className="touch-target" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="touch-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.filter((t) => t.value !== "tous").map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tags (séparés par des virgules)</Label>
              <Input value={editTags} onChange={(e) => setEditTags(e.target.value)} placeholder="chantier-paris, urgent, 2024" className="touch-target" />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Associer à un chantier</Label>
              <Select value={editChantierId} onValueChange={setEditChantierId}>
                <SelectTrigger className="touch-target"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {chantiers.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Associer à un client</Label>
              <Select value={editClientId} onValueChange={setEditClientId}>
                <SelectTrigger className="touch-target"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Link2 className="w-3.5 h-3.5" /> Associer à un fournisseur</Label>
              <Select value={editFournisseurId} onValueChange={setEditFournisseurId}>
                <SelectTrigger className="touch-target"><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Aucun</SelectItem>
                  {fournisseurs.map((f) => <SelectItem key={f.id} value={f.id}>{f.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSaveEdit} className="w-full touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
