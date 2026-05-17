import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLog } from "@/hooks/useLog";
import { toast } from "sonner";

interface BaseDoc {
  id: string;
  numero: string;
  montant_ht: number;
  tva: number;
  created_at: string;
}

export interface SendEmailDialogDevisProps {
  type: "devis";
  doc: BaseDoc & { date_validite?: string | null; chantierNom?: string };
  clientEmail: string | null;
  clientNom: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export interface SendEmailDialogFactureProps {
  type: "facture";
  doc: BaseDoc & { date_echeance: string; solde_restant: number; chantierNom?: string };
  clientEmail: string | null;
  clientNom: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

type Props = SendEmailDialogDevisProps | SendEmailDialogFactureProps;

export default function SendEmailDialog(props: Props) {
  const { type, doc, clientEmail, clientNom, open, onClose, onSent } = props;
  const { user } = useAuth();
  const { log } = useLog();

  const [toEmail, setToEmail] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [artisanNom, setArtisanNom] = useState("");
  const [tokenPublic, setTokenPublic] = useState<string | null>(null);

  const montantTTC = doc.montant_ht * (1 + doc.tva / 100);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("profiles").select("prenom, nom").eq("user_id", user.id).single().then(({ data }) => {
      const nom = data ? `${data.prenom ?? ""} ${data.nom ?? ""}`.trim() : "";
      setArtisanNom(nom);
    });
    if (type === "devis") {
      (supabase.from("devis" as any).select("token_public").eq("id", doc.id).single() as any)
        .then(({ data }: any) => setTokenPublic(data?.token_public ?? null));
    }
  }, [open, user, type, doc.id]);

  useEffect(() => {
    if (!open) return;
    setToEmail(clientEmail ?? "");

    const docLabel = type === "devis" ? "Devis" : "Facture";
    const montantLabel = montantTTC.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

    setSubject(`${docLabel} ${doc.numero} — ${montantLabel} TTC`);

    const dateInfo = type === "devis"
      ? (props as SendEmailDialogDevisProps).doc.date_validite
        ? `\nCe devis est valable jusqu'au ${new Date((props as SendEmailDialogDevisProps).doc.date_validite!).toLocaleDateString("fr-FR")}.`
        : ""
      : `\nDate d'échéance : ${new Date((props as SendEmailDialogFactureProps).doc.date_echeance).toLocaleDateString("fr-FR")}.`;

    const greeting = clientNom ? `Bonjour ${clientNom},` : "Bonjour,";

    const publicLink = type === "devis" && tokenPublic
      ? `\n\n👉 Consulter, annoter et signer votre devis en ligne :\n${window.location.origin}/devis/view/${tokenPublic}`
      : "";

    const bodyText = type === "devis"
      ? `${greeting}\n\nVeuillez trouver ci-dessous le devis ${doc.numero} d'un montant de ${montantLabel} TTC.${dateInfo}${publicLink}\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,\n${artisanNom || "L'artisan"}`
      : `${greeting}\n\nVeuillez trouver ci-dessous la facture ${doc.numero} d'un montant de ${montantLabel} TTC.${dateInfo}\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,\n${artisanNom || "L'artisan"}`;

    setBody(bodyText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, artisanNom]);

  const handleSend = async () => {
    if (!toEmail.trim()) { toast.error("Adresse email requise"); return; }
    if (!subject.trim()) { toast.error("Objet requis"); return; }
    if (!body.trim()) { toast.error("Corps du message requis"); return; }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-message", {
        body: {
          to_email: toEmail.trim(),
          to_name: clientNom || undefined,
          subject,
          body,
          document_type: type,
          document_id: doc.id,
        },
      });

      if (error) throw new Error(error.message);

      // Met à jour le statut du document
      if (type === "devis") {
        await supabase.from("devis").update({ statut: "envoye" } as any).eq("id", doc.id);
      } else {
        await supabase.from("factures").update({ statut: "envoyee" } as any).eq("id", doc.id);
      }

      const label = type === "devis" ? "Devis" : "Facture";
      if (data?.status === "sent") {
        toast.success(`${label} ${doc.numero} envoyé${type === "facture" ? "e" : ""} à ${toEmail}`);
        log({ action: 'email.sent', entity_type: type, entity_id: doc.id, status: 'success', details: { to: toEmail, subject, numero: doc.numero } });
      } else if (data?.status === "no_sendgrid") {
        toast.success(`${label} enregistré — SendGrid non configuré`);
        log({ action: 'email.no_sendgrid', entity_type: type, entity_id: doc.id, status: 'info', details: { to: toEmail, numero: doc.numero } });
      } else {
        toast.error("Erreur lors de l'envoi");
        log({ action: 'email.send_failed', entity_type: type, entity_id: doc.id, status: 'error', details: { to: toEmail, numero: doc.numero, response: data } });
      }

      onClose();
      onSent();
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
      log({ action: 'email.send_failed', entity_type: type, entity_id: doc.id, status: 'error', details: { to: toEmail, numero: doc.numero, error: err.message } });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Envoyer {type === "devis" ? "le devis" : "la facture"} {doc.numero}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Destinataire <span className="text-destructive">*</span></Label>
            <Input
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              placeholder="email@client.fr"
              type="email"
            />
            {!clientEmail && (
              <p className="text-xs text-amber-600">Ce client n'a pas d'email enregistré — saisissez-en un manuellement.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Objet <span className="text-destructive">*</span></Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Message <span className="text-destructive">*</span></Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={9} className="text-sm font-mono" />
          </div>

          <p className="text-xs text-muted-foreground">
            Le {type === "devis" ? "devis" : "la facture"} sera intégré{type === "facture" ? "e" : ""} dans l'email avec le même rendu que dans l'application.
            {type === "devis" ? " Le devis passera au statut « Envoyé »." : " La facture passera au statut « Envoyée »."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
          <Button onClick={handleSend} disabled={sending} className="bg-primary text-primary-foreground gap-2">
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
              : <><Send className="w-4 h-4" /> Envoyer</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
