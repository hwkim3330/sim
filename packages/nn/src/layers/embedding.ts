import { Tensor } from '../tensor';
import { Layer } from './base';

export interface EmbeddingOptions {
  /** Index for padding token (will be zeros) */
  paddingIdx?: number;
}

/**
 * Embedding Layer - Lookup table for token indices
 */
export class Embedding extends Layer {
  readonly numEmbeddings: number;
  readonly embeddingDim: number;
  readonly paddingIdx?: number;

  constructor(numEmbeddings: number, embeddingDim: number, options: EmbeddingOptions = {}) {
    super();

    if (!Number.isInteger(numEmbeddings) || numEmbeddings <= 0) {
      throw new Error(`numEmbeddings must be a positive integer, got ${numEmbeddings}`);
    }
    if (!Number.isInteger(embeddingDim) || embeddingDim <= 0) {
      throw new Error(`embeddingDim must be a positive integer, got ${embeddingDim}`);
    }

    this.numEmbeddings = numEmbeddings;
    this.embeddingDim = embeddingDim;
    this.paddingIdx = options.paddingIdx;

    // Initialize with scaled random values
    const scale = 1.0 / Math.sqrt(embeddingDim);
    this.params.weight = Tensor.randn([numEmbeddings, embeddingDim]).mul(scale);

    // Zero out padding index if specified
    if (this.paddingIdx !== undefined) {
      for (let j = 0; j < embeddingDim; j++) {
        this.params.weight.data[this.paddingIdx * embeddingDim + j] = 0;
      }
    }
  }

  forward(indices: Tensor): Tensor {
    const is1D = indices.shape.length === 1;
    const seqLen = is1D ? indices.shape[0] : indices.shape[1];
    const batchSize = is1D ? 1 : indices.shape[0];

    const outputShape = is1D
      ? [seqLen, this.embeddingDim]
      : [batchSize, seqLen, this.embeddingDim];

    const result = new Float32Array(batchSize * seqLen * this.embeddingDim);

    for (let b = 0; b < batchSize; b++) {
      for (let s = 0; s < seqLen; s++) {
        const idx = is1D ? indices.data[s] : indices.data[b * seqLen + s];
        const srcOffset = Math.floor(idx) * this.embeddingDim;
        const dstOffset = (b * seqLen + s) * this.embeddingDim;

        for (let d = 0; d < this.embeddingDim; d++) {
          result[dstOffset + d] = this.params.weight.data[srcOffset + d];
        }
      }
    }

    return new Tensor(result, outputShape);
  }

  /** Get single embedding vector */
  getEmbedding(idx: number): Tensor {
    const result = new Float32Array(this.embeddingDim);
    const offset = idx * this.embeddingDim;
    for (let i = 0; i < this.embeddingDim; i++) {
      result[i] = this.params.weight.data[offset + i];
    }
    return new Tensor(result, [this.embeddingDim]);
  }

  /** Compute cosine similarity between two embeddings */
  cosineSimilarity(idx1: number, idx2: number): number {
    const emb1 = this.getEmbedding(idx1);
    const emb2 = this.getEmbedding(idx2);

    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < this.embeddingDim; i++) {
      dot += emb1.data[i] * emb2.data[i];
      norm1 += emb1.data[i] * emb1.data[i];
      norm2 += emb2.data[i] * emb2.data[i];
    }
    return dot / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-8);
  }
}
