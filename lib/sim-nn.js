/**
 * SimNN - Pure JavaScript Neural Network Library
 * @version 1.0.0
 * @license MIT
 *
 * A lightweight neural network library for browser-based inference.
 * No dependencies, pure JavaScript implementation.
 *
 * @example
 * const model = SimNN.Sequential([
 *   SimNN.layers.Embedding(1000, 64),
 *   SimNN.layers.GRU(64, 128),
 *   SimNN.layers.Dense(128, 10, { activation: 'softmax' })
 * ]);
 * const output = model.forward(input);
 */

(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.SimNN = factory());
}(this, function() {
    'use strict';

    // ============================================================
    // TENSOR CLASS
    // ============================================================

    class Tensor {
        /**
         * Create a new Tensor
         * @param {Float32Array|Array|number} data - Data or fill value
         * @param {number[]} shape - Shape of the tensor
         */
        constructor(data, shape) {
            if (data instanceof Float32Array) {
                this.data = data;
            } else if (Array.isArray(data)) {
                this.data = new Float32Array(data.flat(Infinity));
            } else if (typeof data === 'number') {
                const size = shape.reduce((a, b) => a * b, 1);
                this.data = new Float32Array(size).fill(data);
            } else {
                throw new Error('Invalid data type for Tensor');
            }

            this.shape = shape;
            this.strides = this._computeStrides(shape);
            this.size = this.data.length;
        }

        _computeStrides(shape) {
            const strides = new Array(shape.length);
            let stride = 1;
            for (let i = shape.length - 1; i >= 0; i--) {
                strides[i] = stride;
                stride *= shape[i];
            }
            return strides;
        }

        /** Get element at indices */
        get(...indices) {
            let offset = 0;
            for (let i = 0; i < indices.length; i++) {
                offset += indices[i] * this.strides[i];
            }
            return this.data[offset];
        }

        /** Set element at indices */
        set(value, ...indices) {
            let offset = 0;
            for (let i = 0; i < indices.length; i++) {
                offset += indices[i] * this.strides[i];
            }
            this.data[offset] = value;
            return this;
        }

        /** Reshape tensor */
        reshape(newShape) {
            const newSize = newShape.reduce((a, b) => a * b, 1);
            if (newSize !== this.size) {
                throw new Error(`Cannot reshape tensor of size ${this.size} to shape [${newShape}]`);
            }
            return new Tensor(this.data, newShape);
        }

        /** Transpose 2D tensor */
        transpose() {
            if (this.shape.length !== 2) {
                throw new Error('Transpose only supported for 2D tensors');
            }
            const [rows, cols] = this.shape;
            const result = new Float32Array(this.size);
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    result[j * rows + i] = this.data[i * cols + j];
                }
            }
            return new Tensor(result, [cols, rows]);
        }

        /** Element-wise addition */
        add(other) {
            if (other instanceof Tensor) {
                if (this.size !== other.size) {
                    return this._broadcastOp(other, (a, b) => a + b);
                }
                const result = new Float32Array(this.size);
                for (let i = 0; i < this.size; i++) {
                    result[i] = this.data[i] + other.data[i];
                }
                return new Tensor(result, this.shape);
            }
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] + other;
            }
            return new Tensor(result, this.shape);
        }

        /** Element-wise subtraction */
        sub(other) {
            if (other instanceof Tensor) {
                const result = new Float32Array(this.size);
                for (let i = 0; i < this.size; i++) {
                    result[i] = this.data[i] - other.data[i];
                }
                return new Tensor(result, this.shape);
            }
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] - other;
            }
            return new Tensor(result, this.shape);
        }

        /** Element-wise multiplication */
        mul(other) {
            if (other instanceof Tensor) {
                if (this.size !== other.size) {
                    return this._broadcastOp(other, (a, b) => a * b);
                }
                const result = new Float32Array(this.size);
                for (let i = 0; i < this.size; i++) {
                    result[i] = this.data[i] * other.data[i];
                }
                return new Tensor(result, this.shape);
            }
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] * other;
            }
            return new Tensor(result, this.shape);
        }

        /** Element-wise division */
        div(other) {
            if (other instanceof Tensor) {
                const result = new Float32Array(this.size);
                for (let i = 0; i < this.size; i++) {
                    result[i] = this.data[i] / other.data[i];
                }
                return new Tensor(result, this.shape);
            }
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] / other;
            }
            return new Tensor(result, this.shape);
        }

        /** Broadcast operation */
        _broadcastOp(other, op) {
            const result = new Float32Array(this.size);
            const otherSize = other.size;
            for (let i = 0; i < this.size; i++) {
                result[i] = op(this.data[i], other.data[i % otherSize]);
            }
            return new Tensor(result, this.shape);
        }

        /** Matrix multiplication */
        matmul(other) {
            if (this.shape.length !== 2 || other.shape.length !== 2) {
                throw new Error('Matmul requires 2D tensors');
            }
            const [m, k1] = this.shape;
            const [k2, n] = other.shape;
            if (k1 !== k2) {
                throw new Error(`Matmul shape mismatch: [${m},${k1}] x [${k2},${n}]`);
            }

            const result = new Float32Array(m * n);
            for (let i = 0; i < m; i++) {
                for (let j = 0; j < n; j++) {
                    let sum = 0;
                    for (let k = 0; k < k1; k++) {
                        sum += this.data[i * k1 + k] * other.data[k * n + j];
                    }
                    result[i * n + j] = sum;
                }
            }
            return new Tensor(result, [m, n]);
        }

        /** Sum along axis */
        sum(axis = null) {
            if (axis === null) {
                let total = 0;
                for (let i = 0; i < this.size; i++) {
                    total += this.data[i];
                }
                return total;
            }

            const newShape = this.shape.filter((_, i) => i !== axis);
            const resultSize = newShape.reduce((a, b) => a * b, 1);
            const result = new Float32Array(resultSize);

            const axisSize = this.shape[axis];
            const outerSize = this.shape.slice(0, axis).reduce((a, b) => a * b, 1);
            const innerSize = this.shape.slice(axis + 1).reduce((a, b) => a * b, 1);

            for (let outer = 0; outer < outerSize; outer++) {
                for (let inner = 0; inner < innerSize; inner++) {
                    let sum = 0;
                    for (let a = 0; a < axisSize; a++) {
                        sum += this.data[outer * axisSize * innerSize + a * innerSize + inner];
                    }
                    result[outer * innerSize + inner] = sum;
                }
            }
            return new Tensor(result, newShape.length > 0 ? newShape : [1]);
        }

        /** Mean along axis */
        mean(axis = null) {
            if (axis === null) {
                return this.sum() / this.size;
            }
            return this.sum(axis).div(this.shape[axis]);
        }

        /** Max along axis */
        max(axis = null) {
            if (axis === null) {
                let maxVal = -Infinity;
                for (let i = 0; i < this.size; i++) {
                    if (this.data[i] > maxVal) maxVal = this.data[i];
                }
                return maxVal;
            }

            const newShape = this.shape.filter((_, i) => i !== axis);
            const resultSize = newShape.reduce((a, b) => a * b, 1);
            const result = new Float32Array(resultSize).fill(-Infinity);

            const axisSize = this.shape[axis];
            const outerSize = this.shape.slice(0, axis).reduce((a, b) => a * b, 1);
            const innerSize = this.shape.slice(axis + 1).reduce((a, b) => a * b, 1);

            for (let outer = 0; outer < outerSize; outer++) {
                for (let inner = 0; inner < innerSize; inner++) {
                    let maxVal = -Infinity;
                    for (let a = 0; a < axisSize; a++) {
                        const val = this.data[outer * axisSize * innerSize + a * innerSize + inner];
                        if (val > maxVal) maxVal = val;
                    }
                    result[outer * innerSize + inner] = maxVal;
                }
            }
            return new Tensor(result, newShape.length > 0 ? newShape : [1]);
        }

        /** Argmax along axis */
        argmax(axis = -1) {
            if (axis === -1) axis = this.shape.length - 1;

            const newShape = this.shape.filter((_, i) => i !== axis);
            const resultSize = newShape.reduce((a, b) => a * b, 1);
            const result = new Float32Array(resultSize);

            const axisSize = this.shape[axis];
            const outerSize = this.shape.slice(0, axis).reduce((a, b) => a * b, 1);
            const innerSize = this.shape.slice(axis + 1).reduce((a, b) => a * b, 1);

            for (let outer = 0; outer < outerSize; outer++) {
                for (let inner = 0; inner < innerSize; inner++) {
                    let maxVal = -Infinity;
                    let maxIdx = 0;
                    for (let a = 0; a < axisSize; a++) {
                        const val = this.data[outer * axisSize * innerSize + a * innerSize + inner];
                        if (val > maxVal) {
                            maxVal = val;
                            maxIdx = a;
                        }
                    }
                    result[outer * innerSize + inner] = maxIdx;
                }
            }
            return new Tensor(result, newShape.length > 0 ? newShape : [1]);
        }

        /** Apply function element-wise */
        apply(fn) {
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = fn(this.data[i]);
            }
            return new Tensor(result, this.shape);
        }

        /** Clone tensor */
        clone() {
            return new Tensor(new Float32Array(this.data), [...this.shape]);
        }

        /** Convert to JavaScript array */
        toArray() {
            if (this.shape.length === 1) {
                return Array.from(this.data);
            }
            if (this.shape.length === 2) {
                const result = [];
                for (let i = 0; i < this.shape[0]; i++) {
                    result.push(Array.from(this.data.slice(i * this.shape[1], (i + 1) * this.shape[1])));
                }
                return result;
            }
            return Array.from(this.data);
        }

        /** String representation */
        toString() {
            return `Tensor(shape=[${this.shape}], dtype=float32)`;
        }

        // Static factory methods

        /** Create tensor filled with zeros */
        static zeros(shape) {
            const size = shape.reduce((a, b) => a * b, 1);
            return new Tensor(new Float32Array(size), shape);
        }

        /** Create tensor filled with ones */
        static ones(shape) {
            const size = shape.reduce((a, b) => a * b, 1);
            return new Tensor(new Float32Array(size).fill(1), shape);
        }

        /** Create tensor with random uniform values */
        static rand(shape) {
            const size = shape.reduce((a, b) => a * b, 1);
            const data = new Float32Array(size);
            for (let i = 0; i < size; i++) {
                data[i] = Math.random();
            }
            return new Tensor(data, shape);
        }

        /** Create tensor with random normal values */
        static randn(shape) {
            const size = shape.reduce((a, b) => a * b, 1);
            const data = new Float32Array(size);
            for (let i = 0; i < size; i++) {
                const u1 = Math.random();
                const u2 = Math.random();
                data[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
            }
            return new Tensor(data, shape);
        }

        /** Create tensor from array */
        static from(array) {
            if (!Array.isArray(array)) {
                return new Tensor(new Float32Array([array]), [1]);
            }
            const shape = [];
            let current = array;
            while (Array.isArray(current)) {
                shape.push(current.length);
                current = current[0];
            }
            return new Tensor(array, shape);
        }

        /** Concatenate tensors along axis */
        static concat(tensors, axis = 0) {
            const shapes = tensors.map(t => t.shape);
            const newShape = [...shapes[0]];
            newShape[axis] = shapes.reduce((sum, s) => sum + s[axis], 0);

            const resultSize = newShape.reduce((a, b) => a * b, 1);
            const result = new Float32Array(resultSize);

            let offset = 0;
            for (const tensor of tensors) {
                for (let i = 0; i < tensor.size; i++) {
                    result[offset + i] = tensor.data[i];
                }
                offset += tensor.size;
            }
            return new Tensor(result, newShape);
        }
    }

    // ============================================================
    // ACTIVATION FUNCTIONS
    // ============================================================

    const Activations = {
        relu: (t) => t.apply(x => Math.max(0, x)),

        leakyRelu: (t, alpha = 0.01) => t.apply(x => x > 0 ? x : alpha * x),

        sigmoid: (t) => t.apply(x => 1 / (1 + Math.exp(-x))),

        tanh: (t) => t.apply(x => Math.tanh(x)),

        gelu: (t) => {
            const sqrt2pi = Math.sqrt(2 / Math.PI);
            return t.apply(x => 0.5 * x * (1 + Math.tanh(sqrt2pi * (x + 0.044715 * x * x * x))));
        },

        swish: (t) => t.apply(x => x / (1 + Math.exp(-x))),

        softmax: (t) => {
            const shape = t.shape;
            const lastDim = shape[shape.length - 1];
            const outerSize = t.size / lastDim;
            const result = new Float32Array(t.size);

            for (let outer = 0; outer < outerSize; outer++) {
                const offset = outer * lastDim;
                let maxVal = -Infinity;
                for (let i = 0; i < lastDim; i++) {
                    if (t.data[offset + i] > maxVal) maxVal = t.data[offset + i];
                }
                let sum = 0;
                for (let i = 0; i < lastDim; i++) {
                    result[offset + i] = Math.exp(t.data[offset + i] - maxVal);
                    sum += result[offset + i];
                }
                for (let i = 0; i < lastDim; i++) {
                    result[offset + i] /= sum;
                }
            }
            return new Tensor(result, shape);
        },

        get(name) {
            const fns = {
                'relu': this.relu,
                'leaky_relu': this.leakyRelu,
                'sigmoid': this.sigmoid,
                'tanh': this.tanh,
                'gelu': this.gelu,
                'swish': this.swish,
                'softmax': this.softmax,
                'none': (x) => x,
                'linear': (x) => x
            };
            return fns[name] || fns['none'];
        }
    };

    // ============================================================
    // LAYERS
    // ============================================================

    /** Base Layer class */
    class Layer {
        constructor() {
            this.trainable = true;
            this.params = {};
        }

        forward(x) {
            throw new Error('forward() must be implemented');
        }

        loadWeights(weights) {
            for (const [key, value] of Object.entries(weights)) {
                if (this.params[key]) {
                    const shape = this.params[key].shape;
                    this.params[key] = new Tensor(new Float32Array(value), shape);
                }
            }
        }

        getWeights() {
            const weights = {};
            for (const [key, tensor] of Object.entries(this.params)) {
                weights[key] = Array.from(tensor.data);
            }
            return weights;
        }

        numParams() {
            return Object.values(this.params).reduce((sum, t) => sum + t.size, 0);
        }
    }

    /** Dense (Fully Connected) Layer */
    class Dense extends Layer {
        constructor(inputDim, outputDim, options = {}) {
            super();
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

        forward(x) {
            const is1D = x.shape.length === 1;
            let input = is1D ? x.reshape([1, x.shape[0]]) : x;

            let output = input.matmul(this.params.weight);
            if (this.useBias) {
                output = output.add(this.params.bias);
            }

            if (this.activation !== 'none') {
                output = Activations.get(this.activation)(output);
            }

            return is1D ? output.reshape([this.outputDim]) : output;
        }
    }

    /** Embedding Layer */
    class Embedding extends Layer {
        constructor(numEmbeddings, embeddingDim, options = {}) {
            super();
            this.numEmbeddings = numEmbeddings;
            this.embeddingDim = embeddingDim;
            this.paddingIdx = options.paddingIdx;

            const scale = 1.0 / Math.sqrt(embeddingDim);
            this.params.weight = Tensor.randn([numEmbeddings, embeddingDim]).mul(scale);

            if (this.paddingIdx !== undefined) {
                for (let j = 0; j < embeddingDim; j++) {
                    this.params.weight.data[this.paddingIdx * embeddingDim + j] = 0;
                }
            }
        }

        forward(indices) {
            const is1D = indices.shape.length === 1;
            const seqLen = is1D ? indices.shape[0] : indices.shape[1];
            const batchSize = is1D ? 1 : indices.shape[0];

            const outputShape = is1D
                ? [seqLen, this.embeddingDim]
                : [batchSize, seqLen, this.embeddingDim];

            const result = new Float32Array(batchSize * seqLen * this.embeddingDim);

            for (let b = 0; b < batchSize; b++) {
                for (let s = 0; s < seqLen; s++) {
                    const idx = is1D ? indices.data[s] : indices.data[b * seqLen + s];
                    const srcOffset = Math.floor(idx) * this.embeddingDim;
                    const dstOffset = (b * seqLen + s) * this.embeddingDim;

                    for (let d = 0; d < this.embeddingDim; d++) {
                        result[dstOffset + d] = this.params.weight.data[srcOffset + d];
                    }
                }
            }

            return new Tensor(result, outputShape);
        }

        /** Get single embedding vector */
        getEmbedding(idx) {
            const result = new Float32Array(this.embeddingDim);
            const offset = idx * this.embeddingDim;
            for (let i = 0; i < this.embeddingDim; i++) {
                result[i] = this.params.weight.data[offset + i];
            }
            return new Tensor(result, [this.embeddingDim]);
        }

        /** Compute cosine similarity */
        cosineSimilarity(idx1, idx2) {
            const emb1 = this.getEmbedding(idx1);
            const emb2 = this.getEmbedding(idx2);

            let dot = 0, norm1 = 0, norm2 = 0;
            for (let i = 0; i < this.embeddingDim; i++) {
                dot += emb1.data[i] * emb2.data[i];
                norm1 += emb1.data[i] * emb1.data[i];
                norm2 += emb2.data[i] * emb2.data[i];
            }
            return dot / (Math.sqrt(norm1) * Math.sqrt(norm2) + 1e-8);
        }
    }

    /** GRU Cell */
    class GRUCell extends Layer {
        constructor(inputDim, hiddenDim) {
            super();
            this.inputDim = inputDim;
            this.hiddenDim = hiddenDim;

            const scaleIH = Math.sqrt(2.0 / (inputDim + hiddenDim));
            const scaleHH = Math.sqrt(2.0 / (hiddenDim + hiddenDim));

            this.params.weight_ih = Tensor.randn([3 * hiddenDim, inputDim]).mul(scaleIH);
            this.params.weight_hh = Tensor.randn([3 * hiddenDim, hiddenDim]).mul(scaleHH);
            this.params.bias_ih = Tensor.zeros([3 * hiddenDim]);
            this.params.bias_hh = Tensor.zeros([3 * hiddenDim]);
        }

        forward(x, h) {
            const batch = x.shape[0];
            const hd = this.hiddenDim;

            const gi = x.matmul(this.params.weight_ih.transpose()).add(this.params.bias_ih);
            const gh = h.matmul(this.params.weight_hh.transpose()).add(this.params.bias_hh);

            const gi_r = new Tensor(gi.data.slice(0, batch * hd), [batch, hd]);
            const gi_z = new Tensor(gi.data.slice(batch * hd, 2 * batch * hd), [batch, hd]);
            const gi_n = new Tensor(gi.data.slice(2 * batch * hd), [batch, hd]);

            const gh_r = new Tensor(gh.data.slice(0, batch * hd), [batch, hd]);
            const gh_z = new Tensor(gh.data.slice(batch * hd, 2 * batch * hd), [batch, hd]);
            const gh_n = new Tensor(gh.data.slice(2 * batch * hd), [batch, hd]);

            const r = Activations.sigmoid(gi_r.add(gh_r));
            const z = Activations.sigmoid(gi_z.add(gh_z));
            const n = Activations.tanh(gi_n.add(r.mul(gh_n)));

            const oneMinusZ = z.mul(-1).add(1);
            return oneMinusZ.mul(n).add(z.mul(h));
        }
    }

    /** GRU Layer */
    class GRU extends Layer {
        constructor(inputDim, hiddenDim, options = {}) {
            super();
            this.inputDim = inputDim;
            this.hiddenDim = hiddenDim;
            this.numLayers = options.numLayers || 1;
            this.bidirectional = options.bidirectional || false;

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
            const [batch, seqLen, _] = x.shape;
            const numDirections = this.bidirectional ? 2 : 1;

            if (h0 === null) {
                h0 = Tensor.zeros([this.numLayers * numDirections, batch, this.hiddenDim]);
            }

            let output = x;
            const hiddenStates = [];

            for (let layer = 0; layer < this.numLayers; layer++) {
                const cellIdx = layer * numDirections;
                let hForward = new Tensor(
                    h0.data.slice(cellIdx * batch * this.hiddenDim, (cellIdx + 1) * batch * this.hiddenDim),
                    [batch, this.hiddenDim]
                );

                const forwardOutputs = [];
                for (let t = 0; t < seqLen; t++) {
                    const xt = new Tensor(
                        output.data.slice(t * batch * output.shape[2], (t + 1) * batch * output.shape[2]),
                        [batch, output.shape[2]]
                    );
                    hForward = this.cells[cellIdx].forward(xt, hForward);
                    forwardOutputs.push(hForward.clone());
                }

                const outputData = new Float32Array(batch * seqLen * this.hiddenDim);
                for (let t = 0; t < seqLen; t++) {
                    outputData.set(forwardOutputs[t].data, t * batch * this.hiddenDim);
                }
                output = new Tensor(outputData, [batch, seqLen, this.hiddenDim]);
                hiddenStates.push(hForward.clone());
            }

            const hnData = new Float32Array(hiddenStates.length * batch * this.hiddenDim);
            for (let i = 0; i < hiddenStates.length; i++) {
                hnData.set(hiddenStates[i].data, i * batch * this.hiddenDim);
            }
            const hn = new Tensor(hnData, [hiddenStates.length, batch, this.hiddenDim]);

            return { output, hidden: hn };
        }

        /** Get last output only */
        forwardLast(x, h0 = null) {
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

    /** Layer Normalization */
    class LayerNorm extends Layer {
        constructor(normalizedShape, options = {}) {
            super();
            this.normalizedShape = Array.isArray(normalizedShape) ? normalizedShape : [normalizedShape];
            this.eps = options.eps || 1e-5;

            const size = this.normalizedShape.reduce((a, b) => a * b, 1);
            this.params.gamma = Tensor.ones([size]);
            this.params.beta = Tensor.zeros([size]);
        }

        forward(x) {
            const normalizedSize = this.normalizedShape.reduce((a, b) => a * b, 1);
            const outerSize = x.size / normalizedSize;
            const result = new Float32Array(x.size);

            for (let outer = 0; outer < outerSize; outer++) {
                const offset = outer * normalizedSize;
                let mean = 0;
                for (let i = 0; i < normalizedSize; i++) {
                    mean += x.data[offset + i];
                }
                mean /= normalizedSize;

                let variance = 0;
                for (let i = 0; i < normalizedSize; i++) {
                    const diff = x.data[offset + i] - mean;
                    variance += diff * diff;
                }
                variance /= normalizedSize;

                const stdInv = 1.0 / Math.sqrt(variance + this.eps);
                for (let i = 0; i < normalizedSize; i++) {
                    const normalized = (x.data[offset + i] - mean) * stdInv;
                    result[offset + i] = normalized * this.params.gamma.data[i] + this.params.beta.data[i];
                }
            }

            return new Tensor(result, x.shape);
        }
    }

    /** Dropout Layer (inference mode only - passthrough) */
    class Dropout extends Layer {
        constructor(p = 0.5) {
            super();
            this.p = p;
        }

        forward(x) {
            return x; // No dropout during inference
        }
    }

    // ============================================================
    // MODEL CONTAINERS
    // ============================================================

    /** Sequential Model */
    class Sequential {
        constructor(layers = []) {
            this.layers = layers;
        }

        add(layer) {
            this.layers.push(layer);
            return this;
        }

        forward(x) {
            let output = x;
            for (const layer of this.layers) {
                output = layer.forward(output);
            }
            return output;
        }

        loadWeights(weights) {
            for (let i = 0; i < this.layers.length; i++) {
                if (weights[`layer_${i}`]) {
                    this.layers[i].loadWeights(weights[`layer_${i}`]);
                }
            }
        }

        getWeights() {
            const weights = {};
            for (let i = 0; i < this.layers.length; i++) {
                weights[`layer_${i}`] = this.layers[i].getWeights();
            }
            return weights;
        }

        numParams() {
            return this.layers.reduce((sum, layer) => sum + layer.numParams(), 0);
        }

        summary() {
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

    // ============================================================
    // SERIALIZATION
    // ============================================================

    const Serializer = {
        /** Save model weights to JSON */
        toJSON(model) {
            return JSON.stringify(model.getWeights());
        },

        /** Load model weights from JSON */
        fromJSON(model, json) {
            const weights = typeof json === 'string' ? JSON.parse(json) : json;
            model.loadWeights(weights);
            return model;
        },

        /** Save to binary format */
        toBinary(model) {
            const weights = model.getWeights();
            const json = JSON.stringify(weights);
            const encoder = new TextEncoder();
            return encoder.encode(json);
        },

        /** Load from binary format */
        fromBinary(model, buffer) {
            const decoder = new TextDecoder();
            const json = decoder.decode(buffer);
            return this.fromJSON(model, json);
        }
    };

    // ============================================================
    // EXPORTS
    // ============================================================

    return {
        version: '1.0.0',

        // Core
        Tensor,

        // Activations
        Activations,

        // Layers
        layers: {
            Layer,
            Dense,
            Embedding,
            GRU,
            GRUCell,
            LayerNorm,
            Dropout
        },

        // Layer shortcuts
        Dense: (i, o, opts) => new Dense(i, o, opts),
        Embedding: (n, d, opts) => new Embedding(n, d, opts),
        GRU: (i, h, opts) => new GRU(i, h, opts),
        LayerNorm: (s, opts) => new LayerNorm(s, opts),

        // Models
        Sequential: (layers) => new Sequential(layers),

        // Serialization
        Serializer,

        // Utilities
        zeros: Tensor.zeros,
        ones: Tensor.ones,
        rand: Tensor.rand,
        randn: Tensor.randn,
        tensor: Tensor.from,
        concat: Tensor.concat
    };
}));
