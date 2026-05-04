import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export default function MfaSetup() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verified = data.totp.filter((f) => f.status === "verified");
      setMfaEnabled(verified.length > 0);
      if (verified.length > 0) {
        setFactorId(verified[0].id);
      }
    } catch (err: any) {
      console.error("MFA check error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async () => {
    setEnrolling(true);
    try {
      // Unenroll any unverified factors first
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors) {
        for (const f of factors.totp.filter((f) => (f.status as string) !== "verified")) {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "TrustBuild-IA",
      });
      if (error) throw error;
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'activation 2FA");
    } finally {
      setEnrolling(false);
    }
  };

  const handleVerify = async () => {
    if (!factorId || !verifyCode) return;
    setVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode,
      });
      if (verify.error) throw verify.error;

      toast.success("2FA activé avec succès !");
      setMfaEnabled(true);
      setQrCode(null);
      setSecret(null);
      setVerifyCode("");
    } catch (err: any) {
      toast.error(err.message || "Code invalide");
    } finally {
      setVerifying(false);
    }
  };

  const handleUnenroll = async () => {
    if (!factorId) return;
    setUnenrolling(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("2FA désactivé");
      setMfaEnabled(false);
      setFactorId(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la désactivation");
    } finally {
      setUnenrolling(false);
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="forge-card animate-fade-up-2">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-h3 font-display">Sécurité (2FA)</h2>
        </div>
        <div className="skeleton-shimmer h-12 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="forge-card animate-fade-up-2">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-h3 font-display">Sécurité (2FA)</h2>
        <Badge className={mfaEnabled ? "bg-success/10 text-success ml-auto" : "bg-muted text-muted-foreground ml-auto"}>
          {mfaEnabled ? "Activé" : "Désactivé"}
        </Badge>
      </div>

      {mfaEnabled && !qrCode && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-success">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-medium">La vérification en deux étapes est active</span>
          </div>
          <p className="text-small text-muted-foreground">
            Votre compte est protégé par une application d'authentification (Google Authenticator, Authy…).
          </p>
          <Button
            variant="outline"
            onClick={handleUnenroll}
            disabled={unenrolling}
            className="touch-target text-destructive border-destructive/30 hover:bg-destructive/5"
          >
            <ShieldOff className="w-4 h-4 mr-2" />
            {unenrolling ? "Désactivation…" : "Désactiver le 2FA"}
          </Button>
        </div>
      )}

      {!mfaEnabled && !qrCode && (
        <div className="space-y-3">
          <p className="text-small text-muted-foreground">
            Ajoutez une couche de sécurité supplémentaire avec une application d'authentification
            (Google Authenticator, Authy, Microsoft Authenticator…).
          </p>
          <Button
            onClick={handleEnroll}
            disabled={enrolling}
            className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge"
          >
            <Shield className="w-4 h-4 mr-2" />
            {enrolling ? "Configuration…" : "Activer le 2FA"}
          </Button>
        </div>
      )}

      {qrCode && (
        <div className="space-y-4 animate-fade-up">
          <p className="text-sm text-muted-foreground">
            Scannez ce QR code avec votre application d'authentification :
          </p>
          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-xl">
              <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48" />
            </div>
          </div>
          {secret && (
            <div className="space-y-1">
              <Label className="text-small">Ou entrez cette clé manuellement :</Label>
              <div className="flex gap-2">
                <Input value={secret} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copySecret} className="shrink-0 touch-target">
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Code de vérification</Label>
            <Input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="touch-target font-mono text-center text-lg tracking-widest"
              maxLength={6}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleVerify}
              disabled={verifyCode.length !== 6 || verifying}
              className="flex-1 touch-target bg-cta text-primary-foreground font-bold btn-cta-pulse"
            >
              {verifying ? "Vérification…" : "Valider et activer"}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setQrCode(null); setSecret(null); setVerifyCode(""); }}
              className="touch-target"
            >
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
