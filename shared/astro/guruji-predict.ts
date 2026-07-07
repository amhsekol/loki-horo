// ===========================================================================
// Aditya Guruji Prediction Algorithm  (guruji-predict.ts)
// ---------------------------------------------------------------------------
// A direct, executable implementation of the "Tamil Astrology Prediction
// Algorithm" transcript. It runs the documented step-by-step engine against a
// real chart box and returns per-topic predictions.
//
// Execution order per the document (Section 11, Final Prediction Formula):
//   1. Build the lagna foundation (can the native receive results?)
//   2. Build the planet ledger (ownership + karakatva + placement + dignity)
//   3. Grade subathuvam / papathuvam (reuse analyzeGuruji's PlanetValu)
//   4. Read the active dasa-bhukthi-antara (LordReading from dasha-transit)
//   5. For each topic: mark event houses + karakas, judge natal promise,
//      check active period trigger, confirm with transit, apply special
//      filters (pathaka / maraka / ashtama / Rahu-Ketu / Saturn / Mercury),
//      and state a final result with a confidence level.
//
// Output shape follows Section 13 (Output Format for a Prediction):
//   Natal promise · Active period · Transit confirmation · Special rules ·
//   Final result · Caution.
//
// It ONLY reports rules that actually apply to the given chart — every line is
// grounded in a detected placement, so nothing generic is emitted.
//
// Pure and side-effect free so it can run in tsx dev, esbuild prod, and the
// browser off the same ChartResult the client already holds.
// ===========================================================================

import { GRAHAS, RASIS, RASI_LORDS, aspectFromTo, type Bilingual } from "./constants";
import type { PlanetPosition, DignityResult } from "./engine";
import type { GurujiAnalysis, PlanetValu } from "./guruji-analysis";

// Minimal shape of a running dasa lord we need (subset of LordReading).
export interface RunningLord {
  level: "maha" | "bhukti" | "antara";
  lordIndex: number;
  natalHouse: number;
  natalDignity: DignityResult | null;
}

export type Confidence =
  | "strong"
  | "moderate"
  | "weak"
  | "delayed"
  | "denied"
  | "conditional";

export type PredTone = "good" | "mixed" | "caution";

// A single line inside a prediction section (grounded, chart-specific).
export interface PredLine {
  text: Bilingual;
  tone?: PredTone;
}

// One topic's full prediction, in the document's output format.
export interface TopicPrediction {
  key: string;               // marriage | career | education | wealth | parents | longevity
  title: Bilingual;
  icon: string;              // lucide icon name (resolved client-side)
  natalPromise: PredLine[];  // what the birth chart allows or denies
  activePeriod: PredLine[];  // what the running dasa-bhukthi-antara is doing
  transit: PredLine[];       // gochara support
  specialRules: PredLine[];  // pathaka / maraka / ashtama / Rahu-Ketu / Saturn / Mercury
  finalResult: Bilingual;    // clear answer with confidence + timing
  confidence: Confidence;
  tone: PredTone;
  caution?: Bilingual;       // careful wording for sensitive topics
}

export interface PredictionReport {
  headline: Bilingual;
  foundation: {
    lines: PredLine[];       // lagna, lagna lord, 5th/9th, Moon
    canReceive: PredTone;    // overall capacity of the chart
  };
  topics: TopicPrediction[];
  disclaimer: Bilingual;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function houseOf(sign: number, lagna: number): number {
  return ((sign - lagna + 12) % 12) + 1;
}
function signAtHouse(house: number, lagna: number): number {
  return (lagna + (house - 1)) % 12;
}
function P(planets: PlanetPosition[], idx: number): PlanetPosition {
  return planets.find((p) => p.index === idx)!;
}
function nm(idx: number): Bilingual {
  return GRAHAS[idx];
}
function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
// Houses owned by a planet, from the lagna (1..12), e.g. [2, 9].
function housesOwned(idx: number, lagna: number): number[] {
  const out: number[] = [];
  for (let h = 1; h <= 12; h++) {
    if (RASI_LORDS[signAtHouse(h, lagna)] === idx) out.push(h);
  }
  return out;
}
// Dignity points helper (Rahu/Ketu → neutral 20).
function pts(p: PlanetPosition): number {
  return p.dignity?.points ?? 20;
}
// Net Sootchuma Valu of a planet from the guruji scoreboard.
function valuOf(g: GurujiAnalysis, idx: number): PlanetValu | undefined {
  return g.planets.find((v) => v.index === idx);
}
function net(g: GurujiAnalysis, idx: number): number {
  return valuOf(g, idx)?.net ?? 0;
}
const DUSTHANA = new Set([6, 8, 12]);
const KENDRA = new Set([1, 4, 7, 10]);
const TRIKONA = new Set([1, 5, 9]);

// Bilingual join helper for building sentences.
function bi(en: string, ta: string, hi: string): Bilingual {
  return { en, ta, hi };
}

// Karakatva (natural significations) per the document's karaka table.
const KARAKA: Record<number, Bilingual> = {
  0: bi("authority, father, leadership, fire", "அதிகாரம், தந்தை, தலைமை", "अधिकार, पिता, नेतृत्व"),
  1: bi("mind, mother, emotion, imagination", "மனம், தாய், உணர்வு", "मन, माता, भावना"),
  2: bi("energy, courage, technical/action, brother", "சக்தி, தைரியம், தொழில்நுட்பம்", "ऊर्जा, साहस, तकनीक"),
  3: bi("intellect, commerce, speech, analysis", "அறிவு, வணிகம், பேச்சு", "बुद्धि, वाणिज्य, वाणी"),
  4: bi("wisdom, teaching, children, dharma, wealth", "ஞானம், குரு, குழந்தை, தர்மம்", "ज्ञान, गुरु, संतान, धर्म"),
  5: bi("relationship, comfort, art, luxury, spouse", "உறவு, சுகம், கலை, மனைவி", "संबंध, सुख, कला, जीवनसाथी"),
  6: bi("labor, delay, discipline, service, longevity", "உழைப்பு, தாமதம், சேவை, ஆயுள்", "श्रम, विलंब, सेवा, आयु"),
  7: bi("ambition, foreign, obsession, illusion", "ஆசை, வெளிநாடு, மாயை", "महत्वाकांक्षा, विदेश, माया"),
  8: bi("detachment, moksha, sudden shifts", "பற்றின்மை, மோட்சம், திடீர் மாற்றம்", "वैराग्य, मोक्ष, अचानक बदलाव"),
};

// A short worded strength label from net valu.
function strengthWord(n: number): Bilingual {
  if (n >= 40) return bi("strong", "பலமான", "सशक्त");
  if (n >= 10) return bi("moderate", "மிதமான", "मध्यम");
  if (n >= -20) return bi("weak", "பலவீனமான", "कमजोर");
  return bi("afflicted", "பீடிக்கப்பட்ட", "पीड़ित");
}

function dignityWord(p: PlanetPosition): Bilingual {
  const d = p.dignity;
  if (!d) return bi("nodal (no dignity)", "சாயா (திசை இல்லை)", "छाया (कोई गरिमा नहीं)");
  return d.label;
}

// ---------------------------------------------------------------------------
// Foundation (Step 1 / B001–B004)
// ---------------------------------------------------------------------------

function buildFoundation(
  planets: PlanetPosition[],
  lagnaSign: number,
  moonSign: number,
  g: GurujiAnalysis,
): PredictionReport["foundation"] {
  const lines: PredLine[] = [];
  const lagnaLordIdx = RASI_LORDS[lagnaSign];
  const ll = P(planets, lagnaLordIdx);
  const llHouse = houseOf(ll.rasiIndex, lagnaSign);
  const llNet = net(g, lagnaLordIdx);

  // B001/B002 — lagna & lagna lord
  const llStrong = llNet >= 10 && pts(ll) >= 40;
  const llWeak = llNet < -20 || pts(ll) < 20 || DUSTHANA.has(llHouse);
  lines.push({
    text: bi(
      `Lagna is ${RASIS[lagnaSign].en}; its lord ${nm(lagnaLordIdx).en} sits in the ${ord(llHouse)} house in ${dignityWord(ll).en} (${strengthWord(llNet).en}). ${llStrong ? "A strong lagna lord lets the native enjoy good dasa and tolerate bad periods." : llWeak ? "A weak/afflicted lagna lord reduces the ability to hold good results and withstand hard dasa." : "The lagna lord is workable — results come with effort."}`,
      `லக்னம் ${RASIS[lagnaSign].ta}; அதிபதி ${nm(lagnaLordIdx).ta} ${llHouse}-ஆம் வீட்டில் ${dignityWord(ll).ta} (${strengthWord(llNet).ta}). ${llStrong ? "பலமான லக்னாதிபதி — நல்ல தசையை அனுபவிக்கவும், கெட்ட காலத்தைத் தாங்கவும் முடியும்." : llWeak ? "பலவீன/பீடிக்கப்பட்ட லக்னாதிபதி — நல்ல பலனைத் தாங்கும் திறன் குறையும்." : "லக்னாதிபதி மிதமானது — முயற்சியுடன் பலன்."}`,
      `लग्न ${RASIS[lagnaSign].en}; स्वामी ${nm(lagnaLordIdx).en} ${ord(llHouse)} भाव में ${dignityWord(ll).en} (${strengthWord(llNet).en})। ${llStrong ? "सशक्त लग्नेश शुभ दशा भोगने व कठिन काल सहने की क्षमता देता है।" : llWeak ? "कमजोर/पीड़ित लग्नेश परिणाम धारण करने की क्षमता घटाता है।" : "लग्नेश कार्यशील है — प्रयास से फल।"}`,
    ),
    tone: llStrong ? "good" : llWeak ? "caution" : "mixed",
  });

  // B003 — 5th & 9th lords (dharma, purva punya, fortune)
  const fifthIdx = RASI_LORDS[signAtHouse(5, lagnaSign)];
  const ninthIdx = RASI_LORDS[signAtHouse(9, lagnaSign)];
  const trikonaNet = (net(g, fifthIdx) + net(g, ninthIdx)) / 2;
  const trikonaStrong = trikonaNet >= 10;
  lines.push({
    text: bi(
      `5th lord ${nm(fifthIdx).en} and 9th lord ${nm(ninthIdx).en} carry purva-punya and fortune; together they are ${strengthWord(trikonaNet).en}. ${trikonaStrong ? "Strong trikona support protects the chart even under a hard dasa." : "Softer trikona support means fortune helps less against difficult periods."}`,
      `5-ஆம் அதிபதி ${nm(fifthIdx).ta} மற்றும் 9-ஆம் அதிபதி ${nm(ninthIdx).ta} — பூர்வ புண்ணியம், அதிர்ஷ்டம்; சேர்ந்து ${strengthWord(trikonaNet).ta}. ${trikonaStrong ? "பலமான திரிகோண ஆதரவு — கடினமான தசையிலும் ஜாதகத்தைக் காக்கும்." : "மென்மையான திரிகோணம் — கடினமான காலத்தில் அதிர்ஷ்டம் குறைவாக உதவும்."}`,
      `5वें स्वामी ${nm(fifthIdx).en} व 9वें स्वामी ${nm(ninthIdx).en} पूर्वपुण्य व भाग्य; संयुक्त रूप से ${strengthWord(trikonaNet).en}। ${trikonaStrong ? "सशक्त त्रिकोण कठिन दशा में भी रक्षा करता है।" : "कमजोर त्रिकोण कठिन काल में कम सहायता।"}`,
    ),
    tone: trikonaStrong ? "good" : "mixed",
  });

  // B004 — Moon / rasi lord (mental flow)
  const moon = P(planets, 1);
  const rasiLordIdx = RASI_LORDS[moonSign];
  const moonNet = net(g, 1);
  const moonAfflicted = moonNet < -10 || pts(moon) < 20;
  lines.push({
    text: bi(
      `Moon is in ${RASIS[moonSign].en} (rasi lord ${nm(rasiLordIdx).en}); the mind is ${strengthWord(moonNet).en}. ${moonAfflicted ? "An afflicted Moon can make results feel heavier emotionally." : "A supported Moon keeps the emotional experience of results steady."}`,
      `சந்திரன் ${RASIS[moonSign].ta} (ராசி அதிபதி ${nm(rasiLordIdx).ta}); மனம் ${strengthWord(moonNet).ta}. ${moonAfflicted ? "பீடிக்கப்பட்ட சந்திரன் — பலன்கள் மனதளவில் கனமாக உணரப்படும்." : "ஆதரவுள்ள சந்திரன் — பலன்களின் உணர்வு நிலையாக இருக்கும்."}`,
      `चंद्र ${RASIS[moonSign].en} में (राशि स्वामी ${nm(rasiLordIdx).en}); मन ${strengthWord(moonNet).en}। ${moonAfflicted ? "पीड़ित चंद्र फल को भावनात्मक रूप से भारी बना सकता है।" : "समर्थित चंद्र अनुभव को स्थिर रखता है।"}`,
    ),
    tone: moonAfflicted ? "caution" : "good",
  });

  const score = (llStrong ? 1 : llWeak ? -1 : 0) + (trikonaStrong ? 1 : 0) + (moonAfflicted ? -1 : 0);
  const canReceive: PredTone = score >= 1 ? "good" : score <= -1 ? "caution" : "mixed";
  return { lines, canReceive };
}

// ---------------------------------------------------------------------------
// Active-period & transit helpers (Steps 5–7, F/G rules)
// ---------------------------------------------------------------------------

// Do any of the running lords own / occupy / aspect one of the event houses?
// Returns the lords that "trigger" the topic and the reason.
function activeTriggers(
  running: RunningLord[],
  planets: PlanetPosition[],
  lagnaSign: number,
  eventHouses: number[],
  eventKarakas: number[],
): { lord: RunningLord; reasonEn: string; reasonTa: string; reasonHi: string }[] {
  const hits: { lord: RunningLord; reasonEn: string; reasonTa: string; reasonHi: string }[] = [];
  for (const L of running) {
    const owns = housesOwned(L.lordIndex, lagnaSign).filter((h) => eventHouses.includes(h));
    const occupies = eventHouses.includes(L.natalHouse);
    const isKaraka = eventKarakas.includes(L.lordIndex);
    // aspect onto any event house sign
    const lp = P(planets, L.lordIndex);
    const aspects = eventHouses.some((h) => aspectFromTo(L.lordIndex, lp.rasiIndex, signAtHouse(h, lagnaSign)) > 0);
    if (owns.length || occupies || isKaraka || aspects) {
      const bits: string[] = [];
      const bitsTa: string[] = [];
      const bitsHi: string[] = [];
      if (owns.length) { bits.push(`owns the ${owns.map(ord).join("/")}`); bitsTa.push(`${owns.join("/")}-ஐ ஆளுகிறது`); bitsHi.push(`${owns.join("/")} का स्वामी`); }
      if (occupies) { bits.push(`sits in the ${ord(L.natalHouse)}`); bitsTa.push(`${L.natalHouse}-ல் அமர்ந்துள்ளது`); bitsHi.push(`${L.natalHouse} में स्थित`); }
      if (isKaraka) { bits.push(`is the natural karaka`); bitsTa.push(`இயற்கை காரகன்`); bitsHi.push(`प्राकृतिक कारक`); }
      if (aspects && !owns.length && !occupies) { bits.push(`aspects the event houses`); bitsTa.push(`நிகழ்வு ஸ்தானங்களைப் பார்க்கிறது`); bitsHi.push(`भाव पर दृष्टि`); }
      hits.push({
        lord: L,
        reasonEn: `${L.level} lord ${nm(L.lordIndex).en} ${bits.join(", ")}`,
        reasonTa: `${L.level} அதிபதி ${nm(L.lordIndex).ta} ${bitsTa.join(", ")}`,
        reasonHi: `${L.level} स्वामी ${nm(L.lordIndex).en} ${bitsHi.join(", ")}`,
      });
    }
  }
  return hits;
}

function buildActivePeriod(
  running: RunningLord[],
  planets: PlanetPosition[],
  lagnaSign: number,
  g: GurujiAnalysis,
  eventHouses: number[],
  eventKarakas: number[],
): { lines: PredLine[]; triggered: boolean } {
  const lines: PredLine[] = [];
  const hits = activeTriggers(running, planets, lagnaSign, eventHouses, eventKarakas);
  if (!hits.length) {
    lines.push({
      text: bi(
        `None of the running dasa-bhukthi-antara lords directly own, occupy, or aspect the event houses — the current period does not strongly trigger this area.`,
        `இயங்கும் தசா-புக்தி-அந்தர அதிபதிகள் நிகழ்வு ஸ்தானங்களை நேரடியாகத் தொடவில்லை — தற்போதைய காலம் இந்த விஷயத்தை வலுவாகத் தூண்டவில்லை.`,
        `चालू दशा-भुक्ति-अंतर स्वामी घटना भावों को सीधे स्पर्श नहीं करते — वर्तमान काल इस क्षेत्र को प्रबल रूप से सक्रिय नहीं करता।`,
      ),
      tone: "mixed",
    });
    return { lines, triggered: false };
  }
  for (const h of hits) {
    const n = net(g, h.lord.lordIndex);
    const good = n >= 10;
    lines.push({
      text: bi(
        `${h.reasonEn}, so it activates this area. That lord is ${strengthWord(n).en}, so the trigger tends ${good ? "favourable" : n < -20 ? "obstructed" : "mixed"}.`,
        `${h.reasonTa}, ஆகவே இந்த விஷயத்தைத் தூண்டுகிறது. அந்த அதிபதி ${strengthWord(n).ta}, எனவே தூண்டல் ${good ? "சாதகமாக" : n < -20 ? "தடையுடன்" : "கலப்பாக"} உள்ளது.`,
        `${h.reasonHi}, अतः यह क्षेत्र सक्रिय होता है। वह स्वामी ${strengthWord(n).en}, अतः प्रभाव ${good ? "अनुकूल" : n < -20 ? "बाधित" : "मिश्रित"}।`,
      ),
      tone: good ? "good" : n < -20 ? "caution" : "mixed",
    });
  }
  return { lines, triggered: true };
}

// G-rules transit confirmation (uses running lords' current transit disposition
// is not available here; we use natal dignity of running lords + Jupiter shield
// as a proxy, plus the double-transit tone passed in from the caller).
function buildTransit(
  saturnPhaseTone: PredTone,
  jupiterShields: boolean,
): PredLine[] {
  const lines: PredLine[] = [];
  lines.push({
    text: bi(
      `Gochara confirmation: the current Saturn double-transit phase reads ${saturnPhaseTone === "good" ? "supportive" : saturnPhaseTone === "caution" ? "cautious" : "mixed"} (G001 — natal promise + dasa say if/when, transit says whether it manifests now).`,
      `கோசார உறுதி: தற்போதைய சனி இரட்டை கோச்சார நிலை ${saturnPhaseTone === "good" ? "ஆதரவாக" : saturnPhaseTone === "caution" ? "எச்சரிக்கையாக" : "கலப்பாக"} உள்ளது (G001).`,
      `गोचर पुष्टि: वर्तमान शनि द्विगोचर चरण ${saturnPhaseTone === "good" ? "सहायक" : saturnPhaseTone === "caution" ? "सतर्क" : "मिश्रित"} (G001)।`,
    ),
    tone: saturnPhaseTone,
  });
  if (jupiterShields) {
    lines.push({
      text: bi(
        `Jupiter's aspect provides a protective shield (G003) — do not ignore it even when other factors look negative.`,
        `குருவின் பார்வை பாதுகாப்புக் கவசம் தருகிறது (G003) — மற்ற காரணிகள் எதிர்மறையாக இருந்தாலும் புறக்கணிக்க வேண்டாம்.`,
        `गुरु की दृष्टि रक्षात्मक कवच देती है (G003) — अन्य कारक नकारात्मक होने पर भी उपेक्षा न करें।`,
      ),
      tone: "good",
    });
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Special filters (Section 10 / S-rules) — only emitted when they apply
// ---------------------------------------------------------------------------

function pathakadhipathi(lagnaSign: number): number {
  const element = lagnaSign % 3; // 0 movable, 1 fixed, 2 dual
  const bhadhakaHouse = element === 0 ? 11 : element === 1 ? 9 : 7;
  return RASI_LORDS[signAtHouse(bhadhakaHouse, lagnaSign)];
}

function specialFilters(
  planets: PlanetPosition[],
  lagnaSign: number,
  g: GurujiAnalysis,
  eventHouses: number[],
  topic: string,
): PredLine[] {
  const lines: PredLine[] = [];
  const sani = P(planets, 6);
  const merc = P(planets, 3);

  // Pathaka filter (S001) — only if pathakadhipathi touches an event house.
  const pathIdx = pathakadhipathi(lagnaSign);
  const pathP = P(planets, pathIdx);
  const pathHouse = houseOf(pathP.rasiIndex, lagnaSign);
  const pathTouches = eventHouses.includes(pathHouse) ||
    housesOwned(pathIdx, lagnaSign).some((h) => eventHouses.includes(h)) ||
    eventHouses.some((h) => aspectFromTo(pathIdx, pathP.rasiIndex, signAtHouse(h, lagnaSign)) > 0);
  if (pathTouches) {
    const retro = pathP.retrograde;
    lines.push({
      text: bi(
        `Pathaka filter (S001/S002): pathakadhipathi ${nm(pathIdx).en} is linked to these houses${retro ? ", but being retrograde it may give ordinary lordship trouble rather than pure pathaka" : ", so sudden mind-shaking disturbance can surface in its own dasa"}.`,
        `பாதக வடிகட்டி (S001/S002): பாதகாதிபதி ${nm(pathIdx).ta} இந்த ஸ்தானங்களுடன் இணைந்துள்ளது${retro ? "; வக்கிரம் ஆகையால் தூய பாதகத்திற்குப் பதிலாக சாதாரண பலன் தரலாம்" : "; சொந்த தசையில் திடீர் மனக்கலக்கம் வரலாம்"}.`,
        `पाधक फ़िल्टर (S001/S002): पाधकाधिपति ${nm(pathIdx).en} इन भावों से जुड़ा है${retro ? "; वक्री होने से शुद्ध पाधक के बजाय सामान्य कष्ट" : "; अपनी दशा में अचानक मानसिक विक्षोभ"}।`,
      ),
      tone: "caution",
    });
  }

  // Maraka filter (L003) — 2nd/7th lords touching event houses (esp. longevity/wealth).
  if (topic === "longevity" || topic === "wealth" || eventHouses.includes(2) || eventHouses.includes(7)) {
    const m2 = RASI_LORDS[signAtHouse(2, lagnaSign)];
    const m7 = RASI_LORDS[signAtHouse(7, lagnaSign)];
    lines.push({
      text: bi(
        `Maraka note (L003): 2nd lord ${nm(m2).en} and 7th lord ${nm(m7).en} are the common marakas for this lagna; weigh their dasa-bhukthi before finalising sensitive timing.`,
        `மாரக குறிப்பு (L003): 2-ஆம் அதிபதி ${nm(m2).ta}, 7-ஆம் அதிபதி ${nm(m7).ta} — இந்த லக்னத்திற்கு பொது மாரகர்கள்; உணர்திறன் காலத்தை முடிவு செய்வதற்கு முன் தசா-புக்தியை நிறுத்திப் பாருங்கள்.`,
        `मारक टिप्पणी (L003): 2रे स्वामी ${nm(m2).en} व 7वें स्वामी ${nm(m7).en} इस लग्न के सामान्य मारक; संवेदनशील समय से पहले उनकी दशा-भुक्ति तौलें।`,
      ),
      tone: "mixed",
    });
  }

  // Ashtama Shani caution (J003) — Saturn transiting/placed 8th from Moon or lagna
  // (proxy: natal Saturn in 8th house), only for career.
  if (topic === "career") {
    const saniHouse = houseOf(sani.rasiIndex, lagnaSign);
    if (saniHouse === 8 || saniHouse === 10 || saniHouse === 6) {
      lines.push({
        text: bi(
          `Ashtama/heavy-Saturn caution (J003): Saturn's placement can make a job obtained under stress temporary, punishment-like, or foreign-trouble-related — verify the period carefully.`,
          `அஷ்டம/கன சனி எச்சரிக்கை (J003): சனியின் நிலை — அழுத்தத்தில் கிடைக்கும் வேலை தற்காலிகமாகவோ, தண்டனை போலவோ, வெளிநாட்டுத் தொல்லையாகவோ இருக்கலாம்.`,
          `अष्टम/भारी-शनि सावधानी (J003): शनि की स्थिति से तनाव में मिली नौकरी अस्थायी या दंड-जैसी हो सकती है।`,
        ),
        tone: "caution",
      });
    }
  }

  // Saturn protective exception (S003) — Saturn with good net + Jupiter aspect.
  const saniNet = net(g, 6);
  const jupSeesSani = aspectFromTo(4, P(planets, 4).rasiIndex, sani.rasiIndex) > 0;
  if (saniNet >= 10 && jupSeesSani) {
    lines.push({
      text: bi(
        `Saturn exception (S003): Saturn carries subathuvam and is seen by Jupiter, so its aspect here works protectively rather than harmfully.`,
        `சனி விதிவிலக்கு (S003): சனிக்கு சுபத்துவம் உண்டு, குரு பார்வையும் உண்டு — ஆகவே அதன் பார்வை தீங்கு அல்லாமல் பாதுகாப்பாக செயல்படுகிறது.`,
        `शनि अपवाद (S003): शनि में शुभत्व है और गुरु दृष्टि है — अतः इसकी दृष्टि रक्षात्मक रूप से कार्य करती है।`,
      ),
      tone: "good",
    });
  }

  // Mercury filter (S006) — for education, grade Mercury's subathuvam level.
  if (topic === "education") {
    const mNet = net(g, 3);
    const jupWithMerc = P(planets, 4).rasiIndex === merc.rasiIndex || aspectFromTo(4, P(planets, 4).rasiIndex, merc.rasiIndex) > 0;
    const level = mNet >= 40 ? "high-level intellectual" : mNet >= 10 ? "moderate" : "limited";
    lines.push({
      text: bi(
        `Mercury filter (S006/ED002): Mercury grades as ${level}${jupWithMerc ? " with Jupiter support (a strong boost)" : ""} — this shapes education and analytical ability.`,
        `புதன் வடிகட்டி (S006/ED002): புதன் ${level === "high-level intellectual" ? "உயர் அறிவுத்திறன்" : level === "moderate" ? "மிதமான" : "வரம்புக்குட்பட்ட"}${jupWithMerc ? ", குரு ஆதரவுடன் (பலமான உயர்வு)" : ""} — கல்வி/பகுப்பாய்வுத் திறனை வடிவமைக்கிறது.`,
        `बुध फ़िल्टर (S006/ED002): बुध ${level === "high-level intellectual" ? "उच्च बौद्धिक" : level === "moderate" ? "मध्यम" : "सीमित"}${jupWithMerc ? ", गुरु समर्थन सहित" : ""} — शिक्षा/विश्लेषण क्षमता को आकार देता है।`,
      ),
      tone: mNet >= 10 ? "good" : "mixed",
    });
  }

  // Rahu/Ketu filter (S008) — if a node sits in an event house, note substitution.
  for (const node of [7, 8]) {
    const np = P(planets, node);
    const nh = houseOf(np.rasiIndex, lagnaSign);
    if (eventHouses.includes(nh)) {
      const dispIdx = RASI_LORDS[np.rasiIndex];
      lines.push({
        text: bi(
          `Node filter (S008): ${nm(node).en} occupies the ${ord(nh)} (an event house) and has no independent karakatva — judge it through its dispositor ${nm(dispIdx).en} and any planets joined/aspecting it.`,
          `சாயா வடிகட்டி (S008): ${nm(node).ta} ${nh}-ஆம் ஸ்தானத்தில் (நிகழ்வு வீடு); சொந்த காரகத்துவம் இல்லை — அதிபதி ${nm(dispIdx).ta} வழியாகவும் இணைந்த/பார்க்கும் கிரகங்கள் வழியாகவும் கணிக்கவும்.`,
          `छाया फ़िल्टर (S008): ${nm(node).en} ${ord(nh)} भाव में; स्वतंत्र कारकत्व नहीं — दिशपति ${nm(dispIdx).en} व युत/दृष्ट ग्रहों से विचार करें।`,
        ),
        tone: "mixed",
      });
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Confidence + final-result synthesis
// ---------------------------------------------------------------------------

function synthConfidence(
  natalScore: number,   // -2..+2 : does the chart promise it
  triggered: boolean,   // does the running period activate it
  activeTone: PredTone,
  denialFlag: boolean,  // hard denial from natal
): { confidence: Confidence; tone: PredTone } {
  if (denialFlag) return { confidence: "denied", tone: "caution" };
  if (natalScore >= 1 && triggered && activeTone === "good") return { confidence: "strong", tone: "good" };
  if (natalScore >= 1 && !triggered) return { confidence: "delayed", tone: "mixed" };
  if (natalScore <= -1 && triggered) return { confidence: "conditional", tone: "mixed" };
  if (natalScore <= -1) return { confidence: "weak", tone: "caution" };
  return { confidence: "moderate", tone: "mixed" };
}

const CONF_WORD: Record<Confidence, Bilingual> = {
  strong: bi("Strong", "பலமான", "प्रबल"),
  moderate: bi("Moderate", "மிதமான", "मध्यम"),
  weak: bi("Weak", "பலவீனமான", "कमजोर"),
  delayed: bi("Delayed", "தாமதம்", "विलंबित"),
  denied: bi("Denied/severely limited", "மறுக்கப்பட்ட/மிகக் குறைவு", "अस्वीकृत/अत्यल्प"),
  conditional: bi("Conditional", "நிபந்தனை", "सशर्त"),
};

// ---------------------------------------------------------------------------
// Event modules (Section 9)
// ---------------------------------------------------------------------------

interface ModuleSpec {
  key: string;
  title: Bilingual;
  icon: string;
  houses: number[];
  karakas: number[];
  sensitive?: boolean;
}

const MODULES: ModuleSpec[] = [
  { key: "marriage", title: bi("Marriage / Relationship", "திருமணம் / உறவு", "विवाह / संबंध"), icon: "Heart", houses: [7, 2, 11, 12], karakas: [5] },
  { key: "career", title: bi("Career / Job", "தொழில் / வேலை", "करियर / नौकरी"), icon: "Briefcase", houses: [10, 6, 2, 11], karakas: [0, 3, 6] },
  { key: "education", title: bi("Education / Intelligence", "கல்வி / அறிவு", "शिक्षा / बुद्धि"), icon: "GraduationCap", houses: [4, 5], karakas: [3, 4] },
  { key: "wealth", title: bi("Wealth / Speech / Family", "செல்வம் / பேச்சு / குடும்பம்", "धन / वाणी / परिवार"), icon: "Coins", houses: [2, 11], karakas: [4, 5] },
  { key: "parents", title: bi("Parents", "பெற்றோர்", "माता-पिता"), icon: "Users", houses: [9, 4], karakas: [0, 1] },
  { key: "longevity", title: bi("Longevity (sensitive)", "ஆயுள் (உணர்திறன்)", "आयु (संवेदनशील)"), icon: "HeartPulse", houses: [1, 8, 2, 7], karakas: [6], sensitive: true },
];

function moduleNatalPromise(
  spec: ModuleSpec,
  planets: PlanetPosition[],
  lagnaSign: number,
  g: GurujiAnalysis,
): { lines: PredLine[]; score: number; denial: boolean } {
  const lines: PredLine[] = [];
  let score = 0;
  let denial = false;

  // Primary house + its lord + karaka health.
  const primaryHouse = spec.houses[0];
  const houseLordIdx = RASI_LORDS[signAtHouse(primaryHouse, lagnaSign)];
  const hlNet = net(g, houseLordIdx);
  const hl = P(planets, houseLordIdx);
  const hlHouse = houseOf(hl.rasiIndex, lagnaSign);
  const hlInDusthana = DUSTHANA.has(hlHouse);
  score += hlNet >= 10 ? 1 : hlNet < -20 ? -1 : 0;
  // Provisional hard-denial flag: primary-house lord badly afflicted AND in a
  // dusthana. This is only a candidate — it is confirmed at the end ONLY if no
  // strong karaka offsets it, so a single weak lord never blanket-denies a
  // topic that the karakas still support (per the document's whole-picture,
  // never-fear-based method).
  let hardDenialCandidate = hlNet < -20 && hlInDusthana;

  lines.push({
    text: bi(
      `${ord(primaryHouse)} house governs this; its lord ${nm(houseLordIdx).en} is ${strengthWord(hlNet).en} and sits in the ${ord(hlHouse)}${hlInDusthana ? " (a dusthana — a weakening placement)" : ""}.`,
      `${primaryHouse}-ஆம் ஸ்தானம் இதை ஆளுகிறது; அதிபதி ${nm(houseLordIdx).ta} ${strengthWord(hlNet).ta}, ${hlHouse}-ல் அமர்ந்துள்ளது${hlInDusthana ? " (துஸ்தானம் — பலவீனம்)" : ""}.`,
      `${ord(primaryHouse)} भाव इसका कारक; स्वामी ${nm(houseLordIdx).en} ${strengthWord(hlNet).en}, ${ord(hlHouse)} में${hlInDusthana ? " (दुस्थान — कमजोरी)" : ""}।`,
    ),
    tone: hlNet >= 10 ? "good" : hlNet < -20 ? "caution" : "mixed",
  });

  // Karakas health.
  for (const k of spec.karakas) {
    const kNet = net(g, k);
    const kp = P(planets, k);
    const kh = houseOf(kp.rasiIndex, lagnaSign);
    score += kNet >= 10 ? 1 : kNet < -20 ? -1 : 0;
    lines.push({
      text: bi(
        `Karaka ${nm(k).en} (${KARAKA[k].en}) is ${strengthWord(kNet).en} in the ${ord(kh)}.`,
        `காரகன் ${nm(k).ta} (${KARAKA[k].ta}) ${strengthWord(kNet).ta}, ${kh}-ல்.`,
        `कारक ${nm(k).en} (${KARAKA[k].en}) ${strengthWord(kNet).en}, ${ord(kh)} में।`,
      ),
      tone: kNet >= 10 ? "good" : kNet < -20 ? "caution" : "mixed",
    });
  }

  // Topic-specific promise notes.
  if (spec.key === "marriage") {
    // M003 — marriage event vs marital comfort separate.
    const twelfthLord = RASI_LORDS[signAtHouse(12, lagnaSign)];
    lines.push({
      text: bi(
        `Marriage event and marital comfort are separate (M003): weigh the 7th for the event, but the 12th, Venus and 2nd for thambathya sukham (comfort).`,
        `திருமணம் நடப்பதும் தாம்பத்திய சுகமும் தனித்தனி (M003): 7-ஐ நிகழ்விற்கும், 12/சுக்கிரன்/2-ஐ தாம்பத்திய சுகத்திற்கும் எடைபோடவும்.`,
        `विवाह घटना व दांपत्य सुख भिन्न (M003): 7वें से घटना, 12/शुक्र/2 से सुख देखें।`,
      ),
      tone: "mixed",
    });
  }
  if (spec.key === "longevity") {
    // L001 — four longevity pillars, rough 30 each / 120.
    const llIdx = RASI_LORDS[lagnaSign];
    const eighthIdx = RASI_LORDS[signAtHouse(8, lagnaSign)];
    const pillars = [
      { label: bi("Lagna", "லக்னம்", "लग्न"), n: net(g, llIdx) },
      { label: bi("Lagna lord", "லக்னாதிபதி", "लग्नेश"), n: net(g, llIdx) },
      { label: bi("8th lord", "8-ஆம் அதிபதி", "8वें स्वामी"), n: net(g, eighthIdx) },
      { label: bi("Ayul karaka Saturn", "ஆயுட்காரகன் சனி", "आयुष्कारक शनि"), n: net(g, 6) },
    ];
    const marks = pillars.reduce((a, p) => a + Math.max(0, Math.min(30, 15 + p.n / 4)), 0);
    lines.push({
      text: bi(
        `Four longevity pillars (L001): Lagna, lagna lord, 8th lord ${nm(eighthIdx).en}, and ayul karaka Saturn — rough combined score ≈ ${Math.round(marks)} / 120. Higher supports a fuller life-frame; this is a study estimate, never a death forecast.`,
        `நான்கு ஆயுள் தூண்கள் (L001): லக்னம், லக்னாதிபதி, 8-ஆம் அதிபதி ${nm(eighthIdx).ta}, ஆயுட்காரகன் சனி — தோராயமாக ≈ ${Math.round(marks)} / 120. இது படிப்பு மதிப்பீடு மட்டுமே; மரண கணிப்பு அல்ல.`,
        `चार आयु-स्तंभ (L001): लग्न, लग्नेश, 8वें स्वामी ${nm(eighthIdx).en}, आयुष्कारक शनि — मोटा योग ≈ ${Math.round(marks)} / 120। यह अध्ययन अनुमान है, मृत्यु-भविष्यवाणी नहीं।`,
      ),
      tone: marks >= 70 ? "good" : marks >= 45 ? "mixed" : "caution",
    });
  }

  // Confirm denial only when the house lord is badly afflicted in a dusthana
  // AND the overall promise (lord + karakas) has not been lifted to neutral or
  // better by a strong karaka. If a karaka rescues the score to >= 0, downgrade
  // to a limited/weak reading rather than an outright denial.
  denial = hardDenialCandidate && score < 0;
  return { lines, score: Math.max(-2, Math.min(2, score)), denial };
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function computePredictions(input: {
  planets: PlanetPosition[];
  lagnaSign: number;
  moonSign: number;
  guruji: GurujiAnalysis;
  running: RunningLord[];       // running maha/bhukti/antara (0..3 entries)
  saturnPhaseTone: PredTone;    // from double-transit
}): PredictionReport {
  const { planets, lagnaSign, moonSign, guruji, running, saturnPhaseTone } = input;

  const foundation = buildFoundation(planets, lagnaSign, moonSign, guruji);

  // Jupiter shield check (global): does Jupiter aspect the lagna?
  const jup = P(planets, 4);
  const jupiterShieldsLagna = aspectFromTo(4, jup.rasiIndex, lagnaSign) > 0 || jup.rasiIndex === lagnaSign;

  const topics: TopicPrediction[] = MODULES.map((spec) => {
    const np = moduleNatalPromise(spec, planets, lagnaSign, guruji);
    const ap = buildActivePeriod(running, planets, lagnaSign, guruji, spec.houses, spec.karakas);
    const tr = buildTransit(saturnPhaseTone, jupiterShieldsLagna);
    const sr = specialFilters(planets, lagnaSign, guruji, spec.houses, spec.key);

    const activeTone: PredTone =
      ap.lines.some((l) => l.tone === "good") && !ap.lines.some((l) => l.tone === "caution")
        ? "good"
        : ap.lines.some((l) => l.tone === "caution")
        ? "caution"
        : "mixed";
    const { confidence, tone } = synthConfidence(np.score, ap.triggered, activeTone, np.denial);

    const finalResult = buildFinalResult(spec, confidence, np.score, ap.triggered, saturnPhaseTone);
    const caution = spec.sensitive
      ? bi(
          "This is a study reading of the longevity frame only. It is not a death prediction — treat with care and confirm any sensitive timing with a qualified astrologer.",
          "இது ஆயுள் அமைப்பின் படிப்பு மட்டுமே. மரண கணிப்பு அல்ல — கவனமாகக் கையாளவும், உணர்திறன் காலத்தைத் தகுதியான ஜோதிடரிடம் உறுதி செய்யவும்.",
          "यह केवल आयु-ढाँचे का अध्ययन है। मृत्यु-भविष्यवाणी नहीं — सावधानी बरतें और संवेदनशील समय की पुष्टि योग्य ज्योतिषी से करें।",
        )
      : undefined;

    return {
      key: spec.key,
      title: spec.title,
      icon: spec.icon,
      natalPromise: np.lines,
      activePeriod: ap.lines,
      transit: tr,
      specialRules: sr,
      finalResult,
      confidence,
      tone,
      caution,
    };
  });

  const headline = bi(
    `Chart-driven predictions across ${MODULES.length} life areas, built with Aditya Guruji's step-by-step algorithm: natal promise → active dasa-bhukthi → transit → special filters → result.`,
    `${MODULES.length} வாழ்க்கைத் துறைகளில் ஜாதக அடிப்படையிலான கணிப்புகள் — ஆதித்யா குருஜியின் படிப்படியான முறை: ஜாதக வாக்குறுதி → இயங்கும் தசா-புக்தி → கோசாரம் → சிறப்பு வடிகட்டிகள் → முடிவு.`,
    `${MODULES.length} जीवन-क्षेत्रों में कुंडली-आधारित भविष्यवाणी — आदित्य गुरुजी की चरणबद्ध विधि: जन्म-वचन → चालू दशा-भुक्ति → गोचर → विशेष फ़िल्टर → परिणाम।`,
  );

  const disclaimer = bi(
    "Rules are applied only where the chart activates them. Predictions blend natal promise, active dasa-bhukthi-antara, and transit; treat sensitive topics gently and avoid fear-based conclusions.",
    "ஜாதகம் தூண்டும் இடங்களில் மட்டுமே விதிகள் பயன்படுத்தப்படுகின்றன. கணிப்புகள் ஜாதக வாக்குறுதி, இயங்கும் தசா-புக்தி-அந்தரம், கோசாரம் ஆகியவற்றின் கலவை; உணர்திறன் விஷயங்களை மென்மையாகக் கையாளவும்.",
    "नियम केवल वहीं लागू जहाँ कुंडली उन्हें सक्रिय करती है। भविष्यवाणी जन्म-वचन, चालू दशा-भुक्ति-अंतर व गोचर का मिश्रण; संवेदनशील विषयों को सौम्यता से लें।",
  );

  return { headline, foundation, topics, disclaimer };
}

function buildFinalResult(
  spec: ModuleSpec,
  confidence: Confidence,
  natalScore: number,
  triggered: boolean,
  saturnPhaseTone: PredTone,
): Bilingual {
  const cw = CONF_WORD[confidence];
  const timingEn = triggered
    ? saturnPhaseTone === "good"
      ? "the current period supports activity here"
      : "the current period touches this area, though transit is mixed"
    : "the current period is quieter for this area; a future dasa of the relevant lords is likelier";
  const timingTa = triggered
    ? saturnPhaseTone === "good"
      ? "தற்போதைய காலம் இதை ஆதரிக்கிறது"
      : "தற்போதைய காலம் இதைத் தொடுகிறது, ஆனால் கோசாரம் கலப்பு"
    : "தற்போதைய காலம் அமைதி; தொடர்புடைய அதிபதிகளின் எதிர்கால தசை பொருத்தமானது";
  const timingHi = triggered
    ? saturnPhaseTone === "good"
      ? "वर्तमान काल इसका समर्थन करता है"
      : "वर्तमान काल इसे स्पर्श करता है, पर गोचर मिश्रित"
    : "वर्तमान काल शांत; संबंधित स्वामियों की भावी दशा अधिक उपयुक्त";

  const promiseEn = natalScore >= 1 ? "The chart clearly promises this area" : natalScore <= -1 ? "The chart gives limited/obstructed promise here" : "The chart gives a workable but mixed promise";
  const promiseTa = natalScore >= 1 ? "ஜாதகம் இதைத் தெளிவாக வாக்களிக்கிறது" : natalScore <= -1 ? "ஜாதகம் வரம்புக்குட்பட்ட/தடையான வாக்குறுதி" : "ஜாதகம் செயல்படக்கூடிய, கலப்பு வாக்குறுதி";
  const promiseHi = natalScore >= 1 ? "कुंडली इसका स्पष्ट वचन देती है" : natalScore <= -1 ? "कुंडली सीमित/बाधित वचन देती है" : "कुंडली कार्यशील पर मिश्रित वचन देती है";

  return bi(
    `${cw.en} — ${promiseEn}; ${timingEn}.`,
    `${cw.ta} — ${promiseTa}; ${timingTa}.`,
    `${cw.hi} — ${promiseHi}; ${timingHi}.`,
  );
}
