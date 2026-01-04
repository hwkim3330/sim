import { Tensor } from '../tensor';
import { Layer } from './base';

/**
 * Dropout Layer
 * During inference (forward), this is a passthrough
 * Note: Training mode dropout not implemented (would require training loop)
 */
export class Dropout extends Layer {
  readonly p: number;

  constructor(p: number = 0.5) {
    super();

    if (p < 0 || p > 1) {
      throw new Error(`Dropout probability must be between 0 and 1, got ${p}`);
    }

    this.p = p;
  }

  forward(x: Tensor): Tensor {
    // No dropout during inference
    return x;
  }
}
