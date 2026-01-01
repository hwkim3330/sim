/**
 * Voice Interface
 * Web Speech API wrapper for TTS/STT
 */

class VoiceInterface {
    constructor(options = {}) {
        this.lang = options.lang || 'ko-KR';
        this.synthesis = window.speechSynthesis;
        this.recognition = null;
        this.isListening = false;
        this.isSpeaking = false;
        this.enabled = options.enabled !== false;

        this._initRecognition();
        this._loadVoices();
    }

    _initRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = this.lang;
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;
    }

    _loadVoices() {
        // Load voices (may be async)
        this.voices = [];

        const loadVoices = () => {
            this.voices = this.synthesis.getVoices();
            // Find Korean voice
            this.koreanVoice = this.voices.find(v =>
                v.lang.startsWith('ko') || v.lang.includes('Korean')
            );
        };

        loadVoices();
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = loadVoices;
        }
    }

    // Text-to-Speech
    speak(text, options = {}) {
        if (!this.enabled || !this.synthesis) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            // Cancel any ongoing speech
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = this.lang;
            utterance.rate = options.rate || 1.0;
            utterance.pitch = options.pitch || 1.1;  // Slightly higher for cute character
            utterance.volume = options.volume || 1.0;

            // Use Korean voice if available
            if (this.koreanVoice) {
                utterance.voice = this.koreanVoice;
            }

            utterance.onstart = () => {
                this.isSpeaking = true;
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                resolve();
            };

            utterance.onerror = (event) => {
                this.isSpeaking = false;
                if (event.error !== 'canceled') {
                    reject(event);
                } else {
                    resolve();
                }
            };

            this.synthesis.speak(utterance);
        });
    }

    // Stop speaking
    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.isSpeaking = false;
        }
    }

    // Speech-to-Text - Start listening
    startListening(options = {}) {
        if (!this.recognition) {
            return Promise.reject(new Error('Speech Recognition not supported'));
        }

        return new Promise((resolve, reject) => {
            let finalTranscript = '';
            let interimCallback = options.onInterim;

            this.recognition.onresult = (event) => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcript;
                    } else {
                        interim += transcript;
                    }
                }

                if (interimCallback && interim) {
                    interimCallback(interim);
                }
            };

            this.recognition.onend = () => {
                this.isListening = false;
                resolve(finalTranscript);
            };

            this.recognition.onerror = (event) => {
                this.isListening = false;
                if (event.error === 'no-speech') {
                    resolve('');
                } else {
                    reject(event);
                }
            };

            this.recognition.start();
            this.isListening = true;
        });
    }

    // Stop listening
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
        }
    }

    // Check if TTS is supported
    static isTTSSupported() {
        return 'speechSynthesis' in window;
    }

    // Check if STT is supported
    static isSTTSupported() {
        return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    }

    // Enable/disable voice
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            this.stopSpeaking();
            this.stopListening();
        }
    }

    // Get available voices
    getVoices() {
        return this.voices;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VoiceInterface;
}
