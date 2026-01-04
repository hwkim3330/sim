/**
 * Token vocabulary for mapping tokens to IDs
 */

export interface VocabularyOptions {
  /** Special tokens array */
  specialTokens?: string[];
}

export interface VocabularyJSON {
  tokens: [string, number][];
  specialTokens: string[];
}

/**
 * Token vocabulary for mapping tokens to IDs and back
 */
export class Vocabulary {
  /** Token to ID mapping */
  private vocab: Map<string, number>;
  /** ID to token mapping */
  private reverseVocab: Map<number, string>;
  /** Special tokens list */
  readonly specialTokens: string[];
  /** Padding token */
  readonly padToken: string;
  /** Unknown token */
  readonly unkToken: string;
  /** Beginning of sequence token */
  readonly bosToken: string;
  /** End of sequence token */
  readonly eosToken: string;

  constructor(options: VocabularyOptions = {}) {
    this.vocab = new Map();
    this.reverseVocab = new Map();
    this.specialTokens = options.specialTokens || ['[PAD]', '[UNK]', '[BOS]', '[EOS]', '[SEP]', '[MASK]'];
    this.padToken = this.specialTokens[0];
    this.unkToken = this.specialTokens[1];
    this.bosToken = this.specialTokens[2];
    this.eosToken = this.specialTokens[3];

    this._initSpecialTokens();
  }

  private _initSpecialTokens(): void {
    for (const token of this.specialTokens) {
      this.add(token);
    }
  }

  /** Add token to vocabulary */
  add(token: string): number {
    if (!this.vocab.has(token)) {
      const id = this.vocab.size;
      this.vocab.set(token, id);
      this.reverseVocab.set(id, token);
    }
    return this.vocab.get(token)!;
  }

  /** Get token ID */
  getId(token: string): number {
    return this.vocab.get(token) ?? this.vocab.get(this.unkToken)!;
  }

  /** Get token by ID */
  getToken(id: number): string {
    return this.reverseVocab.get(id) ?? this.unkToken;
  }

  /** Check if token exists */
  has(token: string): boolean {
    return this.vocab.has(token);
  }

  /** Get vocabulary size */
  get size(): number {
    return this.vocab.size;
  }

  /** Get pad token ID */
  get padId(): number {
    return this.vocab.get(this.padToken)!;
  }

  /** Get unknown token ID */
  get unkId(): number {
    return this.vocab.get(this.unkToken)!;
  }

  /** Get BOS token ID */
  get bosId(): number {
    return this.vocab.get(this.bosToken)!;
  }

  /** Get EOS token ID */
  get eosId(): number {
    return this.vocab.get(this.eosToken)!;
  }

  /** Export vocabulary to JSON */
  toJSON(): VocabularyJSON {
    return {
      tokens: Array.from(this.vocab.entries()),
      specialTokens: this.specialTokens,
    };
  }

  /** Import vocabulary from JSON */
  static fromJSON(json: string | VocabularyJSON): Vocabulary {
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
