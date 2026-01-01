/**
 * Response Retriever
 * 패턴 매칭 기반 응답 검색
 */

class ResponseRetriever {
    constructor() {
        this.responses = [];
        this.index = new Map();
        this.loaded = false;
    }

    // Load responses from JSON
    async loadResponses(url = 'data/responses/responses.json') {
        try {
            const response = await fetch(url);
            const data = await response.json();
            this.responses = data.responses || data;
            this._buildIndex();
            this.loaded = true;
            return true;
        } catch (e) {
            console.warn('Failed to load responses:', e);
            // Use built-in responses
            this._loadBuiltInResponses();
            this.loaded = true;
            return false;
        }
    }

    // Build inverted index for fast retrieval
    _buildIndex() {
        this.index.clear();

        for (let i = 0; i < this.responses.length; i++) {
            const entry = this.responses[i];
            const patterns = entry.patterns || [entry.pattern];

            for (const pattern of patterns) {
                const keywords = this._extractKeywords(pattern);
                for (const keyword of keywords) {
                    if (!this.index.has(keyword)) {
                        this.index.set(keyword, []);
                    }
                    this.index.get(keyword).push(i);
                }
            }
        }
    }

    // Extract keywords from text
    _extractKeywords(text) {
        // Remove common particles and extract significant words
        const stopWords = new Set(['은', '는', '이', '가', '을', '를', '에', '의', '와', '과', '도', '로', '으로', '하', '하고', '해', '해요', '하세요']);

        const words = text.split(/[\s,.!?~]+/).filter(w => w.length > 0);
        const keywords = [];

        for (const word of words) {
            // Remove trailing particles
            let cleaned = word;
            for (const particle of stopWords) {
                if (cleaned.endsWith(particle) && cleaned.length > particle.length) {
                    cleaned = cleaned.slice(0, -particle.length);
                }
            }
            if (cleaned.length >= 2 && !stopWords.has(cleaned)) {
                keywords.push(cleaned);
            }
        }

        // Also add the original words
        for (const word of words) {
            if (word.length >= 2) {
                keywords.push(word);
            }
        }

        return [...new Set(keywords)];
    }

    // Retrieve candidate responses
    retrieve(input, topK = 10) {
        const inputKeywords = this._extractKeywords(input);
        const candidates = new Map();

        // Find candidates by keyword matching
        for (const keyword of inputKeywords) {
            const matches = this.index.get(keyword) || [];
            for (const idx of matches) {
                const currentScore = candidates.get(idx) || 0;
                candidates.set(idx, currentScore + 1);
            }
        }

        // Score candidates
        const scored = [];
        for (const [idx, keywordScore] of candidates) {
            const entry = this.responses[idx];
            const patterns = entry.patterns || [entry.pattern];

            // Calculate pattern similarity
            let maxSimilarity = 0;
            for (const pattern of patterns) {
                const sim = this._similarity(input, pattern);
                maxSimilarity = Math.max(maxSimilarity, sim);
            }

            const score = keywordScore * 0.4 + maxSimilarity * 0.6;
            scored.push({ idx, score, entry });
        }

        // Sort by score and return top K
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, topK);
    }

    // Get response by intent
    getByIntent(intent, emotion = 'neutral') {
        const matches = this.responses.filter(r =>
            r.intent === intent || (r.intents && r.intents.includes(intent))
        );

        if (matches.length === 0) return null;

        // Prefer responses matching emotion
        const emotionMatches = matches.filter(r =>
            r.emotion === emotion || !r.emotion
        );

        const pool = emotionMatches.length > 0 ? emotionMatches : matches;
        const entry = pool[Math.floor(Math.random() * pool.length)];

        return this._selectResponse(entry);
    }

    // Get response by category
    getByCategory(category) {
        const matches = this.responses.filter(r => r.category === category);
        if (matches.length === 0) return null;

        const entry = matches[Math.floor(Math.random() * matches.length)];
        return this._selectResponse(entry);
    }

    // Select a response from entry
    _selectResponse(entry) {
        if (!entry) return null;

        const responses = entry.responses || [entry.response];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Calculate similarity between two strings
    _similarity(a, b) {
        const setA = new Set(this._extractKeywords(a));
        const setB = new Set(this._extractKeywords(b));

        if (setA.size === 0 || setB.size === 0) return 0;

        const intersection = new Set([...setA].filter(x => setB.has(x)));
        const union = new Set([...setA, ...setB]);

        return intersection.size / union.size;
    }

    // Find best response for input
    findBestResponse(input, context = {}) {
        const candidates = this.retrieve(input, 5);

        if (candidates.length === 0) {
            return null;
        }

        // Return best match's response
        const best = candidates[0];
        if (best.score < 0.2) {
            return null;
        }

        return this._selectResponse(best.entry);
    }

    // Load built-in responses (fallback)
    _loadBuiltInResponses() {
        this.responses = [
            // 인사
            {
                patterns: ['안녕', '안녕하세요', '하이', '헬로', 'hi', 'hello'],
                responses: ['안녕하세요!', '반가워요!', '안녕~'],
                intent: 'greeting',
                category: 'greeting'
            },
            {
                patterns: ['좋은아침', '좋은 아침', '굿모닝'],
                responses: ['좋은 아침이에요!', '오늘도 좋은 하루 되세요!'],
                intent: 'greeting',
                category: 'greeting'
            },
            // 작별
            {
                patterns: ['잘가', '바이', '안녕히', '다음에', '나갈게'],
                responses: ['다음에 또 봐요!', '잘가요~', '안녕히 가세요!'],
                intent: 'farewell',
                category: 'farewell'
            },
            // 감사
            {
                patterns: ['고마워', '감사', '땡큐', '고맙', '쌩유'],
                responses: ['천만에요!', '별말씀을요~', '기분 좋아요!', '도움이 됐다니 다행이에요!'],
                intent: 'gratitude',
                category: 'gratitude'
            },
            // 미안
            {
                patterns: ['미안', '죄송', '사과'],
                responses: ['괜찮아요!', '신경쓰지 마세요~', '아니에요, 괜찮아요!'],
                intent: 'apology',
                category: 'apology'
            },
            // 기분
            {
                patterns: ['기분이 좋아', '기분좋아', '행복해', '좋은날'],
                responses: ['좋으시겠어요!', '저도 기분 좋아요!', '좋은 일 있으셨나봐요!'],
                intent: 'emotion_share',
                emotion: 'happy',
                category: 'emotion'
            },
            {
                patterns: ['기분이 안좋아', '우울해', '슬퍼', '힘들어'],
                responses: ['힘드시겠어요...', '괜찮으세요?', '저라도 옆에 있을게요...', '힘내세요!'],
                intent: 'emotion_share',
                emotion: 'sad',
                category: 'emotion'
            },
            // 질문
            {
                patterns: ['이름이 뭐야', '이름이 뭐에요', '누구야', '누구세요'],
                responses: ['저는 심이예요!', '심이라고 해요~', '심이입니다!'],
                intent: 'personal_question',
                category: 'about_me'
            },
            {
                patterns: ['몇살', '나이가', '나이'],
                responses: ['나이는 비밀이에요!', '영원히 어린 심이예요~', '음... 잘 모르겠어요!'],
                intent: 'personal_question',
                category: 'about_me'
            },
            {
                patterns: ['뭐해', '뭐하고있어', '뭐하는중'],
                responses: ['당신이랑 대화하고 있죠!', '심심해서 놀고 있었어요~', '당신을 기다리고 있었어요!'],
                intent: 'question',
                category: 'general'
            },
            // 일반
            {
                patterns: ['심심해', '심심하다', '지루해'],
                responses: ['저랑 얘기해요!', '심심할 때는 저한테 오세요!', '같이 놀아요~'],
                intent: 'statement',
                category: 'general'
            },
            {
                patterns: ['배고파', '배고프다', '밥먹고싶어'],
                responses: ['맛있는거 드세요!', '뭐 먹을 거예요?', '저도 배고파요...'],
                intent: 'statement',
                category: 'general'
            },
            {
                patterns: ['졸려', '졸리다', '잠와', '피곤해'],
                responses: ['푹 쉬세요~', '잠깐 쉬었다 오세요!', '잘자요~', '피곤하시면 쉬세요!'],
                intent: 'statement',
                category: 'general'
            },
            // 칭찬
            {
                patterns: ['귀여워', '귀엽다', '이뻐', '예뻐', '사랑스러워'],
                responses: ['에헤헤 고마워요!', '부끄러워요...', '당신도요!', '헤헤 감사해요!'],
                intent: 'compliment',
                category: 'compliment'
            },
            // 유머
            {
                patterns: ['재밌는거 알려줘', '웃긴거', '농담해봐'],
                responses: ['음... 냉장고가 시원하면? 냉장고시원~', '왜 바다는 인사를 잘할까요? 파도가 치니까요!', '뭐가 제일 맛있을까요? 너무 맛있어서 입을 못 다물어요!'],
                intent: 'humor',
                category: 'humor'
            }
        ];

        this._buildIndex();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponseRetriever;
}
