# Korean Mini LM

자모(Jamo) 기반 한국어 미니 언어모델 - Pure JavaScript

## Features

- 🇰🇷 **한국어 특화** - 자모 단위 토큰화로 작은 vocabulary
- 🚀 **초경량** - ~1MB 미만 (200K params 기준)
- 🌐 **브라우저 실행** - 외부 의존성 없음
- 📦 **No Dependencies** - Pure JavaScript

## Architecture

```
Input Text
    ↓
[Jamo Tokenizer] - 한글 → 자모 분리
    ↓
[Embedding] - vocab_size × embed_dim
    ↓
[GRU] - embed_dim → hidden_dim
    ↓
[Dense] - hidden_dim → vocab_size
    ↓
[Softmax] - 확률 분포
    ↓
Generated Token
```

## Model Size

| Config | Params | Size (Float32) |
|--------|--------|----------------|
| 64 × 128 | ~50K | ~200KB |
| 128 × 256 | ~200K | ~800KB |
| 256 × 512 | ~800K | ~3MB |

## Quick Start

### Browser

```html
<script src="korean-mini-lm.js"></script>
<script>
  const { KoreanMiniLM } = window.KoreanMiniLM;

  const model = new KoreanMiniLM({
    embedDim: 128,
    hiddenDim: 256
  });

  // Generate text
  const text = model.generate('안녕', 50, 0.8);
  console.log(text);
</script>
```

### Node.js

```javascript
const { KoreanMiniLM } = require('./korean-mini-lm.js');

const model = new KoreanMiniLM();
console.log(model.generate('오늘 날씨가'));
```

## API

### KoreanMiniLM

```javascript
const model = new KoreanMiniLM({
  embedDim: 128,    // Embedding dimension
  hiddenDim: 256,   // GRU hidden dimension
});

// Generate text
model.generate(prompt, maxLength, temperature);

// Get model info
model.getInfo();
// { vocabSize: 77, embedDim: 128, hiddenDim: 256, paramCount: 206413, sizeMB: '0.79' }

// Save/Load (JSON)
const state = model.save();
model.load(state);

// Export/Import (Binary - smaller)
const buffer = model.exportBinary();
model.importBinary(buffer);
```

### JamoTokenizer

```javascript
const { JamoTokenizer } = window.KoreanMiniLM;
const tokenizer = new JamoTokenizer();

// Encode
const tokens = tokenizer.encode('안녕하세요');
// [2, 11, 0, 17, 8, 10, 5, 0, 11, 8, 1, 10, 20, 3]

// Decode
const text = tokenizer.decode(tokens);
// '안녕하세요'
```

## Vocabulary

자모 기반 vocabulary (77 tokens):

| Category | Count | Examples |
|----------|-------|----------|
| Special | 10 | `<PAD>`, `<BOS>`, `<EOS>`, ` `, `\n` |
| 초성 | 19 | ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ... |
| 중성 | 21 | ㅏ, ㅓ, ㅗ, ㅜ, ㅡ, ㅣ, ... |
| 종성 | 27 | ㄱ, ㄴ, ㄷ, ㄹ, ㅁ, ... |

## Training

현재는 forward pass만 구현됨. 실제 학습을 위해서는:

1. Backpropagation 구현 필요
2. 또는 사전 학습된 weights 로드

```javascript
// 사전 학습된 모델 로드 예시
fetch('pretrained.bin')
  .then(r => r.arrayBuffer())
  .then(buffer => {
    model.importBinary(buffer);
    console.log('Model loaded!');
  });
```

## Comparison

| Model | Size | Vocab | Device |
|-------|------|-------|--------|
| **Korean Mini LM** | ~1MB | 77 | Browser |
| TinyMistral-248M | 156MB | 32K | WebGPU |
| Qwen2-0.5B | 353MB | 152K | WebGPU |
| GPT-2 Small | 500MB | 50K | GPU |

## License

MIT
