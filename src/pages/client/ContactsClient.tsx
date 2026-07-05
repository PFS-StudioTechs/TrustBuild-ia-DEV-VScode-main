import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { BookUser, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function ContactsClient() {
  const navigate = useNavigate();

  const { data: clientRows } = useQuery({
    queryKey: ["client-artisans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, artisan_id")
        .eq("auth_user_id", (await supabase.auth.getUser()).data.user?.id ?? "");
      return (data ?? []).filter((c) => c.artisan_id != null);
    },
  });

  const artisanIds = clientRows?.map((c) => c.artisan_id as string) ?? [];

  const { data: artisanProfiles } = useQuery({
    queryKey: ["artisan-profiles", artisanIds],
    enabled: artisanIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nom, prenom, adresse, code_postal, ville")
        .in("user_id", artisanIds);
      return data ?? [];
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-h1 font-display font-bold">Contacts</h1>

      {!clientRows?.length && (
        <div className="forge-card text-center py-12 space-y-3">
          <BookUser className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Aucun contact pour l'instant</p>
          <p className="text-sm text-muted-foreground">Votre artisan apparaîtra ici une fois lié à votre compte.</p>
        </div>
      )}

      {artisanProfiles?.map((profile) => (
        <button
          key={profile.user_id}
          onClick={() => navigate(`/espace-client/contacts/${profile.user_id}`)}
          className="forge-card w-full text-left hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {profile.prenom?.[0]}{profile.nom?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-semibold">{profile.prenom} {profile.nom}</div>
              <div className="text-sm text-muted-foreground">Votre artisan</div>
              {profile.ville && (
                <div className="text-xs text-muted-foreground">{profile.code_postal} {profile.ville}</div>
              )}
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </div>
        </button>
      ))}
    </div>
  );
}
