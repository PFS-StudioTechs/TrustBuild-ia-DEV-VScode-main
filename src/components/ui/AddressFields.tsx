import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Parts {
  numero_voie: string;
  nom_voie: string;
  code_postal: string;
  ville: string;
}

function parseAddress(value: string): Parts {
  if (!value) return { numero_voie: "", nom_voie: "", code_postal: "", ville: "" };
  const full = value.match(/^(\d+[a-zA-Z]?)\s+(.+?),\s*(\d{5})\s+(.+)$/);
  if (full) return { numero_voie: full[1], nom_voie: full[2], code_postal: full[3], ville: full[4] };
  const noCp = value.match(/^(.+?),\s*(\d{5})\s+(.+)$/);
  if (noCp) return { numero_voie: "", nom_voie: noCp[1], code_postal: noCp[2], ville: noCp[3] };
  return { numero_voie: "", nom_voie: value, code_postal: "", ville: "" };
}

function formatAddress(p: Parts): string {
  const voie = [p.numero_voie.trim(), p.nom_voie.trim()].filter(Boolean).join(" ");
  const loc = [p.code_postal.trim(), p.ville.trim()].filter(Boolean).join(" ");
  if (voie && loc) return `${voie}, ${loc}`;
  return [voie, loc].filter(Boolean).join(", ");
}

interface AddressFieldsProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Use smaller inputs (h-8 text-xs) for compact forms */
  compact?: boolean;
}

export default function AddressFields({ value, onChange, required, compact }: AddressFieldsProps) {
  const lastEmitted = useRef<string>("");
  const [parts, setParts] = useState<Parts>(() => parseAddress(value));
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // Re-parse only when the parent sets a new value that we didn't emit ourselves
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setParts(parseAddress(value));
      setCities([]);
    }
  }, [value]);

  const update = (field: keyof Parts, val: string) => {
    const newParts = { ...parts, [field]: val };
    setParts(newParts);
    const formatted = formatAddress(newParts);
    lastEmitted.current = formatted;
    onChange(formatted);

    if (field === "code_postal") {
      setCities([]);
      if (val.length === 5 && /^\d{5}$/.test(val)) {
        fetchCities(val, newParts);
      }
    }
  };

  const fetchCities = async (cp: string, currentParts: Parts) => {
    setLoadingCities(true);
    try {
      const res = await fetch(
        `https://geo.api.gouv.fr/communes?codePostal=${cp}&fields=nom&format=json`
      );
      const data: Array<{ nom: string }> = await res.json();
      if (data.length === 1) {
        const newParts = { ...currentParts, ville: data[0].nom };
        setParts(newParts);
        const formatted = formatAddress(newParts);
        lastEmitted.current = formatted;
        onChange(formatted);
        setCities([]);
      } else if (data.length > 1) {
        setCities(data.map((c) => c.nom));
        if (!currentParts.ville) {
          const newParts = { ...currentParts, ville: data[0].nom };
          setParts(newParts);
          const formatted = formatAddress(newParts);
          lastEmitted.current = formatted;
          onChange(formatted);
        }
      }
    } catch {
      // silently fail
    } finally {
      setLoadingCities(false);
    }
  };

  const inputCn = compact ? "h-8 text-xs" : "";
  const labelCn = compact ? "text-[10px]" : "text-sm";

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className={labelCn}>N° voie {required && <span className="text-destructive">*</span>}</Label>
          <Input
            className={inputCn}
            value={parts.numero_voie}
            onChange={(e) => update("numero_voie", e.target.value)}
            placeholder="12"
            required={required}
          />
        </div>
        <div className="col-span-2">
          <Label className={labelCn}>Nom de la voie {required && <span className="text-destructive">*</span>}</Label>
          <Input
            className={inputCn}
            value={parts.nom_voie}
            onChange={(e) => update("nom_voie", e.target.value)}
            placeholder="Rue des Lilas"
            required={required}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className={labelCn}>Code postal {required && <span className="text-destructive">*</span>}</Label>
          <div className="relative">
            <Input
              className={inputCn}
              value={parts.code_postal}
              onChange={(e) => update("code_postal", e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="75001"
              maxLength={5}
              required={required}
              pattern="\d{5}"
              title="Code postal à 5 chiffres"
            />
            {loadingCities && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        <div>
          <Label className={labelCn}>Ville {required && <span className="text-destructive">*</span>}</Label>
          {cities.length > 1 ? (
            <select
              className={`w-full rounded-md border border-input bg-background px-3 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? "h-8 text-xs" : "h-10 text-sm"}`}
              value={parts.ville}
              onChange={(e) => update("ville", e.target.value)}
              required={required}
            >
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          ) : (
            <Input
              className={inputCn}
              value={parts.ville}
              onChange={(e) => update("ville", e.target.value)}
              placeholder="Paris"
              required={required}
            />
          )}
        </div>
      </div>
    </div>
  );
}
