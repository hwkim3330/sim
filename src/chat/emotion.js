/**
 * Emotion Detector
 * 한국어 감정 분석
 */

class EmotionDetector {
    constructor() {
        this.emotions = ['happy', 'sad', 'angry', 'surprised', 'neutral', 'loving', 'worried', 'excited'];

        // Korean emotion keywords
        this.keywords = {
            happy: [
                '좋아', '행복', '기뻐', '신나', '즐거', '웃', '최고', '대박', '굿', '짱',
                'ㅋㅋ', 'ㅎㅎ', '히히', '하하', '호호', '헤헤', '기분좋', '좋은', '행운',
                '축하', '감사', '고마', '사랑', '예쁘', '이쁘', '멋', '훌륭', '완벽'
            ],
            sad: [
                '슬퍼', '슬프', '우울', '힘들', '아파', '눈물', '울', '외로', '쓸쓸',
                'ㅠㅠ', 'ㅜㅜ', 'ㅠ', 'ㅜ', '흑흑', '엉엉', '미안', '죄송', '후회',
                '그리워', '보고싶', '안타', '불쌍', '마음아파', '속상', '서러'
            ],
            angry: [
                '화나', '짜증', '싫어', '열받', '빡', '분노', '미워', '증오', '꺼져',
                '짜증나', '화남', '열받아', '빡치', '극혐', '진짜싫', '죽', '패',
                'ㅡㅡ', '-_-', '에휴', '쩝', '한심', '최악', '별로'
            ],
            surprised: [
                '놀라', '깜짝', '헐', '대박', '뭐야', '진짜', '실화', '레알', '정말',
                '어머', '세상에', '맙소사', '믿기지', '충격', '놀랬', 'ㅇㅁㅇ', 'ㄷㄷ',
                '오', '와', '우와', '헉', '엥', '잉', '허걱', '어어'
            ],
            loving: [
                '사랑', '좋아해', '사랑해', '최애', '덕질', '팬', '응원', '♡', '♥',
                '러브', 'love', '애정', '스윗', '달달', '설레', '두근', '심쿵',
                '귀여', '깜찍', '앙', '뽀뽀', '뽁뽁', '쪼', '애인', '연인'
            ],
            worried: [
                '걱정', '불안', '두려', '무서', '겁나', '초조', '떨려', '긴장',
                '어떡', '어쩌', '어떻게', '모르겠', '고민', '망설', '혼란', '당황',
                '곤란', '난감', '문제', '심각', '위험', '조심', '주의'
            ],
            excited: [
                '기대', '설레', '신나', '두근', '흥분', '열정', '열광', '환호',
                '드디어', '빨리', '얼른', '어서', '기다려', '궁금', '알고싶',
                '재밌', '재미', '흥미', '관심', '호기심', '신기', '놀라'
            ],
            neutral: []
        };

        // Intensity modifiers
        this.intensifiers = ['너무', '진짜', '완전', '엄청', '매우', '정말', '아주', '겁나', '개'];

        // Build keyword index
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

    // Detect emotion from text
    detect(text) {
        const lowerText = text.toLowerCase();
        const scores = {};

        // Initialize scores
        for (const emotion of this.emotions) {
            scores[emotion] = 0;
        }

        // Check for intensity modifiers
        let intensityBonus = 1.0;
        for (const modifier of this.intensifiers) {
            if (lowerText.includes(modifier)) {
                intensityBonus = 1.5;
                break;
            }
        }

        // Keyword matching
        for (const [word, emotions] of this.keywordIndex) {
            if (lowerText.includes(word)) {
                for (const emotion of emotions) {
                    scores[emotion] += intensityBonus;
                }
            }
        }

        // Check for emoticons
        this._detectEmoticons(lowerText, scores);

        // Check for repeated characters (강조)
        this._detectRepetition(lowerText, scores);

        // Normalize scores
        const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

        if (totalScore === 0) {
            return {
                emotion: 'neutral',
                confidence: 0.5,
                scores: scores
            };
        }

        // Find dominant emotion
        let maxEmotion = 'neutral';
        let maxScore = 0;
        for (const [emotion, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                maxEmotion = emotion;
            }
        }

        const confidence = Math.min(maxScore / (totalScore + 1), 1.0);

        return {
            emotion: maxEmotion,
            confidence: confidence,
            scores: scores
        };
    }

    _detectEmoticons(text, scores) {
        // Happy emoticons
        const happyPatterns = /[ㅋ]{2,}|[ㅎ]{2,}|:\)|:D|😊|😄|😁|🤣|😂/g;
        const happyMatches = text.match(happyPatterns);
        if (happyMatches) {
            scores.happy += happyMatches.length * 1.5;
        }

        // Sad emoticons
        const sadPatterns = /[ㅠㅜ]{2,}|:\(|😢|😭|😿|🥺/g;
        const sadMatches = text.match(sadPatterns);
        if (sadMatches) {
            scores.sad += sadMatches.length * 1.5;
        }

        // Love emoticons
        const lovePatterns = /[♡♥❤💕💖💗💘💝]/g;
        const loveMatches = text.match(lovePatterns);
        if (loveMatches) {
            scores.loving += loveMatches.length * 2;
        }

        // Angry/annoyed emoticons
        const angryPatterns = /[ㅡ]{2,}|-_-|😠|😡|🤬|💢/g;
        const angryMatches = text.match(angryPatterns);
        if (angryMatches) {
            scores.angry += angryMatches.length * 1.5;
        }

        // Surprised emoticons
        const surprisedPatterns = /[ㅇㅁ]{2,}|ㄷㄷ|😮|😲|🤯|😱/g;
        const surprisedMatches = text.match(surprisedPatterns);
        if (surprisedMatches) {
            scores.surprised += surprisedMatches.length * 1.5;
        }
    }

    _detectRepetition(text, scores) {
        // Repeated ㅋ - laughing
        const kRepeats = text.match(/ㅋ+/g);
        if (kRepeats) {
            for (const k of kRepeats) {
                if (k.length >= 3) {
                    scores.happy += k.length * 0.3;
                }
            }
        }

        // Repeated ㅠ/ㅜ - crying
        const cryRepeats = text.match(/[ㅠㅜ]+/g);
        if (cryRepeats) {
            for (const c of cryRepeats) {
                if (c.length >= 2) {
                    scores.sad += c.length * 0.3;
                }
            }
        }

        // Repeated ! - excitement
        const exclamations = text.match(/!+/g);
        if (exclamations) {
            for (const e of exclamations) {
                if (e.length >= 2) {
                    scores.excited += e.length * 0.3;
                }
            }
        }

        // Repeated ? - confusion/worry
        const questions = text.match(/\?+/g);
        if (questions) {
            for (const q of questions) {
                if (q.length >= 2) {
                    scores.worried += q.length * 0.2;
                }
            }
        }
    }

    // Get appropriate response emotion based on input
    getResponseEmotion(inputEmotion) {
        const responseMap = {
            happy: 'happy',
            sad: 'loving',      // Comfort with love
            angry: 'worried',   // Show concern
            surprised: 'excited',
            loving: 'loving',
            worried: 'loving',  // Comfort
            excited: 'excited',
            neutral: 'happy'    // Default friendly
        };
        return responseMap[inputEmotion] || 'happy';
    }

    // Get emotion emoji
    getEmoji(emotion) {
        const emojiMap = {
            happy: ['😊', '😄', '🥰', '✨', '💫'],
            sad: ['🥺', '😢', '💧', '😿'],
            angry: ['😤', '💢', '😠'],
            surprised: ['😮', '😲', '🤭', '❗'],
            loving: ['💕', '💖', '🥰', '♡', '💗'],
            worried: ['😰', '🤔', '😟', '💦'],
            excited: ['🎉', '✨', '🌟', '💫', '🔥'],
            neutral: ['😊', '🙂', '✨']
        };
        const emojis = emojiMap[emotion] || emojiMap.neutral;
        return emojis[Math.floor(Math.random() * emojis.length)];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EmotionDetector;
}
