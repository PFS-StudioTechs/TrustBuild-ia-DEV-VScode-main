import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Phone, Mail, MapPin, Pencil, Trash2, Users, FileText, Receipt, CheckCircle2, Circle, Building2 } from "lucide-react";
import AddressFields from "@/components/ui/AddressFields";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Client {
  id: string;
  artisan_id: string;
  nom: string;
  prenom: string | null;
  type: "particulier" | "pro";
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  siret: string | null;
  commentaires: string | null;
  created_at: string;
}

type EtatProjet = "signe" | "en_cours" | "reception" | "parfait_achevement" | "termine";

interface Chantier {
  id: string;
  client_id: string;
  nom: string;
  statut: string;
  etat_projet: EtatProjet | null;
  date_debut: string | null;
}

interface DevisRow { id: string; chantier_id: string; statut: string; numero: string; montant_ht: number; }
interface AvRow    { id: string; devis_id: string; }
interface FactRow  { id: string; devis_id: string; statut: string; }

interface ClientStats {
  chantiers: Chantier[];
  nbDevis: number;
  nbAvenants: number;
  nbFactures: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ETAT_PROJET_STEPS: { key: EtatProjet; label: string }[] = [
  { key: "signe",              label: "Signé" },
  { key: "en_cours",           label: "En cours" },
  { key: "reception",          label: "Réception" },
  { key: "parfait_achevement", label: "Parfait achèvement" },
  { key: "termine",            label: "Terminé" },
];

const STATUT_CHANTIER: Record<string, { label: string; cls: string }> = {
  prospect:  { label: "Prospect",  cls: "bg-muted text-muted-foreground" },
  en_cours:  { label: "En cours",  cls: "bg-primary/10 text-primary" },
  termine:   { label: "Terminé",   cls: "bg-success/10 text-success" },
  litige:    { label: "Litige",    cls: "bg-destructive/10 text-destructive" },
};

// ---------------------------------------------------------------------------
// Pipeline visuel
// ---------------------------------------------------------------------------

function EtatProjetPipeline({
  value,
  onChange,
  readOnly = false,
}: {
  value: EtatProjet | null;
  onChange?: (v: EtatProjet) => void;
  readOnly?: boolean;
}) {
  const currentIdx = value ? ETAT_PROJET_STEPS.findIndex(s => s.key === value) : -1;

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto pb-1">
      {ETAT_PROJET_STEPS.map((step, i) => {
        const done    = i < currentIdx;
        const active  = i === currentIdx;
        const pending = i > currentIdx;
        return (
          <div key={step.key} className="flex items-center flex-1 min-w-0">
            <button
              disabled={readOnly}
              onClick={() => onChange?.(step.key)}
              className={`flex flex-col items-center gap-1 flex-1 min-w-0 px-1 transition-opacity
                ${readOnly ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors shrink-0
                ${done    ? "bg-success border-success text-white" : ""}
                ${active  ? "bg-primary border-primary text-white" : ""}
                ${pending ? "bg-background border-border text-muted-foreground" : ""}`}
              >
                {done   ? <CheckCircle2 className="w-4 h-4" /> : null}
                {active ? <span className="text-[10px] font-bold">{i + 1}</span> : null}
                {pending? <Circle className="w-3 h-3" /> : null}
              </div>
              <span className={`text-[10px] text-center leading-tight font-medium
                ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>
                {step.label}
              </span>
            </button>
            {i < ETAT_PROJET_STEPS.length - 1 && (
              <div className={`h-[2px] flex-1 shrink-0 transition-colors ${i < currentIdx ? "bg-success" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form dialog
// ---------------------------------------------------------------------------

interface ClientForm {
  nom: string; prenom: string; type: "particulier" | "pro";
  email: string; telephone: string; adresse: string;
  siret: string; commentaires: string;
}

const emptyForm = (): ClientForm => ({
  nom: "", prenom: "", type: "particulier",
  email: "", telephone: "", adresse: "",
  siret: "", commentaires: "",
});

function ClientDialog({
  open, onOpenChange, initial, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ClientForm;
  onSave: (f: ClientForm) => Promise<boolean>;
}) {
  const [form, setForm] = useState<ClientForm>(initial);
  const [saving, setSaving] = useState(false);

  const handleOpen = (v: boolean) => { if (v) setForm(initial); onOpenChange(v); };
  const set = (k: keyof ClientForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.nom.trim()) { toast.error("Le nom est obligatoire"); return; }
    if (!form.email.trim()) { toast.error("L'email est obligatoire"); return; }
    if (!form.telephone.trim()) { toast.error("Le téléphone est obligatoire"); return; }
    if (!form.adresse.trim()) { toast.error("L'adresse est obligatoire"); return; }
    if (form.type === "pro" && !form.siret.trim()) { toast.error("Le SIRET est obligatoire pour un professionnel"); return; }
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial.nom ? "Modifier le client" : "Nouveau client"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom</Label>
              <Input value={form.prenom} onChange={set("prenom")} placeholder="Jean" />
            </div>
            <div className="space-y-1.5">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input value={form.nom} onChange={set("nom")} placeholder="Dupont" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v as "particulier" | "pro" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="particulier">Particulier</SelectItem>
                <SelectItem value="pro">Professionnel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email <span className="text-destructive">*</span></Label>
              <Input type="email" value={form.email} onChange={set("email")} placeholder="jean@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone <span className="text-destructive">*</span></Label>
              <Input value={form.telephone} onChange={set("telephone")} placeholder="06 12 34 56 78" />
            </div>
          </div>
          {form.type === "pro" && (
            <div className="space-y-1.5">
              <Label>SIRET <span className="text-destructive">*</span></Label>
              <Input value={form.siret} onChange={set("siret")} placeholder="12345678901234" maxLength={14} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Adresse <span className="text-destructive">*</span></Label>
            <AddressFields value={form.adresse} onChange={v => setForm(p => ({ ...p, adresse: v }))} required />
          </div>
          <div className="space-y-1.5">
            <Label>Commentaires</Label>
            <Textarea value={form.commentaires} onChange={set("commentaires")} placeholder="Notes internes, préférences…" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Detail dialog
// ---------------------------------------------------------------------------

function ClientDetail({
  client, stats, open, onOpenChange, onEdit, onEtatChange,
}: {
  client: Client;
  stats: ClientStats;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEdit: () => void;
  onEtatChange: (chantierId: string, etat: EtatProjet) => void;
}) {
  const fullName = [client.prenom, client.nom].filter(Boolean).join(" ");
  const initials = [client.prenom, client.nom].filter(Boolean).map(s => s![0].toUpperCase()).join("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {initials || <Users className="w-5 h-5" />}
              </div>
              <div>
                <h2 className="font-display font-semibold text-lg leading-tight">{fullName}</h2>
                <Badge variant="secondary" className="text-[10px] mt-0.5">
                  {client.type === "pro" ? "Professionnel" : "Particulier"}
                </Badge>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={onEdit} className="shrink-0 gap-1.5">
              <Pencil className="w-3.5 h-3.5" /> Modifier
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="infos">
            <TabsList className="mx-6 mt-4 grid grid-cols-2">
              <TabsTrigger value="infos">Informations</TabsTrigger>
              <TabsTrigger value="chantiers">
                Chantiers
                {stats.chantiers.length > 0 && (
                  <span className="ml-1.5 text-[10px] bg-primary/10 text-primary rounded-full px-1.5">
                    {stats.chantiers.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Onglet Informations */}
            <TabsContent value="infos" className="px-6 pb-6 space-y-4 mt-4">
              {/* Compteurs */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Devis",    value: stats.nbDevis,    icon: FileText },
                  { label: "Avenants / TS", value: stats.nbAvenants, icon: FileText },
                  { label: "Factures", value: stats.nbFactures, icon: Receipt },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="forge-card !p-3 text-center">
                    <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Coordonnées */}
              <div className="space-y-2">
                {client.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${client.email}`} className="text-sm hover:text-primary transition-colors truncate">
                      {client.email}
                    </a>
                  </div>
                )}
                {client.telephone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <a href={`tel:${client.telephone.replace(/\s/g, "")}`} className="text-sm hover:text-primary transition-colors">
                      {client.telephone}
                    </a>
                  </div>
                )}
                {client.adresse && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{client.adresse}</span>
                  </div>
                )}
                {client.siret && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-muted-foreground">SIRET : {client.siret}</span>
                  </div>
                )}
              </div>

              {/* Commentaires */}
              {client.commentaires && (
                <div className="p-3 bg-muted/40 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{client.commentaires}</p>
                </div>
              )}

              {/* Actions rapides */}
              {(client.telephone || client.email) && (
                <div className="flex gap-2">
                  {client.telephone && (
                    <a href={`tel:${client.telephone.replace(/\s/g, "")}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <Phone className="w-3.5 h-3.5" /> Appeler
                      </Button>
                    </a>
                  )}
                  {client.email && (
                    <a href={`mailto:${client.email}`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full gap-1.5">
                        <Mail className="w-3.5 h-3.5" /> Envoyer un mail
                      </Button>
                    </a>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Onglet Chantiers */}
            <TabsContent value="chantiers" className="px-6 pb-6 mt-4 space-y-4">
              {stats.chantiers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun chantier associé</p>
              ) : (
                stats.chantiers.map(ch => (
                  <div key={ch.id} className="forge-card space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{ch.nom}</p>
                        {ch.date_debut && (
                          <p className="text-xs text-muted-foreground">
                            Début : {new Date(ch.date_debut).toLocaleDateString("fr-FR")}
                          </p>
                        )}
                      </div>
                      <Badge className={`${STATUT_CHANTIER[ch.statut]?.cls ?? ""} text-[10px] border-0 shrink-0`}>
                        {STATUT_CHANTIER[ch.statut]?.label ?? ch.statut}
                      </Badge>
                    </div>
                    {/* Pipeline état projet */}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">État du projet</p>
                      <EtatProjetPipeline
                        value={ch.etat_projet}
                        onChange={etat => onEtatChange(ch.id, etat)}
                      />
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Client Card
// ---------------------------------------------------------------------------

function ClientCard({
  client, stats, onClick, onEdit, onDelete,
}: {
  client: Client;
  stats: ClientStats;
  onClick: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const fullName = [client.prenom, client.nom].filter(Boolean).join(" ");
  const initials = [client.prenom, client.nom].filter(Boolean).map(s => s![0].toUpperCase()).join("");
  const latestChantier = stats.chantiers[0];

  return (
    <div
      className="forge-card cursor-pointer hover:border-primary/30 hover:shadow-md transition-all flex flex-col gap-3"
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {initials || <Users className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{fullName}</p>
              <Badge variant="secondary" className="text-[10px] mt-0.5">
                {client.type === "pro" ? "Pro" : "Particulier"}
              </Badge>
            </div>
            <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{fullName}" et toutes ses données associées seront supprimés.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(client.id)} className="bg-destructive text-destructive-foreground">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      {/* Coordonnées */}
      <div className="space-y-1">
        {client.email && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{client.email}</span>
          </p>
        )}
        {client.telephone && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="w-3 h-3 shrink-0" />{client.telephone}
          </p>
        )}
      </div>

      {/* Dernier chantier + pipeline condensé */}
      {latestChantier && (
        <div className="pt-2 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium truncate">{latestChantier.nom}</p>
            <Badge className={`${STATUT_CHANTIER[latestChantier.statut]?.cls ?? ""} text-[10px] border-0 shrink-0`}>
              {STATUT_CHANTIER[latestChantier.statut]?.label ?? latestChantier.statut}
            </Badge>
          </div>
          {latestChantier.etat_projet && (
            <EtatProjetPipeline value={latestChantier.etat_projet} readOnly />
          )}
        </div>
      )}

      {/* Mini compteurs */}
      <div className="flex gap-3 pt-1 border-t border-border/50">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="w-3 h-3" />{stats.nbDevis} devis
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <FileText className="w-3 h-3" />{stats.nbAvenants} TS
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Receipt className="w-3 h-3" />{stats.nbFactures} factures
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page principale
// ---------------------------------------------------------------------------

export default function Clients() {
  const { user } = useAuth();

  const [clients, setClients]   = useState<Client[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [devis, setDevis]       = useState<DevisRow[]>([]);
  const [avenants, setAvenants] = useState<AvRow[]>([]);
  const [factures, setFactures] = useState<FactRow[]>([]);
  const [loading, setLoading]   = useState(true);

  const [search, setSearch]     = useState("");
  const [filterType, setFilterType] = useState<"" | "particulier" | "pro">("");

  const [formOpen, setFormOpen]     = useState(false);
  const [editTarget, setEditTarget] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [cl, ch, dv, av, fa] = await Promise.all([
      supabase.from("clients").select("*").eq("artisan_id", user.id).order("nom"),
      supabase.from("chantiers").select("id, client_id, nom, statut, etat_projet, date_debut").eq("artisan_id", user.id).order("created_at", { ascending: false }),
      supabase.from("devis").select("id, chantier_id, statut, numero, montant_ht").eq("artisan_id", user.id),
      supabase.from("avenants").select("id, devis_id").eq("artisan_id", user.id),
      supabase.from("factures").select("id, devis_id, statut").eq("artisan_id", user.id),
    ]);
    setClients((cl.data ?? []) as Client[]);
    setChantiers((ch.data ?? []) as Chantier[]);
    setDevis((dv.data ?? []) as DevisRow[]);
    setAvenants((av.data ?? []) as AvRow[]);
    setFactures((fa.data ?? []) as FactRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Calcul stats par client
  const statsFor = (clientId: string): ClientStats => {
    const chs = chantiers.filter(c => c.client_id === clientId);
    const chIds = new Set(chs.map(c => c.id));
    const dvs = devis.filter(d => chIds.has(d.chantier_id));
    const dvIds = new Set(dvs.map(d => d.id));
    const avs = avenants.filter(a => dvIds.has(a.devis_id));
    const fas = factures.filter(f => dvIds.has(f.devis_id));
    return { chantiers: chs, nbDevis: dvs.length, nbAvenants: avs.length, nbFactures: fas.length };
  };

  // Filtrage
  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    const name = [c.prenom, c.nom].filter(Boolean).join(" ").toLowerCase();
    const matchSearch = name.includes(q) || (c.email ?? "").toLowerCase().includes(q) || (c.telephone ?? "").includes(q);
    const matchType = !filterType || c.type === filterType;
    return matchSearch && matchType;
  });

  // CRUD
  const openNew = () => { setEditTarget(null); setFormOpen(true); };
  const openEdit = (c: Client) => { setEditTarget(c); setFormOpen(true); };

  const handleSave = async (form: ClientForm): Promise<boolean> => {
    if (!user) return false;
    const payload = {
      nom: form.nom.trim(),
      prenom: form.prenom.trim() || null,
      type: form.type,
      email: form.email.trim() || null,
      telephone: form.telephone.trim() || null,
      adresse: form.adresse.trim() || null,
      siret: form.siret.trim() || null,
      commentaires: form.commentaires.trim() || null,
    };
    if (editTarget) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editTarget.id);
      if (error) { toast.error("Erreur lors de la modification"); return false; }
      toast.success("Client mis à jour");
    } else {
      const { error } = await supabase.from("clients").insert({ ...payload, artisan_id: user.id });
      if (error) { toast.error("Erreur lors de l'ajout"); return false; }
      toast.success("Client ajouté");
    }
    await fetchAll();
    return true;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    toast.success("Client supprimé");
    setClients(prev => prev.filter(c => c.id !== id));
    if (detailClient?.id === id) setDetailClient(null);
  };

  const handleEtatChange = async (chantierId: string, etat: EtatProjet) => {
    const { error } = await (supabase as any).from("chantiers").update({ etat_projet: etat }).eq("id", chantierId);
    if (error) { toast.error("Erreur mise à jour"); return; }
    setChantiers(prev => prev.map(c => c.id === chantierId ? { ...c, etat_projet: etat } : c));
    if (detailClient) setDetailClient(prev => prev); // force re-render
  };

  const formInitial: ClientForm = editTarget
    ? {
        nom: editTarget.nom, prenom: editTarget.prenom ?? "",
        type: editTarget.type, email: editTarget.email ?? "",
        telephone: editTarget.telephone ?? "", adresse: editTarget.adresse ?? "",
        siret: editTarget.siret ?? "", commentaires: editTarget.commentaires ?? "",
      }
    : emptyForm();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-h1 font-display">Clients</h1>
          <p className="text-muted-foreground text-body mt-1">
            {clients.length} client{clients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openNew} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
          <Plus className="w-4 h-4 mr-1" /> Nouveau client
        </Button>
      </div>

      {/* Recherche + filtres */}
      <div className="flex flex-col sm:flex-row gap-2 animate-fade-up-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email, téléphone…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(["", "particulier", "pro"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filterType === t
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t === "" ? "Tous" : t === "particulier" ? "Particuliers" : "Pros"}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="forge-card space-y-3">
              <div className="flex gap-3">
                <div className="skeleton-shimmer w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-shimmer h-4 rounded w-2/3" />
                  <div className="skeleton-shimmer h-3 rounded w-1/3" />
                </div>
              </div>
              <div className="skeleton-shimmer h-3 rounded w-1/2" />
              <div className="skeleton-shimmer h-3 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">
            {search || filterType ? "Aucun résultat" : "Aucun client"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || filterType
              ? "Modifiez votre recherche ou filtre"
              : "Cliquez sur « Nouveau client » pour commencer."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up-2">
          {filtered.map(c => (
            <ClientCard
              key={c.id}
              client={c}
              stats={statsFor(c.id)}
              onClick={() => setDetailClient(c)}
              onEdit={() => openEdit(c)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Dialog formulaire */}
      <ClientDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={formInitial}
        onSave={handleSave}
      />

      {/* Dialog détail client */}
      {detailClient && (
        <ClientDetail
          client={detailClient}
          stats={statsFor(detailClient.id)}
          open={!!detailClient}
          onOpenChange={v => { if (!v) setDetailClient(null); }}
          onEdit={() => { openEdit(detailClient); setDetailClient(null); }}
          onEtatChange={handleEtatChange}
        />
      )}
    </div>
  );
}
