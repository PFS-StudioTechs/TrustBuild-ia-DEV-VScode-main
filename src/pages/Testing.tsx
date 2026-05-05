import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import {
  FlaskConical, Bug, CheckCircle2, XCircle, Clock, AlertTriangle,
  Plus, Trash2, Edit, Send, Bot, RefreshCw, BarChart3, Minus, FileDown
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  id: string;
  reference: string;
  titre: string;
  fonctionnalite: string;
  priorite: "critique" | "haute" | "normale" | "basse";
  statut: "a_tester" | "en_cours" | "valide" | "echoue" | "bloque";
  description: string | null;
  etapes: string | null;
  resultat_attendu: string | null;
  resultat_obtenu: string | null;
  created_at: string;
}

interface TestDefect {
  id: string;
  reference: string;
  titre: string;
  fonctionnalite: string;
  severite: "critique" | "majeur" | "mineur" | "cosmétique";
  statut: "ouvert" | "en_cours" | "resolu" | "ferme" | "reouvert";
  description: string | null;
  etapes_reproduction: string | null;
  environnement: string | null;
  test_case_id: string | null;
  created_at: string;
}

interface ChatMessage { role: "user" | "assistant"; content: string; }

// ─── Helpers visuels ──────────────────────────────────────────────────────────

const STATUT_TC: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  a_tester: { label: "À tester", className: "bg-muted text-muted-foreground border-border", icon: <Minus className="w-3 h-3" /> },
  en_cours: { label: "En cours", className: "bg-primary/10 text-primary border-primary/20", icon: <Clock className="w-3 h-3" /> },
  valide:   { label: "Validé",   className: "bg-green-500/10 text-green-600 border-green-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  echoue:   { label: "Échoué",   className: "bg-destructive/10 text-destructive border-destructive/20", icon: <XCircle className="w-3 h-3" /> },
  bloque:   { label: "Bloqué",   className: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: <AlertTriangle className="w-3 h-3" /> },
};

const SEVERITE: Record<string, { label: string; className: string }> = {
  critique:   { label: "Critique",   className: "bg-destructive text-destructive-foreground border-destructive" },
  majeur:     { label: "Majeur",     className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  mineur:     { label: "Mineur",     className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  "cosmétique": { label: "Cosmétique", className: "bg-muted text-muted-foreground border-border" },
};

const STATUT_BUG: Record<string, { label: string; className: string }> = {
  ouvert:    { label: "Ouvert",    className: "bg-destructive/10 text-destructive border-destructive/20" },
  en_cours:  { label: "En cours",  className: "bg-primary/10 text-primary border-primary/20" },
  resolu:    { label: "Résolu",    className: "bg-green-500/10 text-green-600 border-green-500/20" },
  ferme:     { label: "Fermé",     className: "bg-muted text-muted-foreground border-border" },
  reouvert:  { label: "Réouvert",  className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
};

const FONCTIONNALITES = [
  "Authentification", "Dashboard", "Chantiers", "Clients", "Finances",
  "Devis", "Factures", "Assistant Jarvis", "Robert B", "Auguste P",
  "Mes Documents", "Base de connaissances", "Administration", "Mode Test", "Autre",
];

// ─── Composant principal ──────────────────────────────────────────────────────

export default function Testing() {
  const { user } = useAuth();
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [defects, setDefects] = useState<TestDefect[]>([]);
  const [loading, setLoading] = useState(true);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Bonjour ! Je suis TestBot, votre assistant stratégie de test. Dites-moi quelle fonctionnalité vous souhaitez tester et je générerai les cas de test adaptés." }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Formulaire cas de test
  const [tcDialogOpen, setTcDialogOpen] = useState(false);
  const [editingTc, setEditingTc] = useState<TestCase | null>(null);
  const [tcForm, setTcForm] = useState({
    titre: "", fonctionnalite: "Authentification", priorite: "normale",
    statut: "a_tester", description: "", etapes: "", resultat_attendu: "", resultat_obtenu: "",
  });

  // Formulaire défaut
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<TestDefect | null>(null);
  const [bugForm, setBugForm] = useState({
    titre: "", fonctionnalite: "Authentification", severite: "mineur",
    statut: "ouvert", description: "", etapes_reproduction: "", environnement: "Vercel prod", test_case_id: "",
  });

  const [saving, setSaving] = useState(false);

  // ── Chargement données ─────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [tcRes, bugRes] = await Promise.all([
      supabase.from("test_cases").select("*").eq("tester_id", user.id).order("created_at", { ascending: false }),
      supabase.from("test_defects").select("*").eq("tester_id", user.id).order("created_at", { ascending: false }),
    ]);
    setTestCases((tcRes.data as TestCase[]) ?? []);
    setDefects((bugRes.data as TestDefect[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // ── Génération de référence ────────────────────────────────────────────────

  const nextRef = (prefix: string, items: { reference: string }[]) => {
    const nums = items.map(i => parseInt(i.reference.split("-")[1] || "0")).filter(Boolean);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `${prefix}-${String(next).padStart(3, "0")}`;
  };

  // ── Chat TestBot ───────────────────────────────────────────────────────────

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setChatLoading(true);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`;

      const resp = await fetch(`${supabaseUrl}/functions/v1/assistant-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ messages: updated, stream: true }),
      });

      if (!resp.ok || !resp.body) throw new Error("Erreur de connexion");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: accumulated } : m);
                return [...prev, { role: "assistant", content: accumulated }];
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Erreur TestBot");
    } finally {
      setChatLoading(false);
    }
  };

  const exportChatToPdf = (msgIndex: number) => {
    const msg = chatMessages[msgIndex];
    if (!msg || msg.role !== "assistant") return;
    const question = msgIndex > 0 ? chatMessages[msgIndex - 1]?.content : null;

    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxW = pageW - margin * 2;
    let y = 20;

    const addLine = (text: string, size: number, style: "normal" | "bold" = "normal", color = 40) => {
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      doc.setTextColor(color);
      const lines = doc.splitTextToSize(text, maxW);
      lines.forEach((line: string) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += size * 0.45;
      });
      y += 2;
    };

    doc.setFillColor(139, 92, 246);
    doc.rect(0, 0, pageW, 14, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255);
    doc.text("TrustBuild-IA — TestBot", margin, 9);
    doc.setFont("helvetica", "normal");
    doc.text(new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }), pageW - margin, 9, { align: "right" });

    y = 24;
    addLine("TestBot — Réponse", 16, "bold", 30);
    doc.setDrawColor(220);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    if (question) {
      addLine("Question", 9, "bold", 100);
      addLine(question, 10, "normal", 60);
      doc.line(margin, y, pageW - margin, y);
      y += 6;
    }

    addLine("Réponse", 9, "bold", 100);
    const lines = msg.content.split("\n");
    for (const line of lines) {
      if (!line.trim()) { y += 3; continue; }
      if (line.startsWith("### ")) addLine(line.replace(/^### /, ""), 12, "bold", 30);
      else if (line.startsWith("## ")) addLine(line.replace(/^## /, ""), 13, "bold", 30);
      else if (/^[-*•]\s/.test(line)) addLine(`  • ${line.replace(/^[-*•]\s/, "").replace(/\*\*(.*?)\*\*/g, "$1")}`, 10, "normal", 40);
      else addLine(line.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\*(.*?)\*/g, "$1"), 10, "normal", 40);
    }

    const pageCount = (doc.internal as any).getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(160);
      doc.text(`Page ${p} / ${pageCount}`, pageW - margin, 287, { align: "right" });
    }

    doc.save(`TestBot_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ── CRUD Cas de test ───────────────────────────────────────────────────────

  const openNewTc = () => {
    setEditingTc(null);
    setTcForm({ titre: "", fonctionnalite: "Authentification", priorite: "normale", statut: "a_tester", description: "", etapes: "", resultat_attendu: "", resultat_obtenu: "" });
    setTcDialogOpen(true);
  };

  const openEditTc = (tc: TestCase) => {
    setEditingTc(tc);
    setTcForm({ titre: tc.titre, fonctionnalite: tc.fonctionnalite, priorite: tc.priorite, statut: tc.statut, description: tc.description ?? "", etapes: tc.etapes ?? "", resultat_attendu: tc.resultat_attendu ?? "", resultat_obtenu: tc.resultat_obtenu ?? "" });
    setTcDialogOpen(true);
  };

  const saveTc = async () => {
    if (!user || !tcForm.titre.trim()) return;
    setSaving(true);
    if (editingTc) {
      const { error } = await supabase.from("test_cases").update({ ...tcForm }).eq("id", editingTc.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      setTestCases(prev => prev.map(t => t.id === editingTc.id ? { ...t, ...tcForm } as TestCase : t));
      toast.success("Cas de test mis à jour");
    } else {
      const ref = nextRef("TEST", testCases);
      const { data, error } = await supabase.from("test_cases").insert({ tester_id: user.id, reference: ref, ...tcForm }).select().single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      setTestCases(prev => [data as TestCase, ...prev]);
      toast.success(`${ref} créé`);
    }
    setSaving(false);
    setTcDialogOpen(false);
  };

  const deleteTc = async (tc: TestCase) => {
    if (!confirm(`Supprimer ${tc.reference} ?`)) return;
    await supabase.from("test_cases").delete().eq("id", tc.id);
    setTestCases(prev => prev.filter(t => t.id !== tc.id));
    toast.success("Cas supprimé");
  };

  // ── CRUD Défauts ───────────────────────────────────────────────────────────

  const openNewBug = () => {
    setEditingBug(null);
    setBugForm({ titre: "", fonctionnalite: "Authentification", severite: "mineur", statut: "ouvert", description: "", etapes_reproduction: "", environnement: "Vercel prod", test_case_id: "" });
    setBugDialogOpen(true);
  };

  const openEditBug = (bug: TestDefect) => {
    setEditingBug(bug);
    setBugForm({ titre: bug.titre, fonctionnalite: bug.fonctionnalite, severite: bug.severite, statut: bug.statut, description: bug.description ?? "", etapes_reproduction: bug.etapes_reproduction ?? "", environnement: bug.environnement ?? "", test_case_id: bug.test_case_id ?? "" });
    setBugDialogOpen(true);
  };

  const saveBug = async () => {
    if (!user || !bugForm.titre.trim()) return;
    setSaving(true);
    const payload = { ...bugForm, test_case_id: bugForm.test_case_id || null };
    if (editingBug) {
      const { error } = await supabase.from("test_defects").update(payload).eq("id", editingBug.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      setDefects(prev => prev.map(d => d.id === editingBug.id ? { ...d, ...payload } as TestDefect : d));
      toast.success("Défaut mis à jour");
    } else {
      const ref = nextRef("BUG", defects);
      const { data, error } = await supabase.from("test_defects").insert({ tester_id: user.id, reference: ref, ...payload }).select().single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      setDefects(prev => [data as TestDefect, ...prev]);
      toast.success(`${ref} créé`);
    }
    setSaving(false);
    setBugDialogOpen(false);
  };

  const deleteBug = async (bug: TestDefect) => {
    if (!confirm(`Supprimer ${bug.reference} ?`)) return;
    await supabase.from("test_defects").delete().eq("id", bug.id);
    setDefects(prev => prev.filter(d => d.id !== bug.id));
    toast.success("Défaut supprimé");
  };

  // ── Stats dashboard ────────────────────────────────────────────────────────

  const stats = {
    total: testCases.length,
    valides: testCases.filter(t => t.statut === "valide").length,
    echoues: testCases.filter(t => t.statut === "echoue").length,
    bloques: testCases.filter(t => t.statut === "bloque").length,
    bugsOuverts: defects.filter(d => d.statut === "ouvert" || d.statut === "reouvert").length,
    bugsCritiques: defects.filter(d => d.severite === "critique" && (d.statut === "ouvert" || d.statut === "reouvert")).length,
    couverture: testCases.length > 0 ? Math.round((testCases.filter(t => t.statut !== "a_tester").length / testCases.length) * 100) : 0,
  };

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-up">
        <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-violet-500" />
        </div>
        <div>
          <h1 className="text-h2 font-display">Mode Test</h1>
          <p className="text-xs text-muted-foreground">Environnement isolé — données de test uniquement</p>
        </div>
        <Badge className="ml-2 bg-violet-500/10 text-violet-600 border-violet-500/20 border">MODE TEST</Badge>
        <Button variant="ghost" size="icon" onClick={loadData} disabled={loading} className="ml-auto">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="bg-secondary w-full grid grid-cols-4">
          <TabsTrigger value="dashboard" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Dashboard</TabsTrigger>
          <TabsTrigger value="cases" className="gap-1.5"><CheckCircle2 className="w-4 h-4" /> Cas de test ({stats.total})</TabsTrigger>
          <TabsTrigger value="defects" className="gap-1.5"><Bug className="w-4 h-4" /> Défauts ({defects.length})</TabsTrigger>
          <TabsTrigger value="assistant" className="gap-1.5"><Bot className="w-4 h-4" /> TestBot</TabsTrigger>
        </TabsList>

        {/* ── Dashboard ── */}
        <TabsContent value="dashboard" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Cas de test", value: stats.total, sub: `${stats.couverture}% exécutés`, color: "text-primary" },
              { label: "Validés", value: stats.valides, sub: `${stats.total > 0 ? Math.round(stats.valides / stats.total * 100) : 0}% du total`, color: "text-green-600" },
              { label: "Échoués / Bloqués", value: stats.echoues + stats.bloques, sub: `${stats.echoues} échoués, ${stats.bloques} bloqués`, color: "text-destructive" },
              { label: "Bugs ouverts", value: stats.bugsOuverts, sub: `${stats.bugsCritiques} critique${stats.bugsCritiques > 1 ? "s" : ""}`, color: "text-orange-600" },
            ].map((s) => (
              <div key={s.label} className="forge-card !p-4 space-y-1">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-3xl font-bold font-display ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Répartition par fonctionnalité */}
          {testCases.length > 0 && (
            <div className="forge-card !p-4 space-y-3">
              <p className="text-sm font-medium">Répartition par fonctionnalité</p>
              {Array.from(new Set(testCases.map(t => t.fonctionnalite))).map(fn => {
                const total = testCases.filter(t => t.fonctionnalite === fn).length;
                const valides = testCases.filter(t => t.fonctionnalite === fn && t.statut === "valide").length;
                const pct = Math.round((valides / total) * 100);
                return (
                  <div key={fn} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{fn}</span>
                      <span className="text-muted-foreground">{valides}/{total} validés</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {testCases.length === 0 && (
            <div className="forge-card !p-8 text-center text-muted-foreground">
              <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Aucun cas de test — commencez par l'onglet TestBot pour générer votre stratégie.</p>
            </div>
          )}
        </TabsContent>

        {/* ── Cas de test ── */}
        <TabsContent value="cases" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={openNewTc} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Nouveau cas
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-14 rounded-xl" />)}</div>
          ) : testCases.length === 0 ? (
            <div className="forge-card !p-8 text-center text-muted-foreground">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun cas de test</p>
            </div>
          ) : (
            <div className="forge-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Réf.</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Fonctionnalité</TableHead>
                      <TableHead>Priorité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testCases.map(tc => {
                      const s = STATUT_TC[tc.statut];
                      return (
                        <TableRow key={tc.id}>
                          <TableCell className="font-mono text-xs text-primary">{tc.reference}</TableCell>
                          <TableCell className="text-sm font-medium max-w-[200px] truncate">{tc.titre}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{tc.fonctionnalite}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs capitalize ${tc.priorite === "critique" ? "text-destructive border-destructive/30" : tc.priorite === "haute" ? "text-orange-600 border-orange-500/30" : ""}`}>
                              {tc.priorite}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs gap-1 ${s.className}`}>
                              {s.icon} {s.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditTc(tc)} className="h-8 w-8"><Edit className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteTc(tc)} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Défauts ── */}
        <TabsContent value="defects" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button onClick={openNewBug} size="sm" variant="destructive" className="gap-1.5">
              <Plus className="w-4 h-4" /> Signaler un bug
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton-shimmer h-14 rounded-xl" />)}</div>
          ) : defects.length === 0 ? (
            <div className="forge-card !p-8 text-center text-muted-foreground">
              <Bug className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun défaut signalé</p>
            </div>
          ) : (
            <div className="forge-card !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Réf.</TableHead>
                      <TableHead>Titre</TableHead>
                      <TableHead>Fonctionnalité</TableHead>
                      <TableHead>Sévérité</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Env.</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {defects.map(bug => {
                      const sev = SEVERITE[bug.severite] ?? SEVERITE.mineur;
                      const st = STATUT_BUG[bug.statut] ?? STATUT_BUG.ouvert;
                      return (
                        <TableRow key={bug.id}>
                          <TableCell className="font-mono text-xs text-destructive">{bug.reference}</TableCell>
                          <TableCell className="text-sm font-medium max-w-[180px] truncate">{bug.titre}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{bug.fonctionnalite}</TableCell>
                          <TableCell><Badge variant="outline" className={`text-xs ${sev.className}`}>{sev.label}</Badge></TableCell>
                          <TableCell><Badge variant="outline" className={`text-xs ${st.className}`}>{st.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[80px]">{bug.environnement}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditBug(bug)} className="h-8 w-8"><Edit className="w-3.5 h-3.5" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteBug(bug)} className="h-8 w-8 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── TestBot ── */}
        <TabsContent value="assistant" className="mt-4">
          <div className="forge-card !p-0 flex flex-col h-[60dvh]">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-violet-500" />
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted text-foreground rounded-tl-sm"
                    }`}>
                      {msg.content}
                    </div>
                    {msg.role === "assistant" && !chatLoading && (
                      <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-muted-foreground hover:text-foreground self-start px-1" onClick={() => exportChatToPdf(i)}>
                        <FileDown className="w-3 h-3" /> PDF
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-violet-500" />
                  </div>
                  <div className="bg-muted rounded-xl rounded-tl-sm px-3 py-2">
                    <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Ex: génère des cas de test pour le module devis…"
                disabled={chatLoading}
                className="flex-1 text-sm"
              />
              <Button onClick={sendChat} disabled={!chatInput.trim() || chatLoading} size="icon" className="bg-violet-500 hover:bg-violet-600 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Dialog Cas de test ── */}
      <Dialog open={tcDialogOpen} onOpenChange={o => !o && setTcDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editingTc ? `Modifier ${editingTc.reference}` : "Nouveau cas de test"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-small">Titre *</Label>
              <Input value={tcForm.titre} onChange={e => setTcForm(p => ({ ...p, titre: e.target.value }))} placeholder="Ex: Connexion avec email valide" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-small">Fonctionnalité</Label>
                <Select value={tcForm.fonctionnalite} onValueChange={v => setTcForm(p => ({ ...p, fonctionnalite: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FONCTIONNALITES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small">Priorité</Label>
                <Select value={tcForm.priorite} onValueChange={v => setTcForm(p => ({ ...p, priorite: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critique">Critique</SelectItem>
                    <SelectItem value="haute">Haute</SelectItem>
                    <SelectItem value="normale">Normale</SelectItem>
                    <SelectItem value="basse">Basse</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small">Statut</Label>
              <Select value={tcForm.statut} onValueChange={v => setTcForm(p => ({ ...p, statut: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_tester">À tester</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="valide">Validé</SelectItem>
                  <SelectItem value="echoue">Échoué</SelectItem>
                  <SelectItem value="bloque">Bloqué</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small">Description</Label>
              <Textarea value={tcForm.description} onChange={e => setTcForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Contexte et objectif du test" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small">Étapes</Label>
              <Textarea value={tcForm.etapes} onChange={e => setTcForm(p => ({ ...p, etapes: e.target.value }))} rows={3} placeholder="1. Aller sur /auth&#10;2. Saisir email + mot de passe&#10;3. Cliquer Connexion" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-small">Résultat attendu</Label>
                <Textarea value={tcForm.resultat_attendu} onChange={e => setTcForm(p => ({ ...p, resultat_attendu: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-small">Résultat obtenu</Label>
                <Textarea value={tcForm.resultat_obtenu} onChange={e => setTcForm(p => ({ ...p, resultat_obtenu: e.target.value }))} rows={2} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTcDialogOpen(false)}>Annuler</Button>
            <Button onClick={saveTc} disabled={saving || !tcForm.titre.trim()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog Défaut ── */}
      <Dialog open={bugDialogOpen} onOpenChange={o => !o && setBugDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">{editingBug ? `Modifier ${editingBug.reference}` : "Signaler un défaut"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-small">Titre *</Label>
              <Input value={bugForm.titre} onChange={e => setBugForm(p => ({ ...p, titre: e.target.value }))} placeholder="Ex: Le chat ne répond pas après 3 messages" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-small">Fonctionnalité</Label>
                <Select value={bugForm.fonctionnalite} onValueChange={v => setBugForm(p => ({ ...p, fonctionnalite: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FONCTIONNALITES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small">Sévérité</Label>
                <Select value={bugForm.severite} onValueChange={v => setBugForm(p => ({ ...p, severite: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critique">Critique</SelectItem>
                    <SelectItem value="majeur">Majeur</SelectItem>
                    <SelectItem value="mineur">Mineur</SelectItem>
                    <SelectItem value="cosmétique">Cosmétique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-small">Statut</Label>
                <Select value={bugForm.statut} onValueChange={v => setBugForm(p => ({ ...p, statut: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ouvert">Ouvert</SelectItem>
                    <SelectItem value="en_cours">En cours</SelectItem>
                    <SelectItem value="resolu">Résolu</SelectItem>
                    <SelectItem value="ferme">Fermé</SelectItem>
                    <SelectItem value="reouvert">Réouvert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-small">Environnement</Label>
                <Select value={bugForm.environnement} onValueChange={v => setBugForm(p => ({ ...p, environnement: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Vercel prod">Vercel prod</SelectItem>
                    <SelectItem value="local">Local</SelectItem>
                    <SelectItem value="Mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small">Cas de test lié (optionnel)</Label>
              <Select value={bugForm.test_case_id || "none"} onValueChange={v => setBugForm(p => ({ ...p, test_case_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {testCases.map(tc => <SelectItem key={tc.id} value={tc.id}>{tc.reference} — {tc.titre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-small">Description</Label>
              <Textarea value={bugForm.description} onChange={e => setBugForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-small">Étapes de reproduction</Label>
              <Textarea value={bugForm.etapes_reproduction} onChange={e => setBugForm(p => ({ ...p, etapes_reproduction: e.target.value }))} rows={3} placeholder="1. Se connecter&#10;2. Aller sur /assistant&#10;3. Envoyer un message" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBugDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={saveBug} disabled={saving || !bugForm.titre.trim()}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Loader inline pour éviter une dépendance supplémentaire
function Loader({ className }: { className?: string }) {
  return <div className={`border-2 border-current border-t-transparent rounded-full ${className}`} />;
}
