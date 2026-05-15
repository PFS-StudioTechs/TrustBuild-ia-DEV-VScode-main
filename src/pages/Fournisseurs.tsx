import { useState, useEffect, useRef } from "react";
import { useFournisseurs, type Fournisseur, type FournisseurForm } from "@/hooks/useFournisseurs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Phone, Mail, Pencil, Trash2, Truck, User, MapPin, FileText, BookOpen } from "lucide-react";
import { toast } from "sonner";
import AddressFields from "@/components/ui/AddressFields";
import CatalogueDialog from "@/components/CatalogueDialog";

const CATEGORIES = [
  "Matériaux", "Électricité", "Plomberie", "Outillage",
  "Menuiserie", "Isolation", "Peinture", "Location", "Autre",
];

function FournisseurDialog({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: FournisseurForm;
  onSave: (form: FournisseurForm) => Promise<boolean>;
}) {
  const [form, setForm] = useState<FournisseurForm>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(initial); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const handleOpenChange = (v: boolean) => { onOpenChange(v); };

  const set = (field: keyof FournisseurForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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
            {initial.nom ? "Modifier le fournisseur" : "Nouveau fournisseur"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nom + Catégorie */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nom <span className="text-destructive">*</span></Label>
              <Input value={form.nom} onChange={set("nom")} placeholder="Leroy Merlin" />
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie</Label>
              <Input
                value={form.categorie ?? ""}
                onChange={set("categorie")}
                list="categories-list"
                placeholder="Matériaux…"
              />
              <datalist id="categories-list">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          {/* Interlocuteur */}
          <div className="space-y-1.5">
            <Label>Interlocuteur commercial</Label>
            <Input value={form.nom_contact ?? ""} onChange={set("nom_contact")} placeholder="Jean Dupont" />
          </div>

          {/* Email + Téléphone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={set("email")} placeholder="contact@fournisseur.fr" />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={form.telephone ?? ""} onChange={set("telephone")} placeholder="01 23 45 67 89" />
            </div>
          </div>

          {/* SIRET */}
          <div className="space-y-1.5">
            <Label>SIRET</Label>
            <Input value={form.siret ?? ""} onChange={set("siret")} placeholder="12345678901234" maxLength={14} />
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
              placeholder="Conditions tarifaires, délais, remises…"
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

function FournisseurCard({
  f,
  onEdit,
  onDelete,
  onCatalogue,
}: {
  f: Fournisseur;
  onEdit: (f: Fournisseur) => void;
  onDelete: (id: string) => void;
  onCatalogue: (f: Fournisseur) => void;
}) {
  return (
    <div className="forge-card flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm truncate">{f.nom}</h3>
            {f.categorie && (
              <Badge variant="secondary" className="text-[10px] shrink-0">{f.categorie}</Badge>
            )}
          </div>
          {f.nom_contact && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3" /> {f.nom_contact}
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="w-7 h-7" title="Catalogue" onClick={() => onCatalogue(f)}>
            <BookOpen className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => onEdit(f)}>
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
                <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{f.nom}" sera supprimé définitivement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(f.id)} className="bg-destructive text-destructive-foreground">
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Infos */}
      <div className="space-y-1">
        {f.email && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <Mail className="w-3 h-3 shrink-0" />
            <span className="truncate">{f.email}</span>
          </p>
        )}
        {f.telephone && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="w-3 h-3 shrink-0" /> {f.telephone}
          </p>
        )}
        {f.adresse && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{f.adresse}</span>
          </p>
        )}
        {f.notes && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 line-clamp-2">
            <FileText className="w-3 h-3 shrink-0 mt-0.5" />
            <span>{f.notes}</span>
          </p>
        )}
      </div>

      {/* Actions */}
      {(f.telephone || f.email) && (
        <div className="flex gap-2 pt-1 border-t border-border/50">
          {f.telephone && (
            <a href={`tel:${f.telephone.replace(/\s/g, "")}`} className="flex-1">
              <Button size="sm" variant="outline" className="w-full h-8 text-xs gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Appeler
              </Button>
            </a>
          )}
          {f.email && (
            <a href={`mailto:${f.email}`} className="flex-1">
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

export default function Fournisseurs() {
  const { fournisseurs, loading, add, update, remove, emptyForm } = useFournisseurs();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Fournisseur | null>(null);
  const [catalogueTarget, setCatalogueTarget] = useState<Fournisseur | null>(null);
  const windowBlurred = useRef(false);

  useEffect(() => {
    const onFocusOut = (e: FocusEvent) => {
      if (!e.relatedTarget) {
        windowBlurred.current = true;
        setTimeout(() => { windowBlurred.current = false; }, 500);
      }
    };
    document.addEventListener("focusout", onFocusOut, true);
    return () => { document.removeEventListener("focusout", onFocusOut, true); };
  }, []);

  const filtered = fournisseurs.filter(f => {
    const q = search.toLowerCase();
    return (
      f.nom.toLowerCase().includes(q) ||
      (f.categorie ?? "").toLowerCase().includes(q) ||
      (f.nom_contact ?? "").toLowerCase().includes(q)
    );
  });

  const openNew = () => { setEditTarget(null); setDialogOpen(true); };
  const openEdit = (f: Fournisseur) => { setEditTarget(f); setDialogOpen(true); };
  const openCatalogue = (f: Fournisseur) => setCatalogueTarget(f);

  const handleSave = async (form: FournisseurForm) => {
    if (editTarget) return update(editTarget.id, form);
    return add(form);
  };

  const initialForm: FournisseurForm = editTarget
    ? {
        nom: editTarget.nom,
        nom_contact: editTarget.nom_contact,
        email: editTarget.email,
        telephone: editTarget.telephone,
        adresse: editTarget.adresse,
        siret: editTarget.siret,
        categorie: editTarget.categorie,
        notes: editTarget.notes,
      }
    : emptyForm();

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-h1 font-display">Fournisseurs</h1>
          <p className="text-muted-foreground text-body mt-1">
            {fournisseurs.length} fournisseur{fournisseurs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openNew} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge">
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      {/* Recherche */}
      <div className="relative animate-fade-up-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, catégorie, interlocuteur…"
          className="pl-9"
        />
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="forge-card space-y-3">
              <div className="skeleton-shimmer h-4 rounded w-2/3" />
              <div className="skeleton-shimmer h-3 rounded w-1/2" />
              <div className="skeleton-shimmer h-3 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Truck className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">
            {search ? "Aucun résultat" : "Aucun fournisseur"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Modifiez votre recherche" : "Cliquez sur « Ajouter » pour créer votre premier fournisseur."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up-2">
          {filtered.map(f => (
            <FournisseurCard key={f.id} f={f} onEdit={openEdit} onDelete={remove} onCatalogue={openCatalogue} />
          ))}
        </div>
      )}

      <FournisseurDialog
        key={editTarget?.id ?? "new"}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={initialForm}
        onSave={handleSave}
      />

      {catalogueTarget && (
        <CatalogueDialog
          fournisseur={catalogueTarget}
          open={!!catalogueTarget}
          onOpenChange={v => { if (!v && !windowBlurred.current) setCatalogueTarget(null); }}
        />
      )}
    </div>
  );
}
