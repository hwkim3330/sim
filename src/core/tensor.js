/**
 * SimNN - Pure JavaScript Neural Network Library
 * Tensor operations for browser-based inference
 */

class Tensor {
    constructor(data, shape) {
        if (data instanceof Float32Array) {
            this.data = data;
        } else if (Array.isArray(data)) {
            this.data = new Float32Array(data.flat(Infinity));
        } else if (typeof data === 'number') {
            this.data = new Float32Array(shape.reduce((a, b) => a * b, 1)).fill(data);
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

    // Get element at indices
    get(...indices) {
        let offset = 0;
        for (let i = 0; i < indices.length; i++) {
            offset += indices[i] * this.strides[i];
        }
        return this.data[offset];
    }

    // Set element at indices
    set(value, ...indices) {
        let offset = 0;
        for (let i = 0; i < indices.length; i++) {
            offset += indices[i] * this.strides[i];
        }
        this.data[offset] = value;
    }

    // Reshape tensor
    reshape(newShape) {
        const newSize = newShape.reduce((a, b) => a * b, 1);
        if (newSize !== this.size) {
            throw new Error(`Cannot reshape tensor of size ${this.size} to shape [${newShape}]`);
        }
        return new Tensor(this.data, newShape);
    }

    // Transpose (2D only for now)
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

    // Element-wise addition
    add(other) {
        if (other instanceof Tensor) {
            if (this.size !== other.size) {
                return this._broadcastAdd(other);
            }
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] + other.data[i];
            }
            return new Tensor(result, this.shape);
        } else {
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] + other;
            }
            return new Tensor(result, this.shape);
        }
    }

    // Broadcast addition for bias
    _broadcastAdd(other) {
        const result = new Float32Array(this.size);
        const otherSize = other.size;
        for (let i = 0; i < this.size; i++) {
            result[i] = this.data[i] + other.data[i % otherSize];
        }
        return new Tensor(result, this.shape);
    }

    // Element-wise multiplication
    mul(other) {
        if (other instanceof Tensor) {
            if (this.size !== other.size) {
                return this._broadcastMul(other);
            }
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] * other.data[i];
            }
            return new Tensor(result, this.shape);
        } else {
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] * other;
            }
            return new Tensor(result, this.shape);
        }
    }

    _broadcastMul(other) {
        const result = new Float32Array(this.size);
        const otherSize = other.size;
        for (let i = 0; i < this.size; i++) {
            result[i] = this.data[i] * other.data[i % otherSize];
        }
        return new Tensor(result, this.shape);
    }

    // Element-wise subtraction
    sub(other) {
        if (other instanceof Tensor) {
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] - other.data[i];
            }
            return new Tensor(result, this.shape);
        } else {
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] - other;
            }
            return new Tensor(result, this.shape);
        }
    }

    // Element-wise division
    div(other) {
        if (other instanceof Tensor) {
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] / other.data[i];
            }
            return new Tensor(result, this.shape);
        } else {
            const result = new Float32Array(this.size);
            for (let i = 0; i < this.size; i++) {
                result[i] = this.data[i] / other;
            }
            return new Tensor(result, this.shape);
        }
    }

    // Matrix multiplication (2D)
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

    // Batch matrix multiplication
    bmm(other) {
        if (this.shape.length !== 3 || other.shape.length !== 3) {
            throw new Error('BMM requires 3D tensors');
        }
        const [batch, m, k1] = this.shape;
        const [batch2, k2, n] = other.shape;
        if (batch !== batch2 || k1 !== k2) {
            throw new Error('BMM shape mismatch');
        }

        const result = new Float32Array(batch * m * n);
        for (let b = 0; b < batch; b++) {
            for (let i = 0; i < m; i++) {
                for (let j = 0; j < n; j++) {
                    let sum = 0;
                    for (let k = 0; k < k1; k++) {
                        sum += this.data[b * m * k1 + i * k1 + k] *
                               other.data[b * k2 * n + k * n + j];
                    }
                    result[b * m * n + i * n + j] = sum;
                }
            }
        }
        return new Tensor(result, [batch, m, n]);
    }

    // Sum along axis
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

    // Mean along axis
    mean(axis = null) {
        if (axis === null) {
            return this.sum() / this.size;
        }
        const sumTensor = this.sum(axis);
        return sumTensor.div(this.shape[axis]);
    }

    // Max along axis
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

    // Argmax along axis
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

    // Concatenate tensors along axis
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

    // Create tensor filled with zeros
    static zeros(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        return new Tensor(new Float32Array(size), shape);
    }

    // Create tensor filled with ones
    static ones(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        return new Tensor(new Float32Array(size).fill(1), shape);
    }

    // Create tensor with random values
    static rand(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            data[i] = Math.random();
        }
        return new Tensor(data, shape);
    }

    // Create tensor with random normal values
    static randn(shape) {
        const size = shape.reduce((a, b) => a * b, 1);
        const data = new Float32Array(size);
        for (let i = 0; i < size; i++) {
            // Box-Muller transform
            const u1 = Math.random();
            const u2 = Math.random();
            data[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        }
        return new Tensor(data, shape);
    }

    // Clone tensor
    clone() {
        return new Tensor(new Float32Array(this.data), [...this.shape]);
    }

    // Slice tensor
    slice(start, end) {
        const newShape = this.shape.map((s, i) => {
            const startIdx = start[i] || 0;
            const endIdx = end[i] || s;
            return endIdx - startIdx;
        });

        const resultSize = newShape.reduce((a, b) => a * b, 1);
        const result = new Float32Array(resultSize);

        // Simple 2D slice for now
        if (this.shape.length === 2) {
            const [startRow, startCol] = [start[0] || 0, start[1] || 0];
            const [endRow, endCol] = [end[0] || this.shape[0], end[1] || this.shape[1]];
            let idx = 0;
            for (let i = startRow; i < endRow; i++) {
                for (let j = startCol; j < endCol; j++) {
                    result[idx++] = this.data[i * this.shape[1] + j];
                }
            }
        }
        return new Tensor(result, newShape);
    }

    // Convert to array
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

    // String representation
    toString() {
        return `Tensor(shape=[${this.shape}], data=[${this.data.slice(0, 10).join(', ')}${this.size > 10 ? '...' : ''}])`;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Tensor;
}
