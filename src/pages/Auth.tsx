import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Eye, EyeOff, Mail, Loader2, CheckCircle2, AlertCircle, Building2 } from "lucide-react";
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

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  const [siretInput, setSiretInput] = useState("");
  const [siretStatus, setSiretStatus] = useState<SiretStatus>("idle");
  const [siretError, setSiretError] = useState("");
  const [siretData, setSiretData] = useState<SiretData | null>(null);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!siretData) return;
    setLoading(true);
    try {
      await signUp(email, password, {
        nom,
        prenom,
        siret: siretData.siret,
        raison_sociale: siretData.raisonSociale,
        nom_commercial: siretData.nomCommercial,
        adresse: siretData.adresse,
        code_postal: siretData.codePostal,
        ville: siretData.ville,
        pays: siretData.pays,
        activite: siretData.activite,
        forme_juridique: siretData.formeJuridique,
      });
      setMode("login");
      setStep(1);
      setAwaitingEmail(true);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  const formatSiret = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{0,5})/, (_m, a, b, c, d) =>
      [a, b, c, d].filter(Boolean).join(" ")
    );
  };

  const handleSiretChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSiretInput(formatSiret(e.target.value));
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

  const resetRegister = () => {
    setMode("login");
    setStep(1);
    setSiretInput("");
    setSiretStatus("idle");
    setSiretError("");
    setSiretData(null);
  };

  if (awaitingEmail) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md forge-card animate-fade-up text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div>
            <h2 className="text-h2 font-display mb-2">Vérifiez votre email</h2>
            <p className="text-muted-foreground text-small">
              Un lien de confirmation a été envoyé à <span className="font-semibold text-foreground">{email}</span>.
              Cliquez sur le lien pour accéder à votre espace.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Vous n'avez pas reçu l'email ?{" "}
            <button
              onClick={() => setAwaitingEmail(false)}
              className="text-primary font-semibold hover:underline"
            >
              Réessayer
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            Déjà un compte ?{" "}
            <button
              onClick={() => setAwaitingEmail(false)}
              className="text-primary font-semibold hover:underline"
            >
              Se connecter
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (mode === "register") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md forge-card animate-fade-up">
          <div className="text-center mb-6">
            <TrustBuildLogo size={64} className="mx-auto mb-4 block" />
            <h1 className="text-h2 font-display">Créer un compte</h1>
            <p className="text-small text-muted-foreground mt-1">Étape {step} sur 3</p>
            <div className="flex gap-1.5 justify-center mt-3">
              {[1, 2, 3].map((s) => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${s <= step ? "w-10 bg-primary" : "w-6 bg-muted"}`} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="r-prenom">Prénom</Label>
                  <Input id="r-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} placeholder="Jean" className="touch-target" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-nom">Nom</Label>
                  <Input id="r-nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Dupont" className="touch-target" />
                </div>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!nom || !prenom}
                  className="w-full touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge hover:shadow-forge-hover transition-all"
                >
                  Suivant <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="r-siret">
                    Numéro SIRET <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="r-siret"
                      value={siretInput}
                      onChange={handleSiretChange}
                      placeholder="123 456 789 00012"
                      className="touch-target font-mono"
                      maxLength={17}
                      onKeyDown={(e) => { if (e.key === "Enter") validateSiret(); }}
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

                {siretData && siretStatus === "valid" && (
                  <div className="space-y-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      <Building2 className="w-3.5 h-3.5" />
                      Informations INSEE Sirene
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {siretData.raisonSociale} — {siretData.adresse}, {siretData.codePostal} {siretData.ville}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="touch-target">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={siretStatus !== "valid"}
                    className="flex-1 touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge hover:shadow-forge-hover transition-all"
                  >
                    Suivant <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="r-email">Email professionnel</Label>
                  <Input id="r-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@entreprise.fr" className="touch-target" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="r-password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="r-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 6 caractères"
                      autoComplete="new-password"
                      className="touch-target pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="touch-target">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={handleRegister}
                    disabled={!email || !password || loading}
                    className="flex-1 touch-target bg-cta text-primary-foreground font-bold btn-cta-pulse"
                  >
                    {loading ? "Création…" : "Créer mon compte"}
                  </Button>
                </div>
              </>
            )}

            <p className="text-center text-small text-muted-foreground">
              Déjà un compte ?{" "}
              <button onClick={resetRegister} className="text-primary font-semibold hover:underline">
                Se connecter
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md forge-card animate-fade-up">
        <div className="text-center mb-6">
          <TrustBuildLogo size={64} className="mx-auto mb-4 block" />
          <h1 className="text-h2 font-display font-bold tracking-tight">
            <span className="text-foreground">TrustBuild</span><span className="text-primary font-normal italic">-ia</span>
          </h1>
          <p className="text-small text-muted-foreground mt-1">Connectez-vous à votre espace artisan</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jean@entreprise.fr" className="touch-target" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="touch-target pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={!email || !password || loading}
            className="w-full touch-target text-base bg-gradient-to-r from-primary to-primary/90 shadow-forge hover:shadow-forge-hover transition-all"
          >
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
          <div className="text-right">
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  toast.error("Veuillez d'abord saisir votre email");
                  return;
                }
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) throw error;
                  toast.success("Un lien de réinitialisation a été envoyé à votre email");
                } catch (err: any) {
                  toast.error(err.message || "Erreur lors de l'envoi");
                }
              }}
              className="text-small text-primary font-semibold hover:underline"
            >
              Mot de passe oublié ?
            </button>
          </div>
        </form>
        <p className="text-center text-small text-muted-foreground mt-4">
          Pas encore de compte ?{" "}
          <button onClick={() => setMode("register")} className="text-primary font-semibold hover:underline">
            S'inscrire
          </button>
        </p>
      </div>
    </div>
  );
}
