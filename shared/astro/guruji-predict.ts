// ===========================================================================
// Aditya Guruji Prediction Algorithm — v3 FULL  (guruji-predict.ts)
// ---------------------------------------------------------------------------
// A score-based, conclusion-based executable engine implementing the
// "Tamil Astrology Prediction Algorithm v3 FULL" transcript.
//
// The key difference from a factor-list approach (the previous version) is that
// this engine COMPOSES everything into ONE net conclusion per topic. It does
// NOT say "good in one planet, bad in another, so maybe both." It calculates:
//
//   • Three separate scores per key planet:
//       - Strength   (dignity + house + digbala + retro/hidden)   0..100
//       - Subathuvam (benefic protection)                          0..100
//       - Papathuvam (malefic pressure)                            0..100
//   • Override rules that RESHAPE those scores before conclusion:
//       - Guru/Sukran aspect FLOOR      (§3): clean benefic aspect → suba ≥ 50
//       - Saturn mitigation override    (§4): Guru/Sukran protect Sani → papa↓, suba floor 55-60/50-55
//       - Rahu/Sukran transfer          (§9): Sukran+Rahu → Sukran polluted, Rahu inherits Sukran suba
//       - Puthan/Sukran 12th module     (§10): good only for 12th-type themes
//       - Mercury high-subathuvam       (§11): conditional benefic, boosted by Guru/Sukran/bright Moon
//   • A PRIORITY LADDER (§5) that resolves the mixed picture into one verdict:
//       1 promise → 2 dasa active → 3 bhukthi/antara → 4 lagna capacity →
//       5 suba/papa quality → 6 special overrides → 7 gochara timing.
//   • ONE final label per topic (§14):
//       Good / Mixed-good / Mixed-bad / Bad / Delayed / Dormant / Not-promised
//     plus the top 3-5 deciding reasons, a score summary, timing, and confidence.
//
// Every number and reason is grounded in a real placement in the given chart.
// Pure & side-effect free (runs in tsx dev, esbuild prod, and the browser).
// ===========================================================================

import { GRAHAS, RASIS, RASI_LORDS, aspectFromTo, type Bilingual } from "./constants";
import type { PlanetPosition, DignityResult } from "./engine";
import type { GurujiAnalysis, PlanetValu } from "./guruji-analysis";

// Minimal shape of a running dasa lord (subset of LordReading).
export interface RunningLord {
  level: "maha" | "bhukti" | "antara";
  lordIndex: number;
  natalHouse: number;
  natalDignity: DignityResult | null;
}

// v3 §14 — the seven allowed final labels. This is the single conclusion.
export type Verdict =
  | "good"
  | "mixed-good"
  | "mixed-bad"
  | "bad"
  | "delayed"
  | "dormant"
  | "not-promised";

// Confidence (v3 §14.6): high if natal+dasa+transit agree, medium if two, low if one.
export type Confidence = "high" | "medium" | "low";

export type PredTone = "good" | "mixed" | "caution";

export interface PredLine {
  text: Bilingual;
  tone?: PredTone;
}

// Per-planet three-score row (v3 §2 + §6). This is the collapsible "math".
export interface ScoreRow {
  index: number;
  name: Bilingual;
  role: Bilingual;        // e.g. "7th lord", "karaka Venus", "lagna lord"
  strength: number;       // 0..100
  subathuvam: number;     // 0..100 (after floors/overrides)
  papathuvam: number;     // 0..100 (after mitigation)
  net: number;            // suba - papa
  floored?: boolean;      // Guru/Sukran floor was applied
  note?: Bilingual;       // the deciding note for this planet
}

// An override rule that actually fired for this topic (v3 §3/§4/§9/§10/§11).
export interface AppliedOverride {
  code: string;           // "GS-FLOOR" | "SANI-MIT" | "RAHU-TRANSFER" | ...
  text: Bilingual;
  tone: PredTone;
}

// One topic's fully-composed prediction (v3 §14 template).
export interface TopicPrediction {
  key: string;
  title: Bilingual;
  icon: string;

  verdict: Verdict;             // THE single conclusion
  verdictReason: Bilingual;     // one-line "net result is X because ..."
  confidence: Confidence;

  topReasons: PredLine[];       // §14.2 — top 3-5 deciding rules (plain language)
  scoreRows: ScoreRow[];        // §14.3 — key planet Strength/Suba/Papa (collapsible)
  overrides: AppliedOverride[]; // fired special rules (collapsible)
  timing: Bilingual;            // §14.4 — dasa/bhukthi/antara/gochara
  eventDetail: Bilingual;       // §14.5 — what improves / delays / is damaged / protected

  caution?: Bilingual;          // sensitive topics only
  tone: PredTone;               // card colour
}

export interface PredictionReport {
  headline: Bilingual;
  foundation: {
    lines: PredLine[];
    canReceive: PredTone;
    capacityScore: number;      // -3..+3, feeds the ladder step 4
  };
  topics: TopicPrediction[];
  disclaimer: Bilingual;
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function houseOf(sign: number, lagna: number): number { return ((sign - lagna + 12) % 12) + 1; }
function signAtHouse(house: number, lagna: number): number { return (lagna + (house - 1)) % 12; }
function P(planets: PlanetPosition[], idx: number): PlanetPosition { return planets.find((p) => p.index === idx)!; }
function nm(idx: number): Bilingual { return GRAHAS[idx]; }
function ord(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function ordBi(n: number): Bilingual {
  return { en: ord(n), ta: `${n}-ஆம்`, hi: `${ord(n)}` };
}
function housesOwned(idx: number, lagna: number): number[] {
  const out: number[] = [];
  for (let h = 1; h <= 12; h++) if (RASI_LORDS[signAtHouse(h, lagna)] === idx) out.push(h);
  return out;
}
function pts(p: PlanetPosition): number { return p.dignity?.points ?? 20; }
function valuOf(g: GurujiAnalysis, idx: number): PlanetValu | undefined { return g.planets.find((v) => v.index === idx); }
const DUSTHANA = new Set([6, 8, 12]);
const KENDRA = new Set([1, 4, 7, 10]);
const TRIKONA = new Set([1, 5, 9]);
const UPACHAYA = new Set([3, 6, 10, 11]);

function bi(en: string, ta: string, hi: string): Bilingual { return { en, ta, hi }; }

// Directional-strength (digbala) house per planet (from guruji-analysis).
const DIKBALA_HOUSE: Record<number, number> = { 0: 10, 2: 10, 4: 1, 3: 1, 1: 4, 5: 4, 6: 7 };

// Natural significations table (karakatva).
const KARAKA: Record<number, Bilingual> = {
  0: bi("authority, father, leadership", "அதிகாரம், தந்தை, தலைமை", "अधिकार, पिता, नेतृत्व"),
  1: bi("mind, mother, emotion", "மனம், தாய், உணர்வு", "मन, माता, भावना"),
  2: bi("energy, courage, technical/action", "சக்தி, தைரியம், தொழில்நுட்பம்", "ऊर्जा, साहस, तकनीक"),
  3: bi("intellect, commerce, speech", "அறிவு, வணிகம், பேச்சு", "बुद्धि, वाणिज्य, वाणी"),
  4: bi("wisdom, children, dharma, wealth", "ஞானம், குழந்தை, தர்மம், செல்வம்", "ज्ञान, संतान, धर्म, धन"),
  5: bi("relationship, comfort, spouse, art", "உறவு, சுகம், மனைவி, கலை", "संबंध, सुख, जीवनसाथी, कला"),
  6: bi("labor, delay, discipline, longevity", "உழைப்பு, தாமதம், சேவை, ஆயுள்", "श्रम, विलंब, सेवा, आयु"),
  7: bi("foreign, obsession, illusion", "வெளிநாடு, ஆசை, மாயை", "विदेश, महत्वाकांक्षा, माया"),
  8: bi("detachment, moksha, sudden shifts", "பற்றின்மை, மோட்சம், திடீர் மாற்றம்", "वैराग्य, मोक्ष, अचानक बदलाव"),
};

// ---------------------------------------------------------------------------
// Contact detection (for the aspect/conjunction rules that drive overrides)
// ---------------------------------------------------------------------------

// Angular gap between two planets in degrees (0..180).
function degGap(a: PlanetPosition, b: PlanetPosition): number {
  let d = Math.abs(a.siderealLon - b.siderealLon) % 360;
  if (d > 180) d = 360 - d;
  return d;
}
// Is `by` conjunct `target` (same sign)? closeness by degree (1 close .. 0 far).
function conj(by: PlanetPosition, target: PlanetPosition): number {
  if (by.index === target.index || by.rasiIndex !== target.rasiIndex) return 0;
  const g = degGap(by, target);
  return Math.max(0, 1 - g / 15); // within 15° counts, tighter = stronger
}
// Does `by` aspect `target`'s sign? closeness proxied by whole-sign hit.
function aspects(by: PlanetPosition, target: PlanetPosition): boolean {
  return by.index !== target.index && aspectFromTo(by.index, by.rasiIndex, target.rasiIndex) > 0;
}
// Clean benefic contact from Guru(4) / Sukran(5) onto a planet — §3 floor trigger.
// Returns { guru, sukran, close } where close = tightest contact strength 0..1.
function beneficContact(planets: PlanetPosition[], target: PlanetPosition): { guru: boolean; sukran: boolean; close: number } {
  const guru = P(planets, 4), sukran = P(planets, 5);
  const gC = Math.max(conj(guru, target), aspects(guru, target) ? 0.6 : 0);
  const sC = Math.max(conj(sukran, target), aspects(sukran, target) ? 0.55 : 0);
  // "clean": the benefic itself must not be badly afflicted (debilitated/combust).
  const guruClean = gC > 0 && pts(guru) >= 20;
  const sukranClean = sC > 0 && pts(sukran) >= 20;
  return { guru: guruClean, sukran: sukranClean, close: Math.max(guruClean ? gC : 0, sukranClean ? sC : 0) };
}

// ---------------------------------------------------------------------------
// STRENGTH score (v3 §2A / §6.4): dignity + house + digbala + retro/hidden.
// Subathuvam & Papathuvam come from guruji-analysis (already the §2B/§2C scores).
// ---------------------------------------------------------------------------

function strengthScore(p: PlanetPosition, lagna: number): number {
  // 1. sign dignity (0..100) is the backbone.
  let s = pts(p); // Rahu/Ketu → 20 neutral
  // 2. house strength: kendra/kona lift, dusthana lower, upachaya mild lift for malefics.
  const h = houseOf(p.rasiIndex, lagna);
  if (KENDRA.has(h)) s += 10;
  if (TRIKONA.has(h)) s += 8;
  if (DUSTHANA.has(h)) s -= 18;
  if (UPACHAYA.has(h)) s += 4;
  // 3. digbala (directional strength) — full at its dik house, tapering to 0 opposite.
  const dik = DIKBALA_HOUSE[p.index];
  if (dik !== undefined) {
    const away = Math.min(Math.abs(h - dik), 12 - Math.abs(h - dik)); // 0..6
    s += Math.round(8 * (1 - away / 6)); // +8 at dik house .. 0 opposite
  }
  // 4. retrogression: gives "hidden" extra strength to non-node, non-luminary grahas.
  if (p.retrograde && p.index >= 2 && p.index <= 6) s += 6;
  return Math.max(0, Math.min(100, Math.round(s)));
}

// Build a base ScoreRow for a planet given its role. Suba/Papa taken from the
// guruji scoreboard; Strength computed here. Overrides mutate these afterward.
function baseRow(planets: PlanetPosition[], g: GurujiAnalysis, lagna: number, idx: number, role: Bilingual): ScoreRow {
  const p = P(planets, idx);
  const v = valuOf(g, idx);
  return {
    index: idx,
    name: nm(idx),
    role,
    strength: strengthScore(p, lagna),
    subathuvam: v?.subathuvam ?? 30,
    papathuvam: v?.papathuvam ?? 30,
    net: (v?.subathuvam ?? 30) - (v?.papathuvam ?? 30),
  };
}
function recomputeNet(r: ScoreRow) { r.net = r.subathuvam - r.papathuvam; }

// Average planet-net across the whole scoreboard. Used to read each topic
// RELATIVE to this chart's own level rather than a fixed zero (see computePredictions).
function chartNetBaseline(g: GurujiAnalysis): number {
  const nets = g.planets.map((v) => v.net);
  if (!nets.length) return 0;
  return nets.reduce((a, b) => a + b, 0) / nets.length;
}
// A planet's net read relative to the chart baseline, partially centered.
// CENTER_K controls how much of the chart's global harshness we subtract out.
const CENTER_K = 0.7;
function relNet(net: number, baseline: number): number {
  // Subtract most of the chart's mean so the comparison is within-chart, but keep
  // 30% of the absolute signal so a truly strong/weak planet keeps its character.
  return net - baseline * CENTER_K;
}

// ---------------------------------------------------------------------------
// OVERRIDE RULES (v3 §3, §4, §9, §10, §11) — mutate score rows in place and
// record what fired. These are the "wholesome formula" corrections the user
// asked for: they RESHAPE the raw scores before the conclusion is drawn.
// ---------------------------------------------------------------------------

// §3 Guru/Sukran aspect FLOOR: a cleanly aspected planet is never below 50 suba.
function applyGuruSukranFloor(planets: PlanetPosition[], rows: ScoreRow[], overrides: AppliedOverride[]) {
  for (const r of rows) {
    if (r.index === 7 || r.index === 8) continue; // nodes handled by transfer rule
    const bc = beneficContact(planets, P(planets, r.index));
    if ((bc.guru || bc.sukran) && r.subathuvam < 50) {
      const before = r.subathuvam;
      r.subathuvam = 50 + Math.round(bc.close * 8); // 50..58 by closeness
      r.floored = true;
      recomputeNet(r);
      const who = bc.guru && bc.sukran ? "Guru & Sukran" : bc.guru ? "Guru" : "Sukran";
      const whoTa = bc.guru && bc.sukran ? "குரு & சுக்கிரன்" : bc.guru ? "குரு" : "சுக்கிரன்";
      const whoHi = bc.guru && bc.sukran ? "गुरु व शुक्र" : bc.guru ? "गुरु" : "शुक्र";
      overrides.push({
        code: "GS-FLOOR",
        text: bi(
          `${who} cleanly sees ${nm(r.index).en}, so its subathuvam is floored at ${r.subathuvam} (was ${before}) — it cannot be read as plainly bad.`,
          `${whoTa} ${nm(r.index).ta}-ஐ தூய்மையாகப் பார்க்கிறது; சுபத்துவம் ${r.subathuvam}-ஆக நிலைநிறுத்தப்படுகிறது (முன்பு ${before}) — வெறும் கெட்டதாகச் சொல்ல முடியாது.`,
          `${whoHi} ${nm(r.index).en} को स्वच्छ देखते हैं; शुभत्व ${r.subathuvam} पर स्थापित (पूर्व ${before}) — इसे केवल अशुभ नहीं कहा जा सकता।`,
        ),
        tone: "good",
      });
    }
  }
}

// §4 Saturn mitigation: if Guru/Sukran protect Sani (or the affected planet),
// reduce Saturn papathuvam and raise its suba floor → "delay-with-benefit".
function applySaturnMitigation(planets: PlanetPosition[], rows: ScoreRow[], overrides: AppliedOverride[]): boolean {
  const sani = P(planets, 6);
  const bc = beneficContact(planets, sani);
  const saniRow = rows.find((r) => r.index === 6);
  // Also block mitigation if Sani is tightly with Rahu/Mars and unprotected (§4.6).
  const rahu = P(planets, 7), mars = P(planets, 2);
  const withNodeMars = conj(rahu, sani) > 0.4 || conj(mars, sani) > 0.4;
  if ((bc.guru || bc.sukran) && !(withNodeMars && !bc.guru)) {
    if (saniRow) {
      const beforeP = saniRow.papathuvam;
      saniRow.papathuvam = Math.max(0, Math.round(saniRow.papathuvam * (bc.guru ? 0.5 : 0.65)));
      const floor = bc.guru ? 57 : 52;
      if (saniRow.subathuvam < floor) saniRow.subathuvam = floor;
      recomputeNet(saniRow);
      const _who = bc.guru ? "Guru" : "Sukran";
      overrides.push({
        code: "SANI-MIT",
        text: bi(
          `Saturn is protected by ${bc.guru ? "Guru" : "Sukran"} (papathuvam cut ${beforeP}→${saniRow.papathuvam}, subathuvam floored at ${saniRow.subathuvam}). Its effect becomes delay, discipline and stability — not destruction.`,
          `சனியை ${bc.guru ? "குரு" : "சுக்கிரன்"} காக்கிறது (பாபத்துவம் ${beforeP}→${saniRow.papathuvam}, சுபத்துவம் ${saniRow.subathuvam}). விளைவு அழிவு அல்ல — தாமதம், ஒழுக்கம், நிலைத்தன்மை.`,
          `शनि को ${bc.guru ? "गुरु" : "शुक्र"} की रक्षा (पापत्व ${beforeP}→${saniRow.papathuvam}, शुभत्व ${saniRow.subathuvam})। परिणाम विनाश नहीं — विलंब, अनुशासन, स्थिरता।`,
        ),
        tone: "good",
      });
    }
    return true;
  }
  return false;
}

// §9 Sukran-Rahu transfer: Sukran conjunct Rahu → Sukran polluted (papa↑),
// Rahu inherits Sukran's subathuvam and can give Venus-type results in Rahu dasa.
function applyRahuTransfer(planets: PlanetPosition[], rows: ScoreRow[], overrides: AppliedOverride[]) {
  const rahu = P(planets, 7), sukran = P(planets, 5);
  const closeness = conj(rahu, sukran);
  if (closeness > 0.25) {
    const rahuRow = rows.find((r) => r.index === 7);
    const sukRow = rows.find((r) => r.index === 5);
    // Capture Sukran's benefic quality BEFORE pollution so Rahu can inherit it.
    const sukranSubaBefore = sukRow?.subathuvam ?? 45;
    // Sukran becomes polluted.
    if (sukRow) { sukRow.papathuvam = Math.min(100, sukRow.papathuvam + 22); sukRow.subathuvam = Math.max(0, sukRow.subathuvam - 18); recomputeNet(sukRow); }
    // Rahu inherits Sukran's (pre-pollution) subathuvam.
    if (rahuRow) { rahuRow.subathuvam = Math.max(rahuRow.subathuvam, sukranSubaBefore); recomputeNet(rahuRow); }
    overrides.push({
      code: "RAHU-TRANSFER",
      text: bi(
        `Sukran is joined to Rahu (transfer rule): Sukran itself is polluted for Venus-matters, while Rahu absorbs Sukran's benefic quality and can deliver Venus-type results in Rahu dasa.`,
        `சுக்கிரன் ராகுவுடன் இணைந்துள்ளது (இடமாற்ற விதி): சுக்கிரன் சுக்கிர விஷயங்களுக்கு மாசுபடுகிறது; ராகு சுக்கிரனின் சுபத்துவத்தை உறிஞ்சி, ராகு தசையில் சுக்கிர பலன்களைத் தரலாம்.`,
        `शुक्र राहु से युत (स्थानांतरण नियम): शुक्र स्वयं शुक्र-विषयों हेतु दूषित; राहु शुक्र का शुभत्व ग्रहण कर राहु दशा में शुक्र-फल दे सकता है।`,
      ),
      tone: "mixed",
    });
  }
}

// §11 Mercury conditional benefic: boosted when Guru/Sukran/bright Moon support.
function applyMercuryModule(planets: PlanetPosition[], rows: ScoreRow[], overrides: AppliedOverride[]) {
  const merc = P(planets, 3);
  const mRow = rows.find((r) => r.index === 3);
  if (!mRow) return;
  const bc = beneficContact(planets, merc);
  const moon = P(planets, 1);
  const brightMoon = (moon.dignity?.points ?? 20) >= 40 && (conj(moon, merc) > 0 || aspects(moon, merc));
  if ((bc.guru || bc.sukran || brightMoon) && mRow.subathuvam >= 45) {
    const before = mRow.subathuvam;
    mRow.subathuvam = Math.min(100, mRow.subathuvam + 12);
    recomputeNet(mRow);
    overrides.push({
      code: "MERC-HIGH",
      text: bi(
        `Mercury is a conditional benefic and here it is supported (${before}→${mRow.subathuvam} suba) — sharpening intelligence, calculation, speech, analysis, writing and technical/business ability.`,
        `புதன் நிபந்தனை சுபன்; இங்கே ஆதரவு பெறுகிறது (${before}→${mRow.subathuvam}) — அறிவு, கணிப்பு, பேச்சு, பகுப்பாய்வு, எழுத்து, தொழில்நுட்ப/வணிகத் திறனை கூர்மைப்படுத்துகிறது.`,
        `बुध सशर्त शुभ; यहाँ समर्थित (${before}→${mRow.subathuvam}) — बुद्धि, गणना, वाणी, विश्लेषण, लेखन व तकनीकी/व्यापार क्षमता।`,
      ),
      tone: "good",
    });
  }
}

// §10 Puthan/Sukran in 12th: good for 12th-type (foreign/private/creative) themes.
function applyPuthanSukran12(planets: PlanetPosition[], lagna: number, topic: string, overrides: AppliedOverride[]) {
  const merc = P(planets, 3), sukran = P(planets, 5);
  const mercIn12 = houseOf(merc.rasiIndex, lagna) === 12;
  const sukIn12 = houseOf(sukran.rasiIndex, lagna) === 12;
  if (mercIn12 && sukIn12) {
    const clean = beneficContact(planets, merc).close > 0 || (pts(merc) >= 40 && pts(sukran) >= 40);
    overrides.push({
      code: "PS-12",
      text: bi(
        `Puthan + Sukran both sit in the 12th: ${clean ? "clean/beneficized, so this favours foreign, remote, private-comfort, spiritual and creative themes" : "but weak, so 12th-type gains stay mixed and savings can leak"} — it is NOT automatically good for domestic savings.`,
        `புதன் + சுக்கிரன் இருவரும் 12-ல்: ${clean ? "தூய்மை/சுபம் — வெளிநாடு, தனிமை சுகம், ஆன்மீகம், படைப்பாற்றல் ஆகியவற்றுக்கு சாதகம்" : "பலவீனம் — 12-வகை பலன் கலப்பு, சேமிப்பு கசியலாம்"} — சேமிப்புக்கு தானாக நல்லதல்ல.`,
        `बुध + शुक्र दोनों 12वें में: ${clean ? "स्वच्छ/शुभ — विदेश, एकांत-सुख, आध्यात्म, सृजन हेतु अनुकूल" : "कमजोर — 12-प्रकार फल मिश्रित, बचत रिस सकती है"} — बचत हेतु स्वतः शुभ नहीं।`,
      ),
      tone: clean ? "good" : "mixed",
    });
  }
}

// ---------------------------------------------------------------------------
// Foundation (v3 §0.4 + §5.4) — the native's capacity to receive/withstand.
// ---------------------------------------------------------------------------

function buildFoundation(planets: PlanetPosition[], lagnaSign: number, moonSign: number, g: GurujiAnalysis): PredictionReport["foundation"] {
  const lines: PredLine[] = [];
  const baseline = chartNetBaseline(g);
  const llIdx = RASI_LORDS[lagnaSign];
  const ll = P(planets, llIdx);
  const llHouse = houseOf(ll.rasiIndex, lagnaSign);
  const llStr = strengthScore(ll, lagnaSign);
  const llNet = (valuOf(g, llIdx)?.subathuvam ?? 30) - (valuOf(g, llIdx)?.papathuvam ?? 30);

  // Capacity is judged relative to this chart's own baseline (see computePredictions):
  // a lagna lord that is the strongest planet in a harsh chart is still "the anchor".
  const llStrong = llStr >= 55 && relNet(llNet, baseline) >= 0;
  const llWeak = llStr < 30 || (relNet(llNet, baseline) < -18 && DUSTHANA.has(llHouse));
  lines.push({
    text: bi(
      `Lagna ${RASIS[lagnaSign].en}; lord ${nm(llIdx).en} in the ${ord(llHouse)} — strength ${llStr}/100, net ${llNet >= 0 ? "+" : ""}${llNet}. ${llStrong ? "A strong lagna lord lets the native enjoy good yogas and survive hard periods." : llWeak ? "A weak lagna lord limits the ability to hold good results and withstand difficulty." : "The lagna lord is workable — results come with effort."}`,
      `லக்னம் ${RASIS[lagnaSign].ta}; அதிபதி ${nm(llIdx).ta} ${llHouse}-ல் — வலிமை ${llStr}/100, நிகர ${llNet >= 0 ? "+" : ""}${llNet}. ${llStrong ? "பலமான லக்னாதிபதி — நல்ல யோகங்களை அனுபவிக்கவும் கடினமான காலத்தைத் தாங்கவும் முடியும்." : llWeak ? "பலவீன லக்னாதிபதி — பலனைத் தாங்கும் திறன் குறைவு." : "லக்னாதிபதி மிதம் — முயற்சியுடன் பலன்."}`,
      `लग्न ${RASIS[lagnaSign].en}; स्वामी ${nm(llIdx).en} ${ord(llHouse)} में — बल ${llStr}/100, नेट ${llNet >= 0 ? "+" : ""}${llNet}। ${llStrong ? "सशक्त लग्नेश शुभ योग भोगने व कठिन काल सहने की क्षमता देता है।" : llWeak ? "कमजोर लग्नेश फल धारण क्षमता घटाता है।" : "लग्नेश कार्यशील — प्रयास से फल।"}`,
    ),
    tone: llStrong ? "good" : llWeak ? "caution" : "mixed",
  });

  const fifthIdx = RASI_LORDS[signAtHouse(5, lagnaSign)];
  const ninthIdx = RASI_LORDS[signAtHouse(9, lagnaSign)];
  const trikonaNet = ((valuOf(g, fifthIdx)?.net ?? 0) + (valuOf(g, ninthIdx)?.net ?? 0)) / 2;
  const trikonaStrong = relNet(trikonaNet, baseline) >= 8;
  lines.push({
    text: bi(
      `5th lord ${nm(fifthIdx).en} and 9th lord ${nm(ninthIdx).en} carry purva-punya and fortune (avg net ${Math.round(trikonaNet)}). ${trikonaStrong ? "Strong trikona support protects the chart even under a hard dasa." : "Softer trikona means fortune helps less against difficult periods."}`,
      `5-ஆம் அதிபதி ${nm(fifthIdx).ta}, 9-ஆம் அதிபதி ${nm(ninthIdx).ta} — பூர்வ புண்ணியம், அதிர்ஷ்டம் (சராசரி ${Math.round(trikonaNet)}). ${trikonaStrong ? "பலமான திரிகோணம் — கடின தசையிலும் காக்கும்." : "மென் திரிகோணம் — கடின காலத்தில் குறைவாக உதவும்."}`,
      `5वें ${nm(fifthIdx).en} व 9वें ${nm(ninthIdx).en} पूर्वपुण्य व भाग्य (औसत ${Math.round(trikonaNet)})। ${trikonaStrong ? "सशक्त त्रिकोण कठिन दशा में भी रक्षा।" : "कमजोर त्रिकोण कम सहायता।"}`,
    ),
    tone: trikonaStrong ? "good" : "mixed",
  });

  const moon = P(planets, 1);
  const moonNet = valuOf(g, 1)?.net ?? 0;
  const moonAfflicted = relNet(moonNet, baseline) < -12 || pts(moon) < 20;
  lines.push({
    text: bi(
      `Moon in ${RASIS[moonSign].en}; the mind reads net ${moonNet >= 0 ? "+" : ""}${moonNet}. ${moonAfflicted ? "An afflicted Moon makes results feel heavier emotionally." : "A supported Moon keeps the emotional experience steady."}`,
      `சந்திரன் ${RASIS[moonSign].ta}; மனம் ${moonNet >= 0 ? "+" : ""}${moonNet}. ${moonAfflicted ? "பீடிக்கப்பட்ட சந்திரன் — பலன்கள் மனதளவில் கனம்." : "ஆதரவுள்ள சந்திரன் — உணர்வு நிலையானது."}`,
      `चंद्र ${RASIS[moonSign].en}; मन ${moonNet >= 0 ? "+" : ""}${moonNet}। ${moonAfflicted ? "पीड़ित चंद्र फल को भावनात्मक रूप से भारी बनाता है।" : "समर्थित चंद्र अनुभव स्थिर रखता है।"}`,
    ),
    tone: moonAfflicted ? "caution" : "good",
  });

  const capacityScore = (llStrong ? 2 : llWeak ? -2 : 0) + (trikonaStrong ? 1 : 0) + (moonAfflicted ? -1 : 0);
  const canReceive: PredTone = capacityScore >= 1 ? "good" : capacityScore <= -1 ? "caution" : "mixed";
  return { lines, canReceive, capacityScore };
}

// ---------------------------------------------------------------------------
// Active-period detection (v3 §7) — which running lords trigger the topic.
// ---------------------------------------------------------------------------

interface Trigger { lord: RunningLord; reason: Bilingual; net: number; }

function activeTriggers(running: RunningLord[], planets: PlanetPosition[], lagna: number, g: GurujiAnalysis, houses: number[], karakas: number[]): Trigger[] {
  const out: Trigger[] = [];
  for (const L of running) {
    const owns = housesOwned(L.lordIndex, lagna).filter((h) => houses.includes(h));
    const occupies = houses.includes(L.natalHouse);
    const isKaraka = karakas.includes(L.lordIndex);
    const lp = P(planets, L.lordIndex);
    const asp = houses.some((h) => aspectFromTo(L.lordIndex, lp.rasiIndex, signAtHouse(h, lagna)) > 0);
    if (!(owns.length || occupies || isKaraka || asp)) continue;
    const bEn: string[] = [], bTa: string[] = [], bHi: string[] = [];
    if (owns.length) { bEn.push(`owns the ${owns.map(ord).join("/")}`); bTa.push(`${owns.join("/")}-ஐ ஆளுகிறது`); bHi.push(`${owns.join("/")} का स्वामी`); }
    if (occupies) { bEn.push(`sits in the ${ord(L.natalHouse)}`); bTa.push(`${L.natalHouse}-ல் அமர்ந்துள்ளது`); bHi.push(`${L.natalHouse} में स्थित`); }
    if (isKaraka) { bEn.push(`is the karaka`); bTa.push(`காரகன்`); bHi.push(`कारक`); }
    if (asp && !owns.length && !occupies) { bEn.push(`aspects the houses`); bTa.push(`பார்க்கிறது`); bHi.push(`दृष्टि`); }
    const lvlEn = L.level === "maha" ? "Maha-dasa" : L.level === "bhukti" ? "Bhukthi" : "Antara";
    const lvlTa = L.level === "maha" ? "மகா தசை" : L.level === "bhukti" ? "புக்தி" : "அந்தரம்";
    const lvlHi = L.level === "maha" ? "महादशा" : L.level === "bhukti" ? "भुक्ति" : "अंतर";
    out.push({
      lord: L,
      net: valuOf(g, L.lordIndex)?.net ?? 0,
      reason: bi(
        `${lvlEn} lord ${nm(L.lordIndex).en} ${bEn.join(", ")}`,
        `${lvlTa} அதிபதி ${nm(L.lordIndex).ta} ${bTa.join(", ")}`,
        `${lvlHi} स्वामी ${nm(L.lordIndex).en} ${bHi.join(", ")}`,
      ),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Event modules (v3 §13) — house/karaka maps.
// ---------------------------------------------------------------------------

interface ModuleSpec {
  key: string;
  title: Bilingual;
  icon: string;
  primaryHouse: number;
  supportHouses: number[];
  karakas: number[];
  sensitive?: boolean;
}

const MODULES: ModuleSpec[] = [
  { key: "marriage", title: bi("Marriage / Relationship", "திருமணம் / உறவு", "विवाह / संबंध"), icon: "Heart", primaryHouse: 7, supportHouses: [2, 11, 12], karakas: [5] },
  { key: "career", title: bi("Career / Job", "தொழில் / வேலை", "करियर / नौकरी"), icon: "Briefcase", primaryHouse: 10, supportHouses: [2, 6, 11], karakas: [0, 3, 6] },
  { key: "education", title: bi("Education / Intelligence", "கல்வி / அறிவு", "शिक्षा / बुद्धि"), icon: "GraduationCap", primaryHouse: 5, supportHouses: [4], karakas: [3, 4] },
  { key: "wealth", title: bi("Wealth / Speech / Family", "செல்வம் / பேச்சு / குடும்பம்", "धन / वाणी / परिवार"), icon: "Coins", primaryHouse: 2, supportHouses: [11, 5, 9], karakas: [4, 5] },
  { key: "parents", title: bi("Parents", "பெற்றோர்", "माता-पिता"), icon: "Users", primaryHouse: 9, supportHouses: [4], karakas: [0, 1] },
  { key: "longevity", title: bi("Longevity (sensitive)", "ஆயுள் (உணர்திறன்)", "आयु (संवेदनशील)"), icon: "HeartPulse", primaryHouse: 1, supportHouses: [8, 2, 7], karakas: [6], sensitive: true },
];

// ---------------------------------------------------------------------------
// The core per-topic composition (v3 §5 priority ladder → single verdict).
// ---------------------------------------------------------------------------

function composeTopic(
  spec: ModuleSpec,
  planets: PlanetPosition[],
  lagna: number,
  g: GurujiAnalysis,
  running: RunningLord[],
  saturnPhaseTone: PredTone,
  capacityScore: number,
  chartBaseline: number,
): TopicPrediction {
  // --- Build the key-planet score rows (primary house lord + support lords + karakas) ---
  const rows: ScoreRow[] = [];
  const seen = new Set<number>();
  const addRow = (idx: number, role: Bilingual) => {
    if (seen.has(idx)) return;
    seen.add(idx);
    rows.push(baseRow(planets, g, lagna, idx, role));
  };
  const primLordIdx = RASI_LORDS[signAtHouse(spec.primaryHouse, lagna)];
  addRow(primLordIdx, ordBi(spec.primaryHouse) /* lord */);
  // fix role label to say "lord"
  rows[0].role = bi(`${ord(spec.primaryHouse)} lord`, `${spec.primaryHouse}-ஆம் அதிபதி`, `${ord(spec.primaryHouse)} स्वामी`);
  for (const h of spec.supportHouses) {
    const li = RASI_LORDS[signAtHouse(h, lagna)];
    addRow(li, bi(`${ord(h)} lord`, `${h}-ஆம் அதிபதி`, `${ord(h)} स्वामी`));
  }
  for (const k of spec.karakas) addRow(k, bi(`karaka ${nm(k).en}`, `காரகன் ${nm(k).ta}`, `कारक ${nm(k).en}`));

  // --- Apply override rules (they mutate rows + record what fired) ---
  const overrides: AppliedOverride[] = [];
  applyGuruSukranFloor(planets, rows, overrides);
  applySaturnMitigation(planets, rows, overrides);
  applyRahuTransfer(planets, rows, overrides);
  applyMercuryModule(planets, rows, overrides);
  applyPuthanSukran12(planets, lagna, spec.key, overrides);

  // Attach a deciding note to each row.
  for (const r of rows) {
    const p = P(planets, r.index);
    const h = houseOf(p.rasiIndex, lagna);
    r.note = bi(
      `${r.strength >= 55 ? "strong" : r.strength >= 30 ? "workable" : "weak"} in the ${ord(h)}${p.dignity ? `, ${p.dignity.label.en}` : ""}${r.floored ? ", benefic-floored" : ""}`,
      `${r.strength >= 55 ? "பலமான" : r.strength >= 30 ? "செயல்படும்" : "பலவீன"} — ${h}-ல்${p.dignity ? `, ${p.dignity.label.ta}` : ""}${r.floored ? ", சுப நிலைநிறுத்தம்" : ""}`,
      `${r.strength >= 55 ? "सशक्त" : r.strength >= 30 ? "कार्यशील" : "कमजोर"} — ${ord(h)} में${p.dignity ? `, ${p.dignity.label.en}` : ""}${r.floored ? ", शुभ-स्थापित" : ""}`,
    );
  }

  // --- PRIORITY LADDER (v3 §5) ---------------------------------------------
  // Step 1 — natal promise. Weighted: primary lord (×2) + support + karakas.
  const primRow = rows.find((r) => r.index === primLordIdx)!;
  const karRows = rows.filter((r) => spec.karakas.includes(r.index));
  const supRows = rows.filter((r) => r.index !== primLordIdx && !spec.karakas.includes(r.index));

  // Read each contributing planet RELATIVE to this chart's baseline (see computePredictions).
  // This is what surfaces the chart's comparatively strong areas instead of collapsing
  // a globally-harsh chart to all-bad.
  const rn = (net: number) => relNet(net, chartBaseline);
  const primContribution = rn(primRow.net) * 2;
  const karContribution = karRows.reduce((a, r) => a + rn(r.net), 0) * 1.2;
  const supContribution = supRows.reduce((a, r) => a + rn(r.net), 0) * 0.6;
  const promiseRaw = primContribution + karContribution + supContribution;
  const promiseDenom = 2 + karRows.length * 1.2 + supRows.length * 0.6;
  const promiseScore = promiseRaw / Math.max(1, promiseDenom); // ~ -100..+100 net-scale, chart-relative

  // Natal promise verdict tier (before timing).
  // not-promised: primary lord badly afflicted in dusthana AND no karaka rescue.
  // NEVER apply "not-promised" to the longevity module — the document forbids
  // fear-based / death-style conclusions. A weak longevity frame is reported
  // gently as "mixed-bad"/"delayed" with the sensitive caution, never denied.
  const primPlanet = P(planets, primLordIdx);
  const primInDusthana = DUSTHANA.has(houseOf(primPlanet.rasiIndex, lagna));
  // Rescue / denial tested on chart-relative nets so a globally-harsh chart
  // does not blanket-deny every topic.
  const karakaRescue = karRows.some((r) => rn(r.net) >= 12);
  const notPromised = !spec.sensitive && rn(primRow.net) <= -30 && primInDusthana && !karakaRescue && promiseScore < -15;

  // Step 2 — dasa active? Step 3 — bhukthi/antara.
  const triggers = activeTriggers(running, planets, lagna, g, [spec.primaryHouse, ...spec.supportHouses], spec.karakas);
  const dasaActive = triggers.some((t) => t.lord.level === "maha");
  const subActive = triggers.some((t) => t.lord.level !== "maha");
  const anyActive = triggers.length > 0;
  const activeNet = triggers.length ? triggers.reduce((a, t) => a + t.net, 0) / triggers.length : 0;

  // Step 4 — lagna capacity already in capacityScore (-3..+3).
  // Step 5 — suba/papa quality already folded into net scores + overrides.
  // Step 6 — special overrides adjust tone (protective vs polluting).
  const protectiveOverrides = overrides.filter((o) => o.tone === "good").length;
  const pollutingOverrides = overrides.filter((o) => o.tone === "caution").length;
  // Step 7 — gochara.
  const transitBias = saturnPhaseTone === "good" ? 8 : saturnPhaseTone === "caution" ? -8 : 0;

  // --- Compose the ONE net figure -----------------------------------------
  // activeNet comes from the harsh scoreboard too, so read it relative to baseline.
  const activeNetRel = relNet(activeNet, chartBaseline);
  let netFigure = promiseScore
    + capacityScore * 3.5
    + (anyActive ? activeNetRel * 0.4 : -6)   // no trigger = dormant pull
    + protectiveOverrides * 6
    - pollutingOverrides * 5
    + transitBias;

  // --- Resolve the single verdict (v3 §14.1) ------------------------------
  let verdict: Verdict;
  if (notPromised) {
    verdict = "not-promised";
  } else if (!anyActive) {
    // Chart may promise it, but nothing active now → dormant/delayed.
    verdict = promiseScore >= 5 ? "delayed" : "dormant";
  } else if (netFigure >= 30) {
    verdict = "good";
  } else if (netFigure >= 8) {
    verdict = "mixed-good";
  } else if (netFigure >= -8) {
    verdict = "mixed-bad";
  } else {
    verdict = "bad";
  }
  // A promised topic whose only weakness is timing/transit, with protection → delayed not bad.
  if ((verdict === "mixed-bad" || verdict === "bad") && promiseScore >= 5 && protectiveOverrides > 0 && saturnPhaseTone !== "good") {
    verdict = "delayed";
  }

  // --- Confidence (v3 §14.6) ----------------------------------------------
  const layerNatal = promiseScore >= 5 || (verdict === "not-promised");
  const layerDasa = anyActive;
  const layerTransit = saturnPhaseTone === "good" || (saturnPhaseTone === "caution" && verdict !== "good");
  const agree = [layerNatal, layerDasa, layerTransit].filter(Boolean).length;
  const confidence: Confidence = agree >= 3 ? "high" : agree === 2 ? "medium" : "low";

  // --- Tone for the card ---------------------------------------------------
  const tone: PredTone =
    verdict === "good" || verdict === "mixed-good" ? "good"
    : verdict === "delayed" ? "mixed"
    : verdict === "dormant" ? "mixed"
    : "caution";

  // --- Top deciding reasons (v3 §14.2 — top 3-5, plain language) -----------
  const topReasons: PredLine[] = [];
  topReasons.push({
    text: bi(
      `Natal promise: ${spec.title.en} rests on the ${ord(spec.primaryHouse)} (lord ${nm(primLordIdx).en}, net ${primRow.net >= 0 ? "+" : ""}${primRow.net}) and karaka ${spec.karakas.map((k) => nm(k).en).join("/")} — the weighted promise reads ${Math.round(promiseScore) >= 0 ? "+" : ""}${Math.round(promiseScore)}.`,
      `ஜாதக வாக்குறுதி: ${spec.title.ta} — ${spec.primaryHouse}-ஆம் (அதிபதி ${nm(primLordIdx).ta}, நிகர ${primRow.net >= 0 ? "+" : ""}${primRow.net}) மற்றும் காரகன் ${spec.karakas.map((k) => nm(k).ta).join("/")} — எடையிட்ட வாக்குறுதி ${Math.round(promiseScore) >= 0 ? "+" : ""}${Math.round(promiseScore)}.`,
      `जन्म-वचन: ${spec.title.en} — ${ord(spec.primaryHouse)} (स्वामी ${nm(primLordIdx).en}, नेट ${primRow.net >= 0 ? "+" : ""}${primRow.net}) व कारक ${spec.karakas.map((k) => nm(k).en).join("/")} — भारित वचन ${Math.round(promiseScore) >= 0 ? "+" : ""}${Math.round(promiseScore)}।`,
    ),
    tone: promiseScore >= 5 ? "good" : promiseScore <= -10 ? "caution" : "mixed",
  });
  if (anyActive) {
    topReasons.push({
      text: bi(
        `Active period: ${triggers.map((t) => t.reason.en).join("; ")} — so the current dasa ${activeNet >= 5 ? "favourably" : activeNet <= -10 ? "restrictively" : "mixedly"} touches this area.`,
        `இயங்கும் காலம்: ${triggers.map((t) => t.reason.ta).join("; ")} — தற்போதைய தசை ${activeNet >= 5 ? "சாதகமாக" : activeNet <= -10 ? "தடையுடன்" : "கலப்பாக"} தொடுகிறது.`,
        `चालू काल: ${triggers.map((t) => t.reason.en).join("; ")} — वर्तमान दशा ${activeNet >= 5 ? "अनुकूल" : activeNet <= -10 ? "प्रतिबंधित" : "मिश्रित"} स्पर्श।`,
      ),
      tone: activeNet >= 5 ? "good" : activeNet <= -10 ? "caution" : "mixed",
    });
  } else {
    topReasons.push({
      text: bi(
        `No running dasa/bhukthi/antara lord owns, occupies or aspects these houses — the area is dormant right now; it waits for a dasa of the relevant lords.`,
        `இயங்கும் தசா/புக்தி/அந்தர அதிபதிகள் இந்த ஸ்தானங்களைத் தொடவில்லை — தற்போது செயலற்றது; தொடர்புடைய அதிபதிகளின் தசைக்காகக் காத்திருக்கிறது.`,
        `कोई चालू दशा/भुक्ति/अंतर स्वामी इन भावों को स्पर्श नहीं करता — क्षेत्र अभी सुप्त; संबंधित स्वामियों की दशा की प्रतीक्षा।`,
      ),
      tone: "mixed",
    });
  }
  // Include the single most important override if any fired.
  const keyOverride = overrides.find((o) => o.tone === "good") ?? overrides[0];
  if (keyOverride) topReasons.push({ text: keyOverride.text, tone: keyOverride.tone });
  // Capacity note.
  topReasons.push({
    text: bi(
      `Native capacity: the lagna reads ${capacityScore >= 1 ? "supportive — good results can be held and hard periods survived" : capacityScore <= -1 ? "limited — the native holds good less easily and feels difficulty more" : "workable"}.`,
      `பலன் பெறும் திறன்: லக்னம் ${capacityScore >= 1 ? "ஆதரவு — நல்ல பலனைத் தாங்கவும் கடினத்தைத் தாங்கவும் முடியும்" : capacityScore <= -1 ? "வரம்பு — நல்லதை தாங்குவது கடினம்" : "செயல்படும்"}.`,
      `ग्रहण-क्षमता: लग्न ${capacityScore >= 1 ? "सहायक — शुभ फल धारण व कठिनाई सहन" : capacityScore <= -1 ? "सीमित — शुभ धारण कठिन" : "कार्यशील"}।`,
    ),
    tone: capacityScore >= 1 ? "good" : capacityScore <= -1 ? "caution" : "mixed",
  });

  // --- The single verdict reason (v3 §0 example wording) ------------------
  const verdictReason = buildVerdictReason(spec, verdict, promiseScore, anyActive, dasaActive, subActive, protectiveOverrides, saturnPhaseTone, netFigure);

  // --- Timing line (v3 §14.4) ---------------------------------------------
  const timing = buildTiming(triggers, saturnPhaseTone, anyActive);

  // --- Event detail (v3 §14.5) --------------------------------------------
  const eventDetail = buildEventDetail(spec, verdict, rows, primLordIdx, overrides, planets, lagna, chartBaseline);

  const caution = spec.sensitive
    ? bi(
        "This is a study reading of the longevity frame only — never a death forecast. Longevity needs natal promise + dasa/bhukthi/antara + transit all confirming, and even then it is treated gently. Consult a qualified astrologer for anything sensitive.",
        "இது ஆயுள் அமைப்பின் படிப்பு மட்டுமே — மரண கணிப்பு அல்ல. ஆயுளுக்கு ஜாதக வாக்குறுதி + தசா/புக்தி/அந்தரம் + கோசாரம் அனைத்தும் உறுதிப்பட வேண்டும்; அப்போதும் மென்மையாகக் கையாளப்படுகிறது. உணர்திறன் விஷயத்திற்கு தகுதியான ஜோதிடரை அணுகவும்.",
        "यह केवल आयु-ढाँचे का अध्ययन है — मृत्यु-भविष्यवाणी नहीं। आयु हेतु जन्म-वचन + दशा/भुक्ति/अंतर + गोचर सभी की पुष्टि आवश्यक; फिर भी सौम्यता से। संवेदनशील विषय हेतु योग्य ज्योतिषी से परामर्श करें।",
      )
    : undefined;

  return {
    key: spec.key,
    title: spec.title,
    icon: spec.icon,
    verdict,
    verdictReason,
    confidence,
    topReasons,
    scoreRows: rows,
    overrides,
    timing,
    eventDetail,
    caution,
    tone,
  };
}

// ---------------------------------------------------------------------------
// Wording builders
// ---------------------------------------------------------------------------

const VERDICT_WORD: Record<Verdict, Bilingual> = {
  "good": bi("Good", "நல்லது", "शुभ"),
  "mixed-good": bi("Mixed-good", "கலப்பு-நல்லது", "मिश्रित-शुभ"),
  "mixed-bad": bi("Mixed-bad", "கலப்பு-கடினம்", "मिश्रित-कठिन"),
  "bad": bi("Difficult", "கடினம்", "कठिन"),
  "delayed": bi("Delayed", "தாமதம்", "विलंबित"),
  "dormant": bi("Dormant", "செயலற்றது", "सुप्त"),
  "not-promised": bi("Not promised", "வாக்களிக்கப்படவில்லை", "अवचनित"),
};

function buildVerdictReason(
  spec: ModuleSpec, verdict: Verdict, promiseScore: number, anyActive: boolean,
  dasaActive: boolean, subActive: boolean, protectiveOverrides: number,
  saturnPhaseTone: PredTone, netFigure: number,
): Bilingual {
  const nf = Math.round(netFigure);
  // Build a "net result is X because ..." single sentence.
  if (verdict === "not-promised") {
    return bi(
      `Net result: NOT PROMISED. The ${ord(spec.primaryHouse)} lord is badly afflicted in a dusthana with no karaka rescue, so timing alone cannot create this event.`,
      `நிகர முடிவு: வாக்களிக்கப்படவில்லை. ${spec.primaryHouse}-ஆம் அதிபதி துஸ்தானத்தில் கடுமையாகப் பீடிக்கப்பட்டுள்ளது, காரக மீட்பும் இல்லை — காலம் மட்டும் இதை உருவாக்காது.`,
      `नेट परिणाम: अवचनित। ${ord(spec.primaryHouse)} स्वामी दुस्थान में गंभीर पीड़ित, कारक रक्षा नहीं — केवल समय इसे नहीं बना सकता।`,
    );
  }
  if (verdict === "dormant") {
    return bi(
      `Net result: DORMANT. The chart's promise here is thin and no running period activates it, so the area stays quiet for now.`,
      `நிகர முடிவு: செயலற்றது. ஜாதக வாக்குறுதி மெலிதானது, இயங்கும் காலமும் தூண்டவில்லை — தற்போது அமைதி.`,
      `नेट परिणाम: सुप्त। वचन क्षीण व कोई चालू काल सक्रिय नहीं — क्षेत्र अभी शांत।`,
    );
  }
  if (verdict === "delayed") {
    return bi(
      `Net result: DELAYED but workable. The chart promises this (${promiseScore >= 0 ? "+" : ""}${Math.round(promiseScore)}), but ${anyActive ? "Saturn/transit slows it while benefic protection keeps it alive" : "the activating dasa has not yet arrived"} — expect it with delay, not denial.`,
      `நிகர முடிவு: தாமதம், ஆனால் நடக்கும். ஜாதகம் வாக்களிக்கிறது (${promiseScore >= 0 ? "+" : ""}${Math.round(promiseScore)}); ${anyActive ? "சனி/கோசாரம் தாமதப்படுத்துகிறது, சுப பாதுகாப்பு உயிர்ப்பாக வைத்திருக்கிறது" : "தூண்டும் தசை இன்னும் வரவில்லை"} — மறுப்பல்ல, தாமதம்.`,
      `नेट परिणाम: विलंबित पर संभव। कुंडली वचन देती है (${promiseScore >= 0 ? "+" : ""}${Math.round(promiseScore)}); ${anyActive ? "शनि/गोचर धीमा करता, शुभ रक्षा जीवित रखती है" : "सक्रिय दशा अभी नहीं आई"} — निषेध नहीं, विलंब।`,
    );
  }
  if (verdict === "good") {
    return bi(
      `Net result: GOOD (net +${nf}). Promise, active dasa and ${protectiveOverrides > 0 ? "benefic protection" : "transit"} all pull the same way, so results manifest clearly${saturnPhaseTone === "good" ? " and the transit confirms timing" : ""}.`,
      `நிகர முடிவு: நல்லது (நிகர +${nf}). வாக்குறுதி, இயங்கும் தசை, ${protectiveOverrides > 0 ? "சுப பாதுகாப்பு" : "கோசாரம்"} அனைத்தும் ஒரே திசையில் — பலன் தெளிவாக வெளிப்படும்${saturnPhaseTone === "good" ? ", கோசாரம் காலத்தை உறுதி செய்கிறது" : ""}.`,
      `नेट परिणाम: शुभ (नेट +${nf})। वचन, सक्रिय दशा व ${protectiveOverrides > 0 ? "शुभ रक्षा" : "गोचर"} एक दिशा में — फल स्पष्ट${saturnPhaseTone === "good" ? ", गोचर समय की पुष्टि" : ""}।`,
    );
  }
  if (verdict === "mixed-good") {
    return bi(
      `Net result: MIXED-GOOD (net +${nf}). The favourable factors outweigh the obstacles${protectiveOverrides > 0 ? " because benefic protection lifts the weak points" : ""} — good with some friction, not a plain success or failure.`,
      `நிகர முடிவு: கலப்பு-நல்லது (நிகர +${nf}). சாதக காரணிகள் தடைகளை மிஞ்சுகின்றன${protectiveOverrides > 0 ? "; சுப பாதுகாப்பு பலவீனத்தை உயர்த்துகிறது" : ""} — சிறு உராய்வுடன் நல்லது.`,
      `नेट परिणाम: मिश्रित-शुभ (नेट +${nf})। अनुकूल कारक बाधाओं से अधिक${protectiveOverrides > 0 ? "; शुभ रक्षा कमजोरी उठाती है" : ""} — कुछ घर्षण सहित शुभ।`,
    );
  }
  if (verdict === "mixed-bad") {
    return bi(
      `Net result: MIXED-BAD (net ${nf}). The obstacles slightly outweigh the support${protectiveOverrides > 0 ? ", though benefic protection stops it becoming plainly bad" : ""} — progress is possible but strained and slow.`,
      `நிகர முடிவு: கலப்பு-கடினம் (நிகர ${nf}). தடைகள் ஆதரவை சற்று மிஞ்சுகின்றன${protectiveOverrides > 0 ? "; சுப பாதுகாப்பு முழுக்கெட்டதாக ஆகவிடாது" : ""} — முன்னேற்றம் சாத்தியம், ஆனால் மெதுவாகவும் சிரமமாகவும்.`,
      `नेट परिणाम: मिश्रित-कठिन (नेट ${nf})। बाधाएँ समर्थन से थोड़ी अधिक${protectiveOverrides > 0 ? "; शुभ रक्षा इसे पूर्ण अशुभ नहीं बनने देती" : ""} — प्रगति संभव पर धीमी व कठिन।`,
    );
  }
  // bad
  return bi(
    `Net result: DIFFICULT (net ${nf}). Multiple factors obstruct this area and protection is thin, so results are strained — approach with patience and remedial care.`,
    `நிகர முடிவு: கடினம் (நிகர ${nf}). பல காரணிகள் தடுக்கின்றன, பாதுகாப்பு குறைவு — பலன் சிரமம்; பொறுமையும் பரிகாரமும் தேவை.`,
    `नेट परिणाम: कठिन (नेट ${nf})। अनेक कारक बाधक व रक्षा क्षीण — फल कठिन; धैर्य व उपाय आवश्यक।`,
  );
}

function buildTiming(triggers: Trigger[], saturnPhaseTone: PredTone, anyActive: boolean): Bilingual {
  const maha = triggers.find((t) => t.lord.level === "maha");
  const parts: string[] = [], partsTa: string[] = [], partsHi: string[] = [];
  if (maha) { parts.push(`Maha-dasa of ${nm(maha.lord.lordIndex).en} activates it`); partsTa.push(`${nm(maha.lord.lordIndex).ta} மகா தசை தூண்டுகிறது`); partsHi.push(`${nm(maha.lord.lordIndex).en} महादशा सक्रिय करती है`); }
  const bhukti = triggers.find((t) => t.lord.level === "bhukti");
  const antara = triggers.find((t) => t.lord.level === "antara");
  if (bhukti) { parts.push(`bhukthi of ${nm(bhukti.lord.lordIndex).en} shapes the sub-result`); partsTa.push(`${nm(bhukti.lord.lordIndex).ta} புக்தி துணை பலனை வடிவமைக்கிறது`); partsHi.push(`${nm(bhukti.lord.lordIndex).en} भुक्ति उप-फल`); }
  if (antara) { parts.push(`antara of ${nm(antara.lord.lordIndex).en} gives the exact trigger`); partsTa.push(`${nm(antara.lord.lordIndex).ta} அந்தரம் சரியான தூண்டல்`); partsHi.push(`${nm(antara.lord.lordIndex).en} अंतर सटीक ट्रिगर`); }
  const g = saturnPhaseTone === "good" ? "and the current Saturn double-transit confirms timing" : saturnPhaseTone === "caution" ? "but the current Saturn transit advises patience" : "with a neutral current transit";
  const gTa = saturnPhaseTone === "good" ? "தற்போதைய சனி இரட்டை கோச்சாரம் காலத்தை உறுதி செய்கிறது" : saturnPhaseTone === "caution" ? "தற்போதைய சனி கோச்சாரம் பொறுமையை அறிவுறுத்துகிறது" : "தற்போதைய கோச்சாரம் நடுநிலை";
  const gHi = saturnPhaseTone === "good" ? "वर्तमान शनि द्विगोचर समय की पुष्टि करता है" : saturnPhaseTone === "caution" ? "वर्तमान शनि गोचर धैर्य सुझाता है" : "वर्तमान गोचर तटस्थ";
  if (!anyActive) {
    return bi(
      `No running period activates this now; ${g}. A future dasa/bhukthi of the relevant lords is the likely window.`,
      `தற்போது எந்த காலமும் தூண்டவில்லை; ${gTa}. தொடர்புடைய அதிபதிகளின் எதிர்கால தசை/புக்தி பொருத்தமான காலம்.`,
      `अभी कोई काल सक्रिय नहीं; ${gHi}। संबंधित स्वामियों की भावी दशा/भुक्ति संभावित समय।`,
    );
  }
  return bi(
    `${parts.join(", ")}, ${g}.`,
    `${partsTa.join(", ")}; ${gTa}.`,
    `${partsHi.join(", ")}; ${gHi}।`,
  );
}

function buildEventDetail(
  spec: ModuleSpec, verdict: Verdict, rows: ScoreRow[], primLordIdx: number,
  overrides: AppliedOverride[], planets: PlanetPosition[], lagna: number, chartBaseline: number,
): Bilingual {
  // What improves / is delayed / damaged / protected — grounded in the rows,
  // classified relative to this chart's own baseline.
  const strong = rows.filter((r) => relNet(r.net, chartBaseline) >= 10).map((r) => r.name);
  const weak = rows.filter((r) => relNet(r.net, chartBaseline) <= -12).map((r) => r.name);
  const protectedRows = rows.filter((r) => r.floored).map((r) => r.name);

  const improveEn = strong.length ? `${strong.map((n) => n.en).join(", ")} support the good side` : "no planet is strongly positive here";
  const improveTa = strong.length ? `${strong.map((n) => n.ta).join(", ")} நல்ல பக்கத்தை ஆதரிக்கிறது` : "இங்கு எந்த கிரகமும் வலுவாக சாதகமில்லை";
  const improveHi = strong.length ? `${strong.map((n) => n.en).join(", ")} शुभ पक्ष का समर्थन` : "कोई ग्रह प्रबल अनुकूल नहीं";

  const damageEn = weak.length ? `${weak.map((n) => n.en).join(", ")} bring the friction/delay` : "no planet is strongly obstructive";
  const damageTa = weak.length ? `${weak.map((n) => n.ta).join(", ")} உராய்வு/தாமதம் தருகிறது` : "எந்த கிரகமும் வலுவான தடையில்லை";
  const damageHi = weak.length ? `${weak.map((n) => n.en).join(", ")} घर्षण/विलंब लाते हैं` : "कोई ग्रह प्रबल बाधक नहीं";

  const protectEn = protectedRows.length ? `; ${protectedRows.map((n) => n.en).join(", ")} are protected by Guru/Sukran` : overrides.some((o) => o.code === "SANI-MIT") ? "; Saturn's harshness is mitigated into discipline" : "";
  const protectTa = protectedRows.length ? `; ${protectedRows.map((n) => n.ta).join(", ")} குரு/சுக்கிரனால் பாதுகாக்கப்படுகிறது` : overrides.some((o) => o.code === "SANI-MIT") ? "; சனியின் கடுமை ஒழுக்கமாக மாற்றப்படுகிறது" : "";
  const protectHi = protectedRows.length ? `; ${protectedRows.map((n) => n.en).join(", ")} गुरु/शुक्र से रक्षित` : overrides.some((o) => o.code === "SANI-MIT") ? "; शनि की कठोरता अनुशासन में बदली" : "";

  return bi(
    `What improves: ${improveEn}. What is strained/delayed: ${damageEn}${protectEn}.`,
    `மேம்படுவது: ${improveTa}. சிரமம்/தாமதம்: ${damageTa}${protectTa}.`,
    `सुधार: ${improveHi}। कठिनाई/विलंब: ${damageHi}${protectHi}।`,
  );
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function computePredictions(input: {
  planets: PlanetPosition[];
  lagnaSign: number;
  moonSign: number;
  guruji: GurujiAnalysis;
  running: RunningLord[];
  saturnPhaseTone: PredTone;
}): PredictionReport {
  const { planets, lagnaSign, moonSign, guruji, running, saturnPhaseTone } = input;

  const foundation = buildFoundation(planets, lagnaSign, moonSign, guruji);

  // --- Chart-relative calibration baseline (fixes the "everything reads bad" bias) ---
  // The guruji scoreboard's papathuvam runs harsh, and its overall level shifts a lot
  // from chart to chart (mean planet-net observed from about -8 to -55). If we compare
  // every topic against a FIXED zero, a harsh chart collapses to all-bad. Instead we
  // read each planet's net RELATIVE to this chart's own average, so the chart's
  // comparatively strongest areas surface as good/mixed while its genuinely weakest
  // areas read cautious — which is what a real astrologer does. We only PARTIALLY center
  // (keep some absolute signal) so a genuinely strong chart still reads strong.
  const chartBaseline = chartNetBaseline(guruji);

  const topics = MODULES.map((spec) =>
    composeTopic(spec, planets, lagnaSign, guruji, running, saturnPhaseTone, foundation.capacityScore, chartBaseline),
  );

  const headline = bi(
    `A score-based reading across ${MODULES.length} life areas. For each topic the engine computes Strength, Subathuvam and Papathuvam, applies the Guru/Sukran floor, Saturn mitigation and Rahu-transfer overrides, then resolves everything through the priority ladder into ONE net conclusion — not a list of conflicting factors.`,
    `${MODULES.length} வாழ்க்கைத் துறைகளில் மதிப்பெண் அடிப்படையிலான கணிப்பு. ஒவ்வொரு தலைப்பிற்கும் வலிமை, சுபத்துவம், பாபத்துவம் கணக்கிடப்பட்டு, குரு/சுக்கிரன் தளம், சனி தணிப்பு, ராகு இடமாற்றம் ஆகிய விதிகள் பயன்படுத்தப்பட்டு, முன்னுரிமை ஏணி வழியாக ஒரே நிகர முடிவாகத் தீர்க்கப்படுகிறது — முரண்பட்ட காரணிகளின் பட்டியல் அல்ல.`,
    `${MODULES.length} जीवन-क्षेत्रों में स्कोर-आधारित पठन। प्रत्येक विषय हेतु बल, शुभत्व, पापत्व की गणना, गुरु/शुक्र फ़्लोर, शनि शमन व राहु-स्थानांतरण नियम लागू कर, प्राथमिकता-सीढ़ी से एक नेट निष्कर्ष — विरोधाभासी कारकों की सूची नहीं।`,
  );

  const disclaimer = bi(
    "Every score is grounded in a real placement in this chart; only rules the chart activates are applied. The conclusion is one net verdict per topic, per Aditya Guruji's method. Sensitive topics are treated gently, never fear-based.",
    "ஒவ்வொரு மதிப்பெண்ணும் இந்த ஜாதகத்தின் உண்மையான அமைப்பில் அடிப்படையாக உள்ளது; ஜாதகம் தூண்டும் விதிகள் மட்டுமே பயன்படுத்தப்படுகின்றன. ஆதித்யா குருஜியின் முறைப்படி ஒவ்வொரு தலைப்பிற்கும் ஒரே நிகர முடிவு. உணர்திறன் விஷயங்கள் மென்மையாகக் கையாளப்படுகின்றன.",
    "प्रत्येक स्कोर इस कुंडली की वास्तविक स्थिति पर आधारित; केवल सक्रिय नियम लागू। आदित्य गुरुजी विधि से प्रत्येक विषय हेतु एक नेट निष्कर्ष। संवेदनशील विषय सौम्यता से, कभी भय-आधारित नहीं।",
  );

  return { headline, foundation, topics, disclaimer };
}

export { VERDICT_WORD };
