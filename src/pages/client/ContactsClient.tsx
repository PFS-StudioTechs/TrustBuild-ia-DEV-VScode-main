import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BookUser, Phone, Mail } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ContactsClient() {
  const { data: clientData } = useQuery({
    queryKey: ["client-self"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, artisan_id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
        .maybeSingle();
      return data;
    },
  });

  const { data: artisanProfile } = useQuery({
    queryKey: ["artisan-profile", clientData?.artisan_id],
    enabled: !!clientData?.artisan_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nom, prenom, adresse, code_postal, ville")
        .eq("user_id", clientData!.artisan_id!)
        .maybeSingle();
      return data;
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-h1 font-display font-bold">Contacts</h1>

      {!clientData?.artisan_id && (
        <div className="forge-card text-center py-12 space-y-3">
          <BookUser className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Aucun contact pour l'instant</p>
          <p className="text-sm text-muted-foreground">Votre artisan apparaîtra ici une fois lié à votre compte.</p>
        </div>
      )}

      {artisanProfile && (
        <div className="forge-card">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {artisanProfile.prenom?.[0]}{artisanProfile.nom?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold">{artisanProfile.prenom} {artisanProfile.nom}</div>
              <div className="text-sm text-muted-foreground">Votre artisan</div>
              {artisanProfile.ville && (
                <div className="text-xs text-muted-foreground">{artisanProfile.code_postal} {artisanProfile.ville}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
