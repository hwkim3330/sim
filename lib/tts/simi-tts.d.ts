/**
 * Simi TTS v3.0 - TypeScript Declarations
 * Korean + English Formant Synthesizer
 */

declare module 'simi-tts' {
  export interface VoiceConfig {
    name: string;
    pitch: number;
    pitchRange: number;
    speed: number;
    formantShift: number;
    breathiness: number;
    jitter: number;
    robotize: number;
    reverb: number;
    ringMod?: number;
  }

  export interface VoicePresets {
    default: VoiceConfig;
    male: VoiceConfig;
    female: VoiceConfig;
    robot: VoiceConfig;
    glados: VoiceConfig;
    gladosAngry: VoiceConfig;
    korean: VoiceConfig;
    koreanGlados: VoiceConfig;
  }

  export interface TTSOptions {
    voice?: Partial<VoiceConfig>;
    sampleRate?: number;
  }

  export interface PhonemeData {
    phoneme: string;
    f1: number;
    f2: number;
    f3: number;
    f4: number;
    b1: number;
    b2: number;
    b3: number;
    b4: number;
    duration: number;
    av: number;
    af: number;
    voiced: boolean;
  }

  export interface DecomposedHangul {
    initial: string;
    vowel: string;
    final: string | null;
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
     * @param text Text to synthesize
     * @param lang Language: 'auto', 'ko', or 'en'
     */
    synthesize(text: string, lang?: 'auto' | 'ko' | 'en'): number[];

    /**
     * Speak text through audio output
     * @param text Text to speak
     * @param onProgress Optional progress callback (0-1)
     * @param lang Language: 'auto', 'ko', or 'en'
     */
    speak(text: string, onProgress?: (progress: number) => void, lang?: 'auto' | 'ko' | 'en'): Promise<void>;

    /**
     * Generate WAV file as ArrayBuffer
     * @param text Text to synthesize
     * @param lang Language: 'auto', 'ko', or 'en'
     */
    toWav(text: string, lang?: 'auto' | 'ko' | 'en'): ArrayBuffer;

    /**
     * Download synthesized speech as WAV file
     * @param text Text to synthesize
     * @param filename Output filename
     * @param lang Language: 'auto', 'ko', or 'en'
     */
    download(text: string, filename?: string, lang?: 'auto' | 'ko' | 'en'): void;
  }

  export const Voice: VoicePresets;

  /**
   * Convert text to phonemes (auto-detects language)
   * @param text Input text
   * @param lang Language: 'auto', 'ko', or 'en'
   */
  export function textToPhonemes(text: string, lang?: 'auto' | 'ko' | 'en'): PhonemeData[];

  /**
   * Convert Korean text to phonemes
   */
  export function koreanToPhonemes(text: string): PhonemeData[];

  /**
   * Convert English text to phonemes
   */
  export function englishToPhonemes(text: string): PhonemeData[];

  /**
   * Decompose a Hangul syllable into jamo
   */
  export function decomposeHangul(char: string): DecomposedHangul | null;

  /**
   * Check if a character is Hangul
   */
  export function isHangul(char: string): boolean;

  /**
   * Apply Korean phonological rules to syllables
   */
  export function applyPhonologicalRules(syllables: DecomposedHangul[]): DecomposedHangul[];

  export const KOREAN_PHONEMES: { [key: string]: number[] };
  export const ENGLISH_PHONEMES: { [key: string]: number[] };

  export class KlattSynthesizer {
    constructor(sampleRate?: number);
    synthesize(phonemes: PhonemeData[], voice: VoiceConfig): number[];
    reset(): void;
  }

  export const version: string;
}

declare global {
  interface Window {
    SimiTTS: {
      TTS: typeof import('simi-tts').TTS;
      Voice: import('simi-tts').VoicePresets;
      textToPhonemes: typeof import('simi-tts').textToPhonemes;
      koreanToPhonemes: typeof import('simi-tts').koreanToPhonemes;
      englishToPhonemes: typeof import('simi-tts').englishToPhonemes;
      isHangul: typeof import('simi-tts').isHangul;
      decomposeHangul: typeof import('simi-tts').decomposeHangul;
      applyPhonologicalRules: typeof import('simi-tts').applyPhonologicalRules;
      KOREAN_PHONEMES: import('simi-tts').KOREAN_PHONEMES;
      ENGLISH_PHONEMES: import('simi-tts').ENGLISH_PHONEMES;
      KlattSynthesizer: typeof import('simi-tts').KlattSynthesizer;
      version: string;
    };
  }
}

export {};
