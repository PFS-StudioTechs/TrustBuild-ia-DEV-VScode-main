import { Pencil } from "lucide-react";

export default function Conception() {
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-h1 font-display font-bold">Conception</h1>
      <div className="forge-card text-center py-12 space-y-3">
        <Pencil className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-medium">Documents de conception</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Plans, cahiers des charges et documents de conception partagés par votre artisan apparaîtront ici.
        </p>
      </div>
    </div>
  );
}
