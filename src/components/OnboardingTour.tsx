import { useEffect, useRef, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const STEPS = [
  {
    element: "#onboarding-nouveau-devis",
    popover: {
      title: "📄 Devis & Factures",
      description:
        "Créez un devis en quelques secondes. Une fois signé par votre client, convertissez-le en facture d'un seul clic.",
      side: "bottom" as const,
      align: "end" as const,
    },
  },
  {
    element: "#onboarding-alfred-bubble",
    popover: {
      title: "🤖 Votre assistant IA",
      description:
        "Alfred, Simone et Gustave sont là pour vous aider : rédiger un devis, répondre à une question juridique BTP ou vous conseiller sur le terrain. Disponibles à tout moment.",
      side: "left" as const,
      align: "center" as const,
    },
  },
  {
    element: "#onboarding-parametres-nav",
    popover: {
      title: "🎨 Personnalisez vos documents",
      description:
        "Dans Paramètres → Mon Template, ajoutez votre logo, vos couleurs et votre texte d'en-tête. Vos devis et factures refléteront votre identité visuelle.",
      side: "right" as const,
      align: "center" as const,
    },
  },
];

export default function OnboardingTour() {
  const { user, profile, profileLoading } = useAuth();
  const ran = useRef(false);

  const launchTour = useCallback((markDoneAfter = true, prefs: Record<string, unknown> = {}) => {
    ran.current = true;

    const markDone = async () => {
      if (!user || !markDoneAfter) return;
      await supabase.from("artisan_settings").upsert(
        { user_id: user.id, preferences: { ...prefs, has_seen_onboarding: true } },
        { onConflict: "user_id" }
      );
    };

    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: "rgba(0,0,0,0.55)",
      progressText: "{{current}} / {{total}}",
      nextBtnText: "Suivant →",
      prevBtnText: "← Précédent",
      doneBtnText: "Commencer !",
      popoverClass: "trustbuild-tour",
      onDestroyStarted: async () => {
        await markDone();
        driverObj.destroy();
      },
      steps: STEPS,
    });

    driverObj.drive();
  }, [user]);

  // Première connexion
  useEffect(() => {
    if (profileLoading || !user || !profile || ran.current) return;

    const checkAndLaunch = async () => {
      const { data } = await supabase
        .from("artisan_settings")
        .select("preferences")
        .eq("user_id", user.id)
        .maybeSingle();

      const prefs = (data?.preferences ?? {}) as Record<string, unknown>;
      if (prefs.has_seen_onboarding) return;

      launchTour(true, prefs);
    };

    checkAndLaunch();
  }, [user, profile, profileLoading, launchTour]);

  // Déclenchement manuel (ex: bouton "Relancer le tutoriel")
  useEffect(() => {
    const handler = () => {
      ran.current = false;
      launchTour(false);
    };
    window.addEventListener("start-onboarding", handler);
    return () => window.removeEventListener("start-onboarding", handler);
  }, [launchTour]);

  return null;
}
