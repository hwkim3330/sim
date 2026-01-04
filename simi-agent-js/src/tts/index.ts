/**
 * Simi TTS - Text-to-Speech using Klatt Synthesis
 *
 * Features:
 * - Klatt formant synthesis via klatt-syn
 * - English and Korean support
 * - Multiple voice presets
 * - WAV export
 *
 * @example
 * const tts = new TTS();
 * const wav = tts.synthesizeToWav("Hello, world!");
 * fs.writeFileSync("output.wav", Buffer.from(wav));
 */

import { KlattSynthesizer, Voice, type VoiceConfig } from './synthesizer.js';
import { textToPhonemes } from './text2phonemes.js';
import { PHONEMES, KOREAN_VOWELS, KOREAN_CONSONANTS } from './phonemes.js';
import { writeFile } from 'fs/promises';

export { Voice, type VoiceConfig } from './synthesizer.js';
export { textToPhonemes } from './text2phonemes.js';
export { PHONEMES, KOREAN_VOWELS, KOREAN_CONSONANTS } from './phonemes.js';

export interface TTSOptions {
  voice?: VoiceConfig | keyof typeof Voice;
  sampleRate?: number;
}

/**
 * Text-to-Speech Engine
 */
export class TTS {
  private synthesizer: KlattSynthesizer;

  constructor(options: TTSOptions = {}) {
    const voice = typeof options.voice === 'string'
      ? Voice[options.voice]
      : options.voice;

    this.synthesizer = new KlattSynthesizer({
      sampleRate: options.sampleRate ?? 22050,
      voice: voice ?? Voice.default,
    });
  }

  /**
   * Set voice
   */
  setVoice(voice: VoiceConfig | keyof typeof Voice): void {
    this.synthesizer.setVoice(voice);
  }

  /**
   * Synthesize text to audio samples
   */
  synthesize(text: string): Float64Array {
    const phonemes = textToPhonemes(text);
    return this.synthesizer.synthesize(phonemes);
  }

  /**
   * Synthesize text to WAV ArrayBuffer
   */
  synthesizeToWav(text: string): ArrayBuffer {
    const samples = this.synthesize(text);
    return this.synthesizer.toWav(samples);
  }

  /**
   * Synthesize and save to WAV file
   */
  async saveWav(text: string, filePath: string): Promise<void> {
    const wav = this.synthesizeToWav(text);
    await writeFile(filePath, Buffer.from(wav));
  }

  /**
   * Get phonemes for text (for debugging)
   */
  getPhonemes(text: string): string[] {
    return textToPhonemes(text);
  }

  /**
   * Get current voice config
   */
  get voice(): VoiceConfig {
    return this.synthesizer.currentVoice;
  }
}

/**
 * Quick synthesis function
 */
export function synthesize(
  text: string,
  options?: TTSOptions
): ArrayBuffer {
  const tts = new TTS(options);
  return tts.synthesizeToWav(text);
}

/**
 * Quick save function
 */
export async function saveWav(
  text: string,
  filePath: string,
  options?: TTSOptions
): Promise<void> {
  const tts = new TTS(options);
  await tts.saveWav(text, filePath);
}
