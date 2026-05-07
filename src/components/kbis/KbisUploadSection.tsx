import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, FileCheck2, Loader2, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface KbisUploadSectionProps {
  onSuccess?: () => void;
  forceUpload?: boolean;
}

type UploadStatus = "idle" | "uploading" | "verifying" | "success" | "error";

export default function KbisUploadSection({ onSuccess, forceUpload = false }: KbisUploadSectionProps) {
  const { user, profile, refreshProfile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [verifiedSiret, setVerifiedSiret] = useState<string | null>(null);
  const [isReplacing, setIsReplacing] = useState(forceUpload);

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

  const handleUploadAndVerify = async () => {
    if (!file || !user) return;
    setStatus("uploading");
    setErrorMsg("");

    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${user.id}/kbis/kbis.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from("artisan-documents")
        .upload(path, file, { upsert: true });
      if (storageErr) throw storageErr;

      setStatus("verifying");

      const { data: verifyResult, error: verifyErr } = await supabase.functions.invoke("verify-kbis", {
        body: { storage_path: path, mime_type: file.type || "application/pdf" },
      });

      if (verifyErr) throw new Error("Erreur lors de la vérification IA");

      if (!verifyResult?.is_kbis) {
        await supabase.storage.from("artisan-documents").remove([path]);
        setStatus("error");
        setErrorMsg(
          `Ce fichier ne semble pas être un extrait KBIS. ${verifyResult?.reason ?? ""}`
        );
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }

      const { data: urlData } = supabase.storage
        .from("artisan-documents")
        .getPublicUrl(path);

      const { error: dbErr } = await supabase
        .from("profiles")
        .update({
          kbis_url: urlData.publicUrl,
          kbis_uploaded_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (dbErr) throw dbErr;

      await refreshProfile();
      setVerifiedSiret(verifyResult.siret_found ?? null);
      setStatus("success");
      toast.success("KBIS vérifié et enregistré !");
      onSuccess?.();
    } catch (err: any) {
      setStatus("error");
      const msg = err.message || "Erreur lors du traitement";
      setErrorMsg(msg);
      toast.error(msg);
    }
  };

  // Affichage si déjà un KBIS en base ou si vient d'être vérifié avec succès
  if (!isReplacing && (status === "success" || (profile?.kbis_url && status === "idle"))) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">KBIS vérifié par l'IA</p>
          {verifiedSiret && (
            <p className="text-xs text-muted-foreground">SIRET détecté : {verifiedSiret}</p>
          )}
          {profile?.kbis_uploaded_at && status === "idle" && (
            <p className="text-xs text-muted-foreground">
              Déposé le {new Date(profile.kbis_uploaded_at).toLocaleDateString("fr-FR")}
            </p>
          )}
        </div>
        <button
          onClick={() => setIsReplacing(true)}
          className="text-xs text-muted-foreground hover:text-foreground underline shrink-0"
        >
          Remplacer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label
        className="relative block border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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
            <p className="text-sm">Cliquez pour sélectionner votre KBIS</p>
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

      <Button
        onClick={handleUploadAndVerify}
        disabled={!file || status === "uploading" || status === "verifying"}
        variant="outline"
        className="w-full"
      >
        {status === "uploading" ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi en cours…</>
        ) : status === "verifying" ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Vérification IA en cours…</>
        ) : (
          <><ShieldCheck className="w-4 h-4 mr-2" />Déposer et vérifier par l'IA</>
        )}
      </Button>
    </div>
  );
}
