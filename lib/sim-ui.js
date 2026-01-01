/**
 * SimUI - UI Components Library
 * @version 1.0.0
 * @license MIT
 *
 * Character animation, chat interface, and voice components.
 *
 * @example
 * const character = new SimUI.Character(document.getElementById('character'));
 * character.setEmotion('happy');
 *
 * const voice = new SimUI.Voice();
 * await voice.speak('안녕하세요!');
 */

(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.SimUI = factory());
}(this, function() {
    'use strict';

    // ============================================================
    // CHARACTER ANIMATOR
    // ============================================================

    class Character {
        constructor(container, options = {}) {
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
            this.options = {
                imageSrc: options.imageSrc || 'assets/character.webp',
                imageAlt: options.imageAlt || 'Character',
                ...options
            };

            this.currentState = 'idle';
            this.currentEmotion = 'neutral';

            this.element = null;
            this.imageElement = null;
            this.speechBubble = null;
            this.particleContainer = null;

            this._speechTimeout = null;
            this._create();
        }

        _create() {
            // Wrapper
            const wrapper = document.createElement('div');
            wrapper.className = 'sim-character-wrapper';

            // Character
            this.element = document.createElement('div');
            this.element.className = 'sim-character';
            this.element.dataset.state = 'idle';

            // Image
            this.imageElement = document.createElement('img');
            this.imageElement.src = this.options.imageSrc;
            this.imageElement.alt = this.options.imageAlt;
            this.element.appendChild(this.imageElement);

            // Speech bubble
            this.speechBubble = document.createElement('div');
            this.speechBubble.className = 'sim-speech-bubble';

            // Particle container
            this.particleContainer = document.createElement('div');
            this.particleContainer.className = 'sim-particle-container';

            wrapper.appendChild(this.speechBubble);
            wrapper.appendChild(this.element);
            wrapper.appendChild(this.particleContainer);

            if (this.container) {
                this.container.appendChild(wrapper);
            }

            return wrapper;
        }

        /** Set character state */
        setState(state) {
            const validStates = ['idle', 'thinking', 'talking', 'happy', 'sad', 'excited', 'surprised', 'worried'];
            this.currentState = validStates.includes(state) ? state : 'idle';
            this.element.dataset.state = this.currentState;
            return this;
        }

        /** Set emotion (maps to state) */
        setEmotion(emotion) {
            this.currentEmotion = emotion;
            const map = {
                happy: 'happy', sad: 'sad', angry: 'worried', surprised: 'surprised',
                loving: 'happy', worried: 'worried', excited: 'excited', neutral: 'idle'
            };
            this.setState(map[emotion] || 'idle');
            this._setGlow(emotion);
            return this;
        }

        /** Show speech bubble */
        showSpeech(text, duration = 3000) {
            const truncated = text.length > 50 ? text.substring(0, 50) + '...' : text;
            this.speechBubble.textContent = truncated;
            this.speechBubble.classList.add('visible');

            if (this._speechTimeout) clearTimeout(this._speechTimeout);

            if (duration > 0) {
                this._speechTimeout = setTimeout(() => this.hideSpeech(), duration);
            }
            return this;
        }

        /** Hide speech bubble */
        hideSpeech() {
            this.speechBubble.classList.remove('visible');
            return this;
        }

        /** Create floating particle */
        createParticle(emoji) {
            const particle = document.createElement('div');
            particle.className = 'sim-particle';
            particle.textContent = emoji;

            const angle = Math.random() * Math.PI * 2;
            const distance = 30 + Math.random() * 50;
            particle.style.left = `${50 + Math.cos(angle) * distance}%`;
            particle.style.top = `${30 + Math.sin(angle) * distance}%`;
            particle.style.animationDuration = `${1 + Math.random() * 0.5}s`;

            this.particleContainer.appendChild(particle);
            setTimeout(() => particle.remove(), 1500);
            return this;
        }

        /** Show emotion particles */
        showEmotionParticles(emotion) {
            const emojiMap = {
                happy: ['✨', '💫', '⭐'], sad: ['💧'], angry: ['💢'],
                surprised: ['❗', '⁉️'], loving: ['💕', '💖', '♡'],
                excited: ['🎉', '✨', '🔥'], worried: ['💦']
            };
            const emojis = emojiMap[emotion] || ['✨'];
            const count = 3 + Math.floor(Math.random() * 3);

            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    this.createParticle(emojis[Math.floor(Math.random() * emojis.length)]);
                }, i * 100);
            }
            return this;
        }

        /** Set glow color */
        _setGlow(emotion) {
            const colors = {
                happy: 'rgba(255, 220, 100, 0.4)', sad: 'rgba(100, 150, 255, 0.3)',
                angry: 'rgba(255, 100, 100, 0.4)', surprised: 'rgba(255, 200, 100, 0.4)',
                loving: 'rgba(255, 150, 200, 0.4)', excited: 'rgba(255, 180, 100, 0.5)',
                worried: 'rgba(150, 150, 200, 0.3)', neutral: 'rgba(255, 107, 157, 0.3)'
            };
            this.imageElement.style.filter = `drop-shadow(0 0 30px ${colors[emotion] || colors.neutral})`;
        }

        /** React to message */
        react(emotion, message) {
            this.setEmotion(emotion);
            if (emotion !== 'neutral') this.showEmotionParticles(emotion);
            this.showSpeech(message, 4000);
            return this;
        }

        /** Start thinking */
        startThinking() {
            this.setState('thinking');
            this.showSpeech('🤔 음...', 0);
            return this;
        }

        /** Stop thinking */
        stopThinking() {
            this.hideSpeech();
            return this;
        }
    }

    // ============================================================
    // CHAT INTERFACE
    // ============================================================

    class ChatInterface {
        constructor(container, options = {}) {
            this.container = typeof container === 'string' ? document.querySelector(container) : container;
            this.options = {
                placeholder: options.placeholder || '메시지를 입력하세요...',
                onSend: options.onSend || (() => {}),
                onVoice: options.onVoice || null,
                ...options
            };

            this.messagesContainer = null;
            this.input = null;
            this.sendButton = null;
            this.voiceButton = null;

            this._create();
        }

        _create() {
            // Clear container
            this.container.innerHTML = '';
            this.container.classList.add('sim-chat-container');

            // Messages
            this.messagesContainer = document.createElement('div');
            this.messagesContainer.className = 'sim-chat-messages';

            // Input area
            const inputArea = document.createElement('div');
            inputArea.className = 'sim-chat-input-area';

            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'sim-chat-input-wrapper';

            this.input = document.createElement('input');
            this.input.type = 'text';
            this.input.className = 'sim-chat-input';
            this.input.placeholder = this.options.placeholder;

            this.sendButton = document.createElement('button');
            this.sendButton.className = 'sim-chat-send-btn';
            this.sendButton.textContent = '➤';

            inputWrapper.appendChild(this.input);

            if (this.options.onVoice) {
                this.voiceButton = document.createElement('button');
                this.voiceButton.className = 'sim-chat-voice-btn';
                this.voiceButton.textContent = '🎤';
                inputWrapper.appendChild(this.voiceButton);
            }

            inputWrapper.appendChild(this.sendButton);
            inputArea.appendChild(inputWrapper);

            this.container.appendChild(this.messagesContainer);
            this.container.appendChild(inputArea);

            this._setupEvents();
        }

        _setupEvents() {
            this.sendButton.addEventListener('click', () => this._handleSend());

            this.input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this._handleSend();
                }
            });

            if (this.voiceButton && this.options.onVoice) {
                this.voiceButton.addEventListener('click', () => {
                    this.options.onVoice();
                });
            }
        }

        _handleSend() {
            const text = this.input.value.trim();
            if (!text) return;

            this.input.value = '';
            this.options.onSend(text);
        }

        /** Add message to chat */
        addMessage(text, role = 'user', emoji = '') {
            const message = document.createElement('div');
            message.className = `sim-chat-message sim-chat-message-${role}`;

            if (role === 'assistant' && emoji) {
                const emojiEl = document.createElement('span');
                emojiEl.className = 'sim-chat-message-emoji';
                emojiEl.textContent = emoji;
                message.appendChild(emojiEl);
            }

            const textEl = document.createElement('span');
            textEl.className = 'sim-chat-message-text';
            textEl.textContent = text;
            message.appendChild(textEl);

            const timeEl = document.createElement('span');
            timeEl.className = 'sim-chat-message-time';
            timeEl.textContent = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
            message.appendChild(timeEl);

            this.messagesContainer.appendChild(message);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

            return this;
        }

        /** Clear all messages */
        clear() {
            this.messagesContainer.innerHTML = '';
            return this;
        }

        /** Set input value */
        setInput(text) {
            this.input.value = text;
            return this;
        }

        /** Focus input */
        focus() {
            this.input.focus();
            return this;
        }

        /** Set voice button state */
        setVoiceListening(listening) {
            if (this.voiceButton) {
                this.voiceButton.classList.toggle('listening', listening);
            }
            return this;
        }
    }

    // ============================================================
    // VOICE INTERFACE
    // ============================================================

    class Voice {
        constructor(options = {}) {
            this.lang = options.lang || 'ko-KR';
            this.enabled = options.enabled !== false;
            this.synthesis = window.speechSynthesis;
            this.recognition = null;
            this.isListening = false;
            this.isSpeaking = false;
            this.voices = [];
            this.selectedVoice = null;
            this.onVoicesLoaded = options.onVoicesLoaded || null;

            this._initRecognition();
            this._loadVoices();
            this._loadSavedVoice();
        }

        _initRecognition() {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return;

            this.recognition = new SpeechRecognition();
            this.recognition.lang = this.lang;
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
        }

        _loadVoices() {
            const load = () => {
                this.voices = this.synthesis?.getVoices() || [];
                this._loadSavedVoice();
                if (this.onVoicesLoaded) {
                    this.onVoicesLoaded(this.getVoicesForLanguage());
                }
            };
            load();
            if (this.synthesis?.onvoiceschanged !== undefined) {
                this.synthesis.onvoiceschanged = load;
            }
        }

        _loadSavedVoice() {
            try {
                const savedVoiceName = localStorage.getItem('simi_voice_' + this.lang);
                if (savedVoiceName && this.voices.length > 0) {
                    const voice = this.voices.find(v => v.name === savedVoiceName);
                    if (voice) {
                        this.selectedVoice = voice;
                    }
                }
            } catch (e) {
                // localStorage not available
            }
        }

        _saveVoice(voiceName) {
            try {
                localStorage.setItem('simi_voice_' + this.lang, voiceName);
            } catch (e) {
                // localStorage not available
            }
        }

        /** Get available voices for current language */
        getVoicesForLanguage(lang = null) {
            const targetLang = lang || this.lang;
            const langPrefix = targetLang.split('-')[0];
            return this.voices.filter(v =>
                v.lang.startsWith(langPrefix) || v.lang.startsWith(targetLang)
            );
        }

        /** Get all available voices */
        getAllVoices() {
            return this.voices;
        }

        /** Set voice by name */
        setVoice(voiceName) {
            const voice = this.voices.find(v => v.name === voiceName);
            if (voice) {
                this.selectedVoice = voice;
                this._saveVoice(voiceName);
                return true;
            }
            return false;
        }

        /** Get current voice name */
        getVoiceName() {
            return this.selectedVoice?.name || null;
        }

        /** Text-to-Speech */
        speak(text, options = {}) {
            if (!this.enabled || !this.synthesis) return Promise.resolve();

            return new Promise((resolve, reject) => {
                this.synthesis.cancel();

                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = this.lang;
                utterance.rate = options.rate || 1.0;
                utterance.pitch = options.pitch || 1.1;
                utterance.volume = options.volume || 1.0;

                // Use selected voice or find default for language
                if (this.selectedVoice) {
                    utterance.voice = this.selectedVoice;
                } else {
                    const defaultVoice = this.voices.find(v => v.lang.startsWith(this.lang.split('-')[0]));
                    if (defaultVoice) utterance.voice = defaultVoice;
                }

                utterance.onstart = () => { this.isSpeaking = true; };
                utterance.onend = () => { this.isSpeaking = false; resolve(); };
                utterance.onerror = (e) => {
                    this.isSpeaking = false;
                    e.error !== 'canceled' ? reject(e) : resolve();
                };

                this.synthesis.speak(utterance);
            });
        }

        /** Stop speaking */
        stop() {
            if (this.synthesis) {
                this.synthesis.cancel();
                this.isSpeaking = false;
            }
            return this;
        }

        /** Start listening */
        listen(options = {}) {
            if (!this.recognition) {
                return Promise.reject(new Error('Speech Recognition not supported'));
            }

            return new Promise((resolve, reject) => {
                let finalTranscript = '';

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
                    if (options.onInterim && interim) options.onInterim(interim);
                };

                this.recognition.onend = () => {
                    this.isListening = false;
                    resolve(finalTranscript);
                };

                this.recognition.onerror = (e) => {
                    this.isListening = false;
                    e.error === 'no-speech' ? resolve('') : reject(e);
                };

                this.recognition.start();
                this.isListening = true;
            });
        }

        /** Stop listening */
        stopListening() {
            if (this.recognition && this.isListening) {
                this.recognition.stop();
                this.isListening = false;
            }
            return this;
        }

        /** Enable/disable */
        setEnabled(enabled) {
            this.enabled = enabled;
            if (!enabled) {
                this.stop();
                this.stopListening();
            }
            return this;
        }

        /** Check TTS support */
        static isTTSSupported() {
            return 'speechSynthesis' in window;
        }

        /** Check STT support */
        static isSTTSupported() {
            return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
        }
    }

    // ============================================================
    // CSS INJECTOR
    // ============================================================

    const Styles = {
        _injected: false,

        inject() {
            if (this._injected) return;

            const css = `
                /* Character Styles */
                .sim-character-wrapper {
                    position: relative;
                    width: 100%;
                    height: 100%;
                }

                .sim-character {
                    position: absolute;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 280px;
                    height: 350px;
                    overflow: hidden;
                }

                .sim-character img {
                    width: 250%;
                    height: auto;
                    object-fit: cover;
                    object-position: left top;
                    transition: filter 0.3s, transform 0.3s;
                }

                .sim-character[data-state="idle"] img { animation: simCharIdle 3s ease-in-out infinite; }
                .sim-character[data-state="thinking"] img { animation: simCharThinking 2s ease-in-out infinite; }
                .sim-character[data-state="talking"] img { animation: simCharTalking 0.3s ease-in-out infinite; }
                .sim-character[data-state="happy"] img { animation: simCharHappy 0.5s ease-in-out; }
                .sim-character[data-state="sad"] img { animation: simCharSad 2s ease-in-out; }
                .sim-character[data-state="excited"] img { animation: simCharExcited 0.3s ease-in-out infinite; }
                .sim-character[data-state="surprised"] img { animation: simCharSurprised 0.5s ease-out; }
                .sim-character[data-state="worried"] img { animation: simCharWorried 2s ease-in-out infinite; }

                @keyframes simCharIdle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                @keyframes simCharThinking { 0%, 100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-5px) rotate(2deg); } }
                @keyframes simCharTalking { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
                @keyframes simCharHappy { 0% { transform: scale(1); } 50% { transform: scale(1.08) rotate(-3deg); } 100% { transform: scale(1.05); } }
                @keyframes simCharSad { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
                @keyframes simCharExcited { 0%, 100% { transform: translateY(0) scale(1.05); } 50% { transform: translateY(-15px) scale(1.08); } }
                @keyframes simCharSurprised { 0% { transform: scale(1); } 30% { transform: scale(1.15) translateY(-10px); } 100% { transform: scale(1.05); } }
                @keyframes simCharWorried { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }

                .sim-speech-bubble {
                    position: absolute;
                    top: 50px;
                    left: 50%;
                    transform: translateX(-50%) scale(0.8);
                    background: white;
                    color: #333;
                    padding: 15px 20px;
                    border-radius: 20px;
                    font-size: 1rem;
                    white-space: nowrap;
                    opacity: 0;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
                    z-index: 100;
                    max-width: 280px;
                    text-align: center;
                }

                .sim-speech-bubble::after {
                    content: '';
                    position: absolute;
                    bottom: -12px;
                    left: 50%;
                    transform: translateX(-50%);
                    border-left: 15px solid transparent;
                    border-right: 15px solid transparent;
                    border-top: 15px solid white;
                }

                .sim-speech-bubble.visible {
                    opacity: 1;
                    transform: translateX(-50%) scale(1);
                }

                .sim-particle-container {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: none;
                    overflow: hidden;
                }

                .sim-particle {
                    position: absolute;
                    font-size: 1.5rem;
                    animation: simParticleFloat 1.5s ease-out forwards;
                }

                @keyframes simParticleFloat {
                    0% { opacity: 1; transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(-120px) scale(0.5); }
                }

                /* Chat Styles */
                .sim-chat-container {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    background: rgba(255, 255, 255, 0.02);
                }

                .sim-chat-messages {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }

                .sim-chat-message {
                    max-width: 80%;
                    padding: 12px 16px;
                    border-radius: 18px;
                    animation: simMsgIn 0.3s ease-out;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                @keyframes simMsgIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .sim-chat-message-user {
                    align-self: flex-end;
                    background: linear-gradient(135deg, #ff6b9d, #c44569);
                    color: white;
                    border-bottom-right-radius: 4px;
                }

                .sim-chat-message-assistant {
                    align-self: flex-start;
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                    border-bottom-left-radius: 4px;
                }

                .sim-chat-message-emoji { font-size: 1.2rem; }
                .sim-chat-message-text { font-size: 0.95rem; line-height: 1.5; }
                .sim-chat-message-time { font-size: 0.7rem; opacity: 0.5; align-self: flex-end; }

                .sim-chat-input-area {
                    padding: 15px 20px;
                    background: rgba(0, 0, 0, 0.3);
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                .sim-chat-input-wrapper {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .sim-chat-input {
                    flex: 1;
                    padding: 12px 18px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 25px;
                    background: rgba(255, 255, 255, 0.05);
                    color: white;
                    font-size: 0.95rem;
                    outline: none;
                }

                .sim-chat-input:focus {
                    border-color: #ff6b9d;
                    background: rgba(255, 255, 255, 0.08);
                }

                .sim-chat-send-btn, .sim-chat-voice-btn {
                    width: 45px;
                    height: 45px;
                    border: none;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.2rem;
                    transition: all 0.2s;
                }

                .sim-chat-send-btn {
                    background: linear-gradient(135deg, #ff6b9d, #c44569);
                    color: white;
                }

                .sim-chat-send-btn:hover { transform: scale(1.05); }

                .sim-chat-voice-btn {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }

                .sim-chat-voice-btn:hover { background: rgba(255, 255, 255, 0.2); }
                .sim-chat-voice-btn.listening { background: #ff6b9d; animation: simPulse 1s infinite; }

                @keyframes simPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.1); } }
            `;

            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
            this._injected = true;
        }
    };

    // Auto-inject styles
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => Styles.inject());
        } else {
            Styles.inject();
        }
    }

    // ============================================================
    // EXPORTS
    // ============================================================

    return {
        version: '1.0.0',

        Character,
        ChatInterface,
        Voice,
        Styles,

        // Utilities
        isTTSSupported: Voice.isTTSSupported,
        isSTTSupported: Voice.isSTTSupported
    };
}));
