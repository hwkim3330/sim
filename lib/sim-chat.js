/**
 * SimChat - Conversational AI Engine
 * @version 1.0.0
 * @license MIT
 *
 * Chat engine with intent classification, emotion detection,
 * and personality-driven response generation.
 *
 * @example
 * const chat = new SimChat.Engine({ name: '심이' });
 * await chat.initialize();
 * const response = await chat.respond('안녕하세요');
 */

(function(global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.SimChat = factory());
}(this, function() {
    'use strict';

    // ============================================================
    // INTENT CLASSIFIER
    // ============================================================

    class IntentClassifier {
        constructor() {
            this.intents = [
                'greeting', 'farewell', 'question', 'statement', 'request',
                'emotion_share', 'opinion', 'humor', 'compliment', 'complaint',
                'gratitude', 'apology', 'personal_question', 'unknown'
            ];

            this.patterns = {
                greeting: {
                    startsWith: ['안녕', '하이', '헬로', '반가', '좋은아침', '좋은저녁'],
                    contains: ['오랜만', '처음뵙', '만나서반가'],
                    endsWith: ['안녕', '하세요']
                },
                farewell: {
                    startsWith: ['잘가', '바이', '안녕히', '다음에'],
                    contains: ['나갈게', '들어갈게', '그만할게', '잘자'],
                    endsWith: ['바이', '잘자', '잘가']
                },
                question: {
                    contains: ['뭐야', '뭐지', '뭐에요', '뭘까', '어떻게', '왜', '언제', '어디', '누구', '몇'],
                    endsWith: ['?', '까요', '나요', '가요', '어요', '아요', '죠']
                },
                request: {
                    contains: ['해줘', '해주세요', '해줄래', '부탁', '해볼래', '할래'],
                    endsWith: ['해줘', '해주세요', '해줄래요', '줘', '주세요', '줄래']
                },
                emotion_share: {
                    contains: ['기분이', '느낌이', '마음이', '감정이', '슬퍼', '기뻐', '화나', '무서', '외로', '행복'],
                    startsWith: ['나', '내가', '오늘']
                },
                humor: {
                    contains: ['ㅋㅋㅋ', 'ㅎㅎㅎ', '웃겨', '장난', '농담', '재밌', '개그'],
                    endsWith: ['ㅋㅋ', 'ㅎㅎ']
                },
                compliment: {
                    contains: ['최고', '짱', '대단', '멋져', '예뻐', '이뻐', '잘했', '잘한다', '굿'],
                    startsWith: ['와', '우와', '오']
                },
                complaint: {
                    contains: ['싫어', '짜증', '화나', '별로', '왜이래', '이상해', '못해', '안돼'],
                    endsWith: ['ㅡㅡ', '-_-']
                },
                gratitude: {
                    contains: ['고마워', '감사', '땡큐', '쌩유', '고맙'],
                    startsWith: ['감사', '고마워']
                },
                apology: {
                    contains: ['미안', '죄송', '사과', '잘못'],
                    startsWith: ['미안', '죄송']
                },
                personal_question: {
                    contains: ['너는', '네가', '니가', '넌', '이름이', '몇살', '어디살', '좋아하', '싫어하'],
                    startsWith: ['너', '넌', '니']
                }
            };

            this.questionWords = ['뭐', '뭘', '왜', '어떻게', '언제', '어디', '누구', '누가', '몇', '얼마', '어느', '무슨'];
        }

        classify(text) {
            const normalized = text.trim().toLowerCase();
            const scores = {};

            for (const intent of this.intents) {
                scores[intent] = 0;
            }

            for (const [intent, patterns] of Object.entries(this.patterns)) {
                let score = 0;

                if (patterns.startsWith) {
                    for (const p of patterns.startsWith) {
                        if (normalized.startsWith(p)) score += 2;
                    }
                }

                if (patterns.contains) {
                    for (const p of patterns.contains) {
                        if (normalized.includes(p)) score += 1.5;
                    }
                }

                if (patterns.endsWith) {
                    for (const p of patterns.endsWith) {
                        if (normalized.endsWith(p)) score += 1.5;
                    }
                }

                scores[intent] = score;
            }

            if (normalized.includes('?')) scores.question += 2;
            for (const qw of this.questionWords) {
                if (normalized.includes(qw)) scores.question += 1;
            }

            if (normalized.length > 10 && Object.values(scores).every(s => s < 2)) {
                scores.statement += 1;
            }

            let maxIntent = 'unknown';
            let maxScore = 0;
            for (const [intent, score] of Object.entries(scores)) {
                if (score > maxScore) {
                    maxScore = score;
                    maxIntent = intent;
                }
            }

            if (maxScore < 1.5) {
                maxIntent = normalized.endsWith('?') || normalized.match(/[까요나요가요]$/) ? 'question' : 'statement';
            }

            const total = Object.values(scores).reduce((a, b) => a + b, 0);
            const confidence = total > 0 ? Math.min(maxScore / total, 1.0) : 0.3;

            return { intent: maxIntent, confidence, scores };
        }
    }

    // ============================================================
    // EMOTION DETECTOR
    // ============================================================

    class EmotionDetector {
        constructor() {
            this.emotions = ['happy', 'sad', 'angry', 'surprised', 'neutral', 'loving', 'worried', 'excited'];

            this.keywords = {
                happy: ['좋아', '행복', '기뻐', '신나', '즐거', '웃', '최고', '대박', '굿', '짱', 'ㅋㅋ', 'ㅎㅎ', '감사', '고마'],
                sad: ['슬퍼', '슬프', '우울', '힘들', '아파', '눈물', '울', '외로', 'ㅠㅠ', 'ㅜㅜ', '미안', '죄송', '그리워', '보고싶', '속상'],
                angry: ['화나', '짜증', '싫어', '열받', '빡', '분노', '미워', 'ㅡㅡ', '-_-', '최악', '별로'],
                surprised: ['놀라', '깜짝', '헐', '대박', '뭐야', '진짜', '실화', 'ㅇㅁㅇ', 'ㄷㄷ', '와', '우와', '헉'],
                loving: ['사랑', '좋아해', '사랑해', '♡', '♥', '애정', '설레', '두근', '귀여', '깜찍'],
                worried: ['걱정', '불안', '두려', '무서', '겁나', '초조', '어떡', '어쩌', '고민', '모르겠'],
                excited: ['기대', '설레', '신나', '두근', '드디어', '빨리', '얼른', '재밌', '흥미']
            };

            this.intensifiers = ['너무', '진짜', '완전', '엄청', '매우', '정말', '아주', '겁나', '개'];

            this.keywordIndex = new Map();
            for (const [emotion, words] of Object.entries(this.keywords)) {
                for (const word of words) {
                    if (!this.keywordIndex.has(word)) {
                        this.keywordIndex.set(word, []);
                    }
                    this.keywordIndex.get(word).push(emotion);
                }
            }
        }

        detect(text) {
            const lowerText = text.toLowerCase();
            const scores = {};
            for (const emotion of this.emotions) {
                scores[emotion] = 0;
            }

            let intensity = 1.0;
            for (const mod of this.intensifiers) {
                if (lowerText.includes(mod)) {
                    intensity = 1.5;
                    break;
                }
            }

            for (const [word, emotions] of this.keywordIndex) {
                if (lowerText.includes(word)) {
                    for (const emotion of emotions) {
                        scores[emotion] += intensity;
                    }
                }
            }

            this._detectEmoticons(lowerText, scores);
            this._detectRepetition(lowerText, scores);

            const total = Object.values(scores).reduce((a, b) => a + b, 0);
            if (total === 0) {
                return { emotion: 'neutral', confidence: 0.5, scores };
            }

            let maxEmotion = 'neutral';
            let maxScore = 0;
            for (const [emotion, score] of Object.entries(scores)) {
                if (score > maxScore) {
                    maxScore = score;
                    maxEmotion = emotion;
                }
            }

            const confidence = Math.min(maxScore / (total + 1), 1.0);
            return { emotion: maxEmotion, confidence, scores };
        }

        _detectEmoticons(text, scores) {
            if (/[ㅋ]{2,}|[ㅎ]{2,}|:\)|:D|😊|😄/.test(text)) scores.happy += 1.5;
            if (/[ㅠㅜ]{2,}|:\(|😢|😭/.test(text)) scores.sad += 1.5;
            if (/[♡♥❤💕💖]/.test(text)) scores.loving += 2;
            if (/[ㅡ]{2,}|-_-|😠|😡/.test(text)) scores.angry += 1.5;
            if (/[ㅇㅁ]{2,}|ㄷㄷ|😮|😲/.test(text)) scores.surprised += 1.5;
        }

        _detectRepetition(text, scores) {
            const kMatches = text.match(/ㅋ+/g);
            if (kMatches) {
                for (const k of kMatches) {
                    if (k.length >= 3) scores.happy += k.length * 0.3;
                }
            }
            const cryMatches = text.match(/[ㅠㅜ]+/g);
            if (cryMatches) {
                for (const c of cryMatches) {
                    if (c.length >= 2) scores.sad += c.length * 0.3;
                }
            }
        }

        getResponseEmotion(inputEmotion) {
            const map = {
                happy: 'happy', sad: 'loving', angry: 'worried', surprised: 'excited',
                loving: 'loving', worried: 'loving', excited: 'excited', neutral: 'happy'
            };
            return map[inputEmotion] || 'happy';
        }

        getEmoji(emotion) {
            const map = {
                happy: ['😊', '😄', '🥰', '✨'],
                sad: ['🥺', '😢', '💧'],
                angry: ['😤', '💢'],
                surprised: ['😮', '😲', '❗'],
                loving: ['💕', '💖', '🥰', '♡'],
                worried: ['😰', '🤔', '💦'],
                excited: ['🎉', '✨', '🔥'],
                neutral: ['😊', '✨']
            };
            const emojis = map[emotion] || map.neutral;
            return emojis[Math.floor(Math.random() * emojis.length)];
        }
    }

    // ============================================================
    // PERSONALITY ENGINE
    // ============================================================

    class Personality {
        constructor(options = {}) {
            this.name = options.name || '심이';
            this.traits = {
                cuteness: options.cuteness ?? 0.9,
                friendliness: options.friendliness ?? 0.85,
                empathy: options.empathy ?? 0.8,
                playfulness: options.playfulness ?? 0.7,
                politeness: options.politeness ?? 0.9
            };

            this.endings = {
                statement: ['요~', '에요!', '어요~', '이에요!', '네요!'],
                question: ['요?', '까요?', '나요?', '에요?'],
                exclamation: ['요!!', '에요!!', '네요!!'],
                soft: ['요...', '어요...', '네요...']
            };

            this.emoticons = {
                happy: ['>_<', '^_^', '♡', '✨'],
                sad: ['ㅠㅠ', 'ㅜㅜ', '💧'],
                angry: ['ㅡㅡ', '💢'],
                surprised: ['ㅇㅁㅇ', 'ㄷㄷ', '⁉️'],
                loving: ['♡', '♥', '💕'],
                worried: ['ㅠ', '💦'],
                excited: ['!!', '✨✨', '🔥'],
                neutral: ['^_^', '✨']
            };

            this.expressions = {
                happy: ['헤헤', '히히', 'ㅎㅎ'],
                surprised: ['앗', '어머', '헐', '오오'],
                thinking: ['음...', '글쎄요...'],
                agreement: ['네네!', '맞아요!'],
                sympathy: ['아...', '그랬구나...', '힘들었겠다...']
            };
        }

        apply(response, emotion = 'neutral') {
            let modified = response;
            modified = this._adjustEnding(modified, emotion);

            if (Math.random() < this.traits.playfulness) {
                modified = this._addExpression(modified, emotion);
            }

            if (Math.random() < this.traits.cuteness * 0.6) {
                modified = this._addEmoticon(modified, emotion);
            }

            return modified;
        }

        _adjustEnding(text, emotion) {
            let base = text.replace(/[.!?~]+$/, '').trim();
            let endingType = 'statement';

            if (emotion === 'happy' || emotion === 'excited') endingType = 'exclamation';
            else if (emotion === 'sad' || emotion === 'worried') endingType = 'soft';
            else if (text.includes('?')) endingType = 'question';

            if (base.match(/[요죠]$/)) {
                const endings = this.endings[endingType];
                return base + endings[Math.floor(Math.random() * endings.length)].replace(/^[요죠]/, '');
            }

            const endings = this.endings[endingType];
            return base + endings[Math.floor(Math.random() * endings.length)];
        }

        _addExpression(text, emotion) {
            const expMap = {
                happy: this.expressions.happy,
                excited: this.expressions.happy,
                sad: this.expressions.sympathy,
                worried: this.expressions.sympathy,
                surprised: this.expressions.surprised,
                neutral: this.expressions.agreement
            };
            const exps = expMap[emotion] || this.expressions.agreement;
            const exp = exps[Math.floor(Math.random() * exps.length)];
            return Math.random() < 0.5 ? `${exp} ${text}` : `${text} ${exp}`;
        }

        _addEmoticon(text, emotion) {
            const emoticons = this.emoticons[emotion] || this.emoticons.neutral;
            return `${text} ${emoticons[Math.floor(Math.random() * emoticons.length)]}`;
        }

        getGreeting() {
            const hour = new Date().getHours();
            let greeting;
            if (hour >= 5 && hour < 12) greeting = '좋은 아침이에요!';
            else if (hour >= 12 && hour < 18) greeting = '안녕하세요~!';
            else if (hour >= 18 && hour < 22) greeting = '좋은 저녁이에요~';
            else greeting = '안녕하세요~';
            return this.apply(greeting, 'happy');
        }

        getFarewell() {
            const farewells = ['다음에 또 놀러오세요', '잘가요', '또 봐요'];
            return this.apply(farewells[Math.floor(Math.random() * farewells.length)], 'loving');
        }

        introduce() {
            return this.apply(`안녕하세요! 저는 ${this.name}이에요. 심심할 때 같이 얘기해요`, 'happy');
        }

        getEmpathetic(emotion) {
            const responses = {
                sad: ['많이 힘드셨겠어요', '마음이 아프시겠어요', '제가 옆에 있을게요'],
                angry: ['화나셨겠어요', '속상하시겠네요'],
                worried: ['걱정되시겠어요', '다 잘 될 거예요'],
                happy: ['좋으셨겠다', '저도 기뻐요']
            };
            const pool = responses[emotion] || responses.happy;
            return this.apply(pool[Math.floor(Math.random() * pool.length)], emotion === 'happy' ? 'happy' : 'loving');
        }
    }

    // ============================================================
    // CONVERSATION MEMORY
    // ============================================================

    class Memory {
        constructor(options = {}) {
            this.maxTurns = options.maxTurns || 20;
            this.history = [];
            this.userProfile = { name: null, preferences: {}, topics: [], emotionHistory: [] };
            this.sessionStart = Date.now();
            this.messageCount = 0;
        }

        addTurn(role, message, metadata = {}) {
            const turn = {
                role, message,
                timestamp: Date.now(),
                emotion: metadata.emotion || 'neutral',
                intent: metadata.intent || 'unknown'
            };
            this.history.push(turn);
            this.messageCount++;

            if (role === 'user' && metadata.emotion) {
                this.userProfile.emotionHistory.push({ emotion: metadata.emotion, timestamp: turn.timestamp });
                if (this.userProfile.emotionHistory.length > 20) this.userProfile.emotionHistory.shift();
            }

            while (this.history.length > this.maxTurns) this.history.shift();
        }

        getContext(numTurns = 5) {
            return {
                turns: this.history.slice(-numTurns),
                userProfile: this.userProfile,
                messageCount: this.messageCount
            };
        }

        getLastUserMessage() {
            for (let i = this.history.length - 1; i >= 0; i--) {
                if (this.history[i].role === 'user') return this.history[i].message;
            }
            return null;
        }

        extractUserName(message) {
            const patterns = [
                /내\s*이름은\s*([가-힣]{2,4})(?:이야|예요|에요|야|입니다)?/,
                /([가-힣]{2,4})(?:이라고\s*해|라고\s*해|라고\s*불러)/,
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

        getUserName() { return this.userProfile.name; }
        setUserName(name) { this.userProfile.name = name; }
        clear() { this.history = []; this.messageCount = 0; this.sessionStart = Date.now(); }

        save(key = 'simchat_memory') {
            try {
                localStorage.setItem(key, JSON.stringify({
                    history: this.history, userProfile: this.userProfile, messageCount: this.messageCount
                }));
            } catch (e) { console.warn('Memory save failed'); }
        }

        load(key = 'simchat_memory') {
            try {
                const data = localStorage.getItem(key);
                if (data) {
                    const parsed = JSON.parse(data);
                    this.history = parsed.history || [];
                    this.userProfile = parsed.userProfile || this.userProfile;
                    this.messageCount = parsed.messageCount || 0;
                    return true;
                }
            } catch (e) { console.warn('Memory load failed'); }
            return false;
        }
    }

    // ============================================================
    // RESPONSE RETRIEVER
    // ============================================================

    class Retriever {
        constructor() {
            this.responses = [];
            this.index = new Map();
            this.loaded = false;
        }

        async load(data) {
            if (typeof data === 'string') {
                try {
                    const response = await fetch(data);
                    const json = await response.json();
                    this.responses = json.responses || json;
                } catch (e) {
                    console.warn('Failed to load responses:', e);
                    this._loadBuiltIn();
                }
            } else if (Array.isArray(data)) {
                this.responses = data;
            } else if (data?.responses) {
                this.responses = data.responses;
            }
            this._buildIndex();
            this.loaded = true;
        }

        _buildIndex() {
            this.index.clear();
            for (let i = 0; i < this.responses.length; i++) {
                const entry = this.responses[i];
                const patterns = entry.patterns || [entry.pattern];
                for (const pattern of patterns) {
                    const keywords = this._extractKeywords(pattern);
                    for (const kw of keywords) {
                        if (!this.index.has(kw)) this.index.set(kw, []);
                        this.index.get(kw).push(i);
                    }
                }
            }
        }

        _extractKeywords(text) {
            const stopWords = new Set(['은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '로']);
            const words = text.split(/[\s,.!?~]+/).filter(w => w.length >= 2);
            return [...new Set(words.filter(w => !stopWords.has(w)))];
        }

        retrieve(input, topK = 10) {
            const inputKw = this._extractKeywords(input);
            const candidates = new Map();

            for (const kw of inputKw) {
                const matches = this.index.get(kw) || [];
                for (const idx of matches) {
                    candidates.set(idx, (candidates.get(idx) || 0) + 1);
                }
            }

            const scored = [];
            for (const [idx, kwScore] of candidates) {
                const entry = this.responses[idx];
                const patterns = entry.patterns || [entry.pattern];
                let maxSim = 0;
                for (const p of patterns) {
                    const sim = this._similarity(input, p);
                    if (sim > maxSim) maxSim = sim;
                }
                scored.push({ idx, score: kwScore * 0.4 + maxSim * 0.6, entry });
            }

            return scored.sort((a, b) => b.score - a.score).slice(0, topK);
        }

        _similarity(a, b) {
            const setA = new Set(this._extractKeywords(a));
            const setB = new Set(this._extractKeywords(b));
            if (setA.size === 0 || setB.size === 0) return 0;
            const intersection = new Set([...setA].filter(x => setB.has(x)));
            return intersection.size / new Set([...setA, ...setB]).size;
        }

        findBest(input) {
            const candidates = this.retrieve(input, 5);
            if (candidates.length === 0 || candidates[0].score < 0.2) return null;
            const responses = candidates[0].entry.responses || [candidates[0].entry.response];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        getByIntent(intent) {
            const matches = this.responses.filter(r => r.intent === intent || r.intents?.includes(intent));
            if (matches.length === 0) return null;
            const entry = matches[Math.floor(Math.random() * matches.length)];
            const responses = entry.responses || [entry.response];
            return responses[Math.floor(Math.random() * responses.length)];
        }

        _loadBuiltIn() {
            this.responses = [
                { patterns: ['안녕', '안녕하세요', '하이'], responses: ['안녕하세요!', '반가워요!'], intent: 'greeting' },
                { patterns: ['잘가', '바이', '안녕히'], responses: ['다음에 또 봐요!', '잘가요~'], intent: 'farewell' },
                { patterns: ['고마워', '감사'], responses: ['천만에요!', '별말씀을요~'], intent: 'gratitude' },
                { patterns: ['미안', '죄송'], responses: ['괜찮아요!', '신경쓰지 마세요~'], intent: 'apology' },
                { patterns: ['이름이 뭐', '누구야'], responses: ['저는 심이예요!'], intent: 'personal_question' },
                { patterns: ['심심해', '지루해'], responses: ['저랑 얘기해요!', '같이 놀아요~'], intent: 'statement' },
                { patterns: ['기분이 좋아', '행복해'], responses: ['좋으시겠어요!', '저도 기뻐요!'], intent: 'emotion_share', emotion: 'happy' },
                { patterns: ['슬퍼', '우울해', '힘들어'], responses: ['힘드시겠어요...', '괜찮으세요?'], intent: 'emotion_share', emotion: 'sad' },
                { patterns: ['귀여워', '예뻐'], responses: ['에헤헤 고마워요!', '부끄러워요...'], intent: 'compliment' }
            ];
        }
    }

    // ============================================================
    // MAIN ENGINE
    // ============================================================

    class Engine {
        constructor(options = {}) {
            this.intentClassifier = new IntentClassifier();
            this.emotionDetector = new EmotionDetector();
            this.personality = new Personality(options);
            this.memory = new Memory(options.memory);
            this.retriever = new Retriever();

            this.name = options.name || '심이';
            this.initialized = false;

            this.handlers = new Map();
        }

        async initialize(responsesUrl) {
            await this.retriever.load(responsesUrl || 'data/responses/responses.json');
            this.memory.load();
            this.initialized = true;
            return this;
        }

        async respond(userMessage) {
            if (!this.initialized) await this.initialize();

            const intent = this.intentClassifier.classify(userMessage);
            const emotion = this.emotionDetector.detect(userMessage);

            this.memory.extractUserName(userMessage);
            this.memory.addTurn('user', userMessage, { intent: intent.intent, emotion: emotion.emotion });

            let response = await this._generate(userMessage, intent, emotion);
            const responseEmotion = this.emotionDetector.getResponseEmotion(emotion.emotion);
            response = this.personality.apply(response, responseEmotion);

            this.memory.addTurn('assistant', response, { emotion: responseEmotion });
            this.memory.save();

            return {
                response, emotion: responseEmotion, intent: intent.intent,
                userEmotion: emotion.emotion, emoji: this.emotionDetector.getEmoji(responseEmotion)
            };
        }

        async _generate(message, intent, emotion) {
            if (this.handlers.has(intent.intent)) {
                const handler = this.handlers.get(intent.intent);
                const result = handler(message, { intent, emotion, memory: this.memory, personality: this.personality });
                if (result) return result;
            }

            switch (intent.intent) {
                case 'greeting': return this._handleGreeting();
                case 'farewell': return this.personality.getFarewell();
                case 'gratitude': return this._pick(['천만에요', '별말씀을요', '도움이 됐다니 기뻐요']);
                case 'apology': return this._pick(['괜찮아요', '신경쓰지 마세요', '아니에요, 괜찮아요']);
                case 'personal_question': return this._handlePersonal(message);
                case 'emotion_share': return this.personality.getEmpathetic(emotion.emotion);
                case 'compliment': return this._pick(['에헤헤 고마워요', '부끄러워요...', '당신도요!']);
                case 'humor': return this._handleHumor();
            }

            const retrieved = this.retriever.findBest(message);
            if (retrieved) return retrieved;

            return this._fallback(intent, emotion);
        }

        _handleGreeting() {
            const userName = this.memory.getUserName();
            let greeting = this.personality.getGreeting();
            if (userName) greeting = `${userName}님, ${greeting}`;
            return greeting;
        }

        _handlePersonal(message) {
            const lower = message.toLowerCase();
            if (lower.includes('이름') || lower.includes('누구')) return this.personality.introduce();
            if (lower.includes('나이') || lower.includes('몇살')) return this._pick(['나이는 비밀이에요', '영원히 어린 심이예요~']);
            if (lower.includes('뭐해')) return this._pick(['당신이랑 대화하고 있죠', '당신을 기다리고 있었어요']);
            return '글쎄요... 잘 모르겠어요';
        }

        _handleHumor() {
            const jokes = [
                '냉장고가 시원하면? 냉장고시원~',
                '왜 바다는 인사를 잘할까요? 파도가 치니까요!',
                '가장 쉽게 만드는 케이크는? 핫케이크!',
                '세상에서 가장 빠른 채소는? 부추!'
            ];
            return jokes[Math.floor(Math.random() * jokes.length)];
        }

        _fallback(intent, emotion) {
            if (emotion.emotion === 'sad' || emotion.emotion === 'worried') {
                return this.personality.getEmpathetic(emotion.emotion);
            }
            if (intent.intent === 'question') {
                return this._pick(['음... 그건 저도 잘 모르겠어요', '좋은 질문이에요! 근데 잘 모르겠어요...']);
            }
            return this._pick(['그렇군요!', '오오 그래요?', '재밌네요!', '더 얘기해주세요~', '네네, 듣고 있어요~']);
        }

        _pick(arr) {
            return arr[Math.floor(Math.random() * arr.length)];
        }

        on(intent, handler) {
            this.handlers.set(intent, handler);
            return this;
        }

        setUserName(name) { this.memory.setUserName(name); }
        getGreeting() { return this.personality.getGreeting(); }
        clearHistory() { this.memory.clear(); }

        getCharacterState(emotion) {
            const map = { happy: 'happy', sad: 'sad', angry: 'worried', surprised: 'surprised', loving: 'happy', worried: 'thinking', excited: 'excited', neutral: 'idle' };
            return map[emotion] || 'idle';
        }
    }

    // ============================================================
    // EXPORTS
    // ============================================================

    return {
        version: '1.0.0',

        Engine,
        IntentClassifier,
        EmotionDetector,
        Personality,
        Memory,
        Retriever,

        create: (options) => new Engine(options)
    };
}));
