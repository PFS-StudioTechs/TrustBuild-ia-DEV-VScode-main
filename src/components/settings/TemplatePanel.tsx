import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Palette, Upload, CheckCircle2, Loader2, FileText,
  Wrench, Zap, Brush, Trees, Building2, HardHat,
  Leaf, Waves, Layers, Home, Mountain,
} from "lucide-react";
import { toast } from "sonner";

// ─── Sectoral templates ───────────────────────────────────────────────────────
const SECTORS = [
  { id: "plomberie",    label: "Plomberie",             icon: Wrench,    primary: "#1d4ed8", secondary: "#1e3a5f", accent: "#0ea5e9" },
  { id: "electricite",  label: "Électricité",            icon: Zap,       primary: "#ca8a04", secondary: "#78350f", accent: "#facc15" },
  { id: "architecture", label: "Architecture",           icon: Building2, primary: "#374151", secondary: "#111827", accent: "#6366f1" },
  { id: "peinture",     label: "Peinture & Revêtements", icon: Brush,     primary: "#7c3aed", secondary: "#4c1d95", accent: "#f472b6" },
  { id: "menuiserie",   label: "Menuiserie",             icon: Trees,     primary: "#92400e", secondary: "#451a03", accent: "#f59e0b" },
  { id: "general",      label: "BTP Général",            icon: HardHat,   primary: "#2563eb", secondary: "#1e40af", accent: "#f59e0b" },
  { id: "jardinage",    label: "Jardinier / Paysagiste", icon: Leaf,      primary: "#16a34a", secondary: "#14532d", accent: "#86efac" },
  { id: "pisciniste",   label: "Pisciniste",             icon: Waves,     primary: "#0891b2", secondary: "#164e63", accent: "#67e8f9" },
  { id: "platrerie",    label: "Plâtrier",               icon: Layers,    primary: "#6b7280", secondary: "#374151", accent: "#d1d5db" },
  { id: "charpente",    label: "Charpentier / Couvreur", icon: Home,      primary: "#b45309", secondary: "#7c2d12", accent: "#fb923c" },
  { id: "maconnerie",   label: "Maçonnerie",             icon: Mountain,  primary: "#4b5563", secondary: "#1f2937", accent: "#9ca3af" },
];

interface Template {
  id: string;
  secteur: string;
  nom: string;
  couleur_primaire: string;
  couleur_secondaire: string;
  couleur_accent: string;
  logo_url: string | null;
  entete_texte: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
}

export default function TemplatePanel() {
  const { user } = useAuth();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form state
  const [couleurPrimaire, setCouleurPrimaire]    = useState("#2563eb");
  const [couleurSecondaire, setCouleurSecondaire] = useState("#1e40af");
  const [couleurAccent, setCouleurAccent]         = useState("#f59e0b");
  const [logoUrl, setLogoUrl]                     = useState<string | null>(null);
  const [selectedSector, setSelectedSector]       = useState<string | null>(null);

  const [enteteTexte, setEnteteTexte] = useState("");

  const logoInputRef    = useRef<HTMLInputElement>(null);

  // ── Load active template ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchTemplate();
  }, [user]);

  const fetchTemplate = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("document_templates")
      .select("*")
      .eq("artisan_id", user!.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setTemplate(data as Template);
      setCouleurPrimaire(data.couleur_primaire);
      setCouleurSecondaire(data.couleur_secondaire);
      setCouleurAccent(data.couleur_accent);
      setLogoUrl(data.logo_url);
      setEnteteTexte(data.entete_texte ?? "");
      setSelectedSector(data.secteur);
    }
    setLoading(false);
  };

  // ── Save color/logo customizations ───────────────────────────────────────
  const saveCustomization = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (template?.id) {
        const { error } = await supabase.from("document_templates").update({
          couleur_primaire:   couleurPrimaire,
          couleur_secondaire: couleurSecondaire,
          couleur_accent:     couleurAccent,
          logo_url:           logoUrl,
          entete_texte:       enteteTexte || null,
        }).eq("id", template.id);
        if (error) throw error;
      } else {
        // Create template with selected sector or general
        const sector = SECTORS.find(s => s.id === selectedSector) ?? SECTORS[5];
        const { error: insertError } = await supabase.from("document_templates").insert({
          artisan_id:         user.id,
          secteur:            sector.id,
          nom:                `Mon template`,
          couleur_primaire:   couleurPrimaire,
          couleur_secondaire: couleurSecondaire,
          couleur_accent:     couleurAccent,
          logo_url:           logoUrl,
          entete_texte:       enteteTexte || null,
          is_active:          true,
          metadata:           {},
        });
        if (insertError) throw insertError;
      }
      toast.success("Personnalisation enregistrée");
      fetchTemplate();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Upload logo ───────────────────────────────────────────────────────────
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/logos/logo.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      toast.success("Logo uploadé");
    } catch (e: any) {
      toast.error("Erreur upload logo : " + e.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Preview card ──────────────────────────────────────────────────────────
  const PreviewCard = () => (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white" style={{ fontSize: "8px", lineHeight: 1.4 }}>
      {/* Top accent bar */}
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${couleurPrimaire}, ${couleurAccent})` }} />

      {/* Header */}
      <div className="flex justify-between items-start px-3 pt-2 pb-2 border-b border-gray-100">
        <div className="flex items-start gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded object-contain" />
          ) : (
            <div className="h-9 w-9 rounded flex items-center justify-center shrink-0" style={{ background: couleurPrimaire + "22" }}>
              <FileText className="w-4 h-4" style={{ color: couleurPrimaire }} />
            </div>
          )}
          <div>
            <div className="font-bold text-[10px]" style={{ color: couleurPrimaire }}>Dupont Artisanat</div>
            <div className="text-gray-400">12 rue de la Paix, 75001 Paris</div>
            <div className="text-gray-400">Tél : 06 12 34 56 78</div>
            <div className="text-gray-400">SIRET : 123 456 789 00012</div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="inline-block font-bold text-white px-2 py-0.5 rounded text-[10px]" style={{ background: couleurPrimaire }}>DEVIS</div>
          <div className="font-mono text-gray-600 mt-0.5">D-2026-05-001</div>
          <div className="text-gray-400">Émis le 30/05/2026</div>
          <div className="text-gray-400">Valable 30 jours</div>
        </div>
      </div>

      {/* Client block */}
      <div className="px-3 py-2">
        <div className="inline-block border rounded px-2 py-1" style={{ borderColor: couleurPrimaire + "50" }}>
          <div className="font-semibold uppercase tracking-wide mb-0.5" style={{ color: couleurPrimaire }}>Client</div>
          <div className="font-bold text-gray-800">M. Jean Martin</div>
          <div className="text-gray-400">5 avenue des Fleurs, 69000 Lyon</div>
        </div>
      </div>

      {/* Table */}
      <div className="px-3">
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ background: couleurPrimaire }}>
              <th className="text-left text-white px-1.5 py-1 rounded-tl">Désignation</th>
              <th className="text-right text-white px-1.5 py-1 w-8">Qté</th>
              <th className="text-right text-white px-1.5 py-1 w-14">PU HT</th>
              <th className="text-right text-white px-1.5 py-1 w-14 rounded-tr">Total HT</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td className="px-1.5 py-1 text-gray-700">Pose de carrelage 30 m²</td>
              <td className="px-1.5 py-1 text-right text-gray-500">30</td>
              <td className="px-1.5 py-1 text-right text-gray-500">35,00 €</td>
              <td className="px-1.5 py-1 text-right font-medium text-gray-800">1 050 €</td>
            </tr>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              <td className="px-1.5 py-1 text-gray-700">Fourniture matériaux</td>
              <td className="px-1.5 py-1 text-right text-gray-500">1</td>
              <td className="px-1.5 py-1 text-right text-gray-500">350,00 €</td>
              <td className="px-1.5 py-1 text-right font-medium text-gray-800">350 €</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="px-3 pt-1.5 pb-2 flex justify-end">
        <div className="space-y-0.5" style={{ minWidth: "130px" }}>
          <div className="flex justify-between gap-4 text-gray-500">
            <span>Total HT</span><span>1 400,00 €</span>
          </div>
          <div className="flex justify-between gap-4 text-gray-500">
            <span>TVA (10%)</span><span>140,00 €</span>
          </div>
          <div className="flex justify-between gap-4 font-bold text-white rounded px-1.5 py-0.5 mt-0.5" style={{ background: couleurPrimaire }}>
            <span>Total TTC</span><span>1 540,00 €</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-3 py-1 text-gray-400 text-center border-t border-gray-100">
        RGE Qualibat n°1234 · Décennale AXA n°POL-56789
      </div>

      {/* Bottom accent bar */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${couleurPrimaire}, ${couleurAccent})` }} />
    </div>
  );

  if (loading) return (
    <div className="flex items-center gap-2 text-muted-foreground py-4">
      <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Customization */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</div>
          <h3 className="font-semibold text-sm">Personnalisation manuelle</h3>
        </div>

        {/* Logo */}
        <div className="space-y-2 mb-4">
          <Label className="text-xs">Logo de l'entreprise</Label>
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-contain border bg-white p-1" />
            ) : (
              <div className="h-12 w-12 rounded-lg border-2 border-dashed flex items-center justify-center bg-muted">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <input ref={logoInputRef} type="file" accept="image/*" className="sr-only" onChange={handleLogoUpload} />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {logoUrl ? "Changer le logo" : "Uploader un logo"}
              </Button>
              {logoUrl && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive ml-1" onClick={() => setLogoUrl(null)}>
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Couleur principale", value: couleurPrimaire, set: setCouleurPrimaire },
            { label: "Couleur secondaire", value: couleurSecondaire, set: setCouleurSecondaire },
            { label: "Couleur accent",     value: couleurAccent,     set: setCouleurAccent },
          ].map(({ label, value, set }) => (
            <div key={label} className="space-y-1.5">
              <Label className="text-[10px]">{label}</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={value}
                  onChange={e => set(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <Input
                  value={value}
                  onChange={e => set(e.target.value)}
                  className="h-8 text-xs font-mono"
                  maxLength={7}
                />
              </div>
            </div>
          ))}
        </div>

        {/* En-tête document */}
        <div className="space-y-1.5 mb-4">
          <Label className="text-xs">En-tête des documents (RIB, certifications, mentions…)</Label>
          <Textarea
            value={enteteTexte}
            onChange={e => setEnteteTexte(e.target.value)}
            placeholder={"RIB : FR76 1234 5678 9012 3456 7890 123 — BIC : BNPAFRPP\nRGE Qualibat n°1234 · Décennale AXA n°POL-56789"}
            rows={3}
            className="text-xs resize-none"
          />
          <p className="text-[10px] text-muted-foreground">Affiché dans l'en-tête de vos devis et factures PDF, sous vos coordonnées.</p>
        </div>

        <Button onClick={saveCustomization} disabled={saving} className="w-full gap-2 bg-primary text-primary-foreground" size="sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
          Enregistrer la personnalisation
        </Button>
      </div>

      {/* Preview */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">↓</div>
          <h3 className="font-semibold text-sm text-muted-foreground">Aperçu</h3>
        </div>
        <PreviewCard />
        {template && (
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Template actif : <strong>{template.nom}</strong> — secteur {template.secteur}
          </p>
        )}
      </div>
    </div>
  );
}
