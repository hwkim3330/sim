# Simi TTS v3.0

A dependency-free, browser-based Text-to-Speech engine using Klatt formant synthesis.

**Features:**
- 🎯 Pure JavaScript - no dependencies
- 🌐 Works in browsers (Web Audio API)
- 🤖 GLaDOS-style voice preset
- 📥 WAV file export
- 📝 TypeScript support
- 🇰🇷 **Native Korean support** with phonological rules
- 🔊 Optimized robotization effect

## What's New in v3.0

- **Korean Phoneme Database**: Accurate formant values based on Korean phonetics research
- **Phonological Rules**: 연음, 경음화, 비음화, 구개음화, 격음화 자동 적용
- **Diphthong Transitions**: Smooth glide between vowels (ㅑ, ㅕ, ㅘ, ㅝ 등)
- **Performance**: Removed slow FFT-based processing, much faster synthesis
- **New Voice Presets**: `korean`, `koreanGlados`

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

## Voice Presets

| Voice | Description |
|-------|-------------|
| `default` | Neutral voice |
| `male` | Lower pitch |
| `female` | Higher pitch |
| `robot` | Monotone, flat pitch |
| `glados` | AI assistant style with effects |
| `gladosAngry` | GLaDOS emotional variant |
| `wheatley` | Wheatley-style nervous voice |

## Korean Language Support

Simi TTS supports Korean (한국어) with automatic language detection:

```javascript
const tts = new TTS({ voice: Voice.glados });

// Korean text
await tts.speak("안녕하세요. 애퍼처 사이언스에 오신 것을 환영합니다.");

// Mixed Korean + English
await tts.speak("Hello! 안녕하세요!");

// Force language (optional)
const phonemes = SimiTTS.textToPhonemes("안녕하세요", "ko");
```

### Korean Phoneme Conversion

- Decomposes Hangul syllables into jamo (초성, 중성, 종성)
- Maps to ARPAbet-like phonemes for synthesis
- Handles 받침 (final consonants) correctly

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
