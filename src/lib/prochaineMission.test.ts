import { describe, it, expect } from "vitest";
import { prochaineMission, type Brief } from "./prochaineMission";

const LOTS = [{ corps_metier: "plomberie", detail: "remplacement robinets" }];

describe("prochaineMission", () => {
  it("brief vide → S1", () => {
    expect(prochaineMission({})).toMatchObject({
      etape: "S1_cadrage",
      bloquant: true,
      brief_complet: false,
    });
  });

  it("brief_data absent → S1", () => {
    expect(prochaineMission({ description: "travaux", localisation: "75001" })).toMatchObject({
      etape: "S1_cadrage",
    });
  });

  it("description vide, lots présents → S1", () => {
    const brief: Brief = { description: "  ", brief_data: { lots: LOTS } };
    expect(prochaineMission(brief)).toMatchObject({ etape: "S1_cadrage" });
  });

  it("lots vide, description présente → S1", () => {
    const brief: Brief = { description: "travaux", brief_data: { lots: [] } };
    expect(prochaineMission(brief)).toMatchObject({ etape: "S1_cadrage" });
  });

  it("description + lots remplis, localisation absente → S2", () => {
    const brief: Brief = { description: "travaux", brief_data: { lots: LOTS } };
    expect(prochaineMission(brief)).toMatchObject({
      etape: "S2_localisation",
      bloquant: true,
      brief_complet: false,
    });
  });

  it("localisation vide string → S2", () => {
    const brief: Brief = { description: "travaux", localisation: "", brief_data: { lots: LOTS } };
    expect(prochaineMission(brief)).toMatchObject({ etape: "S2_localisation" });
  });

  it("description + lots + localisation, pieces_jointes absent → S3", () => {
    const brief: Brief = {
      description: "travaux",
      localisation: "75001",
      brief_data: { lots: LOTS },
    };
    expect(prochaineMission(brief)).toMatchObject({
      etape: "S3_pieces_jointes",
      bloquant: false,
      brief_complet: false,
    });
  });

  it("pieces_jointes.renseigne:false → S3", () => {
    const brief: Brief = {
      description: "travaux",
      localisation: "75001",
      brief_data: { lots: LOTS, pieces_jointes: { renseigne: false } },
    };
    expect(prochaineMission(brief)).toMatchObject({ etape: "S3_pieces_jointes" });
  });

  it("pieces_jointes.renseigne:true → S4", () => {
    const brief: Brief = {
      description: "travaux",
      localisation: "75001",
      brief_data: {
        lots: LOTS,
        pieces_jointes: { renseigne: true, plan_fourni: false, a_discuter_artisan: false },
      },
    };
    expect(prochaineMission(brief)).toMatchObject({
      etape: "S4_archi",
      bloquant: false,
      brief_complet: false,
    });
  });

  it("archi proposé avec accepte:false (refus) → S5 (pas de boucle sur refus)", () => {
    const brief: Brief = {
      description: "travaux",
      localisation: "75001",
      brief_data: {
        lots: LOTS,
        pieces_jointes: { renseigne: true, plan_fourni: false, a_discuter_artisan: false },
        options: { archi_interieur: { propose: true, accepte: false } },
      },
    };
    expect(prochaineMission(brief)).toMatchObject({
      etape: "S5_catalogue",
      bloquant: false,
      brief_complet: false,
    });
  });

  it("archi proposé avec accepte:true → S5", () => {
    const brief: Brief = {
      description: "travaux",
      localisation: "75001",
      brief_data: {
        lots: LOTS,
        pieces_jointes: { renseigne: true, plan_fourni: false, a_discuter_artisan: false },
        options: { archi_interieur: { propose: true, accepte: true } },
      },
    };
    expect(prochaineMission(brief)).toMatchObject({ etape: "S5_catalogue" });
  });

  it("catalogue proposé (propose:true) → S6 + brief_complet:true", () => {
    const brief: Brief = {
      description: "travaux",
      localisation: "75001",
      brief_data: {
        lots: LOTS,
        pieces_jointes: { renseigne: true, plan_fourni: false, a_discuter_artisan: false },
        options: {
          archi_interieur: { propose: true, accepte: false },
          catalogue_produits: { propose: true, consulte: null },
        },
      },
    };
    const result = prochaineMission(brief);
    expect(result).toEqual({
      etape: "S6_mise_en_relation",
      champ_attendu: null,
      bloquant: false,
      brief_complet: true,
    });
  });

  it("brief_data partiel {} → ne plante pas", () => {
    expect(() => prochaineMission({ description: "travaux", localisation: "75001", brief_data: {} })).not.toThrow();
  });

  it("brief_data.options partiellement absent → ne plante pas", () => {
    const brief: Brief = {
      description: "travaux",
      localisation: "75001",
      brief_data: {
        lots: LOTS,
        pieces_jointes: { renseigne: true, plan_fourni: false, a_discuter_artisan: false },
        options: {},
      },
    };
    expect(() => prochaineMission(brief)).not.toThrow();
    expect(prochaineMission(brief)).toMatchObject({ etape: "S4_archi" });
  });
});
