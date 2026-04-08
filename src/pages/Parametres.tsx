import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Key, Save, Shield, Users, MessageCircle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import MfaSetup from "@/components/security/MfaSetup";
import IntegrationsPanel from "@/components/integrations/IntegrationsPanel";

export default function Parametres() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [siret, setSiret] = useState("");
  const [saving, setSaving] = useState(false);
  const [apiConfigs, setApiConfigs] = useState<{ service_name: string; is_active: boolean }[]>([]);
  const [allUsers, setAllUsers] = useState<{ user_id: string; role: string; email?: string }[]>([]);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramStatus, setTelegramStatus] = useState<"idle" | "loading" | "connected" | "error">("idle");
  const [botName, setBotName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nom, prenom, siret").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) { setNom(data.nom); setPrenom(data.prenom); setSiret(data.siret || ""); }
      });
    supabase.from("api_configurations").select("service_name, is_active")
      .then(({ data }) => { if (data) setApiConfigs(data); });
    if (isAdmin) {
      supabase.from("user_roles").select("user_id, role")
        .then(({ data }) => {
          if (data) {
            const userIds = [...new Set(data.map(r => r.user_id))];
            supabase.from("profiles").select("user_id, nom, prenom").in("user_id", userIds)
              .then(({ data: profiles }) => {
                setAllUsers(data.map(r => {
                  const p = profiles?.find(p => p.user_id === r.user_id);
                  return { ...r, email: p ? `${p.prenom} ${p.nom}` : r.user_id };
                }));
              });
          }
        });
    }
  }, [user]);

  // Load saved telegram chat id
  useEffect(() => {
    if (!user) return;
    supabase.from("artisan_settings").select("preferences").eq("user_id", user.id).single()
      .then(({ data }) => {
        const prefs = data?.preferences as Record<string, string> | null;
        if (prefs?.telegram_chat_id) {
          setTelegramChatId(prefs.telegram_chat_id);
          setTelegramStatus("connected");
        }
      });
    // Verify bot token works
    supabase.functions.invoke("telegram-bot", { body: { action: "verify" } })
      .then(({ data }) => {
        if (data?.ok && data?.result?.username) setBotName(data.result.username);
      });
  }, [user]);

  const handleLinkTelegram = async () => {
    if (!user || !telegramChatId.trim()) return;
    setTelegramStatus("loading");
    try {
      // Test sending a message
      const { data, error } = await supabase.functions.invoke("telegram-bot", {
        body: { action: "send", chat_id: telegramChatId.trim(), text: "✅ Trust Build-IA connecté avec succès !\nVous recevrez vos notifications Jarvis ici." },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error("Échec de l'envoi");

      // Save chat_id
      await supabase.functions.invoke("telegram-bot", {
        body: { action: "link", artisan_id: user.id, chat_id: telegramChatId.trim() },
      });
      setTelegramStatus("connected");
      toast.success("Telegram connecté avec succès !");
    } catch (e: any) {
      setTelegramStatus("error");
      toast.error("Erreur : " + (e.message || "Impossible de se connecter"));
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ nom, prenom, siret }).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Profil mis à jour");
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-lg mx-auto">
      <h1 className="text-h2 font-display animate-fade-up">Paramètres</h1>

      {/* Profil */}
      <div className="forge-card animate-fade-up-1">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-h3 font-display">Mon profil</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-small">Prénom</Label>
              <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} className="touch-target" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small">Nom</Label>
              <Input value={nom} onChange={(e) => setNom(e.target.value)} className="touch-target" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-small">SIRET</Label>
            <Input value={siret} onChange={(e) => setSiret(e.target.value)} placeholder="123 456 789 00012" className="touch-target font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-small">Email</Label>
            <Input value={user?.email || ""} disabled className="touch-target bg-secondary" />
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </div>

      {/* 2FA Security */}
      <MfaSetup />

      {/* Telegram Integration */}
      <div className="forge-card animate-fade-up-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-primary" />
          </div>
          <h2 className="text-h3 font-display">Intégration Telegram</h2>
          {botName && <Badge variant="secondary" className="bg-success/10 text-success text-xs">@{botName}</Badge>}
        </div>
        <p className="text-small text-muted-foreground mb-3">
          Connectez votre compte Telegram pour recevoir les notifications de Jarvis et envoyer des commandes vocales.
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-small">Votre Chat ID Telegram</Label>
            <Input
              value={telegramChatId}
              onChange={(e) => { setTelegramChatId(e.target.value); setTelegramStatus("idle"); }}
              placeholder="Ex: 123456789"
              className="touch-target font-mono"
              disabled={telegramStatus === "connected"}
            />
            <p className="text-xs text-muted-foreground">
              Envoyez <code>/start</code> à <strong>@userinfobot</strong> sur Telegram pour obtenir votre Chat ID.
            </p>
          </div>
          {telegramStatus === "connected" ? (
            <div className="flex items-center gap-2 text-success text-sm">
              <CheckCircle2 className="w-4 h-4" /> Connecté — notifications actives
            </div>
          ) : (
            <Button
              onClick={handleLinkTelegram}
              disabled={!telegramChatId.trim() || telegramStatus === "loading"}
              className="w-full touch-target"
            >
              {telegramStatus === "loading" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              {telegramStatus === "loading" ? "Test en cours…" : "Connecter Telegram"}
            </Button>
          )}
          {telegramStatus === "error" && (
            <p className="text-xs text-destructive">Vérifiez votre Chat ID et réessayez. Assurez-vous d'avoir démarré une conversation avec le bot.</p>
          )}
        </div>
      </div>

      {/* Intégrations complètes */}
      <div className="forge-card animate-fade-up-3">
        <IntegrationsPanel />
      </div>

      {/* Admin Panel */}
      {isAdmin && (
        <div className="forge-card animate-fade-up-4 !border-primary/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-h3 font-display">Administration</h2>
          </div>
          <div className="space-y-3">
            <p className="text-small text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> Utilisateurs et rôles
            </p>
            {allUsers.map((u, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm truncate max-w-[180px]">{u.email}</span>
                <Badge className={u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"} variant="secondary">
                  {u.role}
                </Badge>
              </div>
            ))}
            {allUsers.length === 0 && <div className="skeleton-shimmer h-8 rounded-lg" />}
          </div>
        </div>
      )}
    </div>
  );
}
