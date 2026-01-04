import { Tensor } from '../tensor';
import { Layer } from './base';

export interface LayerNormOptions {
  /** Small epsilon for numerical stability */
  eps?: number;
}

/**
 * Layer Normalization
 * Normalizes across the last dimension(s)
 */
export class LayerNorm extends Layer {
  readonly normalizedShape: number[];
  readonly eps: number;

  constructor(normalizedShape: number | number[], options: LayerNormOptions = {}) {
    super();

    this.normalizedShape = Array.isArray(normalizedShape) ? normalizedShape : [normalizedShape];
    this.eps = options.eps || 1e-5;

    const size = this.normalizedShape.reduce((a, b) => a * b, 1);
    this.params.gamma = Tensor.ones([size]);
    this.params.beta = Tensor.zeros([size]);
  }

  forward(x: Tensor): Tensor {
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

      // Normalize and scale
      const stdInv = 1.0 / Math.sqrt(variance + this.eps);
      for (let i = 0; i < normalizedSize; i++) {
        const normalized = (x.data[offset + i] - mean) * stdInv;
        result[offset + i] = normalized * this.params.gamma.data[i] + this.params.beta.data[i];
      }
    }

    return new Tensor(result, x.shape);
  }
}
