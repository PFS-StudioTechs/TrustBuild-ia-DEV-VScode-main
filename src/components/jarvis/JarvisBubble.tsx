import { useState, useRef, useCallback } from "react";
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
        className={cn(
          "fixed z-50 w-16 h-16 flex items-center justify-center transition-all duration-300 touch-none select-none bg-transparent border-none outline-none",
          open
            ? "scale-0 opacity-0 pointer-events-none"
            : "scale-100 opacity-100",
          !pos && "bottom-20 right-4 md:bottom-6 md:right-6",
          dragging && "cursor-grabbing"
        )}
        style={{
          ...bubbleStyle,
          filter: open ? undefined : "drop-shadow(0 0 10px rgba(194, 65, 12, 0.75)) drop-shadow(0 0 4px rgba(249, 115, 22, 0.5))",
        }}
        aria-label="Ouvrir Jarvis"
      >
        <img
          src="/jarvis-eye.jpeg"
          alt="Jarvis"
          className="w-full h-full object-contain pointer-events-none select-none mix-blend-multiply"
          draggable={false}
        />
      </button>
    </>
  );
}
