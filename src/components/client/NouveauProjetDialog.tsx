import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function NouveauProjetDialog({
  open, onOpenChange, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (libelle: string) => Promise<boolean>;
}) {
  const [libelle, setLibelle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setLibelle(""); }, [open]);

  const handleSubmit = async () => {
    if (!libelle.trim()) { toast.error("Le libellé est obligatoire"); return; }
    setSaving(true);
    const ok = await onSave(libelle.trim());
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nouveau projet</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>Libellé <span className="text-destructive">*</span></Label>
          <Input
            value={libelle}
            onChange={e => setLibelle(e.target.value)}
            placeholder="Ex : Rénovation salle de bain"
            onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={saving} className="bg-primary text-primary-foreground">
            {saving ? "Création…" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
