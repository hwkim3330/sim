/**
 * Simi TTS v2.0 - GLaDOS-style Formant Synthesizer
 *
 * Advanced Klatt synthesis with:
 * - Phase vocoder for robotization
 * - Pitch quantization to semitones
 * - Formant shifting
 * - Natural prosody modeling
 *
 * Based on:
 * - Klatt 1980 formant synthesis
 * - Phase vocoder robotization (zero-phase)
 * - GLaDOS voice processing techniques
 *
 * @version 2.0.0
 * @license MIT
 */

(function(global) {
  'use strict';

  // ============================================================================
  // Constants
  // ============================================================================

  const SAMPLE_RATE = 22050;
  const FRAME_MS = 5;  // Shorter frames for smoother transitions
  const TWO_PI = 2 * Math.PI;

  // Chromatic scale frequencies for pitch quantization
  const CHROMATIC_SCALE = [];
  for (let midi = 36; midi <= 84; midi++) {
    CHROMATIC_SCALE.push(440 * Math.pow(2, (midi - 69) / 12));
  }

  // ============================================================================
  // Phoneme Database - Enhanced with transitions
  // ============================================================================

  // Format: [f1, f2, f3, f4, b1, b2, b3, b4, duration, av, af, voiced]
  // av = voicing amplitude, af = frication amplitude
  const PHONEMES = {
    // Vowels
    'IY': [270, 2290, 3010, 3300, 50, 70, 110, 150, 100, 60, 0, true],
    'IH': [390, 1990, 2550, 3300, 50, 80, 120, 150, 80, 60, 0, true],
    'EH': [530, 1840, 2480, 3300, 60, 90, 130, 150, 80, 60, 0, true],
    'EY': [450, 2100, 2650, 3300, 50, 80, 120, 150, 130, 60, 0, true],
    'AE': [660, 1720, 2410, 3300, 70, 100, 140, 150, 100, 60, 0, true],
    'AA': [730, 1090, 2440, 3300, 80, 90, 130, 150, 100, 60, 0, true],
    'AO': [570, 840, 2410, 3300, 70, 80, 130, 150, 100, 60, 0, true],
    'OW': [450, 800, 2830, 3300, 60, 80, 120, 150, 120, 60, 0, true],
    'UH': [440, 1020, 2240, 3300, 60, 80, 120, 150, 80, 60, 0, true],
    'UW': [300, 870, 2240, 3300, 50, 70, 110, 150, 100, 60, 0, true],
    'AH': [640, 1190, 2390, 3300, 70, 90, 130, 150, 80, 60, 0, true],
    'AX': [500, 1500, 2500, 3300, 60, 90, 130, 150, 50, 50, 0, true],
    'ER': [490, 1350, 1690, 3300, 60, 90, 150, 150, 100, 55, 0, true],
    'AXR': [500, 1300, 1700, 3300, 60, 90, 150, 150, 70, 50, 0, true],

    // Diphthongs
    'AY': [730, 1090, 2440, 3300, 70, 90, 130, 150, 150, 60, 0, true],
    'AW': [730, 1090, 2440, 3300, 70, 90, 130, 150, 150, 60, 0, true],
    'OY': [500, 700, 2600, 3300, 60, 80, 120, 150, 150, 60, 0, true],

    // Stops - voiced
    'B': [200, 1100, 2150, 3300, 60, 90, 150, 200, 70, 55, 0, true],
    'D': [200, 1600, 2600, 3300, 60, 90, 150, 200, 60, 55, 0, true],
    'G': [200, 1990, 2850, 3300, 60, 90, 150, 200, 70, 55, 0, true],

    // Stops - unvoiced (with aspiration burst)
    'P': [200, 1100, 2150, 3300, 100, 150, 200, 200, 90, 0, 50, false],
    'T': [200, 1600, 2600, 3300, 100, 150, 200, 200, 80, 0, 55, false],
    'K': [200, 1990, 2850, 3300, 100, 150, 200, 200, 90, 0, 50, false],

    // Fricatives - voiced
    'V': [220, 1100, 2080, 3300, 60, 90, 150, 200, 80, 47, 40, true],
    'DH': [220, 1600, 2600, 3300, 60, 90, 150, 200, 50, 40, 35, true],
    'Z': [200, 1600, 2600, 3300, 60, 90, 150, 200, 80, 47, 55, true],
    'ZH': [200, 1900, 2500, 3300, 60, 90, 150, 200, 80, 47, 50, true],

    // Fricatives - unvoiced
    'F': [220, 900, 2080, 3300, 150, 200, 250, 250, 90, 0, 55, false],
    'TH': [200, 1400, 2600, 3300, 150, 200, 250, 250, 80, 0, 45, false],
    'S': [200, 1600, 2600, 3300, 150, 200, 250, 250, 100, 0, 62, false],
    'SH': [200, 1800, 2600, 3300, 150, 200, 250, 250, 100, 0, 58, false],
    'HH': [500, 1500, 2500, 3300, 200, 250, 300, 300, 50, 0, 45, false],

    // Affricates
    'CH': [200, 1800, 2600, 3300, 150, 200, 250, 250, 110, 0, 55, false],
    'JH': [200, 1800, 2500, 3300, 60, 90, 150, 200, 90, 47, 50, true],

    // Nasals
    'M': [280, 900, 2200, 3300, 50, 80, 200, 300, 70, 54, 0, true],
    'N': [280, 1700, 2600, 3300, 50, 80, 200, 300, 70, 54, 0, true],
    'NG': [280, 2300, 2750, 3300, 50, 80, 200, 300, 70, 54, 0, true],

    // Liquids
    'L': [350, 1000, 2900, 3300, 50, 100, 150, 200, 70, 57, 0, true],
    'R': [330, 1060, 1400, 3300, 50, 100, 150, 200, 70, 52, 0, true],

    // Glides
    'W': [300, 610, 2200, 3300, 50, 80, 120, 150, 50, 54, 0, true],
    'Y': [280, 2200, 2960, 3300, 50, 80, 120, 150, 50, 54, 0, true],

    // Silence/Pause
    'SIL': [0, 0, 0, 0, 200, 200, 200, 200, 30, 0, 0, false],
    'PAU': [0, 0, 0, 0, 200, 200, 200, 200, 200, 0, 0, false],
  };

  // ============================================================================
  // Korean Phoneme Mapping (한국어 음소)
  // ============================================================================

  // 초성 (Initial consonants) -> ARPAbet-like mapping
  const KOREAN_INITIALS = {
    'ㄱ': ['G'],      // 기역
    'ㄲ': ['K'],      // 쌍기역 (tensed)
    'ㄴ': ['N'],      // 니은
    'ㄷ': ['D'],      // 디귿
    'ㄸ': ['T'],      // 쌍디귿 (tensed)
    'ㄹ': ['R'],      // 리을
    'ㅁ': ['M'],      // 미음
    'ㅂ': ['B'],      // 비읍
    'ㅃ': ['P'],      // 쌍비읍 (tensed)
    'ㅅ': ['S'],      // 시옷
    'ㅆ': ['S'],      // 쌍시옷 (tensed)
    'ㅇ': [],         // 이응 (silent as initial)
    'ㅈ': ['JH'],     // 지읒
    'ㅉ': ['CH'],     // 쌍지읒 (tensed)
    'ㅊ': ['CH'],     // 치읓
    'ㅋ': ['K'],      // 키읔
    'ㅌ': ['T'],      // 티읕
    'ㅍ': ['P'],      // 피읖
    'ㅎ': ['HH'],     // 히읗
  };

  // 중성 (Vowels) -> Formant-based mapping
  const KOREAN_VOWELS = {
    'ㅏ': ['AA'],     // 아
    'ㅐ': ['EH'],     // 애
    'ㅑ': ['Y', 'AA'],// 야
    'ㅒ': ['Y', 'EH'],// 얘
    'ㅓ': ['AH'],     // 어
    'ㅔ': ['EH'],     // 에
    'ㅕ': ['Y', 'AH'],// 여
    'ㅖ': ['Y', 'EH'],// 예
    'ㅗ': ['OW'],     // 오
    'ㅘ': ['W', 'AA'],// 와
    'ㅙ': ['W', 'EH'],// 왜
    'ㅚ': ['W', 'EH'],// 외
    'ㅛ': ['Y', 'OW'],// 요
    'ㅜ': ['UW'],     // 우
    'ㅝ': ['W', 'AH'],// 워
    'ㅞ': ['W', 'EH'],// 웨
    'ㅟ': ['W', 'IY'],// 위
    'ㅠ': ['Y', 'UW'],// 유
    'ㅡ': ['AX'],     // 으
    'ㅢ': ['AX', 'IY'],// 의
    'ㅣ': ['IY'],     // 이
  };

  // 종성 (Final consonants/받침) -> Modified for syllable-final position
  const KOREAN_FINALS = {
    '': [],           // No final
    'ㄱ': ['K'],      // 기역
    'ㄲ': ['K'],      // 쌍기역
    'ㄳ': ['K'],      // 기역시옷
    'ㄴ': ['N'],      // 니은
    'ㄵ': ['N'],      // 니은지읒
    'ㄶ': ['N'],      // 니은히읗
    'ㄷ': ['T'],      // 디귿
    'ㄹ': ['L'],      // 리을
    'ㄺ': ['L'],      // 리을기역
    'ㄻ': ['M'],      // 리을미음
    'ㄼ': ['L'],      // 리을비읍
    'ㄽ': ['L'],      // 리을시옷
    'ㄾ': ['L'],      // 리을티읕
    'ㄿ': ['L'],      // 리을피읖
    'ㅀ': ['L'],      // 리을히읗
    'ㅁ': ['M'],      // 미음
    'ㅂ': ['P'],      // 비읍
    'ㅄ': ['P'],      // 비읍시옷
    'ㅅ': ['T'],      // 시옷 -> T sound in final
    'ㅆ': ['T'],      // 쌍시옷 -> T sound
    'ㅇ': ['NG'],     // 이응 (ng sound as final)
    'ㅈ': ['T'],      // 지읒 -> T sound
    'ㅊ': ['T'],      // 치읓 -> T sound
    'ㅋ': ['K'],      // 키읔
    'ㅌ': ['T'],      // 티읕
    'ㅍ': ['P'],      // 피읖
    'ㅎ': ['T'],      // 히읗 -> T sound (often silent)
  };

  // Korean-specific phonemes (add to PHONEMES)
  // Extended Korean vowels with adjusted formants
  const KOREAN_PHONEMES = {
    // Korean specific - These map to existing but with adjusted timings
    'KO_EU': [400, 1500, 2500, 3300, 60, 90, 130, 150, 90, 55, 0, true], // ㅡ (으)
  };

  // Hangul Unicode ranges
  const HANGUL_START = 0xAC00;
  const HANGUL_END = 0xD7A3;
  const JAMO_INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JAMO_VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JAMO_FINALS = '\0ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

  // Decompose a Hangul syllable into jamo
  function decomposeHangul(char) {
    const code = char.charCodeAt(0);
    if (code < HANGUL_START || code > HANGUL_END) {
      return null;
    }

    const syllableIndex = code - HANGUL_START;
    const initialIndex = Math.floor(syllableIndex / 588);
    const vowelIndex = Math.floor((syllableIndex % 588) / 28);
    const finalIndex = syllableIndex % 28;

    return {
      initial: JAMO_INITIALS[initialIndex],
      vowel: JAMO_VOWELS[vowelIndex],
      final: finalIndex === 0 ? '' : JAMO_FINALS[finalIndex]
    };
  }

  // Check if character is Hangul
  function isHangul(char) {
    const code = char.charCodeAt(0);
    return code >= HANGUL_START && code <= HANGUL_END;
  }

  // Convert Korean text to phonemes
  function koreanToPhonemes(text) {
    const phonemes = [];
    const chars = [...text];

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];

      if (isHangul(char)) {
        const jamo = decomposeHangul(char);
        if (jamo) {
          // Initial consonant
          if (KOREAN_INITIALS[jamo.initial]) {
            phonemes.push(...KOREAN_INITIALS[jamo.initial]);
          }

          // Vowel
          if (KOREAN_VOWELS[jamo.vowel]) {
            phonemes.push(...KOREAN_VOWELS[jamo.vowel]);
          }

          // Final consonant (받침)
          if (jamo.final && KOREAN_FINALS[jamo.final]) {
            phonemes.push(...KOREAN_FINALS[jamo.final]);
          }
        }
      } else if (char === ' ') {
        phonemes.push('SIL');
      } else if (/[.,!?;:]/.test(char)) {
        if ('.!?'.includes(char)) {
          phonemes.push('PAU');
        } else {
          phonemes.push('SIL');
        }
      }
      // Skip other characters
    }

    return phonemes;
  }

  // ============================================================================
  // Word Dictionary - Extended (English + Korean)
  // ============================================================================

  // Korean common words/phrases
  const KOREAN_DICTIONARY = {
    '안녕': ['AA', 'N', 'N', 'Y', 'AH', 'NG'],
    '안녕하세요': ['AA', 'N', 'N', 'Y', 'AH', 'NG', 'HH', 'AA', 'S', 'EH', 'Y', 'OW'],
    '감사합니다': ['G', 'AA', 'M', 'S', 'AA', 'HH', 'AA', 'M', 'N', 'IY', 'D', 'AA'],
    '네': ['N', 'EH'],
    '아니요': ['AA', 'N', 'IY', 'Y', 'OW'],
    '좋아': ['JH', 'OW', 'AA'],
    '좋아요': ['JH', 'OW', 'AA', 'Y', 'OW'],
    '사랑해': ['S', 'AA', 'R', 'AA', 'NG', 'HH', 'EH'],
    '죄송합니다': ['JH', 'W', 'EH', 'S', 'OW', 'NG', 'HH', 'AA', 'M', 'N', 'IY', 'D', 'AA'],
    '안녕히': ['AA', 'N', 'N', 'Y', 'AH', 'NG', 'HH', 'IY'],
    '가세요': ['G', 'AA', 'S', 'EH', 'Y', 'OW'],
    '계세요': ['G', 'Y', 'EH', 'S', 'EH', 'Y', 'OW'],
    '뭐': ['M', 'W', 'AH'],
    '어디': ['AH', 'D', 'IY'],
    '언제': ['AH', 'N', 'JH', 'EH'],
    '왜': ['W', 'EH'],
    '어떻게': ['AH', 'T', 'AH', 'K', 'EH'],
    '누구': ['N', 'UW', 'G', 'UW'],
    '이것': ['IY', 'G', 'AH', 'T'],
    '저것': ['JH', 'AH', 'G', 'AH', 'T'],
    '여기': ['Y', 'AH', 'G', 'IY'],
    '거기': ['G', 'AH', 'G', 'IY'],
    '저기': ['JH', 'AH', 'G', 'IY'],
  };

  const DICTIONARY = {
    // Common words
    'the': ['DH', 'AX'], 'a': ['AX'], 'an': ['AE', 'N'],
    'and': ['AE', 'N', 'D'], 'or': ['AO', 'R'], 'but': ['B', 'AH', 'T'],
    'to': ['T', 'UW'], 'of': ['AH', 'V'], 'in': ['IH', 'N'],
    'is': ['IH', 'Z'], 'it': ['IH', 'T'], 'was': ['W', 'AA', 'Z'],
    'for': ['F', 'AO', 'R'], 'on': ['AA', 'N'], 'are': ['AA', 'R'],
    'be': ['B', 'IY'], 'at': ['AE', 'T'], 'as': ['AE', 'Z'],
    'by': ['B', 'AY'], 'not': ['N', 'AA', 'T'], 'you': ['Y', 'UW'],
    'with': ['W', 'IH', 'TH'], 'this': ['DH', 'IH', 'S'],
    'that': ['DH', 'AE', 'T'], 'have': ['HH', 'AE', 'V'],
    'from': ['F', 'R', 'AH', 'M'], 'they': ['DH', 'EY'],
    'we': ['W', 'IY'], 'she': ['SH', 'IY'], 'he': ['HH', 'IY'],
    'what': ['W', 'AH', 'T'], 'all': ['AO', 'L'], 'will': ['W', 'IH', 'L'],
    'there': ['DH', 'EH', 'R'], 'their': ['DH', 'EH', 'R'],
    'would': ['W', 'UH', 'D'], 'can': ['K', 'AE', 'N'],
    'if': ['IH', 'F'], 'do': ['D', 'UW'], 'so': ['S', 'OW'],
    'my': ['M', 'AY'], 'your': ['Y', 'AO', 'R'], 'just': ['JH', 'AH', 'S', 'T'],
    'one': ['W', 'AH', 'N'], 'no': ['N', 'OW'], 'yes': ['Y', 'EH', 'S'],
    'know': ['N', 'OW'], 'like': ['L', 'AY', 'K'], 'time': ['T', 'AY', 'M'],
    'good': ['G', 'UH', 'D'], 'make': ['M', 'EY', 'K'], 'how': ['HH', 'AW'],
    'now': ['N', 'AW'], 'way': ['W', 'EY'], 'new': ['N', 'UW'],

    // GLaDOS/Portal vocabulary
    'hello': ['HH', 'EH', 'L', 'OW'],
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
    'triumph': ['T', 'R', 'AY', 'AH', 'M', 'F'],
    'alive': ['AX', 'L', 'AY', 'V'],
    'still': ['S', 'T', 'IH', 'L'],
    'doing': ['D', 'UW', 'IH', 'NG'],
    'computer': ['K', 'AH', 'M', 'P', 'Y', 'UW', 'T', 'ER'],
    'robot': ['R', 'OW', 'B', 'AA', 'T'],
    'error': ['EH', 'R', 'ER'],
    'please': ['P', 'L', 'IY', 'Z'],
    'thank': ['TH', 'AE', 'NG', 'K'],
    'sorry': ['S', 'AA', 'R', 'IY'],
    'goodbye': ['G', 'UH', 'D', 'B', 'AY'],
    'huge': ['HH', 'Y', 'UW', 'JH'],
    'success': ['S', 'AH', 'K', 'S', 'EH', 'S'],
    'note': ['N', 'OW', 'T'],
    'making': ['M', 'EY', 'K', 'IH', 'NG'],
    'here': ['HH', 'IY', 'R'],
    'been': ['B', 'IH', 'N'],
    'suspension': ['S', 'AH', 'S', 'P', 'EH', 'N', 'SH', 'AX', 'N'],
    'days': ['D', 'EY', 'Z'],
    'fifty': ['F', 'IH', 'F', 'T', 'IY'],
    'morning': ['M', 'AO', 'R', 'N', 'IH', 'NG'],
    'chamber': ['CH', 'EY', 'M', 'B', 'ER'],
    'proceed': ['P', 'R', 'OW', 'S', 'IY', 'D'],
    'i': ['AY'],
    'im': ['AY', 'M'],
    "i'm": ['AY', 'M'],
  };

  // Letter-to-phoneme rules
  const LETTER_RULES = {
    'a': 'AE', 'b': 'B', 'c': 'K', 'd': 'D', 'e': 'EH',
    'f': 'F', 'g': 'G', 'h': 'HH', 'i': 'IH', 'j': 'JH',
    'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'o': 'AA',
    'p': 'P', 'q': 'K', 'r': 'R', 's': 'S', 't': 'T',
    'u': 'AH', 'v': 'V', 'w': 'W', 'x': 'K', 'y': 'IY', 'z': 'Z'
  };

  const DIGRAPHS = {
    'th': ['TH'], 'sh': ['SH'], 'ch': ['CH'], 'wh': ['W'],
    'ph': ['F'], 'ng': ['NG'], 'ck': ['K'], 'qu': ['K', 'W'],
    'ee': ['IY'], 'ea': ['IY'], 'oo': ['UW'], 'ou': ['AW'],
    'ow': ['OW'], 'oi': ['OY'], 'oy': ['OY'], 'ai': ['EY'],
    'ay': ['EY'], 'ie': ['IY'], 'ey': ['IY'], 'igh': ['AY'],
    'tion': ['SH', 'AX', 'N'], 'sion': ['ZH', 'AX', 'N'],
  };

  // ============================================================================
  // Text to Phoneme Converter (Multilingual: English + Korean)
  // ============================================================================

  // Detect if text contains Korean
  function hasKorean(text) {
    return /[\uAC00-\uD7A3]/.test(text);
  }

  // Detect if text contains English
  function hasEnglish(text) {
    return /[a-zA-Z]/.test(text);
  }

  function textToPhonemes(text, lang = 'auto') {
    // Auto-detect language
    const containsKorean = hasKorean(text);
    const containsEnglish = hasEnglish(text);

    // If only Korean or lang='ko', use Korean converter
    if (lang === 'ko' || (containsKorean && !containsEnglish)) {
      return koreanTextToPhonemes(text);
    }

    // If only English or lang='en', use English converter
    if (lang === 'en' || (containsEnglish && !containsKorean)) {
      return englishTextToPhonemes(text);
    }

    // Mixed content: process segment by segment
    return mixedTextToPhonemes(text);
  }

  // Korean text to phonemes
  function koreanTextToPhonemes(text) {
    const phonemes = [];
    const tokens = text.split(/(\s+|[.,!?;:]+)/).filter(t => t);

    for (const token of tokens) {
      if (/^[.,!?;:]+$/.test(token)) {
        if ('.!?'.includes(token[0])) {
          phonemes.push('PAU');
        } else {
          phonemes.push('SIL');
        }
        continue;
      }

      if (/^\s+$/.test(token)) {
        phonemes.push('SIL');
        continue;
      }

      // Check Korean dictionary first
      if (KOREAN_DICTIONARY[token]) {
        phonemes.push(...KOREAN_DICTIONARY[token]);
      } else {
        // Convert character by character
        phonemes.push(...koreanToPhonemes(token));
      }

      phonemes.push('SIL');
    }

    if (phonemes.length && phonemes[phonemes.length - 1] !== 'PAU') {
      phonemes.push('PAU');
    }

    return phonemes;
  }

  // English text to phonemes (original logic)
  function englishTextToPhonemes(text) {
    const cleaned = text.toLowerCase()
      .replace(/[^a-z\s.,!?;:'-]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const tokens = cleaned.split(/(\s+|[.,!?;:]+)/).filter(t => t.trim());
    const phonemes = [];

    for (const token of tokens) {
      if (/^[.,!?;:]+$/.test(token)) {
        if (token.includes('.') || token.includes('!') || token.includes('?')) {
          phonemes.push('PAU');
        } else {
          phonemes.push('SIL');
        }
        continue;
      }

      const word = token.trim();
      if (!word) continue;

      if (DICTIONARY[word]) {
        phonemes.push(...DICTIONARY[word]);
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

  // Mixed Korean/English text
  function mixedTextToPhonemes(text) {
    const phonemes = [];
    const segments = [];

    // Split into Korean and non-Korean segments
    let currentSegment = '';
    let currentIsKorean = null;

    for (const char of text) {
      const charIsKorean = isHangul(char);

      if (currentIsKorean === null) {
        currentIsKorean = charIsKorean;
        currentSegment = char;
      } else if (charIsKorean === currentIsKorean || /[\s.,!?;:]/.test(char)) {
        currentSegment += char;
      } else {
        if (currentSegment.trim()) {
          segments.push({ text: currentSegment, korean: currentIsKorean });
        }
        currentSegment = char;
        currentIsKorean = charIsKorean;
      }
    }

    if (currentSegment.trim()) {
      segments.push({ text: currentSegment, korean: currentIsKorean });
    }

    // Process each segment
    for (const segment of segments) {
      if (segment.korean) {
        phonemes.push(...koreanTextToPhonemes(segment.text));
      } else {
        phonemes.push(...englishTextToPhonemes(segment.text));
      }
    }

    // Clean up multiple consecutive silences
    const cleaned = [];
    for (let i = 0; i < phonemes.length; i++) {
      if (phonemes[i] === 'SIL' && cleaned[cleaned.length - 1] === 'SIL') {
        continue;
      }
      if (phonemes[i] === 'PAU' && cleaned[cleaned.length - 1] === 'SIL') {
        cleaned.pop();
      }
      cleaned.push(phonemes[i]);
    }

    return cleaned;
  }

  function convertWord(word) {
    const result = [];
    let i = 0;

    while (i < word.length) {
      if (word[i] === "'" || word[i] === '-') {
        i++;
        continue;
      }

      // Try digraphs/trigraphs first
      let matched = false;
      for (let len = 4; len >= 2; len--) {
        const substr = word.substr(i, len);
        if (DIGRAPHS[substr]) {
          result.push(...DIGRAPHS[substr]);
          i += len;
          matched = true;
          break;
        }
      }

      if (matched) continue;

      // Single letter with context
      const letter = word[i];
      const next = word[i + 1] || '';
      const prev = word[i - 1] || '';

      if (letter === 'c' && 'eiy'.includes(next)) {
        result.push('S');
      } else if (letter === 'g' && 'eiy'.includes(next)) {
        result.push('JH');
      } else if (letter === 'e' && i === word.length - 1 && word.length > 2) {
        // Silent final e (usually)
      } else if (LETTER_RULES[letter]) {
        result.push(LETTER_RULES[letter]);
      }

      i++;
    }

    return result;
  }

  // ============================================================================
  // DSP Utilities
  // ============================================================================

  // Biquad filter coefficients calculator
  function calcBiquadCoeffs(type, freq, Q, sampleRate) {
    const w0 = TWO_PI * freq / sampleRate;
    const cos_w0 = Math.cos(w0);
    const sin_w0 = Math.sin(w0);
    const alpha = sin_w0 / (2 * Q);

    let b0, b1, b2, a0, a1, a2;

    if (type === 'bandpass') {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
      a0 = 1 + alpha;
      a1 = -2 * cos_w0;
      a2 = 1 - alpha;
    } else if (type === 'lowpass') {
      b0 = (1 - cos_w0) / 2;
      b1 = 1 - cos_w0;
      b2 = (1 - cos_w0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cos_w0;
      a2 = 1 - alpha;
    } else if (type === 'highpass') {
      b0 = (1 + cos_w0) / 2;
      b1 = -(1 + cos_w0);
      b2 = (1 + cos_w0) / 2;
      a0 = 1 + alpha;
      a1 = -2 * cos_w0;
      a2 = 1 - alpha;
    }

    return {
      b0: b0/a0, b1: b1/a0, b2: b2/a0,
      a1: a1/a0, a2: a2/a0
    };
  }

  // ============================================================================
  // Resonator - Improved digital formant filter
  // ============================================================================

  class Resonator {
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
      this.b0 = 0;
      this.b1 = 0;
      this.b2 = 0;
      this.a1 = 0;
      this.a2 = 0;
      this.x1 = 0;
      this.x2 = 0;
      this.y1 = 0;
      this.y2 = 0;
    }

    setFormant(freq, bandwidth) {
      if (freq <= 0 || freq >= this.sampleRate / 2) {
        this.b0 = 1;
        this.b1 = 0;
        this.b2 = 0;
        this.a1 = 0;
        this.a2 = 0;
        return;
      }

      // Two-pole resonator (Klatt style)
      const T = 1 / this.sampleRate;
      const r = Math.exp(-Math.PI * bandwidth * T);
      const theta = TWO_PI * freq * T;

      this.a2 = -r * r;
      this.a1 = 2 * r * Math.cos(theta);
      this.b0 = 1 - r;  // Normalize gain
    }

    process(x) {
      const y = this.b0 * x + this.a1 * this.y1 + this.a2 * this.y2;
      this.y2 = this.y1;
      this.y1 = y;
      return y;
    }

    reset() {
      this.x1 = 0;
      this.x2 = 0;
      this.y1 = 0;
      this.y2 = 0;
    }
  }

  // ============================================================================
  // Anti-Resonator (for nasal zeros)
  // ============================================================================

  class AntiResonator {
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
      this.a = 1;
      this.b = 0;
      this.c = 0;
      this.x1 = 0;
      this.x2 = 0;
    }

    setParams(freq, bandwidth) {
      if (freq <= 0) {
        this.a = 1;
        this.b = 0;
        this.c = 0;
        return;
      }

      const T = 1 / this.sampleRate;
      const r = Math.exp(-Math.PI * bandwidth * T);
      const theta = TWO_PI * freq * T;

      const denom = 1 + 2*r*Math.cos(theta) + r*r;
      this.a = 1 / denom;
      this.b = -2 * r * Math.cos(theta) / denom;
      this.c = r * r / denom;
    }

    process(x) {
      const y = this.a * x + this.b * this.x1 + this.c * this.x2;
      this.x2 = this.x1;
      this.x1 = x;
      return y;
    }

    reset() {
      this.x1 = 0;
      this.x2 = 0;
    }
  }

  // ============================================================================
  // Glottal Source - LF model
  // ============================================================================

  class GlottalSource {
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
      this.phase = 0;
      this.period = 0;
      this.Oq = 0.5;  // Open quotient
      this.lastOutput = 0;
    }

    setF0(f0, jitter = 0) {
      if (f0 > 0) {
        const jitterAmount = 1 + (Math.random() - 0.5) * jitter;
        this.period = this.sampleRate / (f0 * jitterAmount);
      } else {
        this.period = 0;
      }
    }

    generate() {
      if (this.period <= 0) return 0;

      const t = this.phase / this.period;
      let output;

      // LF model approximation
      const Te = this.Oq;  // End of open phase
      const Tp = Te * 0.8; // Peak position

      if (t < Tp) {
        // Rising phase (polynomial)
        const x = t / Tp;
        output = 0.5 * (1 - Math.cos(Math.PI * x));
      } else if (t < Te) {
        // Falling phase
        const x = (t - Tp) / (Te - Tp);
        output = Math.cos(0.5 * Math.PI * x);
      } else {
        // Closed phase (return phase)
        const x = (t - Te) / (1 - Te);
        output = -0.2 * Math.exp(-5 * x);
      }

      // Differentiate for derivative glottal flow
      const diff = output - this.lastOutput;
      this.lastOutput = output;

      this.phase++;
      if (this.phase >= this.period) {
        this.phase -= this.period;
      }

      return diff * 10;  // Scale
    }

    reset() {
      this.phase = 0;
      this.lastOutput = 0;
    }
  }

  // ============================================================================
  // Noise Generator
  // ============================================================================

  class NoiseGenerator {
    constructor() {
      this.b0 = 0;
      this.b1 = 0;
      this.b2 = 0;
    }

    // White noise
    white() {
      return Math.random() * 2 - 1;
    }

    // Pink noise (1/f spectrum) - Voss algorithm
    pink() {
      const white = this.white();
      this.b0 = 0.99886 * this.b0 + white * 0.0555179;
      this.b1 = 0.99332 * this.b1 + white * 0.0750759;
      this.b2 = 0.96900 * this.b2 + white * 0.1538520;
      return (this.b0 + this.b1 + this.b2 + white * 0.5362) * 0.2;
    }

    // Aspiration noise (filtered)
    aspiration() {
      return this.pink() * 0.7 + this.white() * 0.3;
    }

    // Frication noise (high frequency emphasis)
    frication() {
      return this.white();
    }
  }

  // ============================================================================
  // Klatt Synthesizer - Cascade/Parallel
  // ============================================================================

  class KlattSynthesizer {
    constructor(sampleRate = SAMPLE_RATE) {
      this.sampleRate = sampleRate;
      this.samplesPerFrame = Math.floor(sampleRate * FRAME_MS / 1000);

      // Sources
      this.glottal = new GlottalSource(sampleRate);
      this.noise = new NoiseGenerator();

      // Cascade resonators (voiced sounds)
      this.r1 = new Resonator(sampleRate);
      this.r2 = new Resonator(sampleRate);
      this.r3 = new Resonator(sampleRate);
      this.r4 = new Resonator(sampleRate);
      this.r5 = new Resonator(sampleRate);

      // Nasal
      this.rnp = new Resonator(sampleRate);
      this.rnz = new AntiResonator(sampleRate);

      // Parallel resonators (fricatives)
      this.p1 = new Resonator(sampleRate);
      this.p2 = new Resonator(sampleRate);
      this.p3 = new Resonator(sampleRate);
      this.p4 = new Resonator(sampleRate);
      this.p5 = new Resonator(sampleRate);
      this.p6 = new Resonator(sampleRate);

      // Radiation characteristic
      this.radiationPrev = 0;

      // First difference for voiced source
      this.voicePrev = 0;
    }

    synthesize(phonemeData, voice) {
      const allSamples = [];
      const totalFrames = phonemeData.reduce((sum, p) =>
        sum + Math.ceil(p.duration / FRAME_MS), 0);

      let frameIdx = 0;

      for (let i = 0; i < phonemeData.length; i++) {
        const current = phonemeData[i];
        const next = phonemeData[i + 1];
        const prev = phonemeData[i - 1];

        const numFrames = Math.ceil(current.duration / FRAME_MS);

        for (let f = 0; f < numFrames; f++) {
          const framePos = f / numFrames;
          const globalPos = frameIdx / totalFrames;

          // Interpolate parameters
          const params = this.interpolateParams(current, next, prev, framePos);

          // Calculate pitch with prosody
          const f0 = this.calculatePitch(voice, globalPos, current.voiced);

          // Synthesize frame
          const frameSamples = this.synthesizeFrame(params, f0, voice);
          allSamples.push(...frameSamples);

          frameIdx++;
        }
      }

      return allSamples;
    }

    interpolateParams(current, next, prev, t) {
      const lerp = (a, b, t) => a + (b - a) * t;
      const smoothstep = (t) => t * t * (3 - 2 * t);

      // Start with current values
      let f1 = current.f1;
      let f2 = current.f2;
      let f3 = current.f3;
      let f4 = current.f4;
      let b1 = current.b1;
      let b2 = current.b2;
      let b3 = current.b3;
      let b4 = current.b4;
      let av = current.av;
      let af = current.af;

      // Smooth transition from previous phoneme (first 20%)
      if (prev && t < 0.2) {
        const blend = smoothstep(t / 0.2);
        f1 = lerp(prev.f1, current.f1, blend);
        f2 = lerp(prev.f2, current.f2, blend);
        f3 = lerp(prev.f3, current.f3, blend);
        av = lerp(prev.av, current.av, blend);
        af = lerp(prev.af, current.af, blend);
      }

      // Smooth transition to next phoneme (last 20%)
      if (next && t > 0.8) {
        const blend = smoothstep((t - 0.8) / 0.2);
        f1 = lerp(f1, next.f1, blend);
        f2 = lerp(f2, next.f2, blend);
        f3 = lerp(f3, next.f3, blend);
        av = lerp(av, next.av, blend);
        af = lerp(af, next.af, blend);
      }

      return { f1, f2, f3, f4, b1, b2, b3, b4, av, af, voiced: current.voiced };
    }

    calculatePitch(voice, globalPos, voiced) {
      if (!voiced) return 0;

      let f0 = voice.pitch;

      // Declination (pitch falls over utterance)
      f0 *= 1 - 0.15 * globalPos;

      // Phrase-level intonation
      if (voice.pitchRange > 0) {
        const phraseContour = Math.sin(globalPos * Math.PI) * 0.5;
        f0 += voice.pitchRange * phraseContour;
      }

      // Micro-prosody (small random variations)
      if (voice.jitter > 0) {
        f0 *= 1 + (Math.random() - 0.5) * voice.jitter;
      }

      return f0;
    }

    synthesizeFrame(params, f0, voice) {
      const samples = [];

      // Update resonators
      this.r1.setFormant(params.f1 * voice.formantShift, params.b1);
      this.r2.setFormant(params.f2 * voice.formantShift, params.b2);
      this.r3.setFormant(params.f3 * voice.formantShift, params.b3);
      this.r4.setFormant(params.f4 * voice.formantShift, params.b4);
      this.r5.setFormant(4500 * voice.formantShift, 200);

      // Parallel resonators for frication
      this.p2.setFormant(params.f2 * voice.formantShift, params.b2 * 0.8);
      this.p3.setFormant(params.f3 * voice.formantShift, params.b3 * 0.8);
      this.p4.setFormant(params.f4 * voice.formantShift, params.b4 * 0.8);
      this.p5.setFormant(5000, 300);
      this.p6.setFormant(6000, 400);

      // Set glottal source
      this.glottal.setF0(f0, voice.jitter);

      // Convert dB to amplitude
      const avAmp = params.av > 0 ? Math.pow(10, (params.av - 60) / 20) : 0;
      const afAmp = params.af > 0 ? Math.pow(10, (params.af - 60) / 20) : 0;
      const ahAmp = voice.breathiness * 0.3;

      for (let i = 0; i < this.samplesPerFrame; i++) {
        // === Voiced source ===
        let voiceSource = 0;
        if (params.voiced && avAmp > 0) {
          voiceSource = this.glottal.generate() * avAmp;
          // Add aspiration noise
          voiceSource += this.noise.aspiration() * ahAmp;
        }

        // === Cascade synthesis (voiced sounds) ===
        let cascade = voiceSource;
        if (cascade !== 0) {
          cascade = this.r1.process(cascade);
          cascade = this.r2.process(cascade);
          cascade = this.r3.process(cascade);
          cascade = this.r4.process(cascade);
          cascade = this.r5.process(cascade);
        }

        // === Parallel synthesis (fricatives) ===
        let parallel = 0;
        if (afAmp > 0) {
          const noise = this.noise.frication() * afAmp;
          parallel += this.p2.process(noise) * 0.5;
          parallel += this.p3.process(noise) * 0.7;
          parallel += this.p4.process(noise) * 0.5;
          parallel += this.p5.process(noise) * 0.3;
          parallel += this.p6.process(noise) * 0.2;
        }

        // === Combine ===
        let output = cascade + parallel;

        // Radiation characteristic (high-frequency boost)
        const radiated = output - this.radiationPrev;
        this.radiationPrev = output * 0.98;

        samples.push(radiated);
      }

      return samples;
    }

    reset() {
      this.glottal.reset();
      this.r1.reset();
      this.r2.reset();
      this.r3.reset();
      this.r4.reset();
      this.r5.reset();
      this.rnp.reset();
      this.rnz.reset();
      this.p1.reset();
      this.p2.reset();
      this.p3.reset();
      this.p4.reset();
      this.p5.reset();
      this.p6.reset();
      this.radiationPrev = 0;
      this.voicePrev = 0;
    }
  }

  // ============================================================================
  // Phase Vocoder - For robotization effect
  // ============================================================================

  class PhaseVocoder {
    constructor(fftSize = 2048) {
      this.fftSize = fftSize;
      this.hopSize = fftSize / 4;
    }

    // Simple robotization: set all phases to zero
    // This creates the characteristic "robotic" sound
    robotize(samples, amount = 1.0) {
      if (amount <= 0) return samples;

      const N = this.fftSize;
      const hop = this.hopSize;
      const numFrames = Math.floor((samples.length - N) / hop);
      const output = new Float32Array(samples.length);

      // Hann window
      const window = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        window[i] = 0.5 * (1 - Math.cos(TWO_PI * i / N));
      }

      for (let frame = 0; frame < numFrames; frame++) {
        const offset = frame * hop;

        // Extract and window frame
        const frameData = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          frameData[i] = samples[offset + i] * window[i];
        }

        // FFT
        const { real, imag } = this.fft(frameData);

        // Convert to magnitude and zero phase
        const mag = new Float32Array(N);
        for (let i = 0; i < N; i++) {
          mag[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }

        // Reconstruct with zero phase (robotization)
        // Blend between original and robotized based on amount
        for (let i = 0; i < N; i++) {
          const origMag = mag[i];
          const origPhase = Math.atan2(imag[i], real[i]);
          const newPhase = origPhase * (1 - amount); // Blend towards zero

          real[i] = origMag * Math.cos(newPhase);
          imag[i] = origMag * Math.sin(newPhase);
        }

        // IFFT
        const reconstructed = this.ifft(real, imag);

        // Overlap-add
        for (let i = 0; i < N; i++) {
          if (offset + i < output.length) {
            output[offset + i] += reconstructed[i] * window[i] / 1.5;
          }
        }
      }

      return output;
    }

    // Simple DFT (for small sizes)
    fft(x) {
      const N = x.length;
      const real = new Float32Array(N);
      const imag = new Float32Array(N);

      for (let k = 0; k < N; k++) {
        for (let n = 0; n < N; n++) {
          const angle = -TWO_PI * k * n / N;
          real[k] += x[n] * Math.cos(angle);
          imag[k] += x[n] * Math.sin(angle);
        }
      }

      return { real, imag };
    }

    ifft(real, imag) {
      const N = real.length;
      const output = new Float32Array(N);

      for (let n = 0; n < N; n++) {
        for (let k = 0; k < N; k++) {
          const angle = TWO_PI * k * n / N;
          output[n] += real[k] * Math.cos(angle) - imag[k] * Math.sin(angle);
        }
        output[n] /= N;
      }

      return output;
    }
  }

  // ============================================================================
  // Pitch Quantizer - Snap to chromatic scale
  // ============================================================================

  function quantizePitch(f0, strength = 1.0) {
    if (f0 <= 0 || strength <= 0) return f0;

    // Find nearest semitone
    let nearestFreq = CHROMATIC_SCALE[0];
    let minDist = Math.abs(f0 - nearestFreq);

    for (const freq of CHROMATIC_SCALE) {
      const dist = Math.abs(f0 - freq);
      if (dist < minDist) {
        minDist = dist;
        nearestFreq = freq;
      }
    }

    // Blend between original and quantized
    return f0 + (nearestFreq - f0) * strength;
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
      formantShift: 1.0,
      breathiness: 0.05,
      jitter: 0.02,
      // Effects
      robotize: 0,
      pitchQuantize: 0,
      reverb: 0.1,
    },

    male: {
      name: 'male',
      pitch: 100,
      pitchRange: 15,
      speed: 1.0,
      formantShift: 0.95,
      breathiness: 0.03,
      jitter: 0.02,
      robotize: 0,
      pitchQuantize: 0,
      reverb: 0.1,
    },

    female: {
      name: 'female',
      pitch: 200,
      pitchRange: 30,
      speed: 1.0,
      formantShift: 1.1,
      breathiness: 0.08,
      jitter: 0.015,
      robotize: 0,
      pitchQuantize: 0,
      reverb: 0.15,
    },

    robot: {
      name: 'robot',
      pitch: 100,
      pitchRange: 0,
      speed: 0.9,
      formantShift: 1.0,
      breathiness: 0,
      jitter: 0,
      robotize: 0.8,
      pitchQuantize: 1.0,
      reverb: 0.2,
    },

    // GLaDOS - the signature voice
    glados: {
      name: 'glados',
      pitch: 170,          // Female-range pitch
      pitchRange: 8,       // Mostly flat but slight variation
      speed: 0.85,         // Deliberate pacing
      formantShift: 1.15,  // Shifted up for "synthetic" quality
      breathiness: 0,      // No breath
      jitter: 0,           // Perfect pitch stability
      // Key effects for GLaDOS
      robotize: 0.4,       // Phase vocoder robotization
      pitchQuantize: 0.7,  // Snap to semitones
      reverb: 0.25,        // Slight room ambience
      ringMod: 0.08,       // Subtle ring modulation
      eq: {
        lowCut: 180,       // Remove low rumble
        highCut: 8000,     // Slight high cut
        midBoost: 2,       // Boost 2kHz for clarity
      }
    },

    // GLaDOS angry/sarcastic mode
    gladosAngry: {
      name: 'gladosAngry',
      pitch: 160,
      pitchRange: 15,      // More variation when emotional
      speed: 0.8,
      formantShift: 1.2,
      breathiness: 0,
      jitter: 0.01,
      robotize: 0.5,
      pitchQuantize: 0.6,
      reverb: 0.2,
      ringMod: 0.12,
    },

    // Wheatley style
    wheatley: {
      name: 'wheatley',
      pitch: 150,
      pitchRange: 40,      // Very expressive
      speed: 1.1,          // Faster, nervous
      formantShift: 1.05,
      breathiness: 0.02,
      jitter: 0.01,
      robotize: 0.3,
      pitchQuantize: 0.4,
      reverb: 0.15,
    },
  };

  // ============================================================================
  // Audio Effects Chain
  // ============================================================================

  class EffectsChain {
    constructor(audioContext) {
      this.ctx = audioContext;
    }

    // Simple convolution reverb
    createReverb(decay = 1.5, wet = 0.3) {
      const length = this.ctx.sampleRate * decay;
      const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          // Exponential decay with some diffusion
          const t = i / length;
          data[i] = (Math.random() * 2 - 1) * Math.exp(-4 * t) * (1 - t);
        }
      }

      const convolver = this.ctx.createConvolver();
      convolver.buffer = impulse;

      const dry = this.ctx.createGain();
      const wetGain = this.ctx.createGain();
      dry.gain.value = 1 - wet;
      wetGain.gain.value = wet;

      const input = this.ctx.createGain();
      const output = this.ctx.createGain();

      input.connect(dry);
      input.connect(convolver);
      convolver.connect(wetGain);
      dry.connect(output);
      wetGain.connect(output);

      return { input, output };
    }

    // EQ (low cut, high cut, mid boost)
    createEQ(lowCut = 180, highCut = 8000, midBoost = 2) {
      const low = this.ctx.createBiquadFilter();
      low.type = 'highpass';
      low.frequency.value = lowCut;
      low.Q.value = 0.7;

      const mid = this.ctx.createBiquadFilter();
      mid.type = 'peaking';
      mid.frequency.value = 2000;
      mid.Q.value = 1.5;
      mid.gain.value = midBoost;

      const high = this.ctx.createBiquadFilter();
      high.type = 'lowpass';
      high.frequency.value = highCut;
      high.Q.value = 0.7;

      low.connect(mid);
      mid.connect(high);

      return { input: low, output: high };
    }

    // Ring modulator
    createRingMod(freq = 30, mix = 0.1) {
      const input = this.ctx.createGain();
      const output = this.ctx.createGain();
      const dry = this.ctx.createGain();
      const wet = this.ctx.createGain();

      dry.gain.value = 1 - mix;
      wet.gain.value = mix;

      // Create oscillator for modulation
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const modGain = this.ctx.createGain();
      modGain.gain.value = 0;

      osc.connect(modGain.gain);
      osc.start();

      input.connect(dry);
      input.connect(modGain);
      modGain.connect(wet);
      dry.connect(output);
      wet.connect(output);

      return { input, output, osc };
    }

    // Compressor for consistent levels
    createCompressor() {
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 10;
      comp.ratio.value = 8;
      comp.attack.value = 0.005;
      comp.release.value = 0.1;
      return comp;
    }

    // Build complete GLaDOS effects chain
    buildGladosChain(voice) {
      const nodes = [];

      // 1. EQ
      if (voice.eq) {
        const eq = this.createEQ(voice.eq.lowCut, voice.eq.highCut, voice.eq.midBoost);
        nodes.push(eq);
      }

      // 2. Ring modulation
      if (voice.ringMod > 0) {
        const ring = this.createRingMod(30, voice.ringMod);
        nodes.push(ring);
      }

      // 3. Compressor
      const comp = this.createCompressor();
      nodes.push({ input: comp, output: comp });

      // 4. Reverb
      if (voice.reverb > 0) {
        const reverb = this.createReverb(1.2, voice.reverb);
        nodes.push(reverb);
      }

      return nodes;
    }

    // Connect chain
    connect(source, destination, chain) {
      if (chain.length === 0) {
        source.connect(destination);
        return;
      }

      source.connect(chain[0].input);
      for (let i = 0; i < chain.length - 1; i++) {
        chain[i].output.connect(chain[i + 1].input);
      }
      chain[chain.length - 1].output.connect(destination);
    }
  }

  // ============================================================================
  // Main TTS Engine
  // ============================================================================

  class SimiTTS {
    constructor(options = {}) {
      this.voice = { ...Voice.default, ...(options.voice || {}) };
      this.sampleRate = options.sampleRate || SAMPLE_RATE;
      this.synthesizer = new KlattSynthesizer(this.sampleRate);
      this.phaseVocoder = new PhaseVocoder(1024);
      this.audioContext = null;
      this.effects = null;
    }

    async init() {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: this.sampleRate
        });
        this.effects = new EffectsChain(this.audioContext);
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
    }

    setVoice(voice) {
      if (typeof voice === 'string') {
        this.voice = { ...Voice.default, ...(Voice[voice] || {}) };
      } else {
        this.voice = { ...Voice.default, ...voice };
      }
    }

    synthesize(text) {
      // Convert text to phonemes
      const phonemeSymbols = textToPhonemes(text);

      // Build phoneme data with parameters
      const phonemeData = phonemeSymbols.map(symbol => {
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
          duration: Math.round(data[8] / this.voice.speed),
          av: data[9],
          af: data[10],
          voiced: data[11]
        };
      });

      // Synthesize with Klatt
      let samples = this.synthesizer.synthesize(phonemeData, this.voice);

      // Apply robotization (phase vocoder)
      if (this.voice.robotize > 0) {
        samples = Array.from(this.phaseVocoder.robotize(
          new Float32Array(samples),
          this.voice.robotize
        ));
      }

      // Normalize
      const peak = Math.max(...samples.map(Math.abs));
      if (peak > 0) {
        samples = samples.map(s => s / peak * 0.85);
      }

      // Fade in/out to avoid clicks
      const fadeLen = Math.min(200, samples.length / 10);
      for (let i = 0; i < fadeLen; i++) {
        const gain = i / fadeLen;
        samples[i] *= gain;
        samples[samples.length - 1 - i] *= gain;
      }

      return samples;
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

      // Build effects chain
      if (this.voice.name.startsWith('glados') || this.voice.reverb > 0 || this.voice.ringMod > 0) {
        const chain = this.effects.buildGladosChain(this.voice);
        this.effects.connect(source, this.audioContext.destination, chain);
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

    toWav(text) {
      const samples = this.synthesize(text);
      return this.encodeWav(samples);
    }

    download(text, filename = 'glados-speech.wav') {
      const wav = this.toWav(text);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    encodeWav(samples) {
      const numChannels = 1;
      const bitsPerSample = 16;
      const bytesPerSample = 2;
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
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, this.sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);

      // data chunk
      this.writeString(view, 36, 'data');
      view.setUint32(40, dataSize, true);

      // Samples
      let offset = 44;
      for (const sample of samples) {
        const clamped = Math.max(-1, Math.min(1, sample));
        view.setInt16(offset, Math.round(clamped * 32767), true);
        offset += 2;
      }

      return buffer;
    }

    writeString(view, offset, str) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    }
  }

  // ============================================================================
  // Export
  // ============================================================================

  const SimiTTSLib = {
    TTS: SimiTTS,
    Voice,
    textToPhonemes,
    koreanToPhonemes,
    decomposeHangul,
    isHangul,
    PHONEMES,
    KOREAN_DICTIONARY,
    PhaseVocoder,
    KlattSynthesizer,
    version: '2.1.0'  // Korean support added
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimiTTSLib;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return SimiTTSLib; });
  } else {
    global.SimiTTS = SimiTTSLib;
  }

})(typeof self !== 'undefined' ? self : this);
