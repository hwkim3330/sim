/**
 * Main Application
 * 심이 챗봇 메인 앱
 */

class SimApp {
    constructor() {
        this.responder = new Responder({
            name: '심이',
            personality: {
                cuteness: 0.9,
                friendliness: 0.85,
                empathy: 0.8,
                playfulness: 0.7,
                politeness: 0.9
            }
        });

        this.character = null;
        this.voice = null;
        this.chatContainer = null;
        this.input = null;
        this.sendButton = null;
        this.voiceButton = null;

        this.settings = {
            voiceEnabled: true,
            soundEnabled: true,
            theme: 'dark'
        };

        this._loadSettings();
    }

    async initialize() {
        // Initialize responder
        await this.responder.initialize();

        // Setup UI
        this._setupUI();

        // Initialize character
        const characterContainer = document.getElementById('character-container');
        if (characterContainer) {
            this.character = new CharacterAnimator(characterContainer);
        }

        // Initialize voice
        this.voice = new VoiceInterface({
            enabled: this.settings.voiceEnabled
        });

        // Show greeting
        this._showGreeting();

        console.log('심이 챗봇이 준비되었습니다!');
    }

    _setupUI() {
        // Get DOM elements
        this.chatContainer = document.getElementById('chat-messages');
        this.input = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-button');
        this.voiceButton = document.getElementById('voice-button');

        // Event listeners
        this.sendButton?.addEventListener('click', () => this._handleSend());

        this.input?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._handleSend();
            }
        });

        this.voiceButton?.addEventListener('click', () => this._handleVoiceInput());

        // Settings toggles
        document.getElementById('voice-toggle')?.addEventListener('change', (e) => {
            this.settings.voiceEnabled = e.target.checked;
            this.voice?.setEnabled(e.target.checked);
            this._saveSettings();
        });

        document.getElementById('clear-chat')?.addEventListener('click', () => {
            this._clearChat();
        });
    }

    async _handleSend() {
        const text = this.input?.value?.trim();
        if (!text) return;

        // Clear input
        this.input.value = '';

        // Add user message
        this._addMessage(text, 'user');

        // Show thinking animation
        this.character?.startThinking();

        try {
            // Get response
            const result = await this.responder.respond(text);

            // Stop thinking
            this.character?.stopThinking();

            // Add assistant message
            this._addMessage(result.response, 'assistant', result.emoji);

            // Character reaction
            this.character?.react(result.emotion, result.response);

            // Speak response if enabled
            if (this.settings.voiceEnabled) {
                await this.voice?.speak(result.response);
            }
        } catch (error) {
            console.error('Error getting response:', error);
            this.character?.stopThinking();
            this._addMessage('앗, 잠깐 문제가 생겼어요... 다시 말해주세요!', 'assistant', '😅');
        }
    }

    async _handleVoiceInput() {
        if (!VoiceInterface.isSTTSupported()) {
            alert('이 브라우저에서는 음성 인식이 지원되지 않아요.');
            return;
        }

        if (this.voice.isListening) {
            this.voice.stopListening();
            this.voiceButton?.classList.remove('listening');
            return;
        }

        try {
            this.voiceButton?.classList.add('listening');
            this.character?.showSpeech('🎤 듣고 있어요...', 0);

            const text = await this.voice.startListening({
                onInterim: (interim) => {
                    this.input.value = interim;
                }
            });

            this.voiceButton?.classList.remove('listening');
            this.character?.hideSpeech();

            if (text) {
                this.input.value = text;
                this._handleSend();
            }
        } catch (error) {
            console.error('Voice input error:', error);
            this.voiceButton?.classList.remove('listening');
            this.character?.hideSpeech();
        }
    }

    _addMessage(text, role, emoji = '') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        if (role === 'assistant' && emoji) {
            const emojiSpan = document.createElement('span');
            emojiSpan.className = 'message-emoji';
            emojiSpan.textContent = emoji;
            messageDiv.appendChild(emojiSpan);
        }

        const textSpan = document.createElement('span');
        textSpan.className = 'message-text';
        textSpan.textContent = text;
        messageDiv.appendChild(textSpan);

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = this._formatTime(new Date());
        messageDiv.appendChild(timeSpan);

        this.chatContainer?.appendChild(messageDiv);

        // Scroll to bottom
        this.chatContainer?.scrollTo({
            top: this.chatContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    _showGreeting() {
        const greeting = this.responder.getGreeting();
        setTimeout(() => {
            this._addMessage(greeting, 'assistant', '👋');
            this.character?.react('happy', greeting);

            if (this.settings.voiceEnabled) {
                this.voice?.speak(greeting);
            }
        }, 500);
    }

    _clearChat() {
        if (this.chatContainer) {
            this.chatContainer.innerHTML = '';
        }
        this.responder.clearConversation();
        this._showGreeting();
    }

    _formatTime(date) {
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    _loadSettings() {
        try {
            const saved = localStorage.getItem('sim_settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.warn('Failed to load settings');
        }
    }

    _saveSettings() {
        try {
            localStorage.setItem('sim_settings', JSON.stringify(this.settings));
        } catch (e) {
            console.warn('Failed to save settings');
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.simApp = new SimApp();
    window.simApp.initialize();
});
