import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Building2, ShieldCheck, LogOut } from "lucide-react";
import KbisUploadSection from "@/components/kbis/KbisUploadSection";
import TrustBuildLogo from "@/components/TrustBuildLogo";
import { toast } from "sonner";

interface SiretData {
  siret: string;
  siren: string;
  raisonSociale: string;
  nomCommercial: string;
  adresse: string;
  codePostal: string;
  ville: string;
  pays: string;
  activite: string;
  formeJuridique: string;
  actif: boolean;
}

type SiretStatus = "idle" | "loading" | "valid" | "inactive" | "error";

export default function CompleteProfile() {
  const { user, profile, profileLoading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [siretInput, setSiretInput] = useState("");
  const [siretStatus, setSiretStatus] = useState<SiretStatus>("idle");
  const [siretError, setSiretError] = useState("");
  const [siretData, setSiretData] = useState<SiretData | null>(null);
  const [saving, setSaving] = useState(false);
  const [showKbisUpload, setShowKbisUpload] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!profileLoading && profile?.profile_completed) {
      navigate("/dashboard", { replace: true });
    }
  }, [profile, profileLoading, navigate]);

  // Pré-remplissage depuis user_metadata (nouveau flux) ou profile (legacy)
  useEffect(() => {
    if (siretData) return;
    const meta = user?.user_metadata;
    if (meta?.siret) {
      setSiretData({
        siret: meta.siret,
        siren: String(meta.siret).slice(0, 9),
        raisonSociale: meta.raison_sociale ?? "",
        nomCommercial: meta.nom_commercial ?? "",
        adresse: meta.adresse ?? "",
        codePostal: meta.code_postal ?? "",
        ville: meta.ville ?? "",
        pays: meta.pays ?? "France",
        activite: meta.activite ?? "",
        formeJuridique: meta.forme_juridique ?? "",
        actif: true,
      });
      setSiretStatus("valid");
    } else if (profile?.siret) {
      setSiretData({
        siret: profile.siret,
        siren: profile.siret.slice(0, 9),
        raisonSociale: profile.raison_sociale ?? "",
        nomCommercial: profile.nom_commercial ?? "",
        adresse: profile.adresse ?? "",
        codePostal: profile.code_postal ?? "",
        ville: profile.ville ?? "",
        pays: profile.pays ?? "France",
        activite: profile.activite ?? "",
        formeJuridique: profile.forme_juridique ?? "",
        actif: true,
      });
      setSiretStatus("valid");
    }
  }, [user, profile]);

  const isPreFilled = !!(user?.user_metadata?.siret || profile?.siret);

  const formatSiret = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,5})/, (_m, a, b, c, d) =>
      [a, b, c, d].filter(Boolean).join(" ")
    );
  };

  const handleSiretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatSiret(e.target.value);
    setSiretInput(formatted);
    setSiretStatus("idle");
    setSiretError("");
    setSiretData(null);
  };

  const validateSiret = async () => {
    const siretClean = siretInput.replace(/\s/g, "");
    if (siretClean.length !== 14) {
      setSiretError("Le SIRET doit contenir 14 chiffres");
      return;
    }
    setSiretStatus("loading");
    setSiretError("");
    setSiretData(null);
    try {
      const { data, error } = await supabase.functions.invoke("validate-siret", {
        body: { siret: siretClean },
      });
      if (error) {
        let errMsg = "Impossible de vérifier le SIRET";
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) errMsg = body.error;
        } catch {}
        throw new Error(errMsg);
      }
      if (data?.error) throw new Error(data.error);
      if (!data.actif) {
        setSiretStatus("inactive");
        setSiretError("Cet établissement est fermé (état administratif inactif dans la base INSEE)");
        return;
      }
      setSiretData(data as SiretData);
      setSiretStatus("valid");
    } catch (err: any) {
      setSiretStatus("error");
      setSiretError(err.message || "Impossible de vérifier le SIRET");
    }
  };

  const handleSubmit = async () => {
    if (!siretData || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          siret: siretData.siret,
          raison_sociale: siretData.raisonSociale,
          nom_commercial: siretData.nomCommercial,
          adresse: siretData.adresse,
          code_postal: siretData.codePostal,
          ville: siretData.ville,
          pays: siretData.pays,
          activite: siretData.activite,
          forme_juridique: siretData.formeJuridique,
          profile_completed: true,
        })
        .eq("user_id", user.id);

      if (error) {
        if ((error as any)?.code === "23505") {
          const msg = "Ce SIRET est déjà associé à un compte TrustBuild-IA";
          toast.error(msg);
          setSiretStatus("error");
          setSiretError(msg);
          setSubmitError(msg);
          return;
        }
        throw error;
      }

      await refreshProfile();
      toast.success("Profil complété — bienvenue sur TrustBuild-IA !");
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg = err.message || "Erreur lors de la sauvegarde";
      toast.error(msg);
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const prenom = user?.user_metadata?.prenom ?? profile?.prenom ?? "";
  const nom = user?.user_metadata?.nom ?? profile?.nom ?? "";
  const email = user?.email ?? "";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg forge-card animate-fade-up space-y-6">
        <div className="text-center">
          <TrustBuildLogo size={56} className="mx-auto mb-4 block" />
          <h1 className="text-h2 font-display">Complétez votre profil</h1>
          <p className="text-small text-muted-foreground mt-1">
            Dernière étape — informations de votre entreprise
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Informations personnelles
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Prénom</Label>
              <Input value={prenom} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nom</Label>
              <Input value={nom} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Adresse email</Label>
            <Input value={email} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed" />
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Votre entreprise
          </p>

          {!isPreFilled && (
            <div className="space-y-2">
              <Label htmlFor="siret">
                Numéro SIRET <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="siret"
                  value={siretInput}
                  onChange={handleSiretChange}
                  placeholder="123 456 789 00012"
                  className="touch-target font-mono"
                  maxLength={17}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") validateSiret();
                  }}
                />
                <Button
                  onClick={validateSiret}
                  disabled={siretInput.replace(/\s/g, "").length !== 14 || siretStatus === "loading"}
                  variant="outline"
                  className="shrink-0"
                >
                  {siretStatus === "loading" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Vérifier"
                  )}
                </Button>
              </div>
              {siretStatus === "valid" && siretData && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Établissement actif — <strong>{siretData.raisonSociale}</strong></span>
                </div>
              )}
              {(siretStatus === "error" || siretStatus === "inactive") && (
                <div className="flex items-start gap-2 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{siretError}</span>
                </div>
              )}
            </div>
          )}

          {siretData && siretStatus === "valid" && (
            <div className="space-y-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                Informations récupérées via INSEE Sirene
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Raison sociale</Label>
                  <Input value={siretData.raisonSociale} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed text-sm" />
                </div>
                {siretData.nomCommercial && siretData.nomCommercial !== siretData.raisonSociale && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nom commercial</Label>
                    <Input value={siretData.nomCommercial} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed text-sm" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Adresse</Label>
                  <Input value={siretData.adresse} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Code postal</Label>
                    <Input value={siretData.codePostal} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Ville</Label>
                    <Input value={siretData.ville} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed text-sm" />
                  </div>
                </div>
                {siretData.activite && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Code APE / activité principale</Label>
                    <Input value={siretData.activite} disabled className="bg-muted/40 text-muted-foreground cursor-not-allowed text-sm" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {siretStatus === "valid" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Extrait KBIS <span className="normal-case font-normal">(facultatif — vous avez 6 mois)</span>
              </p>
              {!showKbisUpload && (
                <button
                  onClick={() => setShowKbisUpload(true)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Déposer maintenant
                </button>
              )}
            </div>
            {showKbisUpload ? (
              <KbisUploadSection />
            ) : (
              <p className="text-xs text-muted-foreground">
                Vous pouvez déposer votre KBIS dès maintenant ou le faire plus tard depuis "Mes Fichiers".
              </p>
            )}
          </div>
        )}

        {submitError && (
          <div className="flex items-start gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}
        <Button
          onClick={handleSubmit}
          disabled={siretStatus !== "valid" || saving}
          className="w-full touch-target text-base bg-gradient-to-r from-primary to-primary/90 shadow-forge hover:shadow-forge-hover transition-all"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Enregistrement…</>
          ) : (
            <>Accéder à mon espace <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Données récupérées depuis la base officielle{" "}
          <span className="font-medium">INSEE Sirene</span>
        </p>

        <div className="text-center pt-2 border-t border-muted">
          <button
            onClick={async () => { await signOut(); navigate("/auth", { replace: true }); }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Annuler l'inscription et se connecter avec un autre compte
          </button>
        </div>
      </div>
    </div>
  );
}
