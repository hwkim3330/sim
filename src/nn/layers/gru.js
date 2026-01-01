/**
 * GRU (Gated Recurrent Unit) Layer
 * Efficient recurrent layer for sequence modeling
 */

class GRUCell {
    constructor(inputDim, hiddenDim) {
        this.inputDim = inputDim;
        this.hiddenDim = hiddenDim;

        // Gates: reset, update, new
        // Input weights [3 * hiddenDim, inputDim]
        // Hidden weights [3 * hiddenDim, hiddenDim]
        const scale_ih = Math.sqrt(2.0 / (inputDim + hiddenDim));
        const scale_hh = Math.sqrt(2.0 / (hiddenDim + hiddenDim));

        this.weight_ih = Tensor.randn([3 * hiddenDim, inputDim]).mul(scale_ih);
        this.weight_hh = Tensor.randn([3 * hiddenDim, hiddenDim]).mul(scale_hh);
        this.bias_ih = Tensor.zeros([3 * hiddenDim]);
        this.bias_hh = Tensor.zeros([3 * hiddenDim]);
    }

    forward(x, h) {
        // x: [batch, inputDim], h: [batch, hiddenDim]
        const batch = x.shape[0];

        // Compute input projection: [batch, 3*hiddenDim]
        const gi = x.matmul(this.weight_ih.transpose()).add(this.bias_ih);
        // Compute hidden projection: [batch, 3*hiddenDim]
        const gh = h.matmul(this.weight_hh.transpose()).add(this.bias_hh);

        // Split into gates
        const gi_r = new Tensor(gi.data.slice(0, batch * this.hiddenDim), [batch, this.hiddenDim]);
        const gi_z = new Tensor(gi.data.slice(batch * this.hiddenDim, 2 * batch * this.hiddenDim), [batch, this.hiddenDim]);
        const gi_n = new Tensor(gi.data.slice(2 * batch * this.hiddenDim), [batch, this.hiddenDim]);

        const gh_r = new Tensor(gh.data.slice(0, batch * this.hiddenDim), [batch, this.hiddenDim]);
        const gh_z = new Tensor(gh.data.slice(batch * this.hiddenDim, 2 * batch * this.hiddenDim), [batch, this.hiddenDim]);
        const gh_n = new Tensor(gh.data.slice(2 * batch * this.hiddenDim), [batch, this.hiddenDim]);

        // Reset gate: r = sigmoid(gi_r + gh_r)
        const r = Activations.sigmoid(gi_r.add(gh_r));
        // Update gate: z = sigmoid(gi_z + gh_z)
        const z = Activations.sigmoid(gi_z.add(gh_z));
        // New gate: n = tanh(gi_n + r * gh_n)
        const n = Activations.tanh(gi_n.add(r.mul(gh_n)));

        // New hidden state: h' = (1 - z) * n + z * h
        const oneMinusZ = z.mul(-1).add(1);
        const newH = oneMinusZ.mul(n).add(z.mul(h));

        return newH;
    }

    loadWeights(weights) {
        if (weights.weight_ih) {
            this.weight_ih = new Tensor(new Float32Array(weights.weight_ih), [3 * this.hiddenDim, this.inputDim]);
        }
        if (weights.weight_hh) {
            this.weight_hh = new Tensor(new Float32Array(weights.weight_hh), [3 * this.hiddenDim, this.hiddenDim]);
        }
        if (weights.bias_ih) {
            this.bias_ih = new Tensor(new Float32Array(weights.bias_ih), [3 * this.hiddenDim]);
        }
        if (weights.bias_hh) {
            this.bias_hh = new Tensor(new Float32Array(weights.bias_hh), [3 * this.hiddenDim]);
        }
    }

    numParams() {
        return 3 * this.hiddenDim * this.inputDim +
               3 * this.hiddenDim * this.hiddenDim +
               6 * this.hiddenDim;
    }
}

class GRU {
    constructor(inputDim, hiddenDim, options = {}) {
        this.inputDim = inputDim;
        this.hiddenDim = hiddenDim;
        this.numLayers = options.numLayers || 1;
        this.bidirectional = options.bidirectional || false;
        this.dropout = options.dropout || 0;

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

    forward(x, h0 = null) {
        // x: [batch, seqLen, inputDim]
        // h0: [numLayers * numDirections, batch, hiddenDim]
        const [batch, seqLen, _] = x.shape;
        const numDirections = this.bidirectional ? 2 : 1;

        // Initialize hidden states
        if (h0 === null) {
            h0 = Tensor.zeros([this.numLayers * numDirections, batch, this.hiddenDim]);
        }

        let output = x;
        const hiddenStates = [];

        for (let layer = 0; layer < this.numLayers; layer++) {
            const cellIdx = layer * numDirections;

            // Get initial hidden state for this layer
            let hForward = new Tensor(
                h0.data.slice(cellIdx * batch * this.hiddenDim, (cellIdx + 1) * batch * this.hiddenDim),
                [batch, this.hiddenDim]
            );

            // Forward pass
            const forwardOutputs = [];
            for (let t = 0; t < seqLen; t++) {
                // Get input at time t: [batch, inputDim]
                const xt = new Tensor(
                    output.data.slice(t * batch * output.shape[2], (t + 1) * batch * output.shape[2]),
                    [batch, output.shape[2]]
                );
                hForward = this.cells[cellIdx].forward(xt, hForward);
                forwardOutputs.push(hForward.clone());
            }

            let layerOutput;
            if (this.bidirectional) {
                let hBackward = new Tensor(
                    h0.data.slice((cellIdx + 1) * batch * this.hiddenDim, (cellIdx + 2) * batch * this.hiddenDim),
                    [batch, this.hiddenDim]
                );

                const backwardOutputs = [];
                for (let t = seqLen - 1; t >= 0; t--) {
                    const xt = new Tensor(
                        output.data.slice(t * batch * output.shape[2], (t + 1) * batch * output.shape[2]),
                        [batch, output.shape[2]]
                    );
                    hBackward = this.cells[cellIdx + 1].forward(xt, hBackward);
                    backwardOutputs.unshift(hBackward.clone());
                }

                // Concatenate forward and backward outputs
                const concatOutputs = [];
                for (let t = 0; t < seqLen; t++) {
                    const fwdData = forwardOutputs[t].data;
                    const bwdData = backwardOutputs[t].data;
                    const concat = new Float32Array(batch * this.hiddenDim * 2);
                    for (let b = 0; b < batch; b++) {
                        for (let h = 0; h < this.hiddenDim; h++) {
                            concat[b * this.hiddenDim * 2 + h] = fwdData[b * this.hiddenDim + h];
                            concat[b * this.hiddenDim * 2 + this.hiddenDim + h] = bwdData[b * this.hiddenDim + h];
                        }
                    }
                    concatOutputs.push(new Tensor(concat, [batch, this.hiddenDim * 2]));
                }

                // Stack outputs: [batch, seqLen, hiddenDim * 2]
                const outputData = new Float32Array(batch * seqLen * this.hiddenDim * 2);
                for (let t = 0; t < seqLen; t++) {
                    outputData.set(concatOutputs[t].data, t * batch * this.hiddenDim * 2);
                }
                layerOutput = new Tensor(outputData, [batch, seqLen, this.hiddenDim * 2]);

                hiddenStates.push(hForward.clone());
                hiddenStates.push(hBackward.clone());
            } else {
                // Stack forward outputs: [batch, seqLen, hiddenDim]
                const outputData = new Float32Array(batch * seqLen * this.hiddenDim);
                for (let t = 0; t < seqLen; t++) {
                    outputData.set(forwardOutputs[t].data, t * batch * this.hiddenDim);
                }
                layerOutput = new Tensor(outputData, [batch, seqLen, this.hiddenDim]);

                hiddenStates.push(hForward.clone());
            }

            output = layerOutput;
        }

        // Stack hidden states
        const hnData = new Float32Array(hiddenStates.length * batch * this.hiddenDim);
        for (let i = 0; i < hiddenStates.length; i++) {
            hnData.set(hiddenStates[i].data, i * batch * this.hiddenDim);
        }
        const hn = new Tensor(hnData, [hiddenStates.length, batch, this.hiddenDim]);

        return { output, hidden: hn };
    }

    // Get last output (useful for classification)
    forwardLast(x, h0 = null) {
        const { output } = this.forward(x, h0);
        const [batch, seqLen, hiddenDim] = output.shape;

        // Return last timestep: [batch, hiddenDim]
        const lastOutput = new Float32Array(batch * hiddenDim);
        for (let b = 0; b < batch; b++) {
            for (let h = 0; h < hiddenDim; h++) {
                lastOutput[b * hiddenDim + h] = output.data[(seqLen - 1) * batch * hiddenDim + b * hiddenDim + h];
            }
        }
        return new Tensor(lastOutput, [batch, hiddenDim]);
    }

    loadWeights(weights) {
        for (let i = 0; i < this.cells.length; i++) {
            if (weights[`cell_${i}`]) {
                this.cells[i].loadWeights(weights[`cell_${i}`]);
            }
        }
    }

    numParams() {
        return this.cells.reduce((sum, cell) => sum + cell.numParams(), 0);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GRU, GRUCell };
}
