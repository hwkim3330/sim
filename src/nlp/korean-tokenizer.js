/**
 * Korean Tokenizer with Jamo Decomposition
 * 한글 자모 분해 기반 토크나이저
 */

class KoreanTokenizer {
    constructor() {
        // Korean Unicode ranges
        this.HANGUL_START = 0xAC00;
        this.HANGUL_END = 0xD7A3;

        // Jamo characters (자모)
        this.CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
        this.JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
        this.JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

        // Special tokens
        this.PAD_TOKEN = '[PAD]';
        this.UNK_TOKEN = '[UNK]';
        this.BOS_TOKEN = '[BOS]';
        this.EOS_TOKEN = '[EOS]';
        this.SEP_TOKEN = '[SEP]';

        // Build vocabulary
        this.vocab = new Map();
        this.reverseVocab = new Map();
        this._buildVocab();
    }

    _buildVocab() {
        let idx = 0;

        // Special tokens
        const specialTokens = [this.PAD_TOKEN, this.UNK_TOKEN, this.BOS_TOKEN, this.EOS_TOKEN, this.SEP_TOKEN];
        for (const token of specialTokens) {
            this.vocab.set(token, idx);
            this.reverseVocab.set(idx, token);
            idx++;
        }

        // Chosung (초성)
        for (const cho of this.CHOSUNG) {
            this.vocab.set(`CHO_${cho}`, idx);
            this.reverseVocab.set(idx, `CHO_${cho}`);
            idx++;
        }

        // Jungsung (중성)
        for (const jung of this.JUNGSUNG) {
            this.vocab.set(`JUNG_${jung}`, idx);
            this.reverseVocab.set(idx, `JUNG_${jung}`);
            idx++;
        }

        // Jongsung (종성)
        for (const jong of this.JONGSUNG) {
            if (jong === '') continue;
            this.vocab.set(`JONG_${jong}`, idx);
            this.reverseVocab.set(idx, `JONG_${jong}`);
            idx++;
        }

        // ASCII printable characters (32-126)
        for (let i = 32; i <= 126; i++) {
            const char = String.fromCharCode(i);
            this.vocab.set(char, idx);
            this.reverseVocab.set(idx, char);
            idx++;
        }

        // Common Korean emoticons and symbols
        const emoticons = ['ㅋ', 'ㅎ', 'ㅠ', 'ㅜ', 'ㅡ', 'ㅇ', 'ㄷ', 'ㄱ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅈ', 'ㅊ', 'ㅍ', 'ㅌ', 'ㄴ', 'ㄹ'];
        for (const emo of emoticons) {
            if (!this.vocab.has(emo)) {
                this.vocab.set(emo, idx);
                this.reverseVocab.set(idx, emo);
                idx++;
            }
        }

        // Common punctuation and symbols
        const symbols = ['…', '~', '♡', '♥', '★', '☆', '○', '●', '◎', '◇', '◆', '□', '■', '△', '▲', '▽', '▼', '→', '←', '↑', '↓', '※'];
        for (const sym of symbols) {
            this.vocab.set(sym, idx);
            this.reverseVocab.set(idx, sym);
            idx++;
        }

        this.vocabSize = idx;
        this.padId = this.vocab.get(this.PAD_TOKEN);
        this.unkId = this.vocab.get(this.UNK_TOKEN);
        this.bosId = this.vocab.get(this.BOS_TOKEN);
        this.eosId = this.vocab.get(this.EOS_TOKEN);
    }

    // Check if character is Hangul
    isHangul(char) {
        const code = char.charCodeAt(0);
        return code >= this.HANGUL_START && code <= this.HANGUL_END;
    }

    // Decompose Hangul syllable into Jamo
    decomposeHangul(char) {
        const code = char.charCodeAt(0) - this.HANGUL_START;
        const choIdx = Math.floor(code / (21 * 28));
        const jungIdx = Math.floor((code % (21 * 28)) / 28);
        const jongIdx = code % 28;

        const result = [
            `CHO_${this.CHOSUNG[choIdx]}`,
            `JUNG_${this.JUNGSUNG[jungIdx]}`
        ];

        if (jongIdx > 0) {
            result.push(`JONG_${this.JONGSUNG[jongIdx]}`);
        }

        return result;
    }

    // Tokenize text into tokens
    tokenize(text, addSpecialTokens = true) {
        const tokens = [];

        if (addSpecialTokens) {
            tokens.push(this.BOS_TOKEN);
        }

        const chars = [...text];  // Handle Unicode properly
        for (const char of chars) {
            if (this.isHangul(char)) {
                // Decompose Hangul into Jamo
                tokens.push(...this.decomposeHangul(char));
            } else if (char === ' ') {
                tokens.push(' ');
            } else if (this.vocab.has(char)) {
                tokens.push(char);
            } else {
                tokens.push(this.UNK_TOKEN);
            }
        }

        if (addSpecialTokens) {
            tokens.push(this.EOS_TOKEN);
        }

        return tokens;
    }

    // Convert tokens to IDs
    encode(text, addSpecialTokens = true, maxLength = null, padding = false) {
        const tokens = typeof text === 'string' ? this.tokenize(text, addSpecialTokens) : text;
        let ids = tokens.map(token => this.vocab.get(token) ?? this.unkId);

        // Truncate if needed
        if (maxLength && ids.length > maxLength) {
            ids = ids.slice(0, maxLength);
        }

        // Pad if needed
        if (padding && maxLength && ids.length < maxLength) {
            while (ids.length < maxLength) {
                ids.push(this.padId);
            }
        }

        return ids;
    }

    // Convert IDs back to text
    decode(ids, skipSpecialTokens = true) {
        const tokens = ids.map(id => this.reverseVocab.get(id) || this.UNK_TOKEN);

        if (skipSpecialTokens) {
            const specialTokens = new Set([this.PAD_TOKEN, this.UNK_TOKEN, this.BOS_TOKEN, this.EOS_TOKEN, this.SEP_TOKEN]);
            return this._composeTokens(tokens.filter(t => !specialTokens.has(t)));
        }

        return this._composeTokens(tokens);
    }

    // Compose Jamo tokens back to Hangul
    _composeTokens(tokens) {
        let result = '';
        let i = 0;

        while (i < tokens.length) {
            const token = tokens[i];

            // Check if it's a Jamo sequence
            if (token.startsWith('CHO_')) {
                const cho = this.CHOSUNG.indexOf(token.substring(4));

                if (i + 1 < tokens.length && tokens[i + 1].startsWith('JUNG_')) {
                    const jung = this.JUNGSUNG.indexOf(tokens[i + 1].substring(5));
                    let jong = 0;

                    if (i + 2 < tokens.length && tokens[i + 2].startsWith('JONG_')) {
                        jong = this.JONGSUNG.indexOf(tokens[i + 2].substring(5));
                        i += 3;
                    } else {
                        i += 2;
                    }

                    // Compose Hangul syllable
                    const code = this.HANGUL_START + (cho * 21 + jung) * 28 + jong;
                    result += String.fromCharCode(code);
                } else {
                    // Incomplete Jamo, output as-is
                    result += token.substring(4);
                    i++;
                }
            } else if (token.startsWith('JUNG_') || token.startsWith('JONG_')) {
                // Orphan Jamo
                result += token.substring(token.indexOf('_') + 1);
                i++;
            } else {
                result += token;
                i++;
            }
        }

        return result;
    }

    // Convert to tensor for model input
    toTensor(text, maxLength = 64) {
        const ids = this.encode(text, true, maxLength, true);
        return new Tensor(new Float32Array(ids), [ids.length]);
    }

    // Batch encode
    batchEncode(texts, maxLength = null, padding = true) {
        const encoded = texts.map(text => this.encode(text, true, null, false));

        // Find max length
        const maxLen = maxLength || Math.max(...encoded.map(e => e.length));

        // Pad and convert to tensor
        const batchSize = texts.length;
        const data = new Float32Array(batchSize * maxLen);

        for (let i = 0; i < batchSize; i++) {
            for (let j = 0; j < maxLen; j++) {
                data[i * maxLen + j] = j < encoded[i].length ? encoded[i][j] : this.padId;
            }
        }

        return new Tensor(data, [batchSize, maxLen]);
    }

    // Get vocabulary size
    getVocabSize() {
        return this.vocabSize;
    }
}

// Simple character-level tokenizer (backup)
class CharTokenizer {
    constructor() {
        this.vocab = new Map();
        this.reverseVocab = new Map();
        this.PAD_TOKEN = '[PAD]';
        this.UNK_TOKEN = '[UNK]';
        this._buildVocab();
    }

    _buildVocab() {
        let idx = 0;
        this.vocab.set(this.PAD_TOKEN, idx++);
        this.vocab.set(this.UNK_TOKEN, idx++);

        // ASCII
        for (let i = 32; i <= 126; i++) {
            this.vocab.set(String.fromCharCode(i), idx++);
        }

        // Common Hangul syllables (가-힣)
        for (let code = 0xAC00; code <= 0xD7A3; code++) {
            this.vocab.set(String.fromCharCode(code), idx++);
        }

        this.vocabSize = idx;

        // Build reverse vocab
        for (const [token, id] of this.vocab) {
            this.reverseVocab.set(id, token);
        }
    }

    encode(text) {
        return [...text].map(char => this.vocab.get(char) ?? 1);
    }

    decode(ids) {
        return ids.map(id => this.reverseVocab.get(id) || '').join('');
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KoreanTokenizer, CharTokenizer };
}
