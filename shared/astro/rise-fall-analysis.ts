// ============================================================================
// RISE · SURPRISE · FALL — KN Rao's political-prediction framework
// ============================================================================
// This module implements the predictive method summarised from K.N. Rao's work
// on the astrology of political rise, surprise and fall. Unlike knrao-analysis.ts
// (which applies Rao's Jaimini/Chara-dasha techniques to personal life), this
// module applies his *three-stage public-outcome* method:
//
//   1. YOGA STRENGTH  — count Rajayogas (kendra+trikona lord links, Dhana &
//      Adhi yogas). Many → high rise potential; some → moderate; few → ordinary.
//   2. DOUBLE-TRANSIT — how transiting Jupiter & Saturn currently relate to the
//      10th house/lord (the four patterns Rao names):
//        • Saturn blesses & Jupiter gives         → strong support
//        • Saturn torments & Jupiter protects     → mixed, protected
//        • Saturn torments & Jupiter withdraws    → danger
//        • Saturn & Jupiter combine to destroy    → fall
//   3. DASHA TIMING   — the running maha/antar/pratyantar lords are the windows
//      in which the yoga+transit pattern actually manifests.
//
// House focus follows Rao: 10th (office/power), 8th (sudden upheaval / surprise),
// 12th (loss / exit), 3rd (initiative, communication, controversy).
//
// The synthesis produces one Outcome class — RISE / SURPRISE / FALL — with a
// confidence band, plus the per-stage findings that justify it.
//
// Planet indices: 0=Sun 1=Moon 2=Mars 3=Mercury 4=Jupiter 5=Venus 6=Saturn 7=Rahu 8=Ketu
// Sign indices:   0=Aries .. 11=Pisces
// ----------------------------------------------------------------------------

import type { Bilingual } from "./constants";
import { GRAHAS, RASIS, RASI_LORDS, aspectFromTo } from "./constants";
import type { PlanetPosition } from "./engine";
import type { DashaTimeline } from "./dasha";
import type { Tone, Finding } from "./knrao-analysis";

// Re-export the shared verdict types so the UI can import from one place.
export type { Tone, Finding } from "./knrao-analysis";

export type OutcomeClass = "rise" | "surprise" | "fall";
export type YogaStrength = "strong" | "moderate" | "ordinary";
export type TransitPattern =
  | "bless-give"        // Saturn blesses & Jupiter gives
  | "torment-protect"   // Saturn torments & Jupiter protects
  | "torment-withdraw"  // Saturn torments & Jupiter withdraws protection
  | "combine-destroy"   // Saturn & Jupiter combine to destroy
  | "neutral";          // neither strongly touches the 10th

export interface RiseFallStage {
  key: string;
  title: Bilingual;
  findings: Finding[];
}

export interface RiseFallResult {
  outcome: OutcomeClass;
  outcomeLabel: Bilingual;
  headline: Bilingual;
  confidence: number;          // 0..100 rough confidence in the reading
  yogaStrength: YogaStrength;
  yogaCount: number;
  transitPattern: TransitPattern;
  houseFocus: number[];        // e.g. [10, 8, 12]
  stages: RiseFallStage[];     // Yogas, Double-transit, Dasha, Synthesis
  disclaimer: Bilingual;
}

// ---- helpers ---------------------------------------------------------------

const KENDRA = new Set([1, 4, 7, 10]);
const TRIKONA = new Set([1, 5, 9]);
const DUSTHANA = new Set([6, 8, 12]);

/** House (1..12) of a sign counted from the lagna sign. */
function houseOf(sign: number, lagna: number): number {
  return ((sign - lagna + 12) % 12) + 1;
}
/** The sign occupying `house` (1..12) counted from the lagna. */
function signAtHouse(house: number, lagna: number): number {
  return (lagna + house - 1) % 12;
}
/** Sign index where planet `idx` sits. */
function signOfPlanet(planets: PlanetPosition[], idx: number): number {
  return planets.find((p) => p.index === idx)!.rasiIndex;
}
/** Are two planets in the same sign (conjunct)? */
function conjunct(planets: PlanetPosition[], a: number, b: number): boolean {
  return signOfPlanet(planets, a) === signOfPlanet(planets, b);
}
/** Does planet `from` aspect the sign `toSign`? (uses classical special aspects) */
function aspects(planets: PlanetPosition[], from: number, toSign: number): boolean {
  return aspectFromTo(from, signOfPlanet(planets, from), toSign) > 0;
}

// ============================================================================
// STAGE 1 — YOGA STRENGTH (Rajayoga count)
// ============================================================================
// Rao ranks the horoscope first by its Rajayogas. We approximate the count with
// the well-known formative yogas: kendra-lord ↔ trikona-lord association,
// exchange/conjunction/aspect; benefics in kendras (Adhi/Gaja-kesari style);
// and lords placed in their own kendra/trikona.

function analyzeYogas(
  planets: PlanetPosition[],
  lagna: number,
): { strength: YogaStrength; count: number; findings: Finding[] } {
  const findings: Finding[] = [];
  let count = 0;

  const lordOf = (house: number) => RASI_LORDS[signAtHouse(house, lagna)];
  const kendraLords = Array.from(KENDRA).map(lordOf);
  const trikonaLords = Array.from(TRIKONA).map(lordOf);

  // 1a. Kendra-lord ↔ Trikona-lord Rajayoga (conjunction / mutual aspect).
  const seen = new Set<string>();
  for (const kl of kendraLords) {
    for (const tl of trikonaLords) {
      if (kl === tl) continue; // same planet lording both — counts once below
      const pairKey = [kl, tl].sort((a, b) => a - b).join("-");
      if (seen.has(pairKey)) continue;
      const klSign = signOfPlanet(planets, kl);
      const tlSign = signOfPlanet(planets, tl);
      const isConj = klSign === tlSign;
      const klAspTl = aspectFromTo(kl, klSign, tlSign) > 0;
      const tlAspKl = aspectFromTo(tl, tlSign, klSign) > 0;
      if (isConj || (klAspTl && tlAspKl)) {
        seen.add(pairKey);
        count++;
        findings.push({
          title: {
            ta: "ராஜயோகம் — கேந்திர/திரிகோண அதிபர்",
            en: "Rajayoga — Kendra + Trikona lords linked",
            hi: "राजयोग — केंद्र व त्रिकोण स्वामी संबंध",
          },
          verdict: {
            ta: `${GRAHAS[kl].ta} மற்றும் ${GRAHAS[tl].ta} ${isConj ? "இணைந்துள்ளனர்" : "ஒருவரையொருவர் பார்க்கின்றனர்"} — உயர்வுக்கான வலுவான யோகம்.`,
            en: `${GRAHAS[kl].en} and ${GRAHAS[tl].en} are ${isConj ? "conjunct" : "in mutual aspect"} — a strong yoga for rise.`,
            hi: `${GRAHAS[kl].hi ?? GRAHAS[kl].en} व ${GRAHAS[tl].hi ?? GRAHAS[tl].en} ${isConj ? "युति में" : "परस्पर दृष्टि में"} — उन्नति का प्रबल योग।`,
          },
          tone: "good",
          reasons: [{
            ta: "கேந்திராதிபதி + திரிகோணாதிபதி தொடர்பு ராஜயோகம் ஆகும்.",
            en: "A kendra lord tied to a trikona lord forms a classic Rajayoga.",
            hi: "केंद्र स्वामी का त्रिकोण स्वामी से संबंध शास्त्रीय राजयोग है।",
          }],
        });
      }
    }
  }

  // 1b. A single planet owning both a kendra and a trikona (yogakaraka).
  for (let p = 0; p <= 6; p++) {
    const owns = [1, 4, 5, 7, 9, 10].map((h) => lordOf(h));
    const ownsKendra = [1, 4, 7, 10].some((h) => lordOf(h) === p);
    const ownsTrikona = [5, 9].some((h) => lordOf(h) === p); // 1 counts as both
    if (ownsKendra && ownsTrikona) {
      count++;
      findings.push({
        title: {
          ta: "யோககாரகன்",
          en: "Yogakaraka planet",
          hi: "योगकारक ग्रह",
        },
        verdict: {
          ta: `${GRAHAS[p].ta} கேந்திரம் மற்றும் திரிகோணம் இரண்டையும் ஆளுகிறார் — உள்ளார்ந்த ராஜயோகம்.`,
          en: `${GRAHAS[p].en} owns both a kendra and a trikona — an inbuilt Rajayoga (yogakaraka).`,
          hi: `${GRAHAS[p].hi ?? GRAHAS[p].en} केंद्र व त्रिकोण दोनों का स्वामी है — अंतर्निहित राजयोग (योगकारक)।`,
        },
        tone: "good",
        reasons: [{
          ta: "ஒரே கிரகம் கேந்திரம் + திரிகோணம் ஆளுவது சிறந்த ராஜயோக காரகம்.",
          en: "One planet ruling a kendra and a trikona is a powerful yogakaraka.",
          hi: "एक ही ग्रह का केंद्र व त्रिकोण स्वामी होना प्रबल योगकारक है।",
        }],
      });
    }
  }

  // 1c. Adhi-yoga style — benefics (Jup 4, Ven 5, Mer 3) strong in kendras/trikonas.
  const benefics = [4, 5, 3];
  const strongBenefics = benefics.filter((b) => {
    const h = houseOf(signOfPlanet(planets, b), lagna);
    return KENDRA.has(h) || TRIKONA.has(h);
  });
  if (strongBenefics.length >= 2) {
    count++;
    findings.push({
      title: {
        ta: "சுபகிரக பலம் (அதி யோகம்)",
        en: "Benefics in kendra/trikona (Adhi-yoga type)",
        hi: "केंद्र/त्रिकोण में शुभ ग्रह (अधि-योग)",
      },
      verdict: {
        ta: `${strongBenefics.map((b) => GRAHAS[b].ta).join(", ")} கேந்திர/திரிகோணத்தில் — நிலையான உயர்வுக்கு ஆதரவு.`,
        en: `${strongBenefics.map((b) => GRAHAS[b].en).join(", ")} occupy kendras/trikonas — support for sustained rise.`,
        hi: `${strongBenefics.map((b) => GRAHAS[b].hi ?? GRAHAS[b].en).join(", ")} केंद्र/त्रिकोण में — स्थायी उन्नति का समर्थन।`,
      },
      tone: "good",
      reasons: [{
        ta: "கேந்திர/திரிகோணத்தில் உள்ள சுபகிரகங்கள் அந்தஸ்தை நிலைநிறுத்துகின்றன.",
        en: "Benefics anchored in kendras/trikonas stabilise status and standing.",
        hi: "केंद्र/त्रिकोण में शुभ ग्रह स्थिति व प्रतिष्ठा को स्थिर करते हैं।",
      }],
    });
  }

  // 1d. Dhana / power — 10th lord well placed (kendra/trikona, not dusthana).
  const tenthLord = lordOf(10);
  const tenthLordHouse = houseOf(signOfPlanet(planets, tenthLord), lagna);
  if (KENDRA.has(tenthLordHouse) || TRIKONA.has(tenthLordHouse)) {
    count++;
    findings.push({
      title: {
        ta: "வலுவான 10-ம் அதிபர்",
        en: "10th lord strongly placed",
        hi: "दशम स्वामी प्रबल स्थान में",
      },
      verdict: {
        ta: `10-ம் அதிபர் ${GRAHAS[tenthLord].ta} ${tenthLordHouse}-ம் பாவத்தில் — அதிகாரம்/பதவிக்கு சாதகம்.`,
        en: `10th lord ${GRAHAS[tenthLord].en} sits in house ${tenthLordHouse} — favourable for office and authority.`,
        hi: `दशम स्वामी ${GRAHAS[tenthLord].hi ?? GRAHAS[tenthLord].en} भाव ${tenthLordHouse} में — पद व अधिकार हेतु शुभ।`,
      },
      tone: "good",
      reasons: [{
        ta: "10-ம் அதிபர் கேந்திரம்/திரிகோணத்தில் இருப்பது தொழில் உயர்வைத் தருகிறது.",
        en: "The 10th lord in a kendra or trikona lifts career and public standing.",
        hi: "दशम स्वामी का केंद्र/त्रिकोण में होना करियर व सार्वजनिक स्थिति बढ़ाता है।",
      }],
    });
  } else if (DUSTHANA.has(tenthLordHouse)) {
    findings.push({
      title: {
        ta: "10-ம் அதிபர் துர்ஸ்தானத்தில்",
        en: "10th lord in a dusthana",
        hi: "दशम स्वामी दुःस्थान में",
      },
      verdict: {
        ta: `10-ம் அதிபர் ${GRAHAS[tenthLord].ta} ${tenthLordHouse}-ம் பாவத்தில் — பதவிக்கு சவால்.`,
        en: `10th lord ${GRAHAS[tenthLord].en} falls in house ${tenthLordHouse} — a challenge to office.`,
        hi: `दशम स्वामी ${GRAHAS[tenthLord].hi ?? GRAHAS[tenthLord].en} भाव ${tenthLordHouse} में — पद हेतु चुनौती।`,
      },
      tone: "caution",
      reasons: [{
        ta: "6/8/12-ல் உள்ள 10-ம் அதிபர் தொழில் இடையூறுகளை உணர்த்தலாம்.",
        en: "A 10th lord in 6/8/12 can signal obstacles or reversals in office.",
        hi: "6/8/12 में दशम स्वामी पद में बाधा या उलटफेर दर्शा सकता है।",
      }],
    });
  }

  const strength: YogaStrength = count >= 4 ? "strong" : count >= 2 ? "moderate" : "ordinary";

  if (findings.length === 0) {
    findings.push({
      title: { ta: "குறிப்பிடத்தக்க ராஜயோகம் இல்லை", en: "No prominent Rajayoga", hi: "कोई प्रमुख राजयोग नहीं" },
      verdict: {
        ta: "வலுவான ராஜயோகங்கள் காணப்படவில்லை — சாதாரண உயர்வு சாத்தியம்.",
        en: "No strong Rajayogas detected — an ordinary rise is more likely.",
        hi: "कोई प्रबल राजयोग नहीं मिला — सामान्य उन्नति अधिक संभावित।",
      },
      tone: "info",
      reasons: [],
    });
  }

  return { strength, count, findings };
}

// ============================================================================
// STAGE 2 — JUPITER–SATURN DOUBLE-TRANSIT
// ============================================================================
// Rao's rule: watch how transiting Jupiter and Saturn jointly touch the crucial
// point (here the natal 10th house and its lord). "Touch" = transiting planet
// occupies or aspects that sign. We classify the current sky against the natal
// 10th to name one of the four patterns.

function analyzeDoubleTransit(
  natalPlanets: PlanetPosition[],
  lagna: number,
  transitJupiterSign: number,
  transitSaturnSign: number,
): { pattern: TransitPattern; findings: Finding[] } {
  const findings: Finding[] = [];
  const tenthSign = signAtHouse(10, lagna);
  const tenthLord = RASI_LORDS[tenthSign];
  const tenthLordSign = signOfPlanet(natalPlanets, tenthLord);

  // Does a transiting planet in `tSign` touch (occupy/aspect) `targetSign`?
  const touches = (planetIdx: number, tSign: number, targetSign: number) =>
    tSign === targetSign || aspectFromTo(planetIdx, tSign, targetSign) > 0;

  const jupTouches10 = touches(4, transitJupiterSign, tenthSign) || touches(4, transitJupiterSign, tenthLordSign);
  const satTouches10 = touches(6, transitSaturnSign, tenthSign) || touches(6, transitSaturnSign, tenthLordSign);

  // Saturn's relation to the 10th from the 10th sign (Rao weighs Saturn's role):
  // Saturn transiting 3rd/6th/11th from a point is "upachaya" (constructive),
  // while transiting 1st/8th/12th from it (sade-sati-like) is "tormenting".
  const satHouseFrom10 = ((transitSaturnSign - tenthSign + 12) % 12) + 1;
  const satConstructive = [3, 6, 11].includes(satHouseFrom10);
  const satBlesses = satTouches10 && satConstructive;
  const satTorments = satTouches10 && !satConstructive;
  const jupGives = jupTouches10;

  let pattern: TransitPattern;
  if (satBlesses && jupGives) pattern = "bless-give";
  else if (satTorments && jupGives) pattern = "torment-protect";
  else if (satTorments && !jupGives) pattern = "torment-withdraw";
  else if (satTouches10 && !satConstructive && !jupGives) pattern = "combine-destroy";
  else pattern = "neutral";

  // Refine "combine-destroy": both touch and neither is constructive.
  if (satTouches10 && jupTouches10 && !satConstructive) {
    // Jupiter present but Saturn tormenting: protection still applies unless
    // Jupiter itself is debilitated in transit sign (Capricorn = 9). Keep it as
    // torment-protect; only both-malefic emphasis flips to destroy.
    if (transitJupiterSign === 9 /* Capricorn: Jupiter debilitated */) pattern = "combine-destroy";
  }

  const PATTERN_TEXT: Record<TransitPattern, { title: Bilingual; verdict: Bilingual; tone: Tone }> = {
    "bless-give": {
      title: { ta: "சனி வாழ்த்த, குரு வழங்க", en: "Saturn blesses & Jupiter gives", hi: "शनि आशीर्वाद, गुरु देते हैं" },
      verdict: {
        ta: "சனி ஆக்கபூர்வமாகவும் குரு அருளுடனும் 10-ம் இடத்தைத் தொடுகின்றனர் — உயர்வுக்கு வலுவான ஆதரவு.",
        en: "Saturn touches the 10th constructively while Jupiter blesses it — strong support for rise.",
        hi: "शनि रचनात्मक रूप से व गुरु कृपा से दशम को स्पर्श करते हैं — उन्नति का प्रबल समर्थन।",
      },
      tone: "good",
    },
    "torment-protect": {
      title: { ta: "சனி துன்புறுத்த, குரு காக்க", en: "Saturn torments & Jupiter protects", hi: "शनि कष्ट, गुरु रक्षा" },
      verdict: {
        ta: "சனியின் அழுத்தம் இருந்தாலும் குருவின் பார்வை பாதுகாக்கிறது — சவால்கள், ஆனால் காக்கப்படுகிறீர்கள்.",
        en: "Saturn presses on the 10th but Jupiter's touch protects — challenges, yet you are shielded.",
        hi: "शनि दशम पर दबाव डालते हैं पर गुरु की दृष्टि रक्षा करती है — चुनौती, फिर भी सुरक्षा।",
      },
      tone: "mixed",
    },
    "torment-withdraw": {
      title: { ta: "சனி துன்புறுத்த, குரு விலக", en: "Saturn torments & Jupiter withdraws", hi: "शनि कष्ट, गुरु दूर" },
      verdict: {
        ta: "சனி 10-ம் இடத்தை அழுத்துகிறார், குருவின் காப்பு இல்லை — கவனமும் பொறுமையும் தேவை.",
        en: "Saturn strains the 10th and Jupiter offers no protection — a period needing caution.",
        hi: "शनि दशम पर दबाव, गुरु की रक्षा अनुपस्थित — सावधानी का समय।",
      },
      tone: "caution",
    },
    "combine-destroy": {
      title: { ta: "சனி + குரு சேர்ந்து சேதம்", en: "Saturn & Jupiter combine to destroy", hi: "शनि व गुरु मिलकर हानि" },
      verdict: {
        ta: "இரு பெரு கிரகங்களும் 10-ம் இடத்திற்கு எதிராகச் செயல்படுகின்றன — பதவி/அதிகாரத்திற்கு பெரும் அபாயம்.",
        en: "Both great planets act against the 10th — serious risk to office or authority.",
        hi: "दोनों बड़े ग्रह दशम के विरुद्ध — पद या अधिकार हेतु गंभीर जोखिम।",
      },
      tone: "caution",
    },
    "neutral": {
      title: { ta: "இரட்டை கோச்சாரம் நடுநிலை", en: "Double-transit neutral", hi: "द्वि-गोचर तटस्थ" },
      verdict: {
        ta: "தற்போது குரு/சனி 10-ம் இடத்தை வலுவாகத் தொடவில்லை — கோச்சாரம் நடுநிலையானது.",
        en: "Jupiter and Saturn do not strongly touch the 10th right now — the transit is neutral.",
        hi: "अभी गुरु व शनि दशम को प्रबलता से स्पर्श नहीं करते — गोचर तटस्थ है।",
      },
      tone: "info",
    },
  };

  const pt = PATTERN_TEXT[pattern];
  findings.push({
    title: pt.title,
    verdict: pt.verdict,
    tone: pt.tone,
    reasons: [
      {
        ta: `கோச்சார குரு: ${RASIS[transitJupiterSign].ta.split(" (")[0]} · கோச்சார சனி: ${RASIS[transitSaturnSign].ta.split(" (")[0]}.`,
        en: `Transit Jupiter in ${RASIS[transitJupiterSign].en.split(" (")[0]}, transit Saturn in ${RASIS[transitSaturnSign].en.split(" (")[0]}.`,
        hi: `गोचर गुरु ${RASIS[transitJupiterSign].hi ?? RASIS[transitJupiterSign].en.split(" (")[0]}, गोचर शनि ${RASIS[transitSaturnSign].hi ?? RASIS[transitSaturnSign].en.split(" (")[0]}।`,
      },
      {
        ta: `10-ம் இடம்: ${RASIS[tenthSign].ta.split(" (")[0]} (அதிபர் ${GRAHAS[tenthLord].ta}).`,
        en: `Natal 10th sign ${RASIS[tenthSign].en.split(" (")[0]} (lord ${GRAHAS[tenthLord].en}).`,
        hi: `जन्म दशम राशि ${RASIS[tenthSign].hi ?? RASIS[tenthSign].en.split(" (")[0]} (स्वामी ${GRAHAS[tenthLord].hi ?? GRAHAS[tenthLord].en})।`,
      },
    ],
  });

  return { pattern, findings };
}

// ============================================================================
// STAGE 3 — DASHA TIMING (maha / antar / pratyantar)
// ============================================================================

interface RunningDasha {
  maha?: { lordIndex: number; end: Date };
  antar?: { lordIndex: number; end: Date };
  pratyantar?: { lordIndex: number; end: Date };
}

function findRunningDasha(dasha: DashaTimeline, now: Date): RunningDasha {
  const t = now.getTime();
  const out: RunningDasha = {};
  const maha = dasha.periods.find((p) => p.start.getTime() <= t && p.end.getTime() > t);
  if (!maha) return out;
  out.maha = { lordIndex: maha.lordIndex, end: maha.end };
  const antar = maha.children?.find((c) => c.start.getTime() <= t && c.end.getTime() > t);
  if (!antar) return out;
  out.antar = { lordIndex: antar.lordIndex, end: antar.end };
  const praty = antar.children?.find((c) => c.start.getTime() <= t && c.end.getTime() > t);
  if (praty) out.pratyantar = { lordIndex: praty.lordIndex, end: praty.end };
  return out;
}

// Is a dasha lord "rise-favouring" for this chart? A lord that is a benefic, a
// yogakaraka, or lord of a kendra/trikona (esp. 9th/10th) tends to elevate; a
// lord tied to dusthanas (6/8/12) or a natural malefic in a dusthana tends to fall.
function dashaLordScore(
  planets: PlanetPosition[],
  lagna: number,
  lordIndex: number,
): { score: number; note: Bilingual } {
  if (lordIndex === 7 || lordIndex === 8) {
    // Rahu/Ketu — nodes; treat by house they sit in.
    const h = houseOf(signOfPlanet(planets, lordIndex), lagna);
    if (DUSTHANA.has(h)) return { score: -1, note: {
      ta: `${GRAHAS[lordIndex].ta} ${h}-ம் பாவத்தில் — கலக்கம்/திடீர் மாற்றம்.`,
      en: `${GRAHAS[lordIndex].en} in house ${h} — upheaval or sudden change.`,
      hi: `${GRAHAS[lordIndex].hi ?? GRAHAS[lordIndex].en} भाव ${h} में — उथल-पुथल या अचानक परिवर्तन।`,
    } };
    return { score: 0, note: {
      ta: `${GRAHAS[lordIndex].ta} ${h}-ம் பாவத்தில் — கணிக்க முடியாத, திடீர் பலன்.`,
      en: `${GRAHAS[lordIndex].en} in house ${h} — unpredictable, sudden results.`,
      hi: `${GRAHAS[lordIndex].hi ?? GRAHAS[lordIndex].en} भाव ${h} में — अप्रत्याशित, अचानक फल।`,
    } };
  }

  const ownedHouses = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(
    (h) => RASI_LORDS[signAtHouse(h, lagna)] === lordIndex,
  );
  const ownHouse = houseOf(signOfPlanet(planets, lordIndex), lagna);
  let score = 0;
  const reasons: string[] = [];

  // Owns benefic houses?
  if (ownedHouses.some((h) => [9, 10].includes(h))) { score += 2; reasons.push("9/10"); }
  if (ownedHouses.some((h) => [1, 4, 5].includes(h))) { score += 1; reasons.push("kendra/trikona"); }
  if (ownedHouses.some((h) => [6, 8, 12].includes(h))) { score -= 1; reasons.push("6/8/12"); }

  // Sits in a good/bad house?
  if (KENDRA.has(ownHouse) || TRIKONA.has(ownHouse)) score += 1;
  if (DUSTHANA.has(ownHouse)) score -= 1;

  const noteBits = {
    ta: `${GRAHAS[lordIndex].ta} ${ownHouse}-ம் பாவத்தில்${ownedHouses.length ? `, ${ownedHouses.join("/")}-ஐ ஆளுகிறார்` : ""}.`,
    en: `${GRAHAS[lordIndex].en} sits in house ${ownHouse}${ownedHouses.length ? `, ruling ${ownedHouses.join("/")}` : ""}.`,
    hi: `${GRAHAS[lordIndex].hi ?? GRAHAS[lordIndex].en} भाव ${ownHouse} में${ownedHouses.length ? `, ${ownedHouses.join("/")} का स्वामी` : ""}।`,
  };
  return { score, note: noteBits };
}

function analyzeDasha(
  planets: PlanetPosition[],
  lagna: number,
  dasha: DashaTimeline,
  now: Date,
): { findings: Finding[]; timingScore: number } {
  const running = findRunningDasha(dasha, now);
  const findings: Finding[] = [];
  let timingScore = 0;

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const levels: { key: string; label: Bilingual; node?: { lordIndex: number; end: Date } }[] = [
    { key: "maha", label: { ta: "மகாதசை", en: "Mahadasha", hi: "महादशा" }, node: running.maha },
    { key: "antar", label: { ta: "அந்தர்தசை (புக்தி)", en: "Antardasha (Bhukti)", hi: "अंतर्दशा (भुक्ति)" }, node: running.antar },
    { key: "praty", label: { ta: "பிரத்யந்தர்தசை", en: "Pratyantardasha", hi: "प्रत्यंतर्दशा" }, node: running.pratyantar },
  ];

  const weights: Record<string, number> = { maha: 3, antar: 2, praty: 1 };
  for (const lvl of levels) {
    if (!lvl.node) continue;
    const { score, note } = dashaLordScore(planets, lagna, lvl.node.lordIndex);
    timingScore += score * weights[lvl.key];
    const tone: Tone = score >= 2 ? "good" : score <= -1 ? "caution" : score === 0 ? "info" : "mixed";
    findings.push({
      title: { ...lvl.label },
      verdict: {
        ta: `${GRAHAS[lvl.node.lordIndex].ta} தசை (${fmt(lvl.node.end)} வரை) — ${score >= 2 ? "உயர்வுக்கு சாதகம்" : score <= -1 ? "சவால் நிறைந்தது" : "கலப்பு பலன்"}.`,
        en: `${GRAHAS[lvl.node.lordIndex].en} period (until ${fmt(lvl.node.end)}) — ${score >= 2 ? "favours rise" : score <= -1 ? "challenging" : "mixed"}.`,
        hi: `${GRAHAS[lvl.node.lordIndex].hi ?? GRAHAS[lvl.node.lordIndex].en} दशा (${fmt(lvl.node.end)} तक) — ${score >= 2 ? "उन्नति हेतु शुभ" : score <= -1 ? "चुनौतीपूर्ण" : "मिश्रित"}।`,
      },
      tone,
      reasons: [note],
    });
  }

  if (findings.length === 0) {
    findings.push({
      title: { ta: "இயங்கும் தசை காணப்படவில்லை", en: "No running dasha found", hi: "वर्तमान दशा नहीं मिली" },
      verdict: {
        ta: "தற்போதைய தேதிக்கு தசை வரம்பு கிடைக்கவில்லை.",
        en: "No dasha window matched the current date.",
        hi: "वर्तमान तिथि हेतु कोई दशा अवधि नहीं मिली।",
      },
      tone: "info",
      reasons: [],
    });
  }

  return { findings, timingScore };
}

// ============================================================================
// SYNTHESIS — Outcome class
// ============================================================================

const OUTCOME_LABEL: Record<OutcomeClass, Bilingual> = {
  rise: { ta: "உயர்வு (Rise)", en: "Rise", hi: "उन्नति (Rise)" },
  surprise: { ta: "எதிர்பாராதது (Surprise)", en: "Surprise", hi: "आश्चर्य (Surprise)" },
  fall: { ta: "வீழ்ச்சி (Fall)", en: "Fall", hi: "पतन (Fall)" },
};

export function analyzeRiseFall(
  planets: PlanetPosition[],
  lagna: number,
  dasha: DashaTimeline,
  transitJupiterSign: number,
  transitSaturnSign: number,
  now: Date = new Date(),
): RiseFallResult {
  const yoga = analyzeYogas(planets, lagna);
  const transit = analyzeDoubleTransit(planets, lagna, transitJupiterSign, transitSaturnSign);
  const timing = analyzeDasha(planets, lagna, dasha, now);

  // Score each stage on a comparable scale.
  const yogaScore = yoga.strength === "strong" ? 3 : yoga.strength === "moderate" ? 1 : -1;
  const transitScore =
    transit.pattern === "bless-give" ? 3 :
    transit.pattern === "torment-protect" ? 0 :
    transit.pattern === "torment-withdraw" ? -2 :
    transit.pattern === "combine-destroy" ? -3 : 0;
  const timingScore = Math.max(-3, Math.min(3, timing.timingScore / 2));

  const total = yogaScore + transitScore + timingScore;

  // House focus: 10th always; add 8th when sudden/nodal timing; 12th when falling; 3rd for initiative.
  const houseFocus = [10];
  const running = findRunningDasha(dasha, now);
  const nodalTiming = [running.maha?.lordIndex, running.antar?.lordIndex, running.pratyantar?.lordIndex]
    .some((l) => l === 7 || l === 8);

  // Decide the outcome class.
  let outcome: OutcomeClass;
  if (total <= -3) { outcome = "fall"; houseFocus.push(12, 8); }
  else if (nodalTiming || (transit.pattern !== "bless-give" && yoga.strength === "strong")) {
    // Strong latent potential but disturbed / nodal window → surprise (abrupt turns).
    outcome = "surprise"; houseFocus.push(8);
  } else if (total >= 3) { outcome = "rise"; houseFocus.push(9); }
  else if (total <= -1) { outcome = "fall"; houseFocus.push(12); }
  else { outcome = total >= 1 ? "rise" : "surprise"; houseFocus.push(total >= 1 ? 9 : 8); }
  // 3rd house focus when Mars/Mercury dasha (initiative/communication) is running.
  if ([running.maha?.lordIndex, running.antar?.lordIndex].some((l) => l === 2 || l === 3)) {
    if (!houseFocus.includes(3)) houseFocus.push(3);
  }

  // Confidence: agreement across the three stages raises confidence.
  const signs = [Math.sign(yogaScore), Math.sign(transitScore), Math.sign(timingScore)];
  const agree = Math.abs(signs.reduce((a, b) => a + b, 0));
  const confidence = Math.round(45 + agree * 12 + Math.min(15, Math.abs(total) * 3));

  const headline: Bilingual = {
    ta: `${OUTCOME_LABEL[outcome].ta} — யோகம் (${yoga.count}) + இரட்டை கோச்சாரம் + தசை காலம் இணைந்த முடிவு.`,
    en: `${OUTCOME_LABEL[outcome].en} — a synthesis of yoga strength (${yoga.count}), the Jupiter–Saturn double-transit, and the running dasha.`,
    hi: `${OUTCOME_LABEL[outcome].hi ?? OUTCOME_LABEL[outcome].en} — योग-बल (${yoga.count}), गुरु–शनि द्वि-गोचर व वर्तमान दशा का संयुक्त निष्कर्ष।`,
  };

  const synthesisFindings: Finding[] = [{
    title: {
      ta: "மூன்று நிலை ஒருங்கிணைப்பு",
      en: "Three-stage synthesis",
      hi: "त्रि-स्तरीय संयोजन",
    },
    verdict: headline,
    tone: outcome === "rise" ? "good" : outcome === "fall" ? "caution" : "mixed",
    reasons: [
      {
        ta: `யோக வலு: ${yoga.strength === "strong" ? "வலுவானது" : yoga.strength === "moderate" ? "நடுத்தரம்" : "சாதாரணம்"} (${yoga.count} யோகங்கள்).`,
        en: `Yoga strength: ${yoga.strength} (${yoga.count} yogas).`,
        hi: `योग-बल: ${yoga.strength === "strong" ? "प्रबल" : yoga.strength === "moderate" ? "मध्यम" : "सामान्य"} (${yoga.count} योग)।`,
      },
      {
        ta: `இரட்டை கோச்சார அமைப்பு: ${transit.findings[0] ? "" : ""}${transitScore >= 0 ? "ஆதரவு" : "எதிர்மறை"}.`,
        en: `Double-transit contribution: ${transitScore >= 0 ? "supportive" : "adverse"}.`,
        hi: `द्वि-गोचर योगदान: ${transitScore >= 0 ? "सहायक" : "प्रतिकूल"}।`,
      },
      {
        ta: `தசை காலம்: ${timingScore >= 1 ? "சாதகம்" : timingScore <= -1 ? "சவால்" : "நடுநிலை"}.`,
        en: `Dasha timing: ${timingScore >= 1 ? "favourable" : timingScore <= -1 ? "challenging" : "neutral"}.`,
        hi: `दशा काल: ${timingScore >= 1 ? "अनुकूल" : timingScore <= -1 ? "चुनौतीपूर्ण" : "तटस्थ"}।`,
      },
      {
        ta: `கவனப் பாவங்கள்: ${houseFocus.join(", ")}.`,
        en: `House focus: ${houseFocus.join(", ")}.`,
        hi: `भाव केंद्र: ${houseFocus.join(", ")}।`,
      },
    ],
  }];

  return {
    outcome,
    outcomeLabel: OUTCOME_LABEL[outcome],
    headline,
    confidence: Math.max(35, Math.min(92, confidence)),
    yogaStrength: yoga.strength,
    yogaCount: yoga.count,
    transitPattern: transit.pattern,
    houseFocus,
    stages: [
      { key: "yogas", title: { ta: "1. யோகங்கள் (ராஜயோக வலு)", en: "1. Yogas (Rajayoga strength)", hi: "1. योग (राजयोग बल)" }, findings: yoga.findings },
      { key: "transit", title: { ta: "2. குரு–சனி இரட்டை கோச்சாரம்", en: "2. Jupiter–Saturn double-transit", hi: "2. गुरु–शनि द्वि-गोचर" }, findings: transit.findings },
      { key: "dasha", title: { ta: "3. தசை காலக்கணிப்பு", en: "3. Dasha timing", hi: "3. दशा काल-गणना" }, findings: timing.findings },
      { key: "synthesis", title: { ta: "முடிவு — உயர்வு / எதிர்பாராதது / வீழ்ச்சி", en: "Verdict — Rise / Surprise / Fall", hi: "निष्कर्ष — उन्नति / आश्चर्य / पतन" }, findings: synthesisFindings },
    ],
    disclaimer: {
      ta: "இது கே.என். ராவின் அரசியல் ரைஸ்/சர்ப்ரைஸ்/ஃபால் முறையின் அடிப்படையிலான பொதுவான வழிகாட்டுதல் மட்டுமே; உறுதியான கணிப்பு அல்ல.",
      en: "This applies K.N. Rao's political Rise/Surprise/Fall method as general guidance based on classical rules — not a guaranteed prediction.",
      hi: "यह के.एन. राव की राजनीतिक उन्नति/आश्चर्य/पतन पद्धति पर आधारित सामान्य मार्गदर्शन है — निश्चित भविष्यवाणी नहीं।",
    },
  };
}
