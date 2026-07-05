import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileCheck2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export type LegalDocType = "decennale" | "urssaf";

interface LegalDocUploadSectionProps {
  type: LegalDocType;
  onSuccess?: () => void;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

export default function LegalDocUploadSection({ type, onSuccess }: LegalDocUploadSectionProps) {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo)");
      return;
    }
    setFile(f);
    setStatus("idle");
    setErrorMsg("");
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setStatus("uploading");
    setErrorMsg("");

    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${user.id}/legal/${type}.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from("artisan-documents")
        .upload(path, file, { upsert: true });
      if (storageErr) throw storageErr;

      const { error: dbErr } = await (supabase as any)
        .from("artisan_documents_legaux")
        .upsert(
          {
            artisan_id: user.id,
            type,
            storage_path: path,
            nom_fichier: file.name,
            uploaded_at: new Date().toISOString(),
          },
          { onConflict: "artisan_id,type" }
        );
      if (dbErr) throw dbErr;

      setStatus("success");
      toast.success("Document enregistré");
      onSuccess?.();
    } catch (err: any) {
      setStatus("error");
      const msg = err.message || "Erreur lors du traitement";
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-3">
      <label className="relative block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          onChange={handleFile}
        />
        {file ? (
          <div className="flex flex-col items-center gap-1">
            <FileCheck2 className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} Ko</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <Upload className="w-8 h-8" />
            <p className="text-sm">Cliquez pour sélectionner le document</p>
            <p className="text-xs">PDF, JPG ou PNG — max 10 Mo</p>
          </div>
        )}
      </label>

      {status === "error" && errorMsg && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <Button onClick={handleUpload} disabled={!file || status === "uploading"} variant="outline" className="w-full">
        {status === "uploading" ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi en cours…</>
        ) : (
          <><Upload className="w-4 h-4 mr-2" />Déposer le document</>
        )}
      </Button>
    </div>
  );
}
