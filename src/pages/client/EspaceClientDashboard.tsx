import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Package, Receipt, Pencil, MessageSquare, Bot, ArrowRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  to,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  sub?: string;
  color: string;
  to: string;
}) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="forge-card text-left w-full hover:shadow-forge-hover transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <div className="font-mono text-2xl font-bold">{value}</div>
      <div className="text-sm font-medium mt-0.5">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </button>
  );
}

export default function EspaceClientDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const prenom = profile?.prenom ?? "vous";

  const { data: clientMeta } = useQuery({
    queryKey: ["client-all"],
    queryFn: async () => {
      const userId = (await supabase.auth.getUser()).data.user?.id ?? "";
      const { data } = await supabase
        .from("clients")
        .select("id, artisan_id")
        .eq("auth_user_id", userId);
      return data ?? [];
    },
  });

  const clientIds = (clientMeta ?? []).map((c) => c.id);
  const hasArtisan = (clientMeta ?? []).some((c) => !!c.artisan_id);

  const { data: counts } = useQuery({
    queryKey: ["client-counts", clientIds],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const [devis, factures, chantiers] = await Promise.all([
        supabase.from("devis").select("id", { count: "exact", head: true }).in("client_id", clientIds),
        supabase.from("factures").select("id", { count: "exact", head: true }).in("client_id", clientIds),
        supabase.from("chantiers").select("id", { count: "exact", head: true }).in("client_id", clientIds),
      ]);
      return {
        devis: devis.count ?? 0,
        factures: factures.count ?? 0,
        chantiers: chantiers.count ?? 0,
      };
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-h1 font-display font-bold">
          Bonjour {prenom}, 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {hasArtisan
            ? "Voici l'état de votre espace client."
            : "Bienvenue sur votre espace client TrustBuild-ia."}
        </p>
      </div>

      {/* Empty state si pas d'artisan lié */}
      {!hasArtisan && (
        <div className="forge-card text-center py-10 space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-display font-semibold text-lg">En attente de liaison</h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto">
            Votre compte est prêt. Dès qu'un artisan vous ajoutera à son espace, vous verrez ici vos devis, factures et chantiers.
          </p>
        </div>
      )}

      {/* Cartes statistiques */}
      {hasArtisan && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Pencil}
            label="Conception"
            value={0}
            sub="Documents de conception"
            color="bg-violet-500/10 text-violet-600"
            to="/espace-client/conception"
          />
          <StatCard
            icon={FileText}
            label="Devis"
            value={counts?.devis ?? 0}
            sub="Documents reçus"
            color="bg-primary/10 text-primary"
            to="/espace-client/devis"
          />
          <StatCard
            icon={Package}
            label="Bons de commande"
            value={0}
            sub="Commandes en cours"
            color="bg-amber-500/10 text-amber-600"
            to="/espace-client/fournisseurs"
          />
          <StatCard
            icon={Receipt}
            label="Factures"
            value={counts?.factures ?? 0}
            sub="Factures reçues"
            color="bg-emerald-500/10 text-emerald-600"
            to="/espace-client/devis"
          />
        </div>
      )}

      {/* Messagerie + Assistants */}
      <div className="grid md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate("/espace-client/messagerie")}
          className="forge-card text-left hover:shadow-forge-hover transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-semibold text-sm">Messagerie</div>
              <div className="text-xs text-muted-foreground">Échangez avec votre artisan</div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
          </div>
          <Badge variant="outline" className="text-xs">
            {hasArtisan ? "Disponible" : "En attente d'un artisan"}
          </Badge>
        </button>

        <button
          onClick={() => navigate("/espace-client/assistants")}
          className="forge-card text-left hover:shadow-forge-hover transition-all group"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">Assistants IA</div>
              <div className="text-xs text-muted-foreground">Alfred, Simone, Gustave</div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto group-hover:text-primary transition-colors" />
          </div>
          <Badge variant="outline" className="text-xs text-primary border-primary/30">
            Disponibles maintenant
          </Badge>
        </button>
      </div>
    </div>
  );
}
