import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShieldCheck, ShieldAlert, FileText, Download, Phone, MapPin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface ArtisanProfile {
  user_id: string;
  nom: string;
  prenom: string;
  raison_sociale: string | null;
  telephone: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  kbis_url: string | null;
}

interface DevisRow {
  id: string;
  numero: string;
  statut: string;
  created_at: string;
}

interface LegalDoc {
  type: "decennale" | "urssaf";
  storage_path: string;
  nom_fichier: string;
  uploaded_at: string;
}

const LEGAL_DOC_LABELS: Record<LegalDoc["type"], string> = {
  decennale: "Garantie décennale",
  urssaf: "Attestation URSSAF",
};

export default function ContactDetail() {
  const { artisanId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["artisan-profile", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nom, prenom, raison_sociale, telephone, adresse, code_postal, ville, kbis_url")
        .eq("user_id", artisanId)
        .maybeSingle();
      return data as ArtisanProfile | null;
    },
  });

  const { data: clientIds } = useQuery({
    queryKey: ["client-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id").eq("auth_user_id", user!.id);
      return (data ?? []).map((c) => c.id);
    },
  });

  const { data: devisList } = useQuery({
    queryKey: ["artisan-devis", artisanId, clientIds],
    enabled: !!artisanId && !!clientIds?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from("devis")
        .select("id, numero, statut, created_at")
        .eq("artisan_id", artisanId)
        .in("client_id", clientIds ?? [])
        .order("created_at", { ascending: false });
      return (data ?? []) as DevisRow[];
    },
  });

  const { data: legalDocs } = useQuery({
    queryKey: ["artisan-legal-docs", artisanId],
    enabled: !!artisanId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("artisan_documents_legaux")
        .select("type, storage_path, nom_fichier, uploaded_at")
        .eq("artisan_id", artisanId);
      return (data ?? []) as LegalDoc[];
    },
  });

  const handleDownload = async (storagePath: string) => {
    const { data } = await supabase.storage.from("artisan-documents").createSignedUrl(storagePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  if (loadingProfile) {
    return <div className="p-6 max-w-4xl mx-auto space-y-4"><div className="skeleton-shimmer h-24 rounded-xl" /></div>;
  }

  if (!profile) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <p>Artisan introuvable.</p>
        <Link to="/espace-client/contacts" className="text-primary hover:underline">Retour aux contacts</Link>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <button
        onClick={() => navigate("/espace-client/contacts")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" /> Mes contacts
      </button>

      <div className="forge-card">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">
              {profile.prenom?.[0]}{profile.nom?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <div className="text-h3 font-display font-bold">{profile.prenom} {profile.nom}</div>
            {profile.raison_sociale && <div className="text-sm text-muted-foreground">{profile.raison_sociale}</div>}
            {profile.telephone && (
              <div className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{profile.telephone}</div>
            )}
            {profile.ville && (
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{profile.adresse ? `${profile.adresse}, ` : ""}{profile.code_postal} {profile.ville}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="forge-card space-y-3">
        <h2 className="font-semibold">Documents légaux</h2>
        <div className="flex items-center justify-between py-2 border-b last:border-b-0">
          <div className="flex items-center gap-2">
            {profile.kbis_url ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-muted-foreground" />}
            <span className="text-sm">Extrait KBIS</span>
          </div>
          {profile.kbis_url ? (
            <a href={profile.kbis_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
              <Download className="w-3.5 h-3.5" /> Télécharger
            </a>
          ) : (
            <Badge variant="secondary">Non transmis</Badge>
          )}
        </div>

        {(Object.keys(LEGAL_DOC_LABELS) as LegalDoc["type"][]).map((type) => {
          const doc = legalDocs?.find((d) => d.type === type);
          return (
            <div key={type} className="flex items-center justify-between py-2 border-b last:border-b-0">
              <div className="flex items-center gap-2">
                {doc ? <ShieldCheck className="w-4 h-4 text-emerald-600" /> : <ShieldAlert className="w-4 h-4 text-muted-foreground" />}
                <span className="text-sm">{LEGAL_DOC_LABELS[type]}</span>
              </div>
              {doc ? (
                <button onClick={() => handleDownload(doc.storage_path)} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Télécharger
                </button>
              ) : (
                <Badge variant="secondary">Non transmis</Badge>
              )}
            </div>
          );
        })}
      </div>

      <div className="forge-card space-y-3">
        <h2 className="font-semibold">Devis de cet artisan</h2>
        {!devisList?.length && <p className="text-sm text-muted-foreground">Aucun devis pour l'instant.</p>}
        {devisList?.map((devis) => (
          <div key={devis.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{devis.numero}</span>
              <span className="text-xs text-muted-foreground">{new Date(devis.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
            <Badge variant="secondary">{devis.statut}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
