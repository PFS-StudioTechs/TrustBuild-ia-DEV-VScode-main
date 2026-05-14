import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, User, Save, CheckCircle, Mic, Smartphone, Monitor, FileDown, Headphones, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { streamChat } from "@/hooks/useStreamingChat";
import { useVoiceMode } from "@/hooks/useVoiceMode";
import { exportMarkdownToPdf } from "@/lib/exportToPdf";

interface Message {
  role: "user" | "assistant";
  content: string;
  source?: string;
}

interface AgentChatProps {
  persona: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  suggestions: string[];
  placeholder?: string;
}

export default function AgentChat({
  persona,
  title,
  subtitle,
  icon: Icon,
  iconColor,
  iconBg,
  suggestions,
  placeholder = "Posez votre question…",
}: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSendCancelledRef = useRef(false);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();
  const {
    voiceModeEnabled,
    setVoiceModeEnabled,
    isSpeaking,
    ttsStreamChunk,
    ttsFlushRemaining,
    ttsStop,
    resetTtsStream,
  } = useVoiceMode();

  useEffect(() => {
    return () => {
      if (autoSendTimerRef.current) clearTimeout(autoSendTimerRef.current);
      ttsStop();
    };
  }, [ttsStop]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`agent-${persona}-realtime`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `artisan_id=eq.${user.id}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (newMsg.source === "telegram" && newMsg.persona === persona) {
            setMessages((prev) => {
              const isDup = prev.some(
                (m) => m.content === newMsg.content && m.role === newMsg.role && m.source === "telegram"
              );
              if (isDup) return prev;
              return [...prev, { role: newMsg.role, content: newMsg.content, source: "telegram" }];
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, persona]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
    } catch {
      toast.error("Impossible d'accéder au microphone. Vérifiez les autorisations de votre navigateur.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: formData,
        }
      );
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      if (data.text) {
        setInput(data.text);
        if (voiceModeEnabled) {
          autoSendCancelledRef.current = false;
          toast.info("Envoi dans 1.5s…", {
            action: { label: "Annuler", onClick: () => { autoSendCancelledRef.current = true; } },
            duration: 1500,
          });
          autoSendTimerRef.current = setTimeout(() => {
            if (!autoSendCancelledRef.current) send(data.text);
          }, 1500);
        } else {
          toast.success("Transcription terminée — vérifiez et envoyez");
        }
      } else {
        toast.error("Aucun texte détecté");
      }
    } catch {
      toast.error("Erreur de transcription audio");
    } finally {
      setTranscribing(false);
    }
  };

  const toggleRecording = () => {
    recording ? stopRecording() : startRecording();
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim(), source: "app" };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    resetTtsStream();

    // Strip DEVIS_DATA blocks from history before sending to API (évite confusion Jarvis)
    const stripDevisData = (content: string) =>
      content.replace(/<!--DEVIS_DATA[\s\S]*?DEVIS_DATA-->/g, "").trim();

    // Capture voice mode state at call time to avoid stale closure in onChunk
    const voiceActive = voiceModeEnabled;

    let finalContent = "";
    try {
      await streamChat({
        body: {
          messages: updated.map((m) => ({ ...m, content: stripDevisData(m.content) })),
          persona,
        },
        onChunk: (accumulated) => {
          finalContent = accumulated;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: accumulated } : m
              );
            }
            return [...prev, { role: "assistant", content: accumulated, source: "app" }];
          });
          if (voiceActive) ttsStreamChunk(accumulated);
        },
      });

      // Flush remaining text, then auto-restart mic if still in voice mode
      if (voiceActive) {
        ttsFlushRemaining(finalContent, () => {
          if (voiceModeEnabled) startRecording();
        });
      }

      // Auto-création du devis si Jarvis a inclus un bloc DEVIS_DATA
      if (persona === "jarvis" && finalContent.includes("<!--DEVIS_DATA")) {
        await createDevisFromJarvis(finalContent);
        // Nettoie le DEVIS_DATA du message stocké pour les futurs échanges
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant"
              ? { ...m, content: stripDevisData(m.content) }
              : m
          )
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur");
      ttsStop();
    } finally {
      setLoading(false);
    }
  };

  const saveDocument = async (msgIndex: number) => {
    if (!user) return;
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "assistant") return;
    setSavingIdx(msgIndex);
    try {
      const now = new Date();
      const dateLabel = now.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
      const nom = `${title} — ${now.toLocaleDateString("fr-FR")}`;
      const contenu = cleanContent(msg.content);
      const question = msgIndex > 0 ? messages[msgIndex - 1]?.content ?? null : null;

      // Couleurs par persona
      const colors: Record<string, [string, string]> = {
        robert_b:  ["#1d4ed8", "#1e3a5f"],
        auguste_p: ["#ca8a04", "#78350f"],
      };
      const [primary, secondary] = colors[persona] ?? ["#374151", "#111827"];

      const html = buildConversationHtml({
        title,
        personaLabel: title,
        primaryColor: primary,
        secondaryColor: secondary,
        dateLabel,
        question,
        content: contenu,
      });

      const type_fichier = "autre";
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const safeName = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${user.id}/${Date.now()}-${safeName}.html`;

      const { error: uploadErr } = await supabase.storage
        .from("artisan-documents")
        .upload(storagePath, blob, { contentType: "text/html" });
      if (uploadErr) throw uploadErr;

      const { error: dbErr } = await supabase.from("documents").insert({
        artisan_id: user.id,
        nom,
        description: `Conversation avec ${title}`,
        type_fichier,
        taille_octets: blob.size,
        mime_type: "text/html",
        storage_path: storagePath,
        tags: [persona, "ia"],
      });
      if (dbErr) throw dbErr;

      toast.success("Conversation sauvegardée dans Mes Documents");
    } catch (e: any) {
      toast.error("Impossible de sauvegarder : " + (e.message || "erreur inconnue"));
    } finally {
      setSavingIdx(null);
    }
  };

  const exportToPdf = (msgIndex: number) => {
    const msg = messages[msgIndex];
    if (!msg || msg.role !== "assistant") return;
    const question = msgIndex > 0 ? messages[msgIndex - 1]?.content : null;
    exportMarkdownToPdf({
      title,
      question,
      content: cleanContent(msg.content),
      headerColor: [59, 130, 246],
      filename: `${title.replace(/[^a-z0-9]/gi, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const cleanContent = (content: string) =>
    content
      .replace(/<!--DEVIS_DATA[\s\S]*?DEVIS_DATA-->/g, "")
      .replace(/^\[(Robert B|Auguste P|Jarvis)\]\s*/i, "")
      .trim();

  // ── Création automatique du devis depuis le bloc DEVIS_DATA de Jarvis ────────
  const createDevisFromJarvis = async (rawContent: string) => {
    if (!user) return;
    const match = rawContent.match(/<!--DEVIS_DATA\s*([\s\S]*?)\s*DEVIS_DATA-->/);
    if (!match) return;
    let parsed: { client: any; chantier: any; lignes: any[] };
    try { parsed = JSON.parse(match[1]); } catch { return; }

    try {
      // 1. Client : toujours créer un nouveau client depuis les infos Jarvis
      // (pas de recherche par email — Jarvis peut mettre l'email artisan par erreur)
      const clientNom = (parsed.client?.nom || "Client").trim();
      const clientEmail = parsed.client?.email?.trim() || null;
      const { data: newClient, error: ce } = await (supabase as any)
        .from("clients")
        .insert({
          artisan_id: user.id,
          nom: clientNom,
          adresse: parsed.client?.adresse || null,
          email: clientEmail,
          telephone: parsed.client?.telephone || null,
          type: parsed.client?.type === "pro" ? "pro" : "particulier",
        })
        .select("id")
        .single();
      if (ce) throw ce;
      const clientId: string = newClient.id;

      // 2. Chantier
      const { data: newChantier, error: che } = await (supabase as any)
        .from("chantiers")
        .insert({
          artisan_id: user.id,
          client_id: clientId,
          nom: parsed.chantier?.nom || "Chantier",
          adresse_chantier: parsed.chantier?.adresse || null,
          date_debut: parsed.chantier?.date_debut || null,
          date_fin_prevue: parsed.chantier?.date_fin_prevue || null,
          statut: "prospect",
        })
        .select("id")
        .single();
      if (che) throw che;

      // 3. Devis
      const lignes: any[] = parsed.lignes ?? [];
      const montantHt = lignes.reduce(
        (s: number, l: any) => s + (Number(l.quantite) || 0) * (Number(l.prix_unitaire) || 0),
        0
      );
      const numero = `DEV-${Date.now().toString(36).toUpperCase()}`;
      const { data: newDevis, error: de } = await (supabase as any)
        .from("devis")
        .insert({
          artisan_id: user.id,
          chantier_id: newChantier.id,
          numero,
          montant_ht: montantHt,
          tva: 20,
          statut: "brouillon",
        })
        .select("id")
        .single();
      if (de) throw de;

      // 4. Lignes devis
      if (lignes.length > 0) {
        const { error: le } = await (supabase as any).from("lignes_devis").insert(
          lignes.map((l: any, i: number) => ({
            artisan_id: user.id,
            devis_id: newDevis.id,
            designation: l.description || l.designation || "",
            quantite: Number(l.quantite) || 1,
            unite: l.unite || "u",
            prix_unitaire: Number(l.prix_unitaire) || 0,
            tva: 20,
            ordre: i,
          }))
        );
        if (le) throw le;
      }

      toast.success(`Devis ${numero} créé avec ${lignes.length} ligne(s) — consultez l'onglet Documents`);
    } catch (e: any) {
      toast.error("Impossible de créer le devis : " + (e.message || "erreur inconnue"));
    }
  };

// ── Markdown → HTML (pour sauvegarde des conversations) ──────────────────────
function inlineFormat(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code>$1</code>");
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;
  let tableHeaderDone = false;
  let inBlockquote = false;

  const closeAll = () => {
    if (inUl)         { out.push("</ul>"); inUl = false; }
    if (inOl)         { out.push("</ol>"); inOl = false; }
    if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false; }
    if (inTable)      { out.push("</tbody></table>"); inTable = false; tableHeaderDone = false; }
  };

  for (const raw of lines) {
    const line = raw;

    // ── Table ──
    if (line.trim().startsWith("|")) {
      if (!inUl && !inOl && !inBlockquote && !inTable) {
        out.push('<table class="md-table">');
        inTable = true;
        tableHeaderDone = false;
      }
      if (/^\|[\s\-:|]+\|/.test(line.trim())) { // separator row
        out.push("<tbody>");
        tableHeaderDone = true;
        continue;
      }
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      if (!tableHeaderDone) {
        out.push("<thead><tr>" + cells.map(c => `<th>${inlineFormat(c)}</th>`).join("") + "</tr></thead>");
      } else {
        out.push("<tr>" + cells.map(c => `<td>${inlineFormat(c)}</td>`).join("") + "</tr>");
      }
      continue;
    } else if (inTable) {
      out.push("</tbody></table>"); inTable = false; tableHeaderDone = false;
    }

    // ── Empty line ──
    if (!line.trim()) {
      if (inUl)         { out.push("</ul>"); inUl = false; }
      if (inOl)         { out.push("</ol>"); inOl = false; }
      if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false; }
      out.push('<div class="md-space"></div>');
      continue;
    }

    // ── Headers ──
    if (line.startsWith("#### ")) { closeAll(); out.push(`<h4>${inlineFormat(line.slice(5))}</h4>`); continue; }
    if (line.startsWith("### "))  { closeAll(); out.push(`<h3>${inlineFormat(line.slice(4))}</h3>`); continue; }
    if (line.startsWith("## "))   { closeAll(); out.push(`<h2>${inlineFormat(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("# "))    { closeAll(); out.push(`<h1>${inlineFormat(line.slice(2))}</h1>`); continue; }

    // ── HR ──
    if (/^[-*_]{3,}\s*$/.test(line.trim())) { closeAll(); out.push("<hr>"); continue; }

    // ── Blockquote ──
    if (line.startsWith("> ")) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inBlockquote) { out.push("<blockquote>"); inBlockquote = true; }
      out.push(`<p>${inlineFormat(line.slice(2))}</p>`);
      continue;
    } else if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false; }

    // ── Unordered list ──
    if (/^[-*•]\s/.test(line)) {
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push("<ul>"); inUl = true; }
      out.push(`<li>${inlineFormat(line.replace(/^[-*•]\s/, ""))}</li>`);
      continue;
    } else if (inUl && /^\s{2,}[-*•]\s/.test(line)) {
      out.push(`<li>${inlineFormat(line.trim().replace(/^[-*•]\s/, ""))}</li>`);
      continue;
    } else if (inUl) { out.push("</ul>"); inUl = false; }

    // ── Ordered list ──
    if (/^\d+\.\s/.test(line)) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push("<ol>"); inOl = true; }
      out.push(`<li>${inlineFormat(line.replace(/^\d+\.\s/, ""))}</li>`);
      continue;
    } else if (inOl) { out.push("</ol>"); inOl = false; }

    // ── Paragraph ──
    out.push(`<p>${inlineFormat(line)}</p>`);
  }

  closeAll();
  return out.join("\n");
}

function buildConversationHtml(params: {
  title: string;
  personaLabel: string;
  primaryColor: string;
  secondaryColor: string;
  dateLabel: string;
  question: string | null;
  content: string;
}): string {
  const { title, personaLabel, primaryColor, secondaryColor, dateLabel, question, content } = params;
  const bodyHtml = markdownToHtml(content);

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — ${dateLabel}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, 'Helvetica Neue', sans-serif; background: #fff; color: #111827; font-size: 13px; }
    .page { max-width: 720px; margin: 0 auto; padding: 32px 40px; }
    .header { background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); border-radius: 10px; padding: 20px 24px; margin-bottom: 28px; }
    .header h1 { font-size: 18px; font-weight: 700; color: #fff; }
    .header p  { font-size: 11px; color: rgba(255,255,255,.75); margin-top: 4px; }
    .question-box { background: #f3f4f6; border-left: 3px solid ${primaryColor}; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #374151; }
    .question-label { font-size: 10px; font-weight: 700; color: ${primaryColor}; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
    .content { line-height: 1.7; }
    .content h1 { font-size: 18px; font-weight: 700; color: #111827; margin: 20px 0 10px; }
    .content h2 { font-size: 15px; font-weight: 700; color: #111827; margin: 18px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .content h3 { font-size: 13px; font-weight: 700; color: #374151; margin: 14px 0 6px; }
    .content h4 { font-size: 13px; font-weight: 600; color: #374151; margin: 10px 0 4px; }
    .content p { margin-bottom: 8px; color: #374151; }
    .content ul, .content ol { margin: 6px 0 10px 20px; }
    .content li { margin-bottom: 4px; color: #374151; }
    .content hr { border: none; border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .content strong { font-weight: 700; color: #111827; }
    .content em { font-style: italic; }
    .content code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 12px; }
    .content blockquote { border-left: 3px solid ${primaryColor}; padding: 8px 14px; background: #f9fafb; margin: 10px 0; border-radius: 0 6px 6px 0; color: #6b7280; }
    .content .md-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
    .content .md-table th { background: ${primaryColor}; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
    .content .md-table td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
    .content .md-table tr:nth-child(even) td { background: #f9fafb; }
    .content .md-space { height: 4px; }
    .footer { margin-top: 28px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #9ca3af; }
    .print-btn { margin-top: 20px; text-align: center; }
    .print-btn button { background: ${primaryColor}; color: #fff; border: none; border-radius: 8px; padding: 10px 28px; font-size: 13px; font-weight: 600; cursor: pointer; }
    @media print {
      .page { padding: 0; }
      .print-btn { display: none; }
      @page { margin: 14mm 16mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <h1>${title}</h1>
      <p>${personaLabel} &nbsp;·&nbsp; ${dateLabel}</p>
    </div>
    ${question ? `<div class="question-box"><div class="question-label">Votre question</div>${inlineFormat(question)}</div>` : ""}
    <div class="content">${bodyHtml}</div>
    <div class="footer">TrustBuild-IA — Document généré automatiquement</div>
    <div class="print-btn"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
  </div>
</body>
</html>`;
}

  const SourceBadge = ({ source }: { source?: string }) => {
    if (!source) return null;
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full mt-0.5">
        {source === "telegram" ? (
          <><Smartphone className="w-2.5 h-2.5" /> via Telegram</>
        ) : (
          <><Monitor className="w-2.5 h-2.5" /> via App</>
        )}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-up">
            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center", iconBg)}>
              <Icon className={cn("w-9 h-9", iconColor)} />
            </div>
            <div>
              <h2 className="text-h3 font-display">{title}</h2>
              <p className="text-body text-muted-foreground mt-1">{subtitle}</p>
            </div>
            <div className="space-y-2 w-full max-w-sm">
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} className="w-full text-left p-3 rounded-lg border text-sm hover:bg-primary-glow hover:border-primary/20 transition-all touch-target">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "")}>
            {msg.role === "assistant" && (
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", iconBg)}>
                  <Icon className={cn("w-4 h-4", iconColor)} />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium">{title.split("—")[0]?.trim()}</span>
              </div>
            )}
            <div className="flex flex-col gap-1.5 max-w-[80%]">
              <div className={cn("rounded-2xl px-4 py-3 text-sm", msg.role === "user" ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md shadow-forge" : "bg-card border rounded-bl-md shadow-forge")}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{cleanContent(msg.content)}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <SourceBadge source={msg.source} />
                {msg.role === "assistant" && !loading && (
                  <>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => saveDocument(i)} disabled={savingIdx === i}>
                      {savingIdx === i ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <Save className="w-3 h-3" />}
                      Sauvegarder
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={() => exportToPdf(i)}>
                      <FileDown className="w-3 h-3" />
                      PDF
                    </Button>
                  </>
                )}
              </div>
            </div>
            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {transcribing && (
          <div className="flex gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", iconBg)}>
              <Mic className={cn("w-4 h-4", iconColor)} />
            </div>
            <div className="border rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground">
              🎙 Transcription en cours...
            </div>
          </div>
        )}

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", iconBg)}>
              <Icon className={cn("w-4 h-4", iconColor)} />
            </div>
            <div className={cn("border rounded-2xl rounded-bl-md px-4 py-3", iconBg.replace("/10", "/5"))}>
              <div className="flex gap-1 items-center">
                <span className={cn("w-2 h-2 rounded-full animate-bounce", iconColor.replace("text-", "bg-"), "opacity-50")} style={{ animationDelay: "0ms" }} />
                <span className={cn("w-2 h-2 rounded-full animate-bounce", iconColor.replace("text-", "bg-"), "opacity-50")} style={{ animationDelay: "150ms" }} />
                <span className={cn("w-2 h-2 rounded-full animate-bounce", iconColor.replace("text-", "bg-"), "opacity-50")} style={{ animationDelay: "300ms" }} />
                <span className={cn("ml-1.5 font-mono text-xs animate-pulse", iconColor)}>|</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Voice mode banner */}
      {voiceModeEnabled && (
        <div className="px-4 py-1.5 bg-accent/10 border-t border-accent/20 text-xs text-accent flex items-center gap-2 shrink-0">
          <Headphones className="w-3 h-3 shrink-0" />
          <span>Mode mains-libres actif — parlez, Jarvis répondra à voix haute</span>
          {isSpeaking && (
            <span className="ml-auto flex items-center gap-1 animate-pulse font-medium">
              <VolumeX className="w-3 h-3" /> En train de parler…
            </span>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3 shrink-0 bg-card">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={transcribing ? "Transcription en cours..." : placeholder}
            className="touch-target"
            disabled={loading || transcribing}
          />
          {/* Stop TTS */}
          {isSpeaking && (
            <Button
              type="button"
              size="icon"
              variant="destructive"
              onClick={ttsStop}
              className="touch-target shrink-0 animate-pulse"
              title="Arrêter la lecture vocale"
            >
              <VolumeX className="w-4 h-4" />
            </Button>
          )}
          {/* Hands-free toggle */}
          <Button
            type="button"
            size="icon"
            variant={voiceModeEnabled ? "default" : "outline"}
            onClick={() => setVoiceModeEnabled(!voiceModeEnabled)}
            disabled={loading || transcribing}
            className="touch-target shrink-0 transition-all"
            title={voiceModeEnabled ? "Désactiver le mode mains-libres" : "Activer le mode mains-libres"}
          >
            <Headphones className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={toggleRecording}
            disabled={loading || transcribing}
            className={cn("touch-target shrink-0 transition-all", recording && "animate-pulse bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600")}
            title={recording ? "Arrêter l'enregistrement" : "Enregistrement vocal"}
          >
            <Mic className="w-4 h-4" />
          </Button>
          <Button type="submit" size="icon" disabled={!input.trim() || loading || transcribing} className="touch-target shrink-0 bg-gradient-to-r from-primary to-primary/90 shadow-forge">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
