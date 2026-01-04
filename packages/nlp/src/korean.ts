/**
 * Korean language utilities
 * Jamo decomposition, composition, and Korean text utilities
 */

// Unicode ranges
const HANGUL_START = 0xAC00;
const HANGUL_END = 0xD7A3;
const JAMO_START = 0x3131;
const JAMO_END = 0x3163;

/** Initial consonants (초성) */
export const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ',
  'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
] as const;

/** Vowels (중성) */
export const JUNGSUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
  'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
] as const;

/** Final consonants (종성) - first is empty (no final) */
export const JONGSUNG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ',
  'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ',
  'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
] as const;

/** Jamo decomposition result */
export interface JamoDecomposition {
  cho: string;
  jung: string;
  jong: string;
}

/** Check if character is a Hangul syllable */
export function isHangul(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= HANGUL_START && code <= HANGUL_END;
}

/** Check if character is Jamo */
export function isJamo(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= JAMO_START && code <= JAMO_END;
}

/** Decompose Hangul syllable to Jamo array */
export function decompose(char: string): string[] {
  if (!isHangul(char)) return [char];

  const code = char.charCodeAt(0) - HANGUL_START;
  const choIdx = Math.floor(code / (21 * 28));
  const jungIdx = Math.floor((code % (21 * 28)) / 28);
  const jongIdx = code % 28;

  const result = [CHOSUNG[choIdx], JUNGSUNG[jungIdx]];
  if (jongIdx > 0) {
    result.push(JONGSUNG[jongIdx]);
  }
  return result;
}

/** Decompose to object form */
export function decomposeToObject(char: string): JamoDecomposition | null {
  if (!isHangul(char)) return null;

  const code = char.charCodeAt(0) - HANGUL_START;
  const choIdx = Math.floor(code / (21 * 28));
  const jungIdx = Math.floor((code % (21 * 28)) / 28);
  const jongIdx = code % 28;

  return {
    cho: CHOSUNG[choIdx],
    jung: JUNGSUNG[jungIdx],
    jong: JONGSUNG[jongIdx],
  };
}

/** Compose Jamo to Hangul syllable */
export function compose(cho: string, jung: string, jong: string = ''): string | null {
  const choIdx = CHOSUNG.indexOf(cho as typeof CHOSUNG[number]);
  const jungIdx = JUNGSUNG.indexOf(jung as typeof JUNGSUNG[number]);
  const jongIdx = JONGSUNG.indexOf(jong as typeof JONGSUNG[number]);

  if (choIdx < 0 || jungIdx < 0) return null;
  const jongVal = jongIdx < 0 ? 0 : jongIdx;

  const code = HANGUL_START + (choIdx * 21 + jungIdx) * 28 + jongVal;
  return String.fromCharCode(code);
}

/** Extract chosung from Hangul text */
export function extractChosung(text: string): string {
  return [...text].map(char => {
    if (isHangul(char)) {
      return decompose(char)[0];
    }
    return char;
  }).join('');
}

/** Check if text matches chosung pattern */
export function matchChosung(text: string, pattern: string): boolean {
  const chosung = extractChosung(text);
  return chosung.includes(pattern);
}

/** Korean language utilities namespace */
export const KoreanUtils = {
  isHangul,
  isJamo,
  decompose,
  decomposeToObject,
  compose,
  extractChosung,
  matchChosung,
  CHOSUNG,
  JUNGSUNG,
  JONGSUNG,
};
