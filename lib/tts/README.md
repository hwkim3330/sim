# Simi TTS

A dependency-free, browser-based Text-to-Speech engine using Klatt formant synthesis.

**Features:**
- 🎯 Pure JavaScript - no dependencies
- 🌐 Works in browsers (Web Audio API)
- 🤖 GLaDOS-style voice preset
- 📥 WAV file export
- 📝 TypeScript support
- 🇰🇷 Korean (한국어) support

## Quick Start

### Browser (CDN)

```html
<script src="simi-tts.js"></script>
<script>
  const { TTS, Voice } = SimiTTS;

  const tts = new TTS({ voice: Voice.glados });

  document.getElementById('speak').onclick = async () => {
    await tts.speak("Hello, and welcome to the Aperture Science Enrichment Center.");
  };
</script>
```

### ES Module

```javascript
import { TTS, Voice } from './simi-tts.js';

const tts = new TTS({ voice: Voice.glados });
await tts.speak("The cake is a lie.");
```

## API

### `new TTS(options?)`

Create a new TTS instance.

```javascript
const tts = new TTS({
  voice: Voice.glados,  // Voice preset
  sampleRate: 22050     // Audio sample rate
});
```

### `tts.setVoice(voice)`

Change the voice.

```javascript
tts.setVoice('glados');
tts.setVoice('robot');
tts.setVoice('female');
tts.setVoice('male');

// Or custom:
tts.setVoice({
  pitch: 150,
  pitchRange: 10,
  speed: 0.9,
  breathiness: 0,
  roughness: 0
});
```

### `tts.speak(text, onProgress?)`

Speak text through audio output.

```javascript
await tts.speak("Hello world!", (progress) => {
  console.log(`${progress * 100}% complete`);
});
```

### `tts.synthesize(text)`

Get raw audio samples.

```javascript
const samples = tts.synthesize("Hello");
// samples: Float64Array of audio data
```

### `tts.toWav(text)`

Generate WAV file as ArrayBuffer.

```javascript
const wav = tts.toWav("Hello");
const blob = new Blob([wav], { type: 'audio/wav' });
```

### `tts.download(text, filename?)`

Download as WAV file.

```javascript
tts.download("Hello world!", "speech.wav");
```

## Korean Support

Simi TTS supports Korean (한글) text automatically:

```javascript
const tts = new TTS({ voice: Voice.glados });

// Korean text is automatically detected
await tts.speak("안녕하세요");
await tts.speak("케이크는 거짓말입니다");
```

The Korean phoneme system includes:
- All 19 initial consonants (초성): ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ
- All 21 vowels (중성): ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ
- All 27 final consonants (종성)

## Voice Presets

| Voice | Description |
|-------|-------------|
| `default` | Neutral voice |
| `male` | Lower pitch |
| `female` | Higher pitch |
| `robot` | Monotone, flat pitch |
| `glados` | AI assistant style with effects |

## GLaDOS Voice

The GLaDOS voice includes special effects:
- Ring modulation for robotic quality
- Subtle chorus for thickness
- Compression for consistent level
- Reverb for "speaker" quality
- EQ shaping

```javascript
const tts = new TTS({ voice: Voice.glados });
await tts.speak("I'm doing science and I'm still alive.");
```

## How It Works

### Klatt Formant Synthesis

Based on Dennis Klatt's 1980 paper "Software for a cascade/parallel formant synthesizer":

1. **Text → Phonemes**: Rule-based conversion using ARPAbet
2. **Phoneme Parameters**: Formant frequencies (F1-F4), bandwidths, voicing
3. **Digital Filters**: Cascade resonators for vowels
4. **Glottal Source**: Rosenberg model pulse train
5. **Radiation**: High-frequency emphasis

### Components

- **GlottalSource**: Generates periodic impulse train
- **Resonator**: 2nd-order IIR bandpass filter
- **GLaDOSEffects**: Ring modulation, chorus, reverb, EQ

## Browser Support

- Chrome 35+
- Firefox 25+
- Safari 6+
- Edge 12+

Requires Web Audio API and user interaction to start audio.

## License

MIT

## Credits

- Klatt, D.H. (1980) "Software for a cascade/parallel formant synthesizer"
- Inspired by GLaDOS from Portal (Valve)
