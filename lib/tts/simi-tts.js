/**
 * Simi TTS v3.1 - Korean + English Formant Synthesizer
 * @version 3.1.0
 * @license MIT
 */
(function(global) {
  'use strict';

  const SAMPLE_RATE = 22050;
  const FRAME_MS = 10;
  const TWO_PI = Math.PI * 2;

  // ============================================================================
  // Phoneme Data [f1, f2, f3, bw1, bw2, bw3, dur, amp, voiced]
  // ============================================================================

  const PH = {
    // Vowels
    'AA': [730, 1100, 2450, 80, 90, 120, 100, 1, true],   // father
    'AE': [660, 1720, 2410, 70, 100, 130, 100, 1, true],  // cat
    'AH': [640, 1200, 2400, 70, 90, 120, 80, 1, true],    // but
    'AO': [570, 840, 2400, 70, 80, 120, 100, 1, true],    // caught
    'AW': [730, 1100, 2450, 70, 90, 120, 140, 1, true],   // how
    'AX': [500, 1500, 2500, 60, 90, 120, 50, 0.8, true],  // about
    'AY': [730, 1100, 2450, 70, 90, 120, 140, 1, true],   // my
    'EH': [530, 1850, 2500, 60, 90, 120, 80, 1, true],    // bed
    'ER': [500, 1350, 1700, 60, 90, 140, 100, 0.9, true], // bird
    'EY': [450, 2100, 2700, 50, 80, 110, 120, 1, true],   // say
    'IH': [400, 2000, 2550, 55, 80, 110, 80, 1, true],    // bit
    'IY': [280, 2300, 3000, 50, 70, 100, 100, 1, true],   // beat
    'OW': [450, 800, 2830, 60, 80, 110, 120, 1, true],    // go
    'OY': [500, 700, 2600, 60, 80, 110, 140, 1, true],    // boy
    'UH': [440, 1000, 2250, 60, 80, 110, 80, 1, true],    // book
    'UW': [310, 870, 2250, 50, 70, 100, 100, 1, true],    // boot

    // Consonants - Stops
    'B': [200, 1100, 2200, 60, 90, 140, 60, 0.6, true],
    'D': [200, 1700, 2600, 60, 90, 140, 50, 0.6, true],
    'G': [200, 2000, 2800, 60, 90, 140, 60, 0.6, true],
    'P': [200, 1100, 2200, 100, 140, 180, 80, 0, false],
    'T': [200, 1700, 2600, 100, 140, 180, 70, 0, false],
    'K': [200, 2000, 2800, 100, 140, 180, 80, 0, false],

    // Consonants - Fricatives
    'F': [220, 900, 2100, 140, 180, 220, 85, 0, false],
    'V': [220, 1100, 2100, 60, 90, 140, 70, 0.5, true],
    'TH': [200, 1400, 2600, 140, 180, 220, 75, 0, false],
    'DH': [220, 1600, 2600, 60, 90, 140, 45, 0.5, true],
    'S': [200, 1700, 2600, 140, 180, 220, 95, 0, false],
    'Z': [200, 1700, 2600, 60, 90, 140, 75, 0.5, true],
    'SH': [200, 1900, 2600, 140, 180, 220, 95, 0, false],
    'ZH': [200, 2000, 2500, 60, 90, 140, 75, 0.5, true],
    'HH': [500, 1500, 2500, 180, 220, 260, 50, 0, false],

    // Consonants - Affricates
    'CH': [200, 1900, 2600, 140, 180, 220, 100, 0, false],
    'JH': [200, 1900, 2500, 60, 90, 140, 85, 0.5, true],

    // Consonants - Nasals
    'M': [280, 950, 2250, 50, 80, 180, 65, 0.7, true],
    'N': [280, 1700, 2600, 50, 80, 180, 65, 0.7, true],
    'NG': [280, 2300, 2800, 50, 80, 180, 65, 0.7, true],

    // Consonants - Liquids
    'L': [360, 1050, 2900, 50, 100, 140, 65, 0.7, true],
    'R': [340, 1100, 1450, 50, 100, 140, 65, 0.6, true],

    // Consonants - Glides
    'W': [320, 650, 2250, 50, 80, 110, 50, 0.7, true],
    'Y': [290, 2200, 2950, 50, 80, 110, 50, 0.7, true],

    // Special
    'SIL': [0, 0, 0, 100, 100, 100, 50, 0, false],
    'PAU': [0, 0, 0, 100, 100, 100, 200, 0, false],

    // === Korean Vowels ===
    'ㅏ': [800, 1300, 2600, 80, 90, 120, 110, 1, true],
    'ㅓ': [600, 1000, 2550, 70, 85, 120, 110, 1, true],
    'ㅗ': [450, 850, 2500, 60, 80, 120, 110, 1, true],
    'ㅜ': [350, 850, 2400, 55, 80, 120, 110, 1, true],
    'ㅡ': [400, 1500, 2500, 60, 90, 120, 110, 0.95, true],
    'ㅣ': [300, 2300, 3100, 50, 80, 110, 100, 1, true],
    'ㅐ': [580, 1900, 2650, 70, 90, 120, 100, 1, true],
    'ㅔ': [500, 1950, 2700, 65, 85, 120, 100, 1, true],
    'ㅚ': [450, 1700, 2500, 60, 85, 120, 110, 1, true],
    'ㅟ': [320, 1900, 2600, 55, 80, 110, 100, 1, true],

    // Korean Diphthongs (treated as two-part)
    'ㅑ': [300, 2200, 3000, 50, 80, 110, 130, 1, true],
    'ㅕ': [300, 2200, 3000, 50, 80, 110, 130, 1, true],
    'ㅛ': [300, 2200, 3000, 50, 80, 110, 130, 1, true],
    'ㅠ': [300, 2200, 3000, 50, 80, 110, 130, 1, true],
    'ㅖ': [300, 2200, 3000, 50, 80, 110, 120, 1, true],
    'ㅒ': [300, 2200, 3000, 50, 80, 110, 120, 1, true],
    'ㅘ': [400, 900, 2450, 60, 85, 120, 140, 1, true],
    'ㅝ': [400, 950, 2500, 60, 85, 120, 140, 1, true],
    'ㅙ': [450, 1100, 2550, 65, 90, 120, 130, 1, true],
    'ㅞ': [420, 1200, 2600, 60, 85, 120, 130, 1, true],
    'ㅢ': [380, 1600, 2700, 60, 90, 120, 140, 0.95, true],

    // === Korean Consonants ===
    // Plain (Lenis)
    'ㄱ': [200, 2000, 2700, 60, 100, 140, 30, 0.6, true],
    'ㄴ': [300, 1600, 2600, 50, 80, 160, 60, 0.7, true],
    'ㄷ': [200, 1700, 2700, 60, 100, 140, 30, 0.6, true],
    'ㄹ': [350, 1400, 2500, 55, 100, 140, 50, 0.7, true],
    'ㅁ': [280, 900, 2400, 50, 80, 160, 60, 0.7, true],
    'ㅂ': [200, 800, 2400, 60, 100, 140, 30, 0.6, true],
    'ㅅ': [200, 1800, 2700, 130, 180, 220, 90, 0, false],
    'ㅇ': [280, 2300, 2900, 50, 80, 160, 60, 0.7, true],
    'ㅈ': [200, 2200, 2900, 80, 120, 160, 80, 0.4, true],
    'ㅎ': [500, 1500, 2500, 160, 200, 240, 55, 0, false],

    // Tense (Fortis)
    'ㄲ': [200, 2000, 2700, 60, 100, 140, 70, 0, false],
    'ㄸ': [200, 1700, 2700, 60, 100, 140, 70, 0, false],
    'ㅃ': [200, 800, 2400, 60, 100, 140, 70, 0, false],
    'ㅆ': [200, 1800, 2700, 130, 180, 220, 100, 0, false],
    'ㅉ': [200, 2200, 2900, 80, 120, 160, 90, 0, false],

    // Aspirated
    'ㅋ': [200, 2000, 2700, 100, 140, 180, 90, 0, false],
    'ㅌ': [200, 1700, 2700, 100, 140, 180, 90, 0, false],
    'ㅍ': [200, 800, 2400, 100, 140, 180, 90, 0, false],
    'ㅊ': [200, 2200, 2900, 100, 140, 180, 100, 0, false],
  };

  // ============================================================================
  // Hangul Processing
  // ============================================================================

  const HANGUL_START = 0xAC00;
  const HANGUL_END = 0xD7A3;
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const JONG = '\0ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ';

  // Coda simplification
  const CODA_MAP = {
    'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ', 'ㄳ': 'ㄱ', 'ㄺ': 'ㄱ',
    'ㄴ': 'ㄴ', 'ㄵ': 'ㄴ', 'ㄶ': 'ㄴ',
    'ㄷ': 'ㄷ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅌ': 'ㄷ', 'ㅎ': 'ㄷ',
    'ㄹ': 'ㄹ', 'ㄻ': 'ㅁ', 'ㄼ': 'ㄹ', 'ㄽ': 'ㄹ', 'ㄾ': 'ㄹ', 'ㄿ': 'ㅂ', 'ㅀ': 'ㄹ',
    'ㅁ': 'ㅁ',
    'ㅂ': 'ㅂ', 'ㅍ': 'ㅂ', 'ㅄ': 'ㅂ',
    'ㅇ': 'ㅇ',
  };

  function isHangul(ch) {
    const c = ch.charCodeAt(0);
    return c >= HANGUL_START && c <= HANGUL_END;
  }

  function decomposeHangul(ch) {
    const c = ch.charCodeAt(0) - HANGUL_START;
    return {
      cho: CHO[Math.floor(c / 588)],
      jung: JUNG[Math.floor((c % 588) / 28)],
      jong: c % 28 === 0 ? null : JONG[c % 28]
    };
  }

  // ============================================================================
  // Text to Phonemes
  // ============================================================================

  function textToPhonemes(text, lang) {
    const hasKo = /[\uAC00-\uD7A3]/.test(text);
    const hasEn = /[a-zA-Z]/.test(text);

    if (lang === 'ko' || (hasKo && !hasEn)) return koreanToPhonemes(text);
    if (lang === 'en' || (hasEn && !hasKo)) return englishToPhonemes(text);
    return mixedToPhonemes(text);
  }

  function koreanToPhonemes(text) {
    const result = [];

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (isHangul(ch)) {
        const { cho, jung, jong } = decomposeHangul(ch);

        // 초성 (initial)
        if (cho !== 'ㅇ' && PH[cho]) {
          result.push(makePh(cho));
        }

        // 중성 (vowel)
        if (PH[jung]) {
          result.push(makePh(jung));
        }

        // 종성 (final)
        if (jong) {
          const simplified = CODA_MAP[jong] || jong;
          if (PH[simplified]) {
            const ph = makePh(simplified);
            ph.dur = Math.round(ph.dur * 0.5);
            result.push(ph);
          }
        }
      } else if (ch === ' ') {
        result.push(makePh('SIL'));
      } else if (/[.!?]/.test(ch)) {
        result.push(makePh('PAU'));
      } else if (/[,;:]/.test(ch)) {
        result.push(makePh('SIL'));
      }
    }

    if (result.length === 0 || result[result.length - 1].phoneme !== 'PAU') {
      result.push(makePh('PAU'));
    }

    return result;
  }

  function englishToPhonemes(text) {
    const result = [];
    const words = text.toLowerCase().split(/(\s+|[.,!?;:]+)/).filter(Boolean);

    for (const w of words) {
      if (/^[.,!?;:]+$/.test(w)) {
        result.push(makePh('.!?'.includes(w[0]) ? 'PAU' : 'SIL'));
        continue;
      }
      if (/^\s+$/.test(w)) {
        result.push(makePh('SIL'));
        continue;
      }

      const phs = DICT[w] || letterToPhoneme(w);
      for (const p of phs) {
        if (PH[p]) result.push(makePh(p));
      }
      result.push(makePh('SIL'));
    }

    if (result.length === 0 || result[result.length - 1].phoneme !== 'PAU') {
      result.push(makePh('PAU'));
    }

    return result;
  }

  function mixedToPhonemes(text) {
    const result = [];
    let buf = '', bufKo = null;

    for (const ch of text) {
      const ko = isHangul(ch);
      const en = /[a-zA-Z]/.test(ch);
      const punc = /[\s.,!?;:]/.test(ch);

      if (punc) {
        buf += ch;
      } else if (ko) {
        if (bufKo === false && buf) {
          result.push(...englishToPhonemes(buf));
          buf = '';
        }
        buf += ch;
        bufKo = true;
      } else if (en) {
        if (bufKo === true && buf) {
          result.push(...koreanToPhonemes(buf));
          buf = '';
        }
        buf += ch;
        bufKo = false;
      }
    }

    if (buf) {
      result.push(...(bufKo ? koreanToPhonemes(buf) : englishToPhonemes(buf)));
    }

    return result;
  }

  function makePh(name) {
    const d = PH[name] || PH['SIL'];
    return {
      phoneme: name,
      f1: d[0], f2: d[1], f3: d[2],
      b1: d[3], b2: d[4], b3: d[5],
      dur: d[6], amp: d[7], voiced: d[8]
    };
  }

  function letterToPhoneme(word) {
    const DI = {
      'th': 'TH', 'sh': 'SH', 'ch': 'CH', 'wh': 'W', 'ph': 'F',
      'ng': 'NG', 'ck': 'K', 'ee': 'IY', 'ea': 'IY', 'oo': 'UW',
      'ou': 'AW', 'ow': 'OW', 'oi': 'OY', 'oy': 'OY', 'ai': 'EY', 'ay': 'EY'
    };
    const LT = {
      'a': 'AE', 'b': 'B', 'c': 'K', 'd': 'D', 'e': 'EH',
      'f': 'F', 'g': 'G', 'h': 'HH', 'i': 'IH', 'j': 'JH',
      'k': 'K', 'l': 'L', 'm': 'M', 'n': 'N', 'o': 'AA',
      'p': 'P', 'q': 'K', 'r': 'R', 's': 'S', 't': 'T',
      'u': 'AH', 'v': 'V', 'w': 'W', 'x': 'K', 'y': 'IY', 'z': 'Z'
    };

    const result = [];
    let i = 0;
    while (i < word.length) {
      let found = false;
      for (let len = 2; len >= 2; len--) {
        const sub = word.substr(i, len);
        if (DI[sub]) {
          result.push(DI[sub]);
          i += len;
          found = true;
          break;
        }
      }
      if (!found) {
        if (LT[word[i]]) result.push(LT[word[i]]);
        i++;
      }
    }
    return result;
  }

  const DICT = {
    'the': ['DH', 'AX'], 'a': ['AX'], 'an': ['AE', 'N'],
    'and': ['AE', 'N', 'D'], 'or': ['AO', 'R'], 'to': ['T', 'UW'],
    'of': ['AH', 'V'], 'in': ['IH', 'N'], 'is': ['IH', 'Z'],
    'it': ['IH', 'T'], 'you': ['Y', 'UW'], 'i': ['AY'],
    "i'm": ['AY', 'M'], 'im': ['AY', 'M'],
    'hello': ['HH', 'EH', 'L', 'OW'],
    'welcome': ['W', 'EH', 'L', 'K', 'AH', 'M'],
    'aperture': ['AE', 'P', 'ER', 'CH', 'ER'],
    'science': ['S', 'AY', 'AH', 'N', 'S'],
    'enrichment': ['EH', 'N', 'R', 'IH', 'CH', 'M', 'AH', 'N', 'T'],
    'center': ['S', 'EH', 'N', 'T', 'ER'],
    'testing': ['T', 'EH', 'S', 'T', 'IH', 'NG'],
    'test': ['T', 'EH', 'S', 'T'],
    'cake': ['K', 'EY', 'K'],
    'lie': ['L', 'AY'],
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
    'alive': ['AH', 'L', 'AY', 'V'],
    'good': ['G', 'UH', 'D'],
    'morning': ['M', 'AO', 'R', 'N', 'IH', 'NG'],
    'error': ['EH', 'R', 'ER'],
    'please': ['P', 'L', 'IY', 'Z'],
  };

  // ============================================================================
  // Synthesizer
  // ============================================================================

  class Resonator {
    constructor(sr) {
      this.sr = sr;
      this.y1 = 0; this.y2 = 0;
      this.a1 = 0; this.a2 = 0; this.b0 = 1;
    }

    set(freq, bw) {
      if (freq <= 0 || freq >= this.sr / 2) {
        this.b0 = 1; this.a1 = 0; this.a2 = 0;
        return;
      }
      const r = Math.exp(-Math.PI * bw / this.sr);
      const theta = TWO_PI * freq / this.sr;
      this.a2 = -r * r;
      this.a1 = 2 * r * Math.cos(theta);
      this.b0 = 1 - r;
    }

    tick(x) {
      const y = this.b0 * x + this.a1 * this.y1 + this.a2 * this.y2;
      this.y2 = this.y1;
      this.y1 = y;
      return y;
    }

    reset() { this.y1 = 0; this.y2 = 0; }
  }

  class Synth {
    constructor(sr = SAMPLE_RATE) {
      this.sr = sr;
      this.frameLen = Math.floor(sr * FRAME_MS / 1000);
      this.r1 = new Resonator(sr);
      this.r2 = new Resonator(sr);
      this.r3 = new Resonator(sr);
      this.phase = 0;
      this.lastGlot = 0;
    }

    synth(phonemes, voice) {
      const out = [];
      const total = phonemes.reduce((s, p) => s + p.dur, 0);
      let pos = 0;

      for (let i = 0; i < phonemes.length; i++) {
        const cur = phonemes[i];
        const nxt = phonemes[i + 1];
        const prv = phonemes[i - 1];
        const frames = Math.max(1, Math.ceil(cur.dur / FRAME_MS));

        for (let f = 0; f < frames; f++) {
          const t = f / frames;
          const gpos = pos / total;

          // Interpolate
          const p = this.interp(cur, nxt, prv, t);

          // Pitch
          const f0 = p.voiced ? voice.pitch * (1 - 0.1 * gpos) : 0;

          // Generate frame
          out.push(...this.frame(p, f0, voice));
          pos += FRAME_MS;
        }
      }

      // Normalize
      let peak = 0;
      for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
      if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak;

      // Fade
      const fade = Math.min(100, out.length / 10);
      for (let i = 0; i < fade; i++) {
        out[i] *= i / fade;
        out[out.length - 1 - i] *= i / fade;
      }

      return out;
    }

    interp(cur, nxt, prv, t) {
      const lerp = (a, b, t) => a + (b - a) * t;
      const sm = t => t * t * (3 - 2 * t);

      let f1 = cur.f1, f2 = cur.f2, f3 = cur.f3;
      let b1 = cur.b1, b2 = cur.b2, b3 = cur.b3;
      let amp = cur.amp;

      if (prv && t < 0.2) {
        const w = sm(t / 0.2);
        f1 = lerp(prv.f1, f1, w);
        f2 = lerp(prv.f2, f2, w);
        f3 = lerp(prv.f3, f3, w);
        amp = lerp(prv.amp, amp, w);
      }

      if (nxt && t > 0.8) {
        const w = sm((t - 0.8) / 0.2);
        f1 = lerp(f1, nxt.f1, w);
        f2 = lerp(f2, nxt.f2, w);
        f3 = lerp(f3, nxt.f3, w);
        amp = lerp(amp, nxt.amp, w);
      }

      return { f1, f2, f3, b1, b2, b3, amp, voiced: cur.voiced };
    }

    frame(p, f0, voice) {
      const samples = [];
      const fs = voice.formantShift || 1;

      this.r1.set(p.f1 * fs, p.b1);
      this.r2.set(p.f2 * fs, p.b2);
      this.r3.set(p.f3 * fs, p.b3);

      const period = f0 > 0 ? this.sr / f0 : 0;

      for (let i = 0; i < this.frameLen; i++) {
        let src = 0;

        if (p.voiced && period > 0) {
          // Glottal pulse
          const t = this.phase / period;
          let glot;
          if (t < 0.4) {
            glot = 0.5 * (1 - Math.cos(Math.PI * t / 0.4));
          } else if (t < 0.5) {
            glot = Math.cos(Math.PI * (t - 0.4) / 0.2);
          } else {
            glot = -0.1 * Math.exp(-5 * (t - 0.5));
          }
          src = (glot - this.lastGlot) * p.amp;
          this.lastGlot = glot;

          this.phase++;
          if (this.phase >= period) this.phase -= period;

          // Add breath
          src += (Math.random() - 0.5) * (voice.breathiness || 0) * 0.3;
        } else if (!p.voiced && p.amp === 0) {
          // Unvoiced (fricative)
          src = (Math.random() - 0.5) * 0.5;
        }

        // Filter
        let out = this.r1.tick(src);
        out = this.r2.tick(out);
        out = this.r3.tick(out);

        samples.push(out);
      }

      return samples;
    }

    reset() {
      this.r1.reset();
      this.r2.reset();
      this.r3.reset();
      this.phase = 0;
      this.lastGlot = 0;
    }
  }

  // ============================================================================
  // Voice Presets
  // ============================================================================

  const Voice = {
    default: { name: 'default', pitch: 130, formantShift: 1.0, breathiness: 0.05, speed: 1.0, reverb: 0.1 },
    male: { name: 'male', pitch: 100, formantShift: 0.9, breathiness: 0.03, speed: 1.0, reverb: 0.1 },
    female: { name: 'female', pitch: 200, formantShift: 1.15, breathiness: 0.08, speed: 1.0, reverb: 0.15 },
    robot: { name: 'robot', pitch: 100, formantShift: 1.0, breathiness: 0, speed: 0.9, reverb: 0.2, robotize: 0.6 },
    glados: { name: 'glados', pitch: 175, formantShift: 1.15, breathiness: 0, speed: 0.88, reverb: 0.25, robotize: 0.3 },
    korean: { name: 'korean', pitch: 180, formantShift: 1.05, breathiness: 0.04, speed: 1.0, reverb: 0.12 },
    koreanGlados: { name: 'koreanGlados', pitch: 180, formantShift: 1.12, breathiness: 0, speed: 0.9, reverb: 0.2, robotize: 0.25 },
  };

  // ============================================================================
  // Main TTS Class
  // ============================================================================

  class TTS {
    constructor(opts = {}) {
      this.sr = opts.sampleRate || SAMPLE_RATE;
      this.voice = { ...Voice.default, ...(opts.voice || {}) };
      this.synth = new Synth(this.sr);
      this.ctx = null;
    }

    async init() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: this.sr });
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
    }

    setVoice(v) {
      this.voice = typeof v === 'string'
        ? { ...Voice.default, ...(Voice[v] || {}) }
        : { ...Voice.default, ...v };
    }

    synthesize(text, lang) {
      const phs = textToPhonemes(text, lang);

      // Apply speed
      const adjusted = phs.map(p => ({ ...p, dur: Math.round(p.dur / (this.voice.speed || 1)) }));

      let samples = this.synth.synth(adjusted, this.voice);

      // Robotize
      if (this.voice.robotize > 0) {
        const mod = this.voice.robotize;
        for (let i = 0; i < samples.length; i++) {
          const t = i / this.sr;
          samples[i] *= 1 - mod * 0.5 * (1 - Math.cos(TWO_PI * 30 * t));
        }
      }

      return samples;
    }

    async speak(text, onProgress, lang) {
      await this.init();

      const samples = this.synthesize(text, lang);
      const buf = this.ctx.createBuffer(1, samples.length, this.sr);
      buf.getChannelData(0).set(samples);

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      // Reverb
      if (this.voice.reverb > 0) {
        const conv = this.ctx.createConvolver();
        const len = this.sr * 1.2;
        const impulse = this.ctx.createBuffer(2, len, this.sr);
        for (let ch = 0; ch < 2; ch++) {
          const d = impulse.getChannelData(ch);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-4 * i / len);
        }
        conv.buffer = impulse;

        const dry = this.ctx.createGain();
        const wet = this.ctx.createGain();
        dry.gain.value = 1 - this.voice.reverb;
        wet.gain.value = this.voice.reverb;

        src.connect(dry);
        src.connect(conv);
        conv.connect(wet);
        dry.connect(this.ctx.destination);
        wet.connect(this.ctx.destination);
      } else {
        src.connect(this.ctx.destination);
      }

      return new Promise(resolve => {
        src.onended = resolve;
        src.start();

        if (onProgress) {
          const dur = samples.length / this.sr;
          const start = this.ctx.currentTime;
          const update = () => {
            const p = Math.min(1, (this.ctx.currentTime - start) / dur);
            onProgress(p);
            if (p < 1) requestAnimationFrame(update);
          };
          requestAnimationFrame(update);
        }
      });
    }

    toWav(text, lang) {
      const samples = this.synthesize(text, lang);
      const dataLen = samples.length * 2;
      const buf = new ArrayBuffer(44 + dataLen);
      const v = new DataView(buf);

      const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, 'RIFF');
      v.setUint32(4, 36 + dataLen, true);
      ws(8, 'WAVE');
      ws(12, 'fmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 1, true);
      v.setUint32(24, this.sr, true);
      v.setUint32(28, this.sr * 2, true);
      v.setUint16(32, 2, true);
      v.setUint16(34, 16, true);
      ws(36, 'data');
      v.setUint32(40, dataLen, true);

      let o = 44;
      for (const s of samples) {
        v.setInt16(o, Math.max(-1, Math.min(1, s)) * 32767, true);
        o += 2;
      }

      return buf;
    }

    download(text, filename = 'speech.wav', lang) {
      const wav = this.toWav(text, lang);
      const blob = new Blob([wav], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // ============================================================================
  // Export
  // ============================================================================

  const Lib = {
    TTS,
    Voice,
    textToPhonemes,
    koreanToPhonemes,
    englishToPhonemes,
    isHangul,
    decomposeHangul,
    PH,
    Synth,
    version: '3.1.0'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Lib;
  } else {
    global.SimiTTS = Lib;
  }

})(typeof self !== 'undefined' ? self : this);
