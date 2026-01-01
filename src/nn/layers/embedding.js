/**
 * Embedding Layer
 * Lookup table for converting token indices to dense vectors
 */

class Embedding {
    constructor(numEmbeddings, embeddingDim, options = {}) {
        this.numEmbeddings = numEmbeddings;
        this.embeddingDim = embeddingDim;
        this.paddingIdx = options.paddingIdx;

        // Initialize embeddings (normal distribution scaled by 1/sqrt(dim))
        const scale = 1.0 / Math.sqrt(embeddingDim);
        this.weight = Tensor.randn([numEmbeddings, embeddingDim]).mul(scale);

        // Set padding to zero if specified
        if (this.paddingIdx !== undefined) {
            for (let j = 0; j < embeddingDim; j++) {
                this.weight.data[this.paddingIdx * embeddingDim + j] = 0;
            }
        }
    }

    forward(indices) {
        // indices: [batch, seqLen] or [seqLen]
        const is1D = indices.shape.length === 1;
        const shape = is1D ? [indices.shape[0]] : [indices.shape[0], indices.shape[1]];
        const seqLen = is1D ? indices.shape[0] : indices.shape[1];
        const batchSize = is1D ? 1 : indices.shape[0];

        const outputShape = is1D
            ? [seqLen, this.embeddingDim]
            : [batchSize, seqLen, this.embeddingDim];

        const result = new Float32Array(batchSize * seqLen * this.embeddingDim);

        for (let b = 0; b < batchSize; b++) {
            for (let s = 0; s < seqLen; s++) {
                const idx = is1D
                    ? indices.data[s]
                    : indices.data[b * seqLen + s];

                const srcOffset = Math.floor(idx) * this.embeddingDim;
                const dstOffset = (b * seqLen + s) * this.embeddingDim;

                for (let d = 0; d < this.embeddingDim; d++) {
                    result[dstOffset + d] = this.weight.data[srcOffset + d];
                }
            }
        }

        return new Tensor(result, outputShape);
    }

    // Load weights from array or object
    loadWeights(weights) {
        if (Array.isArray(weights) || weights instanceof Float32Array) {
            this.weight = new Tensor(
                new Float32Array(weights),
                [this.numEmbeddings, this.embeddingDim]
            );
        } else if (weights.weight) {
            this.weight = new Tensor(
                new Float32Array(weights.weight),
                [this.numEmbeddings, this.embeddingDim]
            );
        }

        // Re-zero padding if specified
        if (this.paddingIdx !== undefined) {
            for (let j = 0; j < this.embeddingDim; j++) {
                this.weight.data[this.paddingIdx * this.embeddingDim + j] = 0;
            }
        }
    }

    // Get embedding for single index
    getEmbedding(idx) {
        const result = new Float32Array(this.embeddingDim);
        const offset = idx * this.embeddingDim;
        for (let i = 0; i < this.embeddingDim; i++) {
            result[i] = this.weight.data[offset + i];
        }
        return new Tensor(result, [this.embeddingDim]);
    }

    // Compute cosine similarity between embeddings
    cosineSimilarity(idx1, idx2) {
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

    // Find most similar embeddings to a given index
    mostSimilar(idx, topK = 5) {
        const queryEmb = this.getEmbedding(idx);
        const similarities = [];

        for (let i = 0; i < this.numEmbeddings; i++) {
            if (i === idx) continue;
            const sim = this.cosineSimilarity(idx, i);
            similarities.push({ idx: i, similarity: sim });
        }

        similarities.sort((a, b) => b.similarity - a.similarity);
        return similarities.slice(0, topK);
    }

    numParams() {
        return this.numEmbeddings * this.embeddingDim;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Embedding;
}
