import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TrendingUp, FileText, AlertTriangle, HardHat, Plus, Bot, MessageSquare, Users, Truck, BookUser, ChevronDown, ArrowRight } from "lucide-react";

interface KPIs {
  caMois: number;
  devisEnAttente: number;
  impayes: number;
  chantiersActifs: number;
}

function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const duration = 800;
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value]);

  return <span className="font-mono">{prefix}{display.toLocaleString("fr-FR")}{suffix}</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState<KPIs>({ caMois: 0, devisEnAttente: 0, impayes: 0, chantiersActifs: 0 });
  const [profile, setProfile] = useState<{ nom: string; prenom: string } | null>(null);
  const [devisBrouillon, setDevisBrouillon] = useState<{ id: string; numero: string; montant_ht: number; chantier_nom?: string }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [nouveauOpen, setNouveauOpen] = useState(false);
  const [jarvisMessage, setJarvisMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, chantiersRes, devisRes, facturesRes] = await Promise.all([
        supabase.from("profiles").select("nom, prenom").eq("user_id", user.id).single(),
        supabase.from("chantiers").select("id, nom, statut").eq("artisan_id", user.id),
        supabase.from("devis").select("id, statut, montant_ht, numero, chantier_id, date_validite").eq("artisan_id", user.id),
        supabase.from("factures").select("id, statut, montant_ht, solde_restant").eq("artisan_id", user.id),
      ]);
      if (profileRes.data) setProfile(profileRes.data);
      const chantiersActifs = chantiersRes.data?.filter((c) => c.statut === "en_cours").length ?? 0;
      // "À traiter" = brouillon (à envoyer) + envoye (en attente de signature)
      const devisEnAttente = devisRes.data?.filter((d) => d.statut === "brouillon" || d.statut === "envoye").length ?? 0;
      const facturePayees = facturesRes.data?.filter((f) => f.statut === "payee") ?? [];
      const caMois = facturePayees.reduce((sum, f) => sum + Number(f.montant_ht), 0);
      const impayes = facturesRes.data?.filter((f) => f.statut === "impayee").length ?? 0;
      setKpis({ caMois, devisEnAttente, impayes, chantiersActifs });

      // Devis brouillon avec nom du chantier
      const brouillons = (devisRes.data ?? []).filter(d => d.statut === "brouillon").slice(0, 5);
      setDevisBrouillon(brouillons.map(d => ({
        id: d.id,
        numero: d.numero,
        montant_ht: Number(d.montant_ht),
        chantier_nom: chantiersRes.data?.find(c => c.id === d.chantier_id)?.nom,
      })));

      // Jarvis briefing
      const prenom = profileRes.data?.prenom ?? "";
      const now = new Date();
      const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const devisExpirant = (devisRes.data ?? []).filter(d =>
        d.statut === "envoye" && d.date_validite &&
        new Date(d.date_validite) >= now && new Date(d.date_validite) <= in7d
      ).length;
      const nbImpayes = (facturesRes.data ?? []).filter(f => f.statut === "impayee").length;

      const parts: string[] = [`Bonjour ${prenom}.`];
      if (devisExpirant > 0) parts.push(`Tu as ${devisExpirant} devis qui expire${devisExpirant > 1 ? "nt" : ""} cette semaine.`);
      if (nbImpayes > 0) parts.push(`${nbImpayes} facture${nbImpayes > 1 ? "s" : ""} en retard de paiement.`);
      if (devisExpirant === 0 && nbImpayes === 0) {
        parts.push("Tout est à jour — aucune urgence aujourd'hui. Belle journée !");
      } else {
        parts.push("Je peux rédiger une relance si tu veux.");
      }
      setJarvisMessage(parts.join(" "));

      setLoaded(true);
    };
    fetchData();
  }, [user]);

  const kpiCards = [
    { label: "CA du mois", value: kpis.caMois, icon: TrendingUp, iconBg: "bg-success/10", iconColor: "text-success", suffix: " €", link: "/finances?tab=tresorerie" },
    { label: "Devis à traiter", value: kpis.devisEnAttente, icon: FileText, iconBg: "bg-warning/10", iconColor: "text-warning", link: "/devis" },
    { label: "Factures impayées", value: kpis.impayes, icon: AlertTriangle, iconBg: "bg-destructive/10", iconColor: "text-destructive", link: "/finances?tab=impayes" },
    { label: "Chantiers actifs", value: kpis.chantiersActifs, icon: HardHat, iconBg: "bg-primary/10", iconColor: "text-primary", link: "/chantiers" },
  ];

  const nouveauSubActions = [
    { label: "Clients", icon: Users, action: () => { navigate("/clients"); setNouveauOpen(false); } },
    { label: "Devis / Factures", icon: FileText, action: () => { navigate("/devis?new=1"); setNouveauOpen(false); } },
    { label: "Fournisseurs", icon: Truck, action: () => { navigate("/fournisseurs"); setNouveauOpen(false); } },
    { label: "Contacts", icon: BookUser, action: () => { navigate("/contacts"); setNouveauOpen(false); } },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      <div className="animate-fade-up">
        <h1 className="text-h1 font-display">
          Bonjour{profile ? `, ${profile.prenom}` : ""} 👋
        </h1>
        <p className="text-muted-foreground text-body mt-1">Voici le résumé de votre activité</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        {kpiCards.map((kpi, i) => (
          <div
            key={kpi.label}
            className={`forge-card animate-fade-up-${i + 1} cursor-pointer hover:border-primary/30 hover:shadow-md transition-all`}
            onClick={() => navigate(kpi.link)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-[10px] ${kpi.iconBg} flex items-center justify-center`}>
                <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
              </div>
            </div>
            <p className="text-[30px] font-bold font-mono leading-none text-foreground">
              {loaded ? <AnimatedCounter value={kpi.value} suffix={kpi.suffix || ""} /> : <span className="skeleton-shimmer inline-block w-16 h-8 rounded" />}
            </p>
            <p className="text-small text-muted-foreground mt-1.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Devis brouillon */}
      {devisBrouillon.length > 0 && (
        <div className="animate-fade-up-4">
          <h2 className="text-small font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Devis en brouillon</h2>
          <div className="space-y-2">
            {devisBrouillon.map(d => (
              <div key={d.id} className="forge-card !p-3 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate("/devis")}>
                <div>
                  <p className="text-sm font-medium">{d.numero}</p>
                  {d.chantier_nom && <p className="text-xs text-muted-foreground">{d.chantier_nom}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono">{d.montant_ht.toLocaleString("fr-FR")} € HT</span>
                  <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Brouillon</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="animate-fade-up-4">
        <h2 className="text-small font-semibold text-muted-foreground mb-3 uppercase tracking-wider text-center">Actions rapides</h2>
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              variant="outline"
              onClick={() => setNouveauOpen(v => !v)}
              className="touch-target flex items-center gap-2 rounded-lg border-border hover:border-primary/30 hover:bg-primary-glow transition-all"
            >
              <Plus className="w-4 h-4" />
              Nouveau
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${nouveauOpen ? "rotate-180" : ""}`} />
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/messagerie")}
              className="touch-target flex items-center gap-2 rounded-lg border-border hover:border-primary/30 hover:bg-primary-glow transition-all"
            >
              <MessageSquare className="w-4 h-4" />
              Messagerie
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/assistant")}
              className="touch-target flex items-center gap-2 rounded-lg border-border hover:border-primary/30 hover:bg-primary-glow transition-all"
            >
              <Bot className="w-4 h-4" />
              Assistants IA
            </Button>
          </div>
          {nouveauOpen && (
            <div className="w-full max-w-xs bg-card border border-border rounded-xl shadow-sm p-1">
              {nouveauSubActions.map((sub) => (
                <button
                  key={sub.label}
                  onClick={sub.action}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg hover:bg-primary/10 hover:text-primary transition-colors text-left"
                >
                  <sub.icon className="w-4 h-4" />
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {/* Jarvis briefing banner */}
      {loaded && jarvisMessage && (
        <div className="animate-fade-up-4">
          <div className="rounded-xl bg-gray-900 dark:bg-black/60 border border-white/10 px-4 py-3 flex items-center gap-3">
            <div className="relative shrink-0 w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-60" />
              <span className="relative w-2.5 h-2.5 rounded-full bg-orange-500 block" />
            </div>
            <p className="flex-1 min-w-0 text-sm text-white/90 leading-snug">
              <span className="font-bold text-orange-400">Jarvis — </span>
              {jarvisMessage}
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/assistant")}
              className="shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs h-8 px-3 gap-1 rounded-lg"
            >
              Lui répondre <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
