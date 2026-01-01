/**
 * Conversation Memory
 * 대화 기록 및 컨텍스트 관리
 */

class ConversationMemory {
    constructor(options = {}) {
        this.maxTurns = options.maxTurns || 20;
        this.history = [];
        this.userProfile = {
            name: null,
            preferences: {},
            topics: [],
            emotionHistory: []
        };
        this.sessionStart = Date.now();
        this.messageCount = 0;
    }

    // Add a conversation turn
    addTurn(role, message, metadata = {}) {
        const turn = {
            role: role,  // 'user' or 'assistant'
            message: message,
            timestamp: Date.now(),
            emotion: metadata.emotion || 'neutral',
            intent: metadata.intent || 'unknown'
        };

        this.history.push(turn);
        this.messageCount++;

        // Track emotion history
        if (role === 'user' && metadata.emotion) {
            this.userProfile.emotionHistory.push({
                emotion: metadata.emotion,
                timestamp: turn.timestamp
            });
            // Keep only last 20 emotion records
            if (this.userProfile.emotionHistory.length > 20) {
                this.userProfile.emotionHistory.shift();
            }
        }

        // Extract and store topics
        if (role === 'user') {
            this._extractTopics(message);
        }

        // Trim history if too long
        while (this.history.length > this.maxTurns) {
            this.history.shift();
        }
    }

    // Get recent context
    getContext(numTurns = 5) {
        const recent = this.history.slice(-numTurns);
        return {
            turns: recent,
            userProfile: this.userProfile,
            sessionDuration: Date.now() - this.sessionStart,
            messageCount: this.messageCount
        };
    }

    // Get recent messages as formatted text
    getRecentMessages(numTurns = 3) {
        return this.history.slice(-numTurns).map(turn => ({
            role: turn.role,
            content: turn.message
        }));
    }

    // Get last user message
    getLastUserMessage() {
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].role === 'user') {
                return this.history[i].message;
            }
        }
        return null;
    }

    // Get last assistant message
    getLastAssistantMessage() {
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].role === 'assistant') {
                return this.history[i].message;
            }
        }
        return null;
    }

    // Get dominant emotion from recent history
    getDominantEmotion(numRecent = 5) {
        const recent = this.userProfile.emotionHistory.slice(-numRecent);
        if (recent.length === 0) return 'neutral';

        const counts = {};
        for (const record of recent) {
            counts[record.emotion] = (counts[record.emotion] || 0) + 1;
        }

        let maxEmotion = 'neutral';
        let maxCount = 0;
        for (const [emotion, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                maxEmotion = emotion;
            }
        }
        return maxEmotion;
    }

    // Check if this is a repeated question
    isRepeatedQuestion(message) {
        const normalizedNew = this._normalize(message);
        for (const turn of this.history.slice(-10)) {
            if (turn.role === 'user') {
                const normalizedOld = this._normalize(turn.message);
                if (this._similarity(normalizedNew, normalizedOld) > 0.8) {
                    return true;
                }
            }
        }
        return false;
    }

    // Check if user mentioned their name
    extractUserName(message) {
        // Korean name patterns
        const patterns = [
            /내\s*이름은\s*([가-힣]{2,4})(?:이야|예요|에요|야|입니다)?/,
            /([가-힣]{2,4})(?:이라고\s*해|라고\s*해|라고\s*불러)/,
            /나는?\s*([가-힣]{2,4})(?:이야|야)?/,
            /저는?\s*([가-힣]{2,4})(?:이에요|예요|입니다)?/
        ];

        for (const pattern of patterns) {
            const match = message.match(pattern);
            if (match) {
                this.userProfile.name = match[1];
                return match[1];
            }
        }
        return null;
    }

    // Get user name
    getUserName() {
        return this.userProfile.name;
    }

    // Set user name
    setUserName(name) {
        this.userProfile.name = name;
    }

    // Update user preference
    setPreference(key, value) {
        this.userProfile.preferences[key] = value;
    }

    // Get user preference
    getPreference(key) {
        return this.userProfile.preferences[key];
    }

    // Extract topics from message
    _extractTopics(message) {
        // Simple topic extraction based on keywords
        const topicKeywords = {
            music: ['음악', '노래', '가수', '앨범', '멜로디'],
            food: ['음식', '밥', '먹', '맛', '요리', '식당', '카페'],
            weather: ['날씨', '비', '눈', '맑', '흐리', '더워', '추워'],
            work: ['일', '회사', '직장', '업무', '프로젝트'],
            study: ['공부', '학교', '시험', '숙제', '학원'],
            game: ['게임', '플레이', '캐릭터', '레벨'],
            love: ['연애', '사랑', '좋아', '고백', '썸'],
            health: ['건강', '운동', '아파', '병원', '약'],
            hobby: ['취미', '여행', '영화', '드라마', '책']
        };

        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            for (const keyword of keywords) {
                if (message.includes(keyword)) {
                    if (!this.userProfile.topics.includes(topic)) {
                        this.userProfile.topics.push(topic);
                    }
                    break;
                }
            }
        }

        // Keep only recent topics
        if (this.userProfile.topics.length > 10) {
            this.userProfile.topics = this.userProfile.topics.slice(-10);
        }
    }

    // Normalize text for comparison
    _normalize(text) {
        return text.toLowerCase()
            .replace(/[^\w가-힣]/g, '')
            .trim();
    }

    // Simple similarity measure
    _similarity(a, b) {
        if (a === b) return 1;
        if (a.length === 0 || b.length === 0) return 0;

        // Character overlap
        const setA = new Set([...a]);
        const setB = new Set([...b]);
        const intersection = new Set([...setA].filter(x => setB.has(x)));

        return intersection.size / Math.max(setA.size, setB.size);
    }

    // Clear history
    clear() {
        this.history = [];
        this.messageCount = 0;
        this.sessionStart = Date.now();
    }

    // Save to localStorage
    save(key = 'sim_memory') {
        try {
            localStorage.setItem(key, JSON.stringify({
                history: this.history,
                userProfile: this.userProfile,
                sessionStart: this.sessionStart,
                messageCount: this.messageCount
            }));
        } catch (e) {
            console.warn('Failed to save memory:', e);
        }
    }

    // Load from localStorage
    load(key = 'sim_memory') {
        try {
            const data = localStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                this.history = parsed.history || [];
                this.userProfile = parsed.userProfile || this.userProfile;
                this.sessionStart = parsed.sessionStart || Date.now();
                this.messageCount = parsed.messageCount || 0;
                return true;
            }
        } catch (e) {
            console.warn('Failed to load memory:', e);
        }
        return false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConversationMemory;
}
