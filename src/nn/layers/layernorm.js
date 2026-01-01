/**
 * Layer Normalization
 * Normalizes activations across the feature dimension
 */

class LayerNorm {
    constructor(normalizedShape, options = {}) {
        this.normalizedShape = Array.isArray(normalizedShape) ? normalizedShape : [normalizedShape];
        this.eps = options.eps || 1e-5;
        this.elementwise = options.elementwise !== false;

        const size = this.normalizedShape.reduce((a, b) => a * b, 1);

        if (this.elementwise) {
            this.gamma = Tensor.ones([size]);  // Scale
            this.beta = Tensor.zeros([size]);  // Shift
        }
    }

    forward(x) {
        const shape = x.shape;
        const normalizedSize = this.normalizedShape.reduce((a, b) => a * b, 1);
        const outerSize = x.size / normalizedSize;

        const result = new Float32Array(x.size);

        for (let outer = 0; outer < outerSize; outer++) {
            const offset = outer * normalizedSize;

            // Compute mean
            let mean = 0;
            for (let i = 0; i < normalizedSize; i++) {
                mean += x.data[offset + i];
            }
            mean /= normalizedSize;

            // Compute variance
            let variance = 0;
            for (let i = 0; i < normalizedSize; i++) {
                const diff = x.data[offset + i] - mean;
                variance += diff * diff;
            }
            variance /= normalizedSize;

            // Normalize
            const stdInv = 1.0 / Math.sqrt(variance + this.eps);
            for (let i = 0; i < normalizedSize; i++) {
                let normalized = (x.data[offset + i] - mean) * stdInv;

                if (this.elementwise) {
                    normalized = normalized * this.gamma.data[i] + this.beta.data[i];
                }

                result[offset + i] = normalized;
            }
        }

        return new Tensor(result, shape);
    }

    loadWeights(weights) {
        if (weights.gamma || weights.weight) {
            const data = weights.gamma || weights.weight;
            this.gamma = new Tensor(new Float32Array(data), [data.length]);
        }
        if (weights.beta || weights.bias) {
            const data = weights.beta || weights.bias;
            this.beta = new Tensor(new Float32Array(data), [data.length]);
        }
    }

    numParams() {
        if (!this.elementwise) return 0;
        const size = this.normalizedShape.reduce((a, b) => a * b, 1);
        return size * 2;  // gamma and beta
    }
}

/**
 * RMS Normalization (used in modern transformers)
 */
class RMSNorm {
    constructor(dim, eps = 1e-6) {
        this.dim = dim;
        this.eps = eps;
        this.weight = Tensor.ones([dim]);
    }

    forward(x) {
        const shape = x.shape;
        const lastDim = shape[shape.length - 1];
        const outerSize = x.size / lastDim;

        const result = new Float32Array(x.size);

        for (let outer = 0; outer < outerSize; outer++) {
            const offset = outer * lastDim;

            // Compute RMS
            let sumSq = 0;
            for (let i = 0; i < lastDim; i++) {
                sumSq += x.data[offset + i] * x.data[offset + i];
            }
            const rms = Math.sqrt(sumSq / lastDim + this.eps);

            // Normalize and scale
            for (let i = 0; i < lastDim; i++) {
                result[offset + i] = (x.data[offset + i] / rms) * this.weight.data[i];
            }
        }

        return new Tensor(result, shape);
    }

    loadWeights(weights) {
        if (weights.weight) {
            this.weight = new Tensor(new Float32Array(weights.weight), [this.dim]);
        }
    }

    numParams() {
        return this.dim;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LayerNorm, RMSNorm };
}
