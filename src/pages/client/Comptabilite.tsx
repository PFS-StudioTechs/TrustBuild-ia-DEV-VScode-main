import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, TrendingUp, TrendingDown, Clock } from "lucide-react";

function formatEur(amount: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
}

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="forge-card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="font-mono text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

export default function Comptabilite() {
  const { data: clientData } = useQuery({
    queryKey: ["client-self"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["client-compta", clientData?.id],
    enabled: !!clientData?.id,
    queryFn: async () => {
      const { data: factures } = await supabase
        .from("factures")
        .select("montant_ttc, statut")
        .eq("client_id", clientData!.id);

      const list = factures ?? [];
      const total = list.reduce((s, f) => s + (f.montant_ttc ?? 0), 0);
      const paye = list.filter((f) => f.statut === "paye").reduce((s, f) => s + (f.montant_ttc ?? 0), 0);
      const enAttente = list.filter((f) => f.statut !== "paye").reduce((s, f) => s + (f.montant_ttc ?? 0), 0);
      return { total, paye, enAttente };
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-h1 font-display font-bold">Comptabilité</h1>

      {!clientData && (
        <div className="forge-card text-center py-12">
          <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">En attente de liaison</p>
          <p className="text-sm text-muted-foreground mt-1">Vos données comptables apparaîtront ici une fois lié à un artisan.</p>
        </div>
      )}

      {clientData && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Total facturé"
              value={formatEur(stats?.total ?? 0)}
              icon={Wallet}
              color="bg-primary/10 text-primary"
            />
            <KpiCard
              label="Payé"
              value={formatEur(stats?.paye ?? 0)}
              icon={TrendingDown}
              color="bg-emerald-500/10 text-emerald-600"
            />
            <KpiCard
              label="En attente"
              value={formatEur(stats?.enAttente ?? 0)}
              icon={Clock}
              color="bg-amber-500/10 text-amber-600"
            />
          </div>

          {stats?.total === 0 && (
            <div className="forge-card text-center py-8 text-muted-foreground text-sm">
              Aucune facture trouvée pour l'instant.
            </div>
          )}
        </>
      )}
    </div>
  );
}
