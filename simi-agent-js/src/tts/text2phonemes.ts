/**
 * Text to Phonemes Converter
 *
 * Rule-based conversion for English and Korean
 */

// Common English word pronunciations
const WORD_DICT: Record<string, string[]> = {
  'the': ['DH', 'AX'],
  'a': ['AX'],
  'and': ['AE', 'N', 'D'],
  'to': ['T', 'UW'],
  'of': ['AH', 'V'],
  'in': ['IH', 'N'],
  'is': ['IH', 'Z'],
  'it': ['IH', 'T'],
  'you': ['Y', 'UW'],
  'that': ['DH', 'AE', 'T'],
  'he': ['HH', 'IY'],
  'was': ['W', 'AA', 'Z'],
  'for': ['F', 'AO', 'R'],
  'on': ['AA', 'N'],
  'are': ['AA', 'R'],
  'with': ['W', 'IH', 'DH'],
  'as': ['AE', 'Z'],
  'be': ['B', 'IY'],
  'at': ['AE', 'T'],
  'have': ['HH', 'AE', 'V'],
  'this': ['DH', 'IH', 'S'],
  'from': ['F', 'R', 'AH', 'M'],
  'or': ['AO', 'R'],
  'by': ['B', 'AY'],
  'not': ['N', 'AA', 'T'],
  'but': ['B', 'AH', 'T'],
  'what': ['W', 'AH', 'T'],
  'all': ['AO', 'L'],
  'we': ['W', 'IY'],
  'can': ['K', 'AE', 'N'],
  'hello': ['HH', 'AX', 'L', 'OW'],
  'world': ['W', 'ER', 'L', 'D'],
  'welcome': ['W', 'EH', 'L', 'K', 'AH', 'M'],
  'test': ['T', 'EH', 'S', 'T'],
  'please': ['P', 'L', 'IY', 'Z'],
  'thank': ['TH', 'AE', 'NG', 'K'],
  'sorry': ['S', 'AA', 'R', 'IY'],
  'yes': ['Y', 'EH', 'S'],
  'no': ['N', 'OW'],
};

// Letter to phoneme mapping
const LETTER_MAP: Record<string, string[]> = {
  'a': ['AE'], 'b': ['B'], 'c': ['K'], 'd': ['D'], 'e': ['EH'],
  'f': ['F'], 'g': ['G'], 'h': ['HH'], 'i': ['IH'], 'j': ['JH'],
  'k': ['K'], 'l': ['L'], 'm': ['M'], 'n': ['N'], 'o': ['AA'],
  'p': ['P'], 'q': ['K'], 'r': ['R'], 's': ['S'], 't': ['T'],
  'u': ['AH'], 'v': ['V'], 'w': ['W'], 'x': ['K', 'S'], 'y': ['Y'], 'z': ['Z']
};

// Digraph mappings
const DIGRAPHS: Record<string, string[]> = {
  'th': ['TH'], 'sh': ['SH'], 'ch': ['CH'], 'ph': ['F'], 'wh': ['W'],
  'ng': ['NG'], 'ck': ['K'], 'ee': ['IY'], 'ea': ['IY'], 'oo': ['UW'],
  'ou': ['AW'], 'ow': ['OW'], 'oi': ['OY'], 'oy': ['OY'], 'ai': ['EY'],
  'ay': ['EY'], 'ie': ['IY'], 'ey': ['IY'],
};

// Korean Jamo tables
const CHOSEONG = [
  'KG', 'KGG', 'KN', 'KD', 'KDD', 'KL', 'KM', 'KB', 'KBB', 'KS',
  'KSS', null, 'KJ', 'KJJ', 'KCH', 'KK', 'KT', 'KP', 'KH'
];

const JUNGSEONG = [
  'KA', 'KAE', 'KYA', 'KYAE', 'KEO', 'KE', 'KYEO', 'KYE',
  'KO', 'KWA', 'KWAE', 'KOE', 'KYO', 'KU', 'KWO', 'KWE',
  'KWI', 'KYU', 'KEU', 'KUI', 'KI'
];

const JONGSEONG = [
  null, 'KG', 'KGG', 'KG', 'KN', 'KN', 'KN', 'KD', 'KL',
  'KL', 'KL', 'KL', 'KL', 'KL', 'KL', 'KL', 'KM', 'KB',
  'KB', 'KS', 'KSS', 'KNG', 'KJ', 'KCH', 'KK', 'KT', 'KP', 'KH'
];

/**
 * Check if character is Korean Hangul
 */
function isHangul(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0xAC00 && code <= 0xD7A3;
}

/**
 * Decompose Hangul syllable into Jamo
 */
function decomposeHangul(char: string): { cho: number; jung: number; jong: number } | null {
  const code = char.charCodeAt(0) - 0xAC00;
  if (code < 0 || code > 11171) return null;

  return {
    cho: Math.floor(code / 588),
    jung: Math.floor((code % 588) / 28),
    jong: code % 28,
  };
}

/**
 * Convert Korean text to phonemes
 */
function koreanToPhonemes(text: string): string[] {
  const phonemes: string[] = [];

  for (const char of text) {
    if (char === ' ' || char === '\n' || char === '\t') {
      phonemes.push('SIL');
      continue;
    }

    if (/[.,!?;:]/.test(char)) {
      phonemes.push('PAU');
      continue;
    }

    if (!isHangul(char)) continue;

    const decomp = decomposeHangul(char);
    if (!decomp) continue;

    const { cho, jung, jong } = decomp;

    // Initial consonant
    const choPhoneme = CHOSEONG[cho];
    if (choPhoneme) phonemes.push(choPhoneme);

    // Vowel
    const jungPhoneme = JUNGSEONG[jung];
    if (jungPhoneme) phonemes.push(jungPhoneme);

    // Final consonant
    if (jong > 0) {
      const jongPhoneme = JONGSEONG[jong];
      if (jongPhoneme) phonemes.push(jongPhoneme);
    }
  }

  return phonemes;
}

/**
 * Convert English word to phonemes
 */
function wordToPhonemes(word: string): string[] {
  const phonemes: string[] = [];
  let i = 0;

  while (i < word.length) {
    if (word[i] === "'") {
      i++;
      continue;
    }

    // Check digraphs first
    let matched = false;
    for (const [digraph, phones] of Object.entries(DIGRAPHS)) {
      if (word.substring(i, i + digraph.length) === digraph) {
        phonemes.push(...phones);
        i += digraph.length;
        matched = true;
        break;
      }
    }

    if (matched) continue;

    // Single letter
    const letter = word[i];
    if (LETTER_MAP[letter]) {
      // Context-sensitive rules
      if (letter === 'c' && i + 1 < word.length && 'eiy'.includes(word[i + 1])) {
        phonemes.push('S');
      } else if (letter === 'g' && i + 1 < word.length && 'eiy'.includes(word[i + 1])) {
        phonemes.push('JH');
      } else if (letter === 'e' && i === word.length - 1) {
        // Silent final e
      } else {
        phonemes.push(...LETTER_MAP[letter]);
      }
    }
    i++;
  }

  return phonemes;
}

/**
 * Check if text contains Korean
 */
function hasKorean(text: string): boolean {
  for (const char of text) {
    const code = char.charCodeAt(0);
    if ((code >= 0xAC00 && code <= 0xD7A3) || (code >= 0x3131 && code <= 0x3163)) {
      return true;
    }
  }
  return false;
}

/**
 * Convert text to phonemes
 */
export function textToPhonemes(text: string): string[] {
  // Korean path
  if (hasKorean(text)) {
    const phonemes = koreanToPhonemes(text);
    if (phonemes.length && phonemes[phonemes.length - 1] !== 'PAU') {
      phonemes.push('PAU');
    }
    return phonemes;
  }

  // English path
  const words = text.toLowerCase().replace(/[^a-z\s.,!?']/g, '').split(/\s+/);
  const phonemes: string[] = [];

  for (const word of words) {
    if (!word) continue;

    if (/^[.,!?;:]+$/.test(word)) {
      phonemes.push('PAU');
      continue;
    }

    if (WORD_DICT[word]) {
      phonemes.push(...WORD_DICT[word]);
    } else {
      phonemes.push(...wordToPhonemes(word));
    }
    phonemes.push('SIL');
  }

  if (phonemes.length && phonemes[phonemes.length - 1] !== 'PAU') {
    phonemes.push('PAU');
  }

  return phonemes;
}
