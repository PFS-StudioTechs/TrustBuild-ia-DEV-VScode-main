import { BookUser } from "lucide-react";

export default function Contacts() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <BookUser className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-h1 font-display mb-2">Contacts</h1>
      <p className="text-muted-foreground text-body">Page en construction</p>
    </div>
  );
}
