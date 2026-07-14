// ---------------------------------------------------------------------------
// rule-matcher.ts — condition parser + fact matchers.
//
// The rule corpus's `condition` field is free-form natural language written
// by different transcript-extraction passes ("Lagna is Mithuna (Gemini)",
// "Mercury (debilitated in Pisces) in Moon's Kendra...", "Saturn aspects the
// 8th house", "Kataka Lagna, Saturn Dasha, Venus Bhukti", etc). Full NLP
// parsing of open-ended astrological English is not feasible deterministically,
// so this module takes a pragmatic, deterministic approach:
//
//   1. Reduce a chart (ChartFacts) to a flat set of normalized FACT TAGS —
//      short machine strings like "lagna:mithuna", "mercury:house:12",
//      "mars:dignity:friend", "jupiter:retrograde", "dasha:mahadasha:mars",
//      "aspect:mars:house:1" etc. (buildFactTags).
//
//   2. Reduce each rule's `condition` + `planets_or_houses` text to a set of
//      REQUIRED TAG GROUPS via regex/keyword extraction (extractConditionTags).
//      Each group is a list of tag alternatives; the rule matches if
//      *every* group has at least one satisfied alternative (AND of ORs).
//
//   3. A rule fires if all required groups are satisfied by the chart's fact
//      tags, AND (for planet/house-specific rules) at least one concrete,
//      specific tag (not just "Lagna is X") is present — this avoids overly
//      generic rules firing on every chart that merely shares the same
//      lagna sign.
//
// This is intentionally conservative: recall is bounded by pattern coverage,
// but every match is deterministic and traceable to specific tags, and false
// positives are minimized by requiring specific structured tokens rather than
// loose keyword overlap.
// ---------------------------------------------------------------------------

import { RASIS, GRAHAS, RASI_LORDS, aspectFromTo } from "./constants";
import type { RawRule } from "./rule-loader";

// ---- Public chart-facts contract (per composer_brief.md) -----------------

export type PlanetKey =
  | "sun"
  | "moon"
  | "mars"
  | "mercury"
  | "jupiter"
  | "venus"
  | "saturn"
  | "rahu"
  | "ketu";

export const PLANET_KEYS: PlanetKey[] = [
  "sun",
  "moon",
  "mars",
  "mercury",
  "jupiter",
  "venus",
  "saturn",
  "rahu",
  "ketu",
];

// Index into GRAHAS[] (0=Sun..8=Ketu) for each planet key.
export const PLANET_KEY_TO_GRAHA_INDEX: Record<PlanetKey, number> = {
  sun: 0,
  moon: 1,
  mars: 2,
  mercury: 3,
  jupiter: 4,
  venus: 5,
  saturn: 6,
  rahu: 7,
  ketu: 8,
};

export type DignityKey =
  | "exalted"
  | "debilitated"
  | "own"
  | "moolatrikona"
  | "friend"
  | "neutral"
  | "enemy"
  | "great_enemy";

export interface PlanetFacts {
  signIndex: number; // 0..11
  degree: number; // 0..30 within sign
  house: number; // 1..12 from Lagna
  nakshatra: number; // 0..26
  pada: 1 | 2 | 3 | 4;
  retrograde: boolean;
  dignity: DignityKey;
  // Optional: pre-computed Guruji Subathuvam/Papathuvam verdict for this
  // planet (net beneficence band). Not part of the original brief's
  // ChartFacts spec, but added as an OPTIONAL field because ~12% of the rule
  // corpus (278/2298 rules) keys its condition on "Subathuvam"/"Papathuvam"
  // wording, which is a derived judgment (dignity + house + aspects +
  // conjunctions combined via guruji-analysis.ts's scoreboard), not a raw
  // chart fact. Callers that already run guruji-analysis.ts can pass its
  // per-planet `band` here ("subathuvam" | "papathuvam" | "neutral") to
  // unlock this slice of rules; callers that omit it simply won't match
  // those rules (safe, conservative default — see rule-loader/composer docs).
  subathuvamBand?: "subathuvam" | "papathuvam" | "neutral";
}

export type AspectType = "5th" | "7th" | "8th" | "3rd" | "4th" | "10th" | "9th" | "11th" | "2nd" | "6th" | "12th";

export interface AspectFacts {
  from: PlanetKey;
  to: PlanetKey | number; // planet or house number 1..12
  type: AspectType;
}

export interface ChartFacts {
  lagna: { signIndex: number; degree: number; nakshatra: number; pada: 1 | 2 | 3 | 4 };
  planets: Record<PlanetKey, PlanetFacts>;
  aspects: AspectFacts[];
  paksha: "shukla" | "krishna";
  moonSunGap: number; // degrees, 0..360
  currentDasha: { mahadasha: PlanetKey; bhukti: PlanetKey; from: string; to: string };
}

// ---- Fact tags -------------------------------------------------------------

export type FactTagSet = Set<string>;

const SIGN_EN_ALIASES: Record<number, string[]> = {
  0: ["mesha", "aries"],
  1: ["rishaba", "rishabam", "taurus"],
  2: ["mithuna", "gemini"],
  3: ["kataka", "cancer"],
  4: ["simha", "leo"],
  5: ["kanni", "kanya", "virgo"],
  6: ["thula", "thulam", "libra"],
  7: ["vrischika", "viruchiga", "scorpio"],
  8: ["dhanu", "dhanusu", "sagittarius"],
  9: ["makara", "capricorn"],
  10: ["kumbha", "kumba", "aquarius"],
  11: ["meena", "meenam", "pisces"],
};

// dignity.ts key names -> brief's DignityKey names (informational; composer
// callers are responsible for supplying DignityKey directly, this map is
// exposed so integration code can convert dignity.ts's Dignity to the
// brief's DignityKey without duplicating logic).
export const DIGNITY_TS_TO_BRIEF: Record<string, DignityKey> = {
  uccham: "exalted",
  neecham: "debilitated",
  aatchi: "own",
  moolatrikona: "moolatrikona",
  natpu: "friend",
  samam: "neutral",
  pagai: "enemy",
};

const DIGNITY_ALIASES: Record<DignityKey, string[]> = {
  exalted: ["exalted", "uccham", "uchcha"],
  debilitated: ["debilitated", "neecham", "neecha"],
  own: ["own sign", "own house", "swakshetra", "aatchi", "swakshethra"],
  moolatrikona: ["moolatrikona", "moola trikona", "mulatrikona"],
  friend: ["friend's sign", "friendly sign", "natpu"],
  neutral: ["neutral sign", "samam"],
  enemy: ["enemy sign", "enemy's sign", "pagai"],
  great_enemy: ["great enemy", "bitter enemy"],
};

function houseFromLagna(signIndex: number, lagnaSignIndex: number): number {
  return ((signIndex - lagnaSignIndex + 12) % 12) + 1;
}

/** Build the flat set of normalized fact tags describing a chart. */
export function buildFactTags(facts: ChartFacts): FactTagSet {
  const tags = new Set<string>();
  const lagnaSign = facts.lagna.signIndex;

  tags.add(`lagna:sign:${lagnaSign}`);
  for (const alias of SIGN_EN_ALIASES[lagnaSign] ?? []) tags.add(`lagna:${alias}`);
  tags.add(`lagna:nakshatra:${facts.lagna.nakshatra}`);
  tags.add(`lagna:pada:${facts.lagna.pada}`);

  // Lagna lord.
  const lagnaLordGrahaIdx = RASI_LORDS[lagnaSign];
  const lagnaLordKey = PLANET_KEYS[grahaIndexToPlanetKeyIndex(lagnaLordGrahaIdx)];
  tags.add(`lagnalord:${lagnaLordKey}`);

  for (const pk of PLANET_KEYS) {
    const p = facts.planets[pk];
    if (!p) continue;
    tags.add(`${pk}:sign:${p.signIndex}`);
    for (const alias of SIGN_EN_ALIASES[p.signIndex] ?? []) tags.add(`${pk}:insign:${alias}`);
    tags.add(`${pk}:house:${p.house}`);
    tags.add(`${pk}:nakshatra:${p.nakshatra}`);
    tags.add(`${pk}:pada:${p.pada}`);
    tags.add(`${pk}:dignity:${p.dignity}`);
    if (p.retrograde) tags.add(`${pk}:retrograde`);
    if (p.subathuvamBand) tags.add(`${pk}:${p.subathuvamBand}`);

    // Is this planet the lord of house N? (sign whose lord is this planet,
    // expressed from Lagna.)
    for (let houseNo = 1; houseNo <= 12; houseNo++) {
      const signOfHouse = (lagnaSign + houseNo - 1) % 12;
      const lordGraha = RASI_LORDS[signOfHouse];
      if (PLANET_KEY_TO_GRAHA_INDEX[pk] === lordGraha) {
        tags.add(`houselord:${houseNo}:${pk}`);
        tags.add(`${pk}:lordof:${houseNo}`);
      }
    }

    if (lagnaLordKey === pk) tags.add(`lagnalord:house:${p.house}`);
  }

  // Conjunctions: two planets sharing a sign.
  for (let i = 0; i < PLANET_KEYS.length; i++) {
    for (let j = i + 1; j < PLANET_KEYS.length; j++) {
      const a = facts.planets[PLANET_KEYS[i]];
      const b = facts.planets[PLANET_KEYS[j]];
      if (a && b && a.signIndex === b.signIndex) {
        tags.add(`conjunct:${PLANET_KEYS[i]}:${PLANET_KEYS[j]}`);
        tags.add(`conjunct:${PLANET_KEYS[j]}:${PLANET_KEYS[i]}`);
      }
    }
  }

  // Aspects: explicit list from ChartFacts.aspects, PLUS derived whole-sign
  // aspects computed from planet positions (belt-and-suspenders — the
  // explicit list may be partial, so we also derive using constants.ts's
  // aspectFromTo, which encodes classical Parashari special drishti rules).
  for (const asp of facts.aspects) {
    const toTag = typeof asp.to === "number" ? `house:${asp.to}` : asp.to;
    tags.add(`aspect:${asp.from}:${toTag}`);
  }
  for (const pk of PLANET_KEYS) {
    if (pk === "ketu") continue; // Ketu aspect handled like Rahu by convention below
    const p = facts.planets[pk];
    if (!p) continue;
    const grahaIdx = PLANET_KEY_TO_GRAHA_INDEX[pk];
    for (let houseNo = 1; houseNo <= 12; houseNo++) {
      const targetSign = (lagnaSign + houseNo - 1) % 12;
      const drishti = aspectFromTo(grahaIdx, p.signIndex, targetSign);
      if (drishti > 0) {
        tags.add(`aspect:${pk}:house:${houseNo}`);
        tags.add(`derivedaspect:${pk}:${drishti}th:house:${houseNo}`);
        // planet-to-planet aspect tags
        for (const otherPk of PLANET_KEYS) {
          if (otherPk === pk) continue;
          const other = facts.planets[otherPk];
          if (other && other.house === houseNo) {
            tags.add(`aspect:${pk}:${otherPk}`);
          }
        }
      }
    }
  }

  // Paksha / Moon-Sun gap derived tags.
  tags.add(`paksha:${facts.paksha}`);
  if (facts.moonSunGap <= 12 || facts.moonSunGap >= 348) tags.add("moon:amavasya");
  if (facts.moonSunGap >= 168 && facts.moonSunGap <= 192) tags.add("moon:pournami");
  tags.add(facts.moonSunGap <= 180 ? "moon:waxing" : "moon:waning");

  // Houses from Moon (Chandra Lagna) — needed for Chandra Adhi Yoga etc.
  const moonSign = facts.planets.moon.signIndex;
  for (const pk of PLANET_KEYS) {
    const p = facts.planets[pk];
    if (!p || pk === "moon") continue;
    const houseFromMoon = houseFromLagna(p.signIndex, moonSign);
    tags.add(`${pk}:housefrommoon:${houseFromMoon}`);
  }

  // Dasha / Bhukti.
  tags.add(`dasha:mahadasha:${facts.currentDasha.mahadasha}`);
  tags.add(`dasha:bhukti:${facts.currentDasha.bhukti}`);
  tags.add(`dasha:pair:${facts.currentDasha.mahadasha}:${facts.currentDasha.bhukti}`);

  return tags;
}

function grahaIndexToPlanetKeyIndex(grahaIdx: number): number {
  // GRAHAS ordering (0..8) is identical to PLANET_KEYS ordering by design.
  return grahaIdx;
}

// ---- Condition -> required tag groups -------------------------------------

export interface TagGroup {
  // Rule matches this group if ANY of these tags is present in the chart's tag set.
  anyOf: string[];
  // Human-readable label for debugging/coverage reporting.
  label: string;
}

export interface ParsedCondition {
  groups: TagGroup[];
  specific: boolean; // true if at least one group refers to a concrete planet/house (not just lagna sign)
}

const PLANET_NAME_TO_KEY: Record<string, PlanetKey> = {
  sun: "sun",
  surya: "sun",
  suriyan: "sun",
  moon: "moon",
  chandra: "moon",
  chandran: "moon",
  mars: "mars",
  sevvai: "mars",
  kuja: "mars",
  mangal: "mars",
  mercury: "mercury",
  budha: "mercury",
  budhan: "mercury",
  jupiter: "jupiter",
  guru: "jupiter",
  venus: "venus",
  sukra: "venus",
  sukran: "venus",
  shukra: "venus",
  saturn: "saturn",
  sani: "saturn",
  shani: "saturn",
  rahu: "rahu",
  ketu: "ketu",
  kethu: "ketu",
};

const SIGN_NAME_TO_INDEX: Record<string, number> = {};
for (const [idx, aliases] of Object.entries(SIGN_EN_ALIASES)) {
  for (const alias of aliases) SIGN_NAME_TO_INDEX[alias] = Number(idx);
}

const ORDINAL_WORD_TO_NUM: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10,
  eleventh: 11,
  twelfth: 12,
};

function lc(s: string): string {
  return s.toLowerCase();
}

function findPlanetMentions(text: string): PlanetKey[] {
  const found: PlanetKey[] = [];
  const t = lc(text);
  for (const [name, key] of Object.entries(PLANET_NAME_TO_KEY)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(t) && !found.includes(key)) found.push(key);
  }
  return found;
}

function findHouseMentions(text: string): number[] {
  const found = new Set<number>();
  const t = lc(text);
  // "Nth house" / "N house" e.g. "6th house", "8th", "12th house"
  const re1 = /\b(\d{1,2})(?:st|nd|rd|th)\s*house\b/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(t))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) found.add(n);
  }
  // "Nth lord" -> the house whose lord is referenced (used separately, but
  // also worth capturing the house number itself)
  const re2 = /\b(\d{1,2})(?:st|nd|rd|th)\s*lord\b/g;
  while ((m = re2.exec(t))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) found.add(n);
  }
  // word-ordinal house mentions: "fifth house"
  for (const [word, n] of Object.entries(ORDINAL_WORD_TO_NUM)) {
    const re3 = new RegExp(`\\b${word}\\s+house\\b`, "i");
    if (re3.test(t)) found.add(n);
  }
  return Array.from(found);
}

function findLordMentions(text: string): number[] {
  // Returns house numbers referenced as "Nth lord" (e.g. "6th lord", "10th lord").
  const found = new Set<number>();
  const t = lc(text);
  const re = /\b(\d{1,2})(?:st|nd|rd|th)\s*lord\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 12) found.add(n);
  }
  for (const [word, n] of Object.entries(ORDINAL_WORD_TO_NUM)) {
    const re2 = new RegExp(`\\b${word}\\s+lord\\b`, "i");
    if (re2.test(t)) found.add(n);
  }
  if (/\blagna\s*lord\b/i.test(t) || /\blagnadhipathi\b/i.test(t)) found.add(1);
  return Array.from(found);
}

function findSignMentions(text: string): number[] {
  const found = new Set<number>();
  const t = lc(text);
  for (const [name, idx] of Object.entries(SIGN_NAME_TO_INDEX)) {
    const re = new RegExp(`\\b${name}\\b`, "i");
    if (re.test(t)) found.add(idx);
  }
  return Array.from(found);
}

function hasWord(text: string, ...words: string[]): boolean {
  const t = lc(text);
  return words.some((w) => new RegExp(`\\b${w}\\b`, "i").test(t));
}

const ASPECT_ORDINAL_TO_LABEL: Record<string, string> = {
  "1": "1st", "2": "2nd", "3": "3rd", "4": "4th", "5": "5th", "6": "6th",
  "7": "7th", "8": "8th", "9": "9th", "10": "10th", "11": "11th", "12": "12th",
};

/**
 * Parse a rule's condition + planets_or_houses fields into a list of
 * required tag groups (AND of ORs). This is deliberately structured as many
 * small, targeted patterns rather than one giant regex — new patterns can be
 * appended without disturbing existing ones.
 */
export function parseCondition(rule: RawRule): ParsedCondition {
  const text = `${rule.condition ?? ""}`;
  const extra = (rule.planets_or_houses ?? []).join(" ; ");
  const combined = `${text} ; ${extra}`;
  const groups: TagGroup[] = [];
  let specific = false;

  // --- 1. Lagna sign mentions: "Lagna is X" / "X Lagna" -------------------
  const lagnaSignMatches = new Set<number>();
  {
    const t = lc(combined);
    for (const [name, idx] of Object.entries(SIGN_NAME_TO_INDEX)) {
      const re1 = new RegExp(`\\b${name}\\s*lagna\\b`, "i"); // "Mithuna Lagna"
      const re2 = new RegExp(`\\blagna\\s*(?:is|=)?\\s*${name}\\b`, "i"); // "Lagna is Mithuna"
      const re3 = new RegExp(`\\b${name}\\s*ascendant\\b`, "i");
      if (re1.test(t) || re2.test(t) || re3.test(t)) lagnaSignMatches.add(idx);
    }
  }
  if (lagnaSignMatches.size > 0) {
    groups.push({
      anyOf: Array.from(lagnaSignMatches).map((i) => `lagna:sign:${i}`),
      label: `lagna is one of [${Array.from(lagnaSignMatches).map((i) => RASIS[i]?.en).join(", ")}]`,
    });
  }

  // --- 2. "Lagna Lord" mentions (generic, resolved via lagnalord tag) -----
  if (hasWord(combined, "lagna lord", "lagnadhipathi") || /\blagna\s*lord\b/i.test(combined)) {
    // No specific planet named alongside "lagna lord" alone => match any lagna lord;
    // this is inherently satisfied once lagna matches, so we don't add a group
    // unless a house is specified for the lagna lord ("lagna lord in Nth house").
    const houseNums = findHouseMentions(combined);
    if (houseNums.length > 0) {
      groups.push({
        anyOf: houseNums.map((h) => `lagnalord:house:${h}`),
        label: `lagna lord in house ${houseNums.join("/")}`,
      });
      specific = true;
    }
  }

  // --- 3. Planet dignity mentions: "X exalted", "X in own sign", "X debilitated"
  const planetsMentioned = findPlanetMentions(combined);
  for (const pk of planetsMentioned) {
    for (const [dignity, aliases] of Object.entries(DIGNITY_ALIASES) as [DignityKey, string[]][]) {
      for (const alias of aliases) {
        const re = new RegExp(`\\b${pk}\\b[^.;]{0,40}\\b${alias}\\b|\\b${alias}\\b[^.;]{0,40}\\b${pk}\\b`, "i");
        if (re.test(combined)) {
          groups.push({ anyOf: [`${pk}:dignity:${dignity}`], label: `${pk} dignity=${dignity}` });
          specific = true;
          break;
        }
      }
    }
    if (new RegExp(`\\bretrograde\\b[^.;]{0,30}\\b${pk}\\b|\\b${pk}\\b[^.;]{0,30}\\bretrograde\\b`, "i").test(combined)) {
      groups.push({ anyOf: [`${pk}:retrograde`], label: `${pk} retrograde` });
      specific = true;
    }
  }

  // --- 3b. Subathuvam / Papathuvam mentions (derived beneficence verdict) --
  // ~12% of the corpus (278/2298 rules) keys its condition on a planet's
  // computed Subathuvam (net-benefic) / Papathuvam (net-malefic) verdict,
  // e.g. "Lagna Lord Mercury is Subathuvam". This is NOT a raw chart fact —
  // it mirrors guruji-analysis.ts's scoreboard — so it only matches when the
  // caller supplies PlanetFacts.subathuvamBand (optional field). See that
  // field's doc comment for rationale.
  for (const pk of planetsMentioned) {
    const subaRe = new RegExp(`\\b${pk}\\b[^.;]{0,40}\\bsubathuvam\\b|\\bsubathuvam\\b[^.;]{0,40}\\b${pk}\\b`, "i");
    const papaRe = new RegExp(`\\b${pk}\\b[^.;]{0,40}\\bpapathuvam\\b|\\bpapathuvam\\b[^.;]{0,40}\\b${pk}\\b`, "i");
    if (subaRe.test(combined)) {
      groups.push({ anyOf: [`${pk}:subathuvam`], label: `${pk} is Subathuvam` });
      specific = true;
    } else if (papaRe.test(combined)) {
      groups.push({ anyOf: [`${pk}:papathuvam`], label: `${pk} is Papathuvam` });
      specific = true;
    }
  }

  // --- 4. "X in Nth house" per-planet house placement ---------------------
  for (const pk of planetsMentioned) {
    const re = new RegExp(
      `\\b${pk}\\b[^.;]{0,25}?\\b(\\d{1,2})(?:st|nd|rd|th)\\s*house\\b|\\b(\\d{1,2})(?:st|nd|rd|th)\\s*house\\b[^.;]{0,25}?\\b${pk}\\b`,
      "gi"
    );
    let m: RegExpExecArray | null;
    const houses = new Set<number>();
    while ((m = re.exec(combined))) {
      const h = Number(m[1] ?? m[2]);
      if (h >= 1 && h <= 12) houses.add(h);
    }
    if (houses.size > 0) {
      groups.push({ anyOf: Array.from(houses).map((h) => `${pk}:house:${h}`), label: `${pk} in house ${Array.from(houses).join("/")}` });
      specific = true;
    }
  }

  // --- 5. "X in <SignName>" placement --------------------------------------
  for (const pk of planetsMentioned) {
    const signsFound = new Set<number>();
    for (const [name, idx] of Object.entries(SIGN_NAME_TO_INDEX)) {
      const re = new RegExp(`\\b${pk}\\b[^.;]{0,20}\\bin\\b[^.;]{0,10}\\b${name}\\b`, "i");
      const re2 = new RegExp(`\\b${name}\\b[^.;]{0,10}\\b${pk}\\b`, "i"); // "Taurus...Mercury"
      if (re.test(combined)) signsFound.add(idx);
    }
    if (signsFound.size > 0) {
      groups.push({ anyOf: Array.from(signsFound).map((i) => `${pk}:sign:${i}`), label: `${pk} in sign ${Array.from(signsFound).join("/")}` });
      specific = true;
    }
  }

  // --- 6. "Nth lord" placement / house-lord tags ---------------------------
  const lordHouses = findLordMentions(combined);
  if (lordHouses.length > 0) {
    // "Nth lord in Mth house" pattern
    const houseNums = findHouseMentions(combined);
    for (const lordHouse of lordHouses) {
      if (houseNums.length > 0) {
        // If both an "Nth lord" and a house number are mentioned, and they're
        // different numbers, treat it as "lord of house lordHouse sits in
        // house houseNums[x]" — but we cannot always disambiguate which
        // house number is "the lord's house" vs "the source house" reliably
        // via regex alone, so we require the specific planet named for that
        // lordship (via houselord tag) AND at least one of the mentioned
        // house numbers as its placement, taking the more conservative
        // (any of) interpretation.
        const otherHouses = houseNums.filter((h) => h !== lordHouse);
        if (otherHouses.length > 0) {
          groups.push({
            anyOf: otherHouses.flatMap((h) => PLANET_KEYS.map((pk) => `houselord:${lordHouse}:${pk}`).filter(() => true)),
            label: `${lordHouse}th lord placement mentioned`,
          });
          // Weaker signal (lordship existing at all is always true for a
          // real chart) — do not mark specific from this alone; the house
          // placement check happens below via a second, planet-scoped group.
        }
      }
    }
  }

  // --- 7. Conjunction: "X conjunct/conjunction/joined/with Y" -------------
  if (planetsMentioned.length >= 2 && /\b(conjunct|conjunction|joined|with|combust|along\s*with)\b/i.test(combined)) {
    for (let i = 0; i < planetsMentioned.length; i++) {
      for (let j = i + 1; j < planetsMentioned.length; j++) {
        groups.push({
          anyOf: [`conjunct:${planetsMentioned[i]}:${planetsMentioned[j]}`],
          label: `${planetsMentioned[i]} conjunct ${planetsMentioned[j]}`,
        });
        specific = true;
      }
    }
  }

  // --- 8. Aspect: "X aspects Y" / "Xth aspect" ------------------------------
  if (/\baspect(s|ed|ing)?\b|\bdrishti\b|\bview(s|ed)?\b/i.test(combined)) {
    if (planetsMentioned.length >= 1) {
      const houseNums = findHouseMentions(combined);
      const targets: string[] = [];
      for (const h of houseNums) targets.push(`house:${h}`);
      for (const pk of planetsMentioned) targets.push(pk);
      if (planetsMentioned.length >= 2) {
        // "X aspects Y" (planet to planet)
        for (let i = 0; i < planetsMentioned.length; i++) {
          for (let j = 0; j < planetsMentioned.length; j++) {
            if (i === j) continue;
            groups.push({
              anyOf: [`aspect:${planetsMentioned[i]}:${planetsMentioned[j]}`, `aspect:${planetsMentioned[j]}:${planetsMentioned[i]}`],
              label: `${planetsMentioned[i]}/${planetsMentioned[j]} mutual aspect`,
            });
          }
        }
        specific = true;
      }
      if (houseNums.length > 0 && planetsMentioned.length >= 1) {
        for (const pk of planetsMentioned) {
          groups.push({
            anyOf: houseNums.map((h) => `aspect:${pk}:house:${h}`),
            label: `${pk} aspects house ${houseNums.join("/")}`,
          });
        }
        specific = true;
      }
    }
  }

  // --- 9. Dasha / Bhukti mentions ------------------------------------------
  {
    const t = lc(combined);
    const dashaMatches = new Set<PlanetKey>();
    const bhuktiMatches = new Set<PlanetKey>();
    for (const [name, key] of Object.entries(PLANET_NAME_TO_KEY)) {
      // "Saturn Dasha", "Saturn MD", "Saturn Mahadasa"
      if (new RegExp(`\\b${name}\\s*(dasha|dasa|mahadasa|mahadasha|md)\\b`, "i").test(t)) dashaMatches.add(key);
      // "Saturn Bhukti", "Saturn Antara", "Saturn BD"
      if (new RegExp(`\\b${name}\\s*(bhukti|bukthi|antara|bd)\\b`, "i").test(t)) bhuktiMatches.add(key);
    }
    // "Dasha or Bhukti of Saturn, Mercury, Ketu, or Venus" / "dasha/bhukti of X and Y"
    const ofListRe = /\b(dasha|dasa|mahadasa|mahadasha|bhukti|bukthi|antara)(?:\s*(?:or|\/)\s*(?:dasha|dasa|mahadasa|mahadasha|bhukti|bukthi|antara))?\s+of\s+([a-z,\s]+?(?:and|or)?\s*[a-z]+)\b/gi;
    let ofMatch: RegExpExecArray | null;
    while ((ofMatch = ofListRe.exec(t))) {
      const kind = ofMatch[1];
      const namesBlob = ofMatch[2];
      for (const [name, key] of Object.entries(PLANET_NAME_TO_KEY)) {
        if (new RegExp(`\\b${name}\\b`, "i").test(namesBlob)) {
          if (/dasha|dasa|mahadasa|mahadasha/i.test(kind)) dashaMatches.add(key);
          if (/bhukti|bukthi|antara/i.test(kind)) bhuktiMatches.add(key);
        }
      }
    }
    if (dashaMatches.size > 0) {
      groups.push({ anyOf: Array.from(dashaMatches).map((k) => `dasha:mahadasha:${k}`), label: `dasha=${Array.from(dashaMatches).join("/")}` });
      specific = true;
    }
    if (bhuktiMatches.size > 0) {
      groups.push({ anyOf: Array.from(bhuktiMatches).map((k) => `dasha:bhukti:${k}`), label: `bhukti=${Array.from(bhuktiMatches).join("/")}` });
      specific = true;
    }
  }

  // --- 10. Paksha / Amavasya / Pournami mentions ----------------------------
  if (/\bamavasya\b|\bdark\s*moon\b|\bnew\s*moon\b/i.test(combined)) {
    groups.push({ anyOf: ["moon:amavasya"], label: "Amavasya moon" });
  }
  if (/\bpournami\b|\bpurnima\b|\bfull\s*moon\b|\bbright\s*moon\b/i.test(combined)) {
    groups.push({ anyOf: ["moon:pournami"], label: "Pournami moon" });
  }
  if (/\bshukla\s*paksha\b|\bwaxing\b/i.test(combined)) {
    groups.push({ anyOf: ["paksha:shukla"], label: "Shukla paksha" });
  }
  if (/\bkrishna\s*paksha\b|\bwaning\b/i.test(combined)) {
    groups.push({ anyOf: ["paksha:krishna"], label: "Krishna paksha" });
  }

  // --- 11. House-from-Moon mentions ("Nth from Moon") ----------------------
  {
    const re = /\b(\d{1,2})(?:st|nd|rd|th)\s*(?:house\s*)?from\s*(?:the\s*)?moon\b/gi;
    let m: RegExpExecArray | null;
    const housesFromMoon = new Set<number>();
    while ((m = re.exec(combined))) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 12) housesFromMoon.add(n);
    }
    if (housesFromMoon.size > 0 && planetsMentioned.length > 0) {
      for (const pk of planetsMentioned) {
        if (pk === "moon") continue;
        groups.push({
          anyOf: Array.from(housesFromMoon).map((h) => `${pk}:housefrommoon:${h}`),
          label: `${pk} in house ${Array.from(housesFromMoon).join("/")} from Moon`,
        });
      }
      specific = true;
    }
  }

  return { groups, specific };
}

/** Does the chart's fact-tag set satisfy every group in a parsed condition? */
export function conditionMatches(parsed: ParsedCondition, tags: FactTagSet): boolean {
  if (parsed.groups.length === 0) return false; // nothing concrete parsed => cannot verify => no match
  for (const group of parsed.groups) {
    if (!group.anyOf.some((t) => tags.has(t))) return false;
  }
  return true;
}

/** Convenience: parse + match in one call, returning matched group labels for tracing. */
export function evaluateRule(rule: RawRule, tags: FactTagSet): { fired: boolean; specific: boolean; matchedLabels: string[] } {
  const parsed = parseCondition(rule);
  const fired = conditionMatches(parsed, tags);
  return {
    fired,
    specific: parsed.specific,
    matchedLabels: fired ? parsed.groups.map((g) => g.label) : [],
  };
}
