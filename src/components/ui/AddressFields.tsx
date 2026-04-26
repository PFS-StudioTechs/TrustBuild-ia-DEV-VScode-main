import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin, CheckCircle2 } from "lucide-react";

interface Parts {
  numero_voie: string;
  nom_voie: string;
  code_postal: string;
  ville: string;
}

interface BanFeature {
  properties: {
    label: string;
    housenumber?: string;
    street?: string;
    name?: string;
    postcode: string;
    city: string;
    score: number;
    type: string;
  };
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
  /** Auto-normalize the initial value via BAN API (useful when Jarvis provides a raw address) */
  autoNormalize?: boolean;
}

export default function AddressFields({ value, onChange, required, compact, autoNormalize }: AddressFieldsProps) {
  const lastEmitted = useRef<string>("");
  const autoNormalizeRan = useRef(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout>>();

  const [parts, setParts] = useState<Parts>(() => parseAddress(value));
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [suggestions, setSuggestions] = useState<BanFeature[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [banNormalized, setBanNormalized] = useState(false);

  // Re-parse only when the parent sets a new value that we didn't emit ourselves
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setParts(parseAddress(value));
      setCities([]);
    }
  }, [value]);

  // ── Auto-normalisation BAN au montage (adresse brute de Jarvis) ──────────
  useEffect(() => {
    if (!autoNormalize || !value || autoNormalizeRan.current) return;
    autoNormalizeRan.current = true;
    fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=1`)
      .then((r) => r.json())
      .then((json) => {
        const feat: BanFeature | undefined = json.features?.[0];
        if (feat && feat.properties.score > 0.5) {
          applyFeature(feat);
          setBanNormalized(true);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoNormalize]);

  const applyFeature = (feat: BanFeature) => {
    const p = feat.properties;
    const newParts: Parts = {
      numero_voie: p.housenumber ?? parts.numero_voie,
      nom_voie: p.street ?? p.name ?? parts.nom_voie,
      code_postal: p.postcode,
      ville: p.city,
    };
    setParts(newParts);
    const formatted = formatAddress(newParts);
    lastEmitted.current = formatted;
    onChange(formatted);
    setSuggestions([]);
    setShowSuggestions(false);
    setCities([]);
  };

  const update = (field: keyof Parts, val: string) => {
    const newParts = { ...parts, [field]: val };
    setParts(newParts);
    const formatted = formatAddress(newParts);
    lastEmitted.current = formatted;
    onChange(formatted);
    setBanNormalized(false);

    if (field === "code_postal") {
      setCities([]);
      if (val.length === 5 && /^\d{5}$/.test(val)) {
        fetchCities(val, newParts);
      }
    }
  };

  // ── Autocomplete BAN sur la voie ─────────────────────────────────────────
  const handleNomVoieChange = (val: string) => {
    update("nom_voie", val);
    clearTimeout(searchDebounce.current);
    if (val.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    setLoadingSuggestions(true);
    const q = [parts.numero_voie, val, parts.code_postal, parts.ville].filter(Boolean).join(" ");
    searchDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`
        );
        const json = await res.json();
        setSuggestions(json.features ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 350);
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
      {/* Badge normalisation BAN */}
      {banNormalized && (
        <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          Adresse normalisée via Base Adresse Nationale
        </div>
      )}

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
        <div className="col-span-2 relative">
          <Label className={labelCn}>Nom de la voie {required && <span className="text-destructive">*</span>}</Label>
          <div className="relative">
            <Input
              className={inputCn}
              value={parts.nom_voie}
              onChange={(e) => handleNomVoieChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Rue des Lilas"
              required={required}
            />
            {loadingSuggestions && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Dropdown suggestions BAN */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
              {suggestions.map((feat, i) => (
                <button
                  key={i}
                  type="button"
                  onMouseDown={() => applyFeature(feat)}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted transition-colors border-b last:border-0"
                >
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
                  <span className="truncate">{feat.properties.label}</span>
                </button>
              ))}
            </div>
          )}
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
