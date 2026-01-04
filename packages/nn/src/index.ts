/**
 * @simi/nn
 * Simi Platform Neural Network - Pure TypeScript neural network library
 *
 * @packageDocumentation
 */

// Tensor
export { Tensor } from './tensor';

// Activations
export {
  Activations,
  ActivationName,
  relu,
  leakyRelu,
  sigmoid,
  tanh,
  gelu,
  swish,
  softmax,
  getActivation,
} from './activations';

// Layers
export {
  Layer,
  Weights,
  Dense,
  DenseOptions,
  Embedding,
  EmbeddingOptions,
  GRU,
  GRUCell,
  GRUOptions,
  GRUOutput,
  LayerNorm,
  LayerNormOptions,
  Dropout,
} from './layers';

// Model containers
export { Sequential, ModelWeights } from './model';

// Serialization
export { Serializer } from './serializer';

// Re-export as namespace for convenience
import { Tensor } from './tensor';
import { Dense, Embedding, GRU, LayerNorm, Dropout, Layer } from './layers';
import { Sequential } from './model';

/** Layer factory functions */
export const layers = {
  Layer,
  Dense,
  Embedding,
  GRU,
  LayerNorm,
  Dropout,
};

/** Tensor factory functions */
export const tensor = {
  zeros: Tensor.zeros,
  ones: Tensor.ones,
  rand: Tensor.rand,
  randn: Tensor.randn,
  from: Tensor.from,
  concat: Tensor.concat,
};

/** Create a new Dense layer */
export function createDense(
  inputDim: number,
  outputDim: number,
  options?: import('./layers').DenseOptions
): Dense {
  return new Dense(inputDim, outputDim, options);
}

/** Create a new Embedding layer */
export function createEmbedding(
  numEmbeddings: number,
  embeddingDim: number,
  options?: import('./layers').EmbeddingOptions
): Embedding {
  return new Embedding(numEmbeddings, embeddingDim, options);
}

/** Create a new GRU layer */
export function createGRU(
  inputDim: number,
  hiddenDim: number,
  options?: import('./layers').GRUOptions
): GRU {
  return new GRU(inputDim, hiddenDim, options);
}

/** Create a new LayerNorm layer */
export function createLayerNorm(
  normalizedShape: number | number[],
  options?: import('./layers').LayerNormOptions
): LayerNorm {
  return new LayerNorm(normalizedShape, options);
}

/** Create a new Sequential model */
export function createSequential(layers: Layer[] = []): Sequential {
  return new Sequential(layers);
}

/** Library version */
export const VERSION = '1.0.0';
