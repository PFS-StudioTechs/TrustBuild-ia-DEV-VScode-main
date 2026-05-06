import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generateDevisPdfBytes, generateFacturePdfBytes, type LignePdf } from "@/lib/generatePdf";

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

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
  lignes?: LignePdf[];
  clientEmail: string | null;
  clientNom: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

export interface SendEmailDialogFactureProps {
  type: "facture";
  doc: BaseDoc & { date_echeance: string; solde_restant: number; chantierNom?: string };
  lignes?: LignePdf[];
  clientEmail: string | null;
  clientNom: string;
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

type Props = SendEmailDialogDevisProps | SendEmailDialogFactureProps;

export default function SendEmailDialog(props: Props) {
  const { type, doc, lignes, clientEmail, clientNom, open, onClose, onSent } = props;
  const { user } = useAuth();

  const [toEmail, setToEmail] = useState(clientEmail ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [artisanNom, setArtisanNom] = useState("");

  const montantTTC = doc.montant_ht * (1 + doc.tva / 100);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("profiles").select("prenom, nom").eq("user_id", user.id).single().then(({ data }) => {
      const nom = data ? `${data.prenom ?? ""} ${data.nom ?? ""}`.trim() : "";
      setArtisanNom(nom);
    });
  }, [open, user]);

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

    const bodyText = type === "devis"
      ? `${greeting}\n\nVeuillez trouver ci-joint le devis ${doc.numero} d'un montant de ${montantLabel} TTC.${dateInfo}\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,\n${artisanNom || "L'artisan"}`
      : `${greeting}\n\nVeuillez trouver ci-joint la facture ${doc.numero} d'un montant de ${montantLabel} TTC.${dateInfo}\n\nN'hésitez pas à me contacter pour toute question.\n\nCordialement,\n${artisanNom || "L'artisan"}`;

    setBody(bodyText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, artisanNom]);

  const handleSend = async () => {
    if (!toEmail.trim()) { toast.error("Adresse email requise"); return; }
    if (!subject.trim()) { toast.error("Objet requis"); return; }
    if (!body.trim()) { toast.error("Corps du message requis"); return; }

    setSending(true);
    try {
      // Génère le PDF
      let pdfBytes: Uint8Array;
      const pdfFilename = `${doc.numero}.pdf`;

      if (type === "devis") {
        pdfBytes = generateDevisPdfBytes({
          numero: doc.numero,
          montant_ht: doc.montant_ht,
          tva: doc.tva,
          statut: "devis",
          created_at: doc.created_at,
          date_validite: (props as SendEmailDialogDevisProps).doc.date_validite,
          clientNom,
          chantierNom: (props as SendEmailDialogDevisProps).doc.chantierNom,
          lignes,
        });
      } else {
        const fDoc = (props as SendEmailDialogFactureProps).doc;
        pdfBytes = generateFacturePdfBytes({
          numero: doc.numero,
          montant_ht: doc.montant_ht,
          tva: doc.tva,
          statut: "facture",
          created_at: doc.created_at,
          date_echeance: fDoc.date_echeance,
          solde_restant: fDoc.solde_restant,
          clientNom,
          chantierNom: fDoc.chantierNom,
          lignes,
        });
      }

      const pdf_base64 = uint8ToBase64(pdfBytes);

      // Envoie via Edge Function
      const { data, error } = await supabase.functions.invoke("send-message", {
        body: {
          to_email: toEmail.trim(),
          to_name: clientNom || undefined,
          subject,
          body,
          pdf_base64,
          pdf_filename: pdfFilename,
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
      } else if (data?.status === "no_sendgrid") {
        toast.success(`${label} enregistré — SendGrid non configuré`);
      } else {
        toast.error("Erreur lors de l'envoi");
      }

      onClose();
      onSent();
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
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
            Le PDF du {type === "devis" ? "devis" : "la facture"} sera joint automatiquement.
            {type === "devis" ? " Le devis passera au statut « Envoyé »." : " La facture passera au statut « Envoyée »."}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Annuler</Button>
          <Button onClick={handleSend} disabled={sending} className="bg-primary text-primary-foreground gap-2">
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…</>
              : <><Send className="w-4 h-4" /> Envoyer avec PDF</>
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
