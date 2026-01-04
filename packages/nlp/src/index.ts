/**
 * @simi/nlp
 * Simi Platform NLP - Korean-focused Natural Language Processing
 *
 * @packageDocumentation
 */

// Korean utilities
export {
  isHangul,
  isJamo,
  decompose,
  decomposeToObject,
  compose,
  extractChosung,
  matchChosung,
  KoreanUtils,
  CHOSUNG,
  JUNGSUNG,
  JONGSUNG,
  JamoDecomposition,
} from './korean';

// Vocabulary
export {
  Vocabulary,
  VocabularyOptions,
  VocabularyJSON,
} from './vocabulary';

// Tokenizers
export {
  Tokenizer,
  KoreanTokenizer,
  CharTokenizer,
  TokenizerOptions,
  EncodeOptions,
  DecodeOptions,
} from './tokenizer';

// Text utilities
export {
  TextUtils,
  normalize,
  removeSpecial,
  extractHangul,
  hasHangul,
  countSyllables,
  levenshtein,
  jaccardSimilarity,
  ngrams,
  cosineSimilarity,
} from './text-utils';

// Factory functions
export function createKoreanTokenizer(
  options?: import('./tokenizer').TokenizerOptions & { useJamo?: boolean }
): KoreanTokenizer {
  return new KoreanTokenizer(options);
}

export function createCharTokenizer(
  options?: import('./tokenizer').TokenizerOptions
): CharTokenizer {
  return new CharTokenizer(options);
}

// Convenience aliases
export const korean = KoreanUtils;
export const text = TextUtils;

/** Library version */
export const VERSION = '1.0.0';
