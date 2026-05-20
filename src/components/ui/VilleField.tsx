import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

interface Commune {
  nom: string;
  codesPostaux: string[];
}

interface VilleFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  compact?: boolean;
  placeholder?: string;
}

export default function VilleField({ value, onChange, required, compact, placeholder = "Paris" }: VilleFieldProps) {
  const [suggestions, setSuggestions] = useState<Commune[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const handleChange = (val: string) => {
    onChange(val);
    clearTimeout(debounce.current);
    if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(val)}&fields=nom,codesPostaux&boost=population&limit=6`
        );
        const data: Commune[] = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const select = (c: Commune) => {
    onChange(c.nom);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const inputCn = compact ? "h-8 text-xs" : "";

  return (
    <div className="relative">
      <div className="relative">
        <Input
          className={inputCn}
          value={value}
          onChange={e => handleChange(e.target.value)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          required={required}
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((c, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => select(c)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left text-xs hover:bg-muted transition-colors border-b last:border-0"
            >
              <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-primary" />
              <span className="truncate">{c.nom}{c.codesPostaux[0] ? ` (${c.codesPostaux[0]})` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
