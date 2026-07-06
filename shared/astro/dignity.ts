// Planetary strength & dignity (Graha Bala — Sthana Bala) — classical Parashari system.
// Matches the reference chart: e.g. in Meena (Pisces) -> Guru=Aatchi (own), Sukra=Uccham
// (exalted), Budha=Neecham (debilitated). Strength points follow the reference legend.
//
// Planet indices (GRAHAS): 0=Surya 1=Chandra 2=Sevvai 3=Budha 4=Guru 5=Sukra 6=Sani 7=Rahu 8=Ketu
// Rasi indices (RASIS):    0=Mesha 1=Rishaba 2=Mithuna 3=Kataka 4=Simha 5=Kanni
//                          6=Thula 7=Viruchiga 8=Dhanusu 9=Makara 10=Kumba 11=Meena

import type { Bilingual } from "./constants";

export type Dignity =
  | "uccham"        // exaltation
  | "moolatrikona"  // moolatrikona
  | "aatchi"        // own sign (swakshetra)
  | "natpu"         // friend's sign
  | "samam"         // neutral sign
  | "pagai"         // enemy's sign
  | "neecham";      // debilitation

// Strength points per the reference legend.
export const DIGNITY_POINTS: Record<Dignity, number> = {
  uccham: 100,
  moolatrikona: 80,
  aatchi: 60,
  natpu: 40,
  samam: 20,
  pagai: 10,
  neecham: 0,
};

export const DIGNITY_LABEL: Record<Dignity, Bilingual> = {
  uccham: { ta: "உச்சம்", en: "Uccham (Exalted)" },
  moolatrikona: { ta: "மூலத்திரிகோணம்", en: "Moolatrikona" },
  aatchi: { ta: "ஆட்சி", en: "Aatchi (Own)" },
  natpu: { ta: "நட்பு", en: "Natpu (Friend)" },
  samam: { ta: "சமம்", en: "Samam (Neutral)" },
  pagai: { ta: "பகை", en: "Pagai (Enemy)" },
  neecham: { ta: "நீசம்", en: "Neecham (Debilitated)" },
};

// Short glyphs for chart cells.
export const DIGNITY_SHORT: Record<Dignity, Bilingual> = {
  uccham: { ta: "உ", en: "↑" },
  moolatrikona: { ta: "மூ", en: "MT" },
  aatchi: { ta: "ஆ", en: "Ow" },
  natpu: { ta: "ந", en: "Fr" },
  samam: { ta: "ச", en: "Ne" },
  pagai: { ta: "ப", en: "En" },
  neecham: { ta: "நீ", en: "↓" },
};

// Own signs (aatchi) per planet — the rasis each graha rules.
// Rahu/Ketu have no rulership in the classical seven-planet scheme.
const OWN_SIGNS: Record<number, number[]> = {
  0: [4],          // Surya  -> Simha
  1: [3],          // Chandra-> Kataka
  2: [0, 7],       // Sevvai -> Mesha, Viruchiga
  3: [2, 5],       // Budha  -> Mithuna, Kanni
  4: [8, 11],      // Guru   -> Dhanusu, Meena
  5: [1, 6],       // Sukra  -> Rishaba, Thula
  6: [9, 10],      // Sani   -> Makara, Kumba
};

// Moolatrikona sign per planet (single sign).
const MOOLATRIKONA: Record<number, number> = {
  0: 4,   // Surya  -> Simha
  1: 1,   // Chandra-> Rishaba
  2: 0,   // Sevvai -> Mesha
  3: 5,   // Budha  -> Kanni
  4: 8,   // Guru   -> Dhanusu
  5: 6,   // Sukra  -> Thula
  6: 10,  // Sani   -> Kumba
};

// Exaltation sign per planet (Uccham).
const EXALTATION: Record<number, number> = {
  0: 0,   // Surya  -> Mesha
  1: 1,   // Chandra-> Rishaba
  2: 9,   // Sevvai -> Makara
  3: 5,   // Budha  -> Kanni
  4: 3,   // Guru   -> Kataka
  5: 11,  // Sukra  -> Meena
  6: 6,   // Sani   -> Thula
};

// Debilitation sign per planet (Neecham) — always opposite the exaltation.
const DEBILITATION: Record<number, number> = {
  0: 6,   // Surya  -> Thula
  1: 7,   // Chandra-> Viruchiga
  2: 3,   // Sevvai -> Kataka
  3: 11,  // Budha  -> Meena
  4: 9,   // Guru   -> Makara
  5: 5,   // Sukra  -> Kanni
  6: 0,   // Sani   -> Mesha
};

// Natural (naisargika) planetary friendships — classical Parashari relationships.
// For each planet: friends and enemies. Anything not listed is neutral (samam).
const FRIENDS: Record<number, number[]> = {
  0: [1, 2, 4],       // Surya  friends: Chandra, Sevvai, Guru
  1: [0, 3],          // Chandra friends: Surya, Budha
  2: [0, 1, 4],       // Sevvai friends: Surya, Chandra, Guru
  3: [0, 5],          // Budha  friends: Surya, Sukra
  4: [0, 1, 2],       // Guru   friends: Surya, Chandra, Sevvai
  5: [3, 6],          // Sukra  friends: Budha, Sani
  6: [3, 5],          // Sani   friends: Budha, Sukra
};
const ENEMIES: Record<number, number[]> = {
  0: [5, 6],          // Surya  enemies: Sukra, Sani
  1: [],              // Chandra has no enemies
  2: [3],             // Sevvai enemy: Budha
  3: [1],             // Budha  enemy: Chandra
  4: [3, 5],          // Guru   enemies: Budha, Sukra
  5: [0, 1],          // Sukra  enemies: Surya, Chandra
  6: [0, 1, 2],       // Sani   enemies: Surya, Chandra, Sevvai
};

// Rasi lords (adhipathi) — index into GRAHAS (0..6). (Duplicated small table to keep
// this module self-contained.)
const RASI_LORD = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4];

export interface DignityResult {
  key: Dignity;
  label: Bilingual;
  short: Bilingual;
  points: number;
}

// Compute the dignity of a planet placed in a given sign.
// Returns null for Rahu/Ketu (no classical rulership-based dignity).
export function computeDignity(planetIndex: number, signIndex: number): DignityResult | null {
  if (planetIndex === 7 || planetIndex === 8) return null; // Rahu / Ketu

  let key: Dignity;

  if (EXALTATION[planetIndex] === signIndex) {
    key = "uccham";
  } else if (DEBILITATION[planetIndex] === signIndex) {
    key = "neecham";
  } else if (MOOLATRIKONA[planetIndex] === signIndex) {
    key = "moolatrikona";
  } else if ((OWN_SIGNS[planetIndex] ?? []).includes(signIndex)) {
    key = "aatchi";
  } else {
    // Relationship to the sign's lord.
    const lord = RASI_LORD[signIndex];
    if (lord === planetIndex) {
      key = "aatchi"; // safety net (shouldn't hit — own signs covered above)
    } else if ((FRIENDS[planetIndex] ?? []).includes(lord)) {
      key = "natpu";
    } else if ((ENEMIES[planetIndex] ?? []).includes(lord)) {
      key = "pagai";
    } else {
      key = "samam";
    }
  }

  return {
    key,
    label: DIGNITY_LABEL[key],
    short: DIGNITY_SHORT[key],
    points: DIGNITY_POINTS[key],
  };
}
