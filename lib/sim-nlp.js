/**
 * SimNLP - Natural Language Processing Library
 * @version 1.0.0
 * @license MIT
 *
 * Korean-focused NLP library with Jamo decomposition.
 *
 * @example
 * const tokenizer = new SimNLP.KoreanTokenizer();
 * const tokens = tokenizer.tokenize('안녕하세요');
 * const ids = tokenizer.encode('안녕하세요');
 */

(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.SimNLP = factory());
}(this, function() {
    'use strict';

    // ============================================================
    // CONSTANTS
    // ============================================================

    // Korean Unicode
    const HANGUL_START = 0xAC00;
    const HANGUL_END = 0xD7A3;
    const JAMO_START = 0x3131;
    const JAMO_END = 0x3163;

    // Jamo tables
    const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
    const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    /** Check if character is Hangul syllable */
    function isHangul(char) {
        const code = char.charCodeAt(0);
        return code >= HANGUL_START && code <= HANGUL_END;
    }

    /** Check if character is Jamo */
    function isJamo(char) {
        const code = char.charCodeAt(0);
        return code >= JAMO_START && code <= JAMO_END;
    }

    /** Decompose Hangul syllable to Jamo */
    function decompose(char) {
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

    /** Compose Jamo to Hangul syllable */
    function compose(cho, jung, jong = '') {
        const choIdx = CHOSUNG.indexOf(cho);
        const jungIdx = JUNGSUNG.indexOf(jung);
        const jongIdx = JONGSUNG.indexOf(jong);

        if (choIdx < 0 || jungIdx < 0) return null;
        const jongVal = jongIdx < 0 ? 0 : jongIdx;

        const code = HANGUL_START + (choIdx * 21 + jungIdx) * 28 + jongVal;
        return String.fromCharCode(code);
    }

    // ============================================================
    // VOCABULARY
    // ============================================================

    class Vocabulary {
        constructor(options = {}) {
            this.vocab = new Map();
            this.reverseVocab = new Map();
            this.specialTokens = options.specialTokens || ['[PAD]', '[UNK]', '[BOS]', '[EOS]', '[SEP]', '[MASK]'];
            this.padToken = this.specialTokens[0];
            this.unkToken = this.specialTokens[1];
            this.bosToken = this.specialTokens[2];
            this.eosToken = this.specialTokens[3];

            this._initSpecialTokens();
        }

        _initSpecialTokens() {
            for (let i = 0; i < this.specialTokens.length; i++) {
                this.add(this.specialTokens[i]);
            }
        }

        /** Add token to vocabulary */
        add(token) {
            if (!this.vocab.has(token)) {
                const id = this.vocab.size;
                this.vocab.set(token, id);
                this.reverseVocab.set(id, token);
            }
            return this.vocab.get(token);
        }

        /** Get token ID */
        getId(token) {
            return this.vocab.get(token) ?? this.vocab.get(this.unkToken);
        }

        /** Get token by ID */
        getToken(id) {
            return this.reverseVocab.get(id) ?? this.unkToken;
        }

        /** Check if token exists */
        has(token) {
            return this.vocab.has(token);
        }

        /** Get vocabulary size */
        get size() {
            return this.vocab.size;
        }

        /** Get pad token ID */
        get padId() {
            return this.vocab.get(this.padToken);
        }

        /** Get unknown token ID */
        get unkId() {
            return this.vocab.get(this.unkToken);
        }

        /** Get BOS token ID */
        get bosId() {
            return this.vocab.get(this.bosToken);
        }

        /** Get EOS token ID */
        get eosId() {
            return this.vocab.get(this.eosToken);
        }

        /** Export vocabulary to JSON */
        toJSON() {
            return {
                tokens: Array.from(this.vocab.entries()),
                specialTokens: this.specialTokens
            };
        }

        /** Import vocabulary from JSON */
        static fromJSON(json) {
            const data = typeof json === 'string' ? JSON.parse(json) : json;
            const vocab = new Vocabulary({ specialTokens: data.specialTokens });

            vocab.vocab.clear();
            vocab.reverseVocab.clear();

            for (const [token, id] of data.tokens) {
                vocab.vocab.set(token, id);
                vocab.reverseVocab.set(id, token);
            }

            return vocab;
        }
    }

    // ============================================================
    // BASE TOKENIZER
    // ============================================================

    class Tokenizer {
        constructor(options = {}) {
            this.vocab = options.vocab || new Vocabulary(options);
            this.lowercase = options.lowercase || false;
            this.addSpecialTokens = options.addSpecialTokens !== false;
        }

        /** Preprocess text */
        preprocess(text) {
            if (this.lowercase) {
                return text.toLowerCase();
            }
            return text;
        }

        /** Tokenize text to tokens */
        tokenize(text) {
            throw new Error('tokenize() must be implemented');
        }

        /** Encode text to IDs */
        encode(text, options = {}) {
            const addSpecial = options.addSpecialTokens ?? this.addSpecialTokens;
            const maxLength = options.maxLength || null;
            const padding = options.padding || false;

            let tokens = this.tokenize(text);

            if (addSpecial) {
                tokens = [this.vocab.bosToken, ...tokens, this.vocab.eosToken];
            }

            let ids = tokens.map(t => this.vocab.getId(t));

            if (maxLength) {
                if (ids.length > maxLength) {
                    ids = ids.slice(0, maxLength);
                } else if (padding && ids.length < maxLength) {
                    while (ids.length < maxLength) {
                        ids.push(this.vocab.padId);
                    }
                }
            }

            return ids;
        }

        /** Decode IDs to text */
        decode(ids, options = {}) {
            const skipSpecial = options.skipSpecialTokens !== false;
            const specialSet = new Set(this.vocab.specialTokens);

            const tokens = ids.map(id => this.vocab.getToken(id));

            if (skipSpecial) {
                return this.detokenize(tokens.filter(t => !specialSet.has(t)));
            }
            return this.detokenize(tokens);
        }

        /** Convert tokens back to text */
        detokenize(tokens) {
            return tokens.join('');
        }

        /** Batch encode */
        batchEncode(texts, options = {}) {
            const maxLength = options.maxLength || Math.max(...texts.map(t => this.tokenize(t).length)) + 2;

            return texts.map(text => this.encode(text, { ...options, maxLength, padding: true }));
        }

        /** Get vocabulary size */
        get vocabSize() {
            return this.vocab.size;
        }
    }

    // ============================================================
    // KOREAN TOKENIZER
    // ============================================================

    class KoreanTokenizer extends Tokenizer {
        constructor(options = {}) {
            super(options);
            this.useJamo = options.useJamo !== false;
            this._buildVocab();
        }

        _buildVocab() {
            // Jamo
            for (const cho of CHOSUNG) {
                this.vocab.add(`CHO_${cho}`);
            }
            for (const jung of JUNGSUNG) {
                this.vocab.add(`JUNG_${jung}`);
            }
            for (const jong of JONGSUNG) {
                if (jong) this.vocab.add(`JONG_${jong}`);
            }

            // ASCII printable
            for (let i = 32; i <= 126; i++) {
                this.vocab.add(String.fromCharCode(i));
            }

            // Common Jamo characters (for emoticons like ㅋㅋㅋ)
            for (const j of ['ㅋ', 'ㅎ', 'ㅠ', 'ㅜ', 'ㅡ', 'ㅇ', 'ㄷ', 'ㄱ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅈ', 'ㅊ', 'ㅍ', 'ㅌ', 'ㄴ', 'ㄹ']) {
                this.vocab.add(j);
            }

            // Common symbols
            for (const sym of ['…', '~', '♡', '♥', '★', '☆', '→', '←', '↑', '↓']) {
                this.vocab.add(sym);
            }
        }

        tokenize(text) {
            const processed = this.preprocess(text);
            const tokens = [];

            for (const char of [...processed]) {
                if (isHangul(char) && this.useJamo) {
                    const [cho, jung, jong] = decompose(char);
                    tokens.push(`CHO_${cho}`);
                    tokens.push(`JUNG_${jung}`);
                    if (jong) tokens.push(`JONG_${jong}`);
                } else if (this.vocab.has(char)) {
                    tokens.push(char);
                } else {
                    tokens.push(this.vocab.unkToken);
                }
            }

            return tokens;
        }

        detokenize(tokens) {
            const result = [];
            let i = 0;

            while (i < tokens.length) {
                const token = tokens[i];

                if (token.startsWith('CHO_')) {
                    const cho = token.substring(4);

                    if (i + 1 < tokens.length && tokens[i + 1].startsWith('JUNG_')) {
                        const jung = tokens[i + 1].substring(5);
                        let jong = '';

                        if (i + 2 < tokens.length && tokens[i + 2].startsWith('JONG_')) {
                            jong = tokens[i + 2].substring(5);
                            i += 3;
                        } else {
                            i += 2;
                        }

                        const composed = compose(cho, jung, jong);
                        result.push(composed || cho);
                    } else {
                        result.push(cho);
                        i++;
                    }
                } else if (token.startsWith('JUNG_') || token.startsWith('JONG_')) {
                    result.push(token.substring(token.indexOf('_') + 1));
                    i++;
                } else {
                    result.push(token);
                    i++;
                }
            }

            return result.join('');
        }
    }

    // ============================================================
    // CHARACTER TOKENIZER
    // ============================================================

    class CharTokenizer extends Tokenizer {
        constructor(options = {}) {
            super(options);
            this._buildVocab();
        }

        _buildVocab() {
            // ASCII
            for (let i = 32; i <= 126; i++) {
                this.vocab.add(String.fromCharCode(i));
            }

            // Full Hangul syllables
            for (let code = HANGUL_START; code <= HANGUL_END; code++) {
                this.vocab.add(String.fromCharCode(code));
            }

            // Jamo
            for (let code = JAMO_START; code <= JAMO_END; code++) {
                this.vocab.add(String.fromCharCode(code));
            }
        }

        tokenize(text) {
            const processed = this.preprocess(text);
            return [...processed].map(char =>
                this.vocab.has(char) ? char : this.vocab.unkToken
            );
        }

        detokenize(tokens) {
            return tokens.join('');
        }
    }

    // ============================================================
    // TEXT UTILITIES
    // ============================================================

    const TextUtils = {
        /** Normalize Korean text */
        normalize(text) {
            return text
                .normalize('NFC')
                .replace(/\s+/g, ' ')
                .trim();
        },

        /** Remove special characters */
        removeSpecial(text) {
            return text.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
        },

        /** Extract Hangul only */
        extractHangul(text) {
            return text.replace(/[^가-힣\s]/g, '');
        },

        /** Check if text contains Hangul */
        hasHangul(text) {
            return /[가-힣]/.test(text);
        },

        /** Count syllables */
        countSyllables(text) {
            return [...text].filter(isHangul).length;
        },

        /** Simple Levenshtein distance */
        levenshtein(a, b) {
            const matrix = [];

            for (let i = 0; i <= b.length; i++) {
                matrix[i] = [i];
            }
            for (let j = 0; j <= a.length; j++) {
                matrix[0][j] = j;
            }

            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b[i - 1] === a[j - 1]) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        );
                    }
                }
            }

            return matrix[b.length][a.length];
        },

        /** Jaccard similarity */
        jaccardSimilarity(a, b) {
            const setA = new Set([...a]);
            const setB = new Set([...b]);
            const intersection = new Set([...setA].filter(x => setB.has(x)));
            const union = new Set([...setA, ...setB]);
            return intersection.size / union.size;
        },

        /** N-gram extraction */
        ngrams(text, n) {
            const grams = [];
            for (let i = 0; i <= text.length - n; i++) {
                grams.push(text.slice(i, i + n));
            }
            return grams;
        }
    };

    // ============================================================
    // KOREAN UTILS
    // ============================================================

    const KoreanUtils = {
        isHangul,
        isJamo,
        decompose,
        compose,

        CHOSUNG,
        JUNGSUNG,
        JONGSUNG,

        /** Get chosung of Hangul text */
        extractChosung(text) {
            return [...text].map(char => {
                if (isHangul(char)) {
                    return decompose(char)[0];
                }
                return char;
            }).join('');
        },

        /** Check if text matches chosung pattern */
        matchChosung(text, pattern) {
            const chosung = this.extractChosung(text);
            return chosung.includes(pattern);
        }
    };

    // ============================================================
    // EXPORTS
    // ============================================================

    return {
        version: '1.0.0',

        // Classes
        Vocabulary,
        Tokenizer,
        KoreanTokenizer,
        CharTokenizer,

        // Utilities
        TextUtils,
        KoreanUtils,

        // Quick access
        korean: KoreanUtils,
        text: TextUtils
    };
}));
