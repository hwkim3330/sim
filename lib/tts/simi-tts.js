/**
 * Simi TTS v3.0 - Korean + English Formant Synthesizer
 *
 * Features:
 * - Native Korean support with accurate formants
 * - Korean phonological rules (연음, 경음화, 비음화, 구개음화)
 * - Optimized synthesis (no slow FFT)
 * - GLaDOS-style effects
 *
 * @version 3.0.0
 * @license MIT
 */

(function(global) {
  'use strict';

  // ============================================================================
  // Constants
  // ============================================================================

  const SAMPLE_RATE = 22050;
  const FRAME_MS = 8;
  const TWO_PI = 2 * Math.PI;

  // ============================================================================
  // Korean Phoneme Database - Based on Korean Phonetics Research
  // ============================================================================

  // Format: [f1, f2, f3, f4, bw1, bw2, bw3, bw4, duration_ms, voicing_amp, noise_amp, voiced]
  // Formant values based on Korean phonetics studies (Shin 2015, Lee & Zee 2003)

  const KOREAN_PHONEMES = {
    // ==================== 단모음 (Monophthongs) ====================
    // ㅏ (a) - Open front-central
    'ㅏ': [850, 1350, 2600, 3500, 80, 90, 120, 150, 120, 60, 0, true],
    // ㅓ (eo) - Mid back unrounded
    'ㅓ': [600, 1000, 2550, 3500, 70, 85, 120, 150, 120, 60, 0, true],
    // ㅗ (o) - Close-mid back rounded
    'ㅗ': [450, 850, 2500, 3500, 60, 80, 120, 150, 120, 60, 0, true],
    // ㅜ (u) - Close back rounded
    'ㅜ': [350, 850, 2400, 3500, 55, 80, 120, 150, 120, 60, 0, true],
    // ㅡ (eu) - Close central unrounded
    'ㅡ': [400, 1500, 2500, 3500, 60, 90, 120, 150, 120, 58, 0, true],
    // ㅣ (i) - Close front unrounded
    'ㅣ': [300, 2300, 3100, 3700, 50, 80, 110, 150, 100, 60, 0, true],
    // ㅐ (ae) - Near-open front
    'ㅐ': [580, 1900, 2650, 3500, 70, 90, 120, 150, 110, 60, 0, true],
    // ㅔ (e) - Close-mid front
    'ㅔ': [500, 1950, 2700, 3500, 65, 85, 120, 150, 110, 60, 0, true],
    // ㅚ (oe) - Rounded front (→ ㅙ/ㅞ로 합류 추세)
    'ㅚ': [450, 1700, 2500, 3500, 60, 85, 120, 150, 120, 60, 0, true],
    // ㅟ (wi) - Rounded front close
    'ㅟ': [320, 1900, 2600, 3500, 55, 80, 110, 150, 110, 60, 0, true],

    // ==================== 이중모음 (Diphthongs) - y계열 ====================
    // ㅑ (ya), ㅕ (yeo), ㅛ (yo), ㅠ (yu) - 선행 활음 /j/
    'ㅑ': [300, 2200, 3000, 3600, 50, 80, 110, 150, 140, 60, 0, true], // j + a
    'ㅕ': [300, 2200, 3000, 3600, 50, 80, 110, 150, 140, 60, 0, true], // j + eo
    'ㅛ': [300, 2200, 3000, 3600, 50, 80, 110, 150, 140, 60, 0, true], // j + o
    'ㅠ': [300, 2200, 3000, 3600, 50, 80, 110, 150, 140, 60, 0, true], // j + u
    'ㅖ': [300, 2200, 3000, 3600, 50, 80, 110, 150, 130, 60, 0, true], // j + e
    'ㅒ': [300, 2200, 3000, 3600, 50, 80, 110, 150, 130, 60, 0, true], // j + ae

    // ==================== 이중모음 (Diphthongs) - w계열 ====================
    // ㅘ (wa), ㅝ (wo), ㅙ (wae), ㅞ (we)
    'ㅘ': [350, 800, 2400, 3500, 55, 80, 120, 150, 150, 60, 0, true],  // w + a
    'ㅝ': [350, 800, 2400, 3500, 55, 80, 120, 150, 150, 60, 0, true],  // w + eo
    'ㅙ': [350, 800, 2400, 3500, 55, 80, 120, 150, 140, 60, 0, true],  // w + ae
    'ㅞ': [350, 800, 2400, 3500, 55, 80, 120, 150, 140, 60, 0, true],  // w + e
    'ㅢ': [400, 1500, 2500, 3500, 60, 90, 120, 150, 150, 58, 0, true], // eu + i

    // ==================== 자음 (Consonants) ====================

    // --- 평음 (Lenis/Plain) ---
    // ㄱ (g/k) - Lenis velar stop
    'ㄱ': [200, 2000, 2700, 3500, 60, 100, 150, 200, 25, 50, 0, true],
    // ㄴ (n) - Alveolar nasal
    'ㄴ': [300, 1600, 2600, 3500, 50, 80, 180, 250, 70, 55, 0, true],
    // ㄷ (d/t) - Lenis alveolar stop
    'ㄷ': [200, 1700, 2700, 3500, 60, 100, 150, 200, 25, 50, 0, true],
    // ㄹ (r/l) - Liquid (flap intervocalically, lateral elsewhere)
    'ㄹ': [350, 1400, 2500, 3500, 55, 100, 150, 200, 50, 55, 0, true],
    // ㅁ (m) - Bilabial nasal
    'ㅁ': [280, 900, 2400, 3500, 50, 80, 180, 250, 70, 55, 0, true],
    // ㅂ (b/p) - Lenis bilabial stop
    'ㅂ': [200, 800, 2400, 3500, 60, 100, 150, 200, 25, 50, 0, true],
    // ㅅ (s) - Alveolar fricative
    'ㅅ': [200, 1800, 2700, 3500, 150, 200, 250, 300, 100, 0, 58, false],
    // ㅇ (ng) - Velar nasal (only as coda)
    'ㅇ': [280, 2300, 2900, 3500, 50, 80, 180, 250, 70, 55, 0, true],
    // ㅈ (j) - Lenis palato-alveolar affricate
    'ㅈ': [200, 2200, 2900, 3500, 80, 120, 150, 200, 90, 40, 45, true],
    // ㅎ (h) - Glottal fricative
    'ㅎ': [500, 1500, 2500, 3500, 200, 250, 300, 350, 60, 0, 45, false],

    // --- 경음 (Fortis/Tense) ---
    // ㄲ (kk), ㄸ (tt), ㅃ (pp), ㅆ (ss), ㅉ (jj)
    'ㄲ': [200, 2000, 2700, 3500, 60, 100, 150, 200, 80, 0, 40, false],
    'ㄸ': [200, 1700, 2700, 3500, 60, 100, 150, 200, 80, 0, 40, false],
    'ㅃ': [200, 800, 2400, 3500, 60, 100, 150, 200, 80, 0, 40, false],
    'ㅆ': [200, 1800, 2700, 3500, 150, 200, 250, 300, 120, 0, 62, false],
    'ㅉ': [200, 2200, 2900, 3500, 80, 120, 150, 200, 100, 0, 50, false],

    // --- 격음 (Aspirated) ---
    // ㅋ (k), ㅌ (t), ㅍ (p), ㅊ (ch)
    'ㅋ': [200, 2000, 2700, 3500, 100, 150, 200, 250, 100, 0, 55, false],
    'ㅌ': [200, 1700, 2700, 3500, 100, 150, 200, 250, 100, 0, 55, false],
    'ㅍ': [200, 800, 2400, 3500, 100, 150, 200, 250, 100, 0, 55, false],
    'ㅊ': [200, 2200, 2900, 3500, 100, 150, 200, 250, 110, 0, 55, false],

    // --- 받침 전용 (Coda-only realizations) ---
    'ㄱㅂ': [200, 1200, 2400, 3500, 60, 100, 150, 200, 60, 0, 0, false], // 받침 ㄱ
    'ㄴㅂ': [280, 1600, 2600, 3500, 50, 80, 180, 250, 80, 55, 0, true],  // 받침 ㄴ
    'ㄷㅂ': [200, 1700, 2700, 3500, 60, 100, 150, 200, 60, 0, 0, false], // 받침 ㄷ/ㅅ/ㅈ/ㅊ/ㅎ
    'ㄹㅂ': [350, 1100, 2500, 3500, 55, 100, 150, 200, 80, 55, 0, true], // 받침 ㄹ
    'ㅁㅂ': [280, 900, 2400, 3500, 50, 80, 180, 250, 80, 55, 0, true],   // 받침 ㅁ
    'ㅂㅂ': [200, 800, 2400, 3500, 60, 100, 150, 200, 60, 0, 0, false],  // 받침 ㅂ
    'ㅇㅂ': [280, 2300, 2900, 3500, 50, 80, 180, 250, 80, 55, 0, true],  // 받침 ㅇ (ng)

    // ==================== Special ====================
    'SIL': [0, 0, 0, 0, 200, 200, 200, 200, 50, 0, 0, false],
    'PAU': [0, 0, 0, 0, 200, 200, 200, 200, 250, 0, 0, false],
    'BRE': [500, 1500, 2500, 3500, 200, 250, 300, 350, 30, 0, 20, false], // Breath
  };

  // Diphthong transitions - [start_vowel, end_vowel, glide_duration_ratio]
  const DIPHTHONG_TRANSITIONS = {
    'ㅑ': ['ㅣ', 'ㅏ', 0.3],
    'ㅕ': ['ㅣ', 'ㅓ', 0.3],
    'ㅛ': ['ㅣ', 'ㅗ', 0.3],
    'ㅠ': ['ㅣ', 'ㅜ', 0.3],
    'ㅖ': ['ㅣ', 'ㅔ', 0.3],
    'ㅒ': ['ㅣ', 'ㅐ', 0.3],
    'ㅘ': ['ㅜ', 'ㅏ', 0.3],
    'ㅝ': ['ㅜ', 'ㅓ', 0.3],
    'ㅙ': ['ㅜ', 'ㅐ', 0.3],
    'ㅞ': ['ㅜ', 'ㅔ', 0.3],
    'ㅢ': ['ㅡ', 'ㅣ', 0.4],
  };

  // ============================================================================
  // English Phoneme Database (ARPAbet)
  // ============================================================================

  const ENGLISH_PHONEMES = {
    // Vowels
    'IY': [280, 2250, 2950, 3500, 50, 70, 110, 150, 100, 60, 0, true],
    'IH': [400, 2000, 2550, 3500, 55, 80, 120, 150, 80, 60, 0, true],
    'EH': [550, 1850, 2500, 3500, 60, 90, 130, 150, 80, 60, 0, true],
    'EY': [500, 2000, 2600, 3500, 55, 85, 125, 150, 130, 60, 0, true],
    'AE': [700, 1700, 2400, 3500, 70, 100, 140, 150, 100, 60, 0, true],
    'AA': [750, 1150, 2450, 3500, 80, 95, 130, 150, 100, 60, 0, true],
    'AO': [600, 900, 2450, 3500, 70, 85, 130, 150, 100, 60, 0, true],
    'OW': [500, 850, 2800, 3500, 60, 80, 125, 150, 120, 60, 0, true],
    'UH': [470, 1000, 2300, 3500, 60, 80, 120, 150, 80, 60, 0, true],
    'UW': [320, 900, 2250, 3500, 50, 75, 115, 150, 100, 60, 0, true],
    'AH': [650, 1200, 2400, 3500, 70, 90, 130, 150, 80, 60, 0, true],
    'AX': [500, 1400, 2500, 3500, 60, 90, 130, 150, 50, 50, 0, true],
    'ER': [500, 1350, 1700, 3500, 60, 90, 150, 150, 100, 55, 0, true],
    'AXR': [500, 1300, 1700, 3500, 60, 90, 150, 150, 70, 50, 0, true],
    // Diphthongs
    'AY': [750, 1150, 2450, 3500, 70, 90, 130, 150, 150, 60, 0, true],
    'AW': [750, 1150, 2450, 3500, 70, 90, 130, 150, 150, 60, 0, true],
    'OY': [500, 750, 2600, 3500, 60, 80, 120, 150, 150, 60, 0, true],
    // Stops
    'B': [200, 1100, 2200, 3500, 60, 90, 150, 200, 60, 55, 0, true],
    'D': [200, 1700, 2600, 3500, 60, 90, 150, 200, 50, 55, 0, true],
    'G': [200, 2000, 2800, 3500, 60, 90, 150, 200, 60, 55, 0, true],
    'P': [200, 1100, 2200, 3500, 100, 150, 200, 250, 80, 0, 45, false],
    'T': [200, 1700, 2600, 3500, 100, 150, 200, 250, 70, 0, 50, false],
    'K': [200, 2000, 2800, 3500, 100, 150, 200, 250, 80, 0, 45, false],
    // Fricatives
    'V': [220, 1100, 2100, 3500, 60, 90, 150, 200, 70, 45, 38, true],
    'DH': [220, 1600, 2600, 3500, 60, 90, 150, 200, 45, 40, 32, true],
    'Z': [200, 1700, 2600, 3500, 60, 90, 150, 200, 75, 45, 52, true],
    'ZH': [200, 2000, 2500, 3500, 60, 90, 150, 200, 75, 45, 48, true],
    'F': [220, 900, 2100, 3500, 150, 200, 250, 300, 85, 0, 52, false],
    'TH': [200, 1400, 2600, 3500, 150, 200, 250, 300, 75, 0, 42, false],
    'S': [200, 1700, 2600, 3500, 150, 200, 250, 300, 95, 0, 60, false],
    'SH': [200, 1900, 2600, 3500, 150, 200, 250, 300, 95, 0, 56, false],
    'HH': [500, 1500, 2500, 3500, 200, 250, 300, 350, 45, 0, 42, false],
    // Affricates
    'CH': [200, 1900, 2600, 3500, 150, 200, 250, 300, 100, 0, 52, false],
    'JH': [200, 1900, 2500, 3500, 60, 90, 150, 200, 85, 45, 48, true],
    // Nasals
    'M': [280, 950, 2250, 3500, 50, 80, 200, 300, 65, 54, 0, true],
    'N': [280, 1700, 2600, 3500, 50, 80, 200, 300, 65, 54, 0, true],
    'NG': [280, 2300, 2800, 3500, 50, 80, 200, 300, 65, 54, 0, true],
    // Liquids
    'L': [360, 1050, 2900, 3500, 50, 100, 150, 200, 65, 57, 0, true],
    'R': [340, 1100, 1450, 3500, 50, 100, 150, 200, 65, 52, 0, true],
    // Glides
    'W': [320, 650, 2250, 3500, 50, 80, 120, 150, 50, 54, 0, true],
    'Y': [290, 2200, 2950, 3500, 50, 80, 120, 150, 50, 54, 0, true],
    // Silence
    'SIL': [0, 0, 0, 0, 200, 200, 200, 200, 50, 0, 0, false],
    'PAU': [0, 0, 0, 0, 200, 200, 200, 200, 250, 0, 0, false],
  };

  // ============================================================================
  // Hangul Processing
  // ============================================================================

  const HANGUL_START = 0xAC00;
  const HANGUL_END = 0xD7A3;

  const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const FINALS = '\0ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

  function isHangul(char) {
    const code = char.charCodeAt(0);
    return code >= HANGUL_START && code <= HANGUL_END;
  }

  function decomposeHangul(char) {
    const code = char.charCodeAt(0);
    if (code < HANGUL_START || code > HANGUL_END) return null;

    const idx = code - HANGUL_START;
    const initialIdx = Math.floor(idx / 588);
    const vowelIdx = Math.floor((idx % 588) / 28);
    const finalIdx = idx % 28;

    return {
      initial: INITIALS[initialIdx],
      vowel: VOWELS[vowelIdx],
      final: finalIdx === 0 ? null : FINALS[finalIdx]
    };
  }

  // ============================================================================
  // Korean Phonological Rules (음운 규칙)
  // ============================================================================

  // 받침 대표음 (Coda neutralization)
  const CODA_NEUTRALIZATION = {
    'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ', 'ㄳ': 'ㄱ', 'ㄺ': 'ㄱ',
    'ㄴ': 'ㄴ', 'ㄵ': 'ㄴ', 'ㄶ': 'ㄴ',
    'ㄷ': 'ㄷ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅌ': 'ㄷ', 'ㅎ': 'ㄷ',
    'ㄹ': 'ㄹ', 'ㄻ': 'ㅁ', 'ㄼ': 'ㄹ', 'ㄽ': 'ㄹ', 'ㄾ': 'ㄹ', 'ㄿ': 'ㅂ', 'ㅀ': 'ㄹ',
    'ㅁ': 'ㅁ',
    'ㅂ': 'ㅂ', 'ㅍ': 'ㅂ', 'ㅄ': 'ㅂ',
    'ㅇ': 'ㅇ',
  };

  // 경음화 (Tensification) - 받침 뒤의 평음이 경음으로
  const TENSIFICATION = {
    'ㄱ': { 'ㄱ': 'ㄲ', 'ㄷ': 'ㄸ', 'ㅂ': 'ㅃ', 'ㅅ': 'ㅆ', 'ㅈ': 'ㅉ' },
    'ㄷ': { 'ㄱ': 'ㄲ', 'ㄷ': 'ㄸ', 'ㅂ': 'ㅃ', 'ㅅ': 'ㅆ', 'ㅈ': 'ㅉ' },
    'ㅂ': { 'ㄱ': 'ㄲ', 'ㄷ': 'ㄸ', 'ㅂ': 'ㅃ', 'ㅅ': 'ㅆ', 'ㅈ': 'ㅉ' },
  };

  // 비음화 (Nasalization) - 받침 뒤에 비음이 오면
  const NASALIZATION = {
    'ㄱ': 'ㅇ', // ㄱ + ㄴ/ㅁ → ㅇ
    'ㄷ': 'ㄴ', // ㄷ + ㄴ/ㅁ → ㄴ
    'ㅂ': 'ㅁ', // ㅂ + ㄴ/ㅁ → ㅁ
  };

  // 연음 (Liaison) - 받침 + 모음 → 연음
  function applyLiaison(coda, nextInitial) {
    if (nextInitial === 'ㅇ') {
      // 받침이 다음 음절의 초성으로 이동
      return [null, coda];
    }
    return [coda, nextInitial];
  }

  // 구개음화 (Palatalization) - ㄷ/ㅌ + 이 → ㅈ/ㅊ
  function applyPalatalization(coda, nextVowel) {
    if (nextVowel === 'ㅣ' || nextVowel === 'ㅕ') {
      if (coda === 'ㄷ') return 'ㅈ';
      if (coda === 'ㅌ') return 'ㅊ';
    }
    return coda;
  }

  // 격음화 (Aspiration) - ㅎ + 평음 또는 평음 + ㅎ
  const ASPIRATION = {
    'ㄱ': 'ㅋ', 'ㄷ': 'ㅌ', 'ㅂ': 'ㅍ', 'ㅈ': 'ㅊ',
  };

  // Apply all phonological rules to a sequence of syllables
  function applyPhonologicalRules(syllables) {
    const result = [];

    for (let i = 0; i < syllables.length; i++) {
      const curr = { ...syllables[i] };
      const next = syllables[i + 1];

      if (curr.final) {
        // Get neutralized coda
        let coda = CODA_NEUTRALIZATION[curr.final] || curr.final;

        if (next) {
          // 연음 (Liaison)
          if (next.initial === 'ㅇ') {
            const palatalized = applyPalatalization(coda, next.vowel);
            next.initial = palatalized;
            coda = null;
          }
          // 비음화 (Nasalization)
          else if ((next.initial === 'ㄴ' || next.initial === 'ㅁ') && NASALIZATION[coda]) {
            coda = NASALIZATION[coda];
          }
          // 격음화 (Aspiration)
          else if (next.initial === 'ㅎ' && ASPIRATION[coda]) {
            next.initial = ASPIRATION[coda];
            coda = null;
          }
          else if (coda === 'ㅎ' && ASPIRATION[next.initial]) {
            next.initial = ASPIRATION[next.initial];
            coda = null;
          }
          // 경음화 (Tensification)
          else if (TENSIFICATION[coda] && TENSIFICATION[coda][next.initial]) {
            next.initial = TENSIFICATION[coda][next.initial];
          }
        }

        curr.final = coda;
      }

      result.push(curr);
    }

    return result;
  }

  // ============================================================================
  // Text to Phoneme Conversion
  // ============================================================================

  function koreanToPhonemes(text) {
    const syllables = [];

    // Parse text into syllables
    for (const char of text) {
      if (isHangul(char)) {
        const decomposed = decomposeHangul(char);
        if (decomposed) {
          syllables.push(decomposed);
        }
      } else if (char === ' ') {
        syllables.push({ type: 'space' });
      } else if (/[.,!?;:]/.test(char)) {
        syllables.push({ type: '.!?'.includes(char) ? 'pause' : 'short_pause' });
      }
    }

    // Apply phonological rules
    const processed = applyPhonologicalRules(syllables.filter(s => s.initial));

    // Convert to phoneme sequence
    const phonemes = [];
    let processedIdx = 0;

    for (const syl of syllables) {
      if (syl.type === 'space') {
        phonemes.push({ phoneme: 'SIL', ...KOREAN_PHONEMES['SIL'] });
      } else if (syl.type === 'pause') {
        phonemes.push({ phoneme: 'PAU', ...KOREAN_PHONEMES['PAU'] });
      } else if (syl.type === 'short_pause') {
        phonemes.push({ phoneme: 'SIL', ...KOREAN_PHONEMES['SIL'] });
      } else if (syl.initial) {
        const proc = processed[processedIdx++];

        // Initial consonant (unless ㅇ)
        if (proc.initial !== 'ㅇ' && KOREAN_PHONEMES[proc.initial]) {
          phonemes.push({ phoneme: proc.initial, ...parsePhonemeData(KOREAN_PHONEMES[proc.initial]) });
        }

        // Vowel (handle diphthongs)
        if (DIPHTHONG_TRANSITIONS[proc.vowel]) {
          const [startV, endV, ratio] = DIPHTHONG_TRANSITIONS[proc.vowel];
          const startData = parsePhonemeData(KOREAN_PHONEMES[startV]);
          const endData = parsePhonemeData(KOREAN_PHONEMES[endV]);

          // Glide portion
          phonemes.push({
            phoneme: startV,
            ...startData,
            duration: Math.round(startData.duration * ratio)
          });
          // Target vowel
          phonemes.push({
            phoneme: endV,
            ...endData,
            duration: Math.round(endData.duration * (1 - ratio))
          });
        } else if (KOREAN_PHONEMES[proc.vowel]) {
          phonemes.push({ phoneme: proc.vowel, ...parsePhonemeData(KOREAN_PHONEMES[proc.vowel]) });
        }

        // Final consonant
        if (proc.final && KOREAN_PHONEMES[proc.final + 'ㅂ']) {
          phonemes.push({ phoneme: proc.final, ...parsePhonemeData(KOREAN_PHONEMES[proc.final + 'ㅂ']) });
        } else if (proc.final && KOREAN_PHONEMES[proc.final]) {
          const codaData = parsePhonemeData(KOREAN_PHONEMES[proc.final]);
          codaData.duration = Math.round(codaData.duration * 0.6); // Shorter for codas
          phonemes.push({ phoneme: proc.final, ...codaData });
        }
      }
    }

    // Add final pause
    if (phonemes.length && phonemes[phonemes.length - 1].phoneme !== 'PAU') {
      phonemes.push({ phoneme: 'PAU', ...parsePhonemeData(KOREAN_PHONEMES['PAU']) });
    }

    return phonemes;
  }

  function parsePhonemeData(data) {
    return {
      f1: data[0], f2: data[1], f3: data[2], f4: data[3],
      b1: data[4], b2: data[5], b3: data[6], b4: data[7],
      duration: data[8], av: data[9], af: data[10], voiced: data[11]
    };
  }

  // English text to phonemes
  function englishToPhonemes(text) {
    const phonemes = [];
    const words = text.toLowerCase().split(/(\s+|[.,!?;:]+)/).filter(Boolean);

    for (const word of words) {
      if (/^[.,!?;:]+$/.test(word)) {
        const p = '.!?'.includes(word[0]) ? 'PAU' : 'SIL';
        phonemes.push({ phoneme: p, ...parsePhonemeData(ENGLISH_PHONEMES[p]) });
        continue;
      }
      if (/^\s+$/.test(word)) {
        phonemes.push({ phoneme: 'SIL', ...parsePhonemeData(ENGLISH_PHONEMES['SIL']) });
        continue;
      }

      // Dictionary lookup or rule-based
      const wordPhonemes = ENGLISH_DICTIONARY[word] || convertEnglishWord(word);
      for (const p of wordPhonemes) {
        if (ENGLISH_PHONEMES[p]) {
          phonemes.push({ phoneme: p, ...parsePhonemeData(ENGLISH_PHONEMES[p]) });
        }
      }
      phonemes.push({ phoneme: 'SIL', ...parsePhonemeData(ENGLISH_PHONEMES['SIL']) });
    }

    if (phonemes.length && phonemes[phonemes.length - 1].phoneme !== 'PAU') {
      phonemes.push({ phoneme: 'PAU', ...parsePhonemeData(ENGLISH_PHONEMES['PAU']) });
    }

    return phonemes;
  }

  // Simple English word to phoneme conversion
  function convertEnglishWord(word) {
    const result = [];
    const digraphs = {
      'th': 'TH', 'sh': 'SH', 'ch': 'CH', 'wh': 'W', 'ph': 'F',
      'ng': 'NG', 'ck': 'K', 'ee': 'IY', 'ea': 'IY', 'oo': 'UW',
      'ou': 'AW', 'ow': 'OW', 'oi': 'OY', 'oy': 'OY', 'ai': 'EY',
      'ay': 'EY', 'ie': 'IY', 'ey': 'IY',
    };
    const letters = {
      'a': 'AE', 'b': 'B', 'c': 'K', 'd': 'D', 'e': 'EH',
      'f': 'F', 'g': 'G', 'h': 'HH', 'i': 'IH', 'j': 'JH',
      'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'o': 'AA',
      'p': 'P', 'q': 'K', 'r': 'R', 's': 'S', 't': 'T',
      'u': 'AH', 'v': 'V', 'w': 'W', 'x': 'K', 'y': 'IY', 'z': 'Z'
    };

    let i = 0;
    while (i < word.length) {
      let matched = false;
      for (let len = 3; len >= 2; len--) {
        const sub = word.substr(i, len);
        if (digraphs[sub]) {
          result.push(digraphs[sub]);
          i += len;
          matched = true;
          break;
        }
      }
      if (!matched) {
        const letter = word[i];
        if (letters[letter]) {
          result.push(letters[letter]);
        }
        i++;
      }
    }
    return result;
  }

  // English dictionary
  const ENGLISH_DICTIONARY = {
    'the': ['DH', 'AX'], 'a': ['AX'], 'an': ['AE', 'N'],
    'and': ['AE', 'N', 'D'], 'or': ['AO', 'R'], 'but': ['B', 'AH', 'T'],
    'to': ['T', 'UW'], 'of': ['AH', 'V'], 'in': ['IH', 'N'],
    'is': ['IH', 'Z'], 'it': ['IH', 'T'], 'you': ['Y', 'UW'],
    'hello': ['HH', 'EH', 'L', 'OW'],
    'welcome': ['W', 'EH', 'L', 'K', 'AH', 'M'],
    'aperture': ['AE', 'P', 'ER', 'CH', 'ER'],
    'science': ['S', 'AY', 'AX', 'N', 'S'],
    'enrichment': ['EH', 'N', 'R', 'IH', 'CH', 'M', 'AX', 'N', 'T'],
    'center': ['S', 'EH', 'N', 'T', 'ER'],
    'testing': ['T', 'EH', 'S', 'T', 'IH', 'NG'],
    'test': ['T', 'EH', 'S', 'T'],
    'cake': ['K', 'EY', 'K'],
    'lie': ['L', 'AY'],
    'error': ['EH', 'R', 'ER'],
    'please': ['P', 'L', 'IY', 'Z'],
    'thank': ['TH', 'AE', 'NG', 'K'],
    'i': ['AY'],
    "i'm": ['AY', 'M'],
    'im': ['AY', 'M'],
    'this': ['DH', 'IH', 'S'],
    'was': ['W', 'AA', 'Z'],
    'triumph': ['T', 'R', 'AY', 'AH', 'M', 'F'],
    'making': ['M', 'EY', 'K', 'IH', 'NG'],
    'note': ['N', 'OW', 'T'],
    'here': ['HH', 'IY', 'R'],
    'huge': ['HH', 'Y', 'UW', 'JH'],
    'success': ['S', 'AH', 'K', 'S', 'EH', 'S'],
    'doing': ['D', 'UW', 'IH', 'NG'],
    'still': ['S', 'T', 'IH', 'L'],
    'alive': ['AX', 'L', 'AY', 'V'],
    'good': ['G', 'UH', 'D'],
    'morning': ['M', 'AO', 'R', 'N', 'IH', 'NG'],
    'have': ['HH', 'AE', 'V'],
    'been': ['B', 'IH', 'N'],
    'suspension': ['S', 'AH', 'S', 'P', 'EH', 'N', 'SH', 'AX', 'N'],
    'fifty': ['F', 'IH', 'F', 'T', 'IY'],
    'days': ['D', 'EY', 'Z'],
    'proceed': ['P', 'R', 'OW', 'S', 'IY', 'D'],
    'chamber': ['CH', 'EY', 'M', 'B', 'ER'],
  };

  // Main text to phonemes function
  function textToPhonemes(text, lang = 'auto') {
    const hasKo = /[\uAC00-\uD7A3]/.test(text);
    const hasEn = /[a-zA-Z]/.test(text);

    if (lang === 'ko' || (hasKo && !hasEn)) {
      return koreanToPhonemes(text);
    }
    if (lang === 'en' || (hasEn && !hasKo)) {
      return englishToPhonemes(text);
    }

    // Mixed - split by language
    const result = [];
    let buffer = '';
    let bufferLang = null;

    for (const char of text) {
      const isKo = isHangul(char);
      const isEn = /[a-zA-Z]/.test(char);
      const isPunct = /[\s.,!?;:]/.test(char);

      if (isPunct) {
        buffer += char;
      } else if (isKo) {
        if (bufferLang === 'en' && buffer) {
          result.push(...englishToPhonemes(buffer));
          buffer = '';
        }
        buffer += char;
        bufferLang = 'ko';
      } else if (isEn) {
        if (bufferLang === 'ko' && buffer) {
          result.push(...koreanToPhonemes(buffer));
          buffer = '';
        }
        buffer += char;
        bufferLang = 'en';
      }
    }

    if (buffer) {
      if (bufferLang === 'ko') {
        result.push(...koreanToPhonemes(buffer));
      } else {
        result.push(...englishToPhonemes(buffer));
      }
    }

    return result;
  }

  // ============================================================================
  // Synthesis Engine
  // ============================================================================

  class Resonator {
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
      this.a1 = 0; this.a2 = 0; this.b0 = 1;
      this.y1 = 0; this.y2 = 0;
    }

    setFormant(freq, bandwidth) {
      if (freq <= 0 || freq >= this.sampleRate / 2) {
        this.b0 = 1; this.a1 = 0; this.a2 = 0;
        return;
      }
      const T = 1 / this.sampleRate;
      const r = Math.exp(-Math.PI * bandwidth * T);
      const theta = TWO_PI * freq * T;
      this.a2 = -r * r;
      this.a1 = 2 * r * Math.cos(theta);
      this.b0 = 1 - r;
    }

    process(x) {
      const y = this.b0 * x + this.a1 * this.y1 + this.a2 * this.y2;
      this.y2 = this.y1;
      this.y1 = y;
      return y;
    }

    reset() {
      this.y1 = 0; this.y2 = 0;
    }
  }

  class GlottalSource {
    constructor(sampleRate) {
      this.sampleRate = sampleRate;
      this.phase = 0;
      this.period = 0;
      this.lastOutput = 0;
    }

    setF0(f0) {
      this.period = f0 > 0 ? this.sampleRate / f0 : 0;
    }

    generate(jitter = 0) {
      if (this.period <= 0) return 0;

      // Add jitter
      const actualPeriod = this.period * (1 + (Math.random() - 0.5) * jitter);
      const t = this.phase / actualPeriod;

      // LF model
      const Oq = 0.5;
      const Tp = Oq * 0.8;
      let output;

      if (t < Tp) {
        output = 0.5 * (1 - Math.cos(Math.PI * t / Tp));
      } else if (t < Oq) {
        output = Math.cos(0.5 * Math.PI * (t - Tp) / (Oq - Tp));
      } else {
        output = -0.15 * Math.exp(-5 * (t - Oq) / (1 - Oq));
      }

      const diff = output - this.lastOutput;
      this.lastOutput = output;

      this.phase++;
      if (this.phase >= actualPeriod) {
        this.phase -= actualPeriod;
      }

      return diff * 8;
    }

    reset() {
      this.phase = 0;
      this.lastOutput = 0;
    }
  }

  class NoiseSource {
    constructor() {
      this.state = [0, 0, 0];
    }

    white() {
      return Math.random() * 2 - 1;
    }

    pink() {
      const w = this.white();
      this.state[0] = 0.99886 * this.state[0] + w * 0.0555179;
      this.state[1] = 0.99332 * this.state[1] + w * 0.0750759;
      this.state[2] = 0.96900 * this.state[2] + w * 0.1538520;
      return (this.state[0] + this.state[1] + this.state[2] + w * 0.5362) * 0.2;
    }
  }

  class KlattSynthesizer {
    constructor(sampleRate = SAMPLE_RATE) {
      this.sampleRate = sampleRate;
      this.samplesPerFrame = Math.floor(sampleRate * FRAME_MS / 1000);

      this.glottal = new GlottalSource(sampleRate);
      this.noise = new NoiseSource();

      this.r1 = new Resonator(sampleRate);
      this.r2 = new Resonator(sampleRate);
      this.r3 = new Resonator(sampleRate);
      this.r4 = new Resonator(sampleRate);

      this.n1 = new Resonator(sampleRate);
      this.n2 = new Resonator(sampleRate);
      this.n3 = new Resonator(sampleRate);

      this.radiationPrev = 0;
    }

    synthesize(phonemes, voice) {
      const samples = [];
      const totalDuration = phonemes.reduce((sum, p) => sum + p.duration, 0);
      let elapsed = 0;

      for (let i = 0; i < phonemes.length; i++) {
        const curr = phonemes[i];
        const next = phonemes[i + 1];
        const prev = phonemes[i - 1];

        const numFrames = Math.max(1, Math.ceil(curr.duration / FRAME_MS));

        for (let f = 0; f < numFrames; f++) {
          const framePos = f / numFrames;
          const globalPos = elapsed / totalDuration;

          // Interpolate formants
          const params = this.interpolate(curr, next, prev, framePos);

          // Calculate pitch
          const f0 = this.calcPitch(voice, globalPos, params.voiced);

          // Synthesize frame
          const frameSamples = this.synthFrame(params, f0, voice);
          samples.push(...frameSamples);

          elapsed += FRAME_MS;
        }
      }

      // Normalize
      const peak = Math.max(...samples.map(Math.abs));
      if (peak > 0) {
        for (let i = 0; i < samples.length; i++) {
          samples[i] = samples[i] / peak * 0.9;
        }
      }

      // Fade in/out
      const fade = Math.min(200, samples.length / 10);
      for (let i = 0; i < fade; i++) {
        samples[i] *= i / fade;
        samples[samples.length - 1 - i] *= i / fade;
      }

      return samples;
    }

    interpolate(curr, next, prev, t) {
      const lerp = (a, b, t) => a + (b - a) * t;
      const smooth = t => t * t * (3 - 2 * t);

      let f1 = curr.f1, f2 = curr.f2, f3 = curr.f3, f4 = curr.f4;
      let b1 = curr.b1, b2 = curr.b2, b3 = curr.b3, b4 = curr.b4;
      let av = curr.av, af = curr.af;

      // Coarticulation
      if (prev && t < 0.25) {
        const blend = smooth(t / 0.25);
        f1 = lerp(prev.f1, curr.f1, blend);
        f2 = lerp(prev.f2, curr.f2, blend);
        f3 = lerp(prev.f3, curr.f3, blend);
        av = lerp(prev.av, curr.av, blend);
        af = lerp(prev.af, curr.af, blend);
      }

      if (next && t > 0.75) {
        const blend = smooth((t - 0.75) / 0.25);
        f1 = lerp(f1, next.f1, blend);
        f2 = lerp(f2, next.f2, blend);
        f3 = lerp(f3, next.f3, blend);
        av = lerp(av, next.av, blend);
        af = lerp(af, next.af, blend);
      }

      return { f1, f2, f3, f4, b1, b2, b3, b4, av, af, voiced: curr.voiced };
    }

    calcPitch(voice, globalPos, voiced) {
      if (!voiced) return 0;

      let f0 = voice.pitch;

      // Declination
      f0 *= 1 - 0.12 * globalPos;

      // Intonation
      if (voice.pitchRange > 0) {
        f0 += Math.sin(globalPos * Math.PI) * voice.pitchRange * 0.5;
      }

      return f0;
    }

    synthFrame(params, f0, voice) {
      const samples = [];

      const shift = voice.formantShift || 1;
      this.r1.setFormant(params.f1 * shift, params.b1);
      this.r2.setFormant(params.f2 * shift, params.b2);
      this.r3.setFormant(params.f3 * shift, params.b3);
      this.r4.setFormant(params.f4 * shift, params.b4);

      this.n1.setFormant(params.f2 * shift, params.b2 * 0.8);
      this.n2.setFormant(params.f3 * shift, params.b3 * 0.8);
      this.n3.setFormant(5000, 300);

      this.glottal.setF0(f0);

      const avAmp = params.av > 0 ? Math.pow(10, (params.av - 60) / 20) : 0;
      const afAmp = params.af > 0 ? Math.pow(10, (params.af - 60) / 20) : 0;
      const breath = (voice.breathiness || 0) * 0.2;

      for (let i = 0; i < this.samplesPerFrame; i++) {
        let voiceSrc = 0;
        if (params.voiced && avAmp > 0) {
          voiceSrc = this.glottal.generate(voice.jitter || 0) * avAmp;
          voiceSrc += this.noise.pink() * breath;
        }

        // Cascade
        let cascade = voiceSrc;
        if (cascade !== 0) {
          cascade = this.r1.process(cascade);
          cascade = this.r2.process(cascade);
          cascade = this.r3.process(cascade);
          cascade = this.r4.process(cascade);
        }

        // Parallel (noise)
        let parallel = 0;
        if (afAmp > 0) {
          const noise = this.noise.white() * afAmp;
          parallel += this.n1.process(noise) * 0.5;
          parallel += this.n2.process(noise) * 0.7;
          parallel += this.n3.process(noise) * 0.3;
        }

        let output = cascade + parallel;

        // Radiation
        const radiated = output - this.radiationPrev;
        this.radiationPrev = output * 0.98;

        samples.push(radiated);
      }

      return samples;
    }

    reset() {
      this.glottal.reset();
      this.r1.reset(); this.r2.reset(); this.r3.reset(); this.r4.reset();
      this.n1.reset(); this.n2.reset(); this.n3.reset();
      this.radiationPrev = 0;
    }
  }

  // ============================================================================
  // Simple Robotization (without slow FFT)
  // ============================================================================

  function robotize(samples, amount, sampleRate) {
    if (amount <= 0) return samples;

    // Simple ring modulation for robotic effect
    const modFreq = 30; // Hz
    const result = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      const t = i / sampleRate;
      const mod = 1 - amount * 0.5 * (1 - Math.cos(TWO_PI * modFreq * t));
      result[i] = samples[i] * mod;
    }

    // Add subtle pitch flattening by averaging nearby samples
    if (amount > 0.3) {
      const windowSize = Math.floor(sampleRate / 200);
      for (let i = windowSize; i < samples.length - windowSize; i++) {
        let sum = 0;
        for (let j = -windowSize; j <= windowSize; j++) {
          sum += result[i + j];
        }
        result[i] = result[i] * (1 - amount * 0.3) + (sum / (windowSize * 2 + 1)) * amount * 0.3;
      }
    }

    return result;
  }

  // ============================================================================
  // Voice Presets
  // ============================================================================

  const Voice = {
    default: {
      name: 'default',
      pitch: 130,
      pitchRange: 20,
      speed: 1.0,
      formantShift: 1.0,
      breathiness: 0.05,
      jitter: 0.02,
      robotize: 0,
      reverb: 0.1,
    },

    male: {
      name: 'male',
      pitch: 110,
      pitchRange: 15,
      speed: 1.0,
      formantShift: 0.92,
      breathiness: 0.03,
      jitter: 0.02,
      robotize: 0,
      reverb: 0.1,
    },

    female: {
      name: 'female',
      pitch: 210,
      pitchRange: 30,
      speed: 1.0,
      formantShift: 1.12,
      breathiness: 0.08,
      jitter: 0.015,
      robotize: 0,
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
      robotize: 0.7,
      reverb: 0.2,
    },

    glados: {
      name: 'glados',
      pitch: 175,
      pitchRange: 6,
      speed: 0.88,
      formantShift: 1.15,
      breathiness: 0,
      jitter: 0,
      robotize: 0.35,
      reverb: 0.25,
      ringMod: 0.08,
    },

    gladosAngry: {
      name: 'gladosAngry',
      pitch: 165,
      pitchRange: 12,
      speed: 0.82,
      formantShift: 1.18,
      breathiness: 0,
      jitter: 0.01,
      robotize: 0.45,
      reverb: 0.2,
      ringMod: 0.12,
    },

    // Korean natural voice
    korean: {
      name: 'korean',
      pitch: 180,
      pitchRange: 25,
      speed: 1.0,
      formantShift: 1.05,
      breathiness: 0.04,
      jitter: 0.015,
      robotize: 0,
      reverb: 0.12,
    },

    // Korean GLaDOS style
    koreanGlados: {
      name: 'koreanGlados',
      pitch: 180,
      pitchRange: 5,
      speed: 0.9,
      formantShift: 1.12,
      breathiness: 0,
      jitter: 0,
      robotize: 0.3,
      reverb: 0.2,
      ringMod: 0.06,
    },
  };

  // ============================================================================
  // Effects Chain
  // ============================================================================

  class EffectsChain {
    constructor(audioContext) {
      this.ctx = audioContext;
    }

    createReverb(decay = 1.5, wet = 0.3) {
      const length = this.ctx.sampleRate * decay;
      const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate);

      for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-4 * i / length);
        }
      }

      const conv = this.ctx.createConvolver();
      conv.buffer = impulse;

      const dry = this.ctx.createGain();
      const wetGain = this.ctx.createGain();
      dry.gain.value = 1 - wet;
      wetGain.gain.value = wet;

      const input = this.ctx.createGain();
      const output = this.ctx.createGain();

      input.connect(dry);
      input.connect(conv);
      conv.connect(wetGain);
      dry.connect(output);
      wetGain.connect(output);

      return { input, output };
    }

    createCompressor() {
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -20;
      comp.knee.value = 10;
      comp.ratio.value = 6;
      comp.attack.value = 0.005;
      comp.release.value = 0.1;
      return comp;
    }

    build(voice) {
      const nodes = [];

      const comp = this.createCompressor();
      nodes.push({ input: comp, output: comp });

      if (voice.reverb > 0) {
        nodes.push(this.createReverb(1.2, voice.reverb));
      }

      return nodes;
    }

    connect(source, dest, chain) {
      if (!chain.length) {
        source.connect(dest);
        return;
      }

      source.connect(chain[0].input);
      for (let i = 0; i < chain.length - 1; i++) {
        chain[i].output.connect(chain[i + 1].input);
      }
      chain[chain.length - 1].output.connect(dest);
    }
  }

  // ============================================================================
  // Main TTS Engine
  // ============================================================================

  class SimiTTS {
    constructor(options = {}) {
      this.voice = { ...Voice.default, ...(options.voice || {}) };
      this.sampleRate = options.sampleRate || SAMPLE_RATE;
      this.synth = new KlattSynthesizer(this.sampleRate);
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

    synthesize(text, lang = 'auto') {
      const phonemes = textToPhonemes(text, lang);

      // Adjust duration by speed
      const adjusted = phonemes.map(p => ({
        ...p,
        duration: Math.round(p.duration / this.voice.speed)
      }));

      let samples = this.synth.synthesize(adjusted, this.voice);

      // Apply robotization
      if (this.voice.robotize > 0) {
        samples = Array.from(robotize(new Float32Array(samples), this.voice.robotize, this.sampleRate));
      }

      return samples;
    }

    async speak(text, onProgress, lang = 'auto') {
      await this.init();

      const samples = this.synthesize(text, lang);
      const buffer = this.audioContext.createBuffer(1, samples.length, this.sampleRate);
      buffer.getChannelData(0).set(samples);

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      const chain = this.effects.build(this.voice);
      this.effects.connect(source, this.audioContext.destination, chain);

      return new Promise(resolve => {
        source.onended = resolve;
        source.start();

        if (onProgress) {
          const duration = samples.length / this.sampleRate;
          const start = this.audioContext.currentTime;
          const update = () => {
            const progress = Math.min(1, (this.audioContext.currentTime - start) / duration);
            onProgress(progress);
            if (progress < 1) requestAnimationFrame(update);
          };
          requestAnimationFrame(update);
        }
      });
    }

    toWav(text, lang = 'auto') {
      const samples = this.synthesize(text, lang);
      return this.encodeWav(samples);
    }

    download(text, filename = 'speech.wav', lang = 'auto') {
      const wav = this.toWav(text, lang);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    encodeWav(samples) {
      const numCh = 1;
      const bps = 16;
      const byteRate = this.sampleRate * numCh * 2;
      const dataSize = samples.length * 2;
      const bufSize = 44 + dataSize;

      const buf = new ArrayBuffer(bufSize);
      const view = new DataView(buf);

      const writeStr = (off, str) => {
        for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
      };

      writeStr(0, 'RIFF');
      view.setUint32(4, bufSize - 8, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numCh, true);
      view.setUint32(24, this.sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, numCh * 2, true);
      view.setUint16(34, bps, true);
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);

      let off = 44;
      for (const s of samples) {
        view.setInt16(off, Math.max(-1, Math.min(1, s)) * 32767, true);
        off += 2;
      }

      return buf;
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
    englishToPhonemes,
    isHangul,
    decomposeHangul,
    applyPhonologicalRules,
    KOREAN_PHONEMES,
    ENGLISH_PHONEMES,
    KlattSynthesizer,
    version: '3.0.0'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SimiTTSLib;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return SimiTTSLib; });
  } else {
    global.SimiTTS = SimiTTSLib;
  }

})(typeof self !== 'undefined' ? self : this);
