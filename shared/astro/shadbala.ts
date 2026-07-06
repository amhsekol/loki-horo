// Shadbala — the six-fold strength of a planet (classical Parashari).
// Computed in Virupas (60 Virupas = 1 Rupa). We compute the six major balas:
//   1. Sthana Bala  (positional)  — uccha + saptavargaja (approx via dignity) + ojayugma + kendradi + drekkana
//   2. Dig Bala     (directional)
//   3. Kaala Bala   (temporal)    — nathonnata + paksha + tribhaga + abda/masa/vara/hora (simplified) + ayana
//   4. Cheshta Bala (motional)    — for the 5 star planets; Sun/Moon use ayana/paksha instead
//   5. Naisargika Bala (natural)  — fixed per planet
//   6. Drik Bala    (aspectual)   — net benefic/malefic aspect
//
// This is a faithful-but-pragmatic implementation: several sub-balas that require
// deep ephemeris detail (e.g. exact Cheshta from mean/true anomaly) are approximated
// in a documented way. It yields sensible, comparable totals and a Required-strength
// verdict (Ishta) so the user sees whether the Lagna lord is "strong".
//
// Planet indices: 0=Surya 1=Chandra 2=Sevvai 3=Budha 4=Guru 5=Sukra 6=Sani (7/8 nodes: no Shadbala)

import type { Bilingual } from "./constants";
import { GRAHAS, RASI_LORDS } from "./constants";
import type { PlanetPosition } from "./engine";
import { computeDignity } from "./dignity";
import { SAPTAVARGA } from "./varga";

const EXALT_DEG: Record<number, number> = {
  // exact exaltation point on the zodiac (sidereal degrees 0..360)
  0: 10,          // Surya  10° Mesha
  1: 33,          // Chandra 3° Rishaba
  2: 298,         // Sevvai 28° Makara
  3: 165,         // Budha 15° Kanni
  4: 95,          // Guru   5° Kataka
  5: 357,         // Sukra 27° Meena
  6: 200,         // Sani  20° Thula
};

// Naisargika (natural) strength in Virupas — fixed classical values.
const NAISARGIKA: Record<number, number> = {
  6: 8.57,   // Sani (weakest)
  2: 17.14,  // Sevvai
  3: 25.71,  // Budha
  4: 34.29,  // Guru
  5: 42.86,  // Sukra
  1: 51.43,  // Chandra
  0: 60.0,   // Surya (strongest)
};

// Dig Bala: the direction (house) where each planet gets full 60 Virupas.
// Measured by the angular distance from the "powerless" point.
// Strong points: Sun/Mars = 10th (south/mid-heaven), Jup/Merc = 1st (east/asc),
// Moon/Venus = 4th (north/nadir), Saturn = 7th (west/descendant).
const DIG_STRONG_ANGLE: Record<number, number> = {
  0: 180,  // Surya  strong at MC (10th)  -> we measure from IC
  2: 180,  // Sevvai
  4: 0,    // Guru   strong at Asc (1st)
  3: 0,    // Budha
  1: 90,   // Chandra strong at IC (4th)
  5: 90,   // Sukra
  6: 270,  // Sani   strong at Desc (7th)
};

// Benefic (true) / malefic for Drik Bala. Mercury benefic unless with malefics (simplified benefic).
const NATURAL_BENEFIC: Record<number, boolean> = {
  0: false, // Surya malefic
  1: true,  // Chandra benefic
  2: false, // Sevvai malefic
  3: true,  // Budha benefic
  4: true,  // Guru benefic
  5: true,  // Sukra benefic
  6: false, // Sani malefic
};

// Required (minimum) Shadbala in Rupas for a planet to be considered strong.
const REQUIRED_RUPAS: Record<number, number> = {
  0: 6.5, 1: 6.0, 2: 5.0, 3: 7.0, 4: 6.5, 5: 5.5, 6: 5.0,
};

export interface BalaComponent {
  key: string;
  label: Bilingual;
  virupas: number;
  sub?: boolean; // sub-breakdown row (already included in a parent bala; excluded from total)
}

export interface ShadbalaResult {
  planetIndex: number;
  planetName: Bilingual;
  components: BalaComponent[];
  totalVirupas: number;
  totalRupas: number;
  requiredRupas: number;
  ratio: number;          // total / required
  verdict: Bilingual;     // Strong / Moderate / Weak
}

export interface ShadbalaContext {
  planets: PlanetPosition[];
  weekdayIndex: number;   // 0=Sunday .. 6=Saturday (local birth weekday)
  isDayBirth: boolean;    // Sun above horizon at birth
  ayanaNorth: boolean;    // Sun in northern course (Uttarayana)
}

function circDist(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

// --- Sthana Bala pieces ----------------------------------------------------
function ucchaBala(pi: number, lon: number): number {
  // 60 at exaltation, 0 at debilitation (180° away). Linear.
  const deb = (EXALT_DEG[pi] + 180) % 360;
  const dFromDeb = circDist(lon, deb); // 0..180
  return (dFromDeb / 180) * 60;
}

function ojaYugmaBala(pi: number, lon: number): number {
  // Odd/even sign & navamsa preference. Male planets (Sun,Mars,Jup) like odd (oja);
  // female (Moon,Venus) like even (yugma); Merc/Sat get partial.
  const sign = Math.floor(lon / 30);          // 0-based
  const nav = Math.floor((lon % 30) / (30 / 9)) + Math.floor(lon / 30) * 9;
  const signOdd = sign % 2 === 0;             // 0-based even index = 1st,3rd.. = odd sign
  const navOdd = nav % 2 === 0;
  const likesOdd = pi === 0 || pi === 2 || pi === 4 || pi === 3 || pi === 6; // male + neutral-ish
  const likesEven = pi === 1 || pi === 5;
  let v = 0;
  if (likesOdd) { if (signOdd) v += 15; if (navOdd) v += 15; }
  else if (likesEven) { if (!signOdd) v += 15; if (!navOdd) v += 15; }
  return v;
}

function kendradiBala(lon: number, lagnaSign: number): number {
  // Angular (kendra) = 60, succedent (panapara) = 30, cadent (apoklima) = 15.
  const sign = Math.floor(lon / 30);
  const house = ((sign - lagnaSign + 12) % 12) + 1;
  if ([1, 4, 7, 10].includes(house)) return 60;
  if ([2, 5, 8, 11].includes(house)) return 30;
  return 15;
}

// Saptavargaja Bala — proper 7-varga positional strength.
// For each of the 7 divisional charts (D1,D2,D3,D7,D9,D12,D30) we find the sign the
// planet occupies and score its dignity there in Virupas per the classical scale:
//   Moolatrikona 45, Own (swakshetra) 30, Great friend 22.5, Friend 15,
//   Neutral 7.5, Enemy 3.75, Great enemy 1.875. Exalted is treated as own-tier (30).
// The seven values are summed (max ~315 in the extreme; typical 60-150).
const SAPTAVARGAJA_VIRUPAS: Record<string, number> = {
  moolatrikona: 45,
  uccham: 30,      // exalted counts at the own-sign tier for saptavargaja
  aatchi: 30,      // own sign
  natpu: 15,       // friend
  samam: 7.5,      // neutral
  pagai: 3.75,     // enemy
  neecham: 1.875,  // debilitated -> great-enemy tier
};

function saptavargajaBala(pi: number, lon: number): number {
  let sum = 0;
  for (const vargaFn of SAPTAVARGA) {
    const sign = vargaFn(lon);
    const dig = computeDignity(pi, sign);
    const key = dig?.key ?? "samam";
    sum += SAPTAVARGAJA_VIRUPAS[key] ?? 7.5;
  }
  return sum;
}

// Dispositor bonus: "whoever gave the house is powerful strengthens the guest."
// If the planet sits in another graha's sign, and that dispositor is itself well-placed
// (exalted / moolatrikona / own / friendly), add a proportional bonus (0..30 Virupas).
function dispositorBonus(pi: number, sign: number, planets: PlanetPosition[]): number {
  const dispIndex = RASI_LORDS[sign];
  if (dispIndex === pi) return 0; // in own sign already rewarded elsewhere
  const disp = planets.find((x) => x.index === dispIndex);
  if (!disp) return 0;
  const pts = disp.dignity?.points ?? 20; // 0..100
  // Only a *strong* dispositor confers a bonus; weak/enemy placement gives ~0.
  // Map dignity points (0..100) to 0..30 Virupas, but require >= neutral (20) to count.
  if (pts <= 20) return (pts / 20) * 5; // small: 0..5
  return 5 + ((pts - 20) / 80) * 25;    // 5..30
}

function digBala(pi: number, lon: number, lagnaSid: number): number {
  // Angle of the planet measured within the diurnal circle relative to the ascendant.
  // Approximate using ecliptic longitude offset from the ascendant.
  const rel = ((lon - lagnaSid) % 360 + 360) % 360; // 0..360 from Asc
  const strong = DIG_STRONG_ANGLE[pi] ?? 0;
  const d = circDist(rel, strong); // 0 at strong point, 180 at weak
  return ((180 - d) / 180) * 60;
}

function naisargikaBala(pi: number): number {
  return NAISARGIKA[pi] ?? 20;
}

function kaalaBala(pi: number, ctx: ShadbalaContext): number {
  let v = 0;
  // Nathonnata: diurnal planets (Sun,Jup,Venus) strong by day; nocturnal (Moon,Mars,Sat)
  // strong by night; Mercury always gets full.
  const diurnal = pi === 0 || pi === 4 || pi === 5;
  const nocturnal = pi === 1 || pi === 2 || pi === 6;
  if (pi === 3) v += 60;
  else if ((diurnal && ctx.isDayBirth) || (nocturnal && !ctx.isDayBirth)) v += 60;
  else v += 15;
  // Paksha (lunar fortnight): benefics strong in bright half, malefics in dark half.
  // Approx: give benefics/malefics 30 as a neutral midpoint (needs tithi for exactness).
  v += 30;
  // Ayana bala: broadly, most planets stronger in Uttarayana; Saturn/Moon favor Dakshinayana.
  const likesNorth = pi === 0 || pi === 2 || pi === 4 || pi === 5;
  const likesSouth = pi === 6 || pi === 1;
  if ((likesNorth && ctx.ayanaNorth) || (likesSouth && !ctx.ayanaNorth)) v += 40;
  else v += 15;
  // Vara (weekday lord) bala — 45 if the planet rules the birth weekday.
  const weekdayLord = [0, 1, 2, 3, 4, 5, 6][ctx.weekdayIndex]; // Sun..Sat map to 0..6 GRAHA order
  if (weekdayLord === pi) v += 45;
  return v;
}

function cheshtaBala(pi: number, retro: boolean, ctx: ShadbalaContext): number {
  // For the 5 tara-grahas: retrograde/slow planets get high Cheshta.
  // Sun & Moon: use ayana/paksha proxy (give a moderate fixed value).
  if (pi === 0 || pi === 1) return 30;
  return retro ? 45 : 20;
}

function drikBala(pi: number, lon: number, ctx: ShadbalaContext): number {
  // Net aspectual strength: benefic aspects add, malefic aspects subtract.
  // Use whole-sign 7th (plus special) aspects onto this planet's sign.
  const sign = Math.floor(lon / 30);
  let net = 0;
  for (const other of ctx.planets) {
    if (other.index === pi || other.index > 6) continue;
    const oSign = other.rasiIndex;
    const dist = ((sign - oSign + 12) % 12) + 1;
    const special: Record<number, number[]> = {
      2: [4, 7, 8], 4: [5, 7, 9], 6: [3, 7, 10],
    };
    const casts = (special[other.index] ?? [7]).includes(dist);
    if (!casts) continue;
    net += NATURAL_BENEFIC[other.index] ? 15 : -15;
  }
  return net; // can be negative
}

export function computeShadbala(
  pi: number,
  lagnaSid: number,
  lagnaSignIndex: number,
  ctx: ShadbalaContext,
): ShadbalaResult | null {
  if (pi > 6) return null; // no Shadbala for Rahu/Ketu
  const p = ctx.planets.find((x) => x.index === pi)!;
  const lon = p.siderealLon;
  const dignityPts = p.dignity?.points ?? null;

  const uccha = ucchaBala(pi, lon);
  const saptav = saptavargajaBala(pi, lon);
  const ojaYugma = ojaYugmaBala(pi, lon);
  const kendradi = kendradiBala(lon, lagnaSignIndex);
  const dispBonus = dispositorBonus(pi, p.rasiIndex, ctx.planets);
  const sthana = uccha + saptav + ojaYugma + kendradi + dispBonus;
  const dig = digBala(pi, lon, lagnaSid);
  void dignityPts;
  const kaala = kaalaBala(pi, ctx);
  const cheshta = cheshtaBala(pi, p.retrograde, ctx);
  const naisargika = naisargikaBala(pi);
  const drik = drikBala(pi, lon, ctx);

  const components: BalaComponent[] = [
    { key: "sthana", label: { ta: "ஸ்தான பலம்", en: "Sthana (Positional)" }, virupas: sthana },
    { key: "saptavargaja", label: { ta: "— ஸப்தவர்கஜ", en: "— Saptavargaja (7 vargas)" }, virupas: saptav, sub: true },
    { key: "dispositor", label: { ta: "— அதிபதி பலம்", en: "— Dispositor bonus" }, virupas: dispBonus, sub: true },
    { key: "dig", label: { ta: "திக் பலம்", en: "Dig (Directional)" }, virupas: dig },
    { key: "kaala", label: { ta: "கால பலம்", en: "Kaala (Temporal)" }, virupas: kaala },
    { key: "cheshta", label: { ta: "சேஷ்டா பலம்", en: "Cheshta (Motional)" }, virupas: cheshta },
    { key: "naisargika", label: { ta: "நைசர்கிக பலம்", en: "Naisargika (Natural)" }, virupas: naisargika },
    { key: "drik", label: { ta: "திருஷ்டி பலம்", en: "Drik (Aspectual)" }, virupas: drik },
  ];

  const totalVirupas = components.reduce((s, c) => s + (c.sub ? 0 : c.virupas), 0);
  const totalRupas = totalVirupas / 60;
  const requiredRupas = REQUIRED_RUPAS[pi] ?? 6;
  const ratio = totalRupas / requiredRupas;

  const verdict: Bilingual =
    ratio >= 1.1
      ? { ta: "வலிமையானது", en: "Strong" }
      : ratio >= 0.9
      ? { ta: "நடுத்தரம்", en: "Moderate" }
      : { ta: "பலவீனம்", en: "Weak" };

  return {
    planetIndex: pi,
    planetName: GRAHAS[pi],
    components,
    totalVirupas,
    totalRupas,
    requiredRupas,
    ratio,
    verdict,
  };
}
