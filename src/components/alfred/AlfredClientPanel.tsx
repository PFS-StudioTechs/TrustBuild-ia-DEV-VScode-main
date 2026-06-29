import { useState, useRef, useEffect } from "react";
import { X, Send, Plus, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Phase = "loading" | "picking" | "chat";
type Message = { role: "user" | "assistant"; content: string };
type Projet = { id: string; libelle: string; statut: string };

function Header({ projetLibelle, onClose }: { projetLibelle: string; onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b bg-secondary/50 shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full overflow-hidden">
          <img src="/avatar-alfred.png" alt="Alfred" className="w-full h-full object-cover" />
        </div>
        <div>
          <h3 className="font-display font-bold text-sm">Alfred</h3>
          <p className="text-[11px] text-muted-foreground">{projetLibelle || "Cadrage de projet"}</p>
        </div>
      </div>
      {onClose && (
        <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8">
          <X className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}

const Dots = () => (
  <div className="flex gap-1 items-center">
    {[0, 150, 300].map((d) => (
      <span key={d} className="w-1.5 h-1.5 bg-accent/50 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
    ))}
  </div>
);

export default function AlfredClientPanel({ onClose }: { onClose?: () => void }) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [projets, setProjets] = useState<Projet[]>([]);
  const [projetId, setProjetId] = useState<string | null>(null);
  const [projetLibelle, setProjetLibelle] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newProjetName, setNewProjetName] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    if (!user) return;
    loadProjets();
  }, [user]);

  const loadProjets = async () => {
    const { data, error } = await supabase
      .from("client_projets")
      .select("id, libelle, statut")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erreur chargement projets");
      return;
    }

    const list = (data ?? []) as Projet[];
    if (list.length === 0) {
      await createAndStart("Mon projet");
    } else {
      setProjets(list);
      setPhase("picking");
    }
  };

  const createAndStart = async (libelle: string) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("client_projets")
      .insert({ auth_user_id: user.id, libelle })
      .select("id, libelle, statut")
      .single();

    if (error || !data) {
      toast.error("Impossible de créer le projet");
      return;
    }

    const p = data as Projet;
    startChat(p.id, p.libelle);
  };

  const startChat = (id: string, libelle: string) => {
    setProjetId(id);
    setProjetLibelle(libelle);
    const stored = sessionStorage.getItem(`alfred_chat_${id}`);
    setMessages(stored ? (JSON.parse(stored) as Message[]) : []);
    setPhase("chat");
  };

  useEffect(() => {
    if (!projetId || messages.length === 0) return;
    sessionStorage.setItem(`alfred_chat_${projetId}`, JSON.stringify(messages));
  }, [messages, projetId]);

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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-audio`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      if (data.text) {
        setInput(data.text);
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

  const handleCreateNew = () => {
    if (!newProjetName.trim()) return;
    setCreatingNew(false);
    createAndStart(newProjetName.trim());
  };

  const send = async (text: string) => {
    if (!text.trim() || loading || !projetId) return;
    setMessages((prev) => [...prev, { role: "user", content: text.trim() }]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("alfred-client-cadrage", {
        body: {
          action: "dialoguer",
          projet_id: projetId,
          message_client: text.trim(),
          historique: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;
      if (!data?.reponse_alfred) throw new Error("Réponse vide");

      setMessages((prev) => [...prev, { role: "assistant", content: data.reponse_alfred }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="flex flex-col h-full">
        <Header projetLibelle="" onClose={onClose} />
        <div className="flex-1 flex items-center justify-center">
          <Dots />
        </div>
      </div>
    );
  }

  if (phase === "picking") {
    return (
      <div className="flex flex-col h-full">
        <Header projetLibelle="" onClose={onClose} />
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Voulez-vous rattacher votre demande à un projet existant ?
          </p>
          <div className="space-y-2">
            {projets.map((p) => (
              <button
                key={p.id}
                onClick={() => startChat(p.id, p.libelle)}
                className="w-full text-left p-3 rounded-lg border text-xs hover:bg-primary-glow hover:border-primary/20 transition-all"
              >
                <span className="font-medium">{p.libelle}</span>
                <span className="ml-2 text-muted-foreground">· {p.statut}</span>
              </button>
            ))}
          </div>
          {!creatingNew ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={() => { setCreatingNew(true); setNewProjetName(""); }}
            >
              <Plus className="w-3.5 h-3.5" />
              Nouveau projet
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <input
                autoFocus
                type="text"
                value={newProjetName}
                onChange={(e) => setNewProjetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateNew();
                  if (e.key === "Escape") setCreatingNew(false);
                }}
                placeholder="Nom du projet…"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button size="sm" onClick={handleCreateNew} disabled={!newProjetName.trim()}>
                Créer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setCreatingNew(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header projetLibelle={projetLibelle} onClose={onClose} />

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 animate-fade-up">
            <div className="w-12 h-12 rounded-2xl overflow-hidden">
              <img src="/avatar-alfred.png" alt="Alfred" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="font-display font-bold text-sm">Bonjour, je suis Alfred</p>
              <p className="text-xs text-muted-foreground mt-1">
                Décrivez-moi votre projet de travaux, je vous aide à le définir.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
                <img src="/avatar-alfred.png" alt="Alfred" className="w-full h-full object-cover" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-sm"
                : "bg-card border rounded-bl-sm"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full overflow-hidden shrink-0">
              <img src="/avatar-alfred.png" alt="Alfred" className="w-full h-full object-cover" />
            </div>
            <div className="bg-accent/5 border border-accent/20 rounded-xl rounded-bl-sm px-3 py-2">
              <Dots />
            </div>
          </div>
        )}
      </div>

      <div className="border-t shrink-0 bg-card">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex gap-2 p-2 items-end"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={transcribing ? "Transcription en cours..." : "Décrivez votre projet…"}
            rows={1}
            className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: "40px" }}
            disabled={loading || transcribing}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={toggleRecording}
            disabled={loading || transcribing}
            className={`h-10 w-10 shrink-0 transition-all${recording ? " animate-pulse bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600" : ""}`}
            title={recording ? "Arrêter l'enregistrement" : "Enregistrement vocal"}
          >
            <Mic className="w-3.5 h-3.5" />
          </Button>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || loading || transcribing}
            className="h-10 w-10 shrink-0 bg-gradient-to-r from-primary to-accent"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
