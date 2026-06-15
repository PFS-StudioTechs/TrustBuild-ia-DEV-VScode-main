import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft, FileText, Palette, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const POPOVER_W = 340;
const POPOVER_H = 230;
const PAD = 10;

interface TourStep {
  target: string;
  title: string;
  description: string;
  gradient: string;
  TitleIcon: React.FC<{ className?: string }>;
}

const STEPS: TourStep[] = [
  {
    target: "#onboarding-nouveau-devis",
    title: "Devis & Factures",
    description:
      "Créez un devis en quelques secondes. Une fois signé par votre client, convertissez-le en facture d'un seul clic.",
    gradient: "from-cyan-500 to-blue-500",
    TitleIcon: ({ className }) => <FileText className={className} />,
  },
  {
    target: "#onboarding-alfred-bubble",
    title: "Votre assistant IA",
    description:
      "Alfred, Simone et Gustave sont là pour vous aider : rédiger un devis, répondre à une question juridique BTP ou vous conseiller sur le terrain. Disponibles à tout moment.",
    gradient: "from-blue-500 to-indigo-600",
    TitleIcon: ({ className }) => <Sparkles className={className} />,
  },
  {
    target: "#onboarding-parametres-nav",
    title: "Personnalisez vos documents",
    description:
      "Dans Paramètres → Mon Template, ajoutez votre logo, vos couleurs et votre texte d'en-tête. Vos devis et factures refléteront votre identité visuelle.",
    gradient: "from-violet-500 to-purple-600",
    TitleIcon: ({ className }) => <Palette className={className} />,
  },
];

function computePopoverPos(rect: DOMRect): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  if (vw - rect.right - PAD >= POPOVER_W + 16) {
    left = rect.right + PAD + 8;
    top = rect.top + rect.height / 2 - POPOVER_H / 2;
  } else if (rect.left - PAD >= POPOVER_W + 16) {
    left = rect.left - PAD - POPOVER_W - 8;
    top = rect.top + rect.height / 2 - POPOVER_H / 2;
  } else if (vh - rect.bottom - PAD >= POPOVER_H + 16) {
    top = rect.bottom + PAD + 8;
    left = rect.left + rect.width / 2 - POPOVER_W / 2;
  } else {
    top = rect.top - PAD - POPOVER_H - 8;
    left = rect.left + rect.width / 2 - POPOVER_W / 2;
  }

  return {
    top: Math.max(8, Math.min(top, vh - POPOVER_H - 8)),
    left: Math.max(8, Math.min(left, vw - POPOVER_W - 8)),
  };
}

interface TourOverlayProps {
  stepIndex: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

function TourOverlay({ stepIndex, total, onNext, onPrev, onClose }: TourOverlayProps) {
  const step = STEPS[stepIndex];
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    const update = () => {
      const el = document.querySelector(step.target);
      if (el) setRect(el.getBoundingClientRect());
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [step.target]);

  useEffect(() => {
    setAnimKey((k) => k + 1);
    const el = document.querySelector(step.target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [stepIndex, step.target]);

  const { TitleIcon, gradient, title, description } = step;

  const centered = !rect;
  const pos = rect
    ? computePopoverPos(rect)
    : {
        top: Math.round(window.innerHeight / 2 - POPOVER_H / 2),
        left: Math.round(window.innerWidth / 2 - POPOVER_W / 2),
      };

  return createPortal(
    <>
      {/* Backdrop clickable */}
      <div className="fixed inset-0 z-[9997]" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose} />

      {/* Spotlight — 4 panels (only when target found) */}
      {rect && (
        <div className="fixed inset-0 z-[9998] pointer-events-none">
          <div className="absolute inset-x-0 top-0 bg-black/65" style={{ height: Math.max(0, rect.top - PAD) }} />
          <div className="absolute inset-x-0 bottom-0 bg-black/65" style={{ top: rect.bottom + PAD }} />
          <div
            className="absolute left-0 bg-black/65"
            style={{ top: rect.top - PAD, height: rect.height + PAD * 2, width: Math.max(0, rect.left - PAD) }}
          />
          <div
            className="absolute right-0 bg-black/65"
            style={{ top: rect.top - PAD, height: rect.height + PAD * 2, left: rect.right + PAD }}
          />
          <div
            className="absolute rounded-xl"
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
              boxShadow: "0 0 0 2px rgba(255,255,255,0.2), 0 0 24px rgba(37,99,235,0.45)",
            }}
          />
        </div>
      )}

      {/* Popover card */}
      <div
        key={animKey}
        className="fixed z-[9999] animate-in fade-in zoom-in-95 duration-250"
        style={{ top: pos.top, left: pos.left, width: POPOVER_W, ...(centered ? { transform: "none" } : {}) }}
      >
        <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
          style={{ background: "linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)" }}
        >
          {/* accent bar */}
          <div className={`h-1 w-full bg-gradient-to-r ${gradient}`} />

          <div className="p-5">
            {/* header: avatar + title + close */}
            <div className="flex items-start gap-3 mb-3">
              <img
                src="/avatar-alfred.png"
                alt="Alfred"
                className="w-11 h-11 rounded-full object-cover ring-2 ring-white/15 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-flex p-1 rounded-md bg-gradient-to-br ${gradient}`}>
                      <TitleIcon className="w-3 h-3 text-white" />
                    </span>
                    <span className="text-sm font-bold text-white leading-tight">{title}</span>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white/25 hover:text-white/60 transition-colors shrink-0 ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-white/35 mt-0.5">Votre assistant TrustBuild</p>
              </div>
            </div>

            {/* description */}
            <p className="text-sm text-slate-300 leading-relaxed mb-4">{description}</p>

            {/* footer: dots + nav */}
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5 items-center">
                {Array.from({ length: total }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === stepIndex
                        ? `w-5 bg-gradient-to-r ${gradient}`
                        : i < stepIndex
                        ? "w-1.5 bg-white/40"
                        : "w-1.5 bg-white/15"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                {stepIndex > 0 && (
                  <button
                    onClick={onPrev}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Retour
                  </button>
                )}
                <button
                  onClick={stepIndex < total - 1 ? onNext : onClose}
                  className={`flex items-center gap-1 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r ${gradient} hover:opacity-90 transition-opacity shadow-lg`}
                >
                  {stepIndex < total - 1 ? (
                    <>
                      Suivant <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    "Commencer 🚀"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default function OnboardingTour() {
  const { user, profile, profileLoading } = useAuth();
  const ran = useRef(false);
  const markDoneAfterRef = useRef(true);
  const prefsRef = useRef<Record<string, unknown>>({});
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const closeTour = useCallback(async () => {
    setActive(false);
    if (markDoneAfterRef.current && user) {
      await supabase.from("artisan_settings").upsert(
        { user_id: user.id, preferences: { ...prefsRef.current, has_seen_onboarding: true } },
        { onConflict: "user_id" }
      );
    }
  }, [user]);

  const launchTour = useCallback((markDoneAfter = true, prefs: Record<string, unknown> = {}) => {
    markDoneAfterRef.current = markDoneAfter;
    prefsRef.current = prefs;
    ran.current = true;
    setStepIndex(0);
    setActive(true);
  }, []);

  // Première connexion
  useEffect(() => {
    if (profileLoading || !user || !profile || ran.current) return;
    const check = async () => {
      const { data } = await supabase
        .from("artisan_settings")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      const prefs = (data?.preferences ?? {}) as Record<string, unknown>;
      if (prefs.has_seen_onboarding) return;
      launchTour(true, prefs);
    };
    check();
  }, [user, profile, profileLoading, launchTour]);

  // Déclenchement manuel via event
  useEffect(() => {
    const handler = () => {
      ran.current = false;
      launchTour(false);
    };
    window.addEventListener("start-onboarding", handler);
    return () => window.removeEventListener("start-onboarding", handler);
  }, [launchTour]);

  if (!active) return null;

  return (
    <TourOverlay
      stepIndex={stepIndex}
      total={STEPS.length}
      onNext={() => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))}
      onPrev={() => setStepIndex((i) => Math.max(i - 1, 0))}
      onClose={closeTour}
    />
  );
}
