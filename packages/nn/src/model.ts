import { Tensor } from './tensor';
import { Layer, Weights } from './layers/base';

/** Nested weights structure */
export type ModelWeights = Record<string, Weights>;

/**
 * Sequential Model Container
 * Chains layers in forward order
 */
export class Sequential {
  readonly layers: Layer[];

  constructor(layers: Layer[] = []) {
    this.layers = layers;
  }

  /** Add a layer to the model */
  add(layer: Layer): this {
    this.layers.push(layer);
    return this;
  }

  /** Forward pass through all layers */
  forward(x: Tensor): Tensor {
    let output = x;
    for (const layer of this.layers) {
      output = layer.forward(output);
    }
    return output;
  }

  /** Load weights for all layers */
  loadWeights(weights: ModelWeights): void {
    for (let i = 0; i < this.layers.length; i++) {
      const layerWeights = weights[`layer_${i}`];
      if (layerWeights) {
        this.layers[i].loadWeights(layerWeights);
      }
    }
  }

  /** Get weights from all layers */
  getWeights(): ModelWeights {
    const weights: ModelWeights = {};
    for (let i = 0; i < this.layers.length; i++) {
      weights[`layer_${i}`] = this.layers[i].getWeights();
    }
    return weights;
  }

  /** Total number of parameters */
  numParams(): number {
    return this.layers.reduce((sum, layer) => sum + layer.numParams(), 0);
  }

  /** Print model summary */
  summary(): void {
    console.log('Model Summary:');
    console.log('-'.repeat(50));
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      console.log(`Layer ${i}: ${layer.constructor.name} - ${layer.numParams()} params`);
    }
    console.log('-'.repeat(50));
    console.log(`Total params: ${this.numParams()}`);
  }
}
