import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Trash2, Check, X, Upload, Loader2, PackageOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { useProduits, type Produit, type ProduitUpdate } from "@/hooks/useProduits";
import type { Fournisseur } from "@/hooks/useFournisseurs";

type Filtre = "tous" | "ia" | "valide" | "manuel";

const STATUT_LABEL: Record<Produit["statut_import"], string> = {
  ia: "En cours de validation",
  valide: "Validé",
  manuel: "Manuel",
};

const STATUT_CLASS: Record<Produit["statut_import"], string> = {
  ia: "bg-amber-100 text-amber-800 border-amber-200",
  valide: "bg-emerald-100 text-emerald-800 border-emerald-200",
  manuel: "bg-blue-100 text-blue-800 border-blue-200",
};

const ACCEPT = ".csv,.pdf,.jpg,.jpeg,.png,.webp";
const EMPTY_FORM: ProduitUpdate = { reference: null, designation: "", unite: "u", prix_achat: 0, prix_negocie_valeur: null, prix_negocie: false };

function IndeterminateCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate: boolean; onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = indeterminate; }, [indeterminate]);
  return <input type="checkbox" ref={ref} checked={checked} onChange={onChange} className="cursor-pointer" />;
}

export default function CatalogueDialog({
  fournisseur, open, onOpenChange,
}: {
  fournisseur: Fournisseur; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { produits, loading, importing, fetchProduits, createProduit, updateProduit, validerProduit, validerProduits, deleteProduit, deleteProduits, uploadCatalogue } = useProduits();

  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProduitUpdate>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newForm, setNewForm] = useState<ProduitUpdate>(EMPTY_FORM);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('[CatalogueDialog] open prop =', open);
    if (open) {
      setFiltre("tous");
      setEditingId(null);
      setSelectedIds(new Set());
      setAdding(false);
      setNewForm(EMPTY_FORM);
      fetchProduits(fournisseur.id);
    }
  }, [open, fournisseur.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    console.log('[CatalogueDialog] MONTÉ');
    return () => { console.log('[CatalogueDialog] DÉMONTÉ'); };
  }, []);

  useEffect(() => { setSelectedIds(new Set()); }, [filtre]);

  const startEdit = (p: Produit) => {
    setEditingId(p.id);
    setEditForm({ reference: p.reference, designation: p.designation, unite: p.unite, prix_achat: p.prix_achat, prix_negocie_valeur: p.prix_negocie_valeur, prix_negocie: p.prix_negocie });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editForm.designation.trim()) { toast.error("La désignation est obligatoire"); return; }
    setSaving(true);
    await updateProduit(editingId, { ...editForm, designation: editForm.designation.trim() });
    setSaving(false);
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newForm.designation.trim()) { toast.error("La désignation est obligatoire"); return; }
    setSaving(true);
    const ok = await createProduit(fournisseur.id, { ...newForm, designation: newForm.designation.trim() });
    setSaving(false);
    if (ok) { setAdding(false); setNewForm(EMPTY_FORM); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await uploadCatalogue(fournisseur.id, file);
  };

  const nbIA = produits.filter(p => p.statut_import === "ia").length;
  const nbValide = produits.filter(p => p.statut_import === "valide").length;
  const filtered = filtre === "tous" ? produits : produits.filter(p => p.statut_import === filtre);
  const selectableFiltered = filtered.filter(p => p.id !== editingId);
  const allSelected = selectableFiltered.length > 0 && selectableFiltered.every(p => selectedIds.has(p.id));
  const someSelected = selectableFiltered.some(p => selectedIds.has(p.id));
  const selectedIACount = filtered.filter(p => selectedIds.has(p.id) && p.statut_import === "ia").length;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(prev => { const n = new Set(prev); selectableFiltered.forEach(p => n.delete(p.id)); return n; });
    else setSelectedIds(prev => { const n = new Set(prev); selectableFiltered.forEach(p => n.add(p.id)); return n; });
  };
  const toggleOne = (id: string) => setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleBulkValidate = async () => {
    const ids = filtered.filter(p => selectedIds.has(p.id) && p.statut_import === "ia").map(p => p.id);
    if (ids.length === 0) return;
    await validerProduits(ids);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = filtered.filter(p => selectedIds.has(p.id) && p.statut_import !== "valide").map(p => p.id);
    if (ids.length === 0) return;
    await deleteProduits(ids);
    setSelectedIds(new Set());
    setConfirmDeleteOpen(false);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] flex flex-col gap-0 p-0"
        hideCloseButton
        onInteractOutside={(e) => e.preventDefault()}
        onFocusOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DialogHeader className="px-6 pt-5 pb-4 border-b flex-row items-center justify-between">
          <DialogTitle className="font-display text-lg">Catalogue — {fournisseur.nom}</DialogTitle>
          <button onClick={() => onOpenChange(false)} className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-6 py-4 overflow-y-auto flex-1">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-border bg-muted/30">
            <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={handleFileChange} />
            <Button variant="outline" size="sm" className="gap-2 shrink-0" disabled={importing} onClick={() => fileRef.current?.click()}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Extraction…" : "Importer un catalogue"}
            </Button>
            <p className="text-xs text-muted-foreground">
              {importing ? "Analyse IA en cours, cela peut prendre quelques minutes…" : "PDF, CSV ou image acceptés — les produits extraits apparaîtront ci-dessous"}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            {(["tous", "ia", "valide", "manuel"] as Filtre[]).map(f => (
              <button key={f} onClick={() => setFiltre(f)} className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filtre === f ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground hover:border-primary/50"}`}>
                {f === "tous" ? "Tous" : f === "ia" ? "En cours de validation" : f === "valide" ? "Validés" : "Manuels"}
                {f === "ia" && nbIA > 0 && <span className="ml-1.5 bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{nbIA}</span>}
                {f === "valide" && nbValide > 0 && <span className="ml-1.5 bg-emerald-500 text-white rounded-full px-1.5 py-0.5 text-[10px]">{nbValide}</span>}
              </button>
            ))}
            {selectedIds.size > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10 h-7 text-xs" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5" /> Supprimer ({selectedIds.size})
              </Button>
            )}
            <span className="ml-auto text-xs text-muted-foreground self-center">{filtered.length} produit{filtered.length !== 1 ? "s" : ""}</span>
            <Button size="sm" variant="outline" className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50 h-7 text-xs" onClick={() => { setAdding(true); setFiltre("tous"); }} disabled={adding}>
              <Plus className="w-3.5 h-3.5" /> Ajouter un article
            </Button>
          </div>

          {adding && (
            <div className="border rounded-lg overflow-hidden bg-blue-50/50">
              <div className="px-3 py-2 bg-blue-100 text-xs font-medium text-blue-800 border-b border-blue-200">Nouvel article manuel</div>
              <div className="flex gap-2 p-3 items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Référence</span>
                  <Input value={newForm.reference ?? ""} onChange={e => setNewForm(f => ({ ...f, reference: e.target.value || null }))} className="h-7 text-xs w-28" placeholder="Optionnel" />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-40">
                  <span className="text-xs text-muted-foreground">Désignation *</span>
                  <Input value={newForm.designation} onChange={e => setNewForm(f => ({ ...f, designation: e.target.value }))} className="h-7 text-xs" placeholder="Désignation" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Unité</span>
                  <Input value={newForm.unite} onChange={e => setNewForm(f => ({ ...f, unite: e.target.value }))} className="h-7 text-xs w-16" placeholder="u" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Prix catalogue (€)</span>
                  <Input type="number" min="0" step="0.01" value={newForm.prix_achat} onChange={e => setNewForm(f => ({ ...f, prix_achat: parseFloat(e.target.value) || 0 }))} className="h-7 text-xs text-right w-28" />
                </div>
                <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700" onClick={handleCreate} disabled={saving}>
                  <Check className="w-3.5 h-3.5" /> Enregistrer
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setNewForm(EMPTY_FORM); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="skeleton-shimmer h-10 rounded" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <PackageOpen className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="font-medium text-sm">{filtre === "tous" ? "Aucun produit dans ce catalogue" : "Aucun produit pour ce filtre"}</p>
              <p className="text-xs text-muted-foreground mt-1">{filtre === "tous" ? "Importez un catalogue ou ajoutez des produits manuellement" : ""}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-8" /><col className="w-28" /><col /><col className="w-16" /><col className="w-24" /><col className="w-28" /><col className="w-32" /><col className="w-24" />
                </colgroup>
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2"><IndeterminateCheckbox checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} /></th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Référence</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Désignation</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Unité</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Prix catalogue</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Prix négocié</th>
                    <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground">Statut</th>
                    <th />
                  </tr>
                </thead>
              </table>
              <div className="overflow-y-auto max-h-[240px]">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-8" /><col className="w-28" /><col /><col className="w-16" /><col className="w-24" /><col className="w-28" /><col className="w-32" /><col className="w-24" />
                  </colgroup>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr key={p.id} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/20"}`}>
                        {editingId === p.id ? (
                          <>
                            <td className="px-3 py-1.5" />
                            <td className="px-2 py-1.5"><Input value={editForm.reference ?? ""} onChange={e => setEditForm(f => ({ ...f, reference: e.target.value || null }))} className="h-7 text-xs" placeholder="Réf." /></td>
                            <td className="px-2 py-1.5"><Input value={editForm.designation} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} className="h-7 text-xs" placeholder="Désignation" /></td>
                            <td className="px-2 py-1.5"><Input value={editForm.unite} onChange={e => setEditForm(f => ({ ...f, unite: e.target.value }))} className="h-7 text-xs w-14" placeholder="u" /></td>
                            <td className="px-2 py-1.5 text-right text-xs font-mono text-muted-foreground">{editForm.prix_achat.toFixed(2)}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number" min="0" step="0.01"
                                  value={editForm.prix_negocie_valeur ?? ""}
                                  placeholder="—"
                                  onChange={e => setEditForm(f => ({ ...f, prix_negocie_valeur: e.target.value ? parseFloat(e.target.value) : null }))}
                                  className="h-7 text-xs text-right w-20"
                                />
                                {editForm.prix_negocie_valeur != null && (
                                  <button onClick={() => setEditForm(f => ({ ...f, prix_negocie_valeur: null }))} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </td>
                            <td />
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="w-7 h-7 text-emerald-600" onClick={saveEdit} disabled={saving}><Check className="w-3.5 h-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={cancelEdit}><X className="w-3.5 h-3.5" /></Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-1.5">{p.statut_import !== "valide" && <input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleOne(p.id)} className="cursor-pointer" />}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{p.reference ?? "—"}</td>
                            <td className="px-3 py-2 text-xs">{p.designation}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{p.unite}</td>
                            <td className="px-3 py-2 text-xs text-right font-mono text-muted-foreground">{p.prix_achat.toFixed(2)}</td>
                            <td className="px-3 py-2 text-xs text-right font-mono">
                              {p.prix_negocie_valeur != null
                                ? <span className="text-blue-700 font-medium">{p.prix_negocie_valeur.toFixed(2)}</span>
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUT_CLASS[p.statut_import]}`}>{STATUT_LABEL[p.statut_import]}</span>
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => startEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                                {p.statut_import !== "valide" && (
                                  <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => deleteProduit(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {selectedIds.size} article{selectedIds.size > 1 ? "s" : ""} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible. Les articles sélectionnés seront définitivement supprimés du catalogue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground">
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
