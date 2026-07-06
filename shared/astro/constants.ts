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

// Rasi lords (adhipathi) — index into GRAHAS (0=Sun..6=Saturn)
export const RASI_LORDS = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4];

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
  disclaimer: {
    ta: "இது Lahiri அயனாம்சத்தை அடிப்படையாகக் கொண்ட நிரயன (சைடீரியல்) கணக்கீடு.",
    en: "Sidereal (Nirayana) calculations based on Lahiri ayanamsa.",
  },
};
