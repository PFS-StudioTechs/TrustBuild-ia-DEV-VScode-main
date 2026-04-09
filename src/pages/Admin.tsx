import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Users, HardHat, Trash2, Edit, RefreshCw, Search, Brain, Globe, CheckCircle2, AlertCircle, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

interface EnrichedUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  profile: { nom: string; prenom: string; siret: string | null; plan_abonnement: string } | null;
  roles: string[];
}

interface EnrichedChantier {
  id: string;
  nom: string;
  statut: string;
  adresse_chantier: string | null;
  date_debut: string | null;
  date_fin_prevue: string | null;
  artisan_id: string;
  artisan: { nom: string; prenom: string } | null;
  clients: { nom: string; email: string | null } | null;
}

async function adminAction(action: string, payload: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Non connecté");
  const res = await supabase.functions.invoke("admin-actions", {
    body: { action, ...payload },
  });
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export default function Admin() {
  const { user } = useAuth();
  const { isAdmin, isSuperAdmin, loading: roleLoading } = useRole();
  const [users, setUsers] = useState<EnrichedUser[]>([]);
  const [chantiers, setChantiers] = useState<EnrichedChantier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editUser, setEditUser] = useState<EnrichedUser | null>(null);
  const [editNom, setEditNom] = useState("");
  const [editPrenom, setEditPrenom] = useState("");
  const [editSiret, setEditSiret] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<EnrichedUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Base de connaissances globale — hooks AVANT tout return conditionnel ──
  const [globalDocs, setGlobalDocs] = useState<Array<{ id: string; nom: string; statut: string; storage_path: string | null; metadata: any }>>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedResults, setSeedResults] = useState<{ ok: number; errors: number; skipped: number } | null>(null);

  const loadGlobalDocs = useCallback(async () => {
    const { data } = await supabase
      .from("knowledge_documents")
      .select("id, nom, statut, storage_path, metadata")
      .eq("is_global", true)
      .order("created_at", { ascending: true });
    setGlobalDocs((data as any[]) ?? []);
  }, []);

  useEffect(() => { loadGlobalDocs(); }, [loadGlobalDocs]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, chantiersRes] = await Promise.all([
        adminAction("list_users"),
        adminAction("list_chantiers"),
      ]);
      setUsers(usersRes.users || []);
      setChantiers(chantiersRes.chantiers || []);
    } catch (e: any) {
      toast.error(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  if (roleLoading) return (
    <div className="flex items-center justify-center h-[60dvh]">
      <div className="space-y-3 w-64">
        <div className="skeleton-shimmer h-6 rounded-lg" />
        <div className="skeleton-shimmer h-4 rounded-lg w-3/4" />
        <div className="skeleton-shimmer h-4 rounded-lg w-1/2" />
      </div>
    </div>
  );
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.profile?.nom?.toLowerCase().includes(search.toLowerCase()) ||
      u.profile?.prenom?.toLowerCase().includes(search.toLowerCase())
  );

  const openEdit = (u: EnrichedUser) => {
    setEditUser(u);
    setEditNom(u.profile?.nom || "");
    setEditPrenom(u.profile?.prenom || "");
    setEditSiret(u.profile?.siret || "");
    setEditPlan(u.profile?.plan_abonnement || "gratuit");
  };

  const handleSaveProfile = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await adminAction("update_profile", {
        user_id: editUser.id,
        updates: { nom: editNom, prenom: editPrenom, siret: editSiret, plan_abonnement: editPlan },
      });
      toast.success("Profil mis à jour");
      setEditUser(null);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await adminAction("update_role", { user_id: userId, role: newRole });
      toast.success("Rôle mis à jour");
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminAction("delete_user", { user_id: deleteTarget.id });
      toast.success("Utilisateur supprimé");
      setDeleteTarget(null);
      loadData();
    } catch (e: any) {
      toast.error(e.message);
    }
    setDeleting(false);
  };

  const statutStyles: Record<string, string> = {
    prospect: "bg-muted text-muted-foreground",
    en_cours: "bg-primary/10 text-primary",
    termine: "bg-success/10 text-success",
    litige: "bg-destructive/10 text-destructive",
  };

  const GLOBAL_SOURCES = [
    { url: "https://www.castorama.fr/idees-conseils/pieces/salle-de-bain", nom: "Castorama — Salle de bain", categorie: "bricolage" },
    { url: "https://www.castorama.fr/idees-conseils/travaux/plomberie", nom: "Castorama — Plomberie", categorie: "bricolage" },
    { url: "https://www.castorama.fr/idees-conseils/travaux/electricite", nom: "Castorama — Électricité", categorie: "bricolage" },
    { url: "https://www.castorama.fr/idees-conseils/travaux/peinture", nom: "Castorama — Peinture", categorie: "bricolage" },
    { url: "https://www.castorama.fr/idees-conseils/travaux/carrelage", nom: "Castorama — Carrelage", categorie: "bricolage" },
    { url: "https://www.bricodepot.fr/conseils-bricolage/plomberie/", nom: "Brico Dépôt — Plomberie", categorie: "bricolage" },
    { url: "https://www.bricodepot.fr/conseils-bricolage/electricite/", nom: "Brico Dépôt — Électricité", categorie: "bricolage" },
    { url: "https://www.bricodepot.fr/conseils-bricolage/peinture/", nom: "Brico Dépôt — Peinture", categorie: "bricolage" },
    { url: "https://www.leroymerlin.fr/comment-choisir/plomberie-sanitaire/", nom: "Leroy Merlin — Plomberie", categorie: "bricolage" },
    { url: "https://www.leroymerlin.fr/comment-choisir/electricite/", nom: "Leroy Merlin — Électricité", categorie: "bricolage" },
    { url: "https://www.leroymerlin.fr/comment-choisir/peinture/", nom: "Leroy Merlin — Peinture", categorie: "bricolage" },
    { url: "https://www.leroymerlin.fr/comment-choisir/carrelage/", nom: "Leroy Merlin — Carrelage", categorie: "bricolage" },
    { url: "https://www.service-public.fr/professionnels-entreprises/vosdroits/F23449", nom: "Service-Public — Obligations artisan", categorie: "reglementation" },
    { url: "https://www.service-public.fr/professionnels-entreprises/vosdroits/F23461", nom: "Service-Public — Garanties construction", categorie: "reglementation" },
    { url: "https://www.service-public.fr/professionnels-entreprises/vosdroits/F31132", nom: "Service-Public — Devis & factures", categorie: "reglementation" },
    { url: "https://bpifrance-creation.fr/encyclopedie/statuts-juridiques/entreprise-individuelle/auto-entrepreneur-micro-entrepreneur", nom: "BPI France — Micro-entrepreneur", categorie: "reglementation" },
    { url: "https://www.oppbtp.fr/nos-offres/prevention-risques-metiers/", nom: "OPPBTP — Prévention BTP", categorie: "securite" },
    { url: "https://www.ffbatiment.fr/federation-francaise-du-batiment/le-secteur-du-batiment/le-secteur-en-chiffres/", nom: "FFB — Secteur bâtiment", categorie: "secteur" },
  ];

  const handleSeedGlobal = async (force = false) => {
    setSeeding(true);
    setSeedResults(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seed-global-knowledge`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ force }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error ?? "Erreur");
      setSeedResults({ ok: result.ok, errors: result.errors, skipped: result.skipped });
      toast.success(`Indexation terminée : ${result.ok} OK, ${result.errors} erreurs, ${result.skipped} ignorées`);
      loadGlobalDocs();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSeeding(false);
    }
  };

  const handleDeleteGlobalDoc = async (id: string) => {
    await supabase.from("knowledge_chunks").delete().eq("document_id", id);
    await supabase.from("knowledge_documents").delete().eq("id", id);
    setGlobalDocs(prev => prev.filter(d => d.id !== id));
    toast.success("Document global supprimé");
  };

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 animate-fade-up">
        <div className="w-9 h-9 rounded-[10px] bg-primary/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <h1 className="text-h2 font-display">Administration</h1>
        <Button variant="ghost" size="icon" onClick={loadData} disabled={loading} className="ml-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="bg-secondary w-full">
          <TabsTrigger value="users" className="flex-1 gap-1 touch-target"><Users className="w-4 h-4" /> Utilisateurs ({users.length})</TabsTrigger>
          <TabsTrigger value="chantiers" className="flex-1 gap-1 touch-target"><HardHat className="w-4 h-4" /> Chantiers ({chantiers.length})</TabsTrigger>
          <TabsTrigger value="knowledge" className="flex-1 gap-1 touch-target"><Brain className="w-4 h-4" /> Base globale</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-3 mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher un utilisateur…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 touch-target" />
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-16 rounded-lg" />)}
            </div>
          ) : (
            <div className="forge-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Rôle</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Dernière connexion</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{u.profile?.prenom} {u.profile?.nom}</p>
                            <p className="text-small text-muted-foreground">{u.email}</p>
                            {u.profile?.siret && <p className="text-small text-muted-foreground font-mono">SIRET: {u.profile.siret}</p>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const targetIsAdminOrAbove = u.roles.some(r => r === "admin" || r === "super_admin");
                            const canEdit = u.id !== user?.id && (isSuperAdmin || !targetIsAdminOrAbove);
                            const displayRole = u.roles.includes("super_admin") ? "super_admin" : u.roles.includes("admin") ? "admin" : "artisan";
                            return (
                              <Select value={displayRole} onValueChange={(v) => handleRoleChange(u.id, v)} disabled={!canEdit}>
                                <SelectTrigger className="w-[140px] h-8 text-small"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {isSuperAdmin && <SelectItem value="super_admin">Super Admin</SelectItem>}
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="artisan">Artisan</SelectItem>
                                </SelectContent>
                              </Select>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="text-small capitalize bg-primary-glow text-primary border-primary/20">{u.profile?.plan_abonnement || "gratuit"}</Badge>
                            {u.roles.includes("super_admin") && <Badge variant="outline" className="text-small bg-amber-500/10 text-amber-600 border-amber-500/20">Super Admin</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-small text-muted-foreground font-mono">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "Jamais"}
                        </TableCell>
                        <TableCell className="text-right">
                          {(() => {
                            const targetIsAdminOrAbove = u.roles.some(r => r === "admin" || r === "super_admin");
                            const canDelete = u.id !== user?.id && (isSuperAdmin || !targetIsAdminOrAbove);
                            const canEdit = isSuperAdmin || !targetIsAdminOrAbove;
                            return (
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(u)} disabled={!canEdit} className="h-8 w-8 hover:bg-primary-glow"><Edit className="w-4 h-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} disabled={!canDelete} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            );
                          })()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredUsers.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun utilisateur trouvé</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="chantiers" className="space-y-3 mt-3">
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-16 rounded-lg" />)}</div>
          ) : (
            <div className="forge-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chantier</TableHead>
                      <TableHead>Artisan</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Dates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {chantiers.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{c.nom}</p>
                            {c.adresse_chantier && <p className="text-small text-muted-foreground">{c.adresse_chantier}</p>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{c.artisan ? `${c.artisan.prenom} ${c.artisan.nom}` : "—"}</TableCell>
                        <TableCell className="text-sm">{c.clients?.nom || "—"}</TableCell>
                        <TableCell>
                          <Badge className={`text-small ${statutStyles[c.statut] || ""}`} variant="secondary">{c.statut.replace("_", " ")}</Badge>
                        </TableCell>
                        <TableCell className="text-small text-muted-foreground font-mono">
                          {c.date_debut ? new Date(c.date_debut).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "—"}
                          {c.date_fin_prevue && <> → {new Date(c.date_fin_prevue).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</>}
                        </TableCell>
                      </TableRow>
                    ))}
                    {chantiers.length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun chantier</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Base de connaissances globale ── */}
        <TabsContent value="knowledge" className="space-y-4 mt-3">
          <div className="forge-card !p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-sm">Sources partagées pour tous les artisans</p>
                <p className="text-xs text-muted-foreground">
                  {globalDocs.filter(d => d.statut === "indexe").length} / {GLOBAL_SOURCES.length} sources indexées
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSeedGlobal(false)}
                  disabled={seeding}
                  className="gap-1.5 text-xs"
                >
                  {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Indexer les manquantes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSeedGlobal(true)}
                  disabled={seeding}
                  className="gap-1.5 text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tout réindexer
                </Button>
              </div>
            </div>

            {seedResults && (
              <div className="flex gap-3 text-xs p-2 rounded-lg bg-muted">
                <span className="text-emerald-600 font-semibold">{seedResults.ok} indexées</span>
                <span className="text-destructive font-semibold">{seedResults.errors} erreurs</span>
                <span className="text-muted-foreground">{seedResults.skipped} ignorées (déjà indexées)</span>
              </div>
            )}
          </div>

          {/* Liste des sources */}
          <div className="space-y-1.5">
            {GLOBAL_SOURCES.map((source) => {
              const doc = globalDocs.find(d => d.storage_path === source.url);
              const statut = doc?.statut;
              const errorMsg = doc?.metadata?.error;
              return (
                <div key={source.url} className="forge-card !p-3 flex items-center gap-3">
                  <Globe className="w-4 h-4 text-violet-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{source.nom}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{source.url}</p>
                    {statut === "erreur" && errorMsg && (
                      <p className="text-[11px] text-destructive truncate">{errorMsg}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${
                    source.categorie === "bricolage" ? "border-blue-500/30 text-blue-600" :
                    source.categorie === "reglementation" ? "border-amber-500/30 text-amber-600" :
                    source.categorie === "securite" ? "border-red-500/30 text-red-600" :
                    "border-border text-muted-foreground"
                  }`}>
                    {source.categorie}
                  </Badge>
                  {!statut && <Badge variant="outline" className="text-[10px] shrink-0">Non indexé</Badge>}
                  {statut === "en_cours" && (
                    <Badge variant="outline" className="gap-1 text-[10px] border-primary/40 text-primary shrink-0">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" /> En cours
                    </Badge>
                  )}
                  {statut === "indexe" && (
                    <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/40 text-emerald-600 shrink-0">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Indexé
                    </Badge>
                  )}
                  {statut === "erreur" && (
                    <Badge variant="outline" className="gap-1 text-[10px] border-destructive/40 text-destructive shrink-0">
                      <AlertCircle className="w-2.5 h-2.5" /> Erreur
                    </Badge>
                  )}
                  {doc && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive shrink-0"
                      onClick={() => handleDeleteGlobalDoc(doc.id)}
                      title="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

      </Tabs>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Modifier le profil</DialogTitle>
            <DialogDescription>{editUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-small">Prénom</Label><Input value={editPrenom} onChange={(e) => setEditPrenom(e.target.value)} className="touch-target" /></div>
              <div className="space-y-1.5"><Label className="text-small">Nom</Label><Input value={editNom} onChange={(e) => setEditNom(e.target.value)} className="touch-target" /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-small">SIRET</Label><Input value={editSiret} onChange={(e) => setEditSiret(e.target.value)} className="touch-target font-mono" /></div>
            <div className="space-y-1.5">
              <Label className="text-small">Plan d'abonnement</Label>
              <Select value={editPlan} onValueChange={setEditPlan}>
                <SelectTrigger className="touch-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gratuit">Gratuit</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Annuler</Button>
            <Button onClick={handleSaveProfile} disabled={saving} className="bg-gradient-to-r from-primary to-primary/90">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">Supprimer l'utilisateur</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>{deleteTarget?.email}</strong> ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Suppression…" : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
