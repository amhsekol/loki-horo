// Bilingual astrology reference data (Tamil + English/transliteration)
// Sidereal / Vedic (Jyotish) system, Lahiri (Chitrapaksha) ayanamsa — like Jagannatha Hora.

export interface Bilingual {
  ta: string; // Tamil script
  en: string; // English / transliteration
}

// 12 Rasis (zodiac signs) — sidereal
export const RASIS: Bilingual[] = [
  { ta: "மேஷம்", en: "Mesha (Aries)" },
  { ta: "ரிஷபம்", en: "Rishaba (Taurus)" },
  { ta: "மிதுனம்", en: "Mithuna (Gemini)" },
  { ta: "கடகம்", en: "Kataka (Cancer)" },
  { ta: "சிம்மம்", en: "Simha (Leo)" },
  { ta: "கன்னி", en: "Kanni (Virgo)" },
  { ta: "துலாம்", en: "Thula (Libra)" },
  { ta: "விருச்சிகம்", en: "Viruchiga (Scorpio)" },
  { ta: "தனுசு", en: "Dhanusu (Sagittarius)" },
  { ta: "மகரம்", en: "Makara (Capricorn)" },
  { ta: "கும்பம்", en: "Kumba (Aquarius)" },
  { ta: "மீனம்", en: "Meena (Pisces)" },
];

// 27 Nakshatras (stars) with 4 padas each
export const NAKSHATRAS: Bilingual[] = [
  { ta: "அசுவினி", en: "Ashwini" },
  { ta: "பரணி", en: "Bharani" },
  { ta: "கார்த்திகை", en: "Krittika" },
  { ta: "ரோகிணி", en: "Rohini" },
  { ta: "மிருகசீரிடம்", en: "Mrigashira" },
  { ta: "திருவாதிரை", en: "Ardra" },
  { ta: "புனர்பூசம்", en: "Punarvasu" },
  { ta: "பூசம்", en: "Pushya" },
  { ta: "ஆயில்யம்", en: "Ashlesha" },
  { ta: "மகம்", en: "Magha" },
  { ta: "பூரம்", en: "Purva Phalguni" },
  { ta: "உத்திரம்", en: "Uttara Phalguni" },
  { ta: "அஸ்தம்", en: "Hasta" },
  { ta: "சித்திரை", en: "Chitra" },
  { ta: "சுவாதி", en: "Swati" },
  { ta: "விசாகம்", en: "Vishakha" },
  { ta: "அனுஷம்", en: "Anuradha" },
  { ta: "கேட்டை", en: "Jyeshtha" },
  { ta: "மூலம்", en: "Mula" },
  { ta: "பூராடம்", en: "Purva Ashadha" },
  { ta: "உத்திராடம்", en: "Uttara Ashadha" },
  { ta: "திருவோணம்", en: "Shravana" },
  { ta: "அவிட்டம்", en: "Dhanishta" },
  { ta: "சதயம்", en: "Shatabhisha" },
  { ta: "பூரட்டாதி", en: "Purva Bhadrapada" },
  { ta: "உத்திரட்டாதி", en: "Uttara Bhadrapada" },
  { ta: "ரேவதி", en: "Revati" },
];

// 9 Grahas (planets) — Navagraha
export const GRAHAS: Bilingual[] = [
  { ta: "சூரியன்", en: "Surya (Sun)" },
  { ta: "சந்திரன்", en: "Chandra (Moon)" },
  { ta: "செவ்வாய்", en: "Sevvai (Mars)" },
  { ta: "புதன்", en: "Budha (Mercury)" },
  { ta: "குரு", en: "Guru (Jupiter)" },
  { ta: "சுக்கிரன்", en: "Sukra (Venus)" },
  { ta: "சனி", en: "Sani (Saturn)" },
  { ta: "ராகு", en: "Rahu" },
  { ta: "கேது", en: "Ketu" },
];

export const LAGNA: Bilingual = { ta: "லக்னம்", en: "Lagna (Ascendant)" };

// Short graha labels for chart cells
export const GRAHA_SHORT: Bilingual[] = [
  { ta: "சூ", en: "Su" },
  { ta: "சந்", en: "Mo" },
  { ta: "செ", en: "Ma" },
  { ta: "பு", en: "Me" },
  { ta: "கு", en: "Ju" },
  { ta: "சுக்", en: "Ve" },
  { ta: "சனி", en: "Sa" },
  { ta: "ரா", en: "Ra" },
  { ta: "கே", en: "Ke" },
];
export const LAGNA_SHORT: Bilingual = { ta: "லக்", en: "As" };

// 30 Tithis (lunar days). Index 0..29. Names repeat across two pakshas.
const TITHI_NAMES: Bilingual[] = [
  { ta: "பிரதமை", en: "Prathamai" },
  { ta: "துவிதியை", en: "Dwitiyai" },
  { ta: "திருதியை", en: "Thrithiyai" },
  { ta: "சதுர்த்தி", en: "Chaturthi" },
  { ta: "பஞ்சமி", en: "Panchami" },
  { ta: "சஷ்டி", en: "Shashti" },
  { ta: "சப்தமி", en: "Saptami" },
  { ta: "அஷ்டமி", en: "Ashtami" },
  { ta: "நவமி", en: "Navami" },
  { ta: "தசமி", en: "Dasami" },
  { ta: "ஏகாதசி", en: "Ekadasi" },
  { ta: "துவாதசி", en: "Dwadasi" },
  { ta: "திரயோதசி", en: "Trayodasi" },
  { ta: "சதுர்த்தசி", en: "Chaturdasi" },
  { ta: "பௌர்ணமி / அமாவாசை", en: "Pournami / Amavasai" },
];

export function tithiName(index: number): Bilingual {
  // index 0..29
  const paksha = index < 15
    ? { ta: "சுக்ல பக்ஷம்", en: "Shukla Paksha" }
    : { ta: "கிருஷ்ண பக்ஷம்", en: "Krishna Paksha" };
  const within = index % 15;
  const base = within === 14
    ? (index < 15 ? { ta: "பௌர்ணமி", en: "Pournami (Full Moon)" } : { ta: "அமாவாசை", en: "Amavasai (New Moon)" })
    : TITHI_NAMES[within];
  return {
    ta: `${base.ta} (${paksha.ta})`,
    en: `${base.en} (${paksha.en})`,
  };
}

// 27 Yogas
export const YOGAS: Bilingual[] = [
  { ta: "விஷ்கம்பம்", en: "Vishkambha" },
  { ta: "ப்ரீதி", en: "Priti" },
  { ta: "ஆயுஷ்மான்", en: "Ayushman" },
  { ta: "சௌபாக்யம்", en: "Saubhagya" },
  { ta: "சோபனம்", en: "Shobhana" },
  { ta: "அதிகண்டம்", en: "Atiganda" },
  { ta: "சுகர்மம்", en: "Sukarma" },
  { ta: "திருதி", en: "Dhriti" },
  { ta: "சூலம்", en: "Shula" },
  { ta: "கண்டம்", en: "Ganda" },
  { ta: "விருத்தி", en: "Vriddhi" },
  { ta: "துருவம்", en: "Dhruva" },
  { ta: "வியாகாதம்", en: "Vyaghata" },
  { ta: "ஹர்ஷணம்", en: "Harshana" },
  { ta: "வஜ்ரம்", en: "Vajra" },
  { ta: "சித்தி", en: "Siddhi" },
  { ta: "வியதீபாதம்", en: "Vyatipata" },
  { ta: "வரியான்", en: "Variyana" },
  { ta: "பரிகம்", en: "Parigha" },
  { ta: "சிவம்", en: "Shiva" },
  { ta: "சித்தம்", en: "Siddha" },
  { ta: "சாத்தியம்", en: "Sadhya" },
  { ta: "சுபம்", en: "Shubha" },
  { ta: "சுக்லம்", en: "Shukla" },
  { ta: "பிரம்மம்", en: "Brahma" },
  { ta: "ஐந்திரம்", en: "Indra" },
  { ta: "வைதிருதி", en: "Vaidhriti" },
];

// 11 Karanas (7 movable repeat + 4 fixed)
export const KARANAS: Bilingual[] = [
  { ta: "பவ", en: "Bava" },
  { ta: "பாலவ", en: "Balava" },
  { ta: "கௌலவ", en: "Kaulava" },
  { ta: "தைதுல", en: "Taitila" },
  { ta: "கரஜ", en: "Garaja" },
  { ta: "வணிஜ", en: "Vanija" },
  { ta: "விஷ்டி", en: "Vishti (Bhadra)" },
  { ta: "சகுனி", en: "Shakuni" },
  { ta: "சதுஷ்பாத", en: "Chatushpada" },
  { ta: "நாக", en: "Naga" },
  { ta: "கிம்ஸ்துக்னம்", en: "Kimstughna" },
];

// 7 weekday lords (Vara)
export const VARAS: Bilingual[] = [
  { ta: "ஞாயிறு", en: "Sunday (Bhanu)" },
  { ta: "திங்கள்", en: "Monday (Indu)" },
  { ta: "செவ்வாய்", en: "Tuesday (Bhauma)" },
  { ta: "புதன்", en: "Wednesday (Saumya)" },
  { ta: "வியாழன்", en: "Thursday (Guru)" },
  { ta: "வெள்ளி", en: "Friday (Bhrigu)" },
  { ta: "சனி", en: "Saturday (Sthira)" },
];

// Tamil solar months (Tamil calendar) — used for month name from Sun's sidereal rasi
export const TAMIL_MONTHS: Bilingual[] = [
  { ta: "சித்திரை", en: "Chithirai" }, // Sun in Mesha
  { ta: "வைகாசி", en: "Vaikasi" },
  { ta: "ஆனி", en: "Aani" },
  { ta: "ஆடி", en: "Aadi" },
  { ta: "ஆவணி", en: "Aavani" },
  { ta: "புரட்டாசி", en: "Purattasi" },
  { ta: "ஐப்பசி", en: "Aippasi" },
  { ta: "கார்த்திகை", en: "Karthigai" },
  { ta: "மார்கழி", en: "Margazhi" },
  { ta: "தை", en: "Thai" },
  { ta: "மாசி", en: "Maasi" },
  { ta: "பங்குனி", en: "Panguni" },
];

// Gregorian calendar months (for date pickers) — bilingual
export const GREGORIAN_MONTHS: Bilingual[] = [
  { ta: "ஜனவரி", en: "January" },
  { ta: "பிப்ரவரி", en: "February" },
  { ta: "மார்ச்", en: "March" },
  { ta: "ஏப்ரல்", en: "April" },
  { ta: "மே", en: "May" },
  { ta: "ஜூன்", en: "June" },
  { ta: "ஜூலை", en: "July" },
  { ta: "ஆகஸ்ட்", en: "August" },
  { ta: "செப்டம்பர்", en: "September" },
  { ta: "அக்டோபர்", en: "October" },
  { ta: "நவம்பர்", en: "November" },
  { ta: "டிசம்பர்", en: "December" },
];

// Rasi lords (adhipathi) — index into GRAHAS (0=Sun..6=Saturn)
export const RASI_LORDS = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4];

// ── North Indian chart script support ───────────────────────────────
// Script chosen locally for the North Indian (diamond) chart.
export type ChartScript = "en" | "hi";

// Full Rasi names in Hindi (Devanagari) — index 0=Mesha..11=Meena
export const RASIS_HI: string[] = [
  "मेष", "वृषभ", "मिथुन", "कर्क", "सिंह", "कन्या",
  "तुला", "वृश्चिक", "धनु", "मकर", "कुम्भ", "मीन",
];

// Short graha labels in Hindi — index 0=Sun..8=Ketu
export const GRAHA_SHORT_HI: string[] = [
  "सू", "चं", "मं", "बु", "गु", "शु", "श", "रा", "के",
];
export const LAGNA_SHORT_HI = "ल";

// Rasi number label (1..12) used inside North Indian house diamonds.
export function rasiLabelForScript(signIndex: number, script: ChartScript): string {
  return script === "hi" ? RASIS_HI[signIndex] : RASIS[signIndex].en.split(" (")[0];
}
export function grahaShortForScript(grahaIndex: number, script: ChartScript): string {
  return script === "hi" ? GRAHA_SHORT_HI[grahaIndex] : GRAHA_SHORT[grahaIndex].en;
}
export function lagnaShortForScript(script: ChartScript): string {
  return script === "hi" ? LAGNA_SHORT_HI : LAGNA_SHORT.en;
}

// UI string dictionary
export const UI: Record<string, Bilingual> = {
  appName: { ta: "தமிழ் ஜோதிடம்", en: "Tamil Jyotish" },
  jathagam: { ta: "ஜாதகம்", en: "Jathagam" },
  panchangam: { ta: "பஞ்சாங்கம்", en: "Panchangam" },
  birthChart: { ta: "பிறப்பு ஜாதகம்", en: "Birth Chart" },
  dailyAlmanac: { ta: "தினசரி பஞ்சாங்கம்", en: "Daily Almanac" },
  name: { ta: "பெயர்", en: "Name" },
  dob: { ta: "பிறந்த தேதி", en: "Date of Birth" },
  tob: { ta: "பிறந்த நேரம்", en: "Time of Birth" },
  pob: { ta: "பிறந்த இடம்", en: "Place of Birth" },
  date: { ta: "தேதி", en: "Date" },
  place: { ta: "இடம்", en: "Place" },
  generate: { ta: "ஜாதகம் உருவாக்கு", en: "Generate Chart" },
  calculate: { ta: "கணக்கிடு", en: "Calculate" },
  chartStyle: { ta: "கட்ட வகை", en: "Chart Style" },
  southStyle: { ta: "தென்னிந்திய", en: "South Indian" },
  northStyle: { ta: "வட இந்திய", en: "North Indian" },
  scriptLabel: { ta: "எழுத்து", en: "Script" },
  scriptEn: { ta: "ஆங்கிலம்", en: "English" },
  scriptHi: { ta: "இந்தி", en: "Hindi" },
  houseLabel: { ta: "பாவம்", en: "House" },
  rasiChart: { ta: "ராசி கட்டம் (D-1)", en: "Rasi Chart (D-1)" },
  navamsaChart: { ta: "நவாம்ச கட்டம் (D-9)", en: "Navamsa Chart (D-9)" },
  planetPositions: { ta: "கிரக நிலைகள்", en: "Planetary Positions" },
  graha: { ta: "கிரகம்", en: "Planet" },
  rasi: { ta: "ராசி", en: "Rasi" },
  degree: { ta: "பாகை", en: "Degree" },
  nakshatra: { ta: "நட்சத்திரம்", en: "Nakshatra" },
  pada: { ta: "பாதம்", en: "Pada" },
  retro: { ta: "வக்ரம்", en: "Retro" },
  tithi: { ta: "திதி", en: "Tithi" },
  yoga: { ta: "யோகம்", en: "Yogam" },
  karana: { ta: "கரணம்", en: "Karanam" },
  vara: { ta: "வாரம்", en: "Vaaram" },
  tamilMonth: { ta: "தமிழ் மாதம்", en: "Tamil Month" },
  sunrise: { ta: "சூரிய உதயம்", en: "Sunrise" },
  sunset: { ta: "சூரிய அஸ்தமனம்", en: "Sunset" },
  rahuKalam: { ta: "ராகு காலம்", en: "Rahu Kalam" },
  yamagandam: { ta: "எமகண்டம்", en: "Yamagandam" },
  kuligai: { ta: "குளிகை", en: "Kuligai" },
  moonSign: { ta: "ஜென்ம ராசி", en: "Moon Sign (Janma Rasi)" },
  birthStar: { ta: "ஜென்ம நட்சத்திரம்", en: "Birth Star (Janma Nakshatra)" },
  lagnaLabel: { ta: "லக்னம்", en: "Lagna" },
  auspicious: { ta: "நல்ல நேரம்", en: "Auspicious" },
  inauspicious: { ta: "தீய நேரம்", en: "Inauspicious" },
  loading: { ta: "கணக்கிடுகிறது…", en: "Calculating…" },
  useNow: { ta: "இன்று", en: "Today" },
  searchPlace: { ta: "நகரத்தைத் தேடு", en: "Search a city" },
  save: { ta: "சேமி", en: "Save" },
  saved: { ta: "சேமித்த ஜாதகங்கள்", en: "Saved Charts" },
  savedAuto: { ta: "சேமிக்கப்பட்டது", en: "Saved" },
  noCharts: { ta: "இதுவரை ஜாதகம் எதுவும் சேமிக்கப்படவில்லை.", en: "No saved charts yet." },
  loadChart: { ta: "திற", en: "Open" },
  deleteChart: { ta: "நீக்கு", en: "Delete" },
  unnamed: { ta: "பெயரிடப்படாதது", en: "Unnamed" },
  filters: { ta: "வடிகட்டிகள்", en: "Filters" },
  filterName: { ta: "பெயர் / ஊர்", en: "Name / City" },
  allLagna: { ta: "எல்லா லக்னம்", en: "All Lagna" },
  allRasi: { ta: "எல்லா ராசி", en: "All Rasi" },
  allNakshatra: { ta: "எல்லா நட்சத்திரம்", en: "All Nakshatra" },
  clearFilters: { ta: "நீக்கு", en: "Clear" },
  noMatches: { ta: "வடிகட்டிக்கு பொருந்தும் ஜாதகம் இல்லை.", en: "No charts match your filters." },
  dignity: { ta: "கிரக பலம்", en: "Dignity" },
  strength: { ta: "மதிப்பு", en: "Strength" },
  dignityLegend: { ta: "கிரக பல அளவுகோல்", en: "Planetary Strength Scale" },
  year: { ta: "வருடம்", en: "Year" },
  month: { ta: "மாதம்", en: "Month" },
  day: { ta: "தேதி", en: "Day" },
  hour: { ta: "மணி", en: "Hour" },
  minute: { ta: "நிமிடம்", en: "Minute" },
  ampm: { ta: "AM/PM", en: "AM/PM" },
  dashaTitle: { ta: "விம்ஷோத்தரி தசா (கால அட்டவணை)", en: "Vimshottari Dasha (Planetary Periods)" },
  dashaSubtitle: {
    ta: "பிறப்பிலிருந்து 120 ஆண்டுகள் — தசா ▸ புக்தி ▸ அந்தரம் ▸ சூட்சுமம். விரிவாக்க வரிசைக் கிளிக் செய்யவும்.",
    en: "120 years from birth — Dasha ▸ Bhukti ▸ Antharam ▸ Sookshma. Click a row to expand.",
  },
  mahaDasha: { ta: "தசா (மகா தசா)", en: "Maha Dasha" },
  bhukti: { ta: "புக்தி (அந்தர் தசா)", en: "Bhukti (Antardasha)" },
  antharam: { ta: "அந்தரம் (ப்ரத்யந்தர்)", en: "Antharam (Pratyantardasha)" },
  sookshma: { ta: "சூட்சும தசா", en: "Sookshma Dasha" },
  planet: { ta: "கிரகம்", en: "Planet" },
  startDate: { ta: "தொடக்கம்", en: "Start" },
  endDate: { ta: "முடிவு", en: "End" },
  duration: { ta: "காலஅளவு", en: "Duration" },
  months: { ta: "மாதங்கள்", en: "months" },
  years: { ta: "ஆண்டுகள்", en: "yrs" },
  current: { ta: "தற்போது", en: "Now" },
  balanceAtBirth: { ta: "பிறப்பில் தசா மிச்சம்", en: "Dasha balance at birth" },
  // Lagna (Panchangam)
  lagnaNow: { ta: "தற்போதைய லக்னம்", en: "Current Lagna" },
  lagnaAtSunrise: { ta: "உதய லக்னம்", en: "Sunrise Lagna" },
  lagnaNote: {
    ta: "லக்னம் ~2 மணி நேரத்திற்கு ஒருமுறை மாறும். தேர்ந்தெடுத்த நேரத்திற்கானது.",
    en: "Lagna changes about every 2 hours — shown for the selected time.",
  },
  time: { ta: "நேரம்", en: "Time" },
  // Tabs
  tabChart: { ta: "ஜாதகம்", en: "Chart" },
  tabIncidents: { ta: "நிகழ்வுகள்", en: "Incidents" },
  tabDashboard: { ta: "பலகை", en: "Dashboard" },
  // Lagna dashboard
  dashTitle: { ta: "லக்ன பகுப்பாய்வு", en: "Lagna Analysis" },
  dashSubtitle: {
    ta: "லக்னம், அதன் அதிபதியின் பலம், சேர்க்கை மற்றும் பார்வைகள்.",
    en: "The ascendant, its lord's strength, conjunctions and aspects.",
  },
  lagnaHeading: { ta: "லக்னம்", en: "Ascendant (Lagna)" },
  lagnaLord: { ta: "லக்னாதிபதி", en: "Lagna lord" },
  planetsInLagna: { ta: "லக்னத்தில் உள்ள கிரகங்கள்", en: "Planets in the Lagna" },
  aspectsToLagna: { ta: "லக்னத்தைப் பார்க்கும் கிரகங்கள்", en: "Planets aspecting the Lagna" },
  nonePlanetsInLagna: { ta: "லக்னத்தில் கிரகங்கள் எதுவும் இல்லை.", en: "No planets occupy the Lagna." },
  noneAspects: { ta: "லக்னத்தைப் பார்க்கும் கிரகங்கள் எதுவும் இல்லை.", en: "No planets aspect the Lagna." },
  lordStrength: { ta: "லக்னாதிபதி பலம் (ஷட்பலம்)", en: "Lagna lord strength (Shadbala)" },
  lordConjunctions: { ta: "லக்னாதிபதியுடன் சேர்க்கை", en: "Conjunctions with the Lagna lord" },
  lordAspectedBy: { ta: "லக்னாதிபதியைப் பார்க்கும் கிரகங்கள்", en: "Planets aspecting the Lagna lord" },
  noneConjunctions: { ta: "சேர்க்கை எதுவும் இல்லை.", en: "No conjunctions." },
  inSign: { ta: "இல்", en: "in" },
  house: { ta: "பாவம்", en: "house" },
  degGap: { ta: "டிகிரி இடைவெளி", en: "gap" },
  tightConj: { ta: "நெருங்கிய சேர்க்கை", en: "tight conjunction" },
  totalStrength: { ta: "மொத்த பலம்", en: "Total strength" },
  required: { ta: "தேவையான பலம்", en: "Required" },
  rupas: { ta: "ரூபம்", en: "Rupas" },
  virupas: { ta: "விரூபம்", en: "Virupas" },
  strong: { ta: "வலிமையானது", en: "Strong" },
  moderate: { ta: "நடுத்தரம்", en: "Moderate" },
  weak: { ta: "பலவீனம்", en: "Weak" },
  dispositor: { ta: "அதிபதி (வீட்டு எஜமான்)", en: "Dispositor (sign lord)" },
  dispositorOwnSign: { ta: "தன் சொந்த வீட்டில் — ஆட்சி", en: "in its own sign — powerful" },
  lordIsOwnDispositor: { ta: "லக்னாதிபதியே தன் வீட்டில் உள்ளார்", en: "lord is in its own sign" },
  drikNoAspects: { ta: "0 (பார்வை இல்லை)", en: "0 (no aspects)" },
  // Ashtakavarga
  ashtakavarga: { ta: "அஷ்டகவர்க்கம்", en: "Ashtakavarga" },
  ashtavargaTab: { ta: "அஷ்டகவர்க்கம்", en: "Ashtakavarga" },
  ashtakavargaSubtitle: {
    ta: "ஒவ்வொரு ராசியின் பலம் — சர்வ (SAV) மற்றும் ஒவ்வொரு கிரகத்தின் பின்ன (BAV) பிந்துக்கள்.",
    en: "Benefic-point strength of each sign — Sarva (SAV) and per-planet Bhinna (BAV) bindus.",
  },
  sav: { ta: "சர்வாஷ்டகவர்க்கம் (SAV)", en: "Sarvashtakavarga (SAV)" },
  savDesc: {
    ta: "எல்லா கிரகங்களின் மொத்த பிந்துக்கள் (மொத்தம் 337).",
    en: "Total bindus from all planets per sign (sums to 337).",
  },
  bindus: { ta: "பிந்துக்கள்", en: "bindus" },
  bavPerPlanet: { ta: "ஒவ்வொரு கிரகத்தின் பின்னாஷ்டகவர்க்கம் (BAV)", en: "Per-planet Bhinnashtakavarga (BAV)" },
  strongSigns: { ta: "வலிமையான ராசிகள் (30+ SAV)", en: "Strong signs (30+ SAV)" },
  dashNeedChart: {
    ta: "பகுப்பாய்வைக் காண முதலில் ஒரு ஜாதகத்தை உருவாக்கவும் அல்லது திறக்கவும்.",
    en: "Generate or open a chart first to see the analysis.",
  },
  degShort: { ta: "°", en: "°" },
  // Incidents
  incidentsTitle: { ta: "வாழ்க்கை நிகழ்வுகள்", en: "Life Incidents" },
  incidentsSubtitle: {
    ta: "இந்த ஜாதகத்திற்கான நல்ல/கெட்ட நிகழ்வுகளைப் பதிவு செய்யவும்.",
    en: "Record good or bad life events for this chart.",
  },
  incidentName: { ta: "நிகழ்வின் பெயர்", en: "Incident name" },
  incidentKind: { ta: "வகை", en: "Type" },
  good: { ta: "நல்லது", en: "Good" },
  bad: { ta: "கெட்டது", en: "Bad" },
  singleDay: { ta: "ஒரே நாள் நிகழ்வு", en: "Single-day event" },
  addIncident: { ta: "நிகழ்வைச் சேர்", en: "Add incident" },
  noIncidents: { ta: "இதுவரை நிகழ்வுகள் எதுவும் பதிவாகவில்லை.", en: "No incidents recorded yet." },
  incidentsNeedChart: {
    ta: "நிகழ்வுகளைப் பதிவு செய்ய முதலில் ஒரு ஜாதகத்தை உருவாக்கவும் அல்லது திறக்கவும்.",
    en: "Generate or open a chart first to record incidents against it.",
  },
  note: { ta: "குறிப்பு (விருப்பம்)", en: "Note (optional)" },
  days: { ta: "நாட்கள்", en: "days" },
  oneDay: { ta: "1 நாள்", en: "1 day" },
  forChart: { ta: "ஜாதகம்", en: "For" },
  disclaimer: {
    ta: "இது Lahiri அயனாம்சத்தை அடிப்படையாகக் கொண்ட நிரயன (சைடீரியல்) கணக்கீடு.",
    en: "Sidereal (Nirayana) calculations based on Lahiri ayanamsa.",
  },
};
