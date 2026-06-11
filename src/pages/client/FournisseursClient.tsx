import { Truck } from "lucide-react";

export default function FournisseursClient() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-h1 font-display font-bold">Fournisseurs</h1>
      <div className="forge-card text-center py-12 space-y-3">
        <Truck className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-medium">Bons de commande</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Les bons de commande et informations fournisseurs liés à vos chantiers apparaîtront ici.
        </p>
      </div>
    </div>
  );
}
