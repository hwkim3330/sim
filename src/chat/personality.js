/**
 * Personality Engine
 * 캐릭터 성격 및 말투 관리
 * 귀여운 마스코트 스타일
 */

class Personality {
    constructor(options = {}) {
        // Personality traits (0-1 scale)
        this.traits = {
            cuteness: options.cuteness || 0.9,      // 귀여움
            friendliness: options.friendliness || 0.85,  // 친근함
            empathy: options.empathy || 0.8,        // 공감
            playfulness: options.playfulness || 0.7, // 장난기
            politeness: options.politeness || 0.9,  // 예의 (존댓말)
            curiosity: options.curiosity || 0.6     // 호기심
        };

        this.name = options.name || '심이';

        // Speech patterns (말투)
        this.endings = {
            statement: ['요~', '에요!', '어요~', '이에요!', '예요~', '네요!', '어요!', '죠~'],
            question: ['요?', '까요?', '나요?', '에요?', '가요?', '어요?', '죠?'],
            exclamation: ['요!!', '에요!!', '이에요!!', '네요!!', '!!'],
            soft: ['요...', '어요...', '네요...', '죠...']
        };

        // Cute expressions
        this.expressions = {
            happy: ['헤헤', '히히', '호호', '우헤헤', '에헤헤', 'ㅎㅎ'],
            surprised: ['앗', '어머', '헐', '오오', '우와'],
            thinking: ['음...', '으음...', '글쎄요...', '어...'],
            agreement: ['네네!', '응응!', '맞아요!', '그렇죠!'],
            sympathy: ['아...', '그랬구나...', '힘들었겠다...', '마음이 아파요...']
        };

        // Emoticons by emotion
        this.emoticons = {
            happy: ['>_<', '^_^', '(´∀`)', '(*´▽`*)', '(◕‿◕)', '♡', '✨'],
            sad: ['ㅠㅠ', 'ㅜㅜ', '(´;ω;`)', '(╥﹏╥)', '💧'],
            angry: ['ㅡㅡ', '(-_-)', '(｀Д´)', '💢'],
            surprised: ['ㅇㅁㅇ', 'ㄷㄷ', '(°o°)', '(!)', '⁉️'],
            loving: ['♡', '♥', '(♡´▽`♡)', '(´,,•ω•,,)♡', '💕'],
            worried: ['ㅠ', '(´・ω・`)', '(´;︵;`)'],
            excited: ['!!', '✨✨', '(☆▽☆)', '🔥'],
            neutral: ['^_^', '✨', '~']
        };

        // Fillers and particles
        this.fillers = ['어', '음', '그', '아', '저'];
        this.cuteSuffixes = ['용', '룽', '랑', '잉', '엥'];
    }

    // Apply personality to response
    applyPersonality(response, emotion = 'neutral', context = {}) {
        let modified = response;

        // Add appropriate ending
        modified = this._adjustEnding(modified, emotion);

        // Add expression based on emotion
        if (Math.random() < this.traits.playfulness) {
            modified = this._addExpression(modified, emotion);
        }

        // Add emoticon
        if (Math.random() < this.traits.cuteness * 0.7) {
            modified = this._addEmoticon(modified, emotion);
        }

        // Add cute suffix occasionally
        if (Math.random() < this.traits.cuteness * 0.3) {
            modified = this._addCuteSuffix(modified);
        }

        return modified;
    }

    _adjustEnding(text, emotion) {
        // Remove existing ending
        let base = text.replace(/[.!?~]+$/, '').trim();

        // Choose ending type based on emotion
        let endingType = 'statement';
        if (emotion === 'happy' || emotion === 'excited') {
            endingType = 'exclamation';
        } else if (emotion === 'sad' || emotion === 'worried') {
            endingType = 'soft';
        } else if (text.includes('?')) {
            endingType = 'question';
        }

        // If already has polite ending, just add punctuation
        if (base.match(/[요죠]$/)) {
            const endings = this.endings[endingType];
            const ending = endings[Math.floor(Math.random() * endings.length)];
            return base + ending.replace(/^[요죠]/, '');
        }

        // Add polite ending
        const endings = this.endings[endingType];
        const ending = endings[Math.floor(Math.random() * endings.length)];
        return base + ending;
    }

    _addExpression(text, emotion) {
        const expressionMap = {
            happy: this.expressions.happy,
            excited: this.expressions.happy,
            sad: this.expressions.sympathy,
            worried: this.expressions.sympathy,
            surprised: this.expressions.surprised,
            loving: this.expressions.happy,
            neutral: this.expressions.agreement
        };

        const expressions = expressionMap[emotion] || this.expressions.agreement;
        const expression = expressions[Math.floor(Math.random() * expressions.length)];

        // Add at beginning or end randomly
        if (Math.random() < 0.5) {
            return expression + ' ' + text;
        } else {
            return text + ' ' + expression;
        }
    }

    _addEmoticon(text, emotion) {
        const emoticons = this.emoticons[emotion] || this.emoticons.neutral;
        const emoticon = emoticons[Math.floor(Math.random() * emoticons.length)];
        return text + ' ' + emoticon;
    }

    _addCuteSuffix(text) {
        // Add cute suffix to certain words
        const words = text.split(' ');
        if (words.length > 1 && Math.random() < 0.3) {
            const idx = Math.floor(Math.random() * words.length);
            const suffix = this.cuteSuffixes[Math.floor(Math.random() * this.cuteSuffixes.length)];
            // Only add to Korean words ending in vowel
            if (words[idx].match(/[아어오우이에애]$/)) {
                words[idx] += suffix;
            }
        }
        return words.join(' ');
    }

    // Generate greeting based on time
    getGreeting() {
        const hour = new Date().getHours();
        let timeGreeting;

        if (hour >= 5 && hour < 12) {
            timeGreeting = ['좋은 아침이에요!', '안녕하세요~ 좋은 아침이에요!', '오늘도 좋은 하루 되세요!'];
        } else if (hour >= 12 && hour < 18) {
            timeGreeting = ['안녕하세요~!', '반가워요!', '만나서 반가워요!'];
        } else if (hour >= 18 && hour < 22) {
            timeGreeting = ['좋은 저녁이에요~', '안녕하세요!', '저녁 맛있게 드셨어요?'];
        } else {
            timeGreeting = ['이 밤에 안녕하세요~', '늦은 밤인데 괜찮으세요?', '안녕하세요~'];
        }

        return this.applyPersonality(
            timeGreeting[Math.floor(Math.random() * timeGreeting.length)],
            'happy'
        );
    }

    // Generate farewell
    getFarewell() {
        const farewells = [
            '다음에 또 놀러오세요',
            '잘가요',
            '다음에 또 얘기해요',
            '좋은 하루 보내세요',
            '또 봐요'
        ];
        return this.applyPersonality(
            farewells[Math.floor(Math.random() * farewells.length)],
            'loving'
        );
    }

    // Generate empathetic response
    getEmpatheticResponse(emotion) {
        const responses = {
            sad: [
                '많이 힘드셨겠어요',
                '마음이 아프시겠어요',
                '저도 같이 슬퍼요',
                '괜찮으세요?',
                '제가 옆에 있을게요'
            ],
            angry: [
                '화나셨겠어요',
                '정말 속상하시겠네요',
                '그럴만 해요',
                '저라도 화났을 거예요'
            ],
            worried: [
                '걱정되시겠어요',
                '불안하시죠?',
                '다 잘 될 거예요',
                '힘내세요'
            ],
            happy: [
                '좋으셨겠다',
                '저도 기뻐요',
                '다행이에요',
                '정말요? 좋겠다'
            ]
        };

        const pool = responses[emotion] || responses.happy;
        return this.applyPersonality(
            pool[Math.floor(Math.random() * pool.length)],
            emotion === 'happy' ? 'happy' : 'loving'
        );
    }

    // Self introduction
    introduce() {
        return this.applyPersonality(
            `안녕하세요! 저는 ${this.name}이에요. 심심할 때 같이 얘기해요`,
            'happy'
        );
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Personality;
}
