/**
 * Simi TTS - Browser-based Klatt Formant Synthesizer
 *
 * A dependency-free Text-to-Speech engine with GLaDOS-style voice.
 * Uses Web Audio API for real-time synthesis.
 *
 * @version 1.0.0
 * @license MIT
 *
 * @example
 * const tts = new SimiTTS();
 * await tts.speak("Hello, and welcome to the Aperture Science Enrichment Center.");
 */

(function(global) {
  'use strict';

  // ============================================================================
  // Phoneme Database - ARPAbet with Formant Parameters
  // ============================================================================

  const PHONEMES = {
    // Vowels: [f1, f2, f3, f4, b1, b2, b3, b4, duration, voiced]
    'IY': [270, 2290, 3010, 3500, 60, 90, 150, 200, 120, true],   // beat
    'IH': [390, 1990, 2550, 3500, 60, 90, 150, 200, 100, true],   // bit
    'EH': [530, 1840, 2480, 3500, 60, 90, 150, 200, 100, true],   // bet
    'EY': [440, 2100, 2600, 3500, 60, 90, 150, 200, 140, true],   // bait
    'AE': [660, 1720, 2410, 3500, 60, 90, 150, 200, 120, true],   // bat
    'AA': [730, 1090, 2440, 3500, 60, 90, 150, 200, 120, true],   // father
    'AO': [570, 840, 2410, 3500, 60, 90, 150, 200, 120, true],    // bought
    'OW': [490, 1350, 2400, 3500, 60, 90, 150, 200, 140, true],   // boat
    'UH': [440, 1020, 2240, 3500, 60, 90, 150, 200, 100, true],   // book
    'UW': [300, 870, 2240, 3500, 60, 90, 150, 200, 120, true],    // boot
    'AH': [640, 1190, 2390, 3500, 60, 90, 150, 200, 100, true],   // but
    'AX': [500, 1500, 2500, 3500, 60, 90, 150, 200, 60, true],    // schwa
    'ER': [490, 1350, 1690, 3500, 60, 90, 150, 200, 120, true],   // bird

    // Diphthongs
    'AY': [730, 1090, 2440, 3500, 60, 90, 150, 200, 180, true],   // bite
    'AW': [730, 1090, 2440, 3500, 60, 90, 150, 200, 180, true],   // bout
    'OY': [570, 840, 2410, 3500, 60, 90, 150, 200, 180, true],    // boy

    // Stops (voiced)
    'B': [200, 1100, 2150, 3500, 60, 90, 150, 200, 60, true],
    'D': [200, 1600, 2600, 3500, 60, 90, 150, 200, 60, true],
    'G': [200, 1990, 2850, 3500, 60, 90, 150, 200, 60, true],

    // Stops (unvoiced)
    'P': [200, 1100, 2150, 3500, 200, 200, 200, 200, 80, false],
    'T': [200, 1600, 2600, 3500, 200, 200, 200, 200, 80, false],
    'K': [200, 1990, 2850, 3500, 200, 200, 200, 200, 80, false],

    // Fricatives (voiced)
    'V': [220, 1100, 2080, 3500, 60, 90, 150, 200, 80, true],
    'DH': [200, 1600, 2600, 3500, 60, 90, 150, 200, 60, true],
    'Z': [200, 1600, 2600, 3500, 60, 90, 150, 200, 80, true],
    'ZH': [200, 1900, 2500, 3500, 60, 90, 150, 200, 80, true],

    // Fricatives (unvoiced)
    'F': [220, 1100, 2080, 3500, 200, 200, 200, 200, 100, false],
    'TH': [200, 1600, 2600, 3500, 200, 200, 200, 200, 80, false],
    'S': [200, 1600, 2600, 3500, 200, 200, 200, 200, 100, false],
    'SH': [200, 1900, 2500, 3500, 200, 200, 200, 200, 100, false],
    'HH': [500, 1500, 2500, 3500, 200, 200, 200, 200, 60, false],

    // Affricates
    'CH': [200, 1900, 2500, 3500, 200, 200, 200, 200, 120, false],
    'JH': [200, 1900, 2500, 3500, 60, 90, 150, 200, 100, true],

    // Nasals
    'M': [270, 1000, 2200, 3500, 60, 90, 150, 200, 80, true],
    'N': [270, 1600, 2600, 3500, 60, 90, 150, 200, 80, true],
    'NG': [270, 1990, 2850, 3500, 60, 90, 150, 200, 80, true],

    // Liquids
    'L': [310, 1050, 2880, 3500, 60, 90, 150, 200, 80, true],
    'R': [310, 1060, 1380, 3500, 60, 90, 150, 200, 80, true],

    // Glides
    'W': [290, 610, 2150, 3500, 60, 90, 150, 200, 60, true],
    'Y': [260, 2070, 3020, 3500, 60, 90, 150, 200, 60, true],

    // Silence
    'SIL': [0, 0, 0, 0, 200, 200, 200, 200, 50, false],
    'PAU': [0, 0, 0, 0, 200, 200, 200, 200, 150, false],

    // ========== Korean Vowels (모음) ==========
    'KA':   [800, 1200, 2600, 3500, 60, 90, 150, 200, 120, true],  // ㅏ
    'KEO':  [600, 1000, 2400, 3500, 60, 90, 150, 200, 120, true],  // ㅓ
    'KO':   [500, 900, 2400, 3500, 60, 90, 150, 200, 120, true],   // ㅗ
    'KU':   [350, 800, 2300, 3500, 60, 90, 150, 200, 120, true],   // ㅜ
    'KEU':  [400, 1500, 2400, 3500, 60, 90, 150, 200, 120, true],  // ㅡ
    'KI':   [300, 2300, 3000, 3500, 60, 90, 150, 200, 120, true],  // ㅣ
    'KAE':  [600, 1800, 2600, 3500, 60, 90, 150, 200, 120, true],  // ㅐ
    'KE':   [500, 1900, 2600, 3500, 60, 90, 150, 200, 120, true],  // ㅔ
    'KOE':  [450, 1600, 2500, 3500, 60, 90, 150, 200, 140, true],  // ㅚ
    'KWI':  [350, 1800, 2600, 3500, 60, 90, 150, 200, 140, true],  // ㅟ
    'KYA':  [750, 1300, 2600, 3500, 60, 90, 150, 200, 140, true],  // ㅑ
    'KYEO': [550, 1100, 2400, 3500, 60, 90, 150, 200, 140, true],  // ㅕ
    'KYO':  [450, 1000, 2400, 3500, 60, 90, 150, 200, 140, true],  // ㅛ
    'KYU':  [350, 900, 2300, 3500, 60, 90, 150, 200, 140, true],   // ㅠ
    'KWA':  [700, 1100, 2500, 3500, 60, 90, 150, 200, 140, true],  // ㅘ
    'KWO':  [550, 950, 2400, 3500, 60, 90, 150, 200, 140, true],   // ㅝ
    'KWAE': [600, 1700, 2600, 3500, 60, 90, 150, 200, 140, true],  // ㅙ
    'KWE':  [500, 1800, 2600, 3500, 60, 90, 150, 200, 140, true],  // ㅞ
    'KUI':  [400, 1600, 2500, 3500, 60, 90, 150, 200, 140, true],  // ㅢ

    // ========== Korean Consonants (자음) ==========
    // Stops - Plain (평음)
    'KG':   [200, 1800, 2700, 3500, 60, 90, 150, 200, 70, true],   // ㄱ
    'KD':   [200, 1700, 2600, 3500, 60, 90, 150, 200, 70, true],   // ㄷ
    'KB':   [200, 1000, 2100, 3500, 60, 90, 150, 200, 70, true],   // ㅂ
    'KJ':   [200, 2000, 2800, 3500, 60, 90, 150, 200, 80, true],   // ㅈ

    // Stops - Aspirated (격음)
    'KK':   [200, 1900, 2800, 3500, 200, 200, 200, 200, 90, false], // ㅋ
    'KT':   [200, 1700, 2600, 3500, 200, 200, 200, 200, 90, false], // ㅌ
    'KP':   [200, 1000, 2100, 3500, 200, 200, 200, 200, 90, false], // ㅍ
    'KCH':  [200, 2100, 2900, 3500, 200, 200, 200, 200, 100, false],// ㅊ
    'KH':   [500, 1500, 2500, 3500, 200, 200, 200, 200, 70, false], // ㅎ

    // Stops - Tense (경음)
    'KGG':  [200, 1850, 2750, 3500, 100, 120, 150, 200, 80, true],  // ㄲ
    'KDD':  [200, 1750, 2650, 3500, 100, 120, 150, 200, 80, true],  // ㄸ
    'KBB':  [200, 1050, 2150, 3500, 100, 120, 150, 200, 80, true],  // ㅃ
    'KJJ':  [200, 2050, 2850, 3500, 100, 120, 150, 200, 90, true],  // ㅉ
    'KSS':  [200, 1700, 2600, 3500, 150, 150, 150, 200, 90, false], // ㅆ

    // Fricatives
    'KS':   [200, 1600, 2600, 3500, 200, 200, 200, 200, 90, false], // ㅅ

    // Nasals
    'KN':   [270, 1600, 2600, 3500, 60, 90, 150, 200, 80, true],    // ㄴ
    'KM':   [270, 1000, 2200, 3500, 60, 90, 150, 200, 80, true],    // ㅁ
    'KNG':  [270, 1900, 2800, 3500, 60, 90, 150, 200, 80, true],    // ㅇ (받침)

    // Liquid
    'KL':   [310, 1100, 2800, 3500, 60, 90, 150, 200, 70, true],    // ㄹ
  };

  // ============================================================================
  // Text to Phoneme Converter
  // ============================================================================

  const WORD_DICT = {
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
    'one': ['W', 'AH', 'N'],
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
    'when': ['W', 'EH', 'N'],
    'your': ['Y', 'AO', 'R'],
    'can': ['K', 'AE', 'N'],
    'there': ['DH', 'EH', 'R'],
    'use': ['Y', 'UW', 'Z'],
    'she': ['SH', 'IY'],
    'do': ['D', 'UW'],
    'how': ['HH', 'AW'],
    'if': ['IH', 'F'],
    'will': ['W', 'IH', 'L'],
    'up': ['AH', 'P'],
    'about': ['AX', 'B', 'AW', 'T'],
    'out': ['AW', 'T'],
    'so': ['S', 'OW'],
    'some': ['S', 'AH', 'M'],
    'would': ['W', 'UH', 'D'],
    'make': ['M', 'EY', 'K'],
    'like': ['L', 'AY', 'K'],
    'time': ['T', 'AY', 'M'],
    'just': ['JH', 'AH', 'S', 'T'],
    'know': ['N', 'OW'],
    'good': ['G', 'UH', 'D'],
    'people': ['P', 'IY', 'P', 'AX', 'L'],
    'hello': ['HH', 'AX', 'L', 'OW'],
    'world': ['W', 'ER', 'L', 'D'],
    'welcome': ['W', 'EH', 'L', 'K', 'AH', 'M'],
    'aperture': ['AE', 'P', 'ER', 'CH', 'ER'],
    'science': ['S', 'AY', 'AX', 'N', 'S'],
    'enrichment': ['EH', 'N', 'R', 'IH', 'CH', 'M', 'AX', 'N', 'T'],
    'center': ['S', 'EH', 'N', 'T', 'ER'],
    'testing': ['T', 'EH', 'S', 'T', 'IH', 'NG'],
    'test': ['T', 'EH', 'S', 'T'],
    'subject': ['S', 'AH', 'B', 'JH', 'EH', 'K', 'T'],
    'cake': ['K', 'EY', 'K'],
    'lie': ['L', 'AY'],
    'alive': ['AX', 'L', 'AY', 'V'],
    'still': ['S', 'T', 'IH', 'L'],
    'doing': ['D', 'UW', 'IH', 'NG'],
    'robot': ['R', 'OW', 'B', 'AA', 'T'],
    'computer': ['K', 'AH', 'M', 'P', 'Y', 'UW', 'T', 'ER'],
    'error': ['EH', 'R', 'ER'],
    'system': ['S', 'IH', 'S', 'T', 'AX', 'M'],
    'please': ['P', 'L', 'IY', 'Z'],
    'thank': ['TH', 'AE', 'NG', 'K'],
    'sorry': ['S', 'AA', 'R', 'IY'],
    'goodbye': ['G', 'UH', 'D', 'B', 'AY'],
  };

  const LETTER_MAP = {
    'a': ['AE'], 'b': ['B'], 'c': ['K'], 'd': ['D'], 'e': ['EH'],
    'f': ['F'], 'g': ['G'], 'h': ['HH'], 'i': ['IH'], 'j': ['JH'],
    'k': ['K'], 'l': ['L'], 'm': ['M'], 'n': ['N'], 'o': ['AA'],
    'p': ['P'], 'q': ['K'], 'r': ['R'], 's': ['S'], 't': ['T'],
    'u': ['AH'], 'v': ['V'], 'w': ['W'], 'x': ['K', 'S'], 'y': ['Y'], 'z': ['Z']
  };

  const DIGRAPHS = {
    'th': ['TH'], 'sh': ['SH'], 'ch': ['CH'], 'ph': ['F'], 'wh': ['W'],
    'ng': ['NG'], 'ck': ['K'], 'ee': ['IY'], 'ea': ['IY'], 'oo': ['UW'],
    'ou': ['AW'], 'ow': ['OW'], 'oi': ['OY'], 'oy': ['OY'], 'ai': ['EY'],
    'ay': ['EY'], 'ie': ['IY'], 'ey': ['IY'], 'qu': ['K', 'W']
  };

  // ============================================================================
  // Korean (Hangul) Processing
  // ============================================================================

  // 초성 (Choseong - Initial consonants)
  const CHOSEONG = [
    'KG', 'KGG', 'KN', 'KD', 'KDD', 'KL', 'KM', 'KB', 'KBB', 'KS',
    'KSS', null, 'KJ', 'KJJ', 'KCH', 'KK', 'KT', 'KP', 'KH'
  ]; // null = ㅇ (silent initial)

  // 중성 (Jungseong - Vowels)
  const JUNGSEONG = [
    'KA', 'KAE', 'KYA', 'KYAE', 'KEO', 'KE', 'KYEO', 'KYE',
    'KO', 'KWA', 'KWAE', 'KOE', 'KYO', 'KU', 'KWO', 'KWE',
    'KWI', 'KYU', 'KEU', 'KUI', 'KI'
  ];

  // 종성 (Jongseong - Final consonants)
  const JONGSEONG = [
    null, 'KG', 'KGG', 'KG', 'KN', 'KN', 'KN', 'KD', 'KL',
    'KL', 'KL', 'KL', 'KL', 'KL', 'KL', 'KL', 'KM', 'KB',
    'KB', 'KS', 'KSS', 'KNG', 'KJ', 'KCH', 'KK', 'KT', 'KP', 'KH'
  ];

  // 쌍자음 중성 매핑 (for compound vowels like ㅑ -> y + a)
  const JUNGSEONG_EXTRA = {
    'KYAE': ['Y', 'KAE'],  // ㅒ
    'KYE': ['Y', 'KE'],    // ㅖ
  };

  function isHangul(char) {
    const code = char.charCodeAt(0);
    return code >= 0xAC00 && code <= 0xD7A3;
  }

  function isKoreanChar(char) {
    const code = char.charCodeAt(0);
    // Hangul syllables (가-힣) or Jamo (ㄱ-ㅎ, ㅏ-ㅣ)
    return (code >= 0xAC00 && code <= 0xD7A3) ||
           (code >= 0x3131 && code <= 0x3163);
  }

  function decomposeHangul(char) {
    const code = char.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return null;

    const cho = Math.floor(code / 588);
    const jung = Math.floor((code % 588) / 28);
    const jong = code % 28;

    return { cho, jung, jong };
  }

  function koreanToPhonemes(text) {
    const phonemes = [];

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (char === ' ' || char === '\n' || char === '\t') {
        phonemes.push('SIL');
        continue;
      }

      if (/[.,!?;:]/.test(char)) {
        phonemes.push('PAU');
        continue;
      }

      if (!isHangul(char)) {
        // Non-Korean character, skip or handle as silence
        continue;
      }

      const decomp = decomposeHangul(char);
      if (!decomp) continue;

      const { cho, jung, jong } = decomp;

      // 초성 (initial consonant)
      const choPhoneme = CHOSEONG[cho];
      if (choPhoneme) {
        phonemes.push(choPhoneme);
      }

      // 중성 (vowel)
      const jungPhoneme = JUNGSEONG[jung];
      if (jungPhoneme) {
        // Check for compound vowels that need expansion
        if (JUNGSEONG_EXTRA[jungPhoneme]) {
          phonemes.push(...JUNGSEONG_EXTRA[jungPhoneme]);
        } else {
          phonemes.push(jungPhoneme);
        }
      }

      // 종성 (final consonant)
      if (jong > 0) {
        const jongPhoneme = JONGSEONG[jong];
        if (jongPhoneme) {
          phonemes.push(jongPhoneme);
        }
      }
    }

    return phonemes;
  }

  function hasKorean(text) {
    for (let i = 0; i < text.length; i++) {
      if (isKoreanChar(text[i])) return true;
    }
    return false;
  }

  function textToPhonemes(text) {
    // Korean path - if text contains Korean, use Korean processor
    if (hasKorean(text)) {
      const phonemes = koreanToPhonemes(text);
      if (phonemes.length && phonemes[phonemes.length - 1] !== 'PAU') {
        phonemes.push('PAU');
      }
      return phonemes;
    }

    // English path
    const words = text.toLowerCase().replace(/[^a-z\s.,!?']/g, '').split(/\s+/);
    const phonemes = [];

    for (const word of words) {
      if (!word) continue;

      if (word.match(/^[.,!?;:]+$/)) {
        phonemes.push('PAU');
        continue;
      }

      if (WORD_DICT[word]) {
        phonemes.push(...WORD_DICT[word]);
      } else {
        phonemes.push(...convertWord(word));
      }
      phonemes.push('SIL');
    }

    if (phonemes.length && phonemes[phonemes.length - 1] !== 'PAU') {
      phonemes.push('PAU');
    }

    return phonemes;
  }

  function convertWord(word) {
    const phonemes = [];
    let i = 0;

    while (i < word.length) {
      if (word[i] === "'") {
        i++;
        continue;
      }

      // Check digraphs
      let matched = false;
      for (const [digraph, phones] of Object.entries(DIGRAPHS)) {
        if (word.substr(i, digraph.length) === digraph) {
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
        // Context rules
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

  // ============================================================================
  // Digital Resonator (Bandpass Filter)
  // ============================================================================

  class Resonator {
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
      this.T = 1.0 / sampleRate;  // Pre-calculate
      this.piT = Math.PI * this.T;
      this.twoPiT = 2 * Math.PI * this.T;
      this.a = 0;
      this.b = 0;
      this.c = 0;
      this.y1 = 0;
      this.y2 = 0;
      // Cache for avoiding recalculation
      this._lastFreq = -1;
      this._lastBw = -1;
    }

    setParams(freq, bandwidth) {
      // Skip if same params (cache hit)
      if (freq === this._lastFreq && bandwidth === this._lastBw) return;
      this._lastFreq = freq;
      this._lastBw = bandwidth;

      if (freq <= 0) {
        this.a = 0;
        this.b = 0;
        this.c = 0;
        return;
      }

      const r = Math.exp(-this.piT * bandwidth);
      const cosTheta = Math.cos(this.twoPiT * freq);

      this.c = -r * r;
      this.b = 2 * r * cosTheta;
      this.a = 1.0 - this.b - this.c;
    }

    process(x) {
      const y = this.a * x + this.b * this.y1 + this.c * this.y2;
      this.y2 = this.y1;
      this.y1 = y;
      return y;
    }

    reset() {
      this.y1 = 0;
      this.y2 = 0;
      this._lastFreq = -1;
      this._lastBw = -1;
    }
  }

  // ============================================================================
  // Glottal Source
  // ============================================================================

  class GlottalSource {
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
      this.phase = 0;
      this.t0 = 0;
      this.openQuota = 0.7;
    }

    setF0(f0) {
      this.t0 = f0 > 0 ? this.sampleRate / f0 : 0;
    }

    generate() {
      if (this.t0 <= 0) return 0;

      const tNorm = this.phase / this.t0;
      let output;

      if (tNorm < this.openQuota) {
        const x = tNorm / this.openQuota;
        output = 3 * x * x - 2 * x * x * x;
      } else if (tNorm < this.openQuota + 0.1) {
        const x = (tNorm - this.openQuota) / 0.1;
        output = 1.0 - x;
      } else {
        output = 0;
      }

      this.phase += 1;
      if (this.phase >= this.t0) {
        this.phase -= this.t0;
      }

      return output;
    }

    reset() {
      this.phase = 0;
    }
  }

  // ============================================================================
  // Klatt Synthesizer
  // ============================================================================

  class KlattSynthesizer {
    constructor(sampleRate = 22050) {
      this.sampleRate = sampleRate;
      this.frameMs = 10;
      this.samplesPerFrame = Math.floor(sampleRate * this.frameMs / 1000);

      this.glottal = new GlottalSource(sampleRate);
      this.r1 = new Resonator(sampleRate);
      this.r2 = new Resonator(sampleRate);
      this.r3 = new Resonator(sampleRate);
      this.r4 = new Resonator(sampleRate);

      this.radPrev = 0;

      // Pre-allocate frame buffer for performance
      this._frameBuffer = new Float64Array(this.samplesPerFrame);
    }

    synthesize(phonemes, voice) {
      const samples = [];
      let frameIdx = 0;
      const totalFrames = phonemes.reduce((sum, p) =>
        sum + Math.max(1, Math.floor(p.duration / this.frameMs)), 0);

      for (let i = 0; i < phonemes.length; i++) {
        const phoneme = phonemes[i];
        const nextPhoneme = phonemes[i + 1] || null;
        const nFrames = Math.max(1, Math.floor(phoneme.duration / this.frameMs));

        for (let j = 0; j < nFrames; j++) {
          const t = j / nFrames;
          const params = this.interpolate(phoneme, nextPhoneme, t);

          // Apply voice pitch with contour
          const pitch = voice.pitch * (1 - 0.1 * (frameIdx / totalFrames));
          const jitter = 1 + (Math.random() - 0.5) * 0.02 * voice.roughness;
          params.f0 = pitch * jitter;

          const frameSamples = this.synthesizeFrame(params, voice);
          samples.push(...frameSamples);
          frameIdx++;
        }
      }

      return this.normalize(samples);
    }

    interpolate(current, next, t) {
      const lerp = (a, b, t) => a + (b - a) * t;

      const params = {
        f0: current.f0,
        f1: current.f1,
        f2: current.f2,
        f3: current.f3,
        f4: current.f4,
        b1: current.b1,
        b2: current.b2,
        b3: current.b3,
        b4: current.b4,
        voiced: current.voiced
      };

      if (next && t > 0.7) {
        const blend = (t - 0.7) / 0.3;
        params.f1 = lerp(current.f1, next.f1, blend);
        params.f2 = lerp(current.f2, next.f2, blend);
        params.f3 = lerp(current.f3, next.f3, blend);
      }

      return params;
    }

    synthesizeFrame(params, voice) {
      const buffer = this._frameBuffer;
      const n = this.samplesPerFrame;

      this.r1.setParams(params.f1, params.b1);
      this.r2.setParams(params.f2, params.b2);
      this.r3.setParams(params.f3, params.b3);
      this.r4.setParams(params.f4, params.b4);

      this.glottal.setF0(params.f0);

      const voiceAmp = params.voiced ? 0.7 : 0;
      const noiseAmp = params.voiced ? 0.05 + voice.breathiness * 0.2 : 0.3;

      for (let i = 0; i < n; i++) {
        let source = this.glottal.generate() * voiceAmp;
        source += (Math.random() * 2 - 1) * noiseAmp;

        // Cascade filter (inline for speed)
        let y = this.r1.process(source);
        y = this.r2.process(y);
        y = this.r3.process(y);
        y = this.r4.process(y);

        // Radiation
        const radiated = y - this.radPrev;
        this.radPrev = y * 0.99;

        buffer[i] = radiated;
      }

      return Array.from(buffer);
    }

    normalize(samples) {
      // Find peak without spreading (faster for large arrays)
      let peak = 0;
      for (let i = 0; i < samples.length; i++) {
        const abs = samples[i] < 0 ? -samples[i] : samples[i];
        if (abs > peak) peak = abs;
      }
      if (peak > 0) {
        const scale = 0.8 / peak;
        for (let i = 0; i < samples.length; i++) {
          samples[i] *= scale;
        }
      }
      return samples;
    }

    reset() {
      this.glottal.reset();
      this.r1.reset();
      this.r2.reset();
      this.r3.reset();
      this.r4.reset();
      this.radPrev = 0;
    }
  }

  // ============================================================================
  // Voice Presets
  // ============================================================================

  const Voice = {
    default: {
      name: 'default',
      pitch: 120,
      pitchRange: 20,
      speed: 1.0,
      breathiness: 0,
      roughness: 0.1
    },

    male: {
      name: 'male',
      pitch: 100,
      pitchRange: 15,
      speed: 1.0,
      breathiness: 0,
      roughness: 0.1
    },

    female: {
      name: 'female',
      pitch: 180,
      pitchRange: 30,
      speed: 1.0,
      breathiness: 0.1,
      roughness: 0.05
    },

    robot: {
      name: 'robot',
      pitch: 100,
      pitchRange: 0,
      speed: 0.9,
      breathiness: 0,
      roughness: 0
    },

    // GLaDOS voice characteristics
    glados: {
      name: 'glados',
      pitch: 160,           // Female-ish pitch
      pitchRange: 5,        // Nearly monotone
      speed: 0.85,          // Deliberate, slow
      breathiness: 0,       // No breathiness
      roughness: 0,         // Clean
      // Effects applied separately
      effects: {
        ringMod: 0.15,      // Ring modulation
        formantShift: 1.05, // Slight formant shift up
        reverb: 0.3,        // Some reverb
        bitcrush: 0         // Optional bitcrushing
      }
    }
  };

  // ============================================================================
  // GLaDOS Effects Processor
  // ============================================================================

  class GLaDOSEffects {
    constructor(audioContext) {
      this.ctx = audioContext;
    }

    createChain(source, destination, effects) {
      let current = source;

      // Ring modulation (robotic quality)
      if (effects.ringMod > 0) {
        const ringMod = this.createRingModulator(effects.ringMod);
        current.connect(ringMod.input);
        current = ringMod.output;
      }

      // Subtle chorus for thickness
      const chorus = this.createChorus();
      current.connect(chorus.input);
      current = chorus.output;

      // Compression for consistent level
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 30;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      current.connect(compressor);
      current = compressor;

      // Reverb
      if (effects.reverb > 0) {
        const reverb = this.createReverb(effects.reverb);
        const dry = this.ctx.createGain();
        const wet = this.ctx.createGain();
        dry.gain.value = 1 - effects.reverb * 0.5;
        wet.gain.value = effects.reverb * 0.5;

        current.connect(dry);
        current.connect(reverb);
        reverb.connect(wet);

        const merger = this.ctx.createGain();
        dry.connect(merger);
        wet.connect(merger);
        current = merger;
      }

      // EQ for that "speaker" quality
      const eq = this.createEQ();
      current.connect(eq);
      eq.connect(destination);

      return source;
    }

    createRingModulator(amount) {
      const input = this.ctx.createGain();
      const output = this.ctx.createGain();
      const carrier = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();

      carrier.type = 'sine';
      carrier.frequency.value = 30; // Low frequency modulation
      modGain.gain.value = amount;

      carrier.connect(modGain);
      carrier.start();

      // Simple gain modulation
      input.connect(output);
      modGain.connect(output.gain);

      return { input, output };
    }

    createChorus() {
      const input = this.ctx.createGain();
      const output = this.ctx.createGain();
      const delay = this.ctx.createDelay(0.05);
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();

      delay.delayTime.value = 0.005;
      lfo.frequency.value = 0.5;
      lfoGain.gain.value = 0.002;

      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      lfo.start();

      input.connect(output);
      input.connect(delay);
      delay.connect(output);

      return { input, output };
    }

    createReverb(amount) {
      const convolver = this.ctx.createConvolver();
      const length = this.ctx.sampleRate * 1.5;
      const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.1));
        }
      }

      convolver.buffer = impulse;
      return convolver;
    }

    createEQ() {
      // Bandpass to simulate speaker
      const lowCut = this.ctx.createBiquadFilter();
      const highCut = this.ctx.createBiquadFilter();
      const mid = this.ctx.createBiquadFilter();

      lowCut.type = 'highpass';
      lowCut.frequency.value = 200;
      lowCut.Q.value = 0.7;

      highCut.type = 'lowpass';
      highCut.frequency.value = 8000;
      highCut.Q.value = 0.7;

      mid.type = 'peaking';
      mid.frequency.value = 2000;
      mid.Q.value = 1;
      mid.gain.value = 3;

      lowCut.connect(mid);
      mid.connect(highCut);

      // Return first filter, output from last
      const output = this.ctx.createGain();
      highCut.connect(output);

      lowCut.output = output;
      return lowCut;
    }
  }

  // ============================================================================
  // Main TTS Engine
  // ============================================================================

  class SimiTTS {
    constructor(options = {}) {
      this.voice = options.voice || Voice.default;
      this.sampleRate = options.sampleRate || 22050;
      this.synthesizer = new KlattSynthesizer(this.sampleRate);
      this.audioContext = null;
      this.effects = null;
    }

    async init() {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: this.sampleRate
        });
        this.effects = new GLaDOSEffects(this.audioContext);
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    }

    setVoice(voice) {
      if (typeof voice === 'string') {
        this.voice = Voice[voice] || Voice.default;
      } else {
        this.voice = { ...Voice.default, ...voice };
      }
    }

    synthesize(text) {
      const phonemeSymbols = textToPhonemes(text);
      const phonemes = phonemeSymbols.map(symbol => {
        const data = PHONEMES[symbol] || PHONEMES['SIL'];
        return {
          symbol,
          f1: data[0],
          f2: data[1],
          f3: data[2],
          f4: data[3],
          b1: data[4],
          b2: data[5],
          b3: data[6],
          b4: data[7],
          duration: Math.floor(data[8] / this.voice.speed),
          voiced: data[9],
          f0: this.voice.pitch
        };
      });

      return this.synthesizer.synthesize(phonemes, this.voice);
    }

    async speak(text, onProgress) {
      await this.init();

      const samples = this.synthesize(text);
      const buffer = this.audioContext.createBuffer(1, samples.length, this.sampleRate);
      const channelData = buffer.getChannelData(0);

      for (let i = 0; i < samples.length; i++) {
        channelData[i] = samples[i];
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Apply GLaDOS effects if using that voice
      if (this.voice.name === 'glados' && this.voice.effects) {
        this.effects.createChain(source, this.audioContext.destination, this.voice.effects);
      } else {
        source.connect(this.audioContext.destination);
      }

      return new Promise((resolve) => {
        source.onended = resolve;
        source.start();

        if (onProgress) {
          const duration = samples.length / this.sampleRate;
          const startTime = this.audioContext.currentTime;
          const update = () => {
            const elapsed = this.audioContext.currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);
            onProgress(progress);
            if (progress < 1) {
              requestAnimationFrame(update);
            }
          };
          requestAnimationFrame(update);
        }
      });
    }

    // Generate WAV file as ArrayBuffer
    toWav(text) {
      const samples = this.synthesize(text);
      return this.samplesToWav(samples);
    }

    /**
     * Sing a melody - each note has text, pitch (Hz), and duration (ms)
     * @param {Array<{text: string, pitch: number, duration: number}>} melody
     */
    async sing(melody, onProgress) {
      await this.init();

      const allSamples = [];

      for (let i = 0; i < melody.length; i++) {
        const note = melody[i];
        const phonemeSymbols = textToPhonemes(note.text);

        const phonemes = phonemeSymbols.map(symbol => {
          const data = PHONEMES[symbol] || PHONEMES['SIL'];
          // Distribute duration across phonemes
          const noteDuration = note.duration / phonemeSymbols.length;
          return {
            symbol,
            f1: data[0],
            f2: data[1],
            f3: data[2],
            f4: data[3],
            b1: data[4],
            b2: data[5],
            b3: data[6],
            b4: data[7],
            duration: noteDuration,
            voiced: data[9],
            f0: note.pitch  // Use the note's pitch
          };
        });

        // Create a temporary voice with the note's pitch
        const noteVoice = { ...this.voice, pitch: note.pitch };
        const samples = this.synthesizer.synthesize(phonemes, noteVoice);
        allSamples.push(...samples);
      }

      // Normalize (in-place for performance)
      let peak = 0;
      for (let i = 0; i < allSamples.length; i++) {
        const abs = allSamples[i] < 0 ? -allSamples[i] : allSamples[i];
        if (abs > peak) peak = abs;
      }
      if (peak > 0) {
        const scale = 0.8 / peak;
        for (let i = 0; i < allSamples.length; i++) {
          allSamples[i] *= scale;
        }
      }
      const normalized = allSamples;

      // Play
      const buffer = this.audioContext.createBuffer(1, normalized.length, this.sampleRate);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < normalized.length; i++) {
        channelData[i] = normalized[i];
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      if (this.voice.name === 'glados' && this.voice.effects) {
        this.effects.createChain(source, this.audioContext.destination, this.voice.effects);
      } else {
        source.connect(this.audioContext.destination);
      }

      return new Promise((resolve) => {
        source.onended = resolve;
        source.start();

        if (onProgress) {
          const duration = normalized.length / this.sampleRate;
          const startTime = this.audioContext.currentTime;
          const update = () => {
            const elapsed = this.audioContext.currentTime - startTime;
            const progress = Math.min(1, elapsed / duration);
            onProgress(progress);
            if (progress < 1) {
              requestAnimationFrame(update);
            }
          };
          requestAnimationFrame(update);
        }
      });
    }

    // Generate WAV and trigger download
    download(text, filename = 'speech.wav') {
      const wav = this.toWav(text);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    samplesToWav(samples) {
      const numChannels = 1;
      const bitsPerSample = 16;
      const bytesPerSample = bitsPerSample / 8;
      const blockAlign = numChannels * bytesPerSample;
      const byteRate = this.sampleRate * blockAlign;
      const dataSize = samples.length * bytesPerSample;
      const bufferSize = 44 + dataSize;

      const buffer = new ArrayBuffer(bufferSize);
      const view = new DataView(buffer);

      // RIFF header
      this.writeString(view, 0, 'RIFF');
      view.setUint32(4, bufferSize - 8, true);
      this.writeString(view, 8, 'WAVE');

      // fmt chunk
      this.writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, numChannels, true);
      view.setUint32(24, this.sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);

      // data chunk
      this.writeString(view, 36, 'data');
      view.setUint32(40, dataSize, true);

      // samples
      const maxVal = 32767;
      let offset = 44;
      for (const sample of samples) {
        const clipped = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, Math.floor(clipped * maxVal), true);
        offset += 2;
      }

      return buffer;
    }

    writeString(view, offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }
  }

  // ============================================================================
  // Daisy Bell Melody (1961 - First computer-sung song)
  // ============================================================================

  const DAISY_BELL = [
    // "Dai-sy, Dai-sy,"
    { text: 'day', pitch: 294, duration: 400 },   // D4
    { text: 'zee', pitch: 294, duration: 400 },   // D4
    { text: 'day', pitch: 392, duration: 400 },   // G4
    { text: 'zee', pitch: 330, duration: 600 },   // E4
    // "give me your answer, do."
    { text: 'give', pitch: 294, duration: 300 },  // D4
    { text: 'me', pitch: 330, duration: 300 },    // E4
    { text: 'your', pitch: 349, duration: 300 },  // F4
    { text: 'an', pitch: 330, duration: 300 },    // E4
    { text: 'ser', pitch: 294, duration: 300 },   // D4
    { text: 'do', pitch: 247, duration: 600 },    // B3
    // pause
    { text: '.', pitch: 0, duration: 400 },
    // "I'm half cra-zy,"
    { text: 'im', pitch: 294, duration: 400 },    // D4
    { text: 'half', pitch: 294, duration: 400 },  // D4
    { text: 'cray', pitch: 392, duration: 400 },  // G4
    { text: 'zee', pitch: 330, duration: 600 },   // E4
    // "all for the love of you."
    { text: 'all', pitch: 294, duration: 300 },   // D4
    { text: 'for', pitch: 330, duration: 300 },   // E4
    { text: 'the', pitch: 349, duration: 300 },   // F4
    { text: 'love', pitch: 392, duration: 400 },  // G4
    { text: 'of', pitch: 349, duration: 300 },    // F4
    { text: 'you', pitch: 294, duration: 800 },   // D4
  ];

  // ============================================================================
  // Export
  // ============================================================================

  const SimiTTSLib = {
    TTS: SimiTTS,
    Voice,
    textToPhonemes,
    PHONEMES,
    DAISY_BELL,
    version: '2.0.0'
  };

  // UMD export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimiTTSLib;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return SimiTTSLib; });
  } else {
    global.SimiTTS = SimiTTSLib;
  }

})(typeof self !== 'undefined' ? self : this);
