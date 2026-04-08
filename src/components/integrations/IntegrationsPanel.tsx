import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plug, Eye, EyeOff, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  vaultKey: string;
  connected: boolean;
  docUrl?: string;
}

const INTEGRATIONS_CONFIG: Omit<Integration, "connected">[] = [
  { id: "leroy-merlin", name: "Leroy Merlin Pro", category: "Fournisseurs", description: "Commandes matériaux et comparateur de prix", vaultKey: "LEROY_MERLIN_API_KEY" },
  { id: "rexel", name: "Rexel", category: "Fournisseurs", description: "Fournitures électriques et domotique", vaultKey: "REXEL_API_KEY" },
  { id: "unikalo", name: "Unikalo", category: "Fournisseurs", description: "Peintures et revêtements", vaultKey: "UNIKALO_API_KEY" },
  { id: "cedeo", name: "Cedeo", category: "Fournisseurs", description: "Sanitaire, chauffage, plomberie", vaultKey: "CEDEO_API_KEY" },
  { id: "sellsy", name: "Sellsy", category: "Comptabilité", description: "CRM et facturation", vaultKey: "SELLSY_API_KEY", docUrl: "https://api.sellsy.com" },
  { id: "pennylane", name: "Pennylane", category: "Comptabilité", description: "Comptabilité et pilotage financier", vaultKey: "PENNYLANE_API_KEY", docUrl: "https://pennylane.com" },
  { id: "henrri", name: "Henrri", category: "Comptabilité", description: "Facturation gratuite", vaultKey: "HENRRI_API_KEY" },
  { id: "yousign", name: "YouSign", category: "Signature", description: "Signature électronique eIDAS", vaultKey: "YOUSIGN_API_KEY", docUrl: "https://yousign.com" },
  { id: "stripe", name: "Stripe", category: "Paiement", description: "Paiements sécurisés par carte", vaultKey: "STRIPE_SECRET_KEY", docUrl: "https://stripe.com" },
  { id: "legifrance", name: "Légifrance (PISTE)", category: "Sources juridiques", description: "Accès aux codes et textes de loi", vaultKey: "LEGIFRANCE_API_KEY", docUrl: "https://piste.gouv.fr" },
  { id: "cstb", name: "CSTB / AFNOR", category: "Sources techniques", description: "Accès DTU et normes (futur)", vaultKey: "CSTB_API_KEY" },
];

export default function IntegrationsPanel() {
  const { user } = useAuth();
  const [connectedKeys, setConnectedKeys] = useState<Set<string>>(new Set());
  const [configuring, setConfiguring] = useState<Omit<Integration, "connected"> | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);

  // Charger les intégrations déjà configurées pour cet artisan
  useEffect(() => {
    if (!user) return;
    supabase
      .from("artisan_integrations")
      .select("integration_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setConnectedKeys(new Set(data.map((r) => r.integration_id)));
      });
  }, [user]);

  const integrations: Integration[] = INTEGRATIONS_CONFIG.map((i) => ({
    ...i,
    connected: connectedKeys.has(i.id),
  }));

  const categories = [...new Set(integrations.map((i) => i.category))];

  const handleSaveKey = async () => {
    if (!configuring || !apiKey.trim() || !user) return;
    setSaving(true);
    try {
      // Stocker la clé chiffrée via l'edge function admin-actions
      const { error } = await supabase.functions.invoke("admin-actions", {
        body: {
          action: "save_integration_key",
          integration_id: configuring.id,
          vault_key: configuring.vaultKey,
          api_key: apiKey.trim(),
          user_id: user.id,
        },
      });
      if (error) throw new Error(error.message);

      // Marquer comme connecté localement
      setConnectedKeys((prev) => new Set([...prev, configuring.id]));
      toast.success(`${configuring.name} connecté avec succès`);
      setConfiguring(null);
      setApiKey("");
      setShowKey(false);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Plug className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-h3 font-display">Intégrations</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Connectez vos outils et fournisseurs. Les clés API sont chiffrées dans Supabase Vault — elles ne sont jamais visibles en clair.
      </p>

      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-small font-semibold text-muted-foreground uppercase tracking-wider mb-3">{cat}</h3>
          <div className="space-y-2">
            {integrations.filter(i => i.category === cat).map(integration => (
              <div key={integration.id} className="forge-card flex items-center justify-between !p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{integration.name}</span>
                    {integration.connected ? (
                      <Badge className="bg-success/10 text-success text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" /> Connecté
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        <XCircle className="w-3 h-3 mr-0.5" /> Non configuré
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {integration.docUrl && (
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" asChild>
                      <a href={integration.docUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                      </a>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={integration.connected ? "secondary" : "outline"}
                    className="touch-target text-xs"
                    onClick={() => { setConfiguring(integration); setApiKey(""); setShowKey(false); }}
                  >
                    {integration.connected ? "Reconfigurer" : "Configurer"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={!!configuring} onOpenChange={(open) => { if (!open) { setConfiguring(null); setApiKey(""); setShowKey(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurer {configuring?.name}</DialogTitle>
            <DialogDescription>
              Votre clé API sera chiffrée dans Supabase Vault. Elle ne sera jamais visible en clair après enregistrement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-small">Clé API ({configuring?.vaultKey})</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk_live_..."
                  className="touch-target pr-10 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {configuring?.docUrl && (
              <p className="text-xs text-muted-foreground">
                Obtenez votre clé sur{" "}
                <a href={configuring.docUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  {configuring.name}
                </a>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfiguring(null)}>Annuler</Button>
            <Button onClick={handleSaveKey} disabled={!apiKey.trim() || saving} className="bg-gradient-to-r from-primary to-primary/90">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
