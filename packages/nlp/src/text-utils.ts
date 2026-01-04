/**
 * Text processing utilities
 */

import { isHangul } from './korean';

/** Normalize Korean text (NFC normalization, whitespace cleanup) */
export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remove special characters */
export function removeSpecial(text: string): string {
  return text.replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '');
}

/** Extract Hangul only */
export function extractHangul(text: string): string {
  return text.replace(/[^가-힣\s]/g, '');
}

/** Check if text contains Hangul */
export function hasHangul(text: string): boolean {
  return /[가-힣]/.test(text);
}

/** Count Hangul syllables */
export function countSyllables(text: string): number {
  return [...text].filter(isHangul).length;
}

/** Levenshtein edit distance */
export function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];

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
}

/** Jaccard similarity (character-based) */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set([...a]);
  const setB = new Set([...b]);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/** Extract n-grams from text */
export function ngrams(text: string, n: number): string[] {
  const grams: string[] = [];
  for (let i = 0; i <= text.length - n; i++) {
    grams.push(text.slice(i, i + n));
  }
  return grams;
}

/** Cosine similarity between two token frequency vectors */
export function cosineSimilarity(a: string[], b: string[]): number {
  const freqA = new Map<string, number>();
  const freqB = new Map<string, number>();

  for (const token of a) {
    freqA.set(token, (freqA.get(token) || 0) + 1);
  }
  for (const token of b) {
    freqB.set(token, (freqB.get(token) || 0) + 1);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  const allTokens = new Set([...freqA.keys(), ...freqB.keys()]);

  for (const token of allTokens) {
    const valA = freqA.get(token) || 0;
    const valB = freqB.get(token) || 0;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Text utilities namespace */
export const TextUtils = {
  normalize,
  removeSpecial,
  extractHangul,
  hasHangul,
  countSyllables,
  levenshtein,
  jaccardSimilarity,
  ngrams,
  cosineSimilarity,
};
