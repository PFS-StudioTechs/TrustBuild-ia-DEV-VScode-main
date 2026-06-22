import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Pencil, X, Save, Mail, Phone, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  client: "Client",
  artisan: "Artisan",
  fournisseur: "Fournisseur",
  architecte: "Architecte",
};

export default function MonProfil() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    prenom: profile?.prenom ?? "",
    nom: profile?.nom ?? "",
    email: user?.email ?? "",
    telephone: profile?.telephone ?? "",
    adresse: profile?.adresse ?? "",
    code_postal: profile?.code_postal ?? "",
    ville: profile?.ville ?? "",
    pays: profile?.pays ?? "",
  });

  function startEdit() {
    setForm({
      prenom: profile?.prenom ?? "",
      nom: profile?.nom ?? "",
      email: user?.email ?? "",
      telephone: profile?.telephone ?? "",
      adresse: profile?.adresse ?? "",
      code_postal: profile?.code_postal ?? "",
      ville: profile?.ville ?? "",
      pays: profile?.pays ?? "",
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const currentEmail = user?.email ?? "";
      const emailChanged = form.email.trim() !== currentEmail && form.email.trim() !== "";

      const { data, error } = await supabase.functions.invoke("update-client-profile", {
        body: {
          prenom: form.prenom.trim(),
          nom: form.nom.trim(),
          telephone: form.telephone.trim() || null,
          adresse: form.adresse.trim() || null,
          code_postal: form.code_postal.trim() || null,
          ville: form.ville.trim() || null,
          pays: form.pays.trim() || null,
          ...(emailChanged ? { new_email: form.email.trim() } : {}),
        },
      });

      if (error) throw error;

      if (emailChanged) {
        const { error: authErr } = await supabase.auth.updateUser({ email: form.email.trim() });
        if (authErr) {
          toast.error(`Erreur changement email : ${authErr.message}`);
        } else {
          toast.info("Un email de confirmation a été envoyé à votre nouvelle adresse.");
        }
      }

      const changedFields = (data as { changed_fields?: string[] })?.changed_fields ?? [];
      if (changedFields.length > 0) {
        toast.success("Profil mis à jour. Votre artisan a été notifié des changements.");
      } else {
        toast.success("Profil mis à jour.");
      }

      queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
      setEditing(false);
    } catch (err: unknown) {
      toast.error(`Erreur : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!profile) return null;

  const displayEmail = user?.email ?? "";
  const createdAt = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-display font-bold">Mon profil</h1>
          <p className="text-muted-foreground text-sm mt-1">Informations personnelles de votre compte</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="w-4 h-4 mr-2" />
            Modifier
          </Button>
        )}
      </div>

      <div className="forge-card space-y-5">
        <div className="flex items-center gap-4 pb-4 border-b border-border">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-7 h-7 text-primary" />
          </div>
          <div>
            <div className="font-display font-bold text-lg">
              {profile.prenom} {profile.nom}
            </div>
            <Badge variant="outline" className="text-xs mt-1">
              {ACCOUNT_TYPE_LABEL[profile.account_type] ?? profile.account_type}
            </Badge>
            {createdAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Calendar className="w-3 h-3" />
                Membre depuis {createdAt}
              </div>
            )}
          </div>
        </div>

        {editing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  value={form.prenom}
                  onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">
                Email
                <span className="ml-2 text-xs text-amber-600 font-normal">(modification requiert confirmation)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                value={form.telephone}
                onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                placeholder="+33 6 00 00 00 00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adresse">Adresse</Label>
              <Input
                id="adresse"
                value={form.adresse}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                placeholder="12 rue de la Paix"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="code_postal">Code postal</Label>
                <Input
                  id="code_postal"
                  value={form.code_postal}
                  onChange={(e) => setForm((f) => ({ ...f, code_postal: e.target.value }))}
                  placeholder="75001"
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="ville">Ville</Label>
                <Input
                  id="ville"
                  value={form.ville}
                  onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
                  placeholder="Paris"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pays">Pays</Label>
              <Input
                id="pays"
                value={form.pays}
                onChange={(e) => setForm((f) => ({ ...f, pays: e.target.value }))}
                placeholder="France"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="w-4 h-4 mr-2" />
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Prénom" value={profile.prenom} />
              <InfoRow label="Nom" value={profile.nom} />
            </div>
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={displayEmail} />
            <InfoRow icon={<Phone className="w-4 h-4" />} label="Téléphone" value={profile.telephone} />
            <InfoRow
              icon={<MapPin className="w-4 h-4" />}
              label="Adresse"
              value={[profile.adresse, profile.code_postal && profile.ville ? `${profile.code_postal} ${profile.ville}` : profile.ville, profile.pays]
                .filter(Boolean)
                .join(", ") || null}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm font-medium">{value || <span className="text-muted-foreground italic">Non renseigné</span>}</div>
    </div>
  );
}
