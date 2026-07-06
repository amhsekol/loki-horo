// Ashtakavarga (அஷ்டகவர்க்கம்) — classical Parashari benefic-point system.
//
// For each of the 7 grahas (Sun..Saturn) we build a Bhinnashtakavarga (BAV):
// a 12-house table of benefic bindus (dots) contributed by 8 references —
// the 7 grahas themselves plus the Lagna. The Sarvashtakavarga (SAV) is the
// sum of all 7 BAVs per sign, and represents overall strength of each house.
//
// The benefic-place tables below are the standard BPHS values (identical to the
// ones Jagannatha Hora / Parashara's Light use). Each entry lists, for a given
// "contributor", the house-numbers (counted FROM that contributor's sign,
// 1 = the contributor's own sign) where the graha earns a bindu.

export const AV_GRAHAS = [0, 1, 2, 3, 4, 5, 6] as const; // Sun..Saturn (Ketu/Rahu excluded)
// Contributor order for every table: Sun,Moon,Mars,Mercury,Jupiter,Venus,Saturn,Lagna
export type AvContributor = "sun" | "moon" | "mars" | "mercury" | "jupiter" | "venus" | "saturn" | "lagna";
export const AV_CONTRIBUTORS: AvContributor[] = [
  "sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "lagna",
];

// Benefic houses (1-based, counted from the contributor's sign) for each graha.
// Source: Brihat Parashara Hora Shastra, Ashtakavarga chapter.
type BeneficTable = Record<AvContributor, number[]>;

const SUN: BeneficTable = {
  sun: [1, 2, 4, 7, 8, 9, 10, 11],
  moon: [3, 6, 10, 11],
  mars: [1, 2, 4, 7, 8, 9, 10, 11],
  mercury: [3, 5, 6, 9, 10, 11, 12],
  jupiter: [5, 6, 9, 11],
  venus: [6, 7, 12],
  saturn: [1, 2, 4, 7, 8, 9, 10, 11],
  lagna: [3, 4, 6, 10, 11, 12],
};

const MOON: BeneficTable = {
  sun: [3, 6, 7, 8, 10, 11],
  moon: [1, 3, 6, 7, 10, 11],
  mars: [2, 3, 5, 6, 9, 10, 11],
  mercury: [1, 3, 4, 5, 7, 8, 10, 11],
  jupiter: [1, 4, 7, 8, 10, 11, 12],
  venus: [3, 4, 5, 7, 9, 10, 11],
  saturn: [3, 5, 6, 11],
  lagna: [3, 6, 10, 11],
};

const MARS: BeneficTable = {
  sun: [3, 5, 6, 10, 11],
  moon: [3, 6, 11],
  mars: [1, 2, 4, 7, 8, 10, 11],
  mercury: [3, 5, 6, 11],
  jupiter: [6, 10, 11, 12],
  venus: [6, 8, 11, 12],
  saturn: [1, 4, 7, 8, 9, 10, 11],
  lagna: [1, 3, 6, 10, 11],
};

const MERCURY: BeneficTable = {
  sun: [5, 6, 9, 11, 12],
  moon: [2, 4, 6, 8, 10, 11],
  mars: [1, 2, 4, 7, 8, 9, 10, 11],
  mercury: [1, 3, 5, 6, 9, 10, 11, 12],
  jupiter: [6, 8, 11, 12],
  venus: [1, 2, 3, 4, 5, 8, 9, 11],
  saturn: [1, 2, 4, 7, 8, 9, 10, 11],
  lagna: [1, 2, 4, 6, 8, 10, 11],
};

const JUPITER: BeneficTable = {
  sun: [1, 2, 3, 4, 7, 8, 9, 10, 11],
  moon: [2, 5, 7, 9, 11],
  mars: [1, 2, 4, 7, 8, 10, 11],
  mercury: [1, 2, 4, 5, 6, 9, 10, 11],
  jupiter: [1, 2, 3, 4, 7, 8, 10, 11],
  venus: [2, 5, 6, 9, 10, 11],
  saturn: [3, 5, 6, 12],
  lagna: [1, 2, 4, 5, 6, 7, 9, 10, 11],
};

const VENUS: BeneficTable = {
  sun: [8, 11, 12],
  moon: [1, 2, 3, 4, 5, 8, 9, 11, 12],
  mars: [3, 5, 6, 9, 11, 12],
  mercury: [3, 5, 6, 9, 11],
  jupiter: [5, 8, 9, 10, 11],
  venus: [1, 2, 3, 4, 5, 8, 9, 10, 11],
  saturn: [3, 4, 5, 8, 9, 10, 11],
  lagna: [1, 2, 3, 4, 5, 8, 9, 11],
};

const SATURN: BeneficTable = {
  sun: [1, 2, 4, 7, 8, 10, 11],
  moon: [3, 6, 11],
  mars: [3, 5, 6, 10, 11, 12],
  mercury: [6, 8, 9, 10, 11, 12],
  jupiter: [5, 6, 11, 12],
  venus: [6, 11, 12],
  saturn: [3, 5, 6, 11],
  lagna: [1, 3, 4, 6, 10, 11],
};

// Table keyed by the graha whose BAV we're computing.
const BAV_TABLES: Record<number, BeneficTable> = {
  0: SUN,
  1: MOON,
  2: MARS,
  3: MERCURY,
  4: JUPITER,
  5: VENUS,
  6: SATURN,
};

export interface AshtakavargaResult {
  // BAV per graha: bindus[graha][sign] where sign 0..11 (Mesha..Meena, absolute rasi index)
  bav: Record<number, number[]>;
  bavTotals: Record<number, number>; // total bindus per graha (nominally sums to a known range)
  sav: number[]; // Sarvashtakavarga per sign (0..11), sums to 337
  savTotal: number;
}

/**
 * Compute the full Ashtakavarga.
 * @param signByContributor absolute sign index (0..11) for each contributor,
 *        in AV_CONTRIBUTORS order (sun..saturn, lagna).
 */
export function computeAshtakavarga(signByContributor: Record<AvContributor, number>): AshtakavargaResult {
  const bav: Record<number, number[]> = {};
  const bavTotals: Record<number, number> = {};
  const sav = new Array(12).fill(0);

  for (const graha of AV_GRAHAS) {
    const table = BAV_TABLES[graha];
    const row = new Array(12).fill(0);
    for (const contrib of AV_CONTRIBUTORS) {
      const base = signByContributor[contrib]; // 0..11
      for (const house of table[contrib]) {
        // house is 1-based counted from the contributor's sign
        const signIdx = (base + house - 1) % 12;
        row[signIdx] += 1;
      }
    }
    bav[graha] = row;
    bavTotals[graha] = row.reduce((a, b) => a + b, 0);
    for (let s = 0; s < 12; s++) sav[s] += row[s];
  }

  return {
    bav,
    bavTotals,
    sav,
    savTotal: sav.reduce((a, b) => a + b, 0),
  };
}
