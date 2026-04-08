import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HardHat, Shield } from "lucide-react";
import { toast } from "sonner";

interface MfaChallengeProps {
  factorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function MfaChallenge({ factorId, onSuccess, onCancel }: MfaChallengeProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });
      if (verify.error) throw verify.error;
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Code invalide");
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md forge-card animate-fade-up">
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4 shadow-forge">
            <HardHat className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-h2 font-display">Vérification 2FA</h1>
          <p className="text-small text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <Shield className="w-3.5 h-3.5" /> Entrez le code de votre application d'authentification
          </p>
        </div>
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <Label>Code à 6 chiffres</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="touch-target font-mono text-center text-2xl tracking-[0.3em]"
              maxLength={6}
              autoFocus
            />
          </div>
          <Button
            type="submit"
            disabled={code.length !== 6 || loading}
            className="w-full touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge"
          >
            {loading ? "Vérification…" : "Vérifier"}
          </Button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-center text-small text-muted-foreground hover:text-foreground transition-colors"
          >
            Retour à la connexion
          </button>
        </form>
      </div>
    </div>
  );
}
