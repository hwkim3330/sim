import { Tensor } from '../tensor';
import { Layer, Weights } from './base';
import { sigmoid, tanh } from '../activations';

/**
 * GRU Cell - Single timestep computation
 */
export class GRUCell extends Layer {
  readonly inputDim: number;
  readonly hiddenDim: number;

  constructor(inputDim: number, hiddenDim: number) {
    super();
    this.inputDim = inputDim;
    this.hiddenDim = hiddenDim;

    const scaleIH = Math.sqrt(2.0 / (inputDim + hiddenDim));
    const scaleHH = Math.sqrt(2.0 / (hiddenDim + hiddenDim));

    // Gates: [reset, update, new] concatenated
    this.params.weight_ih = Tensor.randn([3 * hiddenDim, inputDim]).mul(scaleIH);
    this.params.weight_hh = Tensor.randn([3 * hiddenDim, hiddenDim]).mul(scaleHH);
    this.params.bias_ih = Tensor.zeros([3 * hiddenDim]);
    this.params.bias_hh = Tensor.zeros([3 * hiddenDim]);
  }

  forward(x: Tensor, h: Tensor): Tensor {
    const batch = x.shape[0];
    const hd = this.hiddenDim;

    // Compute gates
    const gi = x.matmul(this.params.weight_ih.transpose()).add(this.params.bias_ih);
    const gh = h.matmul(this.params.weight_hh.transpose()).add(this.params.bias_hh);

    // Split gates
    const gi_r = new Tensor(gi.data.slice(0, batch * hd), [batch, hd]);
    const gi_z = new Tensor(gi.data.slice(batch * hd, 2 * batch * hd), [batch, hd]);
    const gi_n = new Tensor(gi.data.slice(2 * batch * hd), [batch, hd]);

    const gh_r = new Tensor(gh.data.slice(0, batch * hd), [batch, hd]);
    const gh_z = new Tensor(gh.data.slice(batch * hd, 2 * batch * hd), [batch, hd]);
    const gh_n = new Tensor(gh.data.slice(2 * batch * hd), [batch, hd]);

    // Reset gate: r = sigmoid(gi_r + gh_r)
    const r = sigmoid(gi_r.add(gh_r));

    // Update gate: z = sigmoid(gi_z + gh_z)
    const z = sigmoid(gi_z.add(gh_z));

    // New gate: n = tanh(gi_n + r * gh_n)
    const n = tanh(gi_n.add(r.mul(gh_n)));

    // Hidden state: h' = (1 - z) * n + z * h
    const oneMinusZ = z.mul(-1).add(1);
    return oneMinusZ.mul(n).add(z.mul(h));
  }
}

export interface GRUOptions {
  /** Number of stacked GRU layers */
  numLayers?: number;
  /** Use bidirectional GRU */
  bidirectional?: boolean;
}

export interface GRUOutput {
  /** Output tensor [batch, seqLen, hiddenDim] */
  output: Tensor;
  /** Final hidden states [numLayers, batch, hiddenDim] */
  hidden: Tensor;
}

/**
 * GRU (Gated Recurrent Unit) Layer
 */
export class GRU extends Layer {
  readonly inputDim: number;
  readonly hiddenDim: number;
  readonly numLayers: number;
  readonly bidirectional: boolean;
  readonly cells: GRUCell[];

  constructor(inputDim: number, hiddenDim: number, options: GRUOptions = {}) {
    super();

    if (!Number.isInteger(inputDim) || inputDim <= 0) {
      throw new Error(`inputDim must be a positive integer, got ${inputDim}`);
    }
    if (!Number.isInteger(hiddenDim) || hiddenDim <= 0) {
      throw new Error(`hiddenDim must be a positive integer, got ${hiddenDim}`);
    }

    this.inputDim = inputDim;
    this.hiddenDim = hiddenDim;
    this.numLayers = options.numLayers || 1;
    this.bidirectional = options.bidirectional || false;

    // Create GRU cells for each layer
    this.cells = [];
    for (let i = 0; i < this.numLayers; i++) {
      const cellInputDim = i === 0 ? inputDim : hiddenDim * (this.bidirectional ? 2 : 1);
      this.cells.push(new GRUCell(cellInputDim, hiddenDim));

      if (this.bidirectional) {
        this.cells.push(new GRUCell(cellInputDim, hiddenDim));
      }
    }
  }

  forward(x: Tensor, h0: Tensor | null = null): GRUOutput {
    const [batch, seqLen] = x.shape;
    const numDirections = this.bidirectional ? 2 : 1;

    // Initialize hidden state if not provided
    if (h0 === null) {
      h0 = Tensor.zeros([this.numLayers * numDirections, batch, this.hiddenDim]);
    }

    let output = x;
    const hiddenStates: Tensor[] = [];

    for (let layer = 0; layer < this.numLayers; layer++) {
      const cellIdx = layer * numDirections;

      // Get initial hidden state for this layer
      let hForward = new Tensor(
        h0.data.slice(cellIdx * batch * this.hiddenDim, (cellIdx + 1) * batch * this.hiddenDim),
        [batch, this.hiddenDim]
      );

      // Process sequence forward
      const forwardOutputs: Tensor[] = [];
      for (let t = 0; t < seqLen; t++) {
        const xt = new Tensor(
          output.data.slice(t * batch * output.shape[2], (t + 1) * batch * output.shape[2]),
          [batch, output.shape[2]]
        );
        hForward = this.cells[cellIdx].forward(xt, hForward);
        forwardOutputs.push(hForward.clone());
      }

      // Collect outputs
      const outputData = new Float32Array(batch * seqLen * this.hiddenDim);
      for (let t = 0; t < seqLen; t++) {
        outputData.set(forwardOutputs[t].data, t * batch * this.hiddenDim);
      }
      output = new Tensor(outputData, [batch, seqLen, this.hiddenDim]);
      hiddenStates.push(hForward.clone());
    }

    // Stack hidden states
    const hnData = new Float32Array(hiddenStates.length * batch * this.hiddenDim);
    for (let i = 0; i < hiddenStates.length; i++) {
      hnData.set(hiddenStates[i].data, i * batch * this.hiddenDim);
    }
    const hn = new Tensor(hnData, [hiddenStates.length, batch, this.hiddenDim]);

    return { output, hidden: hn };
  }

  /** Get only the last output */
  forwardLast(x: Tensor, h0: Tensor | null = null): Tensor {
    const { output } = this.forward(x, h0);
    const [batch, seqLen, hiddenDim] = output.shape;

    const lastOutput = new Float32Array(batch * hiddenDim);
    for (let b = 0; b < batch; b++) {
      for (let h = 0; h < hiddenDim; h++) {
        lastOutput[b * hiddenDim + h] = output.data[(seqLen - 1) * batch * hiddenDim + b * hiddenDim + h];
      }
    }
    return new Tensor(lastOutput, [batch, hiddenDim]);
  }

  loadWeights(weights: Weights | Record<string, Weights>): void {
    for (let i = 0; i < this.cells.length; i++) {
      const cellWeights = (weights as Record<string, Weights>)[`cell_${i}`];
      if (cellWeights) {
        this.cells[i].loadWeights(cellWeights);
      }
    }
  }

  numParams(): number {
    return this.cells.reduce((sum, cell) => sum + cell.numParams(), 0);
  }
}
