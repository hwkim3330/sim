/**
 * Korean Mini LM - Training Module
 *
 * Implements:
 * - Backpropagation through time (BPTT)
 * - SGD optimizer with momentum
 * - Korean training corpus
 *
 * @version 1.0.0
 */

(function(global) {
  'use strict';

  // Get the base library
  const { KoreanMiniLM, JamoTokenizer, VOCAB_SIZE } = global.KoreanMiniLM || require('./korean-mini-lm.js');

  // ============================================================================
  // Korean Training Corpus
  // ============================================================================

  const KOREAN_CORPUS = [
    // 인사
    "안녕하세요",
    "안녕히 가세요",
    "안녕히 계세요",
    "반갑습니다",
    "처음 뵙겠습니다",
    "오랜만이에요",
    "잘 지내세요",
    "좋은 하루 되세요",
    "감사합니다",
    "고마워요",
    "죄송합니다",
    "미안해요",
    "괜찮아요",
    "네 알겠습니다",

    // 일상 대화
    "오늘 날씨가 좋아요",
    "오늘 날씨가 추워요",
    "오늘 날씨가 더워요",
    "비가 와요",
    "눈이 와요",
    "바람이 불어요",
    "하늘이 맑아요",
    "구름이 많아요",

    // 질문
    "이름이 뭐예요",
    "어디에서 왔어요",
    "몇 살이에요",
    "뭐 해요",
    "어디 가요",
    "언제 와요",
    "왜 그래요",
    "어떻게 해요",

    // 음식
    "밥 먹었어요",
    "뭐 먹을래요",
    "맛있어요",
    "배고파요",
    "배불러요",
    "커피 마실래요",
    "물 주세요",

    // 감정
    "기분이 좋아요",
    "기분이 나빠요",
    "행복해요",
    "슬퍼요",
    "화나요",
    "피곤해요",
    "졸려요",
    "재미있어요",
    "지루해요",

    // 장소
    "집에 가요",
    "회사에 가요",
    "학교에 가요",
    "시장에 가요",
    "병원에 가요",
    "은행에 가요",
    "공원에 가요",

    // 시간
    "지금 몇 시예요",
    "아침이에요",
    "점심이에요",
    "저녁이에요",
    "밤이에요",
    "오늘은 월요일이에요",
    "내일 만나요",
    "어제 뭐 했어요",

    // 쇼핑
    "이거 얼마예요",
    "너무 비싸요",
    "싸게 해주세요",
    "카드로 할게요",
    "현금으로 할게요",
    "영수증 주세요",

    // 길 묻기
    "여기가 어디예요",
    "길을 잃었어요",
    "저기로 가세요",
    "직진하세요",
    "왼쪽으로 가세요",
    "오른쪽으로 가세요",

    // 전화
    "여보세요",
    "누구세요",
    "전화 잘못 거셨어요",
    "다시 전화할게요",
    "문자 보낼게요",

    // 더 많은 문장
    "한국어를 공부해요",
    "한국 음식이 맛있어요",
    "김치를 좋아해요",
    "불고기가 맛있어요",
    "서울에 살아요",
    "부산에 가고 싶어요",
    "제주도가 아름다워요",
    "한강에서 산책해요",
    "영화를 봐요",
    "음악을 들어요",
    "책을 읽어요",
    "운동을 해요",
    "게임을 해요",
    "친구를 만나요",
    "가족이 보고 싶어요",

    // 긴 문장
    "오늘 날씨가 정말 좋아서 공원에 산책하러 가요",
    "내일 친구랑 같이 영화 보러 갈 거예요",
    "주말에 가족들이랑 맛있는 거 먹으러 가요",
    "한국어 공부하는 게 재미있어요",
    "열심히 노력하면 꿈을 이룰 수 있어요",
    "새해 복 많이 받으세요",
    "생일 축하해요",
    "건강하세요",
    "사랑해요",
    "보고 싶어요",
  ];

  // Augment corpus with variations
  function augmentCorpus(corpus) {
    const augmented = [...corpus];

    // Add with punctuation
    for (const text of corpus) {
      augmented.push(text + '.');
      augmented.push(text + '!');
      augmented.push(text + '?');
    }

    // Combine sentences
    for (let i = 0; i < corpus.length - 1; i++) {
      augmented.push(corpus[i] + ' ' + corpus[i + 1]);
    }

    return augmented;
  }

  // ============================================================================
  // Trainable Model with Gradients
  // ============================================================================

  class TrainableKoreanLM {
    constructor(config = {}) {
      this.config = {
        vocabSize: VOCAB_SIZE,
        embedDim: config.embedDim || 64,
        hiddenDim: config.hiddenDim || 128,
        learningRate: config.learningRate || 0.01,
        clipGrad: config.clipGrad || 5.0,
        ...config
      };

      this.tokenizer = new JamoTokenizer();

      // Initialize parameters
      this.initParams();

      // Momentum buffers
      this.momentum = {};
      this.momentumBeta = 0.9;
    }

    initParams() {
      const { vocabSize, embedDim, hiddenDim } = this.config;

      // Embedding
      this.embedding = this.randn(vocabSize, embedDim, 0.1);

      // GRU weights (simplified: combined gates)
      this.Wz = this.randn(embedDim + hiddenDim, hiddenDim, 0.1);
      this.Wr = this.randn(embedDim + hiddenDim, hiddenDim, 0.1);
      this.Wh = this.randn(embedDim + hiddenDim, hiddenDim, 0.1);

      // Output layer
      this.Wo = this.randn(hiddenDim, vocabSize, 0.1);
      this.bo = this.zeros(vocabSize);
    }

    randn(rows, cols, std = 0.01) {
      const arr = [];
      for (let i = 0; i < rows; i++) {
        const row = [];
        for (let j = 0; j < cols; j++) {
          // Box-Muller transform
          const u1 = Math.random();
          const u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          row.push(z * std);
        }
        arr.push(row);
      }
      return arr;
    }

    zeros(size) {
      return new Array(size).fill(0);
    }

    // Activation functions
    sigmoid(x) {
      return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
    }

    tanh(x) {
      return Math.tanh(x);
    }

    softmax(logits) {
      const max = Math.max(...logits);
      const exps = logits.map(l => Math.exp(l - max));
      const sum = exps.reduce((a, b) => a + b, 0);
      return exps.map(e => e / sum);
    }

    // Matrix operations
    matmul(A, B) {
      // A: [m, n], B: [n, p] -> [m, p]
      // Handle 1D as row vector
      if (!Array.isArray(A[0])) A = [A];

      const m = A.length;
      const n = A[0].length;
      const p = B[0].length;
      const C = [];

      for (let i = 0; i < m; i++) {
        const row = [];
        for (let j = 0; j < p; j++) {
          let sum = 0;
          for (let k = 0; k < n; k++) {
            sum += A[i][k] * B[k][j];
          }
          row.push(sum);
        }
        C.push(row);
      }
      return C.length === 1 ? C[0] : C;
    }

    concat(a, b) {
      return [...a, ...b];
    }

    // Forward pass with cache for backprop
    forward(tokens) {
      const cache = {
        embeddings: [],
        hiddens: [this.zeros(this.config.hiddenDim)],
        zGates: [],
        rGates: [],
        hCands: [],
        logits: [],
        probs: [],
      };

      let h = cache.hiddens[0];

      for (let t = 0; t < tokens.length - 1; t++) {
        const idx = tokens[t];

        // Embedding lookup
        const embed = this.embedding[idx];
        cache.embeddings.push(embed);

        // GRU step
        const xh = this.concat(embed, h);

        // Update gate
        const zLogits = this.matmul([xh], this.Wz);
        const z = zLogits.map(this.sigmoid);
        cache.zGates.push(z);

        // Reset gate
        const rLogits = this.matmul([xh], this.Wr);
        const r = rLogits.map(this.sigmoid);
        cache.rGates.push(r);

        // Candidate hidden
        const rh = h.map((hi, i) => r[i] * hi);
        const xrh = this.concat(embed, rh);
        const hCandLogits = this.matmul([xrh], this.Wh);
        const hCand = hCandLogits.map(this.tanh);
        cache.hCands.push(hCand);

        // New hidden state
        const newH = h.map((hi, i) => (1 - z[i]) * hi + z[i] * hCand[i]);
        cache.hiddens.push(newH);
        h = newH;

        // Output
        const logits = this.matmul([h], this.Wo).map((l, i) => l + this.bo[i]);
        cache.logits.push(logits);
        cache.probs.push(this.softmax(logits));
      }

      return cache;
    }

    // Compute loss
    computeLoss(tokens, cache) {
      let loss = 0;
      for (let t = 0; t < tokens.length - 1; t++) {
        const target = tokens[t + 1];
        const prob = cache.probs[t][target];
        loss -= Math.log(prob + 1e-10);
      }
      return loss / (tokens.length - 1);
    }

    // Backward pass
    backward(tokens, cache) {
      const { embedDim, hiddenDim, vocabSize } = this.config;
      const T = tokens.length - 1;

      // Initialize gradients
      const grads = {
        embedding: this.embedding.map(row => row.map(() => 0)),
        Wz: this.Wz.map(row => row.map(() => 0)),
        Wr: this.Wr.map(row => row.map(() => 0)),
        Wh: this.Wh.map(row => row.map(() => 0)),
        Wo: this.Wo.map(row => row.map(() => 0)),
        bo: this.zeros(vocabSize),
      };

      let dh_next = this.zeros(hiddenDim);

      // Backward through time
      for (let t = T - 1; t >= 0; t--) {
        const target = tokens[t + 1];
        const probs = cache.probs[t];
        const h = cache.hiddens[t + 1];
        const h_prev = cache.hiddens[t];
        const embed = cache.embeddings[t];
        const z = cache.zGates[t];
        const r = cache.rGates[t];
        const hCand = cache.hCands[t];

        // Output gradient
        const dLogits = [...probs];
        dLogits[target] -= 1;

        // Wo gradient
        for (let i = 0; i < hiddenDim; i++) {
          for (let j = 0; j < vocabSize; j++) {
            grads.Wo[i][j] += h[i] * dLogits[j];
          }
        }
        for (let j = 0; j < vocabSize; j++) {
          grads.bo[j] += dLogits[j];
        }

        // dh from output
        let dh = this.zeros(hiddenDim);
        for (let i = 0; i < hiddenDim; i++) {
          for (let j = 0; j < vocabSize; j++) {
            dh[i] += this.Wo[i][j] * dLogits[j];
          }
        }

        // Add gradient from next timestep
        dh = dh.map((d, i) => d + dh_next[i]);

        // GRU backward
        const dhCand = dh.map((d, i) => d * z[i] * (1 - hCand[i] * hCand[i]));
        const dz = dh.map((d, i) => d * (hCand[i] - h_prev[i]) * z[i] * (1 - z[i]));

        // Wh gradient
        const rh = h_prev.map((hi, i) => r[i] * hi);
        const xrh = this.concat(embed, rh);
        for (let i = 0; i < embedDim + hiddenDim; i++) {
          for (let j = 0; j < hiddenDim; j++) {
            grads.Wh[i][j] += xrh[i] * dhCand[j];
          }
        }

        // dr from hCand
        const dr = this.zeros(hiddenDim);
        for (let i = 0; i < hiddenDim; i++) {
          let sum = 0;
          for (let j = 0; j < hiddenDim; j++) {
            sum += this.Wh[embedDim + i][j] * dhCand[j];
          }
          dr[i] = sum * h_prev[i] * r[i] * (1 - r[i]);
        }

        // Wz, Wr gradients
        const xh = this.concat(embed, h_prev);
        for (let i = 0; i < embedDim + hiddenDim; i++) {
          for (let j = 0; j < hiddenDim; j++) {
            grads.Wz[i][j] += xh[i] * dz[j];
            grads.Wr[i][j] += xh[i] * dr[j];
          }
        }

        // Embedding gradient
        const idx = tokens[t];
        for (let i = 0; i < embedDim; i++) {
          let dEmbed = 0;
          for (let j = 0; j < hiddenDim; j++) {
            dEmbed += this.Wz[i][j] * dz[j];
            dEmbed += this.Wr[i][j] * dr[j];
            dEmbed += this.Wh[i][j] * dhCand[j];
          }
          grads.embedding[idx][i] += dEmbed;
        }

        // dh for next iteration
        dh_next = this.zeros(hiddenDim);
        for (let i = 0; i < hiddenDim; i++) {
          dh_next[i] = dh[i] * (1 - z[i]);
          for (let j = 0; j < hiddenDim; j++) {
            dh_next[i] += this.Wz[embedDim + i][j] * dz[j];
            dh_next[i] += this.Wr[embedDim + i][j] * dr[j];
          }
          // From r gate
          let sum = 0;
          for (let j = 0; j < hiddenDim; j++) {
            sum += this.Wh[embedDim + i][j] * dhCand[j];
          }
          dh_next[i] += sum * r[i];
        }
      }

      return grads;
    }

    // Gradient clipping
    clipGradients(grads) {
      const clip = this.config.clipGrad;

      const clipArray = (arr) => {
        if (!Array.isArray(arr[0])) {
          return arr.map(x => Math.max(-clip, Math.min(clip, x)));
        }
        return arr.map(row => row.map(x => Math.max(-clip, Math.min(clip, x))));
      };

      return {
        embedding: clipArray(grads.embedding),
        Wz: clipArray(grads.Wz),
        Wr: clipArray(grads.Wr),
        Wh: clipArray(grads.Wh),
        Wo: clipArray(grads.Wo),
        bo: clipArray(grads.bo),
      };
    }

    // Apply gradients with momentum
    applyGradients(grads) {
      const lr = this.config.learningRate;
      const beta = this.momentumBeta;

      const applyUpdate = (param, grad, key) => {
        if (!this.momentum[key]) {
          this.momentum[key] = Array.isArray(grad[0])
            ? grad.map(row => row.map(() => 0))
            : grad.map(() => 0);
        }

        if (!Array.isArray(grad[0])) {
          for (let i = 0; i < param.length; i++) {
            this.momentum[key][i] = beta * this.momentum[key][i] + (1 - beta) * grad[i];
            param[i] -= lr * this.momentum[key][i];
          }
        } else {
          for (let i = 0; i < param.length; i++) {
            for (let j = 0; j < param[i].length; j++) {
              this.momentum[key][i][j] = beta * this.momentum[key][i][j] + (1 - beta) * grad[i][j];
              param[i][j] -= lr * this.momentum[key][i][j];
            }
          }
        }
      };

      applyUpdate(this.embedding, grads.embedding, 'embedding');
      applyUpdate(this.Wz, grads.Wz, 'Wz');
      applyUpdate(this.Wr, grads.Wr, 'Wr');
      applyUpdate(this.Wh, grads.Wh, 'Wh');
      applyUpdate(this.Wo, grads.Wo, 'Wo');
      applyUpdate(this.bo, grads.bo, 'bo');
    }

    // Train on single example
    trainStep(text) {
      const tokens = this.tokenizer.encode(text);
      if (tokens.length < 3) return 0;

      const cache = this.forward(tokens);
      const loss = this.computeLoss(tokens, cache);
      const grads = this.backward(tokens, cache);
      const clippedGrads = this.clipGradients(grads);
      this.applyGradients(clippedGrads);

      return loss;
    }

    // Train on corpus
    async train(corpus, epochs = 10, onProgress = null) {
      const history = [];

      for (let epoch = 0; epoch < epochs; epoch++) {
        let totalLoss = 0;
        let count = 0;

        // Shuffle corpus
        const shuffled = [...corpus].sort(() => Math.random() - 0.5);

        for (const text of shuffled) {
          const loss = this.trainStep(text);
          if (loss > 0) {
            totalLoss += loss;
            count++;
          }
        }

        const avgLoss = count > 0 ? totalLoss / count : 0;
        history.push({ epoch: epoch + 1, loss: avgLoss });

        if (onProgress) {
          onProgress({
            epoch: epoch + 1,
            loss: avgLoss,
            total: epochs,
            perplexity: Math.exp(avgLoss)
          });
        }

        // Yield to event loop
        await new Promise(r => setTimeout(r, 0));
      }

      return history;
    }

    // Generate text
    generate(prompt = '', maxLength = 50, temperature = 0.8) {
      let tokens = prompt
        ? this.tokenizer.encode(prompt, true, false)
        : [this.tokenizer.bosIdx];

      let h = this.zeros(this.config.hiddenDim);

      // Process prompt
      for (let t = 0; t < tokens.length; t++) {
        const embed = this.embedding[tokens[t]];
        const xh = this.concat(embed, h);

        const z = this.matmul([xh], this.Wz).map(this.sigmoid);
        const r = this.matmul([xh], this.Wr).map(this.sigmoid);
        const rh = h.map((hi, i) => r[i] * hi);
        const xrh = this.concat(embed, rh);
        const hCand = this.matmul([xrh], this.Wh).map(this.tanh);
        h = h.map((hi, i) => (1 - z[i]) * hi + z[i] * hCand[i]);
      }

      // Generate
      const generated = [...tokens];

      for (let i = 0; i < maxLength; i++) {
        const embed = this.embedding[generated[generated.length - 1]];
        const xh = this.concat(embed, h);

        const z = this.matmul([xh], this.Wz).map(this.sigmoid);
        const r = this.matmul([xh], this.Wr).map(this.sigmoid);
        const rh = h.map((hi, j) => r[j] * hi);
        const xrh = this.concat(embed, rh);
        const hCand = this.matmul([xrh], this.Wh).map(this.tanh);
        h = h.map((hi, j) => (1 - z[j]) * hi + z[j] * hCand[j]);

        const logits = this.matmul([h], this.Wo).map((l, j) => l + this.bo[j]);

        // Temperature sampling
        const scaled = logits.map(l => l / temperature);
        const probs = this.softmax(scaled);

        // Sample
        const r = Math.random();
        let cumsum = 0;
        let nextToken = 0;
        for (let j = 0; j < probs.length; j++) {
          cumsum += probs[j];
          if (r < cumsum) {
            nextToken = j;
            break;
          }
        }

        generated.push(nextToken);
        if (nextToken === this.tokenizer.eosIdx) break;
      }

      return this.tokenizer.decode(generated);
    }

    // Save model
    save() {
      return {
        config: this.config,
        embedding: this.embedding,
        Wz: this.Wz,
        Wr: this.Wr,
        Wh: this.Wh,
        Wo: this.Wo,
        bo: this.bo,
      };
    }

    // Load model
    load(data) {
      this.config = data.config;
      this.embedding = data.embedding;
      this.Wz = data.Wz;
      this.Wr = data.Wr;
      this.Wh = data.Wh;
      this.Wo = data.Wo;
      this.bo = data.bo;
    }

    // Get model info
    getInfo() {
      const { vocabSize, embedDim, hiddenDim } = this.config;
      const embedParams = vocabSize * embedDim;
      const gruParams = 3 * (embedDim + hiddenDim) * hiddenDim;
      const outParams = hiddenDim * vocabSize + vocabSize;
      const total = embedParams + gruParams + outParams;

      return {
        vocabSize,
        embedDim,
        hiddenDim,
        paramCount: total,
        sizeKB: (total * 4 / 1024).toFixed(1),
        sizeMB: (total * 4 / 1024 / 1024).toFixed(2),
      };
    }
  }

  // ============================================================================
  // Export
  // ============================================================================

  const TrainerLib = {
    TrainableKoreanLM,
    KOREAN_CORPUS,
    augmentCorpus,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TrainerLib;
  } else {
    global.KoreanMiniLMTrainer = TrainerLib;
  }

})(typeof self !== 'undefined' ? self : this);
