import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Mail, Clock, FileText, Send, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Message {
  id: string;
  artisan_id: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body: string;
  status: string;
  sent_at: string;
  direction: string;
  document_type: string | null;
  document_id: string | null;
  from_client_name: string | null;
  read: boolean;
}

function DocumentBadge({ type }: { type: string | null }) {
  if (type === "devis") return (
    <Badge className="bg-blue-500/10 text-blue-600 text-[9px] h-4 px-1.5 flex items-center gap-0.5">
      <FileText className="w-2.5 h-2.5" /> Devis
    </Badge>
  );
  if (type === "facture") return (
    <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px] h-4 px-1.5 flex items-center gap-0.5">
      <Receipt className="w-2.5 h-2.5" /> Facture
    </Badge>
  );
  if (type === "acompte") return (
    <Badge className="bg-purple-500/10 text-purple-600 text-[9px] h-4 px-1.5 flex items-center gap-0.5">
      <Receipt className="w-2.5 h-2.5" /> Acompte
    </Badge>
  );
  return null;
}

export default function MessagerieClient() {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [detailMsg, setDetailMsg] = useState<Message | null>(null);

  const { data: ctx } = useQuery({
    queryKey: ["client-messagerie-ctx"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: rows } = await supabase
        .from("clients")
        .select("id, artisan_id")
        .eq("auth_user_id", user.id);
      const linked = (rows ?? []).filter((c) => c.artisan_id != null);
      return {
        email: user.email ?? "",
        clientIds: linked.map((c) => c.id),
        artisanIds: linked.map((c) => c.artisan_id as string),
      };
    },
  });

  const { data: devisIds } = useQuery({
    queryKey: ["client-messagerie-devis-ids", ctx?.clientIds],
    enabled: !!ctx?.clientIds?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from("devis")
        .select("id")
        .in("client_id", ctx!.clientIds);
      return (data ?? []).map((d) => d.id);
    },
  });

  const { data: received = [] } = useQuery({
    queryKey: ["client-messages-received", ctx?.email, ctx?.artisanIds],
    enabled: !!ctx?.email && !!ctx?.artisanIds?.length,
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .in("artisan_id", ctx!.artisanIds)
        .eq("direction", "outbound")
        .eq("to_email", ctx!.email)
        .neq("status", "draft")
        .order("sent_at", { ascending: false });
      return (data ?? []) as Message[];
    },
  });

  const { data: sent = [] } = useQuery({
    queryKey: ["client-messages-sent", ctx?.artisanIds, devisIds],
    enabled: !!ctx?.artisanIds?.length && devisIds !== undefined,
    queryFn: async () => {
      if (!devisIds?.length) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .in("artisan_id", ctx!.artisanIds)
        .eq("direction", "inbound")
        .in("document_id", devisIds)
        .order("sent_at", { ascending: false });
      return (data ?? []) as Message[];
    },
  });

  if (!ctx?.artisanIds?.length) {
    return (
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <h1 className="text-h1 font-display font-bold">Messagerie</h1>
        <div className="forge-card text-center py-12 space-y-3">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="font-medium">En attente de liaison</p>
          <p className="text-sm text-muted-foreground">La messagerie sera accessible dès qu'un artisan sera lié à votre compte.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-h1 font-display font-bold">Messagerie</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {received.length} reçu{received.length !== 1 ? "s" : ""} · {sent.length} envoyé{sent.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("received")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "received" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Mail className="w-3.5 h-3.5" /> Reçus ({received.length})
        </button>
        <button
          onClick={() => setTab("sent")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${tab === "sent" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <Send className="w-3.5 h-3.5" /> Envoyés ({sent.length})
        </button>
      </div>

      {tab === "received" && (
        received.length === 0 ? (
          <div className="forge-card text-center py-12 space-y-3">
            <Mail className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Aucun message reçu</p>
            <p className="text-sm text-muted-foreground">Les messages de votre artisan apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {received.map((m) => (
              <div
                key={m.id}
                className="forge-card cursor-pointer hover:border-primary/30 transition-all"
                onClick={() => setDetailMsg(m)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-sm">
                    A
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Votre artisan</p>
                    <p className="text-sm font-medium mt-0.5">{m.subject}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.body}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(m.sent_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                      <DocumentBadge type={m.document_type} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {tab === "sent" && (
        sent.length === 0 ? (
          <div className="forge-card text-center py-12 space-y-3">
            <Send className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Aucun message envoyé</p>
            <p className="text-sm text-muted-foreground">Vos annotations et réponses sur les devis apparaîtront ici.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sent.map((m) => (
              <div
                key={m.id}
                className="forge-card cursor-pointer hover:border-primary/30 transition-all"
                onClick={() => setDetailMsg(m)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 text-amber-700 font-semibold text-sm">
                    {(m.from_client_name ?? "M")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Vous</p>
                    <p className="text-sm font-medium mt-0.5">{m.subject}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{m.body}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(m.sent_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                      <DocumentBadge type={m.document_type} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <Dialog open={!!detailMsg} onOpenChange={(v) => { if (!v) setDetailMsg(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {detailMsg && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-base leading-snug">{detailMsg.subject}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {detailMsg.direction === "inbound" ? "Envoyé par vous" : "De : votre artisan"}
                  </span>
                  <span>{new Date(detailMsg.sent_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                </div>
                {detailMsg.document_type && (
                  <div className="flex items-center gap-2">
                    <DocumentBadge type={detailMsg.document_type} />
                  </div>
                )}
                <div className="border rounded-lg p-3 bg-muted/30 whitespace-pre-wrap text-sm leading-relaxed">
                  {detailMsg.body}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
