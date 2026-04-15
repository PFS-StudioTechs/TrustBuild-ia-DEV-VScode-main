import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { TrendingUp, FileText, AlertTriangle, HardHat, Plus, Bot } from "lucide-react";

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

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [profileRes, chantiersRes, devisRes, facturesRes] = await Promise.all([
        supabase.from("profiles").select("nom, prenom").eq("user_id", user.id).single(),
        supabase.from("chantiers").select("id, nom, statut").eq("artisan_id", user.id),
        supabase.from("devis").select("id, statut, montant_ht, numero, chantier_id").eq("artisan_id", user.id),
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

      setLoaded(true);
    };
    fetchData();
  }, [user]);

  const kpiCards = [
    { label: "CA du mois", value: kpis.caMois, icon: TrendingUp, iconBg: "bg-success/10", iconColor: "text-success", suffix: " €", link: "/finances?tab=tresorerie" },
    { label: "Devis à traiter", value: kpis.devisEnAttente, icon: FileText, iconBg: "bg-warning/10", iconColor: "text-warning", link: "/documents?tab=devis" },
    { label: "Factures impayées", value: kpis.impayes, icon: AlertTriangle, iconBg: "bg-destructive/10", iconColor: "text-destructive", link: "/finances?tab=impayes" },
    { label: "Chantiers actifs", value: kpis.chantiersActifs, icon: HardHat, iconBg: "bg-primary/10", iconColor: "text-primary", link: "/chantiers" },
  ];

  const quickActions = [
    { label: "Nouveau devis", icon: Plus, action: () => navigate("/documents?new=devis") },
    { label: "Nouveau chantier", icon: HardHat, action: () => navigate("/chantiers?new=1") },
    { label: "Assistant IA", icon: Bot, action: () => navigate("/assistant") },
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
              <div key={d.id} className="forge-card !p-3 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-all" onClick={() => navigate("/documents?tab=devis")}>
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
        <h2 className="text-small font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Actions rapides</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              onClick={action.action}
              className="touch-target flex items-center gap-2 shrink-0 rounded-lg border-border hover:border-primary/30 hover:bg-primary-glow transition-all"
            >
              <action.icon className="w-4 h-4" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
