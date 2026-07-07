// KN Rao — INTERPRETIVE analysis engine.
// Where knrao.ts computes the raw structures (chara karakas, chara dasha,
// special lagnas), this module APPLIES KN Rao's documented predictive rules to
// those structures + the D-1/D-9 chart to produce plain-language verdicts:
// "what's going on" for career, marriage, children, yogas, spirituality — plus
// his master "Three Sources of Confirmation" scoring.
//
// Every finding carries a verdict tone (good / mixed / caution / info) so the UI
// can colour it, a short title, and the concrete reasons the rule fired.
//
// Planet indices: 0=Sun 1=Moon 2=Mars 3=Mercury 4=Jupiter 5=Venus 6=Saturn 7=Rahu 8=Ketu
// Sign indices:   0=Aries .. 11=Pisces

import type { Bilingual } from "./constants";
import { GRAHAS, RASIS, RASI_LORDS, aspectFromTo } from "./constants";
import type { PlanetPosition } from "./engine";
import type { KNRaoResult } from "./knrao";

export type Tone = "good" | "mixed" | "caution" | "info";

export interface Finding {
  title: Bilingual;
  verdict: Bilingual;   // the one-line conclusion
  tone: Tone;
  reasons: Bilingual[]; // the rule-based evidence
}

export interface KNRaoAnalysis {
  headline: Bilingual;          // overall one-liner
  confirmationNote: Bilingual;  // reminder of the Three-Sources principle
  sections: {
    key: string;
    title: Bilingual;
    findings: Finding[];
  }[];
}

// ---- helpers ---------------------------------------------------------------

const DUSTHANA = new Set([6, 8, 12]); // 6th, 8th, 12th houses
const KENDRA = new Set([1, 4, 7, 10]);
const TRIKONA = new Set([1, 5, 9]);

// House (1..12) of a sign counted from the lagna sign.
function houseOf(sign: number, lagna: number): number {
  return ((sign - lagna + 12) % 12) + 1;
}

// The sign that is `house` (1..12) away from the lagna.
function signAtHouse(house: number, lagna: number): number {
  return (lagna + (house - 1)) % 12;
}

// Find the planet object by index.
function planet(planets: PlanetPosition[], idx: number): PlanetPosition {
  return planets.find((p) => p.index === idx)!;
}

// Which planets occupy a given sign.
function occupants(planets: PlanetPosition[], sign: number): PlanetPosition[] {
  return planets.filter((p) => p.rasiIndex === sign);
}

// Which planets aspect a given sign (whole-sign graha drishti).
function aspectors(planets: PlanetPosition[], sign: number): PlanetPosition[] {
  return planets.filter((p) => p.rasiIndex !== sign && aspectFromTo(p.index, p.rasiIndex, sign) > 0);
}

const NATURAL_BENEFIC = new Set([4, 5]); // Jupiter, Venus (Mercury/Moon conditional)
const NATURAL_MALEFIC = new Set([0, 2, 6, 7, 8]); // Sun, Mars, Saturn, Rahu, Ketu

function isBenefic(p: PlanetPosition): boolean {
  if (p.index === 3) return true; // Mercury — treat as benefic when unafflicted (simplified)
  if (p.index === 1) return (p.dignity?.points ?? 20) >= 40; // strong Moon = benefic
  return NATURAL_BENEFIC.has(p.index);
}

function strong(p: PlanetPosition): boolean {
  return (p.dignity?.points ?? 20) >= 60; // own / moola / exalted
}
function weak(p: PlanetPosition): boolean {
  return (p.dignity?.points ?? 20) <= 10; // enemy / debilitated
}

function nm(idx: number): Bilingual {
  return GRAHAS[idx];
}

// ---- main ------------------------------------------------------------------

export function analyzeKNRao(
  planets: PlanetPosition[],
  lagnaSign: number,
  navamsaSigns: number[], // sign per planet in D-9 (same order as planets)
  k: KNRaoResult,
): KNRaoAnalysis {
  const sections: KNRaoAnalysis["sections"] = [];

  const AK = k.charaKarakas.find((c) => c.roleShort === "AK")!;
  const AmK = k.charaKarakas.find((c) => c.roleShort === "AmK")!;
  const DK = k.charaKarakas.find((c) => c.roleShort === "DK")!;
  const PK = k.charaKarakas.find((c) => c.roleShort === "PK")!;

  // ========================================================================
  // 1. CAREER  (10th house / 10th lord / Amatyakaraka — his "Ups & Downs")
  // ========================================================================
  const careerFindings: Finding[] = [];
  const tenthSign = signAtHouse(10, lagnaSign);
  const tenthLordIdx = RASI_LORDS[tenthSign];
  const tenthLord = planet(planets, tenthLordIdx);
  const tenthLordHouse = houseOf(tenthLord.rasiIndex, lagnaSign);
  const tenthOccupants = occupants(planets, tenthSign);
  const tenthAspectors = aspectors(planets, tenthSign);

  // 10th lord dignity → strength of career promise.
  if (strong(tenthLord)) {
    careerFindings.push({
      title: { ta: "10-ஆம் அதிபதி பலம்", en: "10th lord is strong" },
      verdict: { ta: "தொழில் உறுதி வலிமையானது — நிலையான உயர்வுக்கு வாய்ப்பு.", en: "A strong career promise — steady rise is supported." },
      tone: "good",
      reasons: [
        { ta: `10-ஆம் அதிபதி ${nm(tenthLordIdx).ta} ${tenthLord.dignity?.label.ta}.`, en: `10th lord ${nm(tenthLordIdx).en} is in ${tenthLord.dignity?.label.en}.` },
        { ta: `${tenthLordHouse}-ஆம் பாவத்தில் அமர்ந்துள்ளது.`, en: `Placed in the ${tenthLordHouse}th house.` },
      ],
    });
  } else if (weak(tenthLord)) {
    careerFindings.push({
      title: { ta: "10-ஆம் அதிபதி பலவீனம்", en: "10th lord is weak" },
      verdict: { ta: "தொழிலில் ஏற்ற இறக்கங்கள் — உழைப்பால் ஈடு செய்ய வேண்டும்.", en: "Career shows ups and downs — effort must compensate." },
      tone: "caution",
      reasons: [
        { ta: `10-ஆம் அதிபதி ${nm(tenthLordIdx).ta} ${tenthLord.dignity?.label.ta}.`, en: `10th lord ${nm(tenthLordIdx).en} is in ${tenthLord.dignity?.label.en}.` },
      ],
    });
  }

  // KN Rao: 6-8-12 association with the 10th lord → ups and downs.
  if (DUSTHANA.has(tenthLordHouse)) {
    careerFindings.push({
      title: { ta: "10-அதிபதி துஸ்தான தொடர்பு", en: "10th lord in a dusthana" },
      verdict: { ta: "தொழிலில் திடீர் மாற்றங்கள் / இடைவெளிகள் — கே.என்.ராவ்: 6-8-12 தொடர்பு.", en: "Sudden shifts or gaps in career — KN Rao's 6-8-12 signature." },
      tone: "caution",
      reasons: [
        { ta: `10-ஆம் அதிபதி ${tenthLordHouse}-ஆம் (துஸ்தான) பாவத்தில்.`, en: `10th lord sits in the ${tenthLordHouse}th (dusthana) house.` },
      ],
    });
  }

  // 8-10 connection → common in politicians / power roles.
  if (tenthLordHouse === 8 || occupants(planets, signAtHouse(8, lagnaSign)).some((p) => p.index === tenthLordIdx)) {
    careerFindings.push({
      title: { ta: "8-10 தொடர்பு", en: "8th–10th connection" },
      verdict: { ta: "அதிகாரம் / அரசியல் நோக்கிய பாதை — கவிழ்வும் எழுச்சியும் சாத்தியம்.", en: "A power/politics-leaning path — reversals and rises both possible." },
      tone: "mixed",
      reasons: [{ ta: "கே.என்.ராவ்: அரசியல்வாதிகள் ஜாதகத்தில் அடிக்கடி காணப்படுகிறது.", en: "KN Rao notes this pattern recurs in politicians' charts." }],
    });
  }

  // Amatyakaraka — Jaimini career significator.
  const amkHouse = houseOf(AmK.signIndex, lagnaSign);
  if (KENDRA.has(amkHouse) || TRIKONA.has(amkHouse) || amkHouse === 11) {
    careerFindings.push({
      title: { ta: "அமாத்யகாரகன் நல்நிலை", en: "Amatyakaraka well placed" },
      verdict: { ta: "தொழில் காரகன் வலுவாக — ஒப்பீட்டளவில் எளிதான வளர்ச்சி.", en: "The career significator is well placed — growth comes relatively easily." },
      tone: "good",
      reasons: [
        { ta: `அமாத்யகாரகன் ${nm(AmK.planetIndex).ta}, ${amkHouse}-ஆம் பாவத்தில் (கேந்திரம்/திரிகோணம்/11).`, en: `Amatyakaraka is ${nm(AmK.planetIndex).en}, in the ${amkHouse}th house (kendra/trikona/11th).` },
        { ta: "இதன் தசையில் பதவி உயர்வு எதிர்பார்க்கலாம்.", en: "Promotion is likely during its dasha." },
      ],
    });
  } else if (DUSTHANA.has(amkHouse)) {
    careerFindings.push({
      title: { ta: "அமாத்யகாரகன் துஸ்தானம்", en: "Amatyakaraka in a dusthana" },
      verdict: { ta: "பதவி அடைய போராட்டம் — ஆனால் விபரீத ராஜயோகம் சாத்தியம்.", en: "A struggle to attain position — but a Vipareeta Raja Yoga is possible." },
      tone: "mixed",
      reasons: [{ ta: `அமாத்யகாரகன் ${nm(AmK.planetIndex).ta} ${amkHouse}-ஆம் பாவத்தில்.`, en: `Amatyakaraka ${nm(AmK.planetIndex).en} sits in the ${amkHouse}th house.` }],
    });
  }

  // Which career field (four-karaka theory).
  const strongKarakas: number[] = [];
  for (const idx of [6, 0, 3, 2, 4]) if (strong(planet(planets, idx))) strongKarakas.push(idx);
  if (strongKarakas.length) {
    const map: Record<number, Bilingual> = {
      6: { ta: "சேவை / வேலைவாய்ப்பு", en: "service / employment" },
      0: { ta: "அரசு / அதிகாரம்", en: "government / authority" },
      3: { ta: "வணிகம் / நிதி / ஐடி", en: "business / finance / IT" },
      2: { ta: "ராணுவம் / பொறியியல்", en: "armed forces / engineering" },
      4: { ta: "நீதி / ஆசிரியம் / ஆன்மிகம்", en: "law / teaching / religion" },
    };
    careerFindings.push({
      title: { ta: "தொழில் துறை சாய்வு", en: "Career field leaning" },
      verdict: {
        ta: `வலுவான காரகர்கள் சுட்டுவது: ${strongKarakas.map((i) => map[i].ta).join(", ")}.`,
        en: `Strong karakas point to: ${strongKarakas.map((i) => map[i].en).join(", ")}.`,
      },
      tone: "info",
      reasons: [{ ta: "கே.என்.ராவ் நான்கு-காரக கோட்பாடு (சனி, சூரியன், புதன், செவ்வாய், குரு).", en: "KN Rao's four-karaka theory (Saturn, Sun, Mercury, Mars, Jupiter)." }],
    });
  }

  sections.push({ key: "career", title: { ta: "தொழில் — ஏற்ற இறக்கங்கள்", en: "Career — Ups & Downs" }, findings: careerFindings });

  // ========================================================================
  // 2. MARRIAGE  (Darakaraka / 7th house / Upapada — his checklist)
  // ========================================================================
  const marriageFindings: Finding[] = [];
  const seventhSign = signAtHouse(7, lagnaSign);
  const seventhLordIdx = RASI_LORDS[seventhSign];
  const seventhLord = planet(planets, seventhLordIdx);
  const seventhOccupants = occupants(planets, seventhSign);
  const seventhAspectors = aspectors(planets, seventhSign);

  const maleficsOn7 = [...seventhOccupants, ...seventhAspectors].filter((p) => NATURAL_MALEFIC.has(p.index));
  const beneficsOn7 = [...seventhOccupants, ...seventhAspectors].filter((p) => isBenefic(p));
  const venus = planet(planets, 5);

  // Early / normal / late categorization (KN Rao).
  let category: Bilingual; let catTone: Tone; let catAge: string;
  const strongMalefics7 = maleficsOn7.filter((p) => p.index === 2 || p.index === 6);
  if (beneficsOn7.length && strongMalefics7.length === 0) {
    category = { ta: "சீக்கிரம் (17–21)", en: "Early (17–21)" }; catTone = "good"; catAge = "17–21";
  } else if (strongMalefics7.length >= 2 || weak(seventhLord)) {
    category = { ta: "தாமதம் (25–30)", en: "Late (25–30)" }; catTone = "caution"; catAge = "25–30";
  } else {
    category = { ta: "சாதாரணம் (21–24)", en: "Normal (21–24)" }; catTone = "info"; catAge = "21–24";
  }
  marriageFindings.push({
    title: { ta: "திருமண வயது வகை", en: "Marriage-age category" },
    verdict: category,
    tone: catTone,
    reasons: [
      beneficsOn7.length
        ? { ta: `7-ல் நன்மைகள்: ${beneficsOn7.map((p) => nm(p.index).ta).join(", ")}.`, en: `Benefics on the 7th: ${beneficsOn7.map((p) => nm(p.index).en).join(", ")}.` }
        : { ta: "7-ல் நன்மைத் தாக்கம் குறைவு.", en: "Little benefic influence on the 7th." },
      maleficsOn7.length
        ? { ta: `7-ல் தீமைகள்: ${maleficsOn7.map((p) => nm(p.index).ta).join(", ")}.`, en: `Malefics on the 7th: ${maleficsOn7.map((p) => nm(p.index).en).join(", ")}.` }
        : { ta: "7 தீமைத் தாக்கம் இல்லாதது நல்லது.", en: "The 7th is free of malefic pressure — favourable." },
    ],
  });

  // Darakaraka = spouse timing key.
  marriageFindings.push({
    title: { ta: "தாராகாரகன் (துணை காரகன்)", en: "Darakaraka (spouse key)" },
    verdict: {
      ta: `துணை காரகன் ${nm(DK.planetIndex).ta} — ${nm(DK.signIndex >= 0 ? 0 : 0).ta ? "" : ""}${RASIS[DK.signIndex].ta}இல். சனி இதன் மீது ஜைமினி பார்வை வைக்கும் காலம் திருமண தூண்டுதல்.`,
      en: `Spouse significator is ${nm(DK.planetIndex).en} in ${RASIS[DK.signIndex].en}. When transit Saturn casts its Jaimini aspect on this, marriage triggers.`,
    },
    tone: "info",
    reasons: [{ ta: "கே.என்.ராவ்: துணை காரகன் மீது சனியின் பார்வை முக்கிய தூண்டுதல்.", en: "KN Rao: Saturn's aspect on the Darakaraka is the key trigger." }],
  });

  // Marriage-maker / killer combinations.
  const rahuSign = planet(planets, 7).rasiIndex;
  const venusRahuTogether = venus.rasiIndex === rahuSign;
  const saturnRahuTogether = planet(planets, 6).rasiIndex === rahuSign;
  if (venusRahuTogether) {
    marriageFindings.push({
      title: { ta: "ராகு + சுக்கிரன்", en: "Rahu + Venus" },
      verdict: { ta: "'திருமணம் செய்விப்பவர்' இணைப்பு — உறவுகள் எளிதில் உருவாகும்.", en: "A natural 'marriage-maker' pairing — unions form readily." },
      tone: "good",
      reasons: [{ ta: "ராகுவும் சுக்கிரனும் ஒரே ராசியில்.", en: "Rahu and Venus share a sign." }],
    });
  }
  if (saturnRahuTogether) {
    marriageFindings.push({
      title: { ta: "ராகு + சனி", en: "Rahu + Saturn" },
      verdict: { ta: "'திருமணம் தாமதப்படுத்துபவர்' இணைப்பு — தாமதம் சாத்தியம்.", en: "A natural 'marriage-delayer' pairing — delay is likely." },
      tone: "caution",
      reasons: [{ ta: "ராகுவும் சனியும் ஒரே ராசியில்.", en: "Rahu and Saturn share a sign." }],
    });
  }

  sections.push({ key: "marriage", title: { ta: "திருமணம் — காலம்", en: "Marriage — Timing" }, findings: marriageFindings });

  // ========================================================================
  // 3. CHILDREN  (5th house / Jupiter / Putrakaraka)
  // ========================================================================
  const childFindings: Finding[] = [];
  const fifthSign = signAtHouse(5, lagnaSign);
  const fifthLordIdx = RASI_LORDS[fifthSign];
  const fifthLord = planet(planets, fifthLordIdx);
  const jupiter = planet(planets, 4);
  const fifthOccupants = occupants(planets, fifthSign);
  const jupiterInFifth = jupiter.rasiIndex === fifthSign;
  const maleficsOn5 = [...fifthOccupants, ...aspectors(planets, fifthSign)].filter((p) => NATURAL_MALEFIC.has(p.index));

  if (jupiterInFifth) {
    childFindings.push({
      title: { ta: "5-இல் குரு", en: "Jupiter in the 5th" },
      verdict: { ta: "சந்ததிக்கு சாதகம் — குரு புத்ரகாரகன் 5-இல்.", en: "Favourable for progeny — Jupiter, the child-significator, sits in the 5th." },
      tone: "good",
      reasons: [{ ta: `குரு ${jupiter.dignity?.label.ta}.`, en: `Jupiter is in ${jupiter.dignity?.label.en}.` }],
    });
  }
  if (strong(fifthLord) && maleficsOn5.length === 0) {
    childFindings.push({
      title: { ta: "5-ஆம் அதிபதி பலம்", en: "5th lord strong & clean" },
      verdict: { ta: "குழந்தை பாக்கியம் தடையின்றி — 5-அதிபதி வலுவாக.", en: "Progeny without obstruction — the 5th lord is strong and unafflicted." },
      tone: "good",
      reasons: [{ ta: `5-ஆம் அதிபதி ${nm(fifthLordIdx).ta} ${fifthLord.dignity?.label.ta}.`, en: `5th lord ${nm(fifthLordIdx).en} in ${fifthLord.dignity?.label.en}.` }],
    });
  } else if (maleficsOn5.length) {
    childFindings.push({
      title: { ta: "5-இல் தீமைத் தாக்கம்", en: "Malefic pressure on the 5th" },
      verdict: { ta: "சந்ததியில் தாமதம் / கவனம் தேவை — 5-ஐ தீமைகள் பாதிக்கின்றன.", en: "Delay or care needed for children — malefics stress the 5th." },
      tone: "caution",
      reasons: [{ ta: `5-ஐ பாதிப்பவை: ${maleficsOn5.map((p) => nm(p.index).ta).join(", ")}.`, en: `Afflicting the 5th: ${maleficsOn5.map((p) => nm(p.index).en).join(", ")}.` }],
    });
  }
  childFindings.push({
    title: { ta: "தூண்டுதல் விதி", en: "Trigger rule" },
    verdict: { ta: "குரு + சனி ஒரே நேரத்தில் 5-ஐ பார்க்கும்/கடக்கும் போது பிறப்பு நிகழும்.", en: "Birth occurs when Jupiter and Saturn simultaneously transit or aspect the 5th." },
    tone: "info",
    reasons: [{ ta: "கே.என்.ராவ்: மகாதசை காலம், அந்தர்தசை குறுக்கம், குரு-சனி பார்வை தூண்டுதல்.", en: "KN Rao: mahadasha sets the frame, antardasha narrows it, the Jupiter–Saturn transit triggers." }],
  });

  sections.push({ key: "children", title: { ta: "சந்ததி — குழந்தைகள்", en: "Children — Progeny" }, findings: childFindings });

  // ========================================================================
  // 4. YOGAS  (Vipareeta Raja Yoga, Neechabhanga)
  // ========================================================================
  const yogaFindings: Finding[] = [];
  // Vipareeta Raja Yoga: a dusthana lord placed in another dusthana.
  const dusthanaLords = [6, 8, 12].map((h) => ({ house: h, lordIdx: RASI_LORDS[signAtHouse(h, lagnaSign)] }));
  for (const { house, lordIdx } of dusthanaLords) {
    const lp = planet(planets, lordIdx);
    const lh = houseOf(lp.rasiIndex, lagnaSign);
    if (DUSTHANA.has(lh) && lh !== house) {
      yogaFindings.push({
        title: { ta: "விபரீத ராஜயோகம்", en: "Vipareeta Raja Yoga" },
        verdict: { ta: "எதிர்பாராத எழுச்சி — கஷ்டத்திற்குப் பின் வெற்றி.", en: "Unexpected elevation — success after difficulty." },
        tone: "good",
        reasons: [{ ta: `${house}-ஆம் அதிபதி ${nm(lordIdx).ta} ${lh}-ஆம் (துஸ்தான) பாவத்தில்.`, en: `${house}th lord ${nm(lordIdx).en} sits in the ${lh}th (dusthana) house.` }],
      });
      break; // one is enough to flag
    }
  }
  // Neechabhanga: a debilitated planet whose debilitation is cancelled (dispositor in kendra from lagna).
  for (const p of planets) {
    if (p.dignity?.key === "neecham") {
      const dispIdx = RASI_LORDS[p.rasiIndex];
      const dispHouse = houseOf(planet(planets, dispIdx).rasiIndex, lagnaSign);
      if (KENDRA.has(dispHouse)) {
        yogaFindings.push({
          title: { ta: "நீசபங்க ராஜயோகம்", en: "Neechabhanga Raja Yoga" },
          verdict: { ta: `${nm(p.index).ta} நீசம் ரத்து — பலவீனம் பலமாக மாறுகிறது.`, en: `${nm(p.index).en}'s debilitation is cancelled — weakness turns into strength.` },
          tone: "good",
          reasons: [{ ta: `நீச அதிபதி ${nm(dispIdx).ta} கேந்திரத்தில் (${dispHouse}).`, en: `The debilitation-sign lord ${nm(dispIdx).en} is in a kendra (${dispHouse}th).` }],
        });
      }
    }
  }
  if (!yogaFindings.length) {
    yogaFindings.push({
      title: { ta: "சிறப்பு யோகம்", en: "Special yoga" },
      verdict: { ta: "விபரீத / நீசபங்க ராஜயோகம் தெளிவாக இல்லை.", en: "No clear Vipareeta or Neechabhanga Raja Yoga detected." },
      tone: "info",
      reasons: [{ ta: "இது இருந்தால் தசையில் திடீர் மாற்றம் தரும்.", en: "When present these produce sudden turns during their dasha." }],
    });
  }
  sections.push({ key: "yogas", title: { ta: "யோகங்கள்", en: "Raja / Dhana Yogas" }, findings: yogaFindings });

  // ========================================================================
  // 5. SPIRITUALITY  (Jupiter, 5-12, Karakamsa)
  // ========================================================================
  const spiritFindings: Finding[] = [];
  const twelfthSign = signAtHouse(12, lagnaSign);
  const fiveTwelveLink =
    fifthLord.rasiIndex === twelfthSign ||
    planet(planets, RASI_LORDS[twelfthSign]).rasiIndex === fifthSign ||
    fifthOccupants.some((p) => p.index === RASI_LORDS[twelfthSign]);
  if (fiveTwelveLink) {
    spiritFindings.push({
      title: { ta: "5-12 தொடர்பு", en: "5th–12th connection" },
      verdict: { ta: "ஆன்மிக சாய்வு / பூர்வ புண்ணியம் வலுவாக.", en: "A genuine spiritual leaning / strong past-life merit." },
      tone: "good",
      reasons: [{ ta: "கே.என்.ராவ்: உண்மையான ஆன்மிகர்கள் ஜாதகத்தில் காணப்படும்.", en: "KN Rao: recurs in the charts of truly spiritual people." }],
    });
  }
  if (strong(jupiter)) {
    spiritFindings.push({
      title: { ta: "வலுவான குரு", en: "Strong Jupiter" },
      verdict: { ta: "'நல்ல குரு இல்லாமல் நல்ல ஜோதிடர் ஆக முடியாது' — வாக்சித்தி சாய்வு.", en: "'Without a good Jupiter one cannot be a good astrologer' — a leaning toward Vak-siddhi." },
      tone: "good",
      reasons: [{ ta: `குரு ${jupiter.dignity?.label.ta}.`, en: `Jupiter is in ${jupiter.dignity?.label.en}.` }],
    });
  }
  spiritFindings.push({
    title: { ta: "காரகாம்சம்", en: "Karakamsa" },
    verdict: {
      ta: `ஆத்மகாரகன் ${nm(AK.planetIndex).ta}; காரகாம்சம் ${RASIS[k.specialLagnas.karakamsaSign].ta} — ஆன்மா / தொழில் அடிப்படை.`,
      en: `Atmakaraka is ${nm(AK.planetIndex).en}; Karakamsa in ${RASIS[k.specialLagnas.karakamsaSign].en} — the soul & career signature.`,
    },
    tone: "info",
    reasons: [{ ta: "கே.என்.ராவ்: காரகாம்சத்தை ராசி சக்கரத்தில் வைத்து படிக்கவும்.", en: "KN Rao reads the Karakamsa placed into the Rasi chart." }],
  });
  sections.push({ key: "spirit", title: { ta: "ஆன்மிகம் / கர்மா", en: "Spirituality / Karma" }, findings: spiritFindings });

  // ---- headline: count good vs caution across all sections -----------------
  let good = 0, caution = 0;
  for (const s of sections) for (const f of s.findings) {
    if (f.tone === "good") good++;
    else if (f.tone === "caution") caution++;
  }
  const headline: Bilingual =
    good > caution + 1
      ? { ta: "ஒட்டுமொத்தமாக சாதகமான ஜாதகம் — வலுவான உறுதிகள் அதிகம்.", en: "Overall a favourable chart — strong promises outweigh cautions." }
      : caution > good + 1
      ? { ta: "கவனம் தேவைப்படும் பகுதிகள் அதிகம் — தசை/கோச்சாரத்துடன் சரிபார்க்கவும்.", en: "Several areas need care — verify with dasha and transit." }
      : { ta: "கலவையான ஜாதகம் — வலிமையும் சவால்களும் சமநிலையில்.", en: "A balanced chart — strengths and challenges in equilibrium." };

  return {
    headline,
    confirmationNote: {
      ta: "கே.என்.ராவ் விதி: எந்த முடிவும் குறைந்தது 3 பாவங்கள், 3 கிரகங்கள், 2 வர்க்க சக்கரங்களால் உறுதிப்படுத்தப்பட வேண்டும்; தசை (விம்சோத்தரி + சர) ஒத்துப்போக வேண்டும்.",
      en: "KN Rao's rule: confirm every conclusion from at least 3 houses, 3 planets and 2 divisional charts; the dashas (Vimshottari + Chara) must agree.",
    },
    sections,
  };
}
