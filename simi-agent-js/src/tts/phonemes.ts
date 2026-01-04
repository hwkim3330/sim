/**
 * Phoneme Database for Klatt Synthesis
 *
 * Each phoneme maps to formant frequencies (F1-F6) and bandwidths
 * Based on standard American English formant values
 */

export interface PhonemeData {
  /** Formant frequencies [F1, F2, F3, F4, F5, F6] in Hz */
  freq: number[];
  /** Formant bandwidths [B1, B2, B3, B4, B5, B6] in Hz */
  bw: number[];
  /** Duration in seconds */
  duration: number;
  /** Whether voiced */
  voiced: boolean;
  /** Formant amplitudes in dB (for parallel branch) */
  amp?: number[];
}

// Vowels - based on Peterson & Barney (1952) and Hillenbrand et al. (1995)
export const VOWELS: Record<string, PhonemeData> = {
  // Front vowels
  IY: { freq: [270, 2290, 3010, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // beat
  IH: { freq: [390, 1990, 2550, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.10, voiced: true },  // bit
  EH: { freq: [530, 1840, 2480, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.10, voiced: true },  // bet
  EY: { freq: [440, 2100, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.14, voiced: true },  // bait
  AE: { freq: [660, 1720, 2410, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // bat

  // Back vowels
  AA: { freq: [730, 1090, 2440, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // father
  AO: { freq: [570, 840, 2410, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },   // bought
  OW: { freq: [490, 1350, 2400, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.14, voiced: true },  // boat
  UH: { freq: [440, 1020, 2240, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.10, voiced: true },  // book
  UW: { freq: [300, 870, 2240, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },   // boot

  // Central vowels
  AH: { freq: [640, 1190, 2390, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.10, voiced: true },  // but
  AX: { freq: [500, 1500, 2500, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.06, voiced: true },  // schwa
  ER: { freq: [490, 1350, 1690, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // bird

  // Diphthongs
  AY: { freq: [730, 1090, 2440, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.18, voiced: true },  // bite
  AW: { freq: [730, 1090, 2440, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.18, voiced: true },  // bout
  OY: { freq: [570, 840, 2410, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.18, voiced: true },   // boy
};

// Consonants
export const CONSONANTS: Record<string, PhonemeData> = {
  // Stops - voiced
  B: { freq: [200, 1100, 2150, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.06, voiced: true },
  D: { freq: [200, 1600, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.06, voiced: true },
  G: { freq: [200, 1990, 2850, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.06, voiced: true },

  // Stops - unvoiced
  P: { freq: [200, 1100, 2150, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.08, voiced: false },
  T: { freq: [200, 1600, 2600, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.08, voiced: false },
  K: { freq: [200, 1990, 2850, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.08, voiced: false },

  // Fricatives - voiced
  V: { freq: [220, 1100, 2080, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },
  DH: { freq: [200, 1600, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.06, voiced: true },
  Z: { freq: [200, 1600, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },
  ZH: { freq: [200, 1900, 2500, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },

  // Fricatives - unvoiced
  F: { freq: [220, 1100, 2080, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.10, voiced: false },
  TH: { freq: [200, 1600, 2600, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.08, voiced: false },
  S: { freq: [200, 1600, 2600, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.10, voiced: false },
  SH: { freq: [200, 1900, 2500, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.10, voiced: false },
  HH: { freq: [500, 1500, 2500, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.06, voiced: false },

  // Affricates
  CH: { freq: [200, 1900, 2500, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.12, voiced: false },
  JH: { freq: [200, 1900, 2500, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.10, voiced: true },

  // Nasals
  M: { freq: [270, 1000, 2200, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },
  N: { freq: [270, 1600, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },
  NG: { freq: [270, 1990, 2850, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },

  // Liquids
  L: { freq: [310, 1050, 2880, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },
  R: { freq: [310, 1060, 1380, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },

  // Glides
  W: { freq: [290, 610, 2150, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.06, voiced: true },
  Y: { freq: [260, 2070, 3020, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.06, voiced: true },
};

// Silence and pauses
export const SILENCE: Record<string, PhonemeData> = {
  SIL: { freq: [0, 0, 0, 0, 0, 0], bw: [200, 200, 200, 200, 250, 300], duration: 0.05, voiced: false },
  PAU: { freq: [0, 0, 0, 0, 0, 0], bw: [200, 200, 200, 200, 250, 300], duration: 0.15, voiced: false },
};

// Combined phoneme database
export const PHONEMES: Record<string, PhonemeData> = {
  ...VOWELS,
  ...CONSONANTS,
  ...SILENCE,
};

// Korean phonemes (한글)
export const KOREAN_VOWELS: Record<string, PhonemeData> = {
  KA:   { freq: [800, 1200, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // ㅏ
  KEO:  { freq: [600, 1000, 2400, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // ㅓ
  KO:   { freq: [500, 900, 2400, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },   // ㅗ
  KU:   { freq: [350, 800, 2300, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },   // ㅜ
  KEU:  { freq: [400, 1500, 2400, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // ㅡ
  KI:   { freq: [300, 2300, 3000, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // ㅣ
  KAE:  { freq: [600, 1800, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // ㅐ
  KE:   { freq: [500, 1900, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.12, voiced: true },  // ㅔ
};

export const KOREAN_CONSONANTS: Record<string, PhonemeData> = {
  KG:   { freq: [200, 1800, 2700, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.07, voiced: true },   // ㄱ
  KN:   { freq: [270, 1600, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },   // ㄴ
  KD:   { freq: [200, 1700, 2600, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.07, voiced: true },   // ㄷ
  KL:   { freq: [310, 1100, 2800, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.07, voiced: true },   // ㄹ
  KM:   { freq: [270, 1000, 2200, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },   // ㅁ
  KB:   { freq: [200, 1000, 2100, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.07, voiced: true },   // ㅂ
  KS:   { freq: [200, 1600, 2600, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.09, voiced: false }, // ㅅ
  KJ:   { freq: [200, 2000, 2800, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },   // ㅈ
  KCH:  { freq: [200, 2100, 2900, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.10, voiced: false }, // ㅊ
  KK:   { freq: [200, 1900, 2800, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.09, voiced: false }, // ㅋ
  KT:   { freq: [200, 1700, 2600, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.09, voiced: false }, // ㅌ
  KP:   { freq: [200, 1000, 2100, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.09, voiced: false }, // ㅍ
  KH:   { freq: [500, 1500, 2500, 3500, 4500, 5500], bw: [200, 200, 200, 200, 250, 300], duration: 0.07, voiced: false }, // ㅎ
  KNG:  { freq: [270, 1900, 2800, 3500, 4500, 5500], bw: [60, 90, 150, 200, 250, 300], duration: 0.08, voiced: true },   // ㅇ (받침)
};

// All phonemes combined
export const ALL_PHONEMES: Record<string, PhonemeData> = {
  ...PHONEMES,
  ...KOREAN_VOWELS,
  ...KOREAN_CONSONANTS,
};

/**
 * Get phoneme data by symbol
 */
export function getPhoneme(symbol: string): PhonemeData {
  return ALL_PHONEMES[symbol] || SILENCE.SIL;
}
