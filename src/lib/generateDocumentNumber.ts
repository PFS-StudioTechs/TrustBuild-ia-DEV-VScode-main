import { supabase } from "@/integrations/supabase/client";

export type DocType = "devis" | "facture" | "avenant" | "acompte" | "avoir" | "ts";

interface NomenclatureSettings {
  devis_prefix: string;
  facture_prefix: string;
  avenant_prefix: string;
  acompte_prefix: string;
  avoir_prefix: string;
  ts_prefix: string;
  annee_format: number;
  numero_digits: number;
}

const DEFAULTS: NomenclatureSettings = {
  devis_prefix: "D",
  facture_prefix: "F",
  avenant_prefix: "Avt",
  acompte_prefix: "Acp",
  avoir_prefix: "Avoir",
  ts_prefix: "TS",
  annee_format: 4,
  numero_digits: 3,
};

export function formatDocNumber(
  prefix: string,
  annee: number,
  mois: number,
  num: number,
  settings: Pick<NomenclatureSettings, "annee_format" | "numero_digits">
): string {
  const anneeStr = settings.annee_format === 2 ? String(annee).slice(-2) : String(annee);
  const moisStr = String(mois).padStart(2, "0");
  const numStr = String(num).padStart(settings.numero_digits, "0");
  return `${prefix}-${anneeStr}-${moisStr}-${numStr}`;
}

export function buildVersionedDevisNumero(baseNumero: string, version: number): string {
  if (version <= 1) return baseNumero;
  return `${baseNumero}-v${version}`;
}

// Récupère les settings de nomenclature de l'artisan (avec fallback sur les défauts)
export async function fetchNomenclatureSettings(userId: string): Promise<NomenclatureSettings> {
  const { data } = await supabase
    .from("artisan_settings")
    .select(
      "devis_prefix, facture_prefix, avenant_prefix, acompte_prefix, avoir_prefix, ts_prefix, annee_format, numero_digits"
    )
    .eq("user_id", userId)
    .maybeSingle();

  const raw = data as Record<string, unknown> | null;
  return {
    devis_prefix:   String(raw?.devis_prefix   ?? DEFAULTS.devis_prefix),
    facture_prefix: String(raw?.facture_prefix ?? DEFAULTS.facture_prefix),
    avenant_prefix: String(raw?.avenant_prefix ?? DEFAULTS.avenant_prefix),
    acompte_prefix: String(raw?.acompte_prefix ?? DEFAULTS.acompte_prefix),
    avoir_prefix:   String(raw?.avoir_prefix   ?? DEFAULTS.avoir_prefix),
    ts_prefix:      String(raw?.ts_prefix      ?? DEFAULTS.ts_prefix),
    annee_format:   Number(raw?.annee_format   ?? DEFAULTS.annee_format),
    numero_digits:  Number(raw?.numero_digits  ?? DEFAULTS.numero_digits),
  };
}

// Génère le prochain numéro de document (compteur atomique Supabase RPC)
export async function generateDocumentNumber(
  userId: string,
  docType: DocType,
  date?: Date,
  cachedSettings?: NomenclatureSettings
): Promise<string> {
  const d = date ?? new Date();
  const annee = d.getFullYear();
  const mois = d.getMonth() + 1;

  const [settings, rpcResult] = await Promise.all([
    cachedSettings ? Promise.resolve(cachedSettings) : fetchNomenclatureSettings(userId),
    (supabase as any).rpc("next_doc_number", {
      p_artisan_id: userId,
      p_doc_type: docType,
      p_annee: annee,
      p_mois: mois,
    }),
  ]);

  const nextNum: number = rpcResult?.data ?? 1;

  const prefixMap: Record<DocType, string> = {
    devis:    settings.devis_prefix,
    facture:  settings.facture_prefix,
    avenant:  settings.avenant_prefix,
    acompte:  settings.acompte_prefix,
    avoir:    settings.avoir_prefix,
    ts:       settings.ts_prefix,
  };

  return formatDocNumber(prefixMap[docType], annee, mois, nextNum, settings);
}

// Aperçu du format pour l'UI settings (ex: "D-2026-04-001")
export function previewDocNumber(
  prefix: string,
  settings: Pick<NomenclatureSettings, "annee_format" | "numero_digits">
): string {
  const now = new Date();
  return formatDocNumber(prefix || "?", now.getFullYear(), now.getMonth() + 1, 1, settings);
}
