// Sidereal (Nirayana) Jyotish calculation engine.
// Uses astronomy-engine (pure-JS, VSOP87/NOVAS precision) for tropical geocentric
// ecliptic longitudes, then applies Lahiri ayanamsa to get sidereal positions —
// the same methodology as Jagannatha Hora.

import * as AstronomyNS from "astronomy-engine";
// Interop: some bundlers (esbuild/tsx) nest named exports under `default`.
const Astronomy: typeof AstronomyNS = ((AstronomyNS as any).Body ? AstronomyNS : (AstronomyNS as any).default) as typeof AstronomyNS;
import {
  RASIS, NAKSHATRAS, GRAHAS, NAKSHATRAS as NAK,
  YOGAS, KARANAS, VARAS, TAMIL_MONTHS, RASI_LORDS,
  tithiName, type Bilingual,
} from "./constants";
import { computeDignity, type DignityResult } from "./dignity";
import { analyzeLagna, type LagnaAnalysis } from "./lagna-analysis";
import { computeShadbala, type ShadbalaResult, type ShadbalaContext } from "./shadbala";
import { computeDasha, type DashaTimeline } from "./dasha";
import { computeAshtakavarga, type AshtakavargaResult, type AvContributor } from "./ashtakavarga";
import {
  computeCharaKarakas, computeCharaDasha, computeBhriguBindu,
  computeSpecialLagnas, computeArudhaLagna, type KNRaoResult,
} from "./knrao";
import { analyzeKNRao, type KNRaoAnalysis } from "./knrao-analysis";
import { analyzeGuruji, type GurujiAnalysis } from "./guruji-analysis";
import { analyzePersona, type PersonaAnalysis } from "./persona-analysis";
import { analyzeRiseFall, type RiseFallResult } from "./rise-fall-analysis";
import { analyzeDashaTransit, type DashaTransitResult } from "./dasha-transit-analysis";
import { computePredictions, type PredictionReport, type RunningLord, type PredTone } from "./guruji-predict";

const DEG = 360;
const NAK_SPAN = DEG / 27; // 13.333...
const PADA_SPAN = NAK_SPAN / 4; // 3.333...

export function norm360(x: number): number {
  let v = x % DEG;
  if (v < 0) v += DEG;
  return v;
}

// ---- Julian Day helpers -------------------------------------------------
// Convert a local civil date/time + tz offset (hours) to an Astronomy time (UTC).
export function toAstroTime(dateStr: string, timeStr: string, tzOffsetHours: number): Astronomy.AstroTime {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  // Local time -> UTC by subtracting the offset.
  const utcMillis = Date.UTC(y, m - 1, d, hh, mm, 0) - tzOffsetHours * 3600 * 1000;
  return Astronomy.MakeTime(new Date(utcMillis));
}

export function julianDay(t: Astronomy.AstroTime): number {
  return t.tt + 2451545.0;
}

// ---- Lahiri ayanamsa (Chitrapaksha) -------------------------------------
// Matches Swiss Ephemeris SE_SIDM_LAHIRI within a few arcseconds across modern dates.
export function lahiriAyanamsa(jd: number): number {
  const t = (jd - 2451545.0) / 36525.0;
  return 23.85306 + 1.39722 * t + 0.000181 * t * t;
}

// ---- Tropical geocentric ecliptic longitude of a body -------------------
function tropicalLongitude(body: Astronomy.Body, time: Astronomy.AstroTime): number {
  const gv = Astronomy.GeoVector(body, time, true); // aberration-corrected
  const ecl = Astronomy.Ecliptic(gv); // ecliptic-of-date, elon in degrees
  return norm360(ecl.elon);
}

// ---- Sidereal longitude -------------------------------------------------
function siderealLongitude(body: Astronomy.Body, time: Astronomy.AstroTime, jd: number): { sid: number; speed: number } {
  const trop = tropicalLongitude(body, time);
  // Approximate daily speed via finite difference (for retrograde detection).
  const dt = 0.5; // days
  const t2 = Astronomy.MakeTime(new Date(time.date.getTime() + dt * 86400 * 1000));
  const trop2 = tropicalLongitude(body, t2);
  let diff = trop2 - trop;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  const speed = diff / dt;
  return { sid: norm360(trop - lahiriAyanamsa(jd)), speed };
}

// ---- Rahu / Ketu (mean lunar nodes) -------------------------------------
// Mean node longitude (tropical) formula, then apply ayanamsa.
function meanRahuTropical(jd: number): number {
  const t = (jd - 2451545.0) / 36525.0;
  // Mean longitude of ascending node of the Moon (degrees), Meeus.
  const omega = 125.04452 - 1934.136261 * t + 0.0020708 * t * t + (t * t * t) / 450000;
  return norm360(omega);
}

export interface PlanetPosition {
  index: number; // index in GRAHAS
  name: Bilingual;
  siderealLon: number; // 0..360
  rasiIndex: number;
  rasi: Bilingual;
  degInRasi: number;
  nakshatraIndex: number;
  nakshatra: Bilingual;
  pada: number;
  retrograde: boolean;
  dignity: DignityResult | null; // strength/dignity (null for Rahu/Ketu)
}

function buildPosition(index: number, sid: number, retro: boolean): PlanetPosition {
  const rasiIndex = Math.floor(sid / 30) % 12;
  const degInRasi = sid - rasiIndex * 30;
  const nakIndex = Math.floor(sid / NAK_SPAN) % 27;
  const pada = (Math.floor((sid % NAK_SPAN) / PADA_SPAN) % 4) + 1;
  return {
    index,
    name: GRAHAS[index],
    siderealLon: sid,
    rasiIndex,
    rasi: RASIS[rasiIndex],
    degInRasi,
    nakshatraIndex: nakIndex,
    nakshatra: NAK[nakIndex],
    pada,
    retrograde: retro,
    dignity: computeDignity(index, rasiIndex),
  };
}

// ---- Lagna (Ascendant) --------------------------------------------------
// Compute the sidereal ascendant using local sidereal time + obliquity.
export function computeLagna(time: Astronomy.AstroTime, latDeg: number, lonDeg: number, jd: number): number {
  // Greenwich Apparent Sidereal Time (hours) -> degrees
  const gast = Astronomy.SiderealTime(time); // hours
  const lstDeg = norm360(gast * 15 + lonDeg); // local sidereal time in degrees (RAMC)
  const ramc = lstDeg * Math.PI / 180;
  // Obliquity of the ecliptic (of date), degrees
  const T = (jd - 2451545.0) / 36525.0;
  const eps = (23.4392911 - 0.0130041667 * T - 1.6389e-7 * T * T + 5.036e-7 * T * T * T) * Math.PI / 180;
  const lat = latDeg * Math.PI / 180;
  // Ascendant formula (tropical), then subtract ayanamsa for sidereal.
  let asc = Math.atan2(
    Math.cos(ramc),
    -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps))
  );
  let ascDeg = norm360(asc * 180 / Math.PI);
  return norm360(ascDeg - lahiriAyanamsa(jd));
}

// ---- Navamsa (D-9) ------------------------------------------------------
// Map a sidereal longitude to its navamsa sign index (0..11).
export function navamsaSign(sid: number): number {
  const rasi = Math.floor(sid / 30); // 0..11
  const posInRasi = sid - rasi * 30;
  const navIndex = Math.floor(posInRasi / (30 / 9)); // 0..8
  // Movable(chara: rasi%3==0) start from same sign; Fixed(sthira: %3==1) from 9th; Dual(dwiswabhava %3==2) from 5th.
  const element = rasi % 3;
  let start: number;
  if (element === 0) start = rasi;
  else if (element === 1) start = (rasi + 8) % 12;
  else start = (rasi + 4) % 12;
  return (start + navIndex) % 12;
}

export interface ChartResult {
  meta: {
    date: string;
    time: string;
    latitude: number;
    longitude: number;
    tzOffset: number;
    julianDay: number;
    ayanamsa: number;
  };
  lagna: { siderealLon: number; rasiIndex: number; rasi: Bilingual; degInRasi: number; nakshatra: Bilingual; pada: number };
  planets: PlanetPosition[];
  navamsa: { lagnaSign: number; planetSigns: number[] }; // sign index per planet (same order as planets)
  janmaRasi: Bilingual; // Moon sign
  janmaNakshatra: Bilingual;
  janmaPada: number;
  dasha: DashaTimeline;
  lagnaAnalysis: LagnaAnalysis;
  lagnaLordShadbala: ShadbalaResult | null;
  ashtakavarga: AshtakavargaResult;
  knRao: KNRaoResult;
  knRaoAnalysis: KNRaoAnalysis;
  gurujiAnalysis: GurujiAnalysis;
  personaAnalysis: PersonaAnalysis;
  riseFall: RiseFallResult;
  dashaTransit: DashaTransitResult;
  prediction: PredictionReport;
}

const BODY_MAP: { idx: number; body: Astronomy.Body }[] = [
  { idx: 0, body: Astronomy.Body.Sun },
  { idx: 1, body: Astronomy.Body.Moon },
  { idx: 2, body: Astronomy.Body.Mars },
  { idx: 3, body: Astronomy.Body.Mercury },
  { idx: 4, body: Astronomy.Body.Jupiter },
  { idx: 5, body: Astronomy.Body.Venus },
  { idx: 6, body: Astronomy.Body.Saturn },
];

export function computeChart(input: {
  date: string; time: string; latitude: number; longitude: number; tzOffset: number;
}): ChartResult {
  const time = toAstroTime(input.date, input.time, input.tzOffset);
  const jd = julianDay(time);
  const ayan = lahiriAyanamsa(jd);

  const planets: PlanetPosition[] = [];
  for (const { idx, body } of BODY_MAP) {
    const { sid, speed } = siderealLongitude(body, time, jd);
    // Sun and Moon are never retrograde.
    const retro = idx !== 0 && idx !== 1 && speed < 0;
    planets.push(buildPosition(idx, sid, retro));
  }

  // Rahu (7) and Ketu (8)
  const rahuSid = norm360(meanRahuTropical(jd) - ayan);
  const ketuSid = norm360(rahuSid + 180);
  planets.push(buildPosition(7, rahuSid, true)); // nodes always retrograde
  planets.push(buildPosition(8, ketuSid, true));

  // Lagna
  const lagnaSid = computeLagna(time, input.latitude, input.longitude, jd);
  const lagnaRasi = Math.floor(lagnaSid / 30) % 12;
  const lagnaNak = Math.floor(lagnaSid / NAK_SPAN) % 27;
  const lagnaPada = (Math.floor((lagnaSid % NAK_SPAN) / PADA_SPAN) % 4) + 1;

  // Navamsa
  const navPlanetSigns = planets.map((p) => navamsaSign(p.siderealLon));
  const navLagnaSign = navamsaSign(lagnaSid);

  const moon = planets[1];

  // Vimshottari Dasha from the Moon's sidereal longitude at birth.
  // Build the birth epoch from the civil date/time components (treated as UTC so
  // the displayed dasha start/end dates align with the entered local clock time).
  const [by, bm, bd] = input.date.split("-").map(Number);
  const [bh, bmin] = input.time.split(":").map(Number);
  const birthEpoch = new Date(Date.UTC(by, (bm || 1) - 1, bd || 1, bh || 0, bmin || 0, 0));
  const dasha = computeDasha(moon.siderealLon, birthEpoch, 3, 1);

  // ---- Lagna analysis + Lagna-lord Shadbala --------------------------------
  const lagnaAnalysis = analyzeLagna(lagnaRasi, lagnaSid, planets);

  // Shadbala context: day/night, weekday, ayana (Sun's tropical course).
  const observer = new Astronomy.Observer(input.latitude, input.longitude, 0);
  let isDayBirth = true;
  let hoursSinceSunrise = 0;
  try {
    const dayStart = new Astronomy.AstroTime(new Date(time.date.getTime() - 18 * 3600 * 1000));
    const sr = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, dayStart, 2);
    const ss = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, sr ?? dayStart, 2);
    if (sr && ss) {
      isDayBirth = time.date.getTime() >= sr.date.getTime() && time.date.getTime() < ss.date.getTime();
    }
    if (sr) {
      hoursSinceSunrise = (time.date.getTime() - sr.date.getTime()) / 3600000;
      // If born before sunrise, reference the previous day's sunrise (24h earlier).
      if (hoursSinceSunrise < 0) hoursSinceSunrise += 24;
    }
  } catch { /* keep default */ }
  // Weekday of the civil birth date (0=Sunday..6=Saturday).
  const weekdayIndex = new Date(Date.UTC(by, (bm || 1) - 1, bd || 1)).getUTCDay();
  // Ayana: Sun's tropical longitude in 0..180 = northern course (Uttarayana leaning).
  const sunTropLon = norm360(planets[0].siderealLon + ayan);
  const ayanaNorth = sunTropLon >= 270 || sunTropLon < 90; // Makara..Mithuna = northward
  const shadbalaCtx: ShadbalaContext = { planets, weekdayIndex, isDayBirth, ayanaNorth };
  const lagnaLordShadbala = computeShadbala(
    lagnaAnalysis.lordIndex, lagnaSid, lagnaRasi, shadbalaCtx,
  );

  // Ashtakavarga: contributors are Sun..Saturn (planets[0..6]) + Lagna.
  const signByContributor: Record<AvContributor, number> = {
    sun: planets[0].rasiIndex,
    moon: planets[1].rasiIndex,
    mars: planets[2].rasiIndex,
    mercury: planets[3].rasiIndex,
    jupiter: planets[4].rasiIndex,
    venus: planets[5].rasiIndex,
    saturn: planets[6].rasiIndex,
    lagna: lagnaRasi,
  };
  const ashtakavarga = computeAshtakavarga(signByContributor);

  // ---- KN Rao concepts ------------------------------------------------------
  const planetSigns = planets.map((p) => p.rasiIndex);
  const charaKarakas = computeCharaKarakas(planets.slice(0, 7).map((p) => p.siderealLon));
  const arudhaLagnaSign = computeArudhaLagna(lagnaRasi, planetSigns);
  const charaDasha = computeCharaDasha(lagnaRasi, planetSigns, by);
  const charaDashaDirection: "direct" | "reverse" =
    [0, 2, 4, 6, 8, 10].includes(lagnaRasi) ? "direct" : "reverse";
  const bhriguBindu = computeBhriguBindu(planets[1].siderealLon, planets[7].siderealLon, lagnaRasi);
  const atmakaraka = charaKarakas[0];
  const akNavamsaSign = navamsaSign(planets[atmakaraka.planetIndex].siderealLon);
  const specialLagnas = computeSpecialLagnas(
    lagnaSid, lagnaRasi, hoursSinceSunrise, arudhaLagnaSign,
    atmakaraka.planetIndex, akNavamsaSign,
  );
  const knRao: KNRaoResult = {
    charaKarakas, charaDasha, charaDashaDirection, bhriguBindu, specialLagnas,
  };
  const knRaoAnalysis = analyzeKNRao(planets, lagnaRasi, navPlanetSigns, knRao);
  const gurijiMoonSign = planets[1].rasiIndex;
  const gurujiAnalysis = analyzeGuruji(planets, lagnaRasi, gurijiMoonSign);
  const personaAnalysis = analyzePersona(
    planets, lagnaRasi, planets[1].rasiIndex, dasha, gurujiAnalysis, birthEpoch, new Date(),
  );

  // ---- Rise / Surprise / Fall (KN Rao political-prediction method) ---------
  // Current transit positions of Jupiter (4) and Saturn (6) in the sidereal
  // (Lahiri) zodiac, for the Jupiter–Saturn double-transit stage.
  const nowDate = new Date();
  const nowTime = Astronomy.MakeTime(nowDate);
  const nowJd = julianDay(nowTime);
  const transitJupiterSign = Math.floor(
    siderealLongitude(Astronomy.Body.Jupiter, nowTime, nowJd).sid / 30,
  ) % 12;
  const transitSaturnSign = Math.floor(
    siderealLongitude(Astronomy.Body.Saturn, nowTime, nowJd).sid / 30,
  ) % 12;
  const riseFall = analyzeRiseFall(
    planets, lagnaRasi, dasha, transitJupiterSign, transitSaturnSign, nowDate,
  );
  const dashaTransit = analyzeDashaTransit(
    planets, lagnaRasi, dasha, transitPositions, nowDate,
  );

  // ---- Aditya Guruji step-by-step prediction engine ------------------------
  // Build the running dasa lords (maha/bhukti/antara) as the minimal RunningLord
  // shape the prediction engine consumes, and derive the transit tone from the
  // Jupiter–Saturn double-transit finding (map "info" → "mixed").
  const runningLords: RunningLord[] = ([
    dashaTransit.running.maha,
    dashaTransit.running.bhukti,
    dashaTransit.running.antara,
  ].filter(Boolean) as NonNullable<DashaTransitResult["running"]["maha"]>[]).map((r) => ({
    level: r.level,
    lordIndex: r.lordIndex,
    natalHouse: r.natalHouse,
    natalDignity: r.natalDignity,
  }));
  const dtTone = dashaTransit.doubleTransit.finding.tone;
  const saturnPhaseTone: PredTone =
    dtTone === "good" ? "good" : dtTone === "caution" ? "caution" : "mixed";
  const prediction = computePredictions({
    planets,
    lagnaSign: lagnaRasi,
    moonSign: planets[1].rasiIndex,
    guruji: gurujiAnalysis,
    running: runningLords,
    saturnPhaseTone,
  });

  return {
    meta: {
      date: input.date, time: input.time,
      latitude: input.latitude, longitude: input.longitude,
      tzOffset: input.tzOffset, julianDay: jd, ayanamsa: ayan,
    },
    lagna: {
      siderealLon: lagnaSid, rasiIndex: lagnaRasi, rasi: RASIS[lagnaRasi],
      degInRasi: lagnaSid - lagnaRasi * 30, nakshatra: NAK[lagnaNak], pada: lagnaPada,
    },
    planets,
    navamsa: { lagnaSign: navLagnaSign, planetSigns: navPlanetSigns },
    janmaRasi: moon.rasi,
    janmaNakshatra: moon.nakshatra,
    janmaPada: moon.pada,
    dasha,
    lagnaAnalysis,
    lagnaLordShadbala,
    ashtakavarga,
    knRao,
    knRaoAnalysis,
    gurujiAnalysis,
    personaAnalysis,
    riseFall,
    dashaTransit,
    prediction,
  };
}

// ---- Transit (Gochara) positions for an arbitrary moment ----------------
// Computes the 9 sidereal planet positions (with dignity) at a given instant.
// Used by the Dasha–transit prediction engine to read the sky at each period
// midpoint across the past/next years. `when` is a JS Date interpreted as the
// actual moment in time (UTC-based); transit positions are location-independent
// (we only need signs/longitudes, not the ascendant).
export function transitPositions(when: Date): PlanetPosition[] {
  const time = Astronomy.MakeTime(when);
  const jd = julianDay(time);
  const ayan = lahiriAyanamsa(jd);
  const planets: PlanetPosition[] = [];
  for (const { idx, body } of BODY_MAP) {
    const { sid, speed } = siderealLongitude(body, time, jd);
    const retro = idx !== 0 && idx !== 1 && speed < 0;
    planets.push(buildPosition(idx, sid, retro));
  }
  const rahuSid = norm360(meanRahuTropical(jd) - ayan);
  const ketuSid = norm360(rahuSid + 180);
  planets.push(buildPosition(7, rahuSid, true));
  planets.push(buildPosition(8, ketuSid, true));
  return planets;
}

// ========================= PANCHANGAM =====================================

export interface PanchangamResult {
  date: string;
  vara: Bilingual;
  tamilMonth: Bilingual;
  tamilDay: number; // day within Tamil month
  tithi: { name: Bilingual; endTime: string | null };
  nakshatra: { name: Bilingual; endTime: string | null };
  yoga: { name: Bilingual; endTime: string | null };
  karana: { name: Bilingual };
  sunrise: string | null;
  sunset: string | null;
  rahuKalam: { start: string; end: string };
  yamagandam: { start: string; end: string };
  kuligai: { start: string; end: string };
  ayanamsa: number;
  planets: PlanetPosition[]; // planetary positions at sunrise (reference time)
  // Lagna (ascendant). Rises through all 12 signs each day (~2h per sign),
  // so we report it both at the selected clock time and at sunrise.
  lagnaNow: { rasiIndex: number; rasi: Bilingual; degInRasi: number; atTime: string };
  lagnaSunrise: { rasiIndex: number; rasi: Bilingual; degInRasi: number };
}

function fmtTime(date: Date | null, tzOffset: number): string | null {
  if (!date) return null;
  // Convert UTC instant to local wall-clock using tzOffset hours.
  const local = new Date(date.getTime() + tzOffset * 3600 * 1000);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Rahu Kalam / Yamagandam / Kuligai segment order per weekday (0=Sun..6=Sat)
// Values are the day-segment index (1..8) of the 8 equal daylight parts.
const RAHU_SEG = [8, 2, 7, 5, 6, 4, 3];
const YAMA_SEG = [5, 4, 3, 2, 1, 7, 6];
const KULI_SEG = [7, 6, 5, 4, 3, 2, 1];

function segmentWindow(sunriseLocalMin: number, sunsetLocalMin: number, seg: number): { start: string; end: string } {
  const part = (sunsetLocalMin - sunriseLocalMin) / 8;
  const startMin = sunriseLocalMin + (seg - 1) * part;
  const endMin = startMin + part;
  const toHM = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const mm = Math.round(m % 60);
    return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  };
  return { start: toHM(startMin), end: toHM(endMin) };
}

export function computePanchangam(input: {
  date: string; latitude: number; longitude: number; tzOffset: number; time?: string;
}): PanchangamResult {
  const { date, latitude, longitude, tzOffset } = input;
  const time = input.time && /^\d{2}:\d{2}$/.test(input.time) ? input.time : "12:00";
  const [y, m, d] = date.split("-").map(Number);
  const observer = new Astronomy.Observer(latitude, longitude, 0);

  // Reference instant: local noon of the given date -> UTC
  const noonUtcMillis = Date.UTC(y, m - 1, d, 12, 0, 0) - tzOffset * 3600 * 1000;
  const noonTime = Astronomy.MakeTime(new Date(noonUtcMillis));
  const jd = julianDay(noonTime);
  const ayan = lahiriAyanamsa(jd);

  // Sunrise / sunset around this date
  const searchStartMillis = Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffset * 3600 * 1000;
  const searchStart = Astronomy.MakeTime(new Date(searchStartMillis));
  let sunriseT: Astronomy.AstroTime | null = null;
  let sunsetT: Astronomy.AstroTime | null = null;
  try {
    sunriseT = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, searchStart, 1);
    sunsetT = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, sunriseT ?? searchStart, 1);
  } catch { /* polar / edge cases */ }

  // Panchangam elements at sunrise (traditional) — fall back to noon.
  const refTime = sunriseT ?? noonTime;
  const refJd = julianDay(refTime);

  const sunTrop = tropicalLongitude(Astronomy.Body.Sun, refTime);
  const moonTrop = tropicalLongitude(Astronomy.Body.Moon, refTime);
  const sunSid = norm360(sunTrop - lahiriAyanamsa(refJd));
  const moonSid = norm360(moonTrop - lahiriAyanamsa(refJd));

  // Tithi: (moon - sun) / 12  -> 0..29
  const elong = norm360(moonTrop - sunTrop);
  const tithiIndex = Math.floor(elong / 12) % 30;

  // Nakshatra from Moon sidereal
  const nakIndex = Math.floor(moonSid / NAK_SPAN) % 27;

  // Yoga: (sun + moon sidereal) / (360/27)
  const yogaIndex = Math.floor(norm360(sunSid + moonSid) / NAK_SPAN) % 27;

  // Karana: 2 per tithi; sequence handles fixed karanas.
  const karanaSeqIndex = Math.floor(elong / 6); // 0..59
  let karana: Bilingual;
  if (karanaSeqIndex === 0) karana = KARANAS[10]; // Kimstughna
  else if (karanaSeqIndex >= 57) karana = KARANAS[7 + (karanaSeqIndex - 57)]; // Shakuni, Chatushpada, Naga
  else karana = KARANAS[(karanaSeqIndex - 1) % 7];

  // Vara (weekday) from the date
  const varaIndex = new Date(Date.UTC(y, m - 1, d)).getUTCDay();

  // Tamil month from Sun's sidereal rasi
  const sunRasi = Math.floor(sunSid / 30) % 12;
  const tamilMonth = TAMIL_MONTHS[sunRasi];
  const tamilDay = Math.floor(sunSid - sunRasi * 30) + 1;

  // Planetary positions (grahas) at the reference time (sunrise).
  const planets: PlanetPosition[] = [];
  for (const { idx, body } of BODY_MAP) {
    const { sid, speed } = siderealLongitude(body, refTime, refJd);
    const retro = idx !== 0 && idx !== 1 && speed < 0;
    planets.push(buildPosition(idx, sid, retro));
  }
  const rahuSid = norm360(meanRahuTropical(refJd) - lahiriAyanamsa(refJd));
  planets.push(buildPosition(7, rahuSid, true));
  planets.push(buildPosition(8, norm360(rahuSid + 180), true));

  // Rahu kalam etc. need sunrise/sunset in local minutes.
  let rahu = { start: "--:--", end: "--:--" };
  let yama = { start: "--:--", end: "--:--" };
  let kuli = { start: "--:--", end: "--:--" };
  if (sunriseT && sunsetT) {
    const srLocal = new Date(sunriseT.date.getTime() + tzOffset * 3600 * 1000);
    const ssLocal = new Date(sunsetT.date.getTime() + tzOffset * 3600 * 1000);
    const srMin = srLocal.getUTCHours() * 60 + srLocal.getUTCMinutes();
    const ssMin = ssLocal.getUTCHours() * 60 + ssLocal.getUTCMinutes();
    rahu = segmentWindow(srMin, ssMin, RAHU_SEG[varaIndex]);
    yama = segmentWindow(srMin, ssMin, YAMA_SEG[varaIndex]);
    kuli = segmentWindow(srMin, ssMin, KULI_SEG[varaIndex]);
  }

  // ---- Lagna (Ascendant) ----
  // At the selected clock time on this date.
  const [lhh, lmm] = time.split(":").map(Number);
  const timeUtcMillis = Date.UTC(y, m - 1, d, lhh, lmm, 0) - tzOffset * 3600 * 1000;
  const timeInstant = Astronomy.MakeTime(new Date(timeUtcMillis));
  const timeJd = julianDay(timeInstant);
  const lagNowSid = computeLagna(timeInstant, latitude, longitude, timeJd);
  const lagNowRasi = Math.floor(lagNowSid / 30) % 12;
  // At sunrise (traditional reference).
  const lagSrSid = computeLagna(refTime, latitude, longitude, refJd);
  const lagSrRasi = Math.floor(lagSrSid / 30) % 12;

  return {
    date,
    vara: VARAS[varaIndex],
    lagnaNow: {
      rasiIndex: lagNowRasi, rasi: RASIS[lagNowRasi],
      degInRasi: lagNowSid - lagNowRasi * 30, atTime: time,
    },
    lagnaSunrise: {
      rasiIndex: lagSrRasi, rasi: RASIS[lagSrRasi],
      degInRasi: lagSrSid - lagSrRasi * 30,
    },
    tamilMonth,
    tamilDay,
    tithi: { name: tithiName(tithiIndex), endTime: null },
    nakshatra: { name: NAKSHATRAS[nakIndex], endTime: null },
    yoga: { name: YOGAS[yogaIndex], endTime: null },
    karana: { name: karana },
    sunrise: fmtTime(sunriseT?.date ?? null, tzOffset),
    sunset: fmtTime(sunsetT?.date ?? null, tzOffset),
    rahuKalam: rahu,
    yamagandam: yama,
    kuligai: kuli,
    ayanamsa: ayan,
    planets,
  };
}
