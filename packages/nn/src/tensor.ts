/**
 * Multi-dimensional array class for neural network computations
 */
export class Tensor {
  /** Raw data storage */
  readonly data: Float32Array;
  /** Tensor dimensions */
  readonly shape: number[];
  /** Strides for indexing */
  readonly strides: number[];
  /** Total number of elements */
  readonly size: number;

  /**
   * Create a new Tensor
   * @param data - Float32Array, nested array, or fill value
   * @param shape - Shape of the tensor [dim1, dim2, ...]
   */
  constructor(data: Float32Array | number[] | number, shape: number[]) {
    validateShape(shape, 'shape');

    if (data instanceof Float32Array) {
      this.data = data;
    } else if (Array.isArray(data)) {
      this.data = new Float32Array(data.flat(Infinity) as number[]);
    } else if (typeof data === 'number') {
      if (!isFinite(data)) {
        throw new Error('Fill value must be a finite number');
      }
      const size = shape.reduce((a, b) => a * b, 1);
      this.data = new Float32Array(size).fill(data);
    } else {
      throw new Error(`Invalid data type for Tensor`);
    }

    const expectedSize = shape.reduce((a, b) => a * b, 1);
    if (this.data.length !== expectedSize) {
      throw new Error(`Data size ${this.data.length} doesn't match shape ${shape} (expected ${expectedSize})`);
    }

    this.shape = shape;
    this.strides = this._computeStrides(shape);
    this.size = this.data.length;
  }

  private _computeStrides(shape: number[]): number[] {
    const strides = new Array(shape.length);
    let stride = 1;
    for (let i = shape.length - 1; i >= 0; i--) {
      strides[i] = stride;
      stride *= shape[i];
    }
    return strides;
  }

  /** Get element at specified indices */
  get(...indices: number[]): number {
    let offset = 0;
    for (let i = 0; i < indices.length; i++) {
      offset += indices[i] * this.strides[i];
    }
    return this.data[offset];
  }

  /** Set element at specified indices */
  set(value: number, ...indices: number[]): this {
    let offset = 0;
    for (let i = 0; i < indices.length; i++) {
      offset += indices[i] * this.strides[i];
    }
    this.data[offset] = value;
    return this;
  }

  /** Reshape tensor to new shape */
  reshape(newShape: number[]): Tensor {
    const newSize = newShape.reduce((a, b) => a * b, 1);
    if (newSize !== this.size) {
      throw new Error(`Cannot reshape tensor of size ${this.size} to shape [${newShape}]`);
    }
    return new Tensor(this.data, newShape);
  }

  /** Transpose 2D tensor */
  transpose(): Tensor {
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
  add(other: Tensor | number): Tensor {
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
  sub(other: Tensor | number): Tensor {
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
  mul(other: Tensor | number): Tensor {
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
  div(other: Tensor | number): Tensor {
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

  private _broadcastOp(other: Tensor, op: (a: number, b: number) => number): Tensor {
    const result = new Float32Array(this.size);
    const otherSize = other.size;
    for (let i = 0; i < this.size; i++) {
      result[i] = op(this.data[i], other.data[i % otherSize]);
    }
    return new Tensor(result, this.shape);
  }

  /** Matrix multiplication (2D tensors only) */
  matmul(other: Tensor): Tensor {
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
  sum(axis: number | null = null): Tensor | number {
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
  mean(axis: number | null = null): Tensor | number {
    if (axis === null) {
      return (this.sum() as number) / this.size;
    }
    return (this.sum(axis) as Tensor).div(this.shape[axis]);
  }

  /** Max along axis */
  max(axis: number | null = null): Tensor | number {
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
  argmax(axis: number = -1): Tensor {
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
  apply(fn: (x: number) => number): Tensor {
    const result = new Float32Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = fn(this.data[i]);
    }
    return new Tensor(result, this.shape);
  }

  /** Clone tensor */
  clone(): Tensor {
    return new Tensor(new Float32Array(this.data), [...this.shape]);
  }

  /** Convert to JavaScript array */
  toArray(): number[] | number[][] {
    if (this.shape.length === 1) {
      return Array.from(this.data);
    }
    if (this.shape.length === 2) {
      const result: number[][] = [];
      for (let i = 0; i < this.shape[0]; i++) {
        result.push(Array.from(this.data.slice(i * this.shape[1], (i + 1) * this.shape[1])));
      }
      return result;
    }
    return Array.from(this.data);
  }

  toString(): string {
    return `Tensor(shape=[${this.shape}], dtype=float32)`;
  }

  // Static factory methods

  /** Create tensor filled with zeros */
  static zeros(shape: number[]): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    return new Tensor(new Float32Array(size), shape);
  }

  /** Create tensor filled with ones */
  static ones(shape: number[]): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    return new Tensor(new Float32Array(size).fill(1), shape);
  }

  /** Create tensor with random uniform values */
  static rand(shape: number[]): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = Math.random();
    }
    return new Tensor(data, shape);
  }

  /** Create tensor with random normal values (Box-Muller) */
  static randn(shape: number[]): Tensor {
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      const u1 = Math.random();
      const u2 = Math.random();
      data[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    return new Tensor(data, shape);
  }

  /** Create tensor from nested array */
  static from(array: number | number[] | number[][]): Tensor {
    if (!Array.isArray(array)) {
      return new Tensor(new Float32Array([array]), [1]);
    }
    const shape: number[] = [];
    let current: unknown = array;
    while (Array.isArray(current)) {
      shape.push(current.length);
      current = current[0];
    }
    return new Tensor(array as number[], shape);
  }

  /** Concatenate tensors along axis */
  static concat(tensors: Tensor[], axis: number = 0): Tensor {
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

function validateShape(shape: number[], name: string = 'shape'): void {
  if (!Array.isArray(shape)) {
    throw new Error(`${name} must be an array`);
  }
  if (shape.length === 0) {
    throw new Error(`${name} cannot be empty`);
  }
  for (let i = 0; i < shape.length; i++) {
    if (!Number.isInteger(shape[i]) || shape[i] <= 0) {
      throw new Error(`${name}[${i}] must be a positive integer, got ${shape[i]}`);
    }
  }
}
