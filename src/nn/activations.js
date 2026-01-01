/**
 * Activation Functions for Neural Network
 */

const Activations = {
    // ReLU: max(0, x)
    relu(tensor) {
        const result = new Float32Array(tensor.size);
        for (let i = 0; i < tensor.size; i++) {
            result[i] = Math.max(0, tensor.data[i]);
        }
        return new Tensor(result, tensor.shape);
    },

    // Leaky ReLU
    leakyRelu(tensor, alpha = 0.01) {
        const result = new Float32Array(tensor.size);
        for (let i = 0; i < tensor.size; i++) {
            result[i] = tensor.data[i] > 0 ? tensor.data[i] : alpha * tensor.data[i];
        }
        return new Tensor(result, tensor.shape);
    },

    // GELU: Gaussian Error Linear Unit
    gelu(tensor) {
        const result = new Float32Array(tensor.size);
        const sqrt2pi = Math.sqrt(2 / Math.PI);
        for (let i = 0; i < tensor.size; i++) {
            const x = tensor.data[i];
            result[i] = 0.5 * x * (1 + Math.tanh(sqrt2pi * (x + 0.044715 * x * x * x)));
        }
        return new Tensor(result, tensor.shape);
    },

    // Sigmoid: 1 / (1 + exp(-x))
    sigmoid(tensor) {
        const result = new Float32Array(tensor.size);
        for (let i = 0; i < tensor.size; i++) {
            result[i] = 1 / (1 + Math.exp(-tensor.data[i]));
        }
        return new Tensor(result, tensor.shape);
    },

    // Tanh
    tanh(tensor) {
        const result = new Float32Array(tensor.size);
        for (let i = 0; i < tensor.size; i++) {
            result[i] = Math.tanh(tensor.data[i]);
        }
        return new Tensor(result, tensor.shape);
    },

    // Softmax (along last axis)
    softmax(tensor) {
        const shape = tensor.shape;
        const lastDim = shape[shape.length - 1];
        const outerSize = tensor.size / lastDim;

        const result = new Float32Array(tensor.size);

        for (let outer = 0; outer < outerSize; outer++) {
            const offset = outer * lastDim;

            // Find max for numerical stability
            let maxVal = -Infinity;
            for (let i = 0; i < lastDim; i++) {
                if (tensor.data[offset + i] > maxVal) {
                    maxVal = tensor.data[offset + i];
                }
            }

            // Compute exp and sum
            let sum = 0;
            for (let i = 0; i < lastDim; i++) {
                result[offset + i] = Math.exp(tensor.data[offset + i] - maxVal);
                sum += result[offset + i];
            }

            // Normalize
            for (let i = 0; i < lastDim; i++) {
                result[offset + i] /= sum;
            }
        }

        return new Tensor(result, shape);
    },

    // Log softmax
    logSoftmax(tensor) {
        const shape = tensor.shape;
        const lastDim = shape[shape.length - 1];
        const outerSize = tensor.size / lastDim;

        const result = new Float32Array(tensor.size);

        for (let outer = 0; outer < outerSize; outer++) {
            const offset = outer * lastDim;

            // Find max for numerical stability
            let maxVal = -Infinity;
            for (let i = 0; i < lastDim; i++) {
                if (tensor.data[offset + i] > maxVal) {
                    maxVal = tensor.data[offset + i];
                }
            }

            // Compute log sum exp
            let sumExp = 0;
            for (let i = 0; i < lastDim; i++) {
                sumExp += Math.exp(tensor.data[offset + i] - maxVal);
            }
            const logSumExp = maxVal + Math.log(sumExp);

            // Compute log softmax
            for (let i = 0; i < lastDim; i++) {
                result[offset + i] = tensor.data[offset + i] - logSumExp;
            }
        }

        return new Tensor(result, shape);
    },

    // Swish: x * sigmoid(x)
    swish(tensor) {
        const result = new Float32Array(tensor.size);
        for (let i = 0; i < tensor.size; i++) {
            const x = tensor.data[i];
            result[i] = x / (1 + Math.exp(-x));
        }
        return new Tensor(result, tensor.shape);
    },

    // SiLU (same as Swish)
    silu(tensor) {
        return Activations.swish(tensor);
    },

    // Softplus: log(1 + exp(x))
    softplus(tensor) {
        const result = new Float32Array(tensor.size);
        for (let i = 0; i < tensor.size; i++) {
            const x = tensor.data[i];
            // Numerical stability
            if (x > 20) {
                result[i] = x;
            } else if (x < -20) {
                result[i] = Math.exp(x);
            } else {
                result[i] = Math.log(1 + Math.exp(x));
            }
        }
        return new Tensor(result, tensor.shape);
    },

    // Get activation function by name
    get(name) {
        const activations = {
            'relu': this.relu,
            'leaky_relu': this.leakyRelu,
            'gelu': this.gelu,
            'sigmoid': this.sigmoid,
            'tanh': this.tanh,
            'softmax': this.softmax,
            'log_softmax': this.logSoftmax,
            'swish': this.swish,
            'silu': this.silu,
            'softplus': this.softplus,
            'none': (x) => x,
            'linear': (x) => x
        };
        return activations[name] || activations['none'];
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Activations;
}
