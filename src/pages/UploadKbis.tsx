import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertCircle, Upload, FileCheck2, Loader2, LogOut } from "lucide-react";
import logoImg from "@/assets/Logo_TrustBuild.png";
import { toast } from "sonner";

export default function UploadKbis() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const deadline = profile?.kbis_deadline ? new Date(profile.kbis_deadline) : null;
  const isBlocked = deadline && new Date() > deadline && !profile?.kbis_url;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo)");
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/kbis/kbis.${ext}`;

      const { error: storageErr } = await supabase.storage
        .from("artisan-documents")
        .upload(path, file, { upsert: true });
      if (storageErr) throw storageErr;

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
      toast.success("KBIS enregistré — votre compte est débloqué !");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg forge-card animate-fade-up space-y-6">
        {/* Header */}
        <div className="text-center">
          <img src={logoImg} alt="TrustBuild-IA" className="mx-auto w-14 h-14 rounded-2xl object-contain mb-4" />
          <h1 className="text-h2 font-display">Dépôt de votre KBIS</h1>
          {isBlocked ? (
            <div className="mt-3 flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Votre délai de 6 mois est dépassé. Votre accès est restreint jusqu'au dépôt de votre KBIS.
              </span>
            </div>
          ) : (
            <p className="text-small text-muted-foreground mt-1">
              Déposez votre KBIS pour finaliser la vérification de votre entreprise.
              {deadline && (
                <span className="block mt-1 font-medium text-amber-600 dark:text-amber-400">
                  Délai : {deadline.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Zone de dépôt */}
        <label
          className="relative block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={handleFile}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileCheck2 className="w-10 h-10 text-emerald-500" />
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} Ko</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Upload className="w-10 h-10" />
              <p className="text-sm">Cliquez pour sélectionner votre KBIS</p>
              <p className="text-xs">PDF, JPG ou PNG — max 10 Mo</p>
            </div>
          )}
        </label>

        <Button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="w-full touch-target text-base bg-gradient-to-r from-primary to-primary/90 shadow-forge"
        >
          {uploading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi en cours…</>
          ) : (
            <><Upload className="w-4 h-4 mr-2" />Déposer mon KBIS</>
          )}
        </Button>

        <button
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
