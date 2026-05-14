import { useState, useRef, useCallback, useEffect } from "react";

const TTS_AVAILABLE =
  typeof window !== "undefined" && "speechSynthesis" in window;

function getFrenchVoice(): SpeechSynthesisVoice | null {
  if (!TTS_AVAILABLE) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(
      (v) => v.lang.startsWith("fr") && v.localService && !v.name.includes("Compact")
    ) ||
    voices.find((v) => v.lang.startsWith("fr")) ||
    null
  );
}

function cleanForTts(text: string): string {
  return text
    // Remove all IA data blocks
    .replace(/<!--\w+_DATA[\s\S]*?\w+_DATA-->/g, "")
    // Remove persona prefixes
    .replace(/^\[(Jarvis|Robert B|Auguste P)\]\s*/im, "")
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, "code omis,")
    .replace(/`[^`]+`/g, "")
    // Remove markdown headings
    .replace(/#{1,6}\s+/g, "")
    // Remove bold/italic
    .replace(/\*\*\*(.*?)\*\*\*/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    // Remove list markers
    .replace(/^[-*•]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    // Remove markdown links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove table rows
    .replace(/^\|.*\|$/gm, "")
    // Remove horizontal rules
    .replace(/^[-*_]{3,}\s*$/gm, "")
    // Collapse whitespace
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function useVoiceMode() {
  const [voiceModeEnabled, setVoiceModeEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const pendingRef = useRef(0);
  const spokenLengthRef = useRef(0);
  const onAllDoneRef = useRef<(() => void) | null>(null);

  // Load voices asynchronously (Chrome requires this)
  useEffect(() => {
    if (!TTS_AVAILABLE) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      window.speechSynthesis.getVoices();
    });
  }, []);

  const speakText = useCallback((text: string) => {
    if (!TTS_AVAILABLE) return;
    const cleaned = text.trim();
    if (!cleaned) return;

    const u = new SpeechSynthesisUtterance(cleaned);
    u.lang = "fr-FR";
    u.rate = 1.05;
    const voice = getFrenchVoice();
    if (voice) u.voice = voice;

    pendingRef.current += 1;
    setIsSpeaking(true);

    u.onend = () => {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (pendingRef.current === 0) {
        setIsSpeaking(false);
        const cb = onAllDoneRef.current;
        onAllDoneRef.current = null;
        cb?.();
      }
    };
    u.onerror = () => {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (pendingRef.current === 0) setIsSpeaking(false);
    };

    window.speechSynthesis.speak(u);
  }, []);

  const ttsStop = useCallback(() => {
    if (!TTS_AVAILABLE) return;
    window.speechSynthesis.cancel();
    pendingRef.current = 0;
    onAllDoneRef.current = null;
    setIsSpeaking(false);
  }, []);

  const resetTtsStream = useCallback(() => {
    spokenLengthRef.current = 0;
  }, []);

  // Called on each streaming chunk — speaks completed sentences immediately
  const ttsStreamChunk = useCallback(
    (accumulated: string) => {
      if (!TTS_AVAILABLE) return;
      const newText = accumulated.slice(spokenLengthRef.current);
      // Greedy: match everything up to the last sentence boundary followed by whitespace
      const match = newText.match(/^([\s\S]*[.!?…])\s/);
      if (!match) return;
      spokenLengthRef.current += match[0].length;
      const cleaned = cleanForTts(match[1]);
      if (cleaned) speakText(cleaned);
    },
    [speakText]
  );

  // Called after stream completes — speaks leftover text, then fires onDone
  const ttsFlushRemaining = useCallback(
    (accumulated: string, onDone?: () => void) => {
      if (!TTS_AVAILABLE) {
        onDone?.();
        return;
      }
      const remaining = accumulated.slice(spokenLengthRef.current).trim();
      spokenLengthRef.current = accumulated.length;

      if (onDone) onAllDoneRef.current = onDone;

      const cleaned = cleanForTts(remaining);
      if (cleaned) {
        speakText(cleaned);
      } else if (pendingRef.current === 0) {
        const cb = onAllDoneRef.current;
        onAllDoneRef.current = null;
        cb?.();
      }
    },
    [speakText]
  );

  // Stop TTS whenever voice mode is turned off
  useEffect(() => {
    if (!voiceModeEnabled) ttsStop();
  }, [voiceModeEnabled, ttsStop]);

  return {
    voiceModeEnabled,
    setVoiceModeEnabled,
    isSpeaking,
    ttsStreamChunk,
    ttsFlushRemaining,
    ttsStop,
    resetTtsStream,
  };
}
