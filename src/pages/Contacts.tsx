import { useState } from "react";
import { useContacts, type Contact, type ContactForm, emptyContactForm } from "@/hooks/useContacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, Mail, Pencil, Trash2, BookUser, Building2, MapPin, FileText } from "lucide-react";
import { toast } from "sonner";
import AddressFields from "@/components/ui/AddressFields";

const ROLES = [
  "Architecte", "Maître d'œuvre", "Sous-traitant",
  "Bureau de contrôle", "Géomètre", "Assureur",
  "Banquier", "Notaire", "Autre",
];

const ROLE_COLORS: Record<string, string> = {
  "Architecte": "bg-blue-500/10 text-blue-600",
  "Maître d'œuvre": "bg-purple-500/10 text-purple-600",
  "Sous-traitant": "bg-orange-500/10 text-orange-600",
  "Bureau de contrôle": "bg-red-500/10 text-red-600",
  "Géomètre": "bg-teal-500/10 text-teal-600",
  "Assureur": "bg-green-500/10 text-green-600",
  "Banquier": "bg-emerald-500/10 text-emerald-600",
  "Notaire": "bg-indigo-500/10 text-indigo-600",
};

function roleColor(role: string | null) {
  if (!role) return "bg-muted text-muted-foreground";
  return ROLE_COLORS[role] ?? "bg-muted text-muted-foreground";
}

function ContactDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ContactForm;
  onSave: (form: ContactForm) => Promise<boolean>;
}) {
  const [form, setForm] = useState<ContactForm>(initial);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (v: boolean) => {
    if (v) setForm(initial);
    onOpenChange(v);
  };

  const set = (field: keyof ContactForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.nom.trim()) { toast.error("Le nom est obligatoire"); return; }
    setSaving(true);
    const ok = await onSave(form);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {initial.nom ? "Modifier le contact" : "Nouveau contact"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Prénom + Nom */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom</Label>
              <Input value={form.prenom ?? ""} onChange={set("prenom")} placeholder="Jean" />
            </div>
            <div className="space-y-1.5">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input value={form.nom} onChange={set("nom")} placeholder="Dupont" />
            </div>
          </div>

          {/* Rôle + Entreprise */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Input
                value={form.role ?? ""}
                onChange={set("role")}
                list="roles-list"
                placeholder="Architecte…"
              />
              <datalist id="roles-list">
                {ROLES.map(r => <option key={r} value={r} />)}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Entreprise / Cabinet</Label>
              <Input value={form.entreprise ?? ""} onChange={set("entreprise")} placeholder="Cabinet Dupont" />
            </div>
          </div>

          {/* Email + Téléphone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={set("email")} placeholder="jean@cabinet.fr" />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={form.telephone ?? ""} onChange={set("telephone")} placeholder="06 12 34 56 78" />
            </div>
          </div>

          {/* Adresse */}
          <div className="space-y-1.5">
            <Label>Adresse</Label>
            <AddressFields
              value={form.adresse ?? ""}
              onChange={v => setForm(p => ({ ...p, adresse: v }))}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={form.notes ?? ""}
              onChange={set("notes")}
              placeholder="Spécialités, conditions de travail, chantiers communs…"
              rows={3}
            />
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

function ContactCard({
  c,
  onEdit,
  onDelete,
}: {
  c: Contact;
  onEdit: (c: Contact) => void;
  onDelete: (id: string) => void;
}) {
  const initials = [c.prenom, c.nom]
    .filter(Boolean)
    .map(s => s![0].toUpperCase())
    .join("");

  return (
    <div className="forge-card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Avatar initiales */}
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
          {initials || <BookUser className="w-4 h-4" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight">
                {[c.prenom, c.nom].filter(Boolean).join(" ")}
              </p>
              {c.entreprise && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                  <Building2 className="w-3 h-3 shrink-0" /> {c.entreprise}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => onEdit(c)}>
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
                    <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{[c.prenom, c.nom].filter(Boolean).join(" ")}" sera supprimé définitivement.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(c.id)} className="bg-destructive text-destructive-foreground">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          {c.role && (
            <Badge className={`${roleColor(c.role)} text-[10px] mt-1 font-medium border-0`}>
              {c.role}
            </Badge>
          )}
        </div>
      </div>

      {/* Infos */}
      <div className="space-y-1 pl-[52px]">
        {c.email && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{c.email}</span>
          </p>
        )}
        {c.telephone && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="w-3 h-3 shrink-0" /> {c.telephone}
          </p>
        )}
        {c.adresse && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{c.adresse}</span>
          </p>
        )}
        {c.notes && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 line-clamp-2">
            <FileText className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{c.notes}</span>
          </p>
        )}
      </div>

      {/* Actions */}
      {(c.telephone || c.email) && (
        <div className="flex gap-2 pt-1 border-t border-border/50">
          {c.telephone && (
            <a href={`tel:${c.telephone.replace(/\s/g, "")}`} className="flex-1">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Appeler
              </Button>
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="flex-1">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Envoyer un mail
              </Button>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function Contacts() {
  const { contacts, loading, add, update, remove } = useContacts();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);

  const roles = Array.from(new Set(contacts.map(c => c.role).filter(Boolean))) as string[];

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    const matchSearch =
      c.nom.toLowerCase().includes(q) ||
      (c.prenom ?? "").toLowerCase().includes(q) ||
      (c.entreprise ?? "").toLowerCase().includes(q) ||
      (c.role ?? "").toLowerCase().includes(q);
    const matchRole = !filterRole || c.role === filterRole;
    return matchSearch && matchRole;
  });

  const openNew = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (c: Contact) => { setEditTarget(c); setDialogOpen(true); };

  const handleSave = async (form: ContactForm) => {
    if (editTarget) return update(editTarget.id, form);
    return add(form);
  };

  const initialForm: ContactForm = editTarget
    ? {
        nom: editTarget.nom,
        prenom: editTarget.prenom,
        role: editTarget.role,
        entreprise: editTarget.entreprise,
        email: editTarget.email,
        telephone: editTarget.telephone,
        adresse: editTarget.adresse,
        notes: editTarget.notes,
      }
    : emptyContactForm();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-h1 font-display">Contacts</h1>
          <p className="text-muted-foreground text-body mt-1">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openNew} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Recherche + filtre rôle */}
      <div className="flex gap-2 animate-fade-up-1">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, entreprise, rôle…"
            className="pl-9"
          />
        </div>
        {roles.length > 0 && (
          <div className="flex gap-1.5 flex-wrap items-center">
            <button
              onClick={() => setFilterRole("")}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                !filterRole ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              Tous
            </button>
            {roles.map(r => (
              <button
                key={r}
                onClick={() => setFilterRole(prev => prev === r ? "" : r)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  filterRole === r ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="forge-card space-y-3">
              <div className="flex gap-3">
                <div className="skeleton-shimmer w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-shimmer h-4 rounded w-2/3" />
                  <div className="skeleton-shimmer h-3 rounded w-1/2" />
                </div>
              </div>
              <div className="skeleton-shimmer h-3 rounded w-3/4 ml-[52px]" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <BookUser className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">
            {search || filterRole ? "Aucun résultat" : "Aucun contact"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search || filterRole
              ? "Modifiez votre recherche ou filtre"
              : "Cliquez sur « Ajouter » pour créer votre premier contact."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up-2">
          {filtered.map(c => (
            <ContactCard key={c.id} c={c} onEdit={openEdit} onDelete={remove} />
          ))}
        </div>
      )}

      {/* Dialog ajout / édition */}
      <ContactDialog
        key={editTarget?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={initialForm}
        onSave={handleSave}
      />
    </div>
  );
}
