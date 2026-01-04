/**
 * Response retriever with pattern matching
 */

import { Intent } from './intent';
import { Emotion } from './emotion';

export interface ResponseEntry {
  patterns?: string[];
  pattern?: string;
  responses?: string[];
  response?: string;
  intent?: Intent;
  emotion?: Emotion;
  strategy?: string;
}

export interface RetrievedCandidate {
  idx: number;
  score: number;
  entry: ResponseEntry;
}

export interface StrategyCandidate {
  response: string;
  strategy: string;
  score: number;
  intent?: Intent;
  emotion?: Emotion;
}

/**
 * Response retriever with keyword indexing
 */
export class Retriever {
  private responses: ResponseEntry[] = [];
  private index: Map<string, number[]> = new Map();
  loaded: boolean = false;

  /** Load response data */
  async load(data: string | ResponseEntry[] | { responses: ResponseEntry[] }): Promise<void> {
    if (typeof data === 'string') {
      try {
        const response = await fetch(data);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        const json = await response.json();
        this.responses = json.responses || json;
      } catch (e) {
        console.warn('Failed to load responses:', e);
        this._loadBuiltIn();
      }
    } else if (Array.isArray(data)) {
      this.responses = data;
    } else if (data?.responses) {
      this.responses = data.responses;
    }

    this._buildIndex();
    this.loaded = true;
  }

  private _buildIndex(): void {
    this.index.clear();
    for (let i = 0; i < this.responses.length; i++) {
      const entry = this.responses[i];
      const patterns = entry.patterns || (entry.pattern ? [entry.pattern] : []);
      for (const pattern of patterns) {
        const keywords = this._extractKeywords(pattern);
        for (const kw of keywords) {
          if (!this.index.has(kw)) this.index.set(kw, []);
          this.index.get(kw)!.push(i);
        }
      }
    }
  }

  private _extractKeywords(text: string): string[] {
    const stopWords = new Set(['은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '로']);
    const words = text.split(/[\s,.!?~]+/).filter(w => w.length >= 2);
    return [...new Set(words.filter(w => !stopWords.has(w)))];
  }

  /** Retrieve matching responses */
  retrieve(input: string, topK: number = 10): RetrievedCandidate[] {
    const inputKw = this._extractKeywords(input);
    const candidates = new Map<number, number>();

    for (const kw of inputKw) {
      const matches = this.index.get(kw) || [];
      for (const idx of matches) {
        candidates.set(idx, (candidates.get(idx) || 0) + 1);
      }
    }

    const scored: RetrievedCandidate[] = [];
    for (const [idx, kwScore] of candidates) {
      const entry = this.responses[idx];
      const patterns = entry.patterns || (entry.pattern ? [entry.pattern] : []);
      let maxSim = 0;
      for (const p of patterns) {
        const sim = this._similarity(input, p);
        if (sim > maxSim) maxSim = sim;
      }
      scored.push({ idx, score: kwScore * 0.4 + maxSim * 0.6, entry });
    }

    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private _similarity(a: string, b: string): number {
    const setA = new Set(this._extractKeywords(a));
    const setB = new Set(this._extractKeywords(b));
    if (setA.size === 0 || setB.size === 0) return 0;
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    return intersection.size / new Set([...setA, ...setB]).size;
  }

  /** Find best matching response */
  findBest(input: string): string | null {
    const candidates = this.retrieve(input, 5);
    if (candidates.length === 0 || candidates[0].score < 0.2) return null;
    const responses = candidates[0].entry.responses || (candidates[0].entry.response ? [candidates[0].entry.response] : []);
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /** Retrieve with strategy metadata */
  retrieveWithStrategy(input: string, topK: number = 10): StrategyCandidate[] {
    const candidates = this.retrieve(input, topK);
    const results: StrategyCandidate[] = [];

    for (const { entry, score } of candidates) {
      if (score < 0.15) continue;

      const responses = entry.responses || (entry.response ? [entry.response] : []);
      const strategy = entry.strategy || this._inferStrategyFromEntry(entry);

      for (const resp of responses) {
        results.push({
          response: resp,
          strategy,
          score,
          intent: entry.intent,
          emotion: entry.emotion
        });
      }
    }

    return results;
  }

  private _inferStrategyFromEntry(entry: ResponseEntry): string {
    if (entry.emotion === 'sad' || entry.intent === 'emotion_share') return 'empathetic';
    if (entry.intent === 'humor') return 'humorous';
    if (entry.intent === 'question' || entry.intent === 'personal_question') return 'informative';
    if (entry.intent === 'gratitude' || entry.intent === 'apology') return 'empathetic';
    return 'casual';
  }

  /** Get response by intent */
  getByIntent(intent: Intent): string | null {
    const matches = this.responses.filter(r => r.intent === intent);
    if (matches.length === 0) return null;
    const entry = matches[Math.floor(Math.random() * matches.length)];
    const responses = entry.responses || (entry.response ? [entry.response] : []);
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private _loadBuiltIn(): void {
    this.responses = [
      { patterns: ['안녕', '안녕하세요', '하이'], responses: ['안녕하세요!', '반가워요!'], intent: 'greeting' },
      { patterns: ['잘가', '바이', '안녕히'], responses: ['다음에 또 봐요!', '잘가요~'], intent: 'farewell' },
      { patterns: ['고마워', '감사'], responses: ['천만에요!', '별말씀을요~'], intent: 'gratitude' },
      { patterns: ['미안', '죄송'], responses: ['괜찮아요!', '신경쓰지 마세요~'], intent: 'apology' },
      { patterns: ['이름이 뭐', '누구야'], responses: ['저는 심이예요!'], intent: 'personal_question' },
      { patterns: ['심심해', '지루해'], responses: ['저랑 얘기해요!', '같이 놀아요~'], intent: 'statement' },
      { patterns: ['기분이 좋아', '행복해'], responses: ['좋으시겠어요!', '저도 기뻐요!'], intent: 'emotion_share', emotion: 'happy' },
      { patterns: ['슬퍼', '우울해', '힘들어'], responses: ['힘드시겠어요...', '괜찮으세요?'], intent: 'emotion_share', emotion: 'sad' },
      { patterns: ['귀여워', '예뻐'], responses: ['에헤헤 고마워요!', '부끄러워요...'], intent: 'compliment' }
    ];
  }
}
