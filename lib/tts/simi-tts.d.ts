/**
 * Simi TTS - TypeScript Declarations
 * @version 2.0.0
 * Supports: English, Korean (한국어)
 */

declare module 'simi-tts' {
  export interface VoiceConfig {
    name: string;
    pitch: number;
    pitchRange: number;
    speed: number;
    breathiness: number;
    roughness: number;
    effects?: {
      ringMod?: number;
      formantShift?: number;
      reverb?: number;
      bitcrush?: number;
    };
  }

  export interface VoicePresets {
    default: VoiceConfig;
    male: VoiceConfig;
    female: VoiceConfig;
    robot: VoiceConfig;
    glados: VoiceConfig;
  }

  export interface TTSOptions {
    voice?: VoiceConfig;
    sampleRate?: number;
  }

  export interface PhonemeData {
    [key: string]: [number, number, number, number, number, number, number, number, number, boolean];
  }

  export class TTS {
    constructor(options?: TTSOptions);

    /**
     * Initialize audio context (must be called after user interaction)
     */
    init(): Promise<void>;

    /**
     * Set the voice configuration
     */
    setVoice(voice: string | Partial<VoiceConfig>): void;

    /**
     * Synthesize text to audio samples
     */
    synthesize(text: string): number[];

    /**
     * Speak text through audio output
     * @param text Text to speak
     * @param onProgress Optional progress callback (0-1)
     */
    speak(text: string, onProgress?: (progress: number) => void): Promise<void>;

    /**
     * Generate WAV file as ArrayBuffer
     */
    toWav(text: string): ArrayBuffer;

    /**
     * Download synthesized speech as WAV file
     */
    download(text: string, filename?: string): void;
  }

  export const Voice: VoicePresets;

  export function textToPhonemes(text: string): string[];

  export const PHONEMES: PhonemeData;

  export const version: string;
}

declare global {
  interface Window {
    SimiTTS: {
      TTS: typeof import('simi-tts').TTS;
      Voice: import('simi-tts').VoicePresets;
      textToPhonemes: typeof import('simi-tts').textToPhonemes;
      PHONEMES: import('simi-tts').PhonemeData;
      version: string;
    };
  }
}

export {};
