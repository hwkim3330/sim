/**
 * Dense (Fully Connected) Layer
 */

class Dense {
    constructor(inputDim, outputDim, options = {}) {
        this.inputDim = inputDim;
        this.outputDim = outputDim;
        this.useBias = options.bias !== false;
        this.activation = options.activation || 'none';

        // Initialize weights (Xavier initialization)
        const scale = Math.sqrt(2.0 / (inputDim + outputDim));
        this.weight = Tensor.randn([inputDim, outputDim]).mul(scale);

        if (this.useBias) {
            this.bias = Tensor.zeros([outputDim]);
        }
    }

    forward(x) {
        // x: [batch, inputDim] or [inputDim]
        const is1D = x.shape.length === 1;
        let input = is1D ? x.reshape([1, x.shape[0]]) : x;

        // Linear transformation: y = x @ W + b
        let output = input.matmul(this.weight);

        if (this.useBias) {
            output = output.add(this.bias);
        }

        // Apply activation
        if (this.activation !== 'none') {
            output = Activations.get(this.activation)(output);
        }

        return is1D ? output.reshape([this.outputDim]) : output;
    }

    // Load weights from object
    loadWeights(weights) {
        if (weights.weight) {
            this.weight = new Tensor(new Float32Array(weights.weight), [this.inputDim, this.outputDim]);
        }
        if (weights.bias && this.useBias) {
            this.bias = new Tensor(new Float32Array(weights.bias), [this.outputDim]);
        }
    }

    // Get number of parameters
    numParams() {
        let count = this.inputDim * this.outputDim;
        if (this.useBias) count += this.outputDim;
        return count;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Dense;
}
