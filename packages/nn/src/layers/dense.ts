import { Tensor } from '../tensor';
import { Layer } from './base';
import { ActivationName, getActivation } from '../activations';

export interface DenseOptions {
  /** Activation function name */
  activation?: ActivationName;
  /** Whether to use bias */
  bias?: boolean;
}

/**
 * Dense (Fully Connected) Layer
 * Performs Y = X * W + b followed by optional activation
 */
export class Dense extends Layer {
  readonly inputDim: number;
  readonly outputDim: number;
  readonly activation: ActivationName;
  readonly useBias: boolean;

  constructor(inputDim: number, outputDim: number, options: DenseOptions = {}) {
    super();

    if (!Number.isInteger(inputDim) || inputDim <= 0) {
      throw new Error(`inputDim must be a positive integer, got ${inputDim}`);
    }
    if (!Number.isInteger(outputDim) || outputDim <= 0) {
      throw new Error(`outputDim must be a positive integer, got ${outputDim}`);
    }

    this.inputDim = inputDim;
    this.outputDim = outputDim;
    this.activation = options.activation || 'none';
    this.useBias = options.bias !== false;

    // Xavier initialization
    const scale = Math.sqrt(2.0 / (inputDim + outputDim));
    this.params.weight = Tensor.randn([inputDim, outputDim]).mul(scale);

    if (this.useBias) {
      this.params.bias = Tensor.zeros([outputDim]);
    }
  }

  forward(x: Tensor): Tensor {
    const is1D = x.shape.length === 1;
    let input = is1D ? x.reshape([1, x.shape[0]]) : x;

    let output = input.matmul(this.params.weight);

    if (this.useBias) {
      output = output.add(this.params.bias);
    }

    if (this.activation !== 'none') {
      output = getActivation(this.activation)(output);
    }

    return is1D ? output.reshape([this.outputDim]) : output;
  }
}
