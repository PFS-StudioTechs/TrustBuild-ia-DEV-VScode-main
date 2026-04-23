import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Key, Save, Shield, Users, MessageCircle, CheckCircle2, AlertCircle, Loader2, Palette, Building2, Hash } from "lucide-react";
import { toast } from "sonner";
import MfaSetup from "@/components/security/MfaSetup";
import IntegrationsPanel from "@/components/integrations/IntegrationsPanel";
import TemplatePanel from "@/components/settings/TemplatePanel";

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

export default function Parametres() {
  const { user } = useAuth();
  const { isAdmin } = useRole();
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [siretInput, setSiretInput] = useState("");
  const [originalSiret, setOriginalSiret] = useState("");
  const [siretStatus, setSiretStatus] = useState<SiretStatus>("idle");
  const [siretError, setSiretError] = useState("");
  const [siretData, setSiretData] = useState<SiretData | null>(null);
  const [saving, setSaving] = useState(false);
  const [devisPrefix, setDevisPrefix] = useState("DEV");
  const [facturePrefix, setFacturePrefix] = useState("FAC");
  const [avenantPrefix, setAvenantPrefix] = useState("AVN");
  const [acomptePrefix, setAcomptePrefix] = useState("ACP");
  const [savingPrefixes, setSavingPrefixes] = useState(false);
  const [apiConfigs, setApiConfigs] = useState<{ service_name: string; is_active: boolean }[]>([]);
  const [allUsers, setAllUsers] = useState<{ user_id: string; role: string; email?: string }[]>([]);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [telegramStatus, setTelegramStatus] = useState<"idle" | "loading" | "connected" | "error">("idle");
  const [botName, setBotName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("nom, prenom, siret, raison_sociale, nom_commercial, adresse, code_postal, ville, pays, activite, forme_juridique")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setNom(data.nom);
        setPrenom(data.prenom);
        if (data.siret) {
          const formatted = formatSiret(data.siret);
          setSiretInput(formatted);
          setOriginalSiret(data.siret);
          setSiretStatus("valid");
          setSiretData({
            siret: data.siret,
            siren: data.siret.slice(0, 9),
            raisonSociale: data.raison_sociale ?? "",
            nomCommercial: data.nom_commercial ?? "",
            adresse: data.adresse ?? "",
            codePostal: data.code_postal ?? "",
            ville: data.ville ?? "",
            pays: data.pays ?? "France",
            activite: data.activite ?? "",
            formeJuridique: data.forme_juridique ?? "",
            actif: true,
          });
        }
      });
    supabase.from("artisan_settings").select("devis_prefix,facture_prefix,avenant_prefix,acompte_prefix").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (!data) return;
        const d = data as any;
        if (d.devis_prefix) setDevisPrefix(d.devis_prefix);
        if (d.facture_prefix) setFacturePrefix(d.facture_prefix);
        if (d.avenant_prefix) setAvenantPrefix(d.avenant_prefix);
        if (d.acompte_prefix) setAcomptePrefix(d.acompte_prefix);
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
      // Unicité : exclure le propre compte de l'utilisateur
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("siret", data.siret)
        .neq("user_id", user!.id)
        .maybeSingle();
      if (existing) {
        setSiretStatus("error");
        setSiretError("Ce SIRET est déjà associé à un autre compte Trust Build-IA");
        return;
      }
      setSiretData(data as SiretData);
      setSiretStatus("valid");
    } catch (err: any) {
      setSiretStatus("error");
      setSiretError(err.message || "Impossible de vérifier le SIRET");
    }
  };

  const handleSavePrefixes = async () => {
    if (!user) return;
    setSavingPrefixes(true);
    const { error } = await supabase
      .from("artisan_settings")
      .update({ devis_prefix: devisPrefix.trim() || "DEV", facture_prefix: facturePrefix.trim() || "FAC", avenant_prefix: avenantPrefix.trim() || "AVN", acompte_prefix: acomptePrefix.trim() || "ACP" })
      .eq("user_id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Préfixes enregistrés");
    setSavingPrefixes(false);
  };

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
    if (siretStatus === "idle" && siretInput.replace(/\s/g, "") !== originalSiret) {
      toast.error("Veuillez vérifier le SIRET avant d'enregistrer");
      return;
    }
    setSaving(true);
    const update: Record<string, unknown> = { nom, prenom };
    if (siretData && siretStatus === "valid") {
      update.siret = siretData.siret;
      update.raison_sociale = siretData.raisonSociale;
      update.nom_commercial = siretData.nomCommercial;
      update.adresse = siretData.adresse;
      update.code_postal = siretData.codePostal;
      update.ville = siretData.ville;
      update.pays = siretData.pays;
      update.activite = siretData.activite;
      update.forme_juridique = siretData.formeJuridique;
    }
    const { error } = await supabase.from("profiles").update(update).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else {
      if (siretData) setOriginalSiret(siretData.siret);
      toast.success("Profil mis à jour");
    }
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-lg mx-auto">
      <h1 className="text-h2 font-display animate-fade-up mb-6">Paramètres</h1>

      <Tabs defaultValue="profil">
        <TabsList className="bg-secondary w-full mb-6">
          <TabsTrigger value="profil" className="flex-1 gap-1.5"><User className="w-3.5 h-3.5" /> Profil</TabsTrigger>
          <TabsTrigger value="template" className="flex-1 gap-1.5"><Palette className="w-3.5 h-3.5" /> Mon template</TabsTrigger>
          <TabsTrigger value="integrations" className="flex-1 gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Intégrations</TabsTrigger>
        </TabsList>

        <TabsContent value="profil" className="space-y-6">

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
          {/* SIRET avec vérification INSEE (modification réservée aux admins) */}
          <div className="space-y-2">
            <Label className="text-small">SIRET</Label>
            <div className="flex gap-2">
              <Input
                value={siretInput}
                onChange={isAdmin ? handleSiretChange : undefined}
                placeholder="123 456 789 00012"
                className={`touch-target font-mono${!isAdmin ? " bg-muted/40 text-muted-foreground cursor-not-allowed" : ""}`}
                maxLength={17}
                disabled={!isAdmin}
                onKeyDown={(e) => { if (isAdmin && e.key === "Enter") validateSiret(); }}
              />
              {isAdmin && (
                <Button
                  type="button"
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
              )}
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
            {siretData && siretStatus === "valid" && (
              <div className="space-y-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-3">
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

        </TabsContent>

        {/* ── Mon template ── */}
        <TabsContent value="template" className="space-y-4">
          {/* Nomenclature */}
          <div className="forge-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Hash className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-h3 font-display">Nomenclature</h2>
                <p className="text-xs text-muted-foreground">Préfixes de numérotation de vos documents</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-small">Préfixe devis</Label>
                <Input value={devisPrefix} onChange={(e) => setDevisPrefix(e.target.value.toUpperCase())} placeholder="DEV" className="font-mono" maxLength={8} />
                <p className="text-xs text-muted-foreground">{devisPrefix || "DEV"}-2026-001</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small">Préfixe facture</Label>
                <Input value={facturePrefix} onChange={(e) => setFacturePrefix(e.target.value.toUpperCase())} placeholder="FAC" className="font-mono" maxLength={8} />
                <p className="text-xs text-muted-foreground">{facturePrefix || "FAC"}-2026-001</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small">Préfixe avenant</Label>
                <Input value={avenantPrefix} onChange={(e) => setAvenantPrefix(e.target.value.toUpperCase())} placeholder="AVN" className="font-mono" maxLength={8} />
                <p className="text-xs text-muted-foreground">{avenantPrefix || "AVN"}-001</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small">Préfixe acompte</Label>
                <Input value={acomptePrefix} onChange={(e) => setAcomptePrefix(e.target.value.toUpperCase())} placeholder="ACP" className="font-mono" maxLength={8} />
                <p className="text-xs text-muted-foreground">{acomptePrefix || "ACP"}-001</p>
              </div>
            </div>
            <Button onClick={handleSavePrefixes} disabled={savingPrefixes} className="w-full mt-4 touch-target">
              <Save className="w-4 h-4 mr-2" /> {savingPrefixes ? "Enregistrement…" : "Enregistrer les préfixes"}
            </Button>
          </div>

          {/* Template visuel */}
          <div className="forge-card">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Palette className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h2 className="text-h3 font-display">Mon template de document</h2>
                <p className="text-xs text-muted-foreground">Personnalisez l'apparence de vos devis et factures</p>
              </div>
            </div>
            <TemplatePanel />
          </div>
        </TabsContent>

        {/* ── Intégrations ── */}
        <TabsContent value="integrations" className="space-y-4">
          {/* Telegram */}
          <div className="forge-card">
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
          <div className="forge-card">
            <IntegrationsPanel />
          </div>
        </TabsContent>

      </Tabs>
    </div>
  );
}
