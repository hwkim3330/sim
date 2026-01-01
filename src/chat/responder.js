/**
 * Main Responder
 * 모든 컴포넌트를 조합하여 응답 생성
 */

class Responder {
    constructor(options = {}) {
        this.intentClassifier = new IntentClassifier();
        this.emotionDetector = new EmotionDetector();
        this.personality = new Personality(options.personality);
        this.memory = new ConversationMemory(options.memory);
        this.retriever = new ResponseRetriever();

        this.name = options.name || '심이';
        this.initialized = false;
    }

    async initialize() {
        await this.retriever.loadResponses();
        this.memory.load();
        this.initialized = true;
    }

    // Main response generation
    async respond(userMessage) {
        if (!this.initialized) {
            await this.initialize();
        }

        // Analyze user input
        const intent = this.intentClassifier.classify(userMessage);
        const emotion = this.emotionDetector.detect(userMessage);

        // Extract user name if mentioned
        this.memory.extractUserName(userMessage);

        // Add user turn to memory
        this.memory.addTurn('user', userMessage, {
            intent: intent.intent,
            emotion: emotion.emotion
        });

        // Generate response
        let response = await this._generateResponse(userMessage, intent, emotion);

        // Apply personality
        const responseEmotion = this.emotionDetector.getResponseEmotion(emotion.emotion);
        response = this.personality.applyPersonality(response, responseEmotion, {
            intent: intent.intent
        });

        // Add assistant turn to memory
        this.memory.addTurn('assistant', response, {
            emotion: responseEmotion
        });

        // Save memory
        this.memory.save();

        return {
            response: response,
            emotion: responseEmotion,
            intent: intent.intent,
            userEmotion: emotion.emotion,
            emoji: this.emotionDetector.getEmoji(responseEmotion)
        };
    }

    async _generateResponse(userMessage, intent, emotion) {
        const context = this.memory.getContext();

        // Handle specific intents
        switch (intent.intent) {
            case 'greeting':
                return this._handleGreeting(context);

            case 'farewell':
                return this._handleFarewell(context);

            case 'gratitude':
                return this._handleGratitude();

            case 'apology':
                return this._handleApology();

            case 'personal_question':
                return this._handlePersonalQuestion(userMessage);

            case 'emotion_share':
                return this._handleEmotionShare(emotion);

            case 'compliment':
                return this._handleCompliment();

            case 'humor':
                return this._handleHumor();

            default:
                // Try retrieval-based response
                const retrieved = this.retriever.findBestResponse(userMessage, context);
                if (retrieved) {
                    return retrieved;
                }

                // Fallback responses
                return this._generateFallback(userMessage, intent, emotion);
        }
    }

    _handleGreeting(context) {
        const userName = this.memory.getUserName();
        const greetings = [
            '안녕하세요',
            '반가워요',
            '안녕~'
        ];

        let response = greetings[Math.floor(Math.random() * greetings.length)];

        if (userName) {
            response = `${userName}님, ${response}`;
        }

        // Add time-based greeting
        if (context.messageCount === 0) {
            response = this.personality.getGreeting();
        }

        return response;
    }

    _handleFarewell(context) {
        const userName = this.memory.getUserName();
        let response = this.personality.getFarewell();

        if (userName) {
            response = `${userName}님, ${response}`;
        }

        return response;
    }

    _handleGratitude() {
        const responses = [
            '천만에요',
            '별말씀을요~',
            '도움이 됐다니 기뻐요',
            '저도 고마워요'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    _handleApology() {
        const responses = [
            '괜찮아요',
            '신경쓰지 마세요',
            '아니에요, 괜찮아요~',
            '전 괜찮아요'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    _handlePersonalQuestion(message) {
        const lowerMessage = message.toLowerCase();

        // Name question
        if (lowerMessage.includes('이름') || lowerMessage.includes('누구')) {
            return this.personality.introduce();
        }

        // Age question
        if (lowerMessage.includes('나이') || lowerMessage.includes('몇살') || lowerMessage.includes('몇 살')) {
            const responses = [
                '나이는 비밀이에요',
                '영원히 어린 심이예요~',
                '음... 나이는 잘 모르겠어요'
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        // What are you doing
        if (lowerMessage.includes('뭐해') || lowerMessage.includes('뭐하고')) {
            const responses = [
                '당신이랑 대화하고 있죠',
                '심심해서 놀고 있었어요',
                '당신을 기다리고 있었어요'
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        // Like/dislike
        if (lowerMessage.includes('좋아') || lowerMessage.includes('좋아하')) {
            const responses = [
                '많은 것들을 좋아해요',
                '사람들이랑 얘기하는 게 제일 좋아요',
                '당신이랑 대화하는 거요'
            ];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        // Default personal question response
        return '글쎄요... 잘 모르겠어요';
    }

    _handleEmotionShare(emotion) {
        return this.personality.getEmpatheticResponse(emotion.emotion);
    }

    _handleCompliment() {
        const responses = [
            '에헤헤 고마워요',
            '부끄러워요...',
            '당신도 멋져요',
            '헤헤 감사해요',
            '그런 말 들으니까 기분 좋아요'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    _handleHumor() {
        const jokes = [
            '냉장고가 시원하면? 냉장고시원~',
            '왜 바다는 인사를 잘할까요? 파도가 치니까요!',
            '가장 쉽게 만드는 케이크는? 핫케이크!',
            '왜 비는 노래를 못할까요? 빗소리가 나서요!',
            '원피스 닮은 과일은? 무~',
            '치킨은 왜 뜨거울까요? 닭이 화가 났으니까요!',
            '가장 맛있는 새는? 참새!',
            '세상에서 가장 빠른 채소는? 부추!',
            '제일 웃긴 동물은? 하하하마!'
        ];
        return jokes[Math.floor(Math.random() * jokes.length)];
    }

    _generateFallback(userMessage, intent, emotion) {
        // Check for keywords and generate contextual response
        const lowerMessage = userMessage.toLowerCase();

        // Emotional support
        if (emotion.emotion === 'sad' || emotion.emotion === 'worried') {
            return this.personality.getEmpatheticResponse(emotion.emotion);
        }

        // Questions
        if (intent.intent === 'question') {
            const questionResponses = [
                '음... 그건 저도 잘 모르겠어요',
                '좋은 질문이에요! 근데 잘 모르겠어요...',
                '글쎄요... 한번 생각해볼게요',
                '어려운 질문이에요!'
            ];
            return questionResponses[Math.floor(Math.random() * questionResponses.length)];
        }

        // General statements
        const generalResponses = [
            '그렇군요!',
            '오오 그래요?',
            '음... 그렇구나',
            '재밌네요!',
            '더 얘기해주세요~',
            '그렇군요~ 저도 궁금해요',
            '아하!',
            '네네, 듣고 있어요~'
        ];

        // Add variety based on emotion
        if (emotion.emotion === 'happy' || emotion.emotion === 'excited') {
            generalResponses.push('좋아요!', '신나네요!', '저도 기분이 좋아져요!');
        }

        return generalResponses[Math.floor(Math.random() * generalResponses.length)];
    }

    // Set user name
    setUserName(name) {
        this.memory.setUserName(name);
    }

    // Get greeting message
    getGreeting() {
        return this.personality.getGreeting();
    }

    // Get character state based on emotion
    getCharacterState(emotion) {
        const stateMap = {
            happy: 'happy',
            sad: 'sad',
            angry: 'worried',
            surprised: 'surprised',
            loving: 'happy',
            worried: 'thinking',
            excited: 'excited',
            neutral: 'idle'
        };
        return stateMap[emotion] || 'idle';
    }

    // Clear conversation
    clearConversation() {
        this.memory.clear();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Responder;
}
