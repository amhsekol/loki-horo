// ---------------------------------------------------------------------------
// rule-loader.ts — loads and caches the bundled rule corpus.
//
// The bundle (shared/astro/rules.bundled.json) is produced at build time by
// scripts/bundle-rules.mjs from the JSONL files under
// /home/user/workspace/rules_ingest/out/lagna_buckets/*.jsonl. Importing a
// JSON file is statically bundled by esbuild/vite/tsx (same pattern already
// used by guruji-rules.ts for guruji-rules.seed.json), so there is NO
// filesystem access at runtime — loading is just module evaluation, which
// happens once per process and is then cached in-memory by the module system
// (and further memoized here) so repeated calls are O(1).
// ---------------------------------------------------------------------------

import bundle from "./rules.bundled.json";
import { RASIS } from "./constants";

// A single rule record as it appears in the JSONL corpus.
export interface RawRule {
  id: string;
  rule_en: string;
  rule_ta?: string;
  condition: string;
  outcome: string;
  topic: string;
  pipeline_stage?: string;
  planets_or_houses?: string[];
  confidence?: "explicit" | "implicit" | string;
  n_sources?: number;
  n_mentions?: number;
  sources?: Array<{ file_idx?: number; title?: string }>;
  alt_wordings?: string[];
  __bucket?: string; // injected by bundle-rules.mjs; source bucket filename stem
}

interface RulesBundle {
  generatedAt: string;
  sourceDir: string;
  totalRules: number;
  duplicateIdCount: number;
  lagnaBuckets: Record<string, RawRule[]>;
  overrides: RawRule[];
  exceptions: RawRule[];
}

const BUNDLE = bundle as unknown as RulesBundle;

// Canonical lagna keys used by the bundle (transliterated, lower-case,
// matching the *.jsonl filenames under lagna_buckets/).
export const LAGNA_KEYS = [
  "mesha",
  "rishaba",
  "mithuna",
  "kataka",
  "simha",
  "kanni",
  "thula",
  "vrischika",
  "dhanu",
  "makara",
  "kumbha",
  "meena",
] as const;

export type LagnaKey = typeof LAGNA_KEYS[number];

// Map RASIS[] sign index (0=Mesha..11=Meena, per constants.ts) to the bundle's
// lagna bucket key. This is the single seam between constants.ts's sign
// ordering and the rules corpus's file-derived naming (e.g. RASIS[7].en is
// "Viruchiga (Scorpio)" but the bucket file/key is "vrischika").
export const SIGN_INDEX_TO_LAGNA_KEY: LagnaKey[] = [
  "mesha", // 0 Mesha (Aries)
  "rishaba", // 1 Rishaba (Taurus)
  "mithuna", // 2 Mithuna (Gemini)
  "kataka", // 3 Kataka (Cancer)
  "simha", // 4 Simha (Leo)
  "kanni", // 5 Kanni (Virgo)
  "thula", // 6 Thula (Libra)
  "vrischika", // 7 Viruchiga (Scorpio)
  "dhanu", // 8 Dhanusu (Sagittarius)
  "makara", // 9 Makara (Capricorn)
  "kumbha", // 10 Kumba (Aquarius)
  "meena", // 11 Meena (Pisces)
];

export function lagnaKeyForSignIndex(signIndex: number): LagnaKey {
  const key = SIGN_INDEX_TO_LAGNA_KEY[signIndex];
  if (!key) {
    throw new Error(`rule-loader: invalid signIndex ${signIndex} (expected 0..11)`);
  }
  return key;
}

// In-memory memoization. Module-level `bundle` import is already cached by
// the JS module system, but we additionally memoize the *combined* rule set
// per lagna (bucket + overrides) since composer.ts calls this once per
// chart and we don't want to re-concatenate arrays every call.
const combinedCache = new Map<LagnaKey, RawRule[]>();

/**
 * Returns all rules relevant to a given lagna: that lagna's dedicated bucket
 * + the universal `_overrides` bucket. `_exceptions` are intentionally
 * excluded from the default set (see getExceptionRules) because they encode
 * caveats/negations that the matcher treats differently (informational,
 * used to suppress or annotate other fired rules) rather than being
 * independently "fireable" positive rules.
 */
export function getRulesForLagna(lagnaKey: LagnaKey): RawRule[] {
  const cached = combinedCache.get(lagnaKey);
  if (cached) return cached;

  const bucket = BUNDLE.lagnaBuckets[lagnaKey] ?? [];
  const combined = [...bucket, ...BUNDLE.overrides];
  combinedCache.set(lagnaKey, combined);
  return combined;
}

// Exceptions/caveats bucket — kept separate; composer.ts may use these to
// annotate or soften fired rules (e.g. "Saturn aspects 8th house UNLESS
// Subathuvam").
export function getExceptionRules(): RawRule[] {
  return BUNDLE.exceptions;
}

export function getOverrideRules(): RawRule[] {
  return BUNDLE.overrides;
}

export function getBucketRules(lagnaKey: LagnaKey): RawRule[] {
  return BUNDLE.lagnaBuckets[lagnaKey] ?? [];
}

export function getBundleMeta(): { generatedAt: string; totalRules: number; lagnas: string[] } {
  return {
    generatedAt: BUNDLE.generatedAt,
    totalRules: BUNDLE.totalRules,
    lagnas: Object.keys(BUNDLE.lagnaBuckets).sort(),
  };
}

// Sanity check helper (used by test-composer.mts) — confirms all 12 lagnas
// from constants.ts RASIS have a non-empty rule bucket in the bundle.
export function verifyAllLagnasPresent(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (let i = 0; i < RASIS.length; i++) {
    const key = SIGN_INDEX_TO_LAGNA_KEY[i];
    if (!BUNDLE.lagnaBuckets[key] || BUNDLE.lagnaBuckets[key].length === 0) {
      missing.push(`${i}:${RASIS[i].en}(${key})`);
    }
  }
  return { ok: missing.length === 0, missing };
}
