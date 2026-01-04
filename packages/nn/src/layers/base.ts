import { Tensor } from '../tensor';

/** Weight dictionary type */
export type Weights = Record<string, number[]>;

/**
 * Base Layer class
 * All neural network layers inherit from this
 */
export abstract class Layer {
  /** Whether layer is trainable */
  trainable: boolean = true;
  /** Layer parameters */
  params: Record<string, Tensor> = {};

  /** Forward pass - must be implemented by subclasses */
  abstract forward(x: Tensor): Tensor;

  /** Load weights from plain object */
  loadWeights(weights: Weights): void {
    for (const [key, value] of Object.entries(weights)) {
      if (this.params[key]) {
        const shape = this.params[key].shape;
        this.params[key] = new Tensor(new Float32Array(value), shape);
      }
    }
  }

  /** Get weights as plain object */
  getWeights(): Weights {
    const weights: Weights = {};
    for (const [key, tensor] of Object.entries(this.params)) {
      weights[key] = Array.from(tensor.data);
    }
    return weights;
  }

  /** Get total number of parameters */
  numParams(): number {
    return Object.values(this.params).reduce((sum, t) => sum + t.size, 0);
  }
}
