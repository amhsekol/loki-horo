// Bilingual astrology reference data (Tamil + English/transliteration)
// Sidereal / Vedic (Jyotish) system, Lahiri (Chitrapaksha) ayanamsa — like Jagannatha Hora.

export interface Bilingual {
  ta: string;  // Tamil script
  en: string;  // English / transliteration
  hi?: string; // Hindi (Devanagari) — optional; falls back to en/ta when absent
}

// Safe language accessor for reference arrays that are indexed directly.
// Prefers the requested lang, then English, then Tamil.
export function tl(b: Bilingual | undefined, lang: string): string {
  if (!b) return "";
  return (b as Record<string, string | undefined>)[lang] ?? b.en ?? b.ta ?? "";
}

// 12 Rasis (zodiac signs) — sidereal
export const RASIS: Bilingual[] = [
  { ta: "மேஷம்", en: "Mesha (Aries)", hi: "मेष (Aries)" },
  { ta: "ரிஷபம்", en: "Rishaba (Taurus)", hi: "वृषभ (Taurus)" },
  { ta: "மிதுனம்", en: "Mithuna (Gemini)", hi: "मिथुन (Gemini)" },
  { ta: "கடகம்", en: "Kataka (Cancer)", hi: "कर्क (Cancer)" },
  { ta: "சிம்மம்", en: "Simha (Leo)", hi: "सिंह (Leo)" },
  { ta: "கன்னி", en: "Kanni (Virgo)", hi: "कन्या (Virgo)" },
  { ta: "துலாம்", en: "Thula (Libra)", hi: "तुला (Libra)" },
  { ta: "விருச்சிகம்", en: "Viruchiga (Scorpio)", hi: "वृश्चिक (Scorpio)" },
  { ta: "தனுசு", en: "Dhanusu (Sagittarius)", hi: "धनु (Sagittarius)" },
  { ta: "மகரம்", en: "Makara (Capricorn)", hi: "मकर (Capricorn)" },
  { ta: "கும்பம்", en: "Kumba (Aquarius)", hi: "कुम्भ (Aquarius)" },
  { ta: "மீனம்", en: "Meena (Pisces)", hi: "मीन (Pisces)" },
];

// 27 Nakshatras (stars) with 4 padas each
export const NAKSHATRAS: Bilingual[] = [
  { ta: "அசுவினி", en: "Ashwini", hi: "अश्विनी" },
  { ta: "பரணி", en: "Bharani", hi: "भरणी" },
  { ta: "கார்த்திகை", en: "Krittika", hi: "कृत्तिका" },
  { ta: "ரோகிணி", en: "Rohini", hi: "रोहिणी" },
  { ta: "மிருகசீரிடம்", en: "Mrigashira", hi: "मृगशिरा" },
  { ta: "திருவாதிரை", en: "Ardra", hi: "आर्द्रा" },
  { ta: "புனர்பூசம்", en: "Punarvasu", hi: "पुनर्वसु" },
  { ta: "பூசம்", en: "Pushya", hi: "पुष्य" },
  { ta: "ஆயில்யம்", en: "Ashlesha", hi: "आश्लेषा" },
  { ta: "மகம்", en: "Magha", hi: "मघा" },
  { ta: "பூரம்", en: "Purva Phalguni", hi: "पूर्वा फाल्गुनी" },
  { ta: "உத்திரம்", en: "Uttara Phalguni", hi: "उत्तरा फाल्गुनी" },
  { ta: "அஸ்தம்", en: "Hasta", hi: "हस्त" },
  { ta: "சித்திரை", en: "Chitra", hi: "चित्रा" },
  { ta: "சுவாதி", en: "Swati", hi: "स्वाति" },
  { ta: "விசாகம்", en: "Vishakha", hi: "विशाखा" },
  { ta: "அனுஷம்", en: "Anuradha", hi: "अनुराधा" },
  { ta: "கேட்டை", en: "Jyeshtha", hi: "ज्येष्ठा" },
  { ta: "மூலம்", en: "Mula", hi: "मूल" },
  { ta: "பூராடம்", en: "Purva Ashadha", hi: "पूर्वाषाढ़ा" },
  { ta: "உத்திராடம்", en: "Uttara Ashadha", hi: "उत्तराषाढ़ा" },
  { ta: "திருவோணம்", en: "Shravana", hi: "श्रवण" },
  { ta: "அவிட்டம்", en: "Dhanishta", hi: "धनिष्ठा" },
  { ta: "சதயம்", en: "Shatabhisha", hi: "शतभिषा" },
  { ta: "பூரட்டாதி", en: "Purva Bhadrapada", hi: "पूर्वा भाद्रपद" },
  { ta: "உத்திரட்டாதி", en: "Uttara Bhadrapada", hi: "उत्तरा भाद्रपद" },
  { ta: "ரேவதி", en: "Revati", hi: "रेवती" },
];

// 9 Grahas (planets) — Navagraha
export const GRAHAS: Bilingual[] = [
  { ta: "சூரியன்", en: "Surya (Sun)", hi: "सूर्य (Sun)" },
  { ta: "சந்திரன்", en: "Chandra (Moon)", hi: "चंद्र (Moon)" },
  { ta: "செவ்வாய்", en: "Sevvai (Mars)", hi: "मंगल (Mars)" },
  { ta: "புதன்", en: "Budha (Mercury)", hi: "बुध (Mercury)" },
  { ta: "குரு", en: "Guru (Jupiter)", hi: "गुरु (Jupiter)" },
  { ta: "சுக்கிரன்", en: "Sukra (Venus)", hi: "शुक्र (Venus)" },
  { ta: "சனி", en: "Sani (Saturn)", hi: "शनि (Saturn)" },
  { ta: "ராகு", en: "Rahu", hi: "राहु" },
  { ta: "கேது", en: "Ketu", hi: "केतु" },
];

export const LAGNA: Bilingual = { ta: "லக்னம்", en: "Lagna (Ascendant)", hi: "लग्न (Ascendant)" };

// Short graha labels for chart cells
export const GRAHA_SHORT: Bilingual[] = [
  { ta: "சூ", en: "Su", hi: "सू" },
  { ta: "சந்", en: "Mo", hi: "चं" },
  { ta: "செ", en: "Ma", hi: "मं" },
  { ta: "பு", en: "Me", hi: "बु" },
  { ta: "கு", en: "Ju", hi: "गु" },
  { ta: "சுக்", en: "Ve", hi: "शु" },
  { ta: "சனி", en: "Sa", hi: "श" },
  { ta: "ரா", en: "Ra", hi: "रा" },
  { ta: "கே", en: "Ke", hi: "के" },
];
export const LAGNA_SHORT: Bilingual = { ta: "லக்", en: "As", hi: "ल" };

// 30 Tithis (lunar days). Index 0..29. Names repeat across two pakshas.
const TITHI_NAMES: Bilingual[] = [
  { ta: "பிரதமை", en: "Prathamai", hi: "प्रथमा" },
  { ta: "துவிதியை", en: "Dwitiyai", hi: "द्वितीया" },
  { ta: "திருதியை", en: "Thrithiyai", hi: "तृतीया" },
  { ta: "சதுர்த்தி", en: "Chaturthi", hi: "चतुर्थी" },
  { ta: "பஞ்சமி", en: "Panchami", hi: "पंचमी" },
  { ta: "சஷ்டி", en: "Shashti", hi: "षष्ठी" },
  { ta: "சப்தமி", en: "Saptami", hi: "सप्तमी" },
  { ta: "அஷ்டமி", en: "Ashtami", hi: "अष्टमी" },
  { ta: "நவமி", en: "Navami", hi: "नवमी" },
  { ta: "தசமி", en: "Dasami", hi: "दशमी" },
  { ta: "ஏகாதசி", en: "Ekadasi", hi: "एकादशी" },
  { ta: "துவாதசி", en: "Dwadasi", hi: "द्वादशी" },
  { ta: "திரயோதசி", en: "Trayodasi", hi: "त्रयोदशी" },
  { ta: "சதுர்த்தசி", en: "Chaturdasi", hi: "चतुर्दशी" },
  { ta: "பௌர்ணமி / அமாவாசை", en: "Pournami / Amavasai", hi: "पूर्णिमा / अमावस्या" },
];

export function tithiName(index: number): Bilingual {
  // index 0..29
  const paksha = index < 15
    ? { ta: "சுக்ல பக்ஷம்", en: "Shukla Paksha", hi: "शुक्ल पक्ष" }
    : { ta: "கிருஷ்ண பக்ஷம்", en: "Krishna Paksha", hi: "कृष्ण पक्ष" };
  const within = index % 15;
  const base = within === 14
    ? (index < 15 ? { ta: "பௌர்ணமி", en: "Pournami (Full Moon)", hi: "पूर्णिमा" } : { ta: "அமாவாசை", en: "Amavasai (New Moon)", hi: "अमावस्या" })
    : TITHI_NAMES[within];
  return {
    ta: `${base.ta} (${paksha.ta})`,
    en: `${base.en} (${paksha.en})`,
    hi: `${(base as any).hi ?? base.en} (${(paksha as any).hi ?? paksha.en})`,
  };
}

// 27 Yogas
export const YOGAS: Bilingual[] = [
  { ta: "விஷ்கம்பம்", en: "Vishkambha", hi: "विष्कम्भ" },
  { ta: "ப்ரீதி", en: "Priti", hi: "प्रीति" },
  { ta: "ஆயுஷ்மான்", en: "Ayushman", hi: "आयुष्मान" },
  { ta: "சௌபாக்யம்", en: "Saubhagya", hi: "सौभाग्य" },
  { ta: "சோபனம்", en: "Shobhana", hi: "शोभन" },
  { ta: "அதிகண்டம்", en: "Atiganda", hi: "अतिगण्ड" },
  { ta: "சுகர்மம்", en: "Sukarma", hi: "सुकर्मा" },
  { ta: "திருதி", en: "Dhriti", hi: "धृति" },
  { ta: "சூலம்", en: "Shula", hi: "शूल" },
  { ta: "கண்டம்", en: "Ganda", hi: "गण्ड" },
  { ta: "விருத்தி", en: "Vriddhi", hi: "वृद्धि" },
  { ta: "துருவம்", en: "Dhruva", hi: "ध्रुव" },
  { ta: "வியாகாதம்", en: "Vyaghata", hi: "व्याघात" },
  { ta: "ஹர்ஷணம்", en: "Harshana", hi: "हर्षण" },
  { ta: "வஜ்ரம்", en: "Vajra", hi: "वज्र" },
  { ta: "சித்தி", en: "Siddhi", hi: "सिद्धि" },
  { ta: "வியதீபாதம்", en: "Vyatipata", hi: "व्यतीपात" },
  { ta: "வரியான்", en: "Variyana", hi: "वरीयान" },
  { ta: "பரிகம்", en: "Parigha", hi: "परिघ" },
  { ta: "சிவம்", en: "Shiva", hi: "शिव" },
  { ta: "சித்தம்", en: "Siddha", hi: "सिद्ध" },
  { ta: "சாத்தியம்", en: "Sadhya", hi: "साध्य" },
  { ta: "சுபம்", en: "Shubha", hi: "शुभ" },
  { ta: "சுக்லம்", en: "Shukla", hi: "शुक्ल" },
  { ta: "பிரம்மம்", en: "Brahma", hi: "ब्रह्म" },
  { ta: "ஐந்திரம்", en: "Indra", hi: "इन्द्र" },
  { ta: "வைதிருதி", en: "Vaidhriti", hi: "वैधृति" },
];

// 11 Karanas (7 movable repeat + 4 fixed)
export const KARANAS: Bilingual[] = [
  { ta: "பவ", en: "Bava", hi: "बव" },
  { ta: "பாலவ", en: "Balava", hi: "बालव" },
  { ta: "கௌலவ", en: "Kaulava", hi: "कौलव" },
  { ta: "தைதுல", en: "Taitila", hi: "तैतिल" },
  { ta: "கரஜ", en: "Garaja", hi: "गरज" },
  { ta: "வணிஜ", en: "Vanija", hi: "वणिज" },
  { ta: "விஷ்டி", en: "Vishti (Bhadra)", hi: "विष्टि (भद्रा)" },
  { ta: "சகுனி", en: "Shakuni", hi: "शकुनि" },
  { ta: "சதுஷ்பாத", en: "Chatushpada", hi: "चतुष्पाद" },
  { ta: "நாக", en: "Naga", hi: "नाग" },
  { ta: "கிம்ஸ்துக்னம்", en: "Kimstughna", hi: "किंस्तुघ्न" },
];

// 7 weekday lords (Vara)
export const VARAS: Bilingual[] = [
  { ta: "ஞாயிறு", en: "Sunday (Bhanu)", hi: "रविवार (भानु)" },
  { ta: "திங்கள்", en: "Monday (Indu)", hi: "सोमवार (इन्दु)" },
  { ta: "செவ்வாய்", en: "Tuesday (Bhauma)", hi: "मंगलवार (भौम)" },
  { ta: "புதன்", en: "Wednesday (Saumya)", hi: "बुधवार (सौम्य)" },
  { ta: "வியாழன்", en: "Thursday (Guru)", hi: "गुरुवार (गुरु)" },
  { ta: "வெள்ளி", en: "Friday (Bhrigu)", hi: "शुक्रवार (भृगु)" },
  { ta: "சனி", en: "Saturday (Sthira)", hi: "शनिवार (स्थिर)" },
];

// Tamil solar months (Tamil calendar) — used for month name from Sun's sidereal rasi
export const TAMIL_MONTHS: Bilingual[] = [
  { ta: "சித்திரை", en: "Chithirai", hi: "चित्तिरै" }, // Sun in Mesha
  { ta: "வைகாசி", en: "Vaikasi", hi: "वैकासि" },
  { ta: "ஆனி", en: "Aani", hi: "आनि" },
  { ta: "ஆடி", en: "Aadi", hi: "आडि" },
  { ta: "ஆவணி", en: "Aavani", hi: "आवणि" },
  { ta: "புரட்டாசி", en: "Purattasi", hi: "पुरट्टासि" },
  { ta: "ஐப்பசி", en: "Aippasi", hi: "ऐप्पसि" },
  { ta: "கார்த்திகை", en: "Karthigai", hi: "कार्तिगै" },
  { ta: "மார்கழி", en: "Margazhi", hi: "मार्गऴि" },
  { ta: "தை", en: "Thai", hi: "तै" },
  { ta: "மாசி", en: "Maasi", hi: "मासि" },
  { ta: "பங்குனி", en: "Panguni", hi: "पंगुनि" },
];

// Gregorian calendar months (for date pickers) — bilingual
export const GREGORIAN_MONTHS: Bilingual[] = [
  { ta: "ஜனவரி", en: "January", hi: "जनवरी" },
  { ta: "பிப்ரவரி", en: "February", hi: "फ़रवरी" },
  { ta: "மார்ச்", en: "March", hi: "मार्च" },
  { ta: "ஏப்ரல்", en: "April", hi: "अप्रैल" },
  { ta: "மே", en: "May", hi: "मई" },
  { ta: "ஜூன்", en: "June", hi: "जून" },
  { ta: "ஜூலை", en: "July", hi: "जुलाई" },
  { ta: "ஆகஸ்ட்", en: "August", hi: "अगस्त" },
  { ta: "செப்டம்பர்", en: "September", hi: "सितम्बर" },
  { ta: "அக்டோபர்", en: "October", hi: "अक्टूबर" },
  { ta: "நவம்பர்", en: "November", hi: "नवम्बर" },
  { ta: "டிசம்பர்", en: "December", hi: "दिसम्बर" },
];

// Rasi lords (adhipathi) — index into GRAHAS (0=Sun..6=Saturn)
export const RASI_LORDS = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4];

// ── Graha Drishti (planetary aspects, whole-sign) ───────────────────
// Every planet aspects the 7th sign from itself. Special aspects:
//   Mars (2): 4th & 8th also; Jupiter (4): 5th & 9th also;
//   Saturn (6): 3rd & 10th also. Rahu/Ketu (7/8): treated like Jupiter
//   (5th, 7th, 9th) per common Tamil/Parashari practice.
// Distances are 1-based whole-sign counts (2 = next sign, 7 = opposite).
export const SPECIAL_DRISHTI: Record<number, number[]> = {
  2: [4, 7, 8],
  4: [5, 7, 9],
  6: [3, 7, 10],
  7: [5, 7, 9],
  8: [5, 7, 9],
};

// Whole-sign distance (1..12) from sign `from` to sign `to` (1 = same sign).
export function signDistance(from: number, to: number): number {
  return ((to - from + 12) % 12) + 1;
}

// Does a graha placed in `fromSign` cast an aspect (drishti) onto `toSign`?
// Returns the drishti number (e.g. 7, 5, 9) if it aspects, else 0.
export function aspectFromTo(grahaIndex: number, fromSign: number, toSign: number): number {
  const dist = signDistance(fromSign, toSign);
  const casts = SPECIAL_DRISHTI[grahaIndex] ?? [7];
  return casts.includes(dist) ? dist : 0;
}

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
  appName: { ta: "LOKI ஜோதிடம்", en: "LOKI HORO", hi: "LOKI ज्योतिष" },
  jathagam: { ta: "ஜாதகம்", en: "Jathagam", hi: "जन्म कुंडली" },
  // Kocharam (Tamil) = Gochara/Gochar (Sanskrit/Hindi) = planetary transit.
  // Same concept, three languages: கோள்+சாரம் "movement of planets".
  panchangam: { ta: "கோச்சாரம்", en: "Gochar (Transit)", hi: "गोचर (ट्रांज़िट)" },
  settings: { ta: "அமைப்புகள்", en: "Settings", hi: "सेटिंग्स" },
  savedShort: { ta: "சேமித்தவை", en: "Saved", hi: "सहेजे" },
  language: { ta: "மொழி", en: "Language", hi: "भाषा" },
  theme: { ta: "தீம்", en: "Theme", hi: "थीम" },
  lightMode: { ta: "வெளிச்சம்", en: "Light", hi: "लाइट" },
  darkMode: { ta: "இருள்", en: "Dark", hi: "डार्क" },
  defaultChartStyle: { ta: "இயல்பு கட்ட வகை", en: "Default Chart Style", hi: "डिफ़ॉल्ट कुंडली शैली" },
  aboutApp: { ta: "பற்றி", en: "About", hi: "परिचय" },
  settingsIntro: { ta: "மொழி, தீம் மற்றும் கட்ட வகையை மாற்றவும்.", en: "Adjust language, theme, and chart style.", hi: "भाषा, थीम और कुंडली शैली समायोजित करें।" },
  birthChart: { ta: "பிறப்பு ஜாதகம்", en: "Birth Chart", hi: "जन्म कुंडली" },
  dailyAlmanac: { ta: "தினசரி பஞ்சாங்கம்", en: "Daily Almanac", hi: "दैनिक पंचांग" },
  name: { ta: "பெயர்", en: "Name", hi: "नाम" },
  dob: { ta: "பிறந்த தேதி", en: "Date of Birth", hi: "जन्म तिथि" },
  tob: { ta: "பிறந்த நேரம்", en: "Time of Birth", hi: "जन्म समय" },
  pob: { ta: "பிறந்த இடம்", en: "Place of Birth", hi: "जन्म स्थान" },
  date: { ta: "தேதி", en: "Date", hi: "तिथि" },
  place: { ta: "இடம்", en: "Place", hi: "स्थान" },
  generate: { ta: "ஜாதகம் உருவாக்கு", en: "Generate Chart", hi: "कुंडली बनाएं" },
  editDetails: { ta: "திருத்து", en: "Edit", hi: "संपादित करें" },
  editHint: { ta: "தேதி & நேரத்தை மாற்ற திருத்து பொத்தானை அழுத்தவும்.", en: "Click the edit pen to change date & time.", hi: "तिथि व समय बदलने के लिए संपादन पेन पर क्लिक करें।" },
  saveChanges: { ta: "மாற்றங்களைச் சேமி", en: "Save Changes", hi: "परिवर्तन सहेजें" },
  cancelEdit: { ta: "ரத்து", en: "Cancel", hi: "रद्द करें" },
  calculate: { ta: "கணக்கிடு", en: "Calculate", hi: "गणना करें" },
  setupTitle: { ta: "வரவேற்கிறோம்", en: "Welcome", hi: "स्वागत है" },
  setupSubtitle: { ta: "தொடங்குமுன் உங்கள் விருப்பங்களைத் தேர்ந்தெடுக்கவும்.", en: "Choose your preferences to get started.", hi: "शुरू करने के लिए अपनी प्राथमिकताएं चुनें।" },
  chooseLanguage: { ta: "மொழி", en: "Language", hi: "भाषा" },
  chooseChartStyle: { ta: "கட்ட வகை", en: "Chart Style", hi: "कुंडली शैली" },
  langTamil: { ta: "தமிழ்", en: "Tamil", hi: "तमिल" },
  langEnglish: { ta: "ஆங்கிலம்", en: "English", hi: "अंग्रेज़ी" },
  continueBtn: { ta: "தொடரு", en: "Continue", hi: "जारी रखें" },
  changeLater: { ta: "மொழியை பின்னர் மேல் பட்டியில் மாற்றலாம்.", en: "You can toggle the language anytime from the top bar.", hi: "आप भाषा को कभी भी ऊपरी पट्टी से बदल सकते हैं।" },
  chartStyle: { ta: "கட்ட வகை", en: "Chart Style", hi: "कुंडली शैली" },
  southStyle: { ta: "தென்னிந்திய", en: "South Indian", hi: "दक्षिण भारतीय" },
  northStyle: { ta: "வட இந்திய", en: "North Indian", hi: "उत्तर भारतीय" },
  scriptLabel: { ta: "எழுத்து", en: "Script", hi: "लिपि" },
  scriptEn: { ta: "ஆங்கிலம்", en: "English", hi: "अंग्रेज़ी" },
  scriptHi: { ta: "இந்தி", en: "Hindi", hi: "हिन्दी" },
  houseLabel: { ta: "பாவம்", en: "House", hi: "भाव" },
  rasiChart: { ta: "ராசி கட்டம் (D-1)", en: "Rasi Chart (D-1)", hi: "राशि कुंडली (D-1)" },
  navamsaChart: { ta: "நவாம்ச கட்டம் (D-9)", en: "Navamsa Chart (D-9)", hi: "नवांश कुंडली (D-9)" },
  planetPositions: { ta: "கிரக நிலைகள்", en: "Planetary Positions", hi: "ग्रह स्थिति" },
  graha: { ta: "கிரகம்", en: "Planet", hi: "ग्रह" },
  rasi: { ta: "ராசி", en: "Rasi", hi: "राशि" },
  degree: { ta: "பாகை", en: "Degree", hi: "अंश" },
  nakshatra: { ta: "நட்சத்திரம்", en: "Nakshatra", hi: "नक्षत्र" },
  pada: { ta: "பாதம்", en: "Pada", hi: "पाद" },
  retro: { ta: "வக்ரம்", en: "Retro", hi: "वक्री" },
  tithi: { ta: "திதி", en: "Tithi", hi: "तिथि" },
  yoga: { ta: "யோகம்", en: "Yogam", hi: "योग" },
  karana: { ta: "கரணம்", en: "Karanam", hi: "करण" },
  vara: { ta: "வாரம்", en: "Vaaram", hi: "वार" },
  tamilMonth: { ta: "தமிழ் மாதம்", en: "Tamil Month", hi: "तमिल माह" },
  sunrise: { ta: "சூரிய உதயம்", en: "Sunrise", hi: "सूर्योदय" },
  sunset: { ta: "சூரிய அஸ்தமனம்", en: "Sunset", hi: "सूर्यास्त" },
  rahuKalam: { ta: "ராகு காலம்", en: "Rahu Kalam", hi: "राहु काल" },
  yamagandam: { ta: "எமகண்டம்", en: "Yamagandam", hi: "यमगंड" },
  kuligai: { ta: "குளிகை", en: "Kuligai", hi: "गुलिक" },
  moonSign: { ta: "ஜென்ம ராசி", en: "Moon Sign (Janma Rasi)", hi: "जन्म राशि" },
  birthStar: { ta: "ஜென்ம நட்சத்திரம்", en: "Birth Star (Janma Nakshatra)", hi: "जन्म नक्षत्र" },
  lagnaLabel: { ta: "லக்னம்", en: "Lagna", hi: "लग्न" },
  auspicious: { ta: "நல்ல நேரம்", en: "Auspicious", hi: "शुभ समय" },
  inauspicious: { ta: "தீய நேரம்", en: "Inauspicious", hi: "अशुभ समय" },
  loading: { ta: "கணக்கிடுகிறது…", en: "Calculating…", hi: "गणना हो रही है…" },
  useNow: { ta: "இன்று", en: "Today", hi: "आज" },
  searchPlace: { ta: "நகரத்தைத் தேடு", en: "Search a city", hi: "शहर खोजें" },
  save: { ta: "சேமி", en: "Save", hi: "सहेजें" },
  saved: { ta: "சேமித்த ஜாதகங்கள்", en: "Saved Charts", hi: "सहेजी गई कुंडलियाँ" },
  savedAuto: { ta: "சேமிக்கப்பட்டது", en: "Saved", hi: "सहेजा गया" },
  noCharts: { ta: "இதுவரை ஜாதகம் எதுவும் சேமிக்கப்படவில்லை.", en: "No saved charts yet.", hi: "अभी तक कोई कुंडली सहेजी नहीं गई।" },
  loadChart: { ta: "திற", en: "Open", hi: "खोलें" },
  deleteChart: { ta: "நீக்கு", en: "Delete", hi: "हटाएं" },
  unnamed: { ta: "பெயரிடப்படாதது", en: "Unnamed", hi: "अनाम" },
  filters: { ta: "வடிகட்டிகள்", en: "Filters", hi: "फ़िल्टर" },
  filterName: { ta: "பெயர் / ஊர்", en: "Name / City", hi: "नाम / शहर" },
  allLagna: { ta: "எல்லா லக்னம்", en: "All Lagna", hi: "सभी लग्न" },
  allRasi: { ta: "எல்லா ராசி", en: "All Rasi", hi: "सभी राशि" },
  allNakshatra: { ta: "எல்லா நட்சத்திரம்", en: "All Nakshatra", hi: "सभी नक्षत्र" },
  clearFilters: { ta: "நீக்கு", en: "Clear", hi: "साफ़ करें" },
  noMatches: { ta: "வடிகட்டிக்கு பொருந்தும் ஜாதகம் இல்லை.", en: "No charts match your filters.", hi: "आपके फ़िल्टर से मेल खाती कोई कुंडली नहीं।" },
  dignity: { ta: "கிரக பலம்", en: "Dignity", hi: "ग्रह बल" },
  strength: { ta: "மதிப்பு", en: "Strength", hi: "बल" },
  dignityLegend: { ta: "கிரக பல அளவுகோல்", en: "Planetary Strength Scale", hi: "ग्रह बल मापदंड" },
  year: { ta: "வருடம்", en: "Year", hi: "वर्ष" },
  month: { ta: "மாதம்", en: "Month", hi: "माह" },
  day: { ta: "தேதி", en: "Day", hi: "दिन" },
  hour: { ta: "மணி", en: "Hour", hi: "घंटा" },
  minute: { ta: "நிமிடம்", en: "Minute", hi: "मिनट" },
  ampm: { ta: "AM/PM", en: "AM/PM", hi: "AM/PM" },
  dashaTitle: { ta: "விம்ஷோத்தரி தசா (கால அட்டவணை)", en: "Vimshottari Dasha (Planetary Periods)", hi: "विंशोत्तरी दशा (ग्रह काल)" },
  dashaSubtitle: {
    ta: "பிறப்பிலிருந்து 120 ஆண்டுகள் — தசா ▸ புக்தி ▸ அந்தரம் ▸ சூட்சுமம். விரிவாக்க வரிசைக் கிளிக் செய்யவும்.",
    en: "120 years from birth — Dasha ▸ Bhukti ▸ Antharam ▸ Sookshma. Click a row to expand.",
    hi: "जन्म से 120 वर्ष — दशा ▸ भुक्ति ▸ अंतर ▸ सूक्ष्म। विस्तार हेतु पंक्ति पर क्लिक करें।",
  },
  mahaDasha: { ta: "தசா (மகா தசா)", en: "Maha Dasha", hi: "महादशा" },
  bhukti: { ta: "புக்தி (அந்தர் தசா)", en: "Bhukti (Antardasha)", hi: "भुक्ति (अंतर्दशा)" },
  antharam: { ta: "அந்தரம் (ப்ரத்யந்தர்)", en: "Antharam (Pratyantardasha)", hi: "अंतर (प्रत्यंतर)" },
  sookshma: { ta: "சூட்சும தசா", en: "Sookshma Dasha", hi: "सूक्ष्म दशा" },
  planet: { ta: "கிரகம்", en: "Planet", hi: "ग्रह" },
  startDate: { ta: "தொடக்கம்", en: "Start", hi: "आरंभ" },
  endDate: { ta: "முடிவு", en: "End", hi: "अंत" },
  duration: { ta: "காலஅளவு", en: "Duration", hi: "अवधि" },
  months: { ta: "மாதங்கள்", en: "months", hi: "माह" },
  years: { ta: "ஆண்டுகள்", en: "yrs", hi: "वर्ष" },
  current: { ta: "தற்போது", en: "Now", hi: "अभी" },
  balanceAtBirth: { ta: "பிறப்பில் தசா மிச்சம்", en: "Dasha balance at birth", hi: "जन्म के समय दशा शेष" },
  // Lagna (Panchangam)
  lagnaNow: { ta: "தற்போதைய லக்னம்", en: "Current Lagna", hi: "वर्तमान लग्न" },
  lagnaAtSunrise: { ta: "உதய லக்னம்", en: "Sunrise Lagna", hi: "सूर्योदय लग्न" },
  lagnaNote: {
    ta: "லக்னம் ~2 மணி நேரத்திற்கு ஒருமுறை மாறும். தேர்ந்தெடுத்த நேரத்திற்கானது.",
    en: "Lagna changes about every 2 hours — shown for the selected time.",
    hi: "लग्न लगभग हर 2 घंटे में बदलता है — चयनित समय के लिए दिखाया गया।",
  },
  time: { ta: "நேரம்", en: "Time", hi: "समय" },
  // Tabs
  tabChart: { ta: "ஜாதகம்", en: "Chart", hi: "कुंडली" },
  tabIncidents: { ta: "நிகழ்வுகள்", en: "Incidents", hi: "घटनाएं" },
  tabDashboard: { ta: "பலகை", en: "Dashboard", hi: "डैशबोर्ड" },
  // Lagna dashboard
  dashTitle: { ta: "லக்ன பகுப்பாய்வு", en: "Lagna Analysis", hi: "लग्न विश्लेषण" },
  dashSubtitle: {
    ta: "லக்னம், அதன் அதிபதியின் பலம், சேர்க்கை மற்றும் பார்வைகள்.",
    en: "The ascendant, its lord's strength, conjunctions and aspects.",
    hi: "लग्न, उसके स्वामी का बल, युति और दृष्टियाँ।",
  },
  lagnaHeading: { ta: "லக்னம்", en: "Ascendant (Lagna)", hi: "लग्न" },
  lagnaLord: { ta: "லக்னாதிபதி", en: "Lagna lord", hi: "लग्नेश" },
  planetsInLagna: { ta: "லக்னத்தில் உள்ள கிரகங்கள்", en: "Planets in the Lagna", hi: "लग्न में स्थित ग्रह" },
  aspectsToLagna: { ta: "லக்னத்தைப் பார்க்கும் கிரகங்கள்", en: "Planets aspecting the Lagna", hi: "लग्न को देखने वाले ग्रह" },
  nonePlanetsInLagna: { ta: "லக்னத்தில் கிரகங்கள் எதுவும் இல்லை.", en: "No planets occupy the Lagna.", hi: "लग्न में कोई ग्रह नहीं।" },
  noneAspects: { ta: "லக்னத்தைப் பார்க்கும் கிரகங்கள் எதுவும் இல்லை.", en: "No planets aspect the Lagna.", hi: "लग्न पर कोई दृष्टि नहीं।" },
  lordStrength: { ta: "லக்னாதிபதி பலம் (ஷட்பலம்)", en: "Lagna lord strength (Shadbala)", hi: "लग्नेश बल (षड्बल)" },
  lordConjunctions: { ta: "லக்னாதிபதியுடன் சேர்க்கை", en: "Conjunctions with the Lagna lord", hi: "लग्नेश के साथ युति" },
  lordAspectedBy: { ta: "லக்னாதிபதியைப் பார்க்கும் கிரகங்கள்", en: "Planets aspecting the Lagna lord", hi: "लग्नेश को देखने वाले ग्रह" },
  noneConjunctions: { ta: "சேர்க்கை எதுவும் இல்லை.", en: "No conjunctions.", hi: "कोई युति नहीं।" },
  inSign: { ta: "இல்", en: "in", hi: "में" },
  house: { ta: "பாவம்", en: "house", hi: "भाव" },
  degGap: { ta: "டிகிரி இடைவெளி", en: "gap", hi: "अंतर" },
  tightConj: { ta: "நெருங்கிய சேர்க்கை", en: "tight conjunction", hi: "निकट युति" },
  totalStrength: { ta: "மொத்த பலம்", en: "Total strength", hi: "कुल बल" },
  required: { ta: "தேவையான பலம்", en: "Required", hi: "आवश्यक बल" },
  rupas: { ta: "ரூபம்", en: "Rupas", hi: "रूप" },
  virupas: { ta: "விரூபம்", en: "Virupas", hi: "विरूप" },
  strong: { ta: "வலிமையானது", en: "Strong", hi: "बलवान" },
  moderate: { ta: "நடுத்தரம்", en: "Moderate", hi: "मध्यम" },
  weak: { ta: "பலவீனம்", en: "Weak", hi: "निर्बल" },
  dispositor: { ta: "அதிபதி (வீட்டு எஜமான்)", en: "Dispositor (sign lord)", hi: "राशि स्वामी" },
  dispositorOwnSign: { ta: "தன் சொந்த வீட்டில் — ஆட்சி", en: "in its own sign — powerful", hi: "स्वराशि में — बलवान" },
  lordIsOwnDispositor: { ta: "லக்னாதிபதியே தன் வீட்டில் உள்ளார்", en: "lord is in its own sign", hi: "लग्नेश स्वराशि में है" },
  drikNoAspects: { ta: "0 (பார்வை இல்லை)", en: "0 (no aspects)", hi: "0 (कोई दृष्टि नहीं)" },
  // Ashtakavarga
  ashtakavarga: { ta: "அஷ்டகவர்க்கம்", en: "Ashtakavarga", hi: "अष्टकवर्ग" },
  ashtavargaTab: { ta: "அஷ்டகவர்க்கம்", en: "Ashtakavarga", hi: "अष्टकवर्ग" },
  ashtakavargaSubtitle: {
    ta: "ஒவ்வொரு ராசியின் பலம் — சர்வ (SAV) மற்றும் ஒவ்வொரு கிரகத்தின் பின்ன (BAV) பிந்துக்கள்.",
    en: "Benefic-point strength of each sign — Sarva (SAV) and per-planet Bhinna (BAV) bindus.",
    hi: "प्रत्येक राशि का बल — सर्व (SAV) व प्रत्येक ग्रह का भिन्न (BAV) बिंदु।",
  },
  sav: { ta: "சர்வாஷ்டகவர்க்கம் (SAV)", en: "Sarvashtakavarga (SAV)", hi: "सर्वाष्टकवर्ग (SAV)" },
  savDesc: {
    ta: "எல்லா கிரகங்களின் மொத்த பிந்துக்கள் (மொத்தம் 337).",
    en: "Total bindus from all planets per sign (sums to 337).",
    hi: "सभी ग्रहों के कुल बिंदु (योग 337)।",
  },
  bindus: { ta: "பிந்துக்கள்", en: "bindus", hi: "बिंदु" },
  bavPerPlanet: { ta: "ஒவ்வொரு கிரகத்தின் பின்னாஷ்டகவர்க்கம் (BAV)", en: "Per-planet Bhinnashtakavarga (BAV)", hi: "प्रत्येक ग्रह का भिन्नाष्टकवर्ग (BAV)" },
  strongSigns: { ta: "வலிமையான ராசிகள் (30+ SAV)", en: "Strong signs (30+ SAV)", hi: "बलवान राशियाँ (30+ SAV)" },
  // KN Rao concepts
  knRaoTab: { ta: "கே.என். ராவ்", en: "KN Rao", hi: "के.एन. राव" },
  knRaoTitle: { ta: "கே.என். ராவ் கோட்பாடுகள்", en: "KN Rao Concepts", hi: "के.एन. राव सिद्धांत" },
  knRaoSubtitle: {
    ta: "ஜைமினி சர காரகர்கள், சர தசா, ப்ருகு பிந்து மற்றும் சிறப்பு லக்னங்கள்.",
    en: "Jaimini Chara Karakas, Chara Dasha, Bhrigu Bindu and special lagnas.",
    hi: "जैमिनी चर कारक, चर दशा, भृगु बिंदु और विशेष लग्न।",
  },
  charaKarakas: { ta: "சர காரகர்கள் (ஜைமினி)", en: "Chara Karakas (Jaimini)", hi: "चर कारक (जैमिनी)" },
  charaKarakasDesc: {
    ta: "7 கிரகங்கள் ராசியில் உள்ள பாகையின் அடிப்படையில் தரம் செய்யப்பட்டன.",
    en: "7 planets ranked by their degree within their sign (highest → Atmakaraka).",
    hi: "7 ग्रह अपनी राशि में अंश के आधार पर क्रमित (सर्वाधिक → आत्मकारक)।",
  },
  charaDasha: { ta: "சர தசா (ஜைமினி)", en: "Chara Dasha (Jaimini)", hi: "चर दशा (जैमिनी)" },
  charaDashaDesc: {
    ta: "ராசி அடிப்படையிலான தசா கால வரிசை.",
    en: "Sign-based dasha timeline — KN Rao's signature predictive tool.",
    hi: "राशि आधारित दशा समयरेखा।",
  },
  directSeq: { ta: "நேர் (சுழற்சி)", en: "Direct", hi: "प्रत्यक्ष" },
  reverseSeq: { ta: "நேர்மறு (எதிர்)", en: "Reverse", hi: "विपरीत" },
  yearsShort: { ta: "ஆண்டு", en: "yrs", hi: "वर्ष" },
  ageLabel: { ta: "வயது", en: "Age", hi: "आयु" },
  bhriguBindu: { ta: "ப்ருகு பிந்து", en: "Bhrigu Bindu", hi: "भृगु बिंदु" },
  bhriguBinduDesc: {
    ta: "சந்திரன்–ராகு நடுப்புள்ளி — விதியின் உணர்திறன் புள்ளி.",
    en: "Moon–Rahu midpoint — a sensitive destiny point.",
    hi: "चंद्र–राहु मध्यबिंदु — भाग्य का संवेदनशील बिंदु।",
  },
  specialLagnas: { ta: "சிறப்பு லக்னங்கள்", en: "Special Lagnas", hi: "विशेष लग्न" },
  horaLagna: { ta: "ஹோரா லக்னம்", en: "Hora Lagna", hi: "होरा लग्न" },
  horaLagnaDesc: { ta: "செல்வம் / வளம்", en: "Wealth & prosperity", hi: "धन व समृद्धि" },
  ghatikaLagna: { ta: "கடிக லக்னம்", en: "Ghatika Lagna", hi: "घटिका लग्न" },
  ghatikaLagnaDesc: { ta: "அதிகாரம் / சக்தி", en: "Power & authority", hi: "शक्ति व अधिकार" },
  arudhaLagna: { ta: "ஆரூட லக்னம்", en: "Arudha Lagna", hi: "आरूढ़ लग्न" },
  arudhaLagnaDesc: { ta: "பிம்பம் / காணப்படும் சுயம்", en: "Public image, perceived self", hi: "सार्वजनिक छवि, प्रत्यक्ष स्व" },
  karakamsa: { ta: "காரகாம்சம்", en: "Karakamsa", hi: "कारकांश" },
  karakamsaDesc: { ta: "நவாம்சத்தில் ஆத்மகாரகன் — ஆன்மிக / தொழில் அடிப்படை", en: "Atmakaraka in navamsa — spiritual & career signature", hi: "नवांश में आत्मकारक — आध्यात्मिक व व्यावसायिक संकेत" },
  house_: { ta: "பாவம்", en: "house", hi: "भाव" },
  fromLagna: { ta: "லக்னத்திலிருந்து", en: "from lagna", hi: "लग्न से" },
  currentPeriod: { ta: "தற்போதைய தசா", en: "Current period", hi: "वर्तमान दशा" },
  dashNeedChart: {
    ta: "பகுப்பாய்வைக் காண முதலில் ஒரு ஜாதகத்தை உருவாக்கவும் அல்லது திறக்கவும்.",
    en: "Generate or open a chart first to see the analysis.",
    hi: "विश्लेषण देखने के लिए पहले कुंडली बनाएं या खोलें।",
  },
  degShort: { ta: "°", en: "°", hi: "°" },
  // Incidents
  incidentsTitle: { ta: "வாழ்க்கை நிகழ்வுகள்", en: "Life Incidents", hi: "जीवन घटनाएं" },
  incidentsSubtitle: {
    ta: "இந்த ஜாதகத்திற்கான நல்ல/கெட்ட நிகழ்வுகளைப் பதிவு செய்யவும்.",
    en: "Record good or bad life events for this chart.",
    hi: "इस कुंडली हेतु शुभ/अशुभ घटनाएं दर्ज करें।",
  },
  incidentName: { ta: "நிகழ்வின் பெயர்", en: "Incident name", hi: "घटना का नाम" },
  incidentKind: { ta: "வகை", en: "Type", hi: "प्रकार" },
  good: { ta: "நல்லது", en: "Good", hi: "शुभ" },
  bad: { ta: "கெட்டது", en: "Bad", hi: "अशुभ" },
  singleDay: { ta: "ஒரே நாள் நிகழ்வு", en: "Single-day event", hi: "एक-दिवसीय घटना" },
  addIncident: { ta: "நிகழ்வைச் சேர்", en: "Add incident", hi: "घटना जोड़ें" },
  noIncidents: { ta: "இதுவரை நிகழ்வுகள் எதுவும் பதிவாகவில்லை.", en: "No incidents recorded yet.", hi: "अभी तक कोई घटना दर्ज नहीं।" },
  incidentsNeedChart: {
    ta: "நிகழ்வுகளைப் பதிவு செய்ய முதலில் ஒரு ஜாதகத்தை உருவாக்கவும் அல்லது திறக்கவும்.",
    en: "Generate or open a chart first to record incidents against it.",
    hi: "घटनाएं दर्ज करने के लिए पहले कुंडली बनाएं या खोलें।",
  },
  note: { ta: "குறிப்பு (விருப்பம்)", en: "Note (optional)", hi: "टिप्पणी (वैकल्पिक)" },
  days: { ta: "நாட்கள்", en: "days", hi: "दिन" },
  oneDay: { ta: "1 நாள்", en: "1 day", hi: "1 दिन" },
  forChart: { ta: "ஜாதகம்", en: "For", hi: "हेतु" },
  disclaimer: {
    ta: "இது Lahiri அயனாம்சத்தை அடிப்படையாகக் கொண்ட நிரயன (சைடீரியல்) கணக்கீடு.",
    en: "Sidereal (Nirayana) calculations based on Lahiri ayanamsa.",
    hi: "लाहिरी अयनांश पर आधारित निरयन (सायडीरियल) गणना।",
  },
  // ── Box detail (tap a rasi cell) ──────────────────────────────
  tapHint: { ta: "விவரங்களைக் காண ஒரு ராசி கட்டத்தைத் தட்டவும்", en: "Tap a sign box to see its details", hi: "विवरण देखने के लिए किसी राशि खाने को टैप करें" },
  boxDetail: { ta: "ராசி விவரம்", en: "Sign Details", hi: "राशि विवरण" },
  signLord: { ta: "ராசி அதிபதி", en: "Sign Lord", hi: "राशि स्वामी" },
  lordPower: { ta: "அதிபதியின் பலம்", en: "Lord's Power", hi: "स्वामी का बल" },
  placedIn: { ta: "அமைந்துள்ளது", en: "placed in", hi: "स्थित" },
  occupants: { ta: "இந்த ராசியில் உள்ள கிரகங்கள்", en: "Planets in this box", hi: "इस खाने के ग्रह" },
  noOccupants: { ta: "இந்த ராசியில் கிரகங்கள் எதுவும் இல்லை.", en: "No planets in this box.", hi: "इस खाने में कोई ग्रह नहीं।" },
  aspectingThis: { ta: "இந்த ராசியைப் பார்க்கும் கிரகங்கள்", en: "Planets aspecting this box", hi: "इस खाने को देखने वाले ग्रह" },
  noAspecting: { ta: "இந்த ராசியை எந்தக் கிரகமும் பார்க்கவில்லை.", en: "No planets aspect this box.", hi: "कोई ग्रह इस खाने को नहीं देखता।" },
  drishti: { ta: "பார்வை", en: "drishti", hi: "दृष्टि" },
  atDeg: { ta: "பாகையில்", en: "at", hi: "पर" },
  closeDetail: { ta: "மூடு", en: "Close", hi: "बंद करें" },
  emptyBox: { ta: "காலி ராசி", en: "Empty sign", hi: "रिक्त राशि" },

  // ── KN Rao interpretive analysis (verdicts) ──────────────────
  knRaoAnalysisTitle: { ta: "கே.என். ராவ் — கணிப்பு முடிவுகள்", en: "KN Rao — Predictive Read", hi: "के.एन. राव — भविष्यवाणी" },
  knRaoAnalysisDesc: {
    ta: "சர காரகர்கள் + பாவங்கள் + நவாம்சத்தை இணைத்து தொழில், திருமணம், குழந்தைகள், யோகங்கள் மற்றும் ஆன்மிகம் குறித்த முடிவுகள்.",
    en: "Career, marriage, children, yogas and spirituality read from Chara Karakas + houses + navamsa together.",
    hi: "चर कारक + भाव + नवांश मिलाकर करियर, विवाह, संतान, योग व अध्यात्म पर निष्कर्ष।",
  },
  rulesApplied: { ta: "பயன்படுத்தப்பட்ட விதிகள்", en: "Rules applied", hi: "लागू नियम" },

  // ── Aditya Guruji tab ────────────────────────────────────────
  gurujiTab: { ta: "ஆதித்யா குருஜி", en: "Aditya Guruji", hi: "आदित्य गुरुजी" },
  gurujiTitle: { ta: "ஆதித்யா குருஜி — சுபத்துவம் & பாபத்துவம்", en: "Aditya Guruji — Subathuvam & Papathuvam", hi: "आदित्य गुरुजी — सुभत्वम व पापत्वम" },
  gurujiSubtitle: {
    ta: "ஒவ்வொரு கிரகத்தின் சுபத்துவம் (நன்மை), பாபத்துவம் (தீமை) மற்றும் சூட்சும வலு; அஸ்தமனம், பாதகம், 6-8-12 சுமை மற்றும் அதி யோகம்.",
    en: "Each planet's Subathuvam (beneficence), Papathuvam (maleficence) and Sootchuma Valu; plus Astamana, Bhadhaka, the 6-8-12 load and Adhi Yoga.",
    hi: "प्रत्येक ग्रह का सुभत्वम (शुभता), पापत्वम (अशुभता) व सूक्ष्म बल; साथ ही अस्तमन, बाधक, 6-8-12 भार व अधि योग।",
  },
  scoreboard: { ta: "கிரக வலு அட்டவணை", en: "Planet Strength Scoreboard", hi: "ग्रह बल तालिका" },
  subathuvam: { ta: "சுபத்துவம்", en: "Subathuvam", hi: "सुभत्वम" },
  papathuvam: { ta: "பாபத்துவம்", en: "Papathuvam", hi: "पापत्वम" },
  sootchumaValu: { ta: "சூட்சும வலு", en: "Sootchuma Valu", hi: "सूक्ष्म बल" },
  netStrength: { ta: "நிகர வலு", en: "Net", hi: "शुद्ध" },
  bandHigh: { ta: "உயர் நன்மை", en: "Strongly beneficial", hi: "अति शुभ" },
  bandMedium: { ta: "நடுத்தர", en: "Moderate", hi: "मध्यम" },
  bandLow: { ta: "பலவீனம்", en: "Weak", hi: "निर्बल" },
  bandAfflicted: { ta: "பீடிக்கப்பட்டது", en: "Afflicted", hi: "पीड़ित" },
  gurujiFindings: { ta: "முக்கிய கண்டுபிடிப்புகள்", en: "Key Findings", hi: "मुख्य निष्कर्ष" },
  toneGood: { ta: "சாதகம்", en: "Favourable", hi: "अनुकूल" },
  toneMixed: { ta: "கலப்பு", en: "Mixed", hi: "मिश्रित" },
  toneCaution: { ta: "எச்சரிக்கை", en: "Caution", hi: "सावधानी" },
  toneInfo: { ta: "தகவல்", en: "Note", hi: "सूचना" },

  // ── About the Person (Persona) tab ───────────────────────────
  personaTab: { ta: "நபர் பற்றி", en: "About the Person", hi: "व्यक्ति के बारे में" },
  personaTitle: { ta: "இந்த நபரைப் பற்றி", en: "About This Person", hi: "इस व्यक्ति के बारे में" },
  personaSubtitle: {
    ta: "லக்னம் + ராசி இயல்பு மற்றும் கிரக வலு/யோகங்களை இணைத்து குணநலன்கள்; ஏன் அப்படி என்பதற்கான காரணத்துடன். மேலும் கடந்த தசைகளின் அடிப்படையில் நிகழ்ந்திருக்கக்கூடிய நிகழ்வுகள் — நிகழ்தகவு % உடன்.",
    en: "Character traits combining Lagna + Moon-sign nature with planetary strength and yogas — each with the reason WHY. Plus likely past events derived from your elapsed dasha periods, each with a probability %.",
    hi: "लग्न + चंद्र-राशि स्वभाव को ग्रह-बल व योगों के साथ जोड़कर बनाए गए गुण — प्रत्येक के 'क्यों' कारण सहित। साथ ही बीती दशाओं के आधार पर संभावित अतीत की घटनाएँ — प्रत्येक की प्रायिकता % सहित।",
  },
  characterHeading: { ta: "குணநலன்கள்", en: "Character Traits", hi: "चरित्र लक्षण" },
  pastEventsHeading: { ta: "கடந்த நிகழ்வுகள் (தசை அடிப்படையில்)", en: "Likely Past Events (Dasha-based)", hi: "संभावित अतीत घटनाएँ (दशा-आधारित)" },
  whyLabel: { ta: "ஏன்", en: "Why", hi: "क्यों" },
  probabilityLabel: { ta: "நிகழ்தகவு", en: "Probability", hi: "प्रायिकता" },
  personaDisclaimer: {
    ta: "இவை பாரம்பரிய ஜோதிட விதிகளின் அடிப்படையிலான பொதுவான அறிகுறிகள் மட்டுமே; உறுதியான கணிப்புகள் அல்ல.",
    en: "These are general indications based on classical astrological rules — guidance, not guaranteed predictions.",
    hi: "ये शास्त्रीय ज्योतिष नियमों पर आधारित सामान्य संकेत हैं — मार्गदर्शन, निश्चित भविष्यवाणी नहीं।",
  },

  // ── Accounts / Auth ──────────────────────────────────────────
  signIn: { ta: "உள்நுழை", en: "Sign In", hi: "साइन इन" },
  signUp: { ta: "பதிவு செய்", en: "Sign Up", hi: "साइन अप" },
  signOut: { ta: "வெளியேறு", en: "Sign Out", hi: "साइन आउट" },
  authWelcome: { ta: "லோகி ஹோரோவுக்கு வரவேற்கிறோம்", en: "Welcome to LOKI HORO", hi: "लोकी होरो में आपका स्वागत है" },
  authTagline: {
    ta: "உங்கள் ஜாதகங்கள் தனிப்பட்டவை. உள்நுழைந்து நீங்கள் சேமித்தவற்றை மட்டும் பார்க்கவும்.",
    en: "Your charts are private. Sign in to see only the ones you save.",
    hi: "आपकी कुंडलियाँ निजी हैं। साइन इन करके केवल अपनी सहेजी कुंडलियाँ देखें।",
  },
  emailLabel: { ta: "மின்னஞ்சல்", en: "Email", hi: "ईमेल" },
  passwordLabel: { ta: "கடவுச்சொல்", en: "Password", hi: "पासवर्ड" },
  nameLabel: { ta: "பெயர்", en: "Name", hi: "नाम" },
  noAccountYet: { ta: "கணக்கு இல்லையா? பதிவு செய்யவும்", en: "No account? Sign up", hi: "खाता नहीं? साइन अप करें" },
  haveAccount: { ta: "ஏற்கனவே கணக்கு உள்ளதா? உள்நுழையவும்", en: "Already have an account? Sign in", hi: "पहले से खाता है? साइन इन करें" },
  authError: { ta: "தவறான மின்னஞ்சல் அல்லது கடவுச்சொல்.", en: "Invalid email or password.", hi: "अमान्य ईमेल या पासवर्ड।" },
  orLabel: { ta: "அல்லது", en: "or", hi: "या" },
  continueWithGoogle: { ta: "Google மூலம் தொடரவும்", en: "Continue with Google", hi: "Google से जारी रखें" },
  loggedInAs: { ta: "உள்நுழைந்துள்ளவர்", en: "Signed in as", hi: "साइन इन" },
  adminBadge: { ta: "நிர்வாகி", en: "Admin", hi: "एडमिन" },

  // ── Sharing ──────────────────────────────────────────────────
  share: { ta: "பகிர்", en: "Share", hi: "साझा करें" },
  shareChartTitle: { ta: "இந்த ஜாதகத்தைப் பகிர்", en: "Share this chart", hi: "यह कुंडली साझा करें" },
  shareByEmail: { ta: "பயனரின் மின்னஞ்சலை உள்ளிடவும்", en: "Enter the user's email", hi: "उपयोगकर्ता का ईमेल दर्ज करें" },
  sharedWith: { ta: "பகிரப்பட்டவர்கள்", en: "Shared with", hi: "इनके साथ साझा" },
  noShares: { ta: "இதுவரை யாருடனும் பகிரப்படவில்லை.", en: "Not shared with anyone yet.", hi: "अभी तक किसी के साथ साझा नहीं।" },
  removeShare: { ta: "நீக்கு", en: "Remove", hi: "हटाएँ" },
  shareAdded: { ta: "பகிரப்பட்டது", en: "Shared", hi: "साझा किया गया" },
  close: { ta: "மூடு", en: "Close", hi: "बंद करें" },
  ownedBy: { ta: "உரிமையாளர்", en: "Owner", hi: "स्वामी" },
  sharedBadge: { ta: "பகிரப்பட்டது", en: "Shared with you", hi: "आपके साथ साझा" },

  // ── Admin members view ───────────────────────────────────────
  membersTab: { ta: "உறுப்பினர்கள்", en: "Members", hi: "सदस्य" },
  membersTitle: { ta: "அனைத்து உறுப்பினர்கள்", en: "All Members", hi: "सभी सदस्य" },
  membersSubtitle: {
    ta: "நிர்வாகியாக, அனைத்து உறுப்பினர்களையும் அவர்களின் சேமித்த ஜாதகங்களின் எண்ணிக்கையையும் காணலாம்.",
    en: "As admin, you can see every member and how many charts each has saved.",
    hi: "एडमिन के रूप में, आप हर सदस्य और उनकी सहेजी कुंडलियों की संख्या देख सकते हैं।",
  },
  chartCountLabel: { ta: "சேமித்த ஜாதகங்கள்", en: "Saved charts", hi: "सहेजी कुंडलियाँ" },
  joinedLabel: { ta: "சேர்ந்த நாள்", en: "Joined", hi: "शामिल हुए" },

  // ── K.N. Rao Rise / Surprise / Fall tab ──────────────────────
  riseFallTab: { ta: "உயர்வு / வீழ்ச்சி", en: "Rise / Fall", hi: "उत्थान / पतन" },
  riseFallTitle: {
    ta: "கே.என்.ராவ் — உயர்வு, எதிர்பாராதது & வீழ்ச்சி",
    en: "K.N. Rao — Rise, Surprise & Fall",
    hi: "के.एन. राव — उत्थान, आश्चर्य व पतन",
  },
  riseFallSubtitle: {
    ta: "கே.என்.ராவின் அரசியல் முன்கணிப்பு முறை: ராஜயோகங்கள், குரு-சனி இரட்டை கோச்சாரம், தசை காலம் — உயர்வு, எதிர்பாராத திருப்பம் அல்லது வீழ்ச்சியைக் கணித்தல்.",
    en: "K.N. Rao's political-prediction method: Rajayogas, the Jupiter–Saturn double transit, and Dasha timing — read together to gauge a rise, a surprise turn, or a fall.",
    hi: "के.एन. राव की राजनीतिक भविष्यवाणी पद्धति: राजयोग, गुरु–शनि दोहरा गोचर, व दशा-काल — मिलकर उत्थान, आश्चर्यजनक मोड़ या पतन का आकलन।",
  },
  riseFallHeadline: { ta: "சாராம்சம்", en: "Summary", hi: "सारांश" },
  riseFallConfidence: { ta: "நம்பகத்தன்மை", en: "Confidence", hi: "विश्वास" },
  riseFallYogaStrength: { ta: "யோக பலம்", en: "Yoga strength", hi: "योग बल" },
  riseFallYogaCount: { ta: "ராஜயோகங்கள்", en: "Rajayogas", hi: "राजयोग" },
  riseFallTransit: { ta: "கோச்சார அமைப்பு", en: "Transit pattern", hi: "गोचर पैटर्न" },
  riseFallHouseFocus: { ta: "முக்கிய பாவங்கள்", en: "House focus", hi: "मुख्य भाव" },
  riseFallHouseLabel: { ta: "பாவம்", en: "House", hi: "भाव" },

  // Outcome classes
  outcomeRise: { ta: "உயர்வு", en: "Rise", hi: "उत्थान" },
  outcomeSurprise: { ta: "எதிர்பாராதது", en: "Surprise", hi: "आश्चर्य" },
  outcomeFall: { ta: "வீழ்ச்சி", en: "Fall", hi: "पतन" },

  // Yoga strength labels
  yogaStrong: { ta: "வலுவானது", en: "Strong", hi: "प्रबल" },
  yogaModerate: { ta: "மிதமானது", en: "Moderate", hi: "मध्यम" },
  yogaOrdinary: { ta: "சாதாரணமானது", en: "Ordinary", hi: "साधारण" },

  // Jupiter-Saturn double-transit pattern labels
  patternBlessGive: {
    ta: "சனி அருள்புரிகிறார் & குரு வழங்குகிறார்",
    en: "Saturn blesses & Jupiter gives",
    hi: "शनि आशीष देता है व गुरु प्रदान करता है",
  },
  patternTormentProtect: {
    ta: "சனி வருத்துகிறார் & குரு காக்கிறார்",
    en: "Saturn torments & Jupiter protects",
    hi: "शनि कष्ट देता है व गुरु रक्षा करता है",
  },
  patternTormentWithdraw: {
    ta: "சனி வருத்துகிறார் & குரு பாதுகாப்பை விலக்குகிறார்",
    en: "Saturn torments & Jupiter withdraws protection",
    hi: "शनि कष्ट देता है व गुरु रक्षा हटा लेता है",
  },
  patternCombineDestroy: {
    ta: "சனி & குரு சேர்ந்து அழிக்கின்றனர்",
    en: "Saturn & Jupiter combine to destroy",
    hi: "शनि व गुरु मिलकर विनाश करते हैं",
  },
  patternNeutral: {
    ta: "10ஆம் பாவத்தை வலுவாக தொடாத நிலை",
    en: "Neither strongly touches the 10th",
    hi: "दोनों में से कोई दशम को प्रबलता से नहीं छूता",
  },

  // ── Dasha × Gochara (Dasha-transit prediction) ─────────────────────
  dashaTransitTab: { ta: "தசை–கோச்சாரம்", en: "Dasha · Transit", hi: "दशा · गोचर" },
  dashaTransitTitle: {
    ta: "நடப்பு தசை–புக்தி–அந்தரம் & கோச்சார கணிப்பு",
    en: "Current Dasha–Bhukti–Antara & Transit Forecast",
    hi: "वर्तमान दशा–भुक्ति–अंतर व गोचर पूर्वानुमान",
  },
  dashaTransitSubtitle: {
    ta: "நடக்கும் மகாதசை/புக்தி/அந்தர அதிபதிகளின் ஜாதக சுபத்துவம்/பாபத்துவம், தற்போதைய கோச்சாரம் (குரு/சனி உள்பட), இரண்டையும் இணைத்து கடந்த 5 & வரும் 5 ஆண்டுகளுக்கு காலவாரியான கணிப்பு.",
    en: "The running Maha/Bhukti/Antara lords' natal subhatvam/papatvam, their current gochara (incl. Jupiter/Saturn), and the two combined into time-wise guidance for the past 5 and next 5 years.",
    hi: "चालू महा/भुक्ति/अंतर स्वामियों का जन्म शुभत्व/पापत्व, वर्तमान गोचर (गुरु/शनि सहित), व दोनों का संयोजन — बीते 5 व आगामी 5 वर्षों हेतु समयानुसार मार्गदर्शन।",
  },
  dtRunningTitle: { ta: "நடப்பு தசை அதிபதிகள்", en: "Running dasha lords", hi: "वर्तमान दशा स्वामी" },
  dtDoubleTransit: { ta: "குரு–சனி இரட்டைக் கோச்சாரம்", en: "Jupiter–Saturn double transit", hi: "गुरु–शनि द्वि-गोचर" },
  dtNatal: { ta: "ஜாதகம்", en: "Natal", hi: "जन्म" },
  dtTransit: { ta: "கோச்சாரம்", en: "Transit", hi: "गोचर" },
  dtCombined: { ta: "இணைந்த பலன்", en: "Combined", hi: "संयुक्त" },
  dtOverall: { ta: "ஒட்டுமொத்தப் பலன்", en: "Overall reading", hi: "समग्र फल" },
  dtTimelineTitle: { ta: "காலவரிசை — 1990 முதல் & வரும் 5 ஆண்டுகள்", en: "Timeline — from 1990 & next 5 years", hi: "समयरेखा — 1990 से व आगामी 5 वर्ष" },
  dtStatusPast: { ta: "கடந்தது", en: "Past", hi: "बीता" },
  dtStatusCurrent: { ta: "நடப்பு", en: "Now", hi: "वर्तमान" },
  dtStatusFuture: { ta: "வரவிருப்பது", en: "Ahead", hi: "आगामी" },
  dtDispSubha: { ta: "சுபத்துவம்", en: "Favourable", hi: "शुभ" },
  dtDispPapa: { ta: "பாபத்துவம்", en: "Guarded", hi: "सतर्क" },
  dtDispMixed: { ta: "கலப்பு", en: "Mixed", hi: "मिश्रित" },
  dtShowEarlier: { ta: "முந்தைய காலம் காட்டு (1900–1990)", en: "Show earlier periods (1900–1990)", hi: "पुरानी अवधि दिखाएँ (1900–1990)" },
  dtHideEarlier: { ta: "முந்தைய காலம் மறை", en: "Hide earlier periods", hi: "पुरानी अवधि छिपाएँ" },
};
