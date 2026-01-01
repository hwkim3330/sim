/**
 * Intent Classifier
 * 사용자 의도 분류
 */

class IntentClassifier {
    constructor() {
        this.intents = [
            'greeting',         // 인사
            'farewell',         // 작별
            'question',         // 질문
            'statement',        // 진술
            'request',          // 요청
            'emotion_share',    // 감정 표현
            'opinion',          // 의견
            'humor',            // 유머/장난
            'compliment',       // 칭찬
            'complaint',        // 불평
            'gratitude',        // 감사
            'apology',          // 사과
            'personal_question', // 개인 질문
            'unknown'           // 기타
        ];

        // Pattern-based rules
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
                contains: ['ㅋㅋㅋ', 'ㅎㅎㅎ', '웃겨', '장난', '농담', '재밌', '개그', '유머'],
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
                contains: ['너는', '네가', '니가', '넌', '넌', '이름이', '몇살', '어디살', '좋아하', '싫어하'],
                startsWith: ['너', '넌', '니']
            }
        };

        // Question word patterns
        this.questionWords = ['뭐', '뭘', '왜', '어떻게', '언제', '어디', '누구', '누가', '몇', '얼마', '어느', '무슨', '무엇'];
    }

    classify(text) {
        const normalizedText = text.trim().toLowerCase();
        const scores = {};

        // Initialize scores
        for (const intent of this.intents) {
            scores[intent] = 0;
        }

        // Pattern matching
        for (const [intent, patterns] of Object.entries(this.patterns)) {
            let score = 0;

            // Check startsWith
            if (patterns.startsWith) {
                for (const pattern of patterns.startsWith) {
                    if (normalizedText.startsWith(pattern)) {
                        score += 2;
                    }
                }
            }

            // Check contains
            if (patterns.contains) {
                for (const pattern of patterns.contains) {
                    if (normalizedText.includes(pattern)) {
                        score += 1.5;
                    }
                }
            }

            // Check endsWith
            if (patterns.endsWith) {
                for (const pattern of patterns.endsWith) {
                    if (normalizedText.endsWith(pattern)) {
                        score += 1.5;
                    }
                }
            }

            scores[intent] = score;
        }

        // Question detection boost
        if (normalizedText.includes('?')) {
            scores.question += 2;
        }
        for (const qWord of this.questionWords) {
            if (normalizedText.includes(qWord)) {
                scores.question += 1;
            }
        }

        // Statement detection (default for longer text)
        if (normalizedText.length > 10 && Object.values(scores).every(s => s < 2)) {
            scores.statement += 1;
        }

        // Find max intent
        let maxIntent = 'unknown';
        let maxScore = 0;
        for (const [intent, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxIntent = intent;
            }
        }

        // If no strong signal, determine by sentence ending
        if (maxScore < 1.5) {
            if (normalizedText.endsWith('?') || normalizedText.match(/[까요나요가요]$/)) {
                maxIntent = 'question';
            } else {
                maxIntent = 'statement';
            }
        }

        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
        const confidence = totalScore > 0 ? Math.min(maxScore / totalScore, 1.0) : 0.3;

        return {
            intent: maxIntent,
            confidence: confidence,
            scores: scores
        };
    }

    // Get sub-intent for more specific categorization
    getSubIntent(text, mainIntent) {
        const subIntents = {
            question: ['what', 'why', 'how', 'when', 'where', 'who', 'yes_no'],
            greeting: ['morning', 'evening', 'casual', 'formal'],
            request: ['action', 'information', 'help']
        };

        if (mainIntent === 'question') {
            if (text.includes('뭐') || text.includes('뭘') || text.includes('무엇')) return 'what';
            if (text.includes('왜')) return 'why';
            if (text.includes('어떻게')) return 'how';
            if (text.includes('언제')) return 'when';
            if (text.includes('어디')) return 'where';
            if (text.includes('누구') || text.includes('누가')) return 'who';
            return 'yes_no';
        }

        return null;
    }

    // Check if the message is a command
    isCommand(text) {
        const commands = ['@', '/', '!', '#'];
        return commands.some(cmd => text.trim().startsWith(cmd));
    }

    // Parse command
    parseCommand(text) {
        const match = text.match(/^([/@!#])(\w+)\s*(.*)/);
        if (match) {
            return {
                type: match[1],
                command: match[2],
                args: match[3]
            };
        }
        return null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntentClassifier;
}
