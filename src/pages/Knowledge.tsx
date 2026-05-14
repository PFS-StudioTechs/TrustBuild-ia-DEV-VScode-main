import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Trash2,
  FileText,
  FileSpreadsheet,
  File,
  Brain,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  Link,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

interface KnowledgeDocument {
  id: string;
  nom: string;
  type_fichier: string;
  statut: "en_cours" | "indexe" | "erreur";
  storage_path: string | null;
  created_at: string;
  is_global?: boolean;
  metadata?: { error?: string } | null;
}

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "application/msword": "docx",
  "application/vnd.ms-excel": "xlsx",
};

function getFileType(file: File): string | null {
  const byMime = ACCEPTED_TYPES[file.type];
  if (byMime) return byMime;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && ["pdf", "docx", "xlsx", "txt"].includes(ext)) return ext;
  return null;
}

function FileIcon({ type }: { type: string }) {
  if (type === "pdf") return <FileText className="w-5 h-5 text-red-500" />;
  if (type === "xlsx") return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
  if (type === "docx") return <FileText className="w-5 h-5 text-blue-500" />;
  if (type === "url") return <Globe className="w-5 h-5 text-violet-500" />;
  return <File className="w-5 h-5 text-muted-foreground" />;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m${rem}s` : `${m}m`;
}

function StatutBadge({ statut, createdAt, now }: { statut: KnowledgeDocument["statut"]; createdAt?: string; now: number }) {
  if (statut === "indexe")
    return (
      <Badge variant="outline" className="gap-1 border-green-500/40 text-green-600 bg-green-500/5">
        <CheckCircle2 className="w-3 h-3" /> Indexé
      </Badge>
    );
  if (statut === "erreur")
    return (
      <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive bg-destructive/5">
        <AlertCircle className="w-3 h-3" /> Erreur
      </Badge>
    );
  // En cours : affiche le temps écoulé
  const elapsed = createdAt ? now - new Date(createdAt).getTime() : 0;
  const isStuck = elapsed > 3 * 60 * 1000; // > 3 minutes
  return (
    <Badge
      variant="outline"
      className={`gap-1 ${isStuck ? "border-amber-500/40 text-amber-600 bg-amber-500/5" : "border-primary/40 text-primary bg-primary/5"}`}
      title={isStuck ? "L'indexation semble bloquée — essayez de relancer" : "Indexation en cours"}
    >
      <Loader2 className="w-3 h-3 animate-spin" />
      {isStuck ? `Bloqué ? ${formatElapsed(elapsed)}` : `En cours… ${createdAt ? formatElapsed(elapsed) : ""}`}
    </Badge>
  );
}

export default function Knowledge() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [indexingUrl, setIndexingUrl] = useState(false);
  const [now, setNow] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tick toutes les 5s pour mettre à jour les temps écoulés
  useEffect(() => {
    const hasOngoing = documents.some((d) => d.statut === "en_cours");
    if (!hasOngoing) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [documents]);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("knowledge_documents")
      .select("*")
      .eq("artisan_id", user.id)
      .order("created_at", { ascending: false });
    if (error) console.error(error);
    setDocuments((data as KnowledgeDocument[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Souscription realtime pour mettre à jour les statuts sans refresh
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("knowledge_docs")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "knowledge_documents",
          filter: `artisan_id=eq.${user.id}`,
        },
        (payload) => {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === payload.new.id
                ? { ...d, ...(payload.new as KnowledgeDocument) }
                : d
            )
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const triggerIndexing = async (documentId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/index-document`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ document_id: documentId }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        const errMsg = data.error || `Erreur HTTP ${resp.status}`;
        await supabase.from("knowledge_documents")
          .update({ statut: "erreur", metadata: { error: errMsg } })
          .eq("id", documentId);
      }
    } catch (e: any) {
      console.error("Erreur déclenchement indexation:", e);
      await supabase.from("knowledge_documents")
        .update({ statut: "erreur", metadata: { error: e.message || "Erreur réseau lors de l'indexation" } })
        .eq("id", documentId);
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    let done = 0;

    for (const file of fileArray) {
      const fileType = getFileType(file);
      if (!fileType) {
        toast.error(`Format non supporté : ${file.name}. Utilisez PDF, Word, Excel ou TXT.`);
        continue;
      }

      const safeName = file.name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // supprime accents
        .replace(/[^a-zA-Z0-9._-]/g, "_");               // remplace espaces/apostrophes/etc.
      const storagePath = `${user.id}/${Date.now()}-${safeName}`;

      // Upload dans le bucket knowledge-documents
      const { error: uploadError } = await supabase.storage
        .from("knowledge-documents")
        .upload(storagePath, file);

      if (uploadError) {
        toast.error(`Erreur upload "${file.name}": ${uploadError.message}`);
        continue;
      }

      // Crée l'entrée en BDD
      const { data: doc, error: dbError } = await supabase
        .from("knowledge_documents")
        .insert({
          artisan_id: user.id,
          nom: file.name,
          type_fichier: fileType,
          statut: "en_cours",
          storage_path: storagePath,
        })
        .select()
        .single();

      if (dbError) {
        toast.error(`Erreur base de données "${file.name}": ${dbError.message}`);
        continue;
      }

      done++;
      setUploadProgress(Math.round((done / fileArray.length) * 100));

      // Ajoute optimistiquement en liste
      setDocuments((prev) => [doc as KnowledgeDocument, ...prev]);

      // Lance l'indexation en arrière-plan (non bloquant)
      triggerIndexing(doc.id);
    }

    toast.success(`${done} fichier(s) uploadé(s) — indexation en cours…`);
    setUploading(false);
    setUploadProgress(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  };

  const handleDelete = async (doc: KnowledgeDocument) => {
    if (!confirm(`Supprimer "${doc.nom}" et tous ses chunks ?`)) return;

    // Supprime les chunks (cascade SQL aussi, mais on le fait explicitement)
    await supabase.from("knowledge_chunks").delete().eq("document_id", doc.id);

    // Supprime le fichier du storage si présent
    if (doc.storage_path) {
      await supabase.storage
        .from("knowledge-documents")
        .remove([doc.storage_path]);
    }

    // Supprime le document
    const { error } = await supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", doc.id);

    if (error) {
      toast.error("Erreur lors de la suppression");
      return;
    }

    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    toast.success("Document supprimé de la base de connaissances");
  };

  const handleIndexUrl = async () => {
    if (!urlInput.trim() || !user) return;
    setIndexingUrl(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${supabaseUrl}/functions/v1/index-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erreur lors de l'indexation");
      setDocuments((prev) => [data.document as KnowledgeDocument, ...prev]);
      setUrlInput("");
      toast.success("URL ajoutée — indexation en cours…");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de l'indexation de l'URL");
    } finally {
      setIndexingUrl(false);
    }
  };

  const handleReindex = async (doc: KnowledgeDocument) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, statut: "en_cours" } : d))
    );
    await supabase
      .from("knowledge_documents")
      .update({ statut: "en_cours" })
      .eq("id", doc.id);
    await triggerIndexing(doc.id);
    toast.info(`Re-indexation de "${doc.nom}" lancée…`);
  };

  const handleToggleGlobal = async (doc: KnowledgeDocument) => {
    const newVal = !doc.is_global;
    const { error } = await (supabase as any)
      .from("knowledge_documents")
      .update({ is_global: newVal })
      .eq("id", doc.id);
    if (error) { toast.error("Erreur lors de la mise à jour"); return; }
    await (supabase as any)
      .from("knowledge_chunks")
      .update({ is_global: newVal })
      .eq("document_id", doc.id);
    setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_global: newVal } : d));
    toast.success(newVal ? "Référentiel partagé avec tous les artisans" : "Document rendu privé");
  };

  const indexed = documents.filter((d) => d.statut === "indexe").length;
  const total = documents.length;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-h2 font-display">Base de connaissances</h1>
        </div>
        <p className="text-sm text-muted-foreground pl-12">
          Importez vos documents métier — Jarvis les utilisera pour répondre avec précision.
        </p>
      </div>

      {/* Stats */}
      {total > 0 && (
        <div className="forge-card !p-4 flex items-center gap-4 animate-fade-up-1">
          <BookOpen className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {indexed} / {total} document{total > 1 ? "s" : ""} indexé{indexed > 1 ? "s" : ""}
            </p>
            <Progress value={total > 0 ? (indexed / total) * 100 : 0} className="h-1.5 mt-1.5" />
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all animate-fade-up-1 ${
          dragOver
            ? "border-primary bg-primary-glow scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/30"
        }`}
      >
        <Upload
          className={`w-8 h-8 mx-auto mb-3 transition-colors ${
            dragOver ? "text-primary" : "text-muted-foreground"
          }`}
        />
        <p className="text-sm font-medium text-foreground">
          Glissez vos fichiers ici ou{" "}
          <span className="text-primary">parcourez</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          PDF, Word (.docx), Excel (.xlsx), Texte (.txt)
        </p>

        {uploading && (
          <div className="mt-4 max-w-xs mx-auto">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all rounded-full"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Upload {uploadProgress}%
            </p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
        className="sr-only"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* Section URL */}
      <div className="forge-card !p-4 space-y-3 animate-fade-up-1">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-medium">Indexer une page web</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Collez l'URL d'une page (documentation, catalogue, article technique) — Jarvis en extraira le contenu.
          Les pages d'accueil de grands sites (Leroy Merlin, Amazon…) sont souvent protégées anti-bot : préférez une <strong>page produit ou catalogue spécifique</strong>.
        </p>
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleIndexUrl()}
            placeholder="https://www.leroymerlin.fr/catalogue/plomberie/"
            className="flex-1 text-sm"
            disabled={indexingUrl}
          />
          <Button
            onClick={handleIndexUrl}
            disabled={!urlInput.trim() || indexingUrl}
            className="shrink-0"
            size="sm"
          >
            {indexingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : "Indexer"}
          </Button>
        </div>
      </div>

      {/* Liste des documents */}
      <div className="space-y-2">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer h-16 rounded-xl" />
          ))
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <Brain className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-40" />
            <p className="text-muted-foreground text-sm">
              Aucun document dans la base de connaissances
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              Importez vos DTU, catalogues, contrats types…
            </p>
          </div>
        ) : (
          documents.map((doc, i) => (
            <div
              key={doc.id}
              className="forge-card !p-4 flex items-center gap-3"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FileIcon type={doc.type_fichier} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.nom}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.type_fichier === "url" ? (
                    <span className="text-violet-500">{doc.storage_path}</span>
                  ) : (
                    <>
                      {new Date(doc.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      <span className="uppercase">{doc.type_fichier}</span>
                    </>
                  )}
                </p>
                {doc.statut === "erreur" && doc.metadata?.error && (
                  <p className="text-[11px] text-destructive mt-0.5 line-clamp-2" title={doc.metadata.error}>
                    {doc.metadata.error}
                  </p>
                )}
              </div>

              <StatutBadge statut={doc.statut} createdAt={doc.created_at} now={now} />

              <div className="flex gap-1 shrink-0">
                {(doc.statut === "erreur" || (doc.statut === "en_cours" && now - new Date(doc.created_at).getTime() > 3 * 60 * 1000)) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReindex(doc)}
                    className="h-8 px-2 text-amber-600"
                    title="Réessayer l'indexation"
                  >
                    <Loader2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleGlobal(doc)}
                    className={`h-8 px-2 ${doc.is_global ? "text-violet-600" : "text-muted-foreground"}`}
                    title={doc.is_global ? "Partagé avec tous les artisans — cliquer pour rendre privé" : "Rendre accessible à tous les artisans"}
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(doc)}
                  className="h-8 px-2 text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
