/**
 * SimAudio - Web Audio API Sound Library
 * @version 1.1.0
 * @license MIT
 * @module SimAudio
 *
 * Procedural sound synthesis for UI feedback and character reactions.
 * No external audio files needed - all sounds generated via Web Audio API.
 *
 * Features:
 * - Synthesized sound effects (tones, chords, noise)
 * - Emotion-based sound mapping
 * - Haptic feedback integration
 * - Proper resource cleanup with dispose()
 */
(function(root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SimAudio = factory();
    }
}(typeof self !== 'undefined' ? self : this, function() {
    'use strict';

    // ========================================
    // Audio Context Manager
    // ========================================
    class AudioContextManager {
        constructor() {
            this.context = null;
            this.masterGain = null;
            this.initialized = false;
            this.muted = false;
            this.volume = 0.5;
        }

        async init() {
            if (this.initialized) return this.context;

            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) {
                    console.warn('Web Audio API not supported');
                    return null;
                }

                this.context = new AudioContext();
                this.masterGain = this.context.createGain();
                this.masterGain.gain.value = this.volume;
                this.masterGain.connect(this.context.destination);

                // Resume on user interaction if suspended
                if (this.context.state === 'suspended') {
                    const resume = async () => {
                        await this.context.resume();
                        document.removeEventListener('click', resume);
                        document.removeEventListener('keydown', resume);
                        document.removeEventListener('touchstart', resume);
                    };
                    document.addEventListener('click', resume, { once: true });
                    document.addEventListener('keydown', resume, { once: true });
                    document.addEventListener('touchstart', resume, { once: true });
                }

                this.initialized = true;
                return this.context;
            } catch (e) {
                console.warn('Failed to initialize AudioContext:', e);
                return null;
            }
        }

        setVolume(value) {
            this.volume = Math.max(0, Math.min(1, value));
            if (this.masterGain) {
                this.masterGain.gain.value = this.muted ? 0 : this.volume;
            }
        }

        setMuted(muted) {
            this.muted = muted;
            if (this.masterGain) {
                this.masterGain.gain.value = muted ? 0 : this.volume;
            }
        }

        /**
         * Get the audio output node
         * @returns {GainNode|AudioDestinationNode|null}
         */
        getOutput() {
            return this.masterGain || (this.context ? this.context.destination : null);
        }

        /**
         * Dispose of audio context and release resources
         */
        dispose() {
            if (this.context) {
                if (this.context.state !== 'closed') {
                    this.context.close().catch(() => {});
                }
                this.context = null;
                this.masterGain = null;
            }
            this.initialized = false;
        }
    }

    const audioManager = new AudioContextManager();

    // ========================================
    // Sound Synthesizer
    // ========================================
    class Synthesizer {
        constructor() {
            this.ctx = null;
        }

        async ensureContext() {
            if (!this.ctx) {
                this.ctx = await audioManager.init();
            }
            return this.ctx;
        }

        // Create oscillator with envelope
        async playTone(options = {}) {
            const ctx = await this.ensureContext();
            if (!ctx) return;

            const {
                frequency = 440,
                type = 'sine',
                duration = 0.1,
                attack = 0.01,
                decay = 0.05,
                sustain = 0.3,
                release = 0.1,
                volume = 0.3,
                detune = 0
            } = options;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = type;
            osc.frequency.value = frequency;
            osc.detune.value = detune;

            // ADSR envelope
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(volume, now + attack);
            gain.gain.linearRampToValueAtTime(volume * sustain, now + attack + decay);
            gain.gain.setValueAtTime(volume * sustain, now + duration - release);
            gain.gain.linearRampToValueAtTime(0, now + duration);

            osc.connect(gain);
            gain.connect(audioManager.getOutput());

            osc.start(now);
            osc.stop(now + duration + 0.1);
        }

        // Play chord
        async playChord(frequencies, options = {}) {
            const promises = frequencies.map((freq, i) =>
                this.playTone({
                    ...options,
                    frequency: freq,
                    volume: (options.volume || 0.2) / frequencies.length
                })
            );
            await Promise.all(promises);
        }

        // Play arpeggio
        async playArpeggio(frequencies, options = {}) {
            const { interval = 0.05 } = options;
            for (let i = 0; i < frequencies.length; i++) {
                setTimeout(() => {
                    this.playTone({
                        ...options,
                        frequency: frequencies[i],
                        volume: (options.volume || 0.2)
                    });
                }, i * interval * 1000);
            }
        }

        // White noise
        async playNoise(options = {}) {
            const ctx = await this.ensureContext();
            if (!ctx) return;

            const {
                duration = 0.1,
                volume = 0.1,
                filterFreq = 1000
            } = options;

            const now = ctx.currentTime;
            const bufferSize = ctx.sampleRate * duration;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = filterFreq;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume, now);
            gain.gain.linearRampToValueAtTime(0, now + duration);

            source.connect(filter);
            filter.connect(gain);
            gain.connect(audioManager.getOutput());

            source.start(now);
        }
    }

    const synth = new Synthesizer();

    // ========================================
    // Sound Effects Library
    // ========================================
    const SoundEffects = {
        // Message sent by user
        async messageSend() {
            await synth.playTone({
                frequency: 880,
                type: 'sine',
                duration: 0.08,
                attack: 0.005,
                volume: 0.15
            });
            setTimeout(() => {
                synth.playTone({
                    frequency: 1100,
                    type: 'sine',
                    duration: 0.06,
                    attack: 0.005,
                    volume: 0.12
                });
            }, 40);
        },

        // Message received from assistant
        async messageReceive() {
            await synth.playArpeggio([523, 659, 784], {
                type: 'sine',
                duration: 0.12,
                interval: 0.04,
                volume: 0.15
            });
        },

        // Typing indicator
        async typing() {
            await synth.playTone({
                frequency: 600 + Math.random() * 200,
                type: 'sine',
                duration: 0.03,
                volume: 0.05
            });
        },

        // Notification/alert
        async notification() {
            await synth.playChord([523, 659, 784], {
                type: 'sine',
                duration: 0.3,
                volume: 0.2
            });
        },

        // Happy reaction
        async happy() {
            await synth.playArpeggio([523, 659, 784, 1047], {
                type: 'triangle',
                duration: 0.15,
                interval: 0.06,
                volume: 0.2
            });
        },

        // Sad reaction
        async sad() {
            await synth.playArpeggio([392, 349, 330, 294], {
                type: 'sine',
                duration: 0.25,
                interval: 0.1,
                volume: 0.15
            });
        },

        // Excited reaction
        async excited() {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    synth.playTone({
                        frequency: 800 + i * 200,
                        type: 'square',
                        duration: 0.08,
                        volume: 0.1
                    });
                }, i * 80);
            }
        },

        // Surprised reaction
        async surprised() {
            await synth.playTone({
                frequency: 600,
                type: 'sine',
                duration: 0.15,
                volume: 0.2
            });
            setTimeout(() => {
                synth.playTone({
                    frequency: 1200,
                    type: 'sine',
                    duration: 0.2,
                    volume: 0.15
                });
            }, 100);
        },

        // Thinking/processing
        async thinking() {
            await synth.playTone({
                frequency: 400,
                type: 'sine',
                duration: 0.5,
                attack: 0.1,
                release: 0.2,
                volume: 0.08
            });
        },

        // Error
        async error() {
            await synth.playChord([200, 250], {
                type: 'sawtooth',
                duration: 0.2,
                volume: 0.15
            });
        },

        // Success
        async success() {
            await synth.playArpeggio([523, 659, 784, 1047], {
                type: 'sine',
                duration: 0.1,
                interval: 0.05,
                volume: 0.2
            });
        },

        // Click/tap
        async click() {
            await synth.playTone({
                frequency: 1000,
                type: 'sine',
                duration: 0.02,
                volume: 0.1
            });
        },

        // Pop (bubble)
        async pop() {
            await synth.playTone({
                frequency: 400,
                type: 'sine',
                duration: 0.08,
                attack: 0.001,
                volume: 0.15
            });
            await synth.playNoise({
                duration: 0.03,
                volume: 0.05,
                filterFreq: 2000
            });
        },

        // Whoosh (transition)
        async whoosh() {
            const ctx = await synth.ensureContext();
            if (!ctx) return;

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.1, now + 0.05);
            gain.gain.linearRampToValueAtTime(0, now + 0.2);

            osc.connect(gain);
            gain.connect(audioManager.getOutput());

            osc.start(now);
            osc.stop(now + 0.3);
        },

        // Sparkle (particles)
        async sparkle() {
            const frequencies = [1200, 1500, 1800, 2000];
            for (let i = 0; i < 4; i++) {
                setTimeout(() => {
                    synth.playTone({
                        frequency: frequencies[i] + Math.random() * 200,
                        type: 'sine',
                        duration: 0.1,
                        volume: 0.08
                    });
                }, i * 50);
            }
        },

        // Voice start (listening)
        async voiceStart() {
            await synth.playArpeggio([440, 554, 659], {
                type: 'sine',
                duration: 0.1,
                interval: 0.03,
                volume: 0.15
            });
        },

        // Voice end
        async voiceEnd() {
            await synth.playArpeggio([659, 554, 440], {
                type: 'sine',
                duration: 0.1,
                interval: 0.03,
                volume: 0.15
            });
        }
    };

    // ========================================
    // Emotion-based Sound Mapping
    // ========================================
    const EmotionSounds = {
        happy: SoundEffects.happy,
        sad: SoundEffects.sad,
        angry: SoundEffects.error,
        surprised: SoundEffects.surprised,
        excited: SoundEffects.excited,
        loving: SoundEffects.sparkle,
        worried: SoundEffects.thinking,
        neutral: SoundEffects.pop
    };

    // ========================================
    // Vibration API Integration
    // ========================================
    const Haptics = {
        supported: 'vibrate' in navigator,

        vibrate(pattern) {
            if (this.supported) {
                navigator.vibrate(pattern);
            }
        },

        tap() {
            this.vibrate(10);
        },

        success() {
            this.vibrate([50, 30, 50]);
        },

        error() {
            this.vibrate([100, 50, 100, 50, 100]);
        },

        notification() {
            this.vibrate([50, 100, 50]);
        }
    };

    // ========================================
    // Audio Manager (Main Interface)
    // ========================================
    class SimAudioManager {
        constructor() {
            this.enabled = true;
            this.hapticsEnabled = true;
        }

        async init() {
            await audioManager.init();
        }

        setEnabled(enabled) {
            this.enabled = enabled;
            audioManager.setMuted(!enabled);
        }

        setVolume(volume) {
            audioManager.setVolume(volume);
        }

        setHapticsEnabled(enabled) {
            this.hapticsEnabled = enabled;
        }

        async play(soundName) {
            if (!this.enabled) return;

            const sound = SoundEffects[soundName];
            if (sound) {
                await sound();
            }
        }

        async playEmotion(emotion) {
            if (!this.enabled) return;

            const sound = EmotionSounds[emotion];
            if (sound) {
                await sound();
            }
        }

        haptic(type = 'tap') {
            if (!this.hapticsEnabled) return;

            const haptic = Haptics[type];
            if (haptic) {
                haptic.call(Haptics);
            }
        }

        // Convenience methods
        async onMessageSend() {
            await this.play('messageSend');
            this.haptic('tap');
        }

        async onMessageReceive() {
            await this.play('messageReceive');
            this.haptic('notification');
        }

        async onTyping() {
            await this.play('typing');
        }

        async onVoiceStart() {
            await this.play('voiceStart');
            this.haptic('tap');
        }

        async onVoiceEnd() {
            await this.play('voiceEnd');
        }

        async onReaction(emotion) {
            await this.playEmotion(emotion);
        }

        /**
         * Dispose audio manager and release resources
         */
        dispose() {
            audioManager.dispose();
            this.enabled = false;
            this.hapticsEnabled = false;
        }
    }

    // ========================================
    // Public API
    // ========================================
    return {
        /** @type {string} Library version */
        version: '1.1.0',

        // Main manager factory
        create: () => new SimAudioManager(),

        // Direct access
        SoundEffects,
        EmotionSounds,
        Haptics,
        Synthesizer,

        // Utilities
        isSupported: () => !!(window.AudioContext || window.webkitAudioContext),
        isHapticsSupported: () => 'vibrate' in navigator
    };
}));
