import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Scale, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Projet {
  id: string;
  libelle: string;
  created_at: string;
}

function NouveauProjetDialog({
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

export default function ComparateurDevis() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const { data: projets, isLoading } = useQuery({
    queryKey: ["client-projets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_projets")
        .select("*")
        .eq("auth_user_id", user!.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Projet[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (libelle: string) => {
      const { error } = await (supabase as any)
        .from("client_projets")
        .insert({ auth_user_id: user!.id, libelle });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projet créé");
      queryClient.invalidateQueries({ queryKey: ["client-projets", user?.id] });
    },
    onError: () => { toast.error("Erreur lors de la création"); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("client_projets")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Projet supprimé");
      queryClient.invalidateQueries({ queryKey: ["client-projets", user?.id] });
    },
    onError: () => { toast.error("Erreur lors de la suppression"); },
  });

  const handleSave = async (libelle: string): Promise<boolean> => {
    try {
      await createMutation.mutateAsync(libelle);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-display font-bold">Comparer mes devis</h1>
        <Button onClick={() => setFormOpen(true)} className="bg-gradient-to-r from-primary to-primary/90 shadow-forge">
          <Plus className="w-4 h-4 mr-1" /> Nouveau projet
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 skeleton-shimmer rounded-xl" />)}
        </div>
      )}

      {!isLoading && projets?.length === 0 && (
        <div className="forge-card text-center py-12 space-y-3">
          <Scale className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">Aucun projet de comparaison</p>
          <p className="text-sm text-muted-foreground">
            Créez un projet pour regrouper vos devis et les comparer.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {projets?.map(p => (
          <div
            key={p.id}
            onClick={() => navigate(`/espace-client/comparateur/${p.id}`)}
            className="forge-card hover:shadow-forge-hover transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{p.libelle}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Créé le {new Date(p.created_at).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="w-7 h-7 shrink-0 text-destructive hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce projet ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      "{p.libelle}" sera supprimé définitivement.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteMutation.mutate(p.id)}
                      className="bg-destructive text-destructive-foreground"
                    >
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>

      <NouveauProjetDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
      />
    </div>
  );
}
