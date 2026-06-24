import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare } from "lucide-react";

export default function MessagerieClient() {
  const { data: clientData } = useQuery({
    queryKey: ["client-self"],
    queryFn: async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id ?? "";
      const { data, error } = await supabase
        .from("clients")
        .select("id, artisan_id")
        .eq("auth_user_id", uid);
      if (error) console.error("[MessagerieClient] clients query error:", error.message);
      return data ?? [];
    },
  });

  const hasArtisan = (clientData ?? []).some((c) => !!c.artisan_id);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-h1 font-display font-bold">Messagerie</h1>
      <div className="forge-card text-center py-12 space-y-3">
        <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="font-medium">
          {hasArtisan ? "Messagerie" : "En attente de liaison"}
        </p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {hasArtisan
            ? "La messagerie avec votre artisan sera disponible prochainement."
            : "La messagerie sera accessible dès qu'un artisan sera lié à votre compte."}
        </p>
      </div>
    </div>
  );
}
