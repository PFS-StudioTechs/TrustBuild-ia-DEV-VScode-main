import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

export default function KbisWarningBanner() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  if (!profile || profile.kbis_url || !profile.kbis_deadline) return null;

  const deadline = new Date(profile.kbis_deadline);
  const now = new Date();
  if (now >= deadline) return null;

  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 border-b border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 shrink-0">
      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
        Vous n'avez pas encore renseigné votre KBIS. Il vous reste{" "}
        <strong>{daysLeft} jour{daysLeft > 1 ? "s" : ""}</strong> pour le renseigner.
      </p>
      <button
        onClick={() => navigate("/mes-documents")}
        className="text-sm font-semibold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
      >
        Déposer mon KBIS →
      </button>
    </div>
  );
}
