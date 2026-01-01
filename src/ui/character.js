/**
 * Character Animator
 * 캐릭터 애니메이션 관리
 */

class CharacterAnimator {
    constructor(container) {
        this.container = container;
        this.character = null;
        this.speechBubble = null;
        this.currentState = 'idle';
        this.currentEmotion = 'neutral';
        this.particleContainer = null;

        this._createElements();
    }

    _createElements() {
        // Character wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'character-wrapper';

        // Character element
        this.character = document.createElement('div');
        this.character.className = 'character';
        this.character.dataset.state = 'idle';

        // Character image
        const img = document.createElement('img');
        img.src = 'assets/character.webp';
        img.alt = '심이';
        this.character.appendChild(img);

        // Speech bubble
        this.speechBubble = document.createElement('div');
        this.speechBubble.className = 'speech-bubble';

        // Particle container
        this.particleContainer = document.createElement('div');
        this.particleContainer.className = 'particle-container';

        wrapper.appendChild(this.speechBubble);
        wrapper.appendChild(this.character);
        wrapper.appendChild(this.particleContainer);
        this.container.appendChild(wrapper);
    }

    // Set character state
    setState(state) {
        const validStates = ['idle', 'thinking', 'talking', 'happy', 'sad', 'excited', 'surprised', 'worried'];
        if (!validStates.includes(state)) {
            state = 'idle';
        }

        this.currentState = state;
        this.character.dataset.state = state;

        // Play state-specific animation
        this._playStateAnimation(state);
    }

    // Set emotion
    setEmotion(emotion) {
        this.currentEmotion = emotion;

        // Map emotion to state
        const emotionStateMap = {
            happy: 'happy',
            sad: 'sad',
            angry: 'worried',
            surprised: 'surprised',
            loving: 'happy',
            worried: 'worried',
            excited: 'excited',
            neutral: 'idle'
        };

        this.setState(emotionStateMap[emotion] || 'idle');

        // Add emotion glow
        this._setEmotionGlow(emotion);
    }

    // Show speech bubble
    showSpeech(text, duration = 3000) {
        this.speechBubble.innerHTML = text;
        this.speechBubble.classList.add('visible');

        // Clear previous timeout
        if (this._speechTimeout) {
            clearTimeout(this._speechTimeout);
        }

        // Hide after duration
        if (duration > 0) {
            this._speechTimeout = setTimeout(() => {
                this.hideSpeech();
            }, duration);
        }
    }

    // Hide speech bubble
    hideSpeech() {
        this.speechBubble.classList.remove('visible');
    }

    // Create emotion particles
    createParticle(emoji) {
        const particle = document.createElement('div');
        particle.className = 'emotion-particle';
        particle.textContent = emoji;

        // Random position around character
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 50;
        const x = 50 + Math.cos(angle) * distance;
        const y = 30 + Math.sin(angle) * distance;

        particle.style.left = `${x}%`;
        particle.style.top = `${y}%`;
        particle.style.animationDuration = `${1 + Math.random() * 0.5}s`;

        this.particleContainer.appendChild(particle);

        // Remove after animation
        setTimeout(() => {
            particle.remove();
        }, 1500);
    }

    // Create multiple particles based on emotion
    showEmotionParticles(emotion) {
        const emojiMap = {
            happy: ['✨', '💫', '⭐', '🌟'],
            sad: ['💧', '🥲'],
            angry: ['💢', '😤'],
            surprised: ['❗', '⁉️', '❕'],
            loving: ['💕', '💖', '💗', '♡'],
            excited: ['🎉', '✨', '🔥', '💫'],
            worried: ['💦', '😰']
        };

        const emojis = emojiMap[emotion] || ['✨'];
        const count = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                this.createParticle(emoji);
            }, i * 100);
        }
    }

    // Play state-specific animation
    _playStateAnimation(state) {
        // Reset animation
        this.character.style.animation = 'none';
        this.character.offsetHeight; // Trigger reflow

        // Set animation based on state
        const animations = {
            idle: 'charIdle 3s ease-in-out infinite',
            thinking: 'charThinking 2s ease-in-out infinite',
            talking: 'charTalking 0.3s ease-in-out infinite',
            happy: 'charHappy 0.5s ease-in-out',
            sad: 'charSad 2s ease-in-out',
            excited: 'charExcited 0.3s ease-in-out infinite',
            surprised: 'charSurprised 0.5s ease-out',
            worried: 'charWorried 2s ease-in-out infinite'
        };

        // Note: animations are defined in CSS
    }

    // Set glow effect based on emotion
    _setEmotionGlow(emotion) {
        const glowColors = {
            happy: 'rgba(255, 220, 100, 0.4)',
            sad: 'rgba(100, 150, 255, 0.3)',
            angry: 'rgba(255, 100, 100, 0.4)',
            surprised: 'rgba(255, 200, 100, 0.4)',
            loving: 'rgba(255, 150, 200, 0.4)',
            excited: 'rgba(255, 180, 100, 0.5)',
            worried: 'rgba(150, 150, 200, 0.3)',
            neutral: 'rgba(255, 107, 157, 0.3)'
        };

        const color = glowColors[emotion] || glowColors.neutral;
        const img = this.character.querySelector('img');
        img.style.filter = `drop-shadow(0 0 30px ${color})`;
    }

    // Start thinking animation
    startThinking() {
        this.setState('thinking');
        this.showSpeech('🤔 음...', 0);
    }

    // Stop thinking and show response
    stopThinking() {
        this.hideSpeech();
    }

    // React to user input
    react(emotion, message) {
        this.setEmotion(emotion);

        if (emotion !== 'neutral') {
            this.showEmotionParticles(emotion);
        }

        // Show truncated message in speech bubble
        const truncated = message.length > 30 ? message.substring(0, 30) + '...' : message;
        this.showSpeech(truncated, 4000);

        // Talking animation while showing response
        setTimeout(() => {
            this.setState('talking');
        }, 100);

        setTimeout(() => {
            this.setEmotion(emotion);
        }, 500);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CharacterAnimator;
}
