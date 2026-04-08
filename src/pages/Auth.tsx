import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";
import logoImg from "@/assets/Logo_TrustBuild.png";
import { toast } from "sonner";
import MfaChallenge from "@/components/security/MfaChallenge";

export default function Auth() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [siret, setSiret] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      // Check if MFA is required
      const { data: { totp } } = await supabase.auth.mfa.listFactors();
      const verifiedFactors = totp?.filter((f) => f.status === "verified") || [];
      if (verifiedFactors.length > 0) {
        // MFA is enabled, need to verify
        setMfaFactorId(verifiedFactors[0].id);
      } else {
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSuccess = () => {
    setMfaFactorId(null);
    navigate("/dashboard");
  };

  const handleMfaCancel = async () => {
    await supabase.auth.signOut();
    setMfaFactorId(null);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      await signUp(email, password, { nom, prenom, siret });
      toast.success("Compte créé ! Vérifiez votre email pour confirmer.");
      setMode("login");
      setStep(1);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'inscription");
    } finally {
      setLoading(false);
    }
  };

  // Show MFA challenge screen
  if (mfaFactorId) {
    return <MfaChallenge factorId={mfaFactorId} onSuccess={handleMfaSuccess} onCancel={handleMfaCancel} />;
  }

  if (mode === "register") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md forge-card animate-fade-up">
          <div className="text-center mb-6">
            <img src={logoImg} alt="Trust Build-IA" className="mx-auto w-16 h-16 rounded-2xl object-contain mb-4" />
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
                <Button onClick={() => setStep(2)} disabled={!nom || !prenom} className="w-full touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge hover:shadow-forge-hover transition-all">
                  Suivant <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="r-siret">Numéro SIRET</Label>
                  <Input id="r-siret" value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="123 456 789 00012" className="touch-target" />
                  <p className="text-small text-muted-foreground">14 chiffres — optionnel pour commencer</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(1)} className="touch-target"><ArrowLeft className="w-4 h-4" /></Button>
                  <Button onClick={() => setStep(3)} className="flex-1 touch-target bg-gradient-to-r from-primary to-primary/90">
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
                    <Input id="r-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 caractères" className="touch-target pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep(2)} className="touch-target"><ArrowLeft className="w-4 h-4" /></Button>
                  <Button onClick={handleRegister} disabled={!email || !password || loading} className="flex-1 touch-target bg-cta text-primary-foreground font-bold btn-cta-pulse">
                    {loading ? "Création…" : "Créer mon compte"}
                  </Button>
                </div>
              </>
            )}
            <p className="text-center text-small text-muted-foreground">
              Déjà un compte ?{" "}
              <button onClick={() => { setMode("login"); setStep(1); }} className="text-primary font-semibold hover:underline">Se connecter</button>
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
          <img src={logoImg} alt="Trust Build-IA" className="mx-auto w-16 h-16 rounded-2xl object-contain mb-4" />
          <h1 className="text-h2 font-display">Trust Build-IA</h1>
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
              <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="touch-target pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={!email || !password || loading} className="w-full touch-target text-base bg-gradient-to-r from-primary to-primary/90 shadow-forge hover:shadow-forge-hover transition-all">
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
          <button onClick={() => setMode("register")} className="text-primary font-semibold hover:underline">S'inscrire</button>
        </p>
      </div>
    </div>
  );
}
