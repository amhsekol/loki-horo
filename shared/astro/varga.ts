// Divisional (varga) chart sign computations, used for Saptavargaja Bala.
// Each function maps a sidereal longitude (0..360) to a sign index (0..11)
// in the respective divisional chart. Classical Parashari rules.
//
// The seven vargas used in Saptavargaja Bala (Shadbala positional strength):
//   D-1  Rasi        (whole sign)
//   D-2  Hora        (wealth)
//   D-3  Drekkana    (siblings)
//   D-7  Saptamsa    (children)
//   D-9  Navamsa     (spouse / dharma)
//   D-12 Dwadasamsa  (parents)
//   D-30 Trimsamsa   (misfortunes)

function signOf(sid: number): number {
  return Math.floor(((sid % 360) + 360) % 360 / 30);
}
function degInSign(sid: number): number {
  return (((sid % 360) + 360) % 360) % 30;
}
const ODD = (sign: number) => sign % 2 === 0; // 0-based even index = odd sign (Aries,Gemini...)

// D-1 Rasi
export function rasiSign(sid: number): number {
  return signOf(sid);
}

// D-2 Hora. First 15° -> Sun's hora (Leo=4), second 15° -> Moon's hora (Cancer=3),
// for odd signs; reversed for even signs.
export function horaSign(sid: number): number {
  const sign = signOf(sid);
  const deg = degInSign(sid);
  const firstHalf = deg < 15;
  const odd = ODD(sign);
  // odd sign: 1st half Sun(Leo=4), 2nd half Moon(Cancer=3)
  // even sign: 1st half Moon(Cancer=3), 2nd half Sun(Leo=4)
  if (odd) return firstHalf ? 4 : 3;
  return firstHalf ? 3 : 4;
}

// D-3 Drekkana. Each 10°: 1st -> same sign, 2nd -> 5th from it, 3rd -> 9th from it.
export function drekkanaSign(sid: number): number {
  const sign = signOf(sid);
  const part = Math.floor(degInSign(sid) / 10); // 0,1,2
  return (sign + part * 4) % 12; // +0, +4 (5th), +8 (9th)
}

// D-7 Saptamsa. 7 parts of ~4.2857°. Odd signs start counting from the same sign;
// even signs start from the 7th sign.
export function saptamsaSign(sid: number): number {
  const sign = signOf(sid);
  const part = Math.floor(degInSign(sid) / (30 / 7)); // 0..6
  const start = ODD(sign) ? sign : (sign + 6) % 12;
  return (start + part) % 12;
}

// D-9 Navamsa. 9 parts of 3°20'. Start sign depends on element (movable/fixed/dual).
export function navamsaSignVarga(sid: number): number {
  const sign = signOf(sid);
  const part = Math.floor(degInSign(sid) / (30 / 9)); // 0..8
  // starting sign: fire signs (Aries0,Leo4,Sag8) start at Aries;
  // earth (Tau1,Vir5,Cap9) start at Capricorn(9); air (Gem2,Lib6,Aqu10) start at Libra(6);
  // water (Can3,Sco7,Pis11) start at Cancer(3).
  const mod = sign % 3; // 0 movable,1 fixed,2 dual — but element grouping is sign%4-ish.
  void mod;
  const startByElement = [0, 9, 6, 3]; // fire, earth, air, water
  const element = sign % 4; // 0 fire,1 earth,2 air,3 water (Aries=fire, Taurus=earth...)
  const start = startByElement[element];
  return (start + part) % 12;
}

// D-12 Dwadasamsa. 12 parts of 2.5°, counted from the sign itself.
export function dwadasamsaSign(sid: number): number {
  const sign = signOf(sid);
  const part = Math.floor(degInSign(sid) / 2.5); // 0..11
  return (sign + part) % 12;
}

// D-30 Trimsamsa. Unequal 5-part scheme ruled by Mars/Saturn/Jupiter/Mercury/Venus.
// Odd signs: 0-5 Mars(Aries0), 5-10 Saturn(Aquarius10), 10-18 Jupiter(Sag8),
//            18-25 Mercury(Gemini2), 25-30 Venus(Libra6).
// Even signs: mirrored — 0-5 Venus(Taurus1), 5-12 Mercury(Virgo5), 12-20 Jupiter(Pisces11),
//            20-25 Saturn(Capricorn9), 25-30 Mars(Scorpio7).
export function trimsamsaSign(sid: number): number {
  const sign = signOf(sid);
  const deg = degInSign(sid);
  if (ODD(sign)) {
    if (deg < 5) return 0;     // Mars -> Aries
    if (deg < 10) return 10;   // Saturn -> Aquarius
    if (deg < 18) return 8;    // Jupiter -> Sagittarius
    if (deg < 25) return 2;    // Mercury -> Gemini
    return 6;                  // Venus -> Libra
  } else {
    if (deg < 5) return 1;     // Venus -> Taurus
    if (deg < 12) return 5;    // Mercury -> Virgo
    if (deg < 20) return 11;   // Jupiter -> Pisces
    if (deg < 25) return 9;    // Saturn -> Capricorn
    return 7;                  // Mars -> Scorpio
  }
}

// The 7 vargas for Saptavargaja, in order, each returning a sign index for a longitude.
export const SAPTAVARGA: ((sid: number) => number)[] = [
  rasiSign,
  horaSign,
  drekkanaSign,
  saptamsaSign,
  navamsaSignVarga,
  dwadasamsaSign,
  trimsamsaSign,
];
