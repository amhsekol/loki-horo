// Client helpers for the astrology rules library.
import type { Rule } from "@shared/schema";
import { UI, GRAHAS, type Bilingual } from "@shared/astro/constants";

// categoryKey → UI label key. Keeps a single source of truth for the ordered
// category list shown in filters and the categorised reference.
export const RULE_CATEGORIES: { key: string; label: Bilingual }[] = [
  { key: "pathaka", label: UI.ruleCatPathaka },
  { key: "longevity", label: UI.ruleCatLongevity },
  { key: "prediction", label: UI.ruleCatPrediction },
  { key: "dasa", label: UI.ruleCatDasa },
  { key: "transit", label: UI.ruleCatTransit },
  { key: "saturn", label: UI.ruleCatSaturn },
  { key: "mercury", label: UI.ruleCatMercury },
  { key: "timing", label: UI.ruleCatTiming },
];

export function categoryLabel(key: string): Bilingual {
  return RULE_CATEGORIES.find((c) => c.key === key)?.label
    ?? { ta: key, en: key, hi: key };
}

// astrologer id → display label.
export function astrologerLabel(id: string): Bilingual {
  if (id === "aditya_guruji") return UI.rulesAstroAdityaGuruji;
  return { ta: id, en: id, hi: id };
}

// A rule's title / body as a Bilingual object for the t() helper.
export function ruleTitle(r: Rule): Bilingual {
  return { ta: r.titleTa, en: r.titleEn, hi: r.titleHi };
}
export function ruleBody(r: Rule): Bilingual {
  return { ta: r.bodyTa, en: r.bodyEn, hi: r.bodyHi };
}

// Planet index (0..8) → Bilingual name.
export function planetName(idx: number): Bilingual {
  return GRAHAS[idx] ?? { ta: String(idx), en: String(idx), hi: String(idx) };
}
