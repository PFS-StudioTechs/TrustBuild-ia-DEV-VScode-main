import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import TrustBuildLogo from "@/components/TrustBuildLogo";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      // First check if there's already a session (link was processed)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setReady(true);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });

    // Check URL for recovery indicators
    const hash = window.location.hash;
    const search = window.location.search;
    if (hash.includes("type=recovery") || search.includes("type=recovery")) {
      setReady(true);
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Mot de passe mis à jour avec succès !");
      navigate("/auth");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réinitialisation");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md forge-card animate-fade-up text-center">
          <TrustBuildLogo size={64} className="mx-auto mb-4 block" />
          <h1 className="text-h2 font-display mb-2">Réinitialisation</h1>
          <p className="text-muted-foreground">Chargement en cours…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md forge-card animate-fade-up">
        <div className="text-center mb-6">
          <TrustBuildLogo size={64} className="mx-auto mb-4 block" />
          <h1 className="text-h2 font-display">Nouveau mot de passe</h1>
          <p className="text-small text-muted-foreground mt-1">Choisissez un nouveau mot de passe sécurisé</p>
        </div>
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 6 caractères"
                className="touch-target pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
            <Input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Retapez le mot de passe"
              className="touch-target"
            />
          </div>
          <Button type="submit" disabled={!password || !confirmPassword || loading} className="w-full touch-target text-base bg-gradient-to-r from-primary to-primary/90 shadow-forge hover:shadow-forge-hover transition-all">
            {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
          </Button>
        </form>
      </div>
    </div>
  );
}
