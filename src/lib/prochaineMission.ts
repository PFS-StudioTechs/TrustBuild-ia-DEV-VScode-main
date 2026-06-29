export interface BriefLot {
  corps_metier: string;
  detail: string;
}

export interface BriefPiecesJointes {
  renseigne: boolean;
  plan_fourni: boolean;
  a_discuter_artisan: boolean;
}

export interface BriefOptionArchi {
  propose: boolean;
  accepte: boolean | null;
}

export interface BriefOptionCatalogue {
  propose: boolean;
  consulte: boolean | null;
}

export interface BriefData {
  lots?: BriefLot[];
  pieces_jointes?: Partial<BriefPiecesJointes>;
  options?: {
    archi_interieur?: Partial<BriefOptionArchi>;
    catalogue_produits?: Partial<BriefOptionCatalogue>;
  };
}

export interface Brief {
  description?: string | null;
  localisation?: string | null;
  brief_data?: BriefData;
}

export type EtapeMission =
  | "S1_cadrage"
  | "S2_localisation"
  | "S3_pieces_jointes"
  | "S4_archi"
  | "S5_catalogue"
  | "S6_mise_en_relation";

export interface Mission {
  etape: EtapeMission;
  champ_attendu: string | null;
  bloquant: boolean;
  brief_complet: boolean;
}

export function prochaineMission(brief: Brief): Mission {
  const data = brief.brief_data ?? {};
  const lots = data.lots ?? [];

  if (!brief.description?.trim() || lots.length === 0) {
    return { etape: "S1_cadrage", champ_attendu: "description", bloquant: true, brief_complet: false };
  }

  if (!brief.localisation?.trim()) {
    return { etape: "S2_localisation", champ_attendu: "localisation", bloquant: true, brief_complet: false };
  }

  if (data.pieces_jointes?.renseigne !== true) {
    return { etape: "S3_pieces_jointes", champ_attendu: "pieces_jointes", bloquant: false, brief_complet: false };
  }

  if (data.options?.archi_interieur?.propose !== true) {
    return { etape: "S4_archi", champ_attendu: "archi_interieur", bloquant: false, brief_complet: false };
  }

  if (data.options?.catalogue_produits?.propose !== true) {
    return { etape: "S5_catalogue", champ_attendu: "catalogue_produits", bloquant: false, brief_complet: false };
  }

  return { etape: "S6_mise_en_relation", champ_attendu: null, bloquant: false, brief_complet: true };
}
