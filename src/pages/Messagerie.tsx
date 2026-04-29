import { useState, useEffect, useCallback } from "react";
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
import { Mail, Plus, Send, Clock, CheckCircle2, AlertCircle, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Message {
  id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  status: string;
  sent_at: string;
}

interface Recipient {
  label: string;
  email: string;
  sub?: string;
}

function statusBadge(status: string) {
  if (status === "sent") return <Badge className="bg-emerald-500/10 text-emerald-600 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-1" />Envoyé</Badge>;
  if (status === "no_sendgrid") return <Badge className="bg-amber-500/10 text-amber-600 text-[10px]"><AlertCircle className="w-3 h-3 mr-1" />Sans clé SendGrid</Badge>;
  return <Badge className="bg-red-500/10 text-red-600 text-[10px]"><AlertCircle className="w-3 h-3 mr-1" />Erreur</Badge>;
}

export default function Messagerie() {
  const { user } = useAuth();
  const { contacts } = useContacts();
  const { fournisseurs } = useFournisseurs();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  // Compose form
  const [toInput, setToInput] = useState("");
  const [toEmail, setToEmail] = useState("");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientSuggestions, setRecipientSuggestions] = useState<Recipient[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Build recipient list from contacts + fournisseurs
  const allRecipients: Recipient[] = [
    ...contacts
      .filter(c => c.email)
      .map(c => ({
        label: [c.prenom, c.nom].filter(Boolean).join(" "),
        email: c.email!,
        sub: c.entreprise ?? c.role ?? undefined,
      })),
    ...fournisseurs
      .filter(f => f.email)
      .map(f => ({
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

  // Autocomplete suggestions
  useEffect(() => {
    if (!toInput.trim()) { setRecipientSuggestions([]); return; }
    const q = toInput.toLowerCase();
    const suggestions = allRecipients.filter(
      r => r.label.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    ).slice(0, 8);
    setRecipientSuggestions(suggestions);
  }, [toInput, contacts, fournisseurs]);

  const selectRecipient = (r: Recipient) => {
    setToInput(`${r.label} <${r.email}>`);
    setToEmail(r.email);
    setToName(r.label);
    setShowSuggestions(false);
  };

  const resetCompose = () => {
    setToInput(""); setToEmail(""); setToName(""); setSubject(""); setBody("");
  };

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

  const filtered = messages.filter(m => {
    const q = search.toLowerCase();
    return m.to_email.toLowerCase().includes(q) || (m.to_name ?? "").toLowerCase().includes(q) || m.subject.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-h1 font-display">Messagerie</h1>
          <p className="text-muted-foreground text-body mt-1">
            {messages.length} message{messages.length !== 1 ? "s" : ""} envoyé{messages.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)} className="touch-target bg-gradient-to-r from-primary to-primary/90 shadow-forge gap-2">
          <Plus className="w-4 h-4" /> Nouveau message
        </Button>
      </div>

      {/* Recherche */}
      <div className="relative animate-fade-up-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par destinataire ou objet…"
          className="pl-9"
        />
      </div>

      {/* Liste messages */}
      {loading ? (
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
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-up">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">
            {search ? "Aucun résultat" : "Aucun message envoyé"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {search ? "Modifiez votre recherche" : "Cliquez sur « Nouveau message » pour envoyer votre premier email."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-up-2">
          {filtered.map(m => (
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
                <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {new Date(m.sent_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog composer */}
      <Dialog open={composeOpen} onOpenChange={(v) => { setComposeOpen(v); if (!v) resetCompose(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Nouveau message</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Destinataire */}
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

            {/* Objet */}
            <div className="space-y-1.5">
              <Label>Objet <span className="text-destructive">*</span></Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet du message…" />
            </div>

            {/* Corps */}
            <div className="space-y-1.5">
              <Label>Message <span className="text-destructive">*</span></Label>
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Rédigez votre message ici…"
                rows={8}
              />
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
