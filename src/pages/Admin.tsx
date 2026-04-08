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
import { Shield, Users, HardHat, Trash2, Edit, RefreshCw, Search } from "lucide-react";
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
  const { isAdmin, loading: roleLoading } = useRole();
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
                          <Select value={u.roles[0] || "artisan"} onValueChange={(v) => handleRoleChange(u.id, v)} disabled={u.id === user?.id}>
                            <SelectTrigger className="w-[120px] h-8 text-small"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="artisan">Artisan</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-small capitalize bg-primary-glow text-primary border-primary/20">{u.profile?.plan_abonnement || "gratuit"}</Badge>
                        </TableCell>
                        <TableCell className="text-small text-muted-foreground font-mono">
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "Jamais"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(u)} className="h-8 w-8 hover:bg-primary-glow"><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(u)} disabled={u.id === user?.id} className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
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
