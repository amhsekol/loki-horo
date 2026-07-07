// Persona analysis — a plain-language reading "about the person".
//
// Two sections, both trilingual (ta / en / hi):
//   1. Character traits (>= 5): combine Lagna sign nature + Moon-sign emotional
//      character + strongest planet + most-afflicted planet + key yogas. Each
//      trait CLEARLY explains WHY that combination produces it.
//   2. Past events (dasha-timeline): walk the Vimshottari Maha Dashas that have
//      already elapsed and, from each dasha lord's nature / dignity / house,
//      state the most likely life event with a probability %.
//
// Planet indices: 0=Sun 1=Moon 2=Mars 3=Mercury 4=Jupiter 5=Venus 6=Saturn 7=Rahu 8=Ketu
// Sign indices:   0=Aries .. 11=Pisces

import type { Bilingual } from "./constants";
import { GRAHAS, RASIS, RASI_LORDS } from "./constants";
import type { PlanetPosition } from "./engine";
import type { DashaTimeline } from "./dasha";
import type { GurujiAnalysis } from "./guruji-analysis";

export interface PersonaTrait {
  title: Bilingual;   // short trait name
  detail: Bilingual;  // the trait itself in plain language
  why: Bilingual;     // WHY this combination produces it
  source: Bilingual;  // the astrological driver (e.g. "Lagna: Mesha", "Exalted Sun")
}

export interface PastEvent {
  period: Bilingual;      // e.g. "Sun Maha Dasha (2001–2007)"
  ageRange: string;       // e.g. "age 7–13"
  prediction: Bilingual;  // what most likely happened
  why: Bilingual;         // the driver
  probability: number;    // 0..100
}

export interface PersonaAnalysis {
  summary: Bilingual;
  characterTraits: PersonaTrait[];
  pastEvents: PastEvent[];
}

// ---- reference tables ------------------------------------------------------

// Lagna (ascendant) sign → outward personality / temperament.
const LAGNA_NATURE: Bilingual[] = [
  { ta: "துணிவும் முன்முயற்சியும் — தலைமை எடுக்கும் இயல்பு, வேகமான செயல்பாடு.", en: "Bold and pioneering — a natural initiator who acts fast and leads from the front.", hi: "साहसी और अग्रणी — स्वाभाविक पहल करने वाला, तेज़ी से कार्य करने वाला नेता।" },
  { ta: "நிலையானதும் பொறுமையும் — நிதானமான, சுகம் விரும்பும், விடாமுயற்சியுள்ள இயல்பு.", en: "Steady and patient — grounded, comfort-loving and persistent once committed.", hi: "स्थिर और धैर्यवान — व्यवहारिक, सुख-प्रिय और दृढ़।" },
  { ta: "அறிவும் தொடர்பாடலும் — சுறுசுறுப்பான மனம், பலதுறை ஆர்வம், சொல்திறன்.", en: "Curious and communicative — a quick, versatile mind with strong verbal skill.", hi: "जिज्ञासु और संवादप्रिय — तीव्र, बहुमुखी बुद्धि और अच्छी वाक्पटुता।" },
  { ta: "உணர்வுபூர்வமும் பராமரிப்பும் — குடும்பம், பாதுகாப்பு, நினைவாற்றல் மிக்க இயல்பு.", en: "Emotional and nurturing — family-centred, protective and deeply retentive.", hi: "भावुक और पोषण करने वाला — परिवार-केंद्रित, रक्षात्मक और गहरी स्मृति वाला।" },
  { ta: "கம்பீரமும் தன்னம்பிக்கையும் — கண்ணியம், தலைமை, அங்கீகாரம் விரும்பும் இயல்பு.", en: "Regal and confident — dignified, leadership-oriented and craving recognition.", hi: "राजसी और आत्मविश्वासी — गरिमामय, नेतृत्व-प्रवण और मान्यता-प्रिय।" },
  { ta: "நுணுக்கமும் பகுப்பாய்வும் — ஒழுங்கு, சேவை, விமர்சன திறன் மிக்க இயல்பு.", en: "Analytical and precise — orderly, service-minded and sharply discerning.", hi: "विश्लेषणात्मक और सटीक — व्यवस्थित, सेवा-भावी और तीक्ष्ण विवेक वाला।" },
  { ta: "சமநிலையும் இணக்கமும் — நீதி, உறவு, அழகுணர்ச்சி விரும்பும் இயல்பு.", en: "Balanced and diplomatic — fair, relationship-oriented and aesthetically inclined.", hi: "संतुलित और कूटनीतिक — न्यायप्रिय, संबंध-केंद्रित और सौंदर्य-प्रेमी।" },
  { ta: "தீவிரமும் ஆழமும் — உறுதி, ரகசியம், மாற்றத்தை ஏற்படுத்தும் இயல்பு.", en: "Intense and deep — determined, private and transformative in nature.", hi: "गहन और तीव्र — दृढ़, गोपनीय और परिवर्तनकारी स्वभाव।" },
  { ta: "நேர்மையும் விரிவும் — தத்துவம், சுதந்திரம், நம்பிக்கை மிக்க இயல்பு.", en: "Honest and expansive — philosophical, freedom-loving and optimistic.", hi: "ईमानदार और विस्तृत — दार्शनिक, स्वतंत्रता-प्रेमी और आशावादी।" },
  { ta: "கட்டுப்பாடும் லட்சியமும் — ஒழுக்கம், பொறுப்பு, நிலைத்த முயற்சி மிக்க இயல்பு.", en: "Disciplined and ambitious — responsible, hard-working and career-focused.", hi: "अनुशासित और महत्वाकांक्षी — जिम्मेदार, परिश्रमी और करियर-केंद्रित।" },
  { ta: "தனித்துவமும் மனிதநேயமும் — சிந்தனையாளர், சமூக அக்கறை, புதுமை விரும்பும் இயல்பு.", en: "Original and humane — an independent thinker, socially aware and innovative.", hi: "मौलिक और मानवीय — स्वतंत्र विचारक, सामाजिक रूप से जागरूक और नवोन्मेषी।" },
  { ta: "கருணையும் கற்பனையும் — உணர்திறன், ஆன்மீகம், படைப்பாற்றல் மிக்க இயல்பு.", en: "Compassionate and imaginative — sensitive, spiritual and creatively gifted.", hi: "करुणामय और कल्पनाशील — संवेदनशील, आध्यात्मिक और रचनात्मक।" },
];

// Moon sign → emotional / inner character.
const MOON_NATURE: Bilingual[] = [
  { ta: "உணர்வுகள் வேகமானவை — உடனடி எதிர்வினை, ஆர்வம், சில நேரம் அவசரம்.", en: "Emotions run fast — reactive, enthusiastic, sometimes impatient inside.", hi: "भावनाएँ तेज़ — प्रतिक्रियाशील, उत्साही, कभी-कभी अधीर।" },
  { ta: "மனம் அமைதி விரும்பும் — நிலைத்த உணர்வுகள், சுகம், விசுவாசம்.", en: "A calm, comfort-seeking heart — stable feelings and strong loyalty.", hi: "शांत, सुख-प्रिय मन — स्थिर भावनाएँ और गहरी निष्ठा।" },
  { ta: "மனம் சுறுசுறுப்பு — யோசனைகள் நிறைந்த, பேசவும் அறியவும் விரும்பும்.", en: "A restless, thinking mind — full of ideas, loves talk and learning.", hi: "चंचल, विचारशील मन — विचारों से भरा, बातचीत और सीखने का शौकीन।" },
  { ta: "ஆழ்ந்த உணர்வுகள் — பாசம், பாதுகாப்பு தேவை, நினைவுகளில் வாழும்.", en: "Deeply feeling — affectionate, needing security, living in memories.", hi: "गहरी भावनाएँ — स्नेही, सुरक्षा-चाहने वाला, यादों में जीने वाला।" },
  { ta: "பெருமையும் அன்பும் — வெப்பமான இதயம், அங்கீகாரம் விரும்பும்.", en: "Proud yet warm — a generous heart that wants to be appreciated.", hi: "गर्वित पर स्नेही — उदार हृदय जो सराहना चाहता है।" },
  { ta: "நுணுக்கமான மனம் — கவலை, ஒழுங்கு, விமர்சன சிந்தனை.", en: "A meticulous mind — prone to worry, orderly and self-critical.", hi: "सूक्ष्म मन — चिंता-प्रवण, व्यवस्थित और आत्म-आलोचक।" },
  { ta: "சமநிலை விரும்பும் மனம் — உறவுகளில் அமைதி, நியாயம் தேடும்.", en: "A harmony-seeking heart — craves peace in relationships and fairness.", hi: "सामंजस्य-प्रिय मन — संबंधों में शांति और न्याय की चाह।" },
  { ta: "தீவிர உணர்வுகள் — ஆழம், ரகசியம், வலிமையான உள்ளுணர்வு.", en: "Intense emotions — deep, secretive, with powerful instincts.", hi: "तीव्र भावनाएँ — गहरी, गोपनीय, प्रबल अंतर्ज्ञान वाली।" },
  { ta: "நம்பிக்கை நிறைந்த மனம் — சுதந்திரம், அறம், விரிந்த பார்வை.", en: "An optimistic mind — freedom-loving, ethical and broad-visioned.", hi: "आशावादी मन — स्वतंत्रता-प्रेमी, नैतिक और व्यापक दृष्टि वाला।" },
  { ta: "கட்டுப்பாட்டு மனம் — பொறுப்பு, தனிமை, நிதானமான உணர்வுகள்.", en: "A disciplined mind — responsible, sometimes solitary, emotionally reserved.", hi: "अनुशासित मन — जिम्मेदार, कभी एकाकी, भावनात्मक रूप से संयमित।" },
  { ta: "வித்தியாசமான மனம் — சுயசிந்தனை, சமூக அக்கறை, எதிர்பாராதவை.", en: "An unconventional mind — independent, socially concerned, unpredictable.", hi: "अपरंपरागत मन — स्वतंत्र, सामाजिक रूप से चिंतित, अप्रत्याशित।" },
  { ta: "கனவு நிறைந்த மனம் — கருணை, கற்பனை, ஆன்மீக ஈர்ப்பு.", en: "A dreamy mind — compassionate, imaginative, spiritually drawn.", hi: "स्वप्निल मन — करुणामय, कल्पनाशील, आध्यात्मिक झुकाव वाला।" },
];

// Planet → life domain it most colours (used for strongest/weakest trait + dasha events).
const PLANET_DOMAIN: Record<number, Bilingual> = {
  0: { ta: "தன்னம்பிக்கை, தந்தை, அதிகாரம், ஆரோக்கியம்", en: "confidence, father, authority and vitality", hi: "आत्मविश्वास, पिता, अधिकार और जीवनशक्ति" },
  1: { ta: "மனம், தாய், உணர்வுகள், மக்கள் தொடர்பு", en: "the mind, mother, emotions and public rapport", hi: "मन, माता, भावनाएँ और जनसंपर्क" },
  2: { ta: "தைரியம், ஆற்றல், சொத்து, சகோதரர்", en: "courage, drive, property and siblings", hi: "साहस, ऊर्जा, संपत्ति और भाई-बहन" },
  3: { ta: "அறிவு, தொடர்பாடல், வியாபாரம், கல்வி", en: "intellect, communication, business and study", hi: "बुद्धि, संवाद, व्यापार और शिक्षा" },
  4: { ta: "ஞானம், செல்வம், குரு, குழந்தைகள், அதிர்ஷ்டம்", en: "wisdom, wealth, mentors, children and fortune", hi: "ज्ञान, धन, गुरु, संतान और भाग्य" },
  5: { ta: "காதல், துணை, கலை, சுகம், ஆடம்பரம்", en: "love, partnership, art, comfort and luxury", hi: "प्रेम, साथी, कला, सुख और विलासिता" },
  6: { ta: "கடின உழைப்பு, ஒழுக்கம், தாமதம், நீண்டகால பலன்", en: "hard work, discipline, delay and long-term reward", hi: "कठिन परिश्रम, अनुशासन, विलंब और दीर्घकालीन फल" },
  7: { ta: "ஆசை, திடீர் மாற்றம், வெளிநாடு, தொழில்நுட்பம்", en: "ambition, sudden change, foreign matters and technology", hi: "महत्वाकांक्षा, अचानक परिवर्तन, विदेश और तकनीक" },
  8: { ta: "விடுதலை, ஆன்மீகம், துறவு, மறைவான விஷயம்", en: "detachment, spirituality, letting go and hidden matters", hi: "वैराग्य, आध्यात्म, त्याग और गुप्त विषय" },
};

// House number → life area (for dasha-event context, w.r.t. Lagna).
const HOUSE_AREA: Record<number, Bilingual> = {
  1: { ta: "சுயம், ஆரோக்கியம்", en: "self and health", hi: "स्वयं और स्वास्थ्य" },
  2: { ta: "பணம், குடும்பம், பேச்சு", en: "money, family and speech", hi: "धन, परिवार और वाणी" },
  3: { ta: "தைரியம், சகோதரர், முயற்சி", en: "courage, siblings and effort", hi: "साहस, भाई-बहन और प्रयास" },
  4: { ta: "வீடு, தாய், வாகனம், மனநிறைவு", en: "home, mother, vehicles and inner peace", hi: "घर, माता, वाहन और मानसिक शांति" },
  5: { ta: "கல்வி, குழந்தைகள், படைப்பாற்றல்", en: "education, children and creativity", hi: "शिक्षा, संतान और रचनात्मकता" },
  6: { ta: "போட்டி, கடன், உடல்நலம், எதிரிகள்", en: "competition, debt, health and rivals", hi: "प्रतिस्पर्धा, ऋण, स्वास्थ्य और शत्रु" },
  7: { ta: "திருமணம், துணை, கூட்டாண்மை", en: "marriage, partner and partnerships", hi: "विवाह, साथी और साझेदारी" },
  8: { ta: "திடீர் மாற்றம், ஆயுள், மறைவான விஷயம்", en: "sudden change, longevity and hidden matters", hi: "अचानक परिवर्तन, आयु और गुप्त विषय" },
  9: { ta: "அதிர்ஷ்டம், தந்தை, தர்மம், நீண்ட பயணம்", en: "fortune, father, dharma and long journeys", hi: "भाग्य, पिता, धर्म और लंबी यात्रा" },
  10: { ta: "தொழில், அந்தஸ்து, பொறுப்பு", en: "career, status and responsibility", hi: "करियर, प्रतिष्ठा और जिम्मेदारी" },
  11: { ta: "வருமானம், லாபம், விருப்பங்கள்", en: "income, gains and fulfilled wishes", hi: "आय, लाभ और इच्छापूर्ति" },
  12: { ta: "செலவு, வெளிநாடு, விடுதலை, ஆன்மீகம்", en: "expenses, foreign lands, loss and spirituality", hi: "व्यय, विदेश, हानि और आध्यात्म" },
};

// ---- helpers ---------------------------------------------------------------

function nm(idx: number): Bilingual { return GRAHAS[idx]; }
function houseOf(sign: number, lagna: number): number { return ((sign - lagna + 12) % 12) + 1; }
const DUSTHANA = new Set([6, 8, 12]);
const NATURAL_BENEFIC = new Set([1, 3, 4, 5]); // Moon, Mercury, Jupiter, Venus (functional-ish)
const NATURAL_MALEFIC = new Set([0, 2, 6, 7, 8]); // Sun, Mars, Saturn, Rahu, Ketu

function ordEn(n: number): string {
  const s = ["th", "st", "nd", "rd"]; const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// Combine two Bilingual strings with " " join per language.
function joinB(a: Bilingual, b: Bilingual): Bilingual {
  return { ta: `${a.ta} ${b.ta}`, en: `${a.en} ${b.en}`, hi: `${(a.hi ?? a.en)} ${(b.hi ?? b.en)}` };
}

// ---- main ------------------------------------------------------------------

export function analyzePersona(
  planets: PlanetPosition[],
  lagnaSign: number,
  moonSign: number,
  dasha: DashaTimeline,
  guruji: GurujiAnalysis,
  birthDate: Date,
  now: Date = new Date(),
): PersonaAnalysis {
  const traits: PersonaTrait[] = [];

  // ---- 1. Lagna nature ----------------------------------------------------
  traits.push({
    title: { ta: "வெளிப்படையான குணம் (லக்னம்)", en: "Outward Character (Lagna)", hi: "बाहरी स्वभाव (लग्न)" },
    detail: LAGNA_NATURE[lagnaSign],
    why: {
      ta: `உதயத்தில் ${RASIS[lagnaSign].ta} உயர்ந்ததால், அதன் அதிபதி ${nm(RASI_LORDS[lagnaSign]).ta} உங்கள் தோற்றத்தையும் அணுகுமுறையையும் வடிவமைக்கிறது.`,
      en: `Because ${RASIS[lagnaSign].en} was rising at birth, its lord ${nm(RASI_LORDS[lagnaSign]).en} shapes how you present yourself and approach life.`,
      hi: `जन्म के समय ${RASIS[lagnaSign].hi ?? RASIS[lagnaSign].en} उदय होने से, इसका स्वामी ${nm(RASI_LORDS[lagnaSign]).hi ?? nm(RASI_LORDS[lagnaSign]).en} आपके व्यक्तित्व और जीवन-दृष्टिकोण को आकार देता है।`,
    },
    source: { ta: `லக்னம்: ${RASIS[lagnaSign].ta}`, en: `Lagna: ${RASIS[lagnaSign].en}`, hi: `लग्न: ${RASIS[lagnaSign].hi ?? RASIS[lagnaSign].en}` },
  });

  // ---- 2. Moon (mind) nature ---------------------------------------------
  traits.push({
    title: { ta: "உள் மனம் (சந்திரன்)", en: "Inner Mind (Moon)", hi: "आंतरिक मन (चंद्र)" },
    detail: MOON_NATURE[moonSign],
    why: {
      ta: `சந்திரன் ${RASIS[moonSign].ta} இல் இருப்பதால், அது உங்கள் உணர்வுகளையும் உள்ளார்ந்த மனநிலையையும் ஆளுகிறது (ஜென்ம ராசி).`,
      en: `With the Moon in ${RASIS[moonSign].en}, it governs your emotional make-up and instinctive mind (your birth Rasi).`,
      hi: `चंद्र ${RASIS[moonSign].hi ?? RASIS[moonSign].en} में होने से यह आपकी भावनाओं और सहज मन को नियंत्रित करता है (जन्म राशि)।`,
    },
    source: { ta: `சந்திரன்: ${RASIS[moonSign].ta}`, en: `Moon: ${RASIS[moonSign].en}`, hi: `चंद्र: ${RASIS[moonSign].hi ?? RASIS[moonSign].en}` },
  });

  // ---- 3. Strongest planet ------------------------------------------------
  const ranked = [...guruji.planets].sort((a, b) => b.net - a.net);
  const strongest = ranked[0];
  if (strongest) {
    const sIdx = strongest.index;
    const sHouse = houseOf(planets.find((p) => p.index === sIdx)!.rasiIndex, lagnaSign);
    traits.push({
      title: { ta: "பலமான கிரகம்", en: "Your Strongest Planet", hi: "आपका सबसे बलवान ग्रह" },
      detail: {
        ta: `${nm(sIdx).ta} உங்கள் ஜாதகத்தில் மிகவும் பலமானது — ${PLANET_DOMAIN[sIdx].ta} தொடர்பான விஷயங்களில் உங்களுக்கு இயற்கையான வலிமை உள்ளது.`,
        en: `${nm(sIdx).en} is the strongest graha in your chart — you carry a natural strength in matters of ${PLANET_DOMAIN[sIdx].en}.`,
        hi: `${nm(sIdx).hi ?? nm(sIdx).en} आपकी कुंडली का सबसे बलवान ग्रह है — ${PLANET_DOMAIN[sIdx].hi ?? PLANET_DOMAIN[sIdx].en} के मामलों में आपमें स्वाभाविक शक्ति है।`,
      },
      why: {
        ta: `இதன் நிகர சூட்சும வலு +${strongest.net} (சுபத்துவம் ${strongest.subathuvam}), ${ordEn(sHouse)} பாவத்தில் — எனவே இந்த குணம் வாழ்வில் தெளிவாக வெளிப்படும்.`,
        en: `Its net Sootchuma Valu is +${strongest.net} (subathuvam ${strongest.subathuvam}), placed in the ${ordEn(sHouse)} house — so this quality shows clearly in life.`,
        hi: `इसका शुद्ध सूक्ष्म बल +${strongest.net} है (सुभत्वम ${strongest.subathuvam}), ${sHouse}वें भाव में — इसलिए यह गुण जीवन में स्पष्ट दिखता है।`,
      },
      source: { ta: `${nm(sIdx).ta} (நிகர +${strongest.net})`, en: `${nm(sIdx).en} (net +${strongest.net})`, hi: `${nm(sIdx).hi ?? nm(sIdx).en} (शुद्ध +${strongest.net})` },
    });
  }

  // ---- 4. Most-afflicted planet -------------------------------------------
  const weakest = ranked[ranked.length - 1];
  if (weakest && weakest.index !== strongest?.index) {
    const wIdx = weakest.index;
    const wHouse = houseOf(planets.find((p) => p.index === wIdx)!.rasiIndex, lagnaSign);
    traits.push({
      title: { ta: "சவால் தரும் கிரகம்", en: "Your Growth Area", hi: "आपका चुनौती-क्षेत्र" },
      detail: {
        ta: `${nm(wIdx).ta} அழுத்தத்தில் உள்ளது — ${PLANET_DOMAIN[wIdx].ta} தொடர்பான பகுதிகளில் அதிக முயற்சியும் பொறுமையும் தேவைப்படும்; இதுவே உங்கள் வளர்ச்சிப் பாதை.`,
        en: `${nm(wIdx).en} is under pressure — areas of ${PLANET_DOMAIN[wIdx].en} demand extra effort and patience; this is your path of growth.`,
        hi: `${nm(wIdx).hi ?? nm(wIdx).en} दबाव में है — ${PLANET_DOMAIN[wIdx].hi ?? PLANET_DOMAIN[wIdx].en} के क्षेत्रों में अधिक प्रयास और धैर्य चाहिए; यही आपकी विकास-राह है।`,
      },
      why: {
        ta: `இதன் நிகர சூட்சும வலு ${weakest.net} (பாபத்துவம் ${weakest.papathuvam}), ${ordEn(wHouse)} பாவத்தில் — ஆனால் விழிப்புடன் இதை பலமாக்க முடியும்.`,
        en: `Its net Sootchuma Valu is ${weakest.net} (papathuvam ${weakest.papathuvam}), placed in the ${ordEn(wHouse)} house — but with awareness this can be strengthened.`,
        hi: `इसका शुद्ध सूक्ष्म बल ${weakest.net} है (पापत्वम ${weakest.papathuvam}), ${wHouse}वें भाव में — पर जागरूकता से इसे मज़बूत किया जा सकता है।`,
      },
      source: { ta: `${nm(wIdx).ta} (நிகர ${weakest.net})`, en: `${nm(wIdx).en} (net ${weakest.net})`, hi: `${nm(wIdx).hi ?? nm(wIdx).en} (शुद्ध ${weakest.net})` },
    });
  }

  // ---- 5+. Key yogas from Guruji findings --------------------------------
  // Turn the auspicious/notable findings into character traits with a WHY.
  const yogaFindings = guruji.findings.filter((f) =>
    /Yoga|Dikbala|Adhi|Amavasya/i.test(f.title.en) && f.tone !== "info",
  );
  for (const f of yogaFindings.slice(0, 3)) {
    traits.push({
      title: joinB({ ta: "யோகம் —", en: "Yoga —", hi: "योग —" }, f.title),
      detail: f.verdict,
      why: f.reasons[0] ?? { ta: "இந்த யோக அமைப்பு உங்கள் குணத்தை வடிவமைக்கிறது.", en: "This yoga formation shapes your character.", hi: "यह योग आपके स्वभाव को आकार देता है।" },
      source: f.title,
    });
  }

  // Ensure at least 5 traits (fallback: add a 3rd/most-benefic planet trait).
  if (traits.length < 5) {
    const second = ranked[1];
    if (second) {
      const idx = second.index;
      const h = houseOf(planets.find((p) => p.index === idx)!.rasiIndex, lagnaSign);
      traits.push({
        title: { ta: "மற்றொரு பலம்", en: "A Supporting Strength", hi: "एक सहायक शक्ति" },
        detail: {
          ta: `${nm(idx).ta} உங்களுக்கு துணை வலிமை தருகிறது — ${PLANET_DOMAIN[idx].ta} துறையில் ஆதரவு.`,
          en: `${nm(idx).en} lends supporting strength — help in matters of ${PLANET_DOMAIN[idx].en}.`,
          hi: `${nm(idx).hi ?? nm(idx).en} सहायक शक्ति देता है — ${PLANET_DOMAIN[idx].hi ?? PLANET_DOMAIN[idx].en} में सहायता।`,
        },
        why: {
          ta: `நிகர வலு +${second.net}, ${ordEn(h)} பாவத்தில்.`,
          en: `Net strength +${second.net}, in the ${ordEn(h)} house.`,
          hi: `शुद्ध बल +${second.net}, ${h}वें भाव में।`,
        },
        source: { ta: `${nm(idx).ta} (நிகர +${second.net})`, en: `${nm(idx).en} (net +${second.net})`, hi: `${nm(idx).hi ?? nm(idx).en} (शुद्ध +${second.net})` },
      });
    }
  }

  // ---- Past events (dasha-timeline) --------------------------------------
  const pastEvents = buildPastEvents(planets, lagnaSign, guruji, dasha, birthDate, now);

  // ---- summary ------------------------------------------------------------
  const summary: Bilingual = {
    ta: `${RASIS[lagnaSign].ta} லக்னம், ${RASIS[moonSign].ta} ராசி — ${nm(strongest?.index ?? 0).ta} உங்கள் பலம், ${nm(weakest?.index ?? 6).ta} உங்கள் வளர்ச்சிப் பகுதி. கீழே உங்கள் குணம் மற்றும் கடந்த தசைகளின் நிகழ்வுகள்.`,
    en: `${RASIS[lagnaSign].en} rising, Moon in ${RASIS[moonSign].en} — ${nm(strongest?.index ?? 0).en} is your strength and ${nm(weakest?.index ?? 6).en} your growth area. Below are your character and likely past-dasha events.`,
    hi: `${RASIS[lagnaSign].hi ?? RASIS[lagnaSign].en} लग्न, चंद्र ${RASIS[moonSign].hi ?? RASIS[moonSign].en} में — ${nm(strongest?.index ?? 0).hi ?? nm(strongest?.index ?? 0).en} आपकी शक्ति और ${nm(weakest?.index ?? 6).hi ?? nm(weakest?.index ?? 6).en} आपका विकास-क्षेत्र है। नीचे आपका स्वभाव और संभावित अतीत-दशा घटनाएँ हैं।`,
  };

  return { summary, characterTraits: traits, pastEvents };
}

// Build up to 5 past-event predictions from elapsed Maha Dashas.
function buildPastEvents(
  planets: PlanetPosition[],
  lagnaSign: number,
  guruji: GurujiAnalysis,
  dasha: DashaTimeline,
  birthDate: Date,
  now: Date,
): PastEvent[] {
  const events: PastEvent[] = [];
  // Maha dashas whose start is before "now" (already begun / elapsed).
  const past = dasha.periods.filter((p) => p.start.getTime() <= now.getTime());
  for (const md of past) {
    const lord = md.lordIndex;
    const pos = planets.find((p) => p.index === lord);
    if (!pos) continue;
    const house = houseOf(pos.rasiIndex, lagnaSign);
    const score = guruji.planets.find((s) => s.index === lord);
    const net = score?.net ?? 0;
    const benefic = NATURAL_BENEFIC.has(lord) && net >= 0;
    const malefic = NATURAL_MALEFIC.has(lord) || net < 0;
    const inDusthana = DUSTHANA.has(house);

    // Probability: stronger/clearer signals → higher confidence.
    // Base 55; +net influence; +clarity if benefic-in-good-house or malefic-in-dusthana.
    let prob = 55 + Math.round(Math.max(-25, Math.min(25, net / 4)));
    if (benefic && !inDusthana) prob += 12;
    if (malefic && inDusthana) prob += 12;
    if (inDusthana) prob += 4;
    prob = Math.max(35, Math.min(92, prob));

    const domain = PLANET_DOMAIN[lord];
    const area = HOUSE_AREA[house];
    // Effective verdict used by BOTH the prediction and the WHY, so they agree.
    const verdict = net >= 20 && !inDusthana ? 1 : net <= -20 || (malefic && inDusthana) ? -1 : 0;
    const toneWord: Bilingual =
      verdict === 1
        ? { ta: "சாதக", en: "favourable", hi: "शुभ" }
        : verdict === -1
          ? { ta: "சவாலான", en: "challenging", hi: "चुनौतीपूर्ण" }
          : { ta: "கலவையான", en: "mixed", hi: "मिश्रित" };
    // Prediction tone from net strength + house.
    let prediction: Bilingual;
    if (net >= 20 && !inDusthana) {
      prediction = {
        ta: `${nm(lord).ta} தசையில் ${area.ta} தொடர்பாக நல்ல முன்னேற்றம் — ${domain.ta} சார்ந்த ஆதாயங்கள் நேர்ந்திருக்கக்கூடும்.`,
        en: `During ${nm(lord).en}'s period, good progress in ${area.en} — likely gains linked to ${domain.en}.`,
        hi: `${nm(lord).hi ?? nm(lord).en} की दशा में ${area.hi ?? area.en} में अच्छी प्रगति — ${domain.hi ?? domain.en} से जुड़े लाभ संभव।`,
      };
    } else if (net <= -20 || (malefic && inDusthana)) {
      prediction = {
        ta: `${nm(lord).ta} தசையில் ${area.ta} தொடர்பாக சவால்கள் / தடைகள் — ${domain.ta} சார்ந்த சிக்கல்கள் ஏற்பட்டிருக்கக்கூடும்.`,
        en: `During ${nm(lord).en}'s period, challenges or obstruction in ${area.en} — likely struggles tied to ${domain.en}.`,
        hi: `${nm(lord).hi ?? nm(lord).en} की दशा में ${area.hi ?? area.en} में चुनौतियाँ / रुकावटें — ${domain.hi ?? domain.en} से जुड़ी कठिनाइयाँ संभव।`,
      };
    } else {
      prediction = {
        ta: `${nm(lord).ta} தசையில் ${area.ta} தொடர்பாக கலவையான அனுபவங்கள் — ${domain.ta} சார்ந்த மாற்றங்கள் நேர்ந்திருக்கக்கூடும்.`,
        en: `During ${nm(lord).en}'s period, mixed experiences in ${area.en} — shifts connected to ${domain.en}.`,
        hi: `${nm(lord).hi ?? nm(lord).en} की दशा में ${area.hi ?? area.en} में मिश्रित अनुभव — ${domain.hi ?? domain.en} से जुड़े बदलाव संभव।`,
      };
    }

    const startY = md.start.getFullYear();
    const endY = md.end.getFullYear();
    const rawStart = Math.floor((md.start.getTime() - birthDate.getTime()) / (365.25 * 864e5));
    const ageStart = Math.max(0, rawStart);
    const ageEnd = Math.max(0, Math.round((md.end.getTime() - birthDate.getTime()) / (365.25 * 864e5)));
    // The birth-balance dasha begins before birth; label it from birth.
    const ageLabel = rawStart <= 0 ? `birth–age ${ageEnd}` : `age ${ageStart}–${ageEnd}`;

    events.push({
      period: {
        ta: `${nm(lord).ta} மகா தசை (${startY}–${endY})`,
        en: `${nm(lord).en} Maha Dasha (${startY}–${endY})`,
        hi: `${nm(lord).hi ?? nm(lord).en} महादशा (${startY}–${endY})`,
      },
      ageRange: ageLabel,
      prediction,
      why: {
        ta: `${nm(lord).ta} ${ordEn(house)}-ஆம் பாவத்தில் (${area.ta}), நிகர வலு ${net >= 0 ? "+" : ""}${net} — ${toneWord.ta} தாக்கம்.`,
        en: `${nm(lord).en} sits in the ${ordEn(house)} house (${area.en}) with net strength ${net >= 0 ? "+" : ""}${net} — a ${toneWord.en} influence.`,
        hi: `${nm(lord).hi ?? nm(lord).en} ${house}वें भाव में (${area.hi ?? area.en}), शुद्ध बल ${net >= 0 ? "+" : ""}${net} — ${toneWord.hi} प्रभाव।`,
      },
      probability: prob,
    });
  }

  // Order by the maha-dasha start year (most recent first) and cap at 5.
  const recentEvents = events
    .sort((a, b) => {
      const ya = parseInt(a.period.en.match(/\((\d{4})/)?.[1] ?? "0", 10);
      const yb = parseInt(b.period.en.match(/\((\d{4})/)?.[1] ?? "0", 10);
      return yb - ya;
    })
    .slice(0, 5);

  return recentEvents;
}
