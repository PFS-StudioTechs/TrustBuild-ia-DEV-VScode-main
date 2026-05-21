import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useContacts } from "@/hooks/useContacts";
import { useFournisseurs } from "@/hooks/useFournisseurs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Mail, Plus, Send, Clock, CheckCircle2, AlertCircle, Search, Trash2,
  FileText, Receipt, MessageSquare, ChevronDown, ChevronUp, ArrowRight,
  Pencil, XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  status: string;
  sent_at: string;
  document_type?: string | null;
  document_id?: string | null;
  direction?: string | null;
  from_client_name?: string | null;
  annotations_data?: unknown[] | null;
  read?: boolean | null;
}

interface Recipient {
  label: string;
  email: string;
  sub?: string;
}

function statusBadge(status: string) {
  if (status === "sent") return <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Envoyé</Badge>;
  if (status === "no_sendgrid") return <Badge className="bg-amber-500/10 text-amber-600 text-[10px]"><AlertCircle className="w-3 h-3 mr-1" />Sans clé SendGrid</Badge>;
  if (status === "received") return <Badge className="bg-blue-500/10 text-blue-600 text-[10px]"><MessageSquare className="w-3 h-3 mr-1" />Reçu</Badge>;
  return <Badge className="bg-red-500/10 text-red-600 text-[10px]"><AlertCircle className="w-3 h-3 mr-1" />Erreur</Badge>;
}

interface LigneDevisMin {
  id: string;
  designation: string;
  quantite: number;
  unite: string;
  prix_unitaire: number;
  ordre: number;
}

function InboundMessageCard({ m, onDelete, onMarkRead }: {
  m: Message;
  onDelete: (id: string) => void;
  onMarkRead: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [lignes, setLignes] = useState<LigneDevisMin[]>([]);
  const [lignesLoading, setLignesLoading] = useState(false);
  const annotations = (m.annotations_data ?? []) as Array<{ type?: string; ligne_id?: string; contenu?: string }>;
  const isAnnotation = annotations.length > 0;
  const isRefus = m.subject.toLowerCase().includes("refus");

  const handleExpand = () => {
    if (!m.read) onMarkRead(m.id);
    const next = !expanded;
    setExpanded(next);
    if (next && m.document_id && m.document_type === "devis" && lignes.length === 0) {
      setLignesLoading(true);
      (supabase as any)
        .from("lignes_devis")
        .select("id, designation, quantite, unite, prix_unitaire, ordre")
        .eq("devis_id", m.document_id)
        .order("ordre")
        .then(({ data }: any) => {
          setLignes(data ?? []);
          setLignesLoading(false);
        });
    }
  };

  return (
    <div
      className={`forge-card border-l-4 ${!m.read ? "border-l-primary bg-primary/5 cursor-pointer" : isRefus ? "border-l-red-400" : "border-l-amber-400"}`}
      onClick={() => { if (!m.read) onMarkRead(m.id); }}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm ${isRefus ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-amber-100 text-amber-700 dark:bg-amber-900/30"}`}>
          {(m.from_client_name ?? "C")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm">{m.from_client_name ?? "Client"}</p>
                {!m.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                {isRefus
                  ? <Badge className="bg-red-500/10 text-red-600 text-[9px] h-4 px-1.5"><XCircle className="w-2.5 h-2.5 mr-0.5" />Refusé</Badge>
                  : <Badge className="bg-amber-500/10 text-amber-700 text-[9px] h-4 px-1.5"><Pencil className="w-2.5 h-2.5 mr-0.5" />Annoté</Badge>
                }
              </div>
              <p className="text-sm font-medium mt-0.5 text-foreground/80">{m.subject}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(m.id); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <p className={`text-xs text-muted-foreground mt-0.5 ${expanded ? "" : "line-clamp-2"}`}>{m.body}</p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(m.sent_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
            </p>
            {m.document_type === "devis" && (
              <Badge className="bg-blue-500/10 text-blue-600 text-[9px] h-4 px-1.5 flex items-center gap-0.5">
                <FileText className="w-2.5 h-2.5" /> Devis
              </Badge>
            )}
          </div>

          {isAnnotation && (
            <button
              onClick={(e) => { e.stopPropagation(); handleExpand(); }}
              className="flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {expanded ? "Masquer" : `Voir les ${annotations.length} annotation(s)`}
            </button>
          )}

          {expanded && isAnnotation && (
            <div className="mt-2 pl-2 border-l-2 border-primary/20 space-y-2">
              {lignesLoading && (
                <p className="text-xs text-muted-foreground">Chargement des lignes…</p>
              )}
              {!lignesLoading && lignes.length > 0 && (() => {
                const lineAnnotMap: Record<string, typeof annotations> = {};
                const globalAnnots: typeof annotations = [];
                annotations.forEach(a => {
                  if (a.ligne_id) {
                    if (!lineAnnotMap[a.ligne_id]) lineAnnotMap[a.ligne_id] = [];
                    lineAnnotMap[a.ligne_id].push(a);
                  } else {
                    globalAnnots.push(a);
                  }
                });
                return (
                  <div className="space-y-1">
                    {lignes.map(l => {
                      const lanns = lineAnnotMap[l.id] ?? [];
                      const hasAnn = lanns.length > 0;
                      const hasStrike = lanns.some(a => a.type === "line_strikethrough");
                      return (
                        <div key={l.id} className={`rounded px-2 py-1 ${hasAnn ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40" : "bg-muted/30"}`}>
                          <div className="flex justify-between gap-2 text-xs">
                            <span className={`${hasStrike ? "line-through opacity-50" : ""} ${hasAnn ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                              {l.designation}
                            </span>
                            <span className="text-muted-foreground whitespace-nowrap shrink-0">
                              {l.quantite} {l.unite} × {Number(l.prix_unitaire).toFixed(2)} €
                            </span>
                          </div>
                          {lanns.map((a, i) => (
                            <div key={i} className="mt-0.5 text-xs text-amber-700 dark:text-amber-400 italic flex items-center gap-1">
                              <Pencil className="w-2.5 h-2.5 shrink-0" />
                              {a.type === "line_strikethrough" && "Suppression demandée"}
                              {a.type === "line_circled" && "Ligne entourée"}
                              {a.type === "line_comment" && `"${a.contenu}"`}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {globalAnnots.length > 0 && (
                      <div className="mt-1 bg-muted/40 rounded px-2 py-1 text-xs text-foreground/80 border-t border-border/40">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Commentaire général : </span>
                        {globalAnnots.map((a, i) => <span key={i}>{a.contenu}</span>)}
                      </div>
                    )}
                  </div>
                );
              })()}
              {!lignesLoading && lignes.length === 0 && annotations.map((a, i) => (
                <div key={i} className="text-xs text-foreground/80 bg-muted/40 rounded px-2 py-1">
                  {a.contenu ?? "—"}
                </div>
              ))}
            </div>
          )}

          {m.document_id && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 gap-1.5 text-primary border-primary/40 hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); navigate(`/devis?open=${m.document_id}&msgId=${m.id}`); }}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Modifier le devis
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Messagerie() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { contacts } = useContacts();
  const { fournisseurs } = useFournisseurs();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"sent" | "received">("sent");
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const [toInput, setToInput] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientSuggestions, setRecipientSuggestions] = useState<Recipient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const allRecipients: Recipient[] = [
    ...contacts.filter(c => c.email).map(c => ({
      label: [c.prenom, c.nom].filter(Boolean).join(" "),
      email: c.email!,
      sub: c.entreprise ?? c.role ?? undefined,
    })),
    ...fournisseurs.filter(f => f.email).map(f => ({
      label: f.nom,
      email: f.email!,
      sub: f.nom_contact ?? f.categorie ?? "Fournisseur",
    })),
  ];

  const fetchMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("messages")
      .select("*")
      .eq("artisan_id", user.id)
      .order("sent_at", { ascending: false });
    setMessages(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!toInput.trim()) { setRecipientSuggestions([]); return; }
    const q = toInput.toLowerCase();
    setRecipientSuggestions(
      allRecipients.filter(r => r.label.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)).slice(0, 8)
    );
  }, [toInput, contacts, fournisseurs]);

  const selectRecipient = (r: Recipient) => {
    setToInput(`${r.label} <${r.email}>`);
    setToEmail(r.email);
    setToName(r.label);
    setShowSuggestions(false);
  };

  const resetCompose = () => { setToInput(""); setToEmail(""); setToName(""); setSubject(""); setBody(""); };

  const handleSend = async () => {
    const resolvedEmail = toEmail || toInput.trim();
    if (!resolvedEmail) { toast.error("Veuillez saisir un destinataire"); return; }
    if (!subject.trim()) { toast.error("Veuillez saisir un objet"); return; }
    if (!body.trim()) { toast.error("Veuillez saisir un message"); return; }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-message", {
        body: { to_email: resolvedEmail, to_name: toName || undefined, subject, body },
      });
      if (error) throw new Error(error.message);
      if (data?.status === "sent") toast.success("Message envoyé");
      else if (data?.status === "no_sendgrid") toast.success("Message enregistré (SendGrid non configuré)");
      else toast.error("Erreur lors de l'envoi");
      setComposeOpen(false);
      resetCompose();
      await fetchMessages();
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    await (supabase as any).from("messages").delete().eq("id", id);
    setMessages(prev => prev.filter(m => m.id !== id));
    toast.success("Message supprimé");
  };

  const handleMarkRead = async (id: string) => {
    await (supabase as any).from("messages").update({ read: true }).eq("id", id);
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
  };

  const sent = messages.filter(m => !m.direction || m.direction === "outbound");
  const received = messages.filter(m => m.direction === "inbound");
  const unreadCount = received.filter(m => !m.read).length;

  const q = search.toLowerCase();
  const filteredSent = sent.filter(m =>
    m.to_email.toLowerCase().includes(q) ||
    (m.to_name ?? "").toLowerCase().includes(q) ||
    m.subject.toLowerCase().includes(q)
  );
  const filteredReceived = received.filter(m =>
    (m.from_client_name ?? "").toLowerCase().includes(q) ||
    m.subject.toLowerCase().includes(q) ||
    m.body.toLowerCase().includes(q)
  );

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-h1 font-display">Messagerie</h1>
          <p className="text-muted-foreground text-body mt-1">
            {sent.length} envoyé{sent.length !== 1 ? "s" : ""} · {received.length} reçu{received.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge gap-2">
          <Plus className="w-4 h-4" /> Nouveau message
        </Button>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 border-b animate-fade-up-1">
        <button
          onClick={() => setTab("sent")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "sent" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Send className="w-3.5 h-3.5" /> Envoyés ({sent.length})
        </button>
        <button
          onClick={() => setTab("received")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "received" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Reçus ({received.length})
          {unreadCount > 0 && (
            <span className="ml-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Recherche */}
      <div className="relative animate-fade-up-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === "sent" ? "Rechercher par destinataire ou objet…" : "Rechercher par client ou objet…"}
          className="pl-9"
        />
      </div>

      {/* ── Onglet Envoyés ── */}
      {tab === "sent" && (
        loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="forge-card flex gap-3">
                <div className="skeleton-shimmer w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-shimmer h-4 rounded w-1/2" />
                  <div className="skeleton-shimmer h-3 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredSent.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">{search ? "Aucun résultat" : "Aucun message envoyé"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Modifiez votre recherche" : "Cliquez sur « Nouveau message » pour envoyer votre premier email."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-up-2">
            {filteredSent.map(m => (
              <div key={m.id} className="forge-card flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
                  {(m.to_name ?? m.to_email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">{m.to_name || m.to_email}</p>
                      {m.to_name && <p className="text-xs text-muted-foreground">{m.to_email}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {statusBadge(m.status)}
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive" onClick={() => handleDelete(m.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-medium mt-1">{m.subject}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.body}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(m.sent_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    {m.document_type === "devis" && (
                      <Badge className="bg-blue-500/10 text-blue-600 text-[9px] h-4 px-1.5 flex items-center gap-0.5">
                        <FileText className="w-2.5 h-2.5" /> Devis
                      </Badge>
                    )}
                    {m.document_type === "facture" && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px] h-4 px-1.5 flex items-center gap-0.5">
                        <Receipt className="w-2.5 h-2.5" /> Facture
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Onglet Reçus ── */}
      {tab === "received" && (
        loading ? (
          <div className="space-y-3">
            {[1, 2].map(i => (
              <div key={i} className="forge-card flex gap-3">
                <div className="skeleton-shimmer w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-shimmer h-4 rounded w-1/2" />
                  <div className="skeleton-shimmer h-3 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredReceived.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">{search ? "Aucun résultat" : "Aucune réponse client"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? "Modifiez votre recherche" : "Les annotations et refus de vos clients apparaîtront ici."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 animate-fade-up-2">
            {filteredReceived.map(m => (
              <InboundMessageCard
                key={m.id}
                m={m}
                onDelete={handleDelete}
                onMarkRead={handleMarkRead}
              />
            ))}
          </div>
        )
      )}

      {/* Dialog composer */}
      <Dialog open={composeOpen} onOpenChange={(v) => { setComposeOpen(v); if (!v) resetCompose(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Nouveau message</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5 relative">
              <Label>Destinataire <span className="text-destructive">*</span></Label>
              <Input
                value={toInput}
                onChange={e => { setToInput(e.target.value); setToEmail(""); setToName(""); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Nom ou adresse email…"
                autoComplete="off"
              />
              {showSuggestions && recipientSuggestions.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
                  {recipientSuggestions.map(r => (
                    <button
                      key={r.email}
                      onMouseDown={() => selectRecipient(r)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-primary/5 text-left transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-xs">
                        {r.label[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.email}{r.sub ? ` — ${r.sub}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Sélectionnez un contact ou saisissez directement une adresse email</p>
            </div>

            <div className="space-y-1.5">
              <Label>Objet <span className="text-destructive">*</span></Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet du message…" />
            </div>

            <div className="space-y-1.5">
              <Label>Message <span className="text-destructive">*</span></Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Rédigez votre message ici…" rows={8} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setComposeOpen(false); resetCompose(); }}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending} className="bg-primary text-primary-foreground gap-2">
              <Send className="w-4 h-4" />
              {sending ? "Envoi en cours…" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
