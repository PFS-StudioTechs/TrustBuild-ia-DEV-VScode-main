import { Truck } from "lucide-react";

export default function Fournisseurs() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Truck className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-h1 font-display mb-2">Fournisseurs</h1>
      <p className="text-muted-foreground text-body">Page en construction</p>
    </div>
  );
}
