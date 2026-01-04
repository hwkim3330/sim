/**
 * Base tokenizer and implementations
 */

import { Vocabulary, VocabularyOptions } from './vocabulary';
import { isHangul, decompose, compose, CHOSUNG, JUNGSUNG, JONGSUNG } from './korean';

export interface TokenizerOptions extends VocabularyOptions {
  /** Existing vocabulary */
  vocab?: Vocabulary;
  /** Lowercase text */
  lowercase?: boolean;
  /** Add special tokens (BOS/EOS) */
  addSpecialTokens?: boolean;
}

export interface EncodeOptions {
  /** Add BOS/EOS tokens */
  addSpecialTokens?: boolean;
  /** Maximum sequence length */
  maxLength?: number;
  /** Pad to maxLength */
  padding?: boolean;
}

export interface DecodeOptions {
  /** Skip special tokens in output */
  skipSpecialTokens?: boolean;
}

/**
 * Base tokenizer class
 */
export abstract class Tokenizer {
  readonly vocab: Vocabulary;
  readonly lowercase: boolean;
  readonly addSpecialTokens: boolean;

  constructor(options: TokenizerOptions = {}) {
    this.vocab = options.vocab || new Vocabulary(options);
    this.lowercase = options.lowercase || false;
    this.addSpecialTokens = options.addSpecialTokens !== false;
  }

  /** Preprocess text before tokenization */
  preprocess(text: string): string {
    if (typeof text !== 'string') {
      throw new TypeError(`text must be a string, got ${typeof text}`);
    }
    if (this.lowercase) {
      return text.toLowerCase();
    }
    return text;
  }

  /** Tokenize text to tokens - must be implemented */
  abstract tokenize(text: string): string[];

  /** Convert tokens back to text */
  detokenize(tokens: string[]): string {
    return tokens.join('');
  }

  /** Encode text to token IDs */
  encode(text: string, options: EncodeOptions = {}): number[] {
    if (typeof text !== 'string') {
      throw new TypeError(`text must be a string, got ${typeof text}`);
    }

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

  /** Decode token IDs to text */
  decode(ids: number[], options: DecodeOptions = {}): string {
    if (!Array.isArray(ids)) {
      throw new TypeError(`ids must be an array, got ${typeof ids}`);
    }

    const skipSpecial = options.skipSpecialTokens !== false;
    const specialSet = new Set(this.vocab.specialTokens);

    const tokens = ids.map(id => this.vocab.getToken(id));

    if (skipSpecial) {
      return this.detokenize(tokens.filter(t => !specialSet.has(t)));
    }
    return this.detokenize(tokens);
  }

  /** Batch encode multiple texts */
  batchEncode(texts: string[], options: EncodeOptions = {}): number[][] {
    const maxLen = options.maxLength || Math.max(...texts.map(t => this.tokenize(t).length)) + 2;
    return texts.map(text => this.encode(text, { ...options, maxLength: maxLen, padding: true }));
  }

  /** Get vocabulary size */
  get vocabSize(): number {
    return this.vocab.size;
  }
}

/**
 * Korean tokenizer with Jamo decomposition
 */
export class KoreanTokenizer extends Tokenizer {
  readonly useJamo: boolean;

  constructor(options: TokenizerOptions & { useJamo?: boolean } = {}) {
    super(options);
    this.useJamo = options.useJamo !== false;
    this._buildVocab();
  }

  private _buildVocab(): void {
    // Jamo tokens
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

    // Common Jamo (emoticons like ㅋㅋㅋ)
    for (const j of ['ㅋ', 'ㅎ', 'ㅠ', 'ㅜ', 'ㅡ', 'ㅇ', 'ㄷ', 'ㄱ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅈ', 'ㅊ', 'ㅍ', 'ㅌ', 'ㄴ', 'ㄹ']) {
      this.vocab.add(j);
    }

    // Common symbols
    for (const sym of ['…', '~', '♡', '♥', '★', '☆', '→', '←', '↑', '↓']) {
      this.vocab.add(sym);
    }
  }

  tokenize(text: string): string[] {
    const processed = this.preprocess(text);
    const tokens: string[] = [];

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

  detokenize(tokens: string[]): string {
    const result: string[] = [];
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

/**
 * Simple character tokenizer
 */
export class CharTokenizer extends Tokenizer {
  constructor(options: TokenizerOptions = {}) {
    super(options);
    this._buildVocab();
  }

  private _buildVocab(): void {
    // ASCII
    for (let i = 32; i <= 126; i++) {
      this.vocab.add(String.fromCharCode(i));
    }

    // Full Hangul syllables
    for (let code = 0xAC00; code <= 0xD7A3; code++) {
      this.vocab.add(String.fromCharCode(code));
    }

    // Jamo
    for (let code = 0x3131; code <= 0x3163; code++) {
      this.vocab.add(String.fromCharCode(code));
    }
  }

  tokenize(text: string): string[] {
    const processed = this.preprocess(text);
    return [...processed].map(char =>
      this.vocab.has(char) ? char : this.vocab.unkToken
    );
  }
}
