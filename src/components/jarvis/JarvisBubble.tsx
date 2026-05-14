import { useState, useRef, useCallback, useEffect } from "react";
import { Bot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import JarvisPanel from "./JarvisPanel";

const STORAGE_KEY = "jarvis-bubble-pos";

function getInitialPos(): { x: number; y: number } | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

export default function JarvisBubble() {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(getInitialPos);
  const dragOffset = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const bubbleRef = useRef<HTMLButtonElement>(null);

  const BUBBLE_SIZE = 56;

  const clamp = useCallback((x: number, y: number) => {
    const maxX = window.innerWidth - BUBBLE_SIZE;
    const maxY = window.innerHeight - BUBBLE_SIZE;
    return { x: Math.max(0, Math.min(x, maxX)), y: Math.max(0, Math.min(y, maxY)) };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (open) return;
    hasMoved.current = false;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [open]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    hasMoved.current = true;
    const newPos = clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y);
    setPos(newPos);
  }, [dragging, clamp]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (pos) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    if (!hasMoved.current) {
      setOpen(true);
    }
  }, [dragging, pos]);

  // Panel position follows bubble
  const panelStyle = pos
    ? {
        bottom: `${window.innerHeight - pos.y}px`,
        right: `${window.innerWidth - pos.x}px`,
      }
    : undefined;

  const bubbleStyle = pos
    ? { left: `${pos.x}px`, top: `${pos.y}px`, right: "auto", bottom: "auto" }
    : {};

  return (
    <>
      {/* Chat Panel */}
      <div
        className={cn(
          "fixed z-50 rounded-2xl shadow-2xl border bg-card overflow-hidden transition-all duration-300 origin-bottom-right",
          "w-[calc(100vw-2rem)] md:w-[420px] h-[80vh] md:h-[600px] max-h-[90vh]",
          open ? "scale-100 opacity-100 pointer-events-auto" : "scale-90 opacity-0 pointer-events-none",
          !pos && "bottom-20 right-4 md:bottom-6 md:right-6"
        )}
        style={pos ? (
          window.innerWidth < 768
            ? { left: "1rem", right: "1rem", width: "auto", top: "5vh", bottom: "auto" }
            : {
                left: Math.max(8, Math.min(pos.x, window.innerWidth - 440)) + "px",
                top: Math.max(8, pos.y - 620) + "px",
                right: "auto",
                bottom: "auto",
              }
        ) : undefined}
      >
        {open && <JarvisPanel onClose={() => setOpen(false)} />}
      </div>

      {/* Floating Bubble */}
      <button
        ref={bubbleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={bubbleStyle}
        className={cn(
          "fixed z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-opacity duration-300 touch-none select-none",
          open
            ? "bg-muted text-muted-foreground scale-0 opacity-0 pointer-events-none"
            : "bg-gradient-to-br from-primary to-accent text-primary-foreground scale-100 opacity-100 animate-cta-pulse",
          !pos && "bottom-20 right-4 md:bottom-6 md:right-6",
          dragging && "cursor-grabbing"
        )}
        aria-label="Ouvrir Jarvis"
      >
        <Bot className="w-6 h-6 pointer-events-none" />
      </button>
    </>
  );
}
