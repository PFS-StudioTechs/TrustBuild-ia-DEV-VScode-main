import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, XCircle, Building2 } from "lucide-react";

export interface SiretResolvedData {
  nom: string;
  adresse: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onResolved?: (data: SiretResolvedData) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

type Status = "idle" | "loading" | "valid" | "invalid";

function luhnSiret(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = parseInt(siret[i], 10);
    // Double digits at even positions from left (0,2,4,...,12)
    // = odd positions from right in standard Luhn
    if (i % 2 === 0) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export default function SiretLookupField({
  value,
  onChange,
  onResolved,
  disabled,
  required,
  className,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const digits = value.replace(/\s/g, "");

    if (digits.length < 14) {
      setStatus("idle");
      setErrorMsg("");
      return;
    }

    if (!/^\d{14}$/.test(digits)) {
      setStatus("invalid");
      setErrorMsg("14 chiffres requis");
      return;
    }

    if (!luhnSiret(digits)) {
      setStatus("invalid");
      setErrorMsg("SIRET invalide (clé de contrôle incorrecte)");
      return;
    }

    // Abort previous pending request
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus("loading");
    setErrorMsg("");

    fetch(
      `https://recherche-entreprises.api.gouv.fr/search?q=${digits}&page=1&per_page=1`,
      { signal: ctrl.signal }
    )
      .then(r => {
        if (!r.ok) throw new Error("API indisponible");
        return r.json();
      })
      .then(json => {
        const result = json.results?.[0];
        // Vérifie que le SIRET du siège correspond bien
        const siretMatch =
          result?.siege?.siret === digits ||
          result?.matching_etablissements?.some((e: any) => e.siret === digits);

        if (!result || !siretMatch) {
          setStatus("invalid");
          setErrorMsg("SIRET non trouvé dans le registre");
          return;
        }

        setStatus("valid");

        if (onResolved) {
          const nom =
            result.nom_complet ||
            result.nom_raison_sociale ||
            result.siege?.nom_complet ||
            "";
          const adresse = result.siege?.adresse || "";
          onResolved({ nom, adresse });
        }
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setStatus("invalid");
        setErrorMsg("Impossible de vérifier (API indisponible)");
      });

    return () => ctrl.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const statusIcon = () => {
    if (status === "loading") return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
    if (status === "valid")   return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
    if (status === "invalid") return <XCircle className="w-4 h-4 text-destructive" />;
    return <Building2 className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          value={value}
          onChange={e => onChange(e.target.value.replace(/\D/g, "").slice(0, 14))}
          placeholder="12345678901234"
          maxLength={14}
          disabled={disabled}
          required={required}
          className={`pr-8 font-mono ${className ?? ""}`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {statusIcon()}
        </span>
      </div>
      {status === "invalid" && errorMsg && (
        <p className="text-xs text-destructive">{errorMsg}</p>
      )}
      {status === "valid" && (
        <p className="text-xs text-emerald-600">SIRET vérifié — informations préremplies</p>
      )}
    </div>
  );
}
