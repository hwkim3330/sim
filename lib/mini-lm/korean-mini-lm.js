/**
 * Korean Mini Language Model
 *
 * A tiny character-level language model for Korean text generation.
 * Uses Jamo (자모) tokenization for small vocabulary.
 *
 * Architecture:
 *   Embedding(vocab_size, embed_dim) -> GRU(embed_dim, hidden_dim) -> Dense(hidden_dim, vocab_size)
 *
 * Target size: ~1-5MB
 *
 * @version 1.0.0
 * @license MIT
 */

(function(global) {
  'use strict';

  // ============================================================================
  // Korean Jamo Constants
  // ============================================================================

  // 초성 (19개)
  const CHOSEONG = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
    'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];

  // 중성 (21개)
  const JUNGSEONG = [
    'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
    'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
  ];

  // 종성 (28개, 첫번째는 없음)
  const JONGSEONG = [
    '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
    'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
    'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
  ];

  // Special tokens
  const SPECIAL_TOKENS = ['<PAD>', '<UNK>', '<BOS>', '<EOS>', ' ', '\n', '.', ',', '!', '?'];

  // Build vocabulary
  const VOCAB = [...SPECIAL_TOKENS, ...CHOSEONG, ...JUNGSEONG, ...JONGSEONG.slice(1)];
  const VOCAB_SIZE = VOCAB.length;

  // Token to index mapping
  const TOKEN_TO_IDX = {};
  const IDX_TO_TOKEN = {};
  VOCAB.forEach((token, idx) => {
    TOKEN_TO_IDX[token] = idx;
    IDX_TO_TOKEN[idx] = token;
  });

  // ============================================================================
  // Jamo Tokenizer
  // ============================================================================

  class JamoTokenizer {
    constructor() {
      this.vocabSize = VOCAB_SIZE;
      this.padIdx = TOKEN_TO_IDX['<PAD>'];
      this.unkIdx = TOKEN_TO_IDX['<UNK>'];
      this.bosIdx = TOKEN_TO_IDX['<BOS>'];
      this.eosIdx = TOKEN_TO_IDX['<EOS>'];
    }

    /**
     * Decompose Hangul syllable to Jamo
     */
    decomposeHangul(char) {
      const code = char.charCodeAt(0);
      if (code < 0xAC00 || code > 0xD7A3) return [char];

      const offset = code - 0xAC00;
      const cho = Math.floor(offset / 588);
      const jung = Math.floor((offset % 588) / 28);
      const jong = offset % 28;

      const result = [CHOSEONG[cho], JUNGSEONG[jung]];
      if (jong > 0) result.push(JONGSEONG[jong]);
      return result;
    }

    /**
     * Compose Jamo back to Hangul
     */
    composeHangul(cho, jung, jong = '') {
      const choIdx = CHOSEONG.indexOf(cho);
      const jungIdx = JUNGSEONG.indexOf(jung);
      const jongIdx = jong ? JONGSEONG.indexOf(jong) : 0;

      if (choIdx < 0 || jungIdx < 0) return cho + jung + jong;

      const code = 0xAC00 + choIdx * 588 + jungIdx * 28 + jongIdx;
      return String.fromCharCode(code);
    }

    /**
     * Tokenize text to token indices
     */
    encode(text, addBos = true, addEos = true) {
      const tokens = [];
      if (addBos) tokens.push(this.bosIdx);

      for (const char of text) {
        const code = char.charCodeAt(0);

        // Hangul syllable
        if (code >= 0xAC00 && code <= 0xD7A3) {
          const jamos = this.decomposeHangul(char);
          for (const jamo of jamos) {
            tokens.push(TOKEN_TO_IDX[jamo] ?? this.unkIdx);
          }
        }
        // Hangul Jamo
        else if (code >= 0x3131 && code <= 0x3163) {
          tokens.push(TOKEN_TO_IDX[char] ?? this.unkIdx);
        }
        // Special characters
        else if (TOKEN_TO_IDX[char] !== undefined) {
          tokens.push(TOKEN_TO_IDX[char]);
        }
        // Unknown
        else {
          tokens.push(this.unkIdx);
        }
      }

      if (addEos) tokens.push(this.eosIdx);
      return tokens;
    }

    /**
     * Decode token indices to text
     */
    decode(tokens) {
      let result = '';
      let jamoBuffer = [];

      const flushBuffer = () => {
        if (jamoBuffer.length >= 2) {
          const cho = jamoBuffer[0];
          const jung = jamoBuffer[1];
          const jong = jamoBuffer[2] || '';

          if (CHOSEONG.includes(cho) && JUNGSEONG.includes(jung)) {
            result += this.composeHangul(cho, jung, jong);
            jamoBuffer = [];
            return;
          }
        }
        result += jamoBuffer.join('');
        jamoBuffer = [];
      };

      for (const idx of tokens) {
        const token = IDX_TO_TOKEN[idx] || '';

        // Skip special tokens
        if (['<PAD>', '<UNK>', '<BOS>', '<EOS>'].includes(token)) continue;

        // Special characters
        if (SPECIAL_TOKENS.includes(token)) {
          flushBuffer();
          result += token;
          continue;
        }

        // Choseong
        if (CHOSEONG.includes(token)) {
          if (jamoBuffer.length >= 2) flushBuffer();
          if (jamoBuffer.length === 2 && JONGSEONG.includes(token)) {
            jamoBuffer.push(token);
          } else {
            flushBuffer();
            jamoBuffer.push(token);
          }
        }
        // Jungseong
        else if (JUNGSEONG.includes(token)) {
          if (jamoBuffer.length === 0) {
            // Standalone vowel
            result += token;
          } else if (jamoBuffer.length === 1) {
            jamoBuffer.push(token);
          } else if (jamoBuffer.length === 3) {
            // Move jongseong to next syllable if it's also a choseong
            const lastJong = jamoBuffer.pop();
            flushBuffer();
            if (CHOSEONG.includes(lastJong)) {
              jamoBuffer.push(lastJong);
            }
            jamoBuffer.push(token);
          } else {
            flushBuffer();
            jamoBuffer.push(token);
          }
        }
        // Jongseong
        else if (JONGSEONG.slice(1).includes(token)) {
          if (jamoBuffer.length === 2) {
            jamoBuffer.push(token);
          } else {
            flushBuffer();
            result += token;
          }
        }
      }

      flushBuffer();
      return result;
    }
  }

  // ============================================================================
  // Neural Network Layers (Pure JS, no dependencies)
  // ============================================================================

  /**
   * Xavier initialization
   */
  function xavierInit(shape) {
    const [fan_in, fan_out] = shape.length === 1 ? [shape[0], 1] : shape;
    const std = Math.sqrt(2.0 / (fan_in + fan_out));
    const size = shape.reduce((a, b) => a * b, 1);
    const data = new Float32Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = (Math.random() * 2 - 1) * std;
    }
    return data;
  }

  /**
   * Embedding Layer
   */
  class Embedding {
    constructor(vocabSize, embedDim) {
      this.vocabSize = vocabSize;
      this.embedDim = embedDim;
      this.weights = xavierInit([vocabSize, embedDim]);
    }

    forward(indices) {
      // indices: [seqLen] -> output: [seqLen, embedDim]
      const output = [];
      for (const idx of indices) {
        const start = idx * this.embedDim;
        output.push(Array.from(this.weights.slice(start, start + this.embedDim)));
      }
      return output;
    }

    getParams() {
      return { weights: this.weights };
    }

    setParams(params) {
      this.weights = new Float32Array(params.weights);
    }
  }

  /**
   * GRU Layer (Gated Recurrent Unit)
   */
  class GRU {
    constructor(inputDim, hiddenDim) {
      this.inputDim = inputDim;
      this.hiddenDim = hiddenDim;

      // Gates: [z, r, h] combined for efficiency
      // Input weights: [inputDim, 3 * hiddenDim]
      this.Wi = xavierInit([inputDim, 3 * hiddenDim]);
      // Hidden weights: [hiddenDim, 3 * hiddenDim]
      this.Wh = xavierInit([hiddenDim, 3 * hiddenDim]);
      // Biases: [3 * hiddenDim]
      this.bi = new Float32Array(3 * hiddenDim);
      this.bh = new Float32Array(3 * hiddenDim);
    }

    /**
     * Sigmoid activation
     */
    sigmoid(x) {
      return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    }

    /**
     * Tanh activation
     */
    tanh(x) {
      return Math.tanh(x);
    }

    /**
     * Forward pass for sequence
     */
    forward(inputs, h0 = null) {
      const seqLen = inputs.length;
      const h = h0 || new Float32Array(this.hiddenDim);
      const outputs = [];

      for (let t = 0; t < seqLen; t++) {
        const x = inputs[t];
        const newH = this.step(x, h);
        outputs.push(Array.from(newH));
        h.set(newH);
      }

      return { outputs, lastHidden: Array.from(h) };
    }

    /**
     * Single step
     */
    step(x, h) {
      const hd = this.hiddenDim;

      // Compute gates
      const gates_i = new Float32Array(3 * hd);
      const gates_h = new Float32Array(3 * hd);

      // Input contribution
      for (let j = 0; j < 3 * hd; j++) {
        let sum = this.bi[j];
        for (let i = 0; i < this.inputDim; i++) {
          sum += x[i] * this.Wi[i * 3 * hd + j];
        }
        gates_i[j] = sum;
      }

      // Hidden contribution
      for (let j = 0; j < 3 * hd; j++) {
        let sum = this.bh[j];
        for (let i = 0; i < hd; i++) {
          sum += h[i] * this.Wh[i * 3 * hd + j];
        }
        gates_h[j] = sum;
      }

      // Update gate z
      const z = new Float32Array(hd);
      for (let i = 0; i < hd; i++) {
        z[i] = this.sigmoid(gates_i[i] + gates_h[i]);
      }

      // Reset gate r
      const r = new Float32Array(hd);
      for (let i = 0; i < hd; i++) {
        r[i] = this.sigmoid(gates_i[hd + i] + gates_h[hd + i]);
      }

      // Candidate hidden state
      const hTilde = new Float32Array(hd);
      for (let i = 0; i < hd; i++) {
        hTilde[i] = this.tanh(gates_i[2 * hd + i] + r[i] * gates_h[2 * hd + i]);
      }

      // New hidden state
      const newH = new Float32Array(hd);
      for (let i = 0; i < hd; i++) {
        newH[i] = (1 - z[i]) * h[i] + z[i] * hTilde[i];
      }

      return newH;
    }

    getParams() {
      return {
        Wi: this.Wi, Wh: this.Wh,
        bi: this.bi, bh: this.bh
      };
    }

    setParams(params) {
      this.Wi = new Float32Array(params.Wi);
      this.Wh = new Float32Array(params.Wh);
      this.bi = new Float32Array(params.bi);
      this.bh = new Float32Array(params.bh);
    }
  }

  /**
   * Dense (Linear) Layer
   */
  class Dense {
    constructor(inputDim, outputDim) {
      this.inputDim = inputDim;
      this.outputDim = outputDim;
      this.weights = xavierInit([inputDim, outputDim]);
      this.bias = new Float32Array(outputDim);
    }

    forward(input) {
      const output = new Float32Array(this.outputDim);
      for (let j = 0; j < this.outputDim; j++) {
        let sum = this.bias[j];
        for (let i = 0; i < this.inputDim; i++) {
          sum += input[i] * this.weights[i * this.outputDim + j];
        }
        output[j] = sum;
      }
      return output;
    }

    getParams() {
      return { weights: this.weights, bias: this.bias };
    }

    setParams(params) {
      this.weights = new Float32Array(params.weights);
      this.bias = new Float32Array(params.bias);
    }
  }

  // ============================================================================
  // Korean Mini LM Model
  // ============================================================================

  class KoreanMiniLM {
    constructor(config = {}) {
      this.config = {
        vocabSize: VOCAB_SIZE,
        embedDim: config.embedDim || 128,
        hiddenDim: config.hiddenDim || 256,
        ...config
      };

      this.tokenizer = new JamoTokenizer();

      // Build model
      this.embedding = new Embedding(this.config.vocabSize, this.config.embedDim);
      this.gru = new GRU(this.config.embedDim, this.config.hiddenDim);
      this.output = new Dense(this.config.hiddenDim, this.config.vocabSize);

      // Calculate parameter count
      this.paramCount = this.countParams();
    }

    countParams() {
      const embed = this.config.vocabSize * this.config.embedDim;
      const gru = this.config.embedDim * 3 * this.config.hiddenDim +
                  this.config.hiddenDim * 3 * this.config.hiddenDim +
                  6 * this.config.hiddenDim;
      const dense = this.config.hiddenDim * this.config.vocabSize + this.config.vocabSize;
      return embed + gru + dense;
    }

    /**
     * Softmax
     */
    softmax(logits) {
      const maxLogit = Math.max(...logits);
      const exps = logits.map(l => Math.exp(l - maxLogit));
      const sum = exps.reduce((a, b) => a + b, 0);
      return exps.map(e => e / sum);
    }

    /**
     * Sample from probability distribution
     */
    sample(probs, temperature = 1.0) {
      if (temperature <= 0) {
        // Greedy
        return probs.indexOf(Math.max(...probs));
      }

      // Apply temperature
      const logits = probs.map(p => Math.log(p + 1e-10) / temperature);
      const scaled = this.softmax(logits);

      // Sample
      const r = Math.random();
      let cumsum = 0;
      for (let i = 0; i < scaled.length; i++) {
        cumsum += scaled[i];
        if (r < cumsum) return i;
      }
      return scaled.length - 1;
    }

    /**
     * Generate text
     */
    generate(prompt = '', maxLength = 100, temperature = 0.8) {
      // Encode prompt
      let tokens = prompt
        ? this.tokenizer.encode(prompt, true, false)
        : [this.tokenizer.bosIdx];

      let hidden = null;

      // Process prompt
      if (tokens.length > 1) {
        const embeddings = this.embedding.forward(tokens);
        const { lastHidden } = this.gru.forward(embeddings);
        hidden = new Float32Array(lastHidden);
      }

      // Generate
      const generated = [...tokens];
      let currentToken = tokens[tokens.length - 1];

      for (let i = 0; i < maxLength; i++) {
        // Embed current token
        const embed = this.embedding.forward([currentToken])[0];

        // GRU step
        const newHidden = this.gru.step(embed, hidden || new Float32Array(this.config.hiddenDim));
        hidden = newHidden;

        // Output projection
        const logits = this.output.forward(newHidden);
        const probs = this.softmax(Array.from(logits));

        // Sample next token
        currentToken = this.sample(probs, temperature);
        generated.push(currentToken);

        // Stop at EOS
        if (currentToken === this.tokenizer.eosIdx) break;
      }

      return this.tokenizer.decode(generated);
    }

    /**
     * Calculate loss for training (cross-entropy)
     */
    calculateLoss(text) {
      const tokens = this.tokenizer.encode(text);
      if (tokens.length < 2) return 0;

      const embeddings = this.embedding.forward(tokens.slice(0, -1));
      const { outputs } = this.gru.forward(embeddings);

      let totalLoss = 0;
      for (let i = 0; i < outputs.length; i++) {
        const logits = this.output.forward(outputs[i]);
        const probs = this.softmax(Array.from(logits));
        const target = tokens[i + 1];
        totalLoss -= Math.log(probs[target] + 1e-10);
      }

      return totalLoss / outputs.length;
    }

    /**
     * Save model to JSON
     */
    save() {
      return {
        config: this.config,
        embedding: this.embedding.getParams(),
        gru: this.gru.getParams(),
        output: this.output.getParams(),
      };
    }

    /**
     * Load model from JSON
     */
    load(data) {
      this.config = data.config;
      this.embedding.setParams(data.embedding);
      this.gru.setParams(data.gru);
      this.output.setParams(data.output);
    }

    /**
     * Export to binary format (smaller file size)
     */
    exportBinary() {
      const params = this.save();
      const json = JSON.stringify(params.config);
      const jsonBytes = new TextEncoder().encode(json);

      // Calculate total size
      const embedSize = params.embedding.weights.length * 4;
      const gruSize = (params.gru.Wi.length + params.gru.Wh.length +
                       params.gru.bi.length + params.gru.bh.length) * 4;
      const denseSize = (params.output.weights.length + params.output.bias.length) * 4;

      const totalSize = 4 + jsonBytes.length + embedSize + gruSize + denseSize;
      const buffer = new ArrayBuffer(totalSize);
      const view = new DataView(buffer);
      let offset = 0;

      // Write config length
      view.setUint32(offset, jsonBytes.length, true);
      offset += 4;

      // Write config
      new Uint8Array(buffer, offset, jsonBytes.length).set(jsonBytes);
      offset += jsonBytes.length;

      // Write parameters
      const writeFloatArray = (arr) => {
        for (let i = 0; i < arr.length; i++) {
          view.setFloat32(offset, arr[i], true);
          offset += 4;
        }
      };

      writeFloatArray(params.embedding.weights);
      writeFloatArray(params.gru.Wi);
      writeFloatArray(params.gru.Wh);
      writeFloatArray(params.gru.bi);
      writeFloatArray(params.gru.bh);
      writeFloatArray(params.output.weights);
      writeFloatArray(params.output.bias);

      return buffer;
    }

    /**
     * Import from binary format
     */
    importBinary(buffer) {
      const view = new DataView(buffer);
      let offset = 0;

      // Read config
      const jsonLength = view.getUint32(offset, true);
      offset += 4;
      const jsonBytes = new Uint8Array(buffer, offset, jsonLength);
      const config = JSON.parse(new TextDecoder().decode(jsonBytes));
      offset += jsonLength;

      this.config = config;

      // Reinitialize layers
      this.embedding = new Embedding(config.vocabSize, config.embedDim);
      this.gru = new GRU(config.embedDim, config.hiddenDim);
      this.output = new Dense(config.hiddenDim, config.vocabSize);

      // Read parameters
      const readFloatArray = (size) => {
        const arr = new Float32Array(size);
        for (let i = 0; i < size; i++) {
          arr[i] = view.getFloat32(offset, true);
          offset += 4;
        }
        return arr;
      };

      this.embedding.weights = readFloatArray(config.vocabSize * config.embedDim);
      this.gru.Wi = readFloatArray(config.embedDim * 3 * config.hiddenDim);
      this.gru.Wh = readFloatArray(config.hiddenDim * 3 * config.hiddenDim);
      this.gru.bi = readFloatArray(3 * config.hiddenDim);
      this.gru.bh = readFloatArray(3 * config.hiddenDim);
      this.output.weights = readFloatArray(config.hiddenDim * config.vocabSize);
      this.output.bias = readFloatArray(config.vocabSize);
    }

    /**
     * Get model info
     */
    getInfo() {
      const sizeBytes = this.paramCount * 4; // float32
      return {
        vocabSize: this.config.vocabSize,
        embedDim: this.config.embedDim,
        hiddenDim: this.config.hiddenDim,
        paramCount: this.paramCount,
        sizeKB: (sizeBytes / 1024).toFixed(1),
        sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
      };
    }
  }

  // ============================================================================
  // Simple Trainer
  // ============================================================================

  class Trainer {
    constructor(model, config = {}) {
      this.model = model;
      this.lr = config.learningRate || 0.001;
      this.batchSize = config.batchSize || 32;
    }

    /**
     * Train on text corpus
     */
    async train(texts, epochs = 10, onProgress = null) {
      const history = [];

      for (let epoch = 0; epoch < epochs; epoch++) {
        let totalLoss = 0;
        let count = 0;

        for (const text of texts) {
          if (text.length < 3) continue;
          const loss = this.model.calculateLoss(text);
          totalLoss += loss;
          count++;

          // Note: This is forward-only, no actual weight updates
          // For real training, implement backpropagation
        }

        const avgLoss = count > 0 ? totalLoss / count : 0;
        history.push({ epoch: epoch + 1, loss: avgLoss });

        if (onProgress) {
          onProgress({ epoch: epoch + 1, loss: avgLoss, total: epochs });
        }

        // Yield to event loop
        await new Promise(r => setTimeout(r, 0));
      }

      return history;
    }
  }

  // ============================================================================
  // Export
  // ============================================================================

  const KoreanMiniLMLib = {
    KoreanMiniLM,
    JamoTokenizer,
    Trainer,
    Embedding,
    GRU,
    Dense,
    VOCAB,
    VOCAB_SIZE,
    version: '1.0.0',
  };

  // UMD export
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KoreanMiniLMLib;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return KoreanMiniLMLib; });
  } else {
    global.KoreanMiniLM = KoreanMiniLMLib;
  }

})(typeof self !== 'undefined' ? self : this);
