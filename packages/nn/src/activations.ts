import { Tensor } from './tensor';

export type ActivationName = 'relu' | 'leaky_relu' | 'sigmoid' | 'tanh' | 'gelu' | 'swish' | 'softmax' | 'none' | 'linear';

/** ReLU activation */
export function relu(t: Tensor): Tensor {
  return t.apply(x => Math.max(0, x));
}

/** Leaky ReLU activation */
export function leakyRelu(t: Tensor, alpha: number = 0.01): Tensor {
  return t.apply(x => x > 0 ? x : alpha * x);
}

/** Sigmoid activation */
export function sigmoid(t: Tensor): Tensor {
  return t.apply(x => 1 / (1 + Math.exp(-x)));
}

/** Tanh activation */
export function tanh(t: Tensor): Tensor {
  return t.apply(x => Math.tanh(x));
}

/** GELU activation (Gaussian Error Linear Unit) */
export function gelu(t: Tensor): Tensor {
  const sqrt2pi = Math.sqrt(2 / Math.PI);
  return t.apply(x => 0.5 * x * (1 + Math.tanh(sqrt2pi * (x + 0.044715 * x * x * x))));
}

/** Swish activation (SiLU) */
export function swish(t: Tensor): Tensor {
  return t.apply(x => x / (1 + Math.exp(-x)));
}

/** Softmax activation (along last axis) */
export function softmax(t: Tensor): Tensor {
  const shape = t.shape;
  const lastDim = shape[shape.length - 1];
  const outerSize = t.size / lastDim;
  const result = new Float32Array(t.size);

  for (let outer = 0; outer < outerSize; outer++) {
    const offset = outer * lastDim;

    // Find max for numerical stability
    let maxVal = -Infinity;
    for (let i = 0; i < lastDim; i++) {
      if (t.data[offset + i] > maxVal) maxVal = t.data[offset + i];
    }

    // Compute exp and sum
    let sum = 0;
    for (let i = 0; i < lastDim; i++) {
      result[offset + i] = Math.exp(t.data[offset + i] - maxVal);
      sum += result[offset + i];
    }

    // Normalize
    for (let i = 0; i < lastDim; i++) {
      result[offset + i] /= sum;
    }
  }
  return new Tensor(result, shape);
}

/** Get activation function by name */
export function getActivation(name: ActivationName): (t: Tensor) => Tensor {
  const fns: Record<string, (t: Tensor) => Tensor> = {
    'relu': relu,
    'leaky_relu': (t) => leakyRelu(t),
    'sigmoid': sigmoid,
    'tanh': tanh,
    'gelu': gelu,
    'swish': swish,
    'softmax': softmax,
    'none': (x) => x,
    'linear': (x) => x,
  };
  return fns[name] || fns['none'];
}

/** Activation functions namespace */
export const Activations = {
  relu,
  leakyRelu,
  sigmoid,
  tanh,
  gelu,
  swish,
  softmax,
  get: getActivation,
};
