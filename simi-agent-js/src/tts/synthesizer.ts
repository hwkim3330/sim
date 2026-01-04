/**
 * Klatt Synthesizer Wrapper
 *
 * Uses klatt-syn package for formant synthesis
 */

import {
  generateSound,
  GlottalSourceType,
  type MainParms,
  type FrameParms,
  demoFrameParms,
} from 'klatt-syn';
import { getPhoneme, type PhonemeData } from './phonemes.js';

export interface VoiceConfig {
  name: string;
  pitch: number;          // F0 in Hz
  pitchRange: number;     // Pitch variation
  speed: number;          // Speed multiplier (1.0 = normal)
  breathiness: number;    // 0-1
  roughness: number;      // 0-1
}

export const Voice = {
  default: {
    name: 'default',
    pitch: 120,
    pitchRange: 20,
    speed: 1.0,
    breathiness: 0,
    roughness: 0.1,
  } as VoiceConfig,

  male: {
    name: 'male',
    pitch: 100,
    pitchRange: 15,
    speed: 1.0,
    breathiness: 0,
    roughness: 0.1,
  } as VoiceConfig,

  female: {
    name: 'female',
    pitch: 180,
    pitchRange: 30,
    speed: 1.0,
    breathiness: 0.1,
    roughness: 0.05,
  } as VoiceConfig,

  robot: {
    name: 'robot',
    pitch: 100,
    pitchRange: 0,
    speed: 0.9,
    breathiness: 0,
    roughness: 0,
  } as VoiceConfig,

  glados: {
    name: 'glados',
    pitch: 160,
    pitchRange: 5,
    speed: 0.85,
    breathiness: 0,
    roughness: 0,
  } as VoiceConfig,
};

/**
 * Klatt Synthesizer
 */
export class KlattSynthesizer {
  private sampleRate: number;
  private voice: VoiceConfig;

  constructor(options: { sampleRate?: number; voice?: VoiceConfig } = {}) {
    this.sampleRate = options.sampleRate ?? 22050;
    this.voice = options.voice ?? Voice.default;
  }

  /**
   * Set voice configuration
   */
  setVoice(voice: VoiceConfig | keyof typeof Voice): void {
    if (typeof voice === 'string') {
      this.voice = Voice[voice] ?? Voice.default;
    } else {
      this.voice = voice;
    }
  }

  /**
   * Synthesize phonemes to audio samples
   */
  synthesize(phonemes: string[]): Float64Array {
    const mainParms: MainParms = {
      sampleRate: this.sampleRate,
      glottalSourceType: GlottalSourceType.natural,
    };

    const frameParms = this.phonemesToFrames(phonemes);

    if (frameParms.length === 0) {
      return new Float64Array(0);
    }

    return generateSound(mainParms, frameParms);
  }

  /**
   * Convert phoneme symbols to Klatt frame parameters
   */
  private phonemesToFrames(phonemes: string[]): FrameParms[] {
    const frames: FrameParms[] = [];

    for (let i = 0; i < phonemes.length; i++) {
      const phoneme = getPhoneme(phonemes[i]);
      const nextPhoneme = i < phonemes.length - 1 ? getPhoneme(phonemes[i + 1]) : null;

      const frameCount = Math.max(1, Math.ceil(phoneme.duration / this.voice.speed * 100));

      for (let j = 0; j < frameCount; j++) {
        const t = j / frameCount;
        const frame = this.createFrame(phoneme, nextPhoneme, t);
        frames.push(frame);
      }
    }

    return frames;
  }

  /**
   * Create a single frame with interpolation
   */
  private createFrame(
    current: PhonemeData,
    next: PhonemeData | null,
    t: number
  ): FrameParms {
    // Interpolate formants towards next phoneme
    const freq = [...current.freq];
    const bw = [...current.bw];

    if (next && t > 0.7) {
      const blend = (t - 0.7) / 0.3;
      for (let i = 0; i < 6; i++) {
        freq[i] = freq[i] + (next.freq[i] - freq[i]) * blend;
        bw[i] = bw[i] + (next.bw[i] - bw[i]) * blend;
      }
    }

    // Calculate F0 with variation
    const pitchVariation = (Math.random() - 0.5) * this.voice.pitchRange;
    const f0 = current.voiced ? this.voice.pitch + pitchVariation : 0;

    // Breathiness
    const breathinessDb = current.voiced
      ? -25 + this.voice.breathiness * 20
      : -25;

    return {
      duration: 0.01, // 10ms per frame
      f0,
      flutterLevel: 0.25,
      openPhaseRatio: 0.7,
      breathinessDb,
      tiltDb: 0,
      gainDb: NaN,
      agcRmsLevel: 0.18,
      nasalFormantFreq: NaN,
      nasalFormantBw: NaN,
      oralFormantFreq: freq,
      oralFormantBw: bw,
      cascadeEnabled: true,
      cascadeVoicingDb: current.voiced ? 0 : -99,
      cascadeAspirationDb: current.voiced ? -25 : -10,
      cascadeAspirationMod: 0.5,
      nasalAntiformantFreq: NaN,
      nasalAntiformantBw: NaN,
      parallelEnabled: false,
      parallelVoicingDb: 0,
      parallelAspirationDb: -25,
      parallelAspirationMod: 0.5,
      fricationDb: current.voiced ? -99 : -20,
      fricationMod: 0.5,
      parallelBypassDb: -99,
      nasalFormantDb: NaN,
      oralFormantDb: [0, -8, -15, -19, -30, -35],
    };
  }

  /**
   * Convert samples to WAV format
   */
  toWav(samples: Float64Array): ArrayBuffer {
    const numChannels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = this.sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // RIFF header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    this.writeString(view, 8, 'WAVE');

    // fmt chunk
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // data chunk
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Normalize and write samples
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peak) peak = abs;
    }

    const scale = peak > 0 ? 32767 / peak * 0.8 : 1;
    let offset = 44;

    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-32768, Math.min(32767, Math.floor(samples[i] * scale)));
      view.setInt16(offset, sample, true);
      offset += 2;
    }

    return buffer;
  }

  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  get currentVoice(): VoiceConfig {
    return this.voice;
  }
}
